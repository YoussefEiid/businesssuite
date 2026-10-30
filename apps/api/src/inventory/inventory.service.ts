import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { StockMovementService } from './stock-movement.service';
import {
  CreateItemDto,
  UpdateItemDto,
  CreateWarehouseDto,
  UpdateWarehouseDto,
  CreateUnitDto,
  CreateCategoryDto,
  StockTransferDto,
  StockAdjustmentDto,
  CreateItemUnitConversionDto,
  BulkImportItemsDto,
} from './dto/inventory.dto';
import { Prisma, StockMovementType, ItemType } from '@prisma/client';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    private prisma: PrismaService,
    private entitlementsService: EntitlementsService,
    private stockMovementService: StockMovementService,
  ) {}

  // --- Items ---

  async listItems(
    tenantId: string,
    params?: { categoryId?: string; search?: string; type?: ItemType },
  ) {
    const where: Prisma.ItemWhereInput = { tenantId };

    if (params?.categoryId) where.categoryId = params.categoryId;
    if (params?.type) where.type = params.type;

    if (params?.search) {
      const q = params.search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { nameAr: { contains: q, mode: 'insensitive' } },
        { code: { contains: q, mode: 'insensitive' } },
        { barcode: { contains: q, mode: 'insensitive' } },
      ];
    }

    const items = await this.prisma.item.findMany({
      where,
      include: {
        category: true,
        baseUnit: true,
        conversions: {
          include: { unit: true },
        },
        stocks: {
          include: {
            warehouse: { select: { id: true, name: true, nameAr: true, code: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return items.map((item) => {
      const totalStock = item.stocks.reduce((acc, s) => acc + Number(s.quantity), 0);
      const avgCost =
        item.stocks.length > 0
          ? item.stocks.reduce((acc, s) => acc + Number(s.quantity) * Number(s.averageCost), 0) /
            (totalStock || 1)
          : 0;

      return {
        ...item,
        totalStock,
        averageCost: avgCost,
        isLowStock: totalStock <= Number(item.minStockLevel) && item.type === 'STOCK',
      };
    });
  }

  async getItem(tenantId: string, itemId: string) {
    const item = await this.prisma.item.findUnique({
      where: { id: itemId },
      include: {
        category: true,
        baseUnit: true,
        stocks: {
          include: { warehouse: true },
        },
        conversions: {
          include: { unit: true },
        },
        movements: {
          take: 20,
          orderBy: { createdAt: 'desc' },
          include: { warehouse: true },
        },
      },
    });

    if (!item || item.tenantId !== tenantId) {
      throw new NotFoundException('Item not found');
    }

    const totalStock = item.stocks.reduce((acc, s) => acc + Number(s.quantity), 0);

    return {
      ...item,
      totalStock,
    };
  }

  async createItem(tenantId: string, dto: CreateItemDto, userId: string) {
    // 1. Quota Check: ITEMS_LIMIT
    const currentItemsCount = await this.prisma.item.count({ where: { tenantId } });
    const quotaCheck = await this.entitlementsService.checkQuotaAvailable(
      tenantId,
      'ITEMS_LIMIT',
      currentItemsCount,
    );

    if (!quotaCheck.allowed) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'QUOTA_EXCEEDED',
        message: `Items limit reached (${quotaCheck.current}/${quotaCheck.limit}). Please upgrade your plan.`,
        quotaKey: 'ITEMS_LIMIT',
      });
    }

    const existingCode = await this.prisma.item.findUnique({
      where: {
        tenantId_code: {
          tenantId,
          code: dto.code,
        },
      },
    });

    if (existingCode) {
      throw new ConflictException(`Item code '${dto.code}' already exists`);
    }

    return this.prisma.$transaction(async (tx) => {
      const item = await tx.item.create({
        data: {
          tenantId,
          code: dto.code,
          barcode: dto.barcode,
          name: dto.name,
          nameAr: dto.nameAr,
          description: dto.description,
          type: dto.type,
          categoryId: dto.categoryId,
          baseUnitId: dto.baseUnitId,
          purchasePrice: dto.purchasePrice ? new Prisma.Decimal(dto.purchasePrice) : new Prisma.Decimal(0),
          sellingPrice: dto.sellingPrice ? new Prisma.Decimal(dto.sellingPrice) : new Prisma.Decimal(0),
          minStockLevel: dto.minStockLevel ? new Prisma.Decimal(dto.minStockLevel) : new Prisma.Decimal(0),
          taxRate: dto.taxRate !== undefined ? new Prisma.Decimal(dto.taxRate) : new Prisma.Decimal(0),
          isTaxInclusive: dto.isTaxInclusive ?? false,
        },
      });

      // If initial stock provided for stock items
      if (dto.type === 'STOCK' && dto.initialWarehouseId && dto.initialQuantity && dto.initialQuantity > 0) {
        await this.stockMovementService.recordMovement({
          tenantId,
          warehouseId: dto.initialWarehouseId,
          itemId: item.id,
          type: StockMovementType.OPENING_BALANCE,
          quantity: dto.initialQuantity,
          unitPrice: dto.initialCost || dto.purchasePrice || 0,
          documentNumber: 'OP-' + dto.code,
          notes: 'Opening stock balance',
          userId,
          tx,
        });
      }

      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'ITEM_CREATED',
          entityType: 'Item',
          entityId: item.id,
          newValues: dto as any,
        },
      });

      return item;
    });
  }

  async updateItem(tenantId: string, itemId: string, dto: UpdateItemDto, userId: string) {
    const existing = await this.prisma.item.findUnique({ where: { id: itemId } });
    if (!existing || existing.tenantId !== tenantId) throw new NotFoundException('Item not found');

    const updated = await this.prisma.item.update({
      where: { id: itemId },
      data: {
        barcode: dto.barcode ?? existing.barcode,
        name: dto.name ?? existing.name,
        nameAr: dto.nameAr ?? existing.nameAr,
        description: dto.description ?? existing.description,
        categoryId: dto.categoryId ?? existing.categoryId,
        baseUnitId: dto.baseUnitId ?? existing.baseUnitId,
        purchasePrice: dto.purchasePrice !== undefined ? new Prisma.Decimal(dto.purchasePrice) : existing.purchasePrice,
        sellingPrice: dto.sellingPrice !== undefined ? new Prisma.Decimal(dto.sellingPrice) : existing.sellingPrice,
        minStockLevel: dto.minStockLevel !== undefined ? new Prisma.Decimal(dto.minStockLevel) : existing.minStockLevel,
        taxRate: dto.taxRate !== undefined ? new Prisma.Decimal(dto.taxRate) : existing.taxRate,
        isTaxInclusive: dto.isTaxInclusive ?? existing.isTaxInclusive,
        isActive: dto.isActive ?? existing.isActive,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'ITEM_UPDATED',
        entityType: 'Item',
        entityId: itemId,
        oldValues: existing as any,
        newValues: dto as any,
      },
    });

    return updated;
  }

  async deleteItem(tenantId: string, itemId: string, userId: string) {
    const existing = await this.prisma.item.findUnique({
      where: { id: itemId },
      include: { _count: { select: { movements: true } } },
    });

    if (!existing || existing.tenantId !== tenantId) throw new NotFoundException('Item not found');

    if (existing._count.movements > 0) {
      // Archive instead of hard delete to preserve historical invoices & movements
      await this.prisma.item.update({
        where: { id: itemId },
        data: { isActive: false },
      });
      return { success: true, archived: true, message: 'Item has transactions; archived instead of deleted' };
    }

    await this.prisma.item.delete({ where: { id: itemId } });
    return { success: true, deleted: true };
  }

  // --- Warehouses ---

  async listWarehouses(tenantId: string) {
    return this.prisma.warehouse.findMany({
      where: { tenantId },
      include: { branch: true },
      orderBy: { code: 'asc' },
    });
  }

  async createWarehouse(tenantId: string, dto: CreateWarehouseDto, userId: string) {
    const currentWarehouses = await this.prisma.warehouse.count({ where: { tenantId } });
    const quotaCheck = await this.entitlementsService.checkQuotaAvailable(
      tenantId,
      'WAREHOUSES_LIMIT',
      currentWarehouses,
    );

    if (!quotaCheck.allowed) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'QUOTA_EXCEEDED',
        message: `Warehouses limit reached (${quotaCheck.current}/${quotaCheck.limit}). Please upgrade your plan.`,
        quotaKey: 'WAREHOUSES_LIMIT',
      });
    }

    const warehouse = await this.prisma.warehouse.create({
      data: {
        tenantId,
        code: dto.code,
        name: dto.name,
        nameAr: dto.nameAr,
        branchId: dto.branchId,
        address: dto.address,
        isDefault: dto.isDefault ?? false,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'WAREHOUSE_CREATED',
        entityType: 'Warehouse',
        entityId: warehouse.id,
        newValues: dto as any,
      },
    });

    return warehouse;
  }

  async updateWarehouse(tenantId: string, warehouseId: string, dto: UpdateWarehouseDto, userId: string) {
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse || warehouse.tenantId !== tenantId) {
      throw new NotFoundException('Warehouse not found');
    }

    if (dto.isDefault) {
      await this.prisma.warehouse.updateMany({
        where: { tenantId },
        data: { isDefault: false },
      });
    }

    const updated = await this.prisma.warehouse.update({
      where: { id: warehouseId },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.nameAr ? { nameAr: dto.nameAr } : {}),
        ...(dto.branchId !== undefined ? { branchId: dto.branchId || null } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
        ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      include: { branch: true },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'WAREHOUSE_UPDATED',
        entityType: 'Warehouse',
        entityId: warehouseId,
        newValues: dto as any,
      },
    });

    return updated;
  }

  async deleteWarehouse(tenantId: string, warehouseId: string, userId: string) {
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id: warehouseId },
      include: { _count: { select: { stocks: true, movements: true } } },
    });
    if (!warehouse || warehouse.tenantId !== tenantId) {
      throw new NotFoundException('Warehouse not found');
    }

    if (warehouse.isDefault) {
      throw new BadRequestException('Cannot delete the default warehouse');
    }

    if (warehouse._count.stocks > 0 || warehouse._count.movements > 0) {
      // Safe deactivation
      await this.prisma.warehouse.update({
        where: { id: warehouseId },
        data: { isActive: false },
      });
      return { success: true, archived: true, message: 'Warehouse has stocks/movements; deactivated instead of deleted' };
    }

    await this.prisma.warehouse.delete({ where: { id: warehouseId } });
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'WAREHOUSE_DELETED',
        entityType: 'Warehouse',
        entityId: warehouseId,
      },
    });

    return { success: true, deleted: true };
  }

  // --- Units & Categories ---

  async listUnits(tenantId: string) {
    return this.prisma.unit.findMany({ where: { tenantId }, orderBy: { code: 'asc' } });
  }

  async createUnit(tenantId: string, dto: CreateUnitDto) {
    return this.prisma.unit.create({
      data: {
        tenantId,
        code: dto.code,
        name: dto.name,
        nameAr: dto.nameAr,
        symbol: dto.symbol,
      },
    });
  }

  async listCategories(tenantId: string) {
    return this.prisma.itemCategory.findMany({ where: { tenantId }, orderBy: { code: 'asc' } });
  }

  async createCategory(tenantId: string, dto: CreateCategoryDto) {
    return this.prisma.itemCategory.create({
      data: {
        tenantId,
        code: dto.code,
        name: dto.name,
        nameAr: dto.nameAr,
      },
    });
  }

  // --- Transfers & Adjustments ---

  async transferStock(tenantId: string, dto: StockTransferDto, userId: string) {
    if (dto.sourceWarehouseId === dto.destinationWarehouseId) {
      throw new BadRequestException('Source and destination warehouse cannot be the same');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Deduct from source warehouse
      const sourceStock = await tx.warehouseStock.findUnique({
        where: {
          tenantId_warehouseId_itemId: {
            tenantId,
            warehouseId: dto.sourceWarehouseId,
            itemId: dto.itemId,
          },
        },
      });

      const sourceAvgCost = Number(sourceStock?.averageCost || 0);

      const outMovement = await this.stockMovementService.recordMovement({
        tenantId,
        warehouseId: dto.sourceWarehouseId,
        itemId: dto.itemId,
        type: StockMovementType.TRANSFER_OUT,
        quantity: -dto.quantity,
        unitPrice: sourceAvgCost,
        notes: `Transfer to ${dto.destinationWarehouseId}. ${dto.notes || ''}`,
        userId,
        tx,
      });

      // 2. Add to destination warehouse at source average cost to preserve value
      const inMovement = await this.stockMovementService.recordMovement({
        tenantId,
        warehouseId: dto.destinationWarehouseId,
        itemId: dto.itemId,
        type: StockMovementType.TRANSFER_IN,
        quantity: dto.quantity,
        unitPrice: sourceAvgCost,
        notes: `Transfer from ${dto.sourceWarehouseId}. ${dto.notes || ''}`,
        userId,
        tx,
      });

      return {
        success: true,
        sourceWarehouseId: dto.sourceWarehouseId,
        destinationWarehouseId: dto.destinationWarehouseId,
        transferredQuantity: dto.quantity,
        unitCost: sourceAvgCost,
      };
    });
  }

  async adjustStock(tenantId: string, dto: StockAdjustmentDto, userId: string) {
    const currentStock = await this.prisma.warehouseStock.findUnique({
      where: {
        tenantId_warehouseId_itemId: {
          tenantId,
          warehouseId: dto.warehouseId,
          itemId: dto.itemId,
        },
      },
    });

    const currentQty = Number(currentStock?.quantity || 0);
    const delta = dto.actualQuantity - currentQty;

    if (delta === 0) {
      return { success: true, message: 'Actual quantity matches current stock; no adjustment required' };
    }

    const currentAvgCost = Number(currentStock?.averageCost || 0);

    const movement = await this.stockMovementService.recordMovement({
      tenantId,
      warehouseId: dto.warehouseId,
      itemId: dto.itemId,
      type: StockMovementType.STOCKTAKE_ADJUSTMENT,
      quantity: delta,
      unitPrice: currentAvgCost,
      notes: `Stock adjustment: ${dto.reason}. Difference: ${delta > 0 ? '+' : ''}${delta}`,
      userId,
    });

    return {
      success: true,
      previousQuantity: currentQty,
      actualQuantity: dto.actualQuantity,
      adjustmentQuantity: delta,
      movement,
    };
  }

  async getLowStockAlerts(tenantId: string) {
    const items = await this.listItems(tenantId, { type: ItemType.STOCK });
    return items.filter((item) => item.isLowStock);
  }

  // --- Bulk Import ---

  async bulkImportItems(tenantId: string, dto: BulkImportItemsDto, userId: string) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('No items provided for import');
    }

    // 1. Quota Check: ITEMS_LIMIT
    const currentItemsCount = await this.prisma.item.count({ where: { tenantId } });
    const quotaCheck = await this.entitlementsService.checkQuotaAvailable(
      tenantId,
      'ITEMS_LIMIT',
      currentItemsCount + dto.items.length,
    );

    if (!quotaCheck.allowed) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'QUOTA_EXCEEDED',
        message: `Bulk import would exceed items limit (${quotaCheck.current + dto.items.length}/${quotaCheck.limit}). Please upgrade your plan.`,
        quotaKey: 'ITEMS_LIMIT',
      });
    }

    // Pre-fetch units for mapping
    const existingUnits = await this.prisma.unit.findMany({ where: { tenantId } });
    const unitMap = new Map<string, string>(); // code/name -> id
    existingUnits.forEach((u) => {
      unitMap.set(u.code.toLowerCase(), u.id);
      unitMap.set(u.name.toLowerCase(), u.id);
      unitMap.set(u.nameAr.toLowerCase(), u.id);
    });

    const defaultWarehouse = await this.prisma.warehouse.findFirst({
      where: { tenantId, isDefault: true },
    }) || await this.prisma.warehouse.findFirst({ where: { tenantId } });

    const createdItems: any[] = [];
    const errors: string[] = [];

    await this.prisma.$transaction(async (tx) => {
      for (let i = 0; i < dto.items.length; i++) {
        const row = dto.items[i];
        const rowNum = i + 1;

        if (!row.code || !row.nameAr) {
          errors.push(`Row #${rowNum}: Missing required code or Arabic name.`);
          continue;
        }

        const existing = await tx.item.findUnique({
          where: { tenantId_code: { tenantId, code: row.code.trim() } },
        });

        if (existing) {
          // Update existing item details
          const updated = await tx.item.update({
            where: { id: existing.id },
            data: {
              nameAr: row.nameAr.trim(),
              name: row.name?.trim() || row.nameAr.trim(),
              barcode: row.barcode?.trim() || existing.barcode,
              purchasePrice: row.purchasePrice !== undefined ? new Prisma.Decimal(row.purchasePrice) : existing.purchasePrice,
              sellingPrice: row.sellingPrice !== undefined ? new Prisma.Decimal(row.sellingPrice) : existing.sellingPrice,
              minStockLevel: row.minStockLevel !== undefined ? new Prisma.Decimal(row.minStockLevel) : existing.minStockLevel,
              taxRate: row.taxRate !== undefined ? new Prisma.Decimal(row.taxRate) : existing.taxRate,
            },
          });
          createdItems.push(updated);
        } else {
          // Find baseUnit if unitCode provided
          let baseUnitId: string | undefined = undefined;
          if (row.unitCode && unitMap.has(row.unitCode.trim().toLowerCase())) {
            baseUnitId = unitMap.get(row.unitCode.trim().toLowerCase());
          }

          const created = await tx.item.create({
            data: {
              tenantId,
              code: row.code.trim(),
              barcode: row.barcode?.trim(),
              nameAr: row.nameAr.trim(),
              name: row.name?.trim() || row.nameAr.trim(),
              type: row.type || ItemType.STOCK,
              baseUnitId,
              purchasePrice: row.purchasePrice ? new Prisma.Decimal(row.purchasePrice) : new Prisma.Decimal(0),
              sellingPrice: row.sellingPrice ? new Prisma.Decimal(row.sellingPrice) : new Prisma.Decimal(0),
              minStockLevel: row.minStockLevel ? new Prisma.Decimal(row.minStockLevel) : new Prisma.Decimal(0),
              taxRate: row.taxRate !== undefined ? new Prisma.Decimal(row.taxRate) : new Prisma.Decimal(0),
            },
          });

          // If initial quantity given and item is STOCK
          const targetWarehouseId = row.initialWarehouseId || defaultWarehouse?.id;
          if (created.type === 'STOCK' && row.initialQuantity && row.initialQuantity > 0 && targetWarehouseId) {
            await this.stockMovementService.recordMovement({
              tenantId,
              warehouseId: targetWarehouseId,
              itemId: created.id,
              type: StockMovementType.OPENING_BALANCE,
              quantity: row.initialQuantity,
              unitPrice: row.purchasePrice || 0,
              documentNumber: `IMP-${created.code}`,
              notes: 'Imported opening balance',
              userId,
              tx,
            });
          }

          createdItems.push(created);
        }
      }

      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'ITEMS_BULK_IMPORTED',
          entityType: 'Item',
          entityId: 'BATCH',
          newValues: { totalImported: createdItems.length, errorsCount: errors.length } as any,
        },
      });
    });

    return {
      success: true,
      importedCount: createdItems.length,
      errors,
    };
  }

  // --- Item Unit Conversions ---

  async addItemUnitConversion(
    tenantId: string,
    itemId: string,
    dto: CreateItemUnitConversionDto,
    userId: string,
  ) {
    const item = await this.prisma.item.findUnique({ where: { id: itemId } });
    if (!item || item.tenantId !== tenantId) throw new NotFoundException('Item not found');

    const unit = await this.prisma.unit.findUnique({ where: { id: dto.unitId } });
    if (!unit || unit.tenantId !== tenantId) throw new NotFoundException('Unit not found');

    if (item.baseUnitId === dto.unitId) {
      throw new BadRequestException('Conversion unit cannot be identical to the item base unit');
    }

    if (dto.isDefaultSale) {
      await this.prisma.itemUnitConversion.updateMany({
        where: { tenantId, itemId },
        data: { isDefaultSale: false },
      });
    }

    if (dto.isDefaultPurchase) {
      await this.prisma.itemUnitConversion.updateMany({
        where: { tenantId, itemId },
        data: { isDefaultPurchase: false },
      });
    }

    const conversion = await this.prisma.itemUnitConversion.upsert({
      where: {
        itemId_unitId: {
          itemId,
          unitId: dto.unitId,
        },
      },
      update: {
        conversionRate: new Prisma.Decimal(dto.conversionRate),
        sellingPrice: dto.sellingPrice !== undefined ? new Prisma.Decimal(dto.sellingPrice) : null,
        purchasePrice: dto.purchasePrice !== undefined ? new Prisma.Decimal(dto.purchasePrice) : null,
        isDefaultSale: dto.isDefaultSale ?? false,
        isDefaultPurchase: dto.isDefaultPurchase ?? false,
      },
      create: {
        tenantId,
        itemId,
        unitId: dto.unitId,
        conversionRate: new Prisma.Decimal(dto.conversionRate),
        sellingPrice: dto.sellingPrice !== undefined ? new Prisma.Decimal(dto.sellingPrice) : null,
        purchasePrice: dto.purchasePrice !== undefined ? new Prisma.Decimal(dto.purchasePrice) : null,
        isDefaultSale: dto.isDefaultSale ?? false,
        isDefaultPurchase: dto.isDefaultPurchase ?? false,
      },
      include: { unit: true },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'ITEM_CONVERSION_ADDED',
        entityType: 'ItemUnitConversion',
        entityId: conversion.id,
        newValues: dto as any,
      },
    });

    return conversion;
  }

  async deleteItemUnitConversion(
    tenantId: string,
    itemId: string,
    conversionId: string,
    userId: string,
  ) {
    const conversion = await this.prisma.itemUnitConversion.findUnique({
      where: { id: conversionId },
    });
    if (!conversion || conversion.tenantId !== tenantId || conversion.itemId !== itemId) {
      throw new NotFoundException('Item unit conversion not found');
    }

    await this.prisma.itemUnitConversion.delete({ where: { id: conversionId } });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'ITEM_CONVERSION_DELETED',
        entityType: 'ItemUnitConversion',
        entityId: conversionId,
      },
    });

    return { success: true, deleted: true };
  }
}

