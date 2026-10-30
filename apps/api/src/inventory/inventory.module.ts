import { Module } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { StockMovementService } from './stock-movement.service';
import { InventoryController } from './inventory.controller';

@Module({
  controllers: [InventoryController],
  providers: [InventoryService, StockMovementService],
  exports: [InventoryService, StockMovementService],
})
export class InventoryModule {}
