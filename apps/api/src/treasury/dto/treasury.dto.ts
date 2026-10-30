import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AccountType, VoucherType } from '@business-suite/shared';

export class CreateAccountDto {
  @ApiProperty({ enum: AccountType, example: AccountType.CASH })
  @IsEnum(AccountType)
  type!: AccountType;

  @ApiProperty({ example: 'BNK-01' })
  @IsNotEmpty()
  @IsString()
  code!: string;

  @ApiProperty({ example: 'Al Rajhi Corporate Account' })
  @IsNotEmpty()
  @IsString()
  name!: string;

  @ApiProperty({ example: 'حساب مصرف الراجحي' })
  @IsNotEmpty()
  @IsString()
  nameAr!: string;

  @ApiPropertyOptional({ example: 'SA0380000000608010167890' })
  @IsOptional()
  @IsString()
  accountNumber?: string;

  @ApiPropertyOptional({ example: 'Al Rajhi Bank' })
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiPropertyOptional({ example: 10000 })
  @IsOptional()
  @IsNumber()
  openingBalance?: number;
}

export class AllocationItemDto {
  @ApiPropertyOptional({ example: 'sales-invoice-uuid' })
  @IsOptional()
  @IsString()
  salesInvoiceId?: string;

  @ApiPropertyOptional({ example: 'purchase-invoice-uuid' })
  @IsOptional()
  @IsString()
  purchaseInvoiceId?: string;

  @ApiProperty({ example: 500.0 })
  @IsNumber()
  @Min(0.01)
  allocatedAmount!: number;
}

export class CreateVoucherDto {
  @ApiProperty({ enum: VoucherType, example: VoucherType.RECEIPT })
  @IsEnum(VoucherType)
  type!: VoucherType;

  @ApiProperty({ example: 'account-uuid' })
  @IsNotEmpty()
  @IsString()
  accountId!: string;

  @ApiPropertyOptional({ example: 'party-uuid' })
  @IsOptional()
  @IsString()
  partyId?: string;

  @ApiProperty({ example: 1500.0 })
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiPropertyOptional({ example: 'BANK_TRANSFER' })
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiPropertyOptional({ example: 'TXN-98234823' })
  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @ApiPropertyOptional({ type: [AllocationItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AllocationItemDto)
  allocations?: AllocationItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class VoidVoucherDto {
  @ApiPropertyOptional({ example: 'سند مكرر تم إدخاله بالخطأ' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class TransferFundsDto {
  @ApiProperty({ example: 'cash-drawer-uuid' })
  @IsNotEmpty()
  @IsString()
  sourceAccountId!: string;

  @ApiProperty({ example: 'bank-account-uuid' })
  @IsNotEmpty()
  @IsString()
  destinationAccountId!: string;

  @ApiProperty({ example: 5000.0 })
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiPropertyOptional({ example: 'TRF-BANK-0091' })
  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @ApiPropertyOptional({ example: 'إيداع نقدي يومي من صندوق الكاش إلى حساب الراجحي' })
  @IsOptional()
  @IsString()
  notes?: string;
}

