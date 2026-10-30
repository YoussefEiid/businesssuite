import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';

export const CurrentTenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const tenantId = request.tenantId || request.user?.activeTenantId;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant context is required for this operation');
    }
    return tenantId;
  },
);
