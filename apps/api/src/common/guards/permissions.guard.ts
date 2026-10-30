import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

// Built-in role permission defaults
const BUILT_IN_ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: ['*'],
  TENANT_OWNER: ['*'],
  COMPANY_ADMIN: ['*'],
  SALES_AGENT: [
    'sales.quotations.view',
    'sales.quotations.create',
    'sales.quotations.edit',
    'sales.invoices.view',
    'sales.invoices.create',
    'sales.returns.view',
    'sales.returns.create',
    'crm.contacts.view',
    'crm.contacts.create',
    'crm.leads.view',
    'crm.leads.create',
    'crm.pipeline.view',
    'inventory.items.view',
    'reports.sales.view',
  ],
  WAREHOUSE_KEEPER: [
    'inventory.items.view',
    'inventory.items.create',
    'inventory.items.edit',
    'inventory.warehouses.view',
    'inventory.transfers.view',
    'inventory.transfers.create',
    'inventory.stocktake.view',
    'inventory.stocktake.create',
    'purchases.orders.view',
    'purchases.invoices.view',
    'purchases.returns.view',
    'reports.inventory.view',
  ],
  CASHIER: [
    'sales.invoices.view',
    'sales.invoices.create',
    'finance.cashbank.view',
    'finance.vouchers.view',
    'finance.vouchers.create',
    'finance.allocations.manage',
    'reports.treasury.view',
  ],
  REPORTS_VIEWER: [
    'reports.sales.view',
    'reports.purchases.view',
    'reports.inventory.view',
    'reports.treasury.view',
    'reports.basic.view',
  ],
};

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User context missing');
    }

    // SuperAdmin or Company Admin / Tenant Owner have wildcard access
    if (
      user.isSuperAdmin ||
      user.activeRole === 'SUPER_ADMIN' ||
      user.activeRole === 'TENANT_OWNER' ||
      user.activeRole === 'COMPANY_ADMIN'
    ) {
      return true;
    }

    const rolePermissions = BUILT_IN_ROLE_PERMISSIONS[user.activeRole] || [];
    const customPermissions = user.permissions || [];
    const userAllPermissions = new Set([...rolePermissions, ...customPermissions]);

    if (userAllPermissions.has('*')) {
      return true;
    }

    const hasAll = requiredPermissions.every((perm) => userAllPermissions.has(perm));
    if (!hasAll) {
      throw new ForbiddenException(
        `Insufficient permissions. Required: [${requiredPermissions.join(', ')}]`,
      );
    }

    return true;
  }
}
