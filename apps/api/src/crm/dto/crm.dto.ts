import { IsNotEmpty, IsString, IsOptional, IsEnum, IsNumber, IsBoolean, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LeadStatus } from '@business-suite/shared';

export class CreateLeadDto {
  @ApiProperty({ example: 'Dr. Tariq Al-Ghamdi' })
  @IsNotEmpty()
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: 'Horizon Dental Polyclinic' })
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional({ example: '+966540001122' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'tariq@horizondental.com' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ enum: LeadStatus, example: LeadStatus.NEW })
  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  @ApiPropertyOptional({ example: 'Website Contact Form' })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional({ example: 'user-uuid' })
  @IsOptional()
  @IsString()
  assignedToUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateLeadDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ enum: LeadStatus })
  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignedToUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateOpportunityDto {
  @ApiProperty({ example: 'pipeline-uuid' })
  @IsNotEmpty()
  @IsString()
  pipelineId!: string;

  @ApiProperty({ example: 'stage-uuid' })
  @IsNotEmpty()
  @IsString()
  stageId!: string;

  @ApiPropertyOptional({ example: 'lead-uuid' })
  @IsOptional()
  @IsString()
  leadId?: string;

  @ApiPropertyOptional({ example: 'party-uuid' })
  @IsOptional()
  @IsString()
  partyId?: string;

  @ApiProperty({ example: 'Annual Clinic Supplies Contract' })
  @IsNotEmpty()
  @IsString()
  title!: string;

  @ApiProperty({ example: 45000 })
  @IsNumber()
  @Min(0)
  expectedValue!: number;

  @ApiPropertyOptional({ example: '2026-11-30T00:00:00.000Z' })
  @IsOptional()
  @IsString()
  closeDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateActivityDto {
  @ApiPropertyOptional({ example: 'lead-uuid' })
  @IsOptional()
  @IsString()
  leadId?: string;

  @ApiPropertyOptional({ example: 'opportunity-uuid' })
  @IsOptional()
  @IsString()
  opportunityId?: string;

  @ApiProperty({ example: 'CALL', description: 'CALL, MEETING, EMAIL, TASK, NOTE' })
  @IsNotEmpty()
  @IsString()
  type!: string;

  @ApiProperty({ example: 'Follow up on quotation feedback' })
  @IsNotEmpty()
  @IsString()
  subject!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: '2026-10-05T14:00:00.000Z' })
  @IsOptional()
  @IsString()
  dueDate?: string;

  @ApiPropertyOptional({ example: 'user-uuid' })
  @IsOptional()
  @IsString()
  assignedToUserId?: string;
}
