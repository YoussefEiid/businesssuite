import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PurchaseLineItemDto {
  @ApiProperty({ example: 'item-uuid' })
  @IsNotEmpty()
  @IsString()
  itemId!: string;

  @ApiProperty({ example: 50 })
  @IsNumber()
  @Min(0.0001)
  quantity!: number;

  @ApiProperty({ example: 100.0 })
  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @ApiPropertyOptional({ example: 15.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  taxRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreatePurchaseOrderDto {
  @ApiProperty({ example: 'supplier-uuid' })
  @IsNotEmpty()
  @IsString()
  partyId!: string;

  @ApiPropertyOptional({ example: 'wh-uuid' })
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @ApiPropertyOptional({ example: '2026-10-15T00:00:00.000Z' })
  @IsOptional()
  @IsString()
  expectedDeliveryDate?: string;

  @ApiProperty({ type: [PurchaseLineItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseLineItemDto)
  items!: PurchaseLineItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreatePurchaseInvoiceDto {
  @ApiProperty({ example: 'supplier-uuid' })
  @IsNotEmpty()
  @IsString()
  partyId!: string;

  @ApiProperty({ example: 'wh-uuid' })
  @IsNotEmpty()
  @IsString()
  warehouseId!: string;

  @ApiPropertyOptional({ example: 'SUP-INV-98765' })
  @IsOptional()
  @IsString()
  supplierInvoiceNumber?: string;

  @ApiPropertyOptional({ example: '2026-10-15T00:00:00.000Z' })
  @IsOptional()
  @IsString()
  dueDate?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  postImmediately?: boolean;

  @ApiProperty({ type: [PurchaseLineItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseLineItemDto)
  items!: PurchaseLineItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdatePurchaseInvoiceDto {
  @ApiPropertyOptional({ example: 'supplier-uuid' })
  @IsOptional()
  @IsString()
  partyId?: string;

  @ApiPropertyOptional({ example: 'wh-uuid' })
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @ApiPropertyOptional({ example: 'SUP-INV-98765' })
  @IsOptional()
  @IsString()
  supplierInvoiceNumber?: string;

  @ApiPropertyOptional({ example: '2026-10-15T00:00:00.000Z' })
  @IsOptional()
  @IsString()
  dueDate?: string;

  @ApiPropertyOptional({ type: [PurchaseLineItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseLineItemDto)
  items?: PurchaseLineItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreatePurchaseReturnDto {
  @ApiProperty({ example: 'purchase-invoice-uuid' })
  @IsNotEmpty()
  @IsString()
  purchaseInvoiceId!: string;

  @ApiProperty({
    type: 'array',
    items: {
      type: 'object',
      properties: {
        itemId: { type: 'string' },
        quantity: { type: 'number' },
        notes: { type: 'string' },
      },
    },
  })
  @IsArray()
  items!: Array<{ itemId: string; quantity: number; notes?: string }>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
