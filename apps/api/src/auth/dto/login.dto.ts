import { IsEmail, IsNotEmpty, IsString, MinLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin@business-suite.local' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Admin123456!' })
  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiPropertyOptional({ example: 'tenant-uuid-optional' })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiPropertyOptional({ description: 'MFA 6-digit code for super admins' })
  @IsOptional()
  @IsString()
  mfaCode?: string;
}
