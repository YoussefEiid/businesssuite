import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import {
  UpdateCompanyProfileDto,
  InviteMemberDto,
  UpdateMemberDto,
  CreateBranchDto,
  UpdateBranchDto,
  CreateRoleDto,
} from './dto/tenant.dto';
import * as bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(
    private prisma: PrismaService,
    private entitlementsService: EntitlementsService,
  ) {}

  async getCompanyProfile(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        settings: true,
        subscription: {
          include: {
            plan: true,
          },
        },
      },
    });

    const [entitlements, salesCount, purchaseCount, voucherCount] = await Promise.all([
      this.entitlementsService.getTenantEntitlements(tenantId),
      this.prisma.salesInvoice.count({ where: { tenantId } }),
      this.prisma.purchaseInvoice.count({ where: { tenantId } }),
      this.prisma.treasuryVoucher.count({ where: { tenantId } }),
    ]);

    const hasTransactions = salesCount > 0 || purchaseCount > 0 || voucherCount > 0;

    return {
      ...tenant,
      hasTransactions,
      entitlements,
    };
  }

  async updateCompanyProfile(tenantId: string, dto: UpdateCompanyProfileDto, userId: string) {
    // Check if custom branding requires feature
    if (dto.logoUrl || dto.themeColor) {
      const isEntitled = await this.entitlementsService.isFeatureEntitled(tenantId, 'branding.custom');
      if (!isEntitled) {
        // Fallback: allowed to update text fields, but branding changes require upgrade
      }
    }

    const invoiceHeader = dto.invoiceHeader || dto.settings?.invoiceHeader;
    const invoiceFooter = dto.invoiceFooter || dto.settings?.invoiceFooter;
    const invoiceFooterAr = dto.invoiceFooterAr || dto.settings?.invoiceFooterAr;
    const termsAndConditions = dto.termsAndConditions || dto.settings?.termsAndConditions;
    const themeColor = dto.themeColor || dto.settings?.themeColor;

    const tenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        name: dto.name,
        taxNumber: dto.taxNumber,
        commercialReg: dto.commercialReg,
        phone: dto.phone,
        email: dto.email,
        address: dto.address,
        logoUrl: dto.logoUrl,
        currencyCode: dto.currencyCode,
      },
    });

    await this.prisma.tenantSetting.upsert({
      where: { tenantId },
      update: {
        companyName: dto.name,
        companyNameAr: dto.name,
        taxNumber: dto.taxNumber,
        commercialReg: dto.commercialReg,
        phone: dto.phone,
        email: dto.email,
        address: dto.address,
        logoUrl: dto.logoUrl,
        invoiceHeader,
        invoiceFooter,
        invoiceFooterAr,
        termsAndConditions,
        themeColor,
      },
      create: {
        tenantId,
        companyName: dto.name,
        companyNameAr: dto.name,
        taxNumber: dto.taxNumber,
        commercialReg: dto.commercialReg,
        phone: dto.phone,
        email: dto.email,
        address: dto.address,
        logoUrl: dto.logoUrl,
        invoiceHeader,
        invoiceFooter,
        invoiceFooterAr,
        termsAndConditions,
        themeColor: themeColor || '#0ea5e9',
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'COMPANY_PROFILE_UPDATED',
        entityType: 'Tenant',
        entityId: tenantId,
        newValues: dto as any,
      },
    });

    return this.getCompanyProfile(tenantId);
  }

  // --- Staff & Memberships ---

  async listMembers(tenantId: string) {
    return this.prisma.membership.findMany({
      where: { tenantId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            isActive: true,
          },
        },
        customRole: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async inviteMember(tenantId: string, dto: InviteMemberDto, adminUserId: string) {
    // 1. Quota Check: USERS_LIMIT
    const currentActiveMembers = await this.prisma.membership.count({
      where: { tenantId, status: 'ACTIVE' },
    });

    const quotaCheck = await this.entitlementsService.checkQuotaAvailable(
      tenantId,
      'USERS_LIMIT',
      currentActiveMembers,
    );

    if (!quotaCheck.allowed) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'QUOTA_EXCEEDED',
        message: `Active users limit reached (${quotaCheck.current}/${quotaCheck.limit}). Please upgrade your plan or purchase user addon.`,
        quotaKey: 'USERS_LIMIT',
      });
    }

    const email = dto.email.toLowerCase().trim();

    // Check if user already exists
    let user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      const tempPass = dto.initialPassword || 'Pass@' + Math.floor(100000 + Math.random() * 900000);
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(tempPass, salt);

      user = await this.prisma.user.create({
        data: {
          email,
          name: dto.name,
          phone: dto.phone,
          passwordHash,
        },
      });
    }

    // Check if already member
    const existingMembership = await this.prisma.membership.findUnique({
      where: {
        tenantId_userId: {
          tenantId,
          userId: user.id,
        },
      },
    });

    if (existingMembership) {
      throw new ConflictException('User is already a member of this company');
    }

    const membership = await this.prisma.membership.create({
      data: {
        tenantId,
        userId: user.id,
        roleName: dto.roleName,
        customRoleId: dto.customRoleId,
        branchIds: (dto.branchIds as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        warehouseIds: (dto.warehouseIds as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: adminUserId,
        action: 'MEMBER_INVITED',
        entityType: 'Membership',
        entityId: membership.id,
        newValues: { email: user.email, role: dto.roleName },
      },
    });

    return membership;
  }

  async removeMember(tenantId: string, membershipId: string, adminUserId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { id: membershipId },
    });

    if (!membership || membership.tenantId !== tenantId) {
      throw new NotFoundException('Membership not found');
    }

    if (membership.roleName === 'TENANT_OWNER') {
      const ownerCount = await this.prisma.membership.count({
        where: { tenantId, roleName: 'TENANT_OWNER', status: 'ACTIVE' },
      });
      if (ownerCount <= 1) {
        throw new BadRequestException('Cannot remove the primary company owner');
      }
    }

    await this.prisma.membership.delete({ where: { id: membershipId } });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: adminUserId,
        action: 'MEMBER_REMOVED',
        entityType: 'Membership',
        entityId: membershipId,
      },
    });

    return { success: true };
  }

  async updateMember(tenantId: string, membershipId: string, dto: UpdateMemberDto, adminUserId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { id: membershipId },
    });

    if (!membership || membership.tenantId !== tenantId) {
      throw new NotFoundException('Membership not found');
    }

    const updated = await this.prisma.membership.update({
      where: { id: membershipId },
      data: {
        ...(dto.roleName ? { roleName: dto.roleName } : {}),
        ...(dto.customRoleId !== undefined ? { customRoleId: dto.customRoleId } : {}),
        ...(dto.status ? { status: dto.status as any } : {}),
        ...(dto.branchIds !== undefined ? { branchIds: (dto.branchIds as Prisma.InputJsonValue) ?? Prisma.JsonNull } : {}),
        ...(dto.warehouseIds !== undefined ? { warehouseIds: (dto.warehouseIds as Prisma.InputJsonValue) ?? Prisma.JsonNull } : {}),
      },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        customRole: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: adminUserId,
        action: 'MEMBER_UPDATED',
        entityType: 'Membership',
        entityId: membershipId,
        newValues: dto as any,
      },
    });

    return updated;
  }

  // --- Branches & Warehouses ---

  async listBranches(tenantId: string) {
    return this.prisma.branch.findMany({
      where: { tenantId },
      include: {
        warehouses: true,
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async createBranch(tenantId: string, dto: CreateBranchDto, adminUserId: string) {
    const currentBranches = await this.prisma.branch.count({ where: { tenantId } });
    const quotaCheck = await this.entitlementsService.checkQuotaAvailable(
      tenantId,
      'BRANCHES_LIMIT',
      currentBranches,
    );

    if (!quotaCheck.allowed) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'QUOTA_EXCEEDED',
        message: `Branch limit reached (${quotaCheck.current}/${quotaCheck.limit}). Please upgrade your plan.`,
        quotaKey: 'BRANCHES_LIMIT',
      });
    }

    const branch = await this.prisma.branch.create({
      data: {
        tenantId,
        code: dto.code,
        name: dto.name,
        nameAr: dto.nameAr,
        address: dto.address,
        phone: dto.phone,
        isDefault: dto.isDefault ?? false,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: adminUserId,
        action: 'BRANCH_CREATED',
        entityType: 'Branch',
        entityId: branch.id,
        newValues: dto as any,
      },
    });

    return branch;
  }

  async updateBranch(tenantId: string, branchId: string, dto: UpdateBranchDto, adminUserId: string) {
    const branch = await this.prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch || branch.tenantId !== tenantId) {
      throw new NotFoundException('Branch not found');
    }

    if (dto.isDefault) {
      await this.prisma.branch.updateMany({
        where: { tenantId },
        data: { isDefault: false },
      });
    }

    const updated = await this.prisma.branch.update({
      where: { id: branchId },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.nameAr ? { nameAr: dto.nameAr } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: adminUserId,
        action: 'BRANCH_UPDATED',
        entityType: 'Branch',
        entityId: branchId,
        newValues: dto as any,
      },
    });

    return updated;
  }

  async deleteBranch(tenantId: string, branchId: string, adminUserId: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      include: { warehouses: true },
    });
    if (!branch || branch.tenantId !== tenantId) {
      throw new NotFoundException('Branch not found');
    }

    if (branch.isDefault) {
      throw new BadRequestException('Cannot delete the default branch');
    }

    if (branch.warehouses && branch.warehouses.length > 0) {
      // Safe deactivate
      await this.prisma.branch.update({
        where: { id: branchId },
        data: { isActive: false },
      });
    } else {
      await this.prisma.branch.delete({ where: { id: branchId } });
    }

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: adminUserId,
        action: 'BRANCH_DELETED',
        entityType: 'Branch',
        entityId: branchId,
      },
    });

    return { success: true };
  }

  // --- Roles & Permissions ---

  async listRoles(tenantId: string) {
    return this.prisma.role.findMany({
      where: {
        OR: [{ tenantId }, { tenantId: null }],
      },
      orderBy: { name: 'asc' },
    });
  }

  async createRole(tenantId: string, dto: CreateRoleDto, adminUserId: string) {
    const isEntitled = await this.entitlementsService.isFeatureEntitled(tenantId, 'staff.custom_roles');
    if (!isEntitled) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'FEATURE_NOT_IN_PLAN',
        message: 'Custom roles feature is not available in your current plan',
        requiredFeature: 'staff.custom_roles',
      });
    }

    const role = await this.prisma.role.create({
      data: {
        tenantId,
        name: dto.name,
        nameAr: dto.nameAr,
        description: dto.description,
        permissions: dto.permissions,
        isSystem: false,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: adminUserId,
        action: 'CUSTOM_ROLE_CREATED',
        entityType: 'Role',
        entityId: role.id,
        newValues: dto as any,
      },
    });

    return role;
  }
}
