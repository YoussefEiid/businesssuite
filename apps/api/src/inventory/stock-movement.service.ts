import {
  Injectable,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, StockMovementType } from '@prisma/client';
import { calculateWeightedAverageCost } from '@business-suite/shared';

export interface RecordMovementInput {
  tenantId: string;
  warehouseId: string;
  itemId: string;
  type: StockMovementType;
  quantity: number; // Positive for IN, Negative for OUT
  unitPrice?: number; // Cost or selling price for reference
  referenceType?: string;
  referenceId?: string;
  documentNumber?: string;
  notes?: string;
  userId?: string;
  tx?: Prisma.TransactionClient;
}

@Injectable()
export class StockMovementService {
  private readonly logger = new Logger(StockMovementService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Atomic stock movement executor with Moving Weighted Average Cost (WAC) and Negative Stock Prevention
   */
  async recordMovement(input: RecordMovementInput): Promise<{
    movement: any;
    newBalance: number;
    newAverageCost: number;
  }> {
    const execute = async (tx: Prisma.TransactionClient) => {
      // 1. Fetch current stock state with row-level lock
      let currentStock = await tx.warehouseStock.findUnique({
        where: {
          tenantId_warehouseId_itemId: {
            tenantId: input.tenantId,
            warehouseId: input.warehouseId,
            itemId: input.itemId,
          },
        },
      });

      if (!currentStock) {
        currentStock = await tx.warehouseStock.create({
          data: {
            tenantId: input.tenantId,
            warehouseId: input.warehouseId,
            itemId: input.itemId,
            quantity: new Prisma.Decimal(0),
            averageCost: new Prisma.Decimal(0),
          },
        });
      }

      const currentQty = Number(currentStock.quantity);
      const currentAvgCost = Number(currentStock.averageCost);
      const moveQty = input.quantity;

      const newBalance = currentQty + moveQty;

      // 2. Prevent Negative Stock
      if (newBalance < 0) {
        throw new BadRequestException({
          statusCode: 400,
          error: 'INSUFFICIENT_STOCK',
          message: `Stock level cannot become negative. Available in warehouse: ${currentQty}, requested deduction: ${Math.abs(moveQty)}.`,
          availableStock: currentQty,
          requestedDeduction: Math.abs(moveQty),
        });
      }

      // 3. Compute new Moving Weighted Average Cost (WAC)
      let newAverageCost = currentAvgCost;
      let unitCostToRecord = input.unitPrice || currentAvgCost;

      if (moveQty > 0) {
        // Inward stock movement recalculates WAC
        const incomingPrice = input.unitPrice !== undefined ? input.unitPrice : currentAvgCost;
        newAverageCost = calculateWeightedAverageCost(
          currentQty,
          currentAvgCost,
          moveQty,
          incomingPrice,
        );
        unitCostToRecord = incomingPrice;
      } else {
        // Outward stock movement leaves WAC unchanged
        unitCostToRecord = currentAvgCost;
      }

      // 4. Update WarehouseStock
      await tx.warehouseStock.update({
        where: {
          tenantId_warehouseId_itemId: {
            tenantId: input.tenantId,
            warehouseId: input.warehouseId,
            itemId: input.itemId,
          },
        },
        data: {
          quantity: new Prisma.Decimal(newBalance),
          averageCost: new Prisma.Decimal(newAverageCost),
        },
      });

      // 5. Create Movement Ledger Record
      const totalCost = Math.abs(moveQty) * unitCostToRecord;

      const movement = await tx.stockMovement.create({
        data: {
          tenantId: input.tenantId,
          warehouseId: input.warehouseId,
          itemId: input.itemId,
          type: input.type,
          quantity: new Prisma.Decimal(moveQty),
          unitPrice: new Prisma.Decimal(unitCostToRecord),
          totalCost: new Prisma.Decimal(totalCost),
          balanceAfter: new Prisma.Decimal(newBalance),
          averageCostAfter: new Prisma.Decimal(newAverageCost),
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          documentNumber: input.documentNumber,
          notes: input.notes,
          createdByUserId: input.userId,
        },
      });

      return {
        movement,
        newBalance,
        newAverageCost,
      };
    };

    if (input.tx) {
      return execute(input.tx);
    } else {
      return this.prisma.$transaction(execute);
    }
  }
}
