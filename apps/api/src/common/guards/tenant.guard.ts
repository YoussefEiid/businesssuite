import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('User is not authenticated');
    }

    // SuperAdmin accessing platform-level routes
    const isPlatformRoute = request.url.startsWith('/api/platform');
    if (isPlatformRoute) {
      if (!user.isSuperAdmin) {
        throw new ForbiddenException('SuperAdmin privileges required for platform management');
      }
      return true;
    }

    // Resolve tenant ID from header or user's activeTenantId in JWT
    const tenantIdHeader = request.headers['x-tenant-id'] as string;
    const targetTenantId = tenantIdHeader || user.activeTenantId;

    if (!targetTenantId) {
      throw new ForbiddenException('No active tenant context provided');
    }

    // If super admin accessing a tenant directly with explicit header
    if (user.isSuperAdmin && !user.activeTenantId) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: targetTenantId },
      });
      if (!tenant) throw new ForbiddenException('Tenant does not exist');
      request.tenantId = targetTenantId;
      request.tenant = tenant;
      request.user.activeTenantId = targetTenantId;
      request.user.activeRole = 'SUPER_ADMIN';
      return true;
    }

    // Verify membership in database to prevent stale JWT claims
    const membership = await this.prisma.membership.findUnique({
      where: {
        tenantId_userId: {
          tenantId: targetTenantId,
          userId: user.id,
        },
      },
      include: {
        tenant: true,
        customRole: true,
      },
    });

    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenException('User is not an active member of this tenant');
    }

    if (membership.tenant.status === 'SUSPENDED') {
      throw new ForbiddenException('This company subscription/account is currently suspended');
    }

    if (membership.tenant.status === 'ARCHIVED') {
      throw new ForbiddenException('This company account has been archived');
    }

    // Attach verified context
    request.tenantId = targetTenantId;
    request.tenant = membership.tenant;
    request.user.activeTenantId = targetTenantId;
    request.user.activeRole = membership.roleName;
    request.user.branchIds = membership.branchIds as string[] | null;
    request.user.warehouseIds = membership.warehouseIds as string[] | null;
    request.user.permissions = (membership.customRole?.permissions as string[]) || [];

    return true;
  }
}
