import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CRMService } from './crm.service';
import {
  CreateLeadDto,
  UpdateLeadDto,
  CreateOpportunityDto,
  CreateActivityDto,
} from './dto/crm.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { EntitlementGuard } from '../common/guards/entitlement.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireFeature } from '../common/decorators/require-feature.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { LeadStatus } from '@business-suite/shared';

@ApiTags('CRM, Leads, Pipelines & Activities')
@Controller('crm')
@UseGuards(JwtAuthGuard, TenantGuard, EntitlementGuard, PermissionsGuard)
@RequireFeature('crm.pipeline')
@ApiBearerAuth()
export class CRMController {
  constructor(private readonly crmService: CRMService) {}

  // --- Leads ---

  @Get('leads')
  @ApiOperation({ summary: 'List CRM leads with status and search filter' })
  @ApiQuery({ name: 'status', enum: LeadStatus, required: false })
  @ApiQuery({ name: 'search', required: false })
  listLeads(
    @CurrentTenant() tenantId: string,
    @Query('status') status?: LeadStatus,
    @Query('search') search?: string,
  ) {
    return this.crmService.listLeads(tenantId, status, search);
  }

  @Get('leads/:id')
  @ApiOperation({ summary: 'Get lead details and associated activity timeline' })
  getLead(@CurrentTenant() tenantId: string, @Param('id') leadId: string) {
    return this.crmService.getLead(tenantId, leadId);
  }

  @Post('leads')
  @ApiOperation({ summary: 'Create new CRM lead' })
  @RequirePermissions('crm.leads.create')
  createLead(@CurrentTenant() tenantId: string, @Body() dto: CreateLeadDto) {
    return this.crmService.createLead(tenantId, dto);
  }

  @Put('leads/:id')
  @ApiOperation({ summary: 'Update CRM lead details' })
  updateLead(
    @CurrentTenant() tenantId: string,
    @Param('id') leadId: string,
    @Body() dto: UpdateLeadDto,
  ) {
    return this.crmService.updateLead(tenantId, leadId, dto);
  }

  @Post('leads/:id/convert')
  @ApiOperation({ summary: 'Convert lead to verified customer profile' })
  @RequirePermissions('crm.contacts.create')
  convertLead(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') leadId: string,
  ) {
    return this.crmService.convertLeadToCustomer(tenantId, leadId, userId);
  }

  // --- Pipelines & Opportunities ---

  @Get('pipelines')
  @ApiOperation({ summary: 'List deal pipelines, stages, and active opportunities' })
  listPipelines(@CurrentTenant() tenantId: string) {
    return this.crmService.listPipelines(tenantId);
  }

  @Post('opportunities')
  @ApiOperation({ summary: 'Create new deal opportunity' })
  createOpportunity(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateOpportunityDto,
  ) {
    return this.crmService.createOpportunity(tenantId, dto);
  }

  @Put('opportunities/:id/stage')
  @ApiOperation({ summary: 'Move opportunity to another pipeline stage' })
  updateOpportunityStage(
    @CurrentTenant() tenantId: string,
    @Param('id') opportunityId: string,
    @Body() body: { stageId: string; status?: string },
  ) {
    return this.crmService.updateOpportunityStage(
      tenantId,
      opportunityId,
      body.stageId,
      body.status,
    );
  }

  // --- Activities ---

  @Get('activities')
  @ApiOperation({ summary: 'List follow-up activities and tasks' })
  @ApiQuery({ name: 'isCompleted', required: false })
  listActivities(
    @CurrentTenant() tenantId: string,
    @Query('isCompleted') isCompleted?: string,
  ) {
    return this.crmService.listActivities(
      tenantId,
      isCompleted !== undefined ? isCompleted === 'true' : undefined,
    );
  }

  @Post('activities')
  @ApiOperation({ summary: 'Create call, meeting, or reminder activity' })
  createActivity(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateActivityDto,
  ) {
    return this.crmService.createActivity(tenantId, dto);
  }

  @Put('activities/:id/toggle')
  @ApiOperation({ summary: 'Mark activity completed or reopened' })
  toggleActivity(
    @CurrentTenant() tenantId: string,
    @Param('id') activityId: string,
    @Body() body: { isCompleted: boolean },
  ) {
    return this.crmService.toggleActivityCompleted(tenantId, activityId, body.isCompleted);
  }

  @Delete('activities/:id')
  @ApiOperation({ summary: 'Delete CRM activity' })
  deleteActivity(@CurrentTenant() tenantId: string, @Param('id') activityId: string) {
    return this.crmService.deleteActivity(tenantId, activityId);
  }

  @Delete('opportunities/:id')
  @ApiOperation({ summary: 'Delete deal opportunity' })
  deleteOpportunity(@CurrentTenant() tenantId: string, @Param('id') opportunityId: string) {
    return this.crmService.deleteOpportunity(tenantId, opportunityId);
  }

  @Delete('leads/:id')
  @ApiOperation({ summary: 'Delete CRM lead' })
  deleteLead(@CurrentTenant() tenantId: string, @Param('id') leadId: string) {
    return this.crmService.deleteLead(tenantId, leadId);
  }
}
