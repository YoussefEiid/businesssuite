import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { EntitlementGuard } from '../common/guards/entitlement.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { RequireFeature } from '../common/decorators/require-feature.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { EntitlementsService } from '../entitlements/entitlements.service';

@ApiTags('Reports & Analytics')
@Controller('reports')
@UseGuards(JwtAuthGuard, TenantGuard, EntitlementGuard, PermissionsGuard)
@RequireFeature('reports.basic')
@ApiBearerAuth()
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly entitlementsService: EntitlementsService,
  ) {}

  private async canUserViewCost(user: AuthenticatedUser, tenantId: string): Promise<boolean> {
    if (user.isSuperAdmin || user.activeRole === 'TENANT_OWNER' || user.activeRole === 'COMPANY_ADMIN') {
      return true;
    }
    const hasFeature = await this.entitlementsService.isFeatureEntitled(tenantId, 'reports.cost_visibility');
    if (!hasFeature) return false;
    const permissions = new Set(user.permissions || []);
    return permissions.has('*') || permissions.has('reports.view_cost');
  }

  @Get('dashboard-summary')
  @ApiOperation({ summary: 'Get operational KPI cards (Sales, Purchases, Receivables, Payables, Gross Margin)' })
  async getDashboardSummary(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const canViewCost = await this.canUserViewCost(user, tenantId);
    return this.reportsService.getDashboardSummary(tenantId, canViewCost);
  }

  @Get('sales')
  @ApiOperation({ summary: 'Get sales revenue, tax, and settlement analysis by period' })
  @ApiQuery({ name: 'fromDate', required: false })
  @ApiQuery({ name: 'toDate', required: false })
  getSalesReport(
    @CurrentTenant() tenantId: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    return this.reportsService.getSalesReport(
      tenantId,
      fromDate ? new Date(fromDate) : undefined,
      toDate ? new Date(toDate) : undefined,
    );
  }

  @Get('stock-valuation')
  @ApiOperation({ summary: 'Get stock inventory quantities and total valuation (with cost protection)' })
  async getStockValuation(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const canViewCost = await this.canUserViewCost(user, tenantId);
    return this.reportsService.getStockValuationReport(tenantId, canViewCost);
  }

  @Get('customer-receivables')
  @ApiOperation({ summary: 'Get customer outstanding debt balances' })
  getCustomerReceivables(@CurrentTenant() tenantId: string) {
    return this.reportsService.getCustomerReceivablesReport(tenantId);
  }

  @Get('supplier-payables')
  @ApiOperation({ summary: 'Get supplier outstanding payable balances' })
  getSupplierPayables(@CurrentTenant() tenantId: string) {
    return this.reportsService.getSupplierPayablesReport(tenantId);
  }
}
