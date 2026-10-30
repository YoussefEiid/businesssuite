import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
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
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { EntitlementGuard } from '../common/guards/entitlement.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireFeature } from '../common/decorators/require-feature.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { ItemType } from '@business-suite/shared';

@ApiTags('Inventory, Items & Warehouses')
@Controller('inventory')
@UseGuards(JwtAuthGuard, TenantGuard, EntitlementGuard, PermissionsGuard)
@RequireFeature('inventory.core')
@ApiBearerAuth()
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  // --- Items ---

  @Get('items')
  @ApiOperation({ summary: 'List items and services with stock levels, search, and category filter' })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'type', enum: ItemType, required: false })
  listItems(
    @CurrentTenant() tenantId: string,
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
    @Query('type') type?: ItemType,
  ) {
    return this.inventoryService.listItems(tenantId, { categoryId, search, type });
  }

  @Get('items/low-stock')
  @ApiOperation({ summary: 'Get list of items that reached or dropped below reorder level' })
  getLowStock(@CurrentTenant() tenantId: string) {
    return this.inventoryService.getLowStockAlerts(tenantId);
  }

  @Get('items/:id')
  @ApiOperation({ summary: 'Get item details, multi-warehouse stock balances, and recent movement history' })
  getItem(
    @CurrentTenant() tenantId: string,
    @Param('id') itemId: string,
  ) {
    return this.inventoryService.getItem(tenantId, itemId);
  }

  @Post('items')
  @ApiOperation({ summary: 'Create new item or service within plan item limits' })
  @RequirePermissions('inventory.items.create')
  createItem(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateItemDto,
  ) {
    return this.inventoryService.createItem(tenantId, dto, userId);
  }

  @Put('items/:id')
  @ApiOperation({ summary: 'Update item details, prices, or tax configuration' })
  @RequirePermissions('inventory.items.edit')
  updateItem(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') itemId: string,
    @Body() dto: UpdateItemDto,
  ) {
    return this.inventoryService.updateItem(tenantId, itemId, dto, userId);
  }

  @Post('items/bulk-import')
  @ApiOperation({ summary: 'Bulk import items from CSV / JSON dataset with line-by-line validation' })
  @RequirePermissions('inventory.items.create')
  bulkImport(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: BulkImportItemsDto,
  ) {
    return this.inventoryService.bulkImportItems(tenantId, dto, userId);
  }

  @Post('items/:id/conversions')
  @ApiOperation({ summary: 'Add packaging or multi-unit conversion for an item' })
  @RequirePermissions('inventory.items.edit')
  addItemConversion(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') itemId: string,
    @Body() dto: CreateItemUnitConversionDto,
  ) {
    return this.inventoryService.addItemUnitConversion(tenantId, itemId, dto, userId);
  }

  @Delete('items/:id/conversions/:conversionId')
  @ApiOperation({ summary: 'Delete packaging or multi-unit conversion' })
  @RequirePermissions('inventory.items.edit')
  deleteItemConversion(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') itemId: string,
    @Param('conversionId') conversionId: string,
  ) {
    return this.inventoryService.deleteItemUnitConversion(tenantId, itemId, conversionId, userId);
  }

  @Delete('items/:id')
  @ApiOperation({ summary: 'Delete or archive item safely preserving historical records' })
  @RequirePermissions('inventory.items.delete')
  deleteItem(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') itemId: string,
  ) {
    return this.inventoryService.deleteItem(tenantId, itemId, userId);
  }

  // --- Warehouses ---

  @Get('warehouses')
  @ApiOperation({ summary: 'List all company warehouses' })
  listWarehouses(@CurrentTenant() tenantId: string) {
    return this.inventoryService.listWarehouses(tenantId);
  }

  @Post('warehouses')
  @ApiOperation({ summary: 'Create new warehouse within plan warehouse limits' })
  createWarehouse(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateWarehouseDto,
  ) {
    return this.inventoryService.createWarehouse(tenantId, dto, userId);
  }

  @Put('warehouses/:id')
  @ApiOperation({ summary: 'Update warehouse details or set as default warehouse' })
  updateWarehouse(
    @CurrentTenant() tenantId: string,
    @Param('id') warehouseId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateWarehouseDto,
  ) {
    return this.inventoryService.updateWarehouse(tenantId, warehouseId, dto, userId);
  }

  @Delete('warehouses/:id')
  @ApiOperation({ summary: 'Delete or deactivate warehouse' })
  deleteWarehouse(
    @CurrentTenant() tenantId: string,
    @Param('id') warehouseId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.inventoryService.deleteWarehouse(tenantId, warehouseId, userId);
  }

  // --- Units & Categories ---

  @Get('units')
  @ApiOperation({ summary: 'List measurement units' })
  listUnits(@CurrentTenant() tenantId: string) {
    return this.inventoryService.listUnits(tenantId);
  }

  @Post('units')
  @ApiOperation({ summary: 'Create measurement unit' })
  createUnit(@CurrentTenant() tenantId: string, @Body() dto: CreateUnitDto) {
    return this.inventoryService.createUnit(tenantId, dto);
  }

  @Get('categories')
  @ApiOperation({ summary: 'List item categories' })
  listCategories(@CurrentTenant() tenantId: string) {
    return this.inventoryService.listCategories(tenantId);
  }

  @Post('categories')
  @ApiOperation({ summary: 'Create item category' })
  createCategory(@CurrentTenant() tenantId: string, @Body() dto: CreateCategoryDto) {
    return this.inventoryService.createCategory(tenantId, dto);
  }

  // --- Transfers & Adjustments ---

  @Post('transfers')
  @ApiOperation({ summary: 'Execute atomic warehouse transfer preserving valuation' })
  @RequireFeature('inventory.transfers')
  @RequirePermissions('inventory.transfers.create')
  transferStock(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: StockTransferDto,
  ) {
    return this.inventoryService.transferStock(tenantId, dto, userId);
  }

  @Post('adjustments')
  @ApiOperation({ summary: 'Reconcile stocktake differences and create signed adjustment movement' })
  @RequireFeature('inventory.stocktake')
  @RequirePermissions('inventory.stocktake.create')
  adjustStock(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: StockAdjustmentDto,
  ) {
    return this.inventoryService.adjustStock(tenantId, dto, userId);
  }
}
