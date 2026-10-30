import { IsNotEmpty, IsString, IsOptional, IsEnum, IsNumber, IsBoolean, IsArray, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ItemType } from '@business-suite/shared';

export class CreateItemDto {
  @ApiProperty({ example: 'ITM-001' })
  @IsNotEmpty()
  @IsString()
  code!: string;

  @ApiPropertyOptional({ example: '6281000123456' })
  @IsOptional()
  @IsString()
  barcode?: string;

  @ApiProperty({ example: 'HP Laser Printer Toner 85A' })
  @IsNotEmpty()
  @IsString()
  name!: string;

  @ApiProperty({ example: 'حبر طابعة إتش بي ليزر 85A' })
  @IsNotEmpty()
  @IsString()
  nameAr!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: ItemType, example: ItemType.STOCK })
  @IsEnum(ItemType)
  type!: ItemType;

  @ApiPropertyOptional({ example: 'category-uuid' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ example: 'unit-uuid' })
  @IsOptional()
  @IsString()
  baseUnitId?: string;

  @ApiPropertyOptional({ example: 120.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  purchasePrice?: number;

  @ApiPropertyOptional({ example: 180.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sellingPrice?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minStockLevel?: number;

  @ApiPropertyOptional({ example: 15.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  taxRate?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isTaxInclusive?: boolean;

  @ApiPropertyOptional({ example: 'wh-uuid' })
  @IsOptional()
  @IsString()
  initialWarehouseId?: string;

  @ApiPropertyOptional({ example: 50, description: 'Opening stock quantity' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  initialQuantity?: number;

  @ApiPropertyOptional({ example: 110.0, description: 'Opening unit cost' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  initialCost?: number;
}

export class UpdateItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  barcode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nameAr?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  purchasePrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  sellingPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  minStockLevel?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  taxRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isTaxInclusive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 'unit-uuid' })
  @IsOptional()
  @IsString()
  baseUnitId?: string;
}

export class CreateWarehouseDto {
  @ApiProperty({ example: 'WH-02' })
  @IsNotEmpty()
  @IsString()
  code!: string;

  @ApiProperty({ example: 'Dammam Main Warehouse' })
  @IsNotEmpty()
  @IsString()
  name!: string;

  @ApiProperty({ example: 'مستودع الدمام الرئيسي' })
  @IsNotEmpty()
  @IsString()
  nameAr!: string;

  @ApiPropertyOptional({ example: 'branch-uuid' })
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({ example: 'Dammam Industrial Area' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateWarehouseDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nameAr?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateUnitDto {
  @ApiProperty({ example: 'BOX' })
  @IsNotEmpty()
  @IsString()
  code!: string;

  @ApiProperty({ example: 'Box' })
  @IsNotEmpty()
  @IsString()
  name!: string;

  @ApiProperty({ example: 'كرتون' })
  @IsNotEmpty()
  @IsString()
  nameAr!: string;

  @ApiProperty({ example: 'كرتون' })
  @IsNotEmpty()
  @IsString()
  symbol!: string;
}

export class CreateCategoryDto {
  @ApiProperty({ example: 'CAT-01' })
  @IsNotEmpty()
  @IsString()
  code!: string;

  @ApiProperty({ example: 'Electronics' })
  @IsNotEmpty()
  @IsString()
  name!: string;

  @ApiProperty({ example: 'إلكترونيات وأجهزة' })
  @IsNotEmpty()
  @IsString()
  nameAr!: string;
}

export class StockTransferDto {
  @ApiProperty({ example: 'wh-source-uuid' })
  @IsNotEmpty()
  @IsString()
  sourceWarehouseId!: string;

  @ApiProperty({ example: 'wh-dest-uuid' })
  @IsNotEmpty()
  @IsString()
  destinationWarehouseId!: string;

  @ApiProperty({ example: 'item-uuid' })
  @IsNotEmpty()
  @IsString()
  itemId!: string;

  @ApiProperty({ example: 10 })
  @IsNumber()
  @Min(0.0001)
  quantity!: number;

  @ApiPropertyOptional({ example: 'Inter-branch replenishment' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class StockAdjustmentDto {
  @ApiProperty({ example: 'wh-uuid' })
  @IsNotEmpty()
  @IsString()
  warehouseId!: string;

  @ApiProperty({ example: 'item-uuid' })
  @IsNotEmpty()
  @IsString()
  itemId!: string;

  @ApiProperty({ example: 45, description: 'Actual counted physical quantity' })
  @IsNumber()
  actualQuantity!: number;

  @ApiProperty({ example: 'Physical stocktake difference' })
  @IsNotEmpty()
  @IsString()
  reason!: string;
}

export class CreateItemUnitConversionDto {
  @ApiProperty({ example: 'unit-uuid' })
  @IsNotEmpty()
  @IsString()
  unitId!: string;

  @ApiProperty({ example: 12, description: 'Conversion rate relative to base unit (e.g. 1 Box = 12 Pieces -> rate is 12)' })
  @IsNumber()
  @Min(0.0001)
  conversionRate!: number;

  @ApiPropertyOptional({ example: 120.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sellingPrice?: number;

  @ApiPropertyOptional({ example: 80.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  purchasePrice?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isDefaultSale?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isDefaultPurchase?: boolean;
}

export class BulkImportItemRowDto {
  @ApiProperty({ example: 'ITM-001' })
  @IsNotEmpty()
  @IsString()
  code!: string;

  @ApiPropertyOptional({ example: '6281000123456' })
  @IsOptional()
  @IsString()
  barcode?: string;

  @ApiProperty({ example: 'حبر طابعة ليزر' })
  @IsNotEmpty()
  @IsString()
  nameAr!: string;

  @ApiPropertyOptional({ example: 'Laser Printer Toner' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: ItemType, example: ItemType.STOCK })
  @IsOptional()
  @IsEnum(ItemType)
  type?: ItemType;

  @ApiPropertyOptional({ example: 'unit-code or unit-name' })
  @IsOptional()
  @IsString()
  unitCode?: string;

  @ApiPropertyOptional({ example: 50.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  purchasePrice?: number;

  @ApiPropertyOptional({ example: 80.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sellingPrice?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minStockLevel?: number;

  @ApiPropertyOptional({ example: 15.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  taxRate?: number;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  initialQuantity?: number;

  @ApiPropertyOptional({ example: 'wh-uuid' })
  @IsOptional()
  @IsString()
  initialWarehouseId?: string;
}

export class BulkImportItemsDto {
  @ApiProperty({ type: [BulkImportItemRowDto] })
  @IsArray()
  items!: BulkImportItemRowDto[];
}

