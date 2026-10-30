import { IsNotEmpty, IsString, IsOptional, IsEmail, IsArray, IsEnum, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CurrencyCode } from '@business-suite/shared';

export class UpdateCompanyProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  taxNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  commercialReg?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  invoiceHeader?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  invoiceFooter?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  invoiceFooterAr?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  termsAndConditions?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  themeColor?: string;

  @ApiPropertyOptional({ enum: CurrencyCode, example: CurrencyCode.EGP })
  @IsOptional()
  @IsEnum(CurrencyCode, { message: 'currencyCode must be one of: EGP, SAR, USD' })
  currencyCode?: CurrencyCode;

  @ApiPropertyOptional()
  @IsOptional()
  settings?: any;
}

export class InviteMemberDto {
  @ApiProperty({ example: 'staff@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Khaled Hassan' })
  @IsNotEmpty()
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: '+966501112233' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'InitialTempPass123!' })
  @IsOptional()
  @IsString()
  initialPassword?: string;

  @ApiProperty({ example: 'SALES_AGENT' })
  @IsNotEmpty()
  @IsString()
  roleName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customRoleId?: string;

  @ApiPropertyOptional({ example: ['branch-id-1'] })
  @IsOptional()
  @IsArray()
  branchIds?: string[];

  @ApiPropertyOptional({ example: ['wh-id-1'] })
  @IsOptional()
  @IsArray()
  warehouseIds?: string[];

  @ApiPropertyOptional({ example: 'ACTIVE' })
  @IsOptional()
  @IsString()
  status?: string;
}

export class CreateBranchDto {
  @ApiProperty({ example: 'BR-02' })
  @IsNotEmpty()
  @IsString()
  code!: string;

  @ApiProperty({ example: 'Riyadh North Branch' })
  @IsNotEmpty()
  @IsString()
  name!: string;

  @ApiProperty({ example: 'فرع شمال الرياض' })
  @IsNotEmpty()
  @IsString()
  nameAr!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class CreateRoleDto {
  @ApiProperty({ example: 'Senior Sales Representative' })
  @IsNotEmpty()
  @IsString()
  name!: string;

  @ApiProperty({ example: 'ممثل مبيعات أول' })
  @IsNotEmpty()
  @IsString()
  nameAr!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: ['sales.invoices.view', 'sales.invoices.create', 'reports.sales.view'] })
  @IsArray()
  permissions!: string[];
}

export class UpdateBranchDto {
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
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateMemberDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  roleName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customRoleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  branchIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  warehouseIds?: string[];
}

