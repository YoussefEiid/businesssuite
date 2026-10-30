import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EntitlementsService, TenantEntitlements } from './entitlements.service';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { FEATURE_CATALOG } from '@business-suite/shared';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Entitlements')
@Controller('entitlements')
export class EntitlementsController {
  constructor(private readonly entitlementsService: EntitlementsService) {}

  @Public()
  @Get('catalog')
  @ApiOperation({ summary: 'Get global catalog of supported features' })
  getFeatureCatalog() {
    return Object.values(FEATURE_CATALOG);
  }

  @Get('my-entitlements')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get active entitlements, enabled features, and quota limits for the current company' })
  async getMyEntitlements(
    @CurrentTenant() tenantId: string,
  ): Promise<TenantEntitlements> {
    return this.entitlementsService.getTenantEntitlements(tenantId);
  }
}
