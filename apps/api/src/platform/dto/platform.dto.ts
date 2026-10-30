import { IsNotEmpty, IsString, IsOptional, IsNumber, IsBoolean, IsArray, IsObject, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SubscriptionStatus, TenantStatus } from '@prisma/client';
import { CurrencyCode } from '@business-suite/shared';

export class CreatePlanDto {
  @ApiProperty({ example: 'PRO_COMMERCE' })
  @IsNotEmpty()
  @IsString()
  code!: string;

  @ApiProperty({ example: 'الباقة المتقدمة' })
  @IsNotEmpty()
  @IsString()
  nameAr!: string;

  @ApiProperty({ example: 'Pro Commerce Plan' })
  @IsNotEmpty()
  @IsString()
  nameEn!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  descriptionAr?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  descriptionEn?: string;

  @ApiProperty({ example: 199 })
  @IsNumber()
  priceMonthly!: number;

  @ApiProperty({ example: 1990 })
  @IsNumber()
  priceYearly!: number;

  @ApiPropertyOptional({ example: 'SAR' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ example: ['sales.core', 'sales.quotations', 'purchases.core', 'inventory.core', 'crm.contacts'] })
  @IsArray()
  features!: string[];

  @ApiProperty({ example: { USERS_LIMIT: 10, BRANCHES_LIMIT: 3, WAREHOUSES_LIMIT: 3, ITEMS_LIMIT: 5000, MONTHLY_INVOICES_LIMIT: 1000 } })
  @IsObject()
  quotas!: Record<string, number>;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdatePlanDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nameAr?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nameEn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  descriptionAr?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  descriptionEn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  priceMonthly?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  priceYearly?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  features?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  quotas?: Record<string, number>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional({ description: 'APPLY_NOW (instant cache invalidate), UPON_RENEWAL, NEW_ONLY' })
  @IsOptional()
  @IsString()
  propagationMode?: 'APPLY_NOW' | 'UPON_RENEWAL' | 'NEW_ONLY';
}

export class UpdateTenantStatusDto {
  @ApiProperty({ enum: TenantStatus })
  @IsEnum(TenantStatus)
  status!: TenantStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ManageSubscriptionDto {
  @ApiProperty({ example: 'plan-uuid' })
  @IsNotEmpty()
  @IsString()
  planId!: string;

  @ApiPropertyOptional({ enum: SubscriptionStatus })
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  @ApiPropertyOptional({ example: '2027-12-31T23:59:59.000Z' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ example: 365, description: 'Number of days to extend subscription' })
  @IsOptional()
  @IsNumber()
  extensionDays?: number;

  @ApiPropertyOptional({ example: '2027-12-31T23:59:59.000Z' })
  @IsOptional()
  @IsString()
  customEndDate?: string;

  @ApiPropertyOptional({ example: 199 })
  @IsOptional()
  @IsNumber()
  paymentAmount?: number;

  @ApiPropertyOptional({ example: 'MANUAL_BANK_TRANSFER' })
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiPropertyOptional({ example: 'Manual renewal approved by Platform Admin' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class SetFeatureOverrideDto {
  @ApiProperty({ example: 'reports.advanced' })
  @IsNotEmpty()
  @IsString()
  featureKey!: string;

  @ApiProperty({ example: 'ALLOW' })
  @IsNotEmpty()
  @IsString()
  effect!: 'ALLOW' | 'DENY';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  validFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  validUntil?: string;

  @ApiPropertyOptional({ example: 'VIP Customer requested Advanced Reports addon' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class SetQuotaOverrideDto {
  @ApiProperty({ example: 'ITEMS_LIMIT' })
  @IsNotEmpty()
  @IsString()
  quotaKey!: string;

  @ApiProperty({ example: 10000 })
  @IsNumber()
  quotaLimit!: number;

  @ApiPropertyOptional({ example: 'Extra item capacity granted' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class CreatePlatformTenantDto {
  @ApiProperty({ example: 'مؤسسة النور للتجارة' })
  @IsNotEmpty()
  @IsString()
  companyName!: string;

  @ApiPropertyOptional({ example: 'al-noor-trading' })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiProperty({ example: 'محمد العتيبي' })
  @IsNotEmpty()
  @IsString()
  ownerName!: string;

  @ApiProperty({ example: 'owner@alnoor.com' })
  @IsNotEmpty()
  @IsString()
  ownerEmail!: string;

  @ApiProperty({ example: 'Noor123456!' })
  @IsNotEmpty()
  @IsString()
  ownerPassword!: string;

  @ApiPropertyOptional({ example: '+966501234567' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'plan-id-uuid' })
  @IsNotEmpty()
  @IsString()
  planId!: string;

  @ApiPropertyOptional({ enum: SubscriptionStatus, default: 'ACTIVE' })
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  subscriptionStatus?: SubscriptionStatus;

  @ApiPropertyOptional({ example: 30, description: 'Duration in days' })
  @IsOptional()
  @IsNumber()
  durationDays?: number;

  @ApiPropertyOptional({ enum: CurrencyCode, example: CurrencyCode.EGP, default: CurrencyCode.EGP })
  @IsOptional()
  @IsEnum(CurrencyCode, { message: 'currencyCode must be one of: EGP, SAR, USD' })
  currencyCode?: CurrencyCode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ClonePlanDto {
  @ApiProperty({ example: 'GROWTH_V2' })
  @IsNotEmpty()
  @IsString()
  newCode!: string;

  @ApiProperty({ example: 'باقة النمو المحدثة' })
  @IsNotEmpty()
  @IsString()
  newNameAr!: string;

  @ApiProperty({ example: 'Growth Plan V2' })
  @IsNotEmpty()
  @IsString()
  newNameEn!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  priceMonthly?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  priceYearly?: number;
}

