import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  IsBoolean,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SalesLineItemDto {
  @ApiProperty({ example: 'item-uuid' })
  @IsNotEmpty()
  @IsString()
  itemId!: string;

  @ApiProperty({ example: 2 })
  @IsNumber()
  @Min(0.0001)
  quantity!: number;

  @ApiProperty({ example: 150.0 })
  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @ApiPropertyOptional({ example: 10.0, description: 'Discount percentage or amount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountPercent?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

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

export class CreateSalesQuotationDto {
  @ApiProperty({ example: 'party-uuid' })
  @IsNotEmpty()
  @IsString()
  partyId!: string;

  @ApiPropertyOptional({ example: 'wh-uuid' })
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @ApiPropertyOptional({ example: '2026-10-01T00:00:00.000Z' })
  @IsOptional()
  @IsString()
  expiryDate?: string;

  @ApiProperty({ type: [SalesLineItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SalesLineItemDto)
  items!: SalesLineItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateSalesInvoiceDto {
  @ApiPropertyOptional({ example: 'party-uuid', description: 'Customer ID. If omitted for cash sales, defaults to Walk-in Cash Customer' })
  @IsOptional()
  @IsString()
  partyId?: string;

  @ApiProperty({ example: 'wh-uuid' })
  @IsNotEmpty()
  @IsString()
  warehouseId!: string;

  @ApiPropertyOptional({ example: '2026-10-01T00:00:00.000Z' })
  @IsOptional()
  @IsString()
  dueDate?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isTaxInclusive?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Automatically post invoice and affect stock & accounts upon creation' })
  @IsOptional()
  @IsBoolean()
  postImmediately?: boolean;

  @ApiPropertyOptional({ example: false, description: 'Direct cash sale - creates receipt voucher immediately' })
  @IsOptional()
  @IsBoolean()
  isCashSale?: boolean;

  @ApiPropertyOptional({ example: 'account-uuid', description: 'Required if isCashSale is true' })
  @IsOptional()
  @IsString()
  treasuryAccountId?: string;

  @ApiProperty({ type: [SalesLineItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SalesLineItemDto)
  items!: SalesLineItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ReturnLineItemDto {
  @ApiProperty({ example: 'item-uuid' })
  @IsNotEmpty()
  @IsString()
  itemId!: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @Min(0.0001)
  quantity!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateSalesReturnDto {
  @ApiProperty({ example: 'invoice-uuid' })
  @IsNotEmpty()
  @IsString()
  salesInvoiceId!: string;

  @ApiProperty({ type: [ReturnLineItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReturnLineItemDto)
  items!: ReturnLineItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
