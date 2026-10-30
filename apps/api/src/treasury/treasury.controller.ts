import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { TreasuryService } from './treasury.service';
import {
  CreateAccountDto,
  CreateVoucherDto,
  VoidVoucherDto,
  TransferFundsDto,
} from './dto/treasury.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { EntitlementGuard } from '../common/guards/entitlement.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireFeature } from '../common/decorators/require-feature.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { VoucherType } from '@business-suite/shared';

@ApiTags('Treasury, Cash, Bank & Vouchers')
@Controller('treasury')
@UseGuards(JwtAuthGuard, TenantGuard, EntitlementGuard, PermissionsGuard)
@RequireFeature('finance.cashbank')
@ApiBearerAuth()
export class TreasuryController {
  constructor(private readonly treasuryService: TreasuryService) {}

  // --- Accounts ---

  @Get('accounts')
  @ApiOperation({ summary: 'List cash boxes and bank accounts with current balances' })
  listAccounts(@CurrentTenant() tenantId: string) {
    return this.treasuryService.listAccounts(tenantId);
  }

  @Get('accounts/:id')
  @ApiOperation({ summary: 'Get account details and recent transaction ledger' })
  getAccount(
    @CurrentTenant() tenantId: string,
    @Param('id') accountId: string,
  ) {
    return this.treasuryService.getAccount(tenantId, accountId);
  }

  @Post('accounts')
  @ApiOperation({ summary: 'Create new cash box or bank account' })
  @RequirePermissions('finance.cashbank.manage')
  createAccount(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateAccountDto,
  ) {
    return this.treasuryService.createAccount(tenantId, dto, userId);
  }

  // --- Transfers ---

  @Post('transfers')
  @ApiOperation({ summary: 'Transfer funds between treasury accounts or banks' })
  @RequirePermissions('finance.cashbank.manage')
  transferFunds(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: TransferFundsDto,
  ) {
    return this.treasuryService.transferFunds(tenantId, dto, userId);
  }

  // --- Vouchers ---

  @Get('vouchers')
  @ApiOperation({ summary: 'List receipt and payment vouchers' })
  @ApiQuery({ name: 'type', enum: VoucherType, required: false })
  listVouchers(
    @CurrentTenant() tenantId: string,
    @Query('type') type?: VoucherType,
  ) {
    return this.treasuryService.listVouchers(tenantId, type);
  }

  @Get('vouchers/:id')
  @ApiOperation({ summary: 'Get voucher details and multi-invoice allocations' })
  getVoucher(
    @CurrentTenant() tenantId: string,
    @Param('id') voucherId: string,
  ) {
    return this.treasuryService.getVoucher(tenantId, voucherId);
  }

  @Post('vouchers')
  @ApiOperation({ summary: 'Issue receipt or payment voucher with optional multi-invoice allocations' })
  @RequirePermissions('finance.vouchers.create')
  createVoucher(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateVoucherDto,
  ) {
    return this.treasuryService.createVoucher(tenantId, dto, userId);
  }

  @Post('vouchers/:id/void')
  @ApiOperation({ summary: 'Void / Cancel receipt or payment voucher with full balance reversal' })
  @RequirePermissions('finance.vouchers.delete')
  voidVoucher(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') voucherId: string,
    @Body() dto: VoidVoucherDto,
  ) {
    return this.treasuryService.voidVoucher(tenantId, voucherId, dto, userId);
  }
}

