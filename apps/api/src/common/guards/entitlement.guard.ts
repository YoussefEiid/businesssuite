import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FEATURE_KEY } from '../decorators/require-feature.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { EntitlementsService } from '../../entitlements/entitlements.service';

@Injectable()
export class EntitlementGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private entitlementsService: EntitlementsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requiredFeature = this.reflector.getAllAndOverride<string>(
      FEATURE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredFeature) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const tenantId = request.tenantId || user?.activeTenantId;

    if (!tenantId) {
      throw new ForbiddenException('Tenant context required for feature entitlement check');
    }

    // SuperAdmin accessing without tenant context directly
    if (user?.isSuperAdmin && !tenantId) {
      return true;
    }

    const isEntitled = await this.entitlementsService.isFeatureEntitled(
      tenantId,
      requiredFeature,
    );

    if (!isEntitled) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'FEATURE_NOT_IN_PLAN',
        message: `Feature '${requiredFeature}' is not included in your current subscription plan. Please upgrade or contact support.`,
        requiredFeature,
      });
    }

    return true;
  }
}
