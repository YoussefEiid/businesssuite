import { IsNotEmpty, IsString, IsOptional, IsEnum, IsNumber, IsEmail, IsBoolean, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PartyType } from '@business-suite/shared';

export class CreatePartyDto {
  @ApiProperty({ enum: PartyType, example: PartyType.CUSTOMER })
  @IsEnum(PartyType)
  type!: PartyType;

  @ApiProperty({ example: 'CUST-001' })
  @IsNotEmpty()
  @IsString()
  code!: string;

  @ApiProperty({ example: 'Al-Farabi Medical Supplies' })
  @IsNotEmpty()
  @IsString()
  name!: string;

  @ApiProperty({ example: 'مؤسسة الفارابي للتوريدات' })
  @IsNotEmpty()
  @IsString()
  nameAr!: string;

  @ApiPropertyOptional({ example: '+966551234567' })
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'info@alfarabi.com' })
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @ValidateIf((o) => !!o.email)
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '300123456700003' })
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsString()
  taxNumber?: string;

  @ApiPropertyOptional({ example: '1010123456' })
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsString()
  commercialReg?: string;

  @ApiPropertyOptional({ example: 50000 })
  @IsOptional()
  @Transform(({ value }) => (value === '' || isNaN(Number(value)) ? 0 : Number(value)))
  @IsNumber()
  creditLimit?: number;

  @ApiPropertyOptional({ example: 0, description: 'Opening receivable balance customer owes us' })
  @IsOptional()
  @Transform(({ value }) => (value === '' || isNaN(Number(value)) ? 0 : Number(value)))
  @IsNumber()
  openingReceivable?: number;

  @ApiPropertyOptional({ example: 0, description: 'Opening payable balance we owe supplier' })
  @IsOptional()
  @Transform(({ value }) => (value === '' || isNaN(Number(value)) ? 0 : Number(value)))
  @IsNumber()
  openingPayable?: number;

  @ApiPropertyOptional({ example: 'Riyadh, Olaya Street' })
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsString()
  notes?: string;
}

export class UpdatePartyDto {
  @ApiPropertyOptional({ enum: PartyType })
  @IsOptional()
  @IsEnum(PartyType)
  type?: PartyType;

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
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @ValidateIf((o) => !!o.email)
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsString()
  taxNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsString()
  commercialReg?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (value === '' || isNaN(Number(value)) ? undefined : Number(value)))
  @IsNumber()
  creditLimit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateContactDto {
  @ApiProperty({ example: 'Saleh Al-Otaibi' })
  @IsNotEmpty()
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: 'Procurement Manager' })
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsString()
  jobTitle?: string;

  @ApiPropertyOptional({ example: '+966559876543' })
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'saleh@alfarabi.com' })
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @ValidateIf((o) => !!o.email)
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
