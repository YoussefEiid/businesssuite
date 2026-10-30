import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import {
  UpdateCompanyProfileDto,
  InviteMemberDto,
  UpdateMemberDto,
  CreateBranchDto,
  UpdateBranchDto,
  CreateRoleDto,
} from './dto/tenant.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';

@ApiTags('Company Management & Settings')
@Controller('tenant')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@ApiBearerAuth()
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get current company profile, settings, and subscription entitlements' })
  getProfile(@CurrentTenant() tenantId: string) {
    return this.tenantsService.getCompanyProfile(tenantId);
  }

  @Put('profile')
  @ApiOperation({ summary: 'Update company profile, tax number, address, and branding' })
  updateProfile(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateCompanyProfileDto,
  ) {
    return this.tenantsService.updateCompanyProfile(tenantId, dto, userId);
  }

  // --- Staff ---

  @Get('members')
  @ApiOperation({ summary: 'List all company team members and assigned roles' })
  listMembers(@CurrentTenant() tenantId: string) {
    return this.tenantsService.listMembers(tenantId);
  }

  @Post('members')
  @ApiOperation({ summary: 'Invite or add a new team member within plan user limits' })
  inviteMember(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') adminUserId: string,
    @Body() dto: InviteMemberDto,
  ) {
    return this.tenantsService.inviteMember(tenantId, dto, adminUserId);
  }

  @Put('members/:id')
  @ApiOperation({ summary: 'Update staff member role, branch assignments, or status' })
  updateMember(
    @CurrentTenant() tenantId: string,
    @Param('id') membershipId: string,
    @CurrentUser('id') adminUserId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.tenantsService.updateMember(tenantId, membershipId, dto, adminUserId);
  }

  @Delete('members/:id')
  @ApiOperation({ summary: 'Remove a team member from company' })
  removeMember(
    @CurrentTenant() tenantId: string,
    @Param('id') membershipId: string,
    @CurrentUser('id') adminUserId: string,
  ) {
    return this.tenantsService.removeMember(tenantId, membershipId, adminUserId);
  }

  // --- Branches ---

  @Get('branches')
  @ApiOperation({ summary: 'List all company branches' })
  listBranches(@CurrentTenant() tenantId: string) {
    return this.tenantsService.listBranches(tenantId);
  }

  @Post('branches')
  @ApiOperation({ summary: 'Create new company branch within plan branch limits' })
  createBranch(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') adminUserId: string,
    @Body() dto: CreateBranchDto,
  ) {
    return this.tenantsService.createBranch(tenantId, dto, adminUserId);
  }

  @Put('branches/:id')
  @ApiOperation({ summary: 'Update branch information or set as default branch' })
  updateBranch(
    @CurrentTenant() tenantId: string,
    @Param('id') branchId: string,
    @CurrentUser('id') adminUserId: string,
    @Body() dto: UpdateBranchDto,
  ) {
    return this.tenantsService.updateBranch(tenantId, branchId, dto, adminUserId);
  }

  @Delete('branches/:id')
  @ApiOperation({ summary: 'Delete or deactivate company branch' })
  deleteBranch(
    @CurrentTenant() tenantId: string,
    @Param('id') branchId: string,
    @CurrentUser('id') adminUserId: string,
  ) {
    return this.tenantsService.deleteBranch(tenantId, branchId, adminUserId);
  }

  // --- Custom Roles ---

  @Get('roles')
  @ApiOperation({ summary: 'List built-in and custom roles' })
  listRoles(@CurrentTenant() tenantId: string) {
    return this.tenantsService.listRoles(tenantId);
  }

  @Post('roles')
  @ApiOperation({ summary: 'Create custom staff role with granular permission matrix' })
  createRole(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') adminUserId: string,
    @Body() dto: CreateRoleDto,
  ) {
    return this.tenantsService.createRole(tenantId, dto, adminUserId);
  }
}
