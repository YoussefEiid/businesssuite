import { IsEmail, IsNotEmpty, IsString, MinLength, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CurrencyCode } from '@business-suite/shared';

export class RegisterCompanyDto {
  @ApiProperty({ example: 'Al-Amal Trading Est.' })
  @IsNotEmpty()
  @IsString()
  companyName!: string;

  @ApiProperty({ example: 'Ahmed Al-Mansour' })
  @IsNotEmpty()
  @IsString()
  userName!: string;

  @ApiProperty({ example: 'ahmed@alamal.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'StrongPassword123!' })
  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({ example: '+966500000000' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'STARTER' })
  @IsOptional()
  @IsString()
  planCode?: string;

  @ApiPropertyOptional({ enum: CurrencyCode, example: CurrencyCode.EGP, default: CurrencyCode.EGP })
  @IsOptional()
  @IsEnum(CurrencyCode, { message: 'currencyCode must be one of: EGP, SAR, USD' })
  currencyCode?: CurrencyCode;
}

export class SwitchTenantDto {
  @ApiProperty({ example: 'tenant-uuid' })
  @IsNotEmpty()
  @IsString()
  tenantId!: string;
}
