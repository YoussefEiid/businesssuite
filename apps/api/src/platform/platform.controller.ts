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
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PlatformService } from './platform.service';
import {
  CreatePlanDto,
  UpdatePlanDto,
  UpdateTenantStatusDto,
  ManageSubscriptionDto,
  SetFeatureOverrideDto,
  SetQuotaOverrideDto,
  CreatePlatformTenantDto,
  ClonePlanDto,
} from './dto/platform.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Platform Owner Administration')
@Controller('platform')
@UseGuards(JwtAuthGuard, TenantGuard)
@ApiBearerAuth()
export class PlatformController {
  constructor(private readonly platformService: PlatformService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Get global platform metrics, tenant counts, and real revenue summary' })
  getOverview() {
    return this.platformService.getPlatformOverview();
  }

  // --- Tenants ---

  @Get('tenants')
  @ApiOperation({ summary: 'List all companies with status, plan, members, and real usage stats' })
  listTenants() {
    return this.platformService.listTenants();
  }

  @Post('tenants')
  @ApiOperation({ summary: 'Directly create and onboard a new company with owner credentials and plan' })
  createTenant(
    @Body() dto: CreatePlatformTenantDto,
    @CurrentUser('id') adminUserId: string,
  ) {
    return this.platformService.createTenant(dto, adminUserId);
  }

  @Get('tenants/:id')
  @ApiOperation({ summary: 'Get detailed company profile, subscription, effective entitlements, and overrides' })
  getTenantDetails(@Param('id') tenantId: string) {
    return this.platformService.getTenantDetails(tenantId);
  }

  @Put('tenants/:id/status')
  @ApiOperation({ summary: 'Update company status (ACTIVE / SUSPENDED / ARCHIVED)' })
  updateTenantStatus(
    @Param('id') tenantId: string,
    @Body() dto: UpdateTenantStatusDto,
    @CurrentUser('id') adminUserId: string,
  ) {
    return this.platformService.updateTenantStatus(tenantId, dto, adminUserId);
  }

  // --- Plans ---

  @Get('plans')
  @ApiOperation({ summary: 'List all subscription plans with features, quotas, and pricing' })
  listPlans(@Query('includeArchived') includeArchived?: string) {
    return this.platformService.listPlans(includeArchived === 'true');
  }

  @Post('plans')
  @ApiOperation({ summary: 'Create new commercial subscription plan' })
  createPlan(
    @Body() dto: CreatePlanDto,
    @CurrentUser('id') adminUserId: string,
  ) {
    return this.platformService.createPlan(dto, adminUserId);
  }

  @Post('plans/:id/clone')
  @ApiOperation({ summary: 'Clone an existing plan with all features and quotas to a new code' })
  clonePlan(
    @Param('id') planId: string,
    @Body() dto: ClonePlanDto,
    @CurrentUser('id') adminUserId: string,
  ) {
    return this.platformService.clonePlan(planId, dto, adminUserId);
  }

  @Put('plans/:id/archive')
  @ApiOperation({ summary: 'Toggle plan archive status (hide/unhide from new subscribers)' })
  toggleArchivePlan(
    @Param('id') planId: string,
    @CurrentUser('id') adminUserId: string,
  ) {
    return this.platformService.toggleArchivePlan(planId, adminUserId);
  }

  @Put('plans/:id')
  @ApiOperation({ summary: 'Update plan features, quotas, or pricing with automatic cache invalidation' })
  updatePlan(
    @Param('id') planId: string,
    @Body() dto: UpdatePlanDto,
    @CurrentUser('id') adminUserId: string,
  ) {
    return this.platformService.updatePlan(planId, dto, adminUserId);
  }

  // --- Subscriptions & Overrides ---

  @Post('tenants/:id/subscription')
  @ApiOperation({ summary: 'Assign or renew subscription plan for a tenant with manual billing log' })
  manageSubscription(
    @Param('id') tenantId: string,
    @Body() dto: ManageSubscriptionDto,
    @CurrentUser('id') adminUserId: string,
  ) {
    return this.platformService.manageSubscription(tenantId, dto, adminUserId);
  }

  @Post('tenants/:id/feature-override')
  @ApiOperation({ summary: 'Set custom feature override (ALLOW/DENY) for a specific company' })
  setFeatureOverride(
    @Param('id') tenantId: string,
    @Body() dto: SetFeatureOverrideDto,
    @CurrentUser('id') adminUserId: string,
  ) {
    return this.platformService.setFeatureOverride(tenantId, dto, adminUserId);
  }

  @Delete('tenants/:id/feature-override/:featureKey')
  @ApiOperation({ summary: 'Remove feature override for a specific company' })
  deleteFeatureOverride(
    @Param('id') tenantId: string,
    @Param('featureKey') featureKey: string,
    @CurrentUser('id') adminUserId: string,
  ) {
    return this.platformService.deleteFeatureOverride(tenantId, featureKey, adminUserId);
  }

  @Post('tenants/:id/quota-override')
  @ApiOperation({ summary: 'Set custom quota override for a specific company' })
  setQuotaOverride(
    @Param('id') tenantId: string,
    @Body() dto: SetQuotaOverrideDto,
    @CurrentUser('id') adminUserId: string,
  ) {
    return this.platformService.setQuotaOverride(tenantId, dto, adminUserId);
  }

  @Delete('tenants/:id/quota-override/:quotaKey')
  @ApiOperation({ summary: 'Remove quota override for a specific company' })
  deleteQuotaOverride(
    @Param('id') tenantId: string,
    @Param('quotaKey') quotaKey: string,
    @CurrentUser('id') adminUserId: string,
  ) {
    return this.platformService.deleteQuotaOverride(tenantId, quotaKey, adminUserId);
  }

  // --- Audit Logs ---

  @Get('audit-logs')
  @ApiOperation({ summary: 'Inspect platform audit logs with before/after state diffs' })
  listAuditLogs(@Query('limit') limit?: string) {
    return this.platformService.listAuditLogs(limit ? parseInt(limit, 10) : 50);
  }
}
