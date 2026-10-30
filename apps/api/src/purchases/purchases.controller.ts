import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PurchasesService } from './purchases.service';
import {
  CreatePurchaseOrderDto,
  CreatePurchaseInvoiceDto,
  UpdatePurchaseInvoiceDto,
  CreatePurchaseReturnDto,
} from './dto/purchases.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { EntitlementGuard } from '../common/guards/entitlement.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireFeature } from '../common/decorators/require-feature.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { DocumentStatus } from '@prisma/client';

@ApiTags('Purchases & Vendor Bills')
@Controller('purchases')
@UseGuards(JwtAuthGuard, TenantGuard, EntitlementGuard, PermissionsGuard)
@RequireFeature('purchases.core')
@ApiBearerAuth()
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  // --- Purchase Orders ---

  @Get('orders')
  @ApiOperation({ summary: 'List purchase orders' })
  @RequireFeature('purchases.orders')
  listOrders(@CurrentTenant() tenantId: string) {
    return this.purchasesService.listOrders(tenantId);
  }

  @Post('orders')
  @ApiOperation({ summary: 'Create purchase order' })
  @RequireFeature('purchases.orders')
  @RequirePermissions('purchases.orders.create')
  createOrder(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreatePurchaseOrderDto,
  ) {
    return this.purchasesService.createOrder(tenantId, dto, userId);
  }

  @Post('orders/:id/convert')
  @ApiOperation({ summary: 'Convert purchase order to draft purchase invoice carrying over all items' })
  @RequireFeature('purchases.orders')
  @RequirePermissions('purchases.invoices.create')
  convertOrder(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') orderId: string,
  ) {
    return this.purchasesService.convertOrderToInvoice(tenantId, orderId, userId);
  }

  // --- Purchase Invoices ---

  @Get('invoices')
  @ApiOperation({ summary: 'List purchase invoices with party and status filter' })
  @ApiQuery({ name: 'partyId', required: false })
  @ApiQuery({ name: 'status', enum: DocumentStatus, required: false })
  @ApiQuery({ name: 'search', required: false })
  listInvoices(
    @CurrentTenant() tenantId: string,
    @Query('partyId') partyId?: string,
    @Query('status') status?: DocumentStatus,
    @Query('search') search?: string,
  ) {
    return this.purchasesService.listInvoices(tenantId, { partyId, status, search });
  }

  @Get('invoices/:id')
  @ApiOperation({ summary: 'Get purchase invoice details, lines, and allocations' })
  getInvoice(
    @CurrentTenant() tenantId: string,
    @Param('id') invoiceId: string,
  ) {
    return this.purchasesService.getInvoice(tenantId, invoiceId);
  }

  @Post('invoices')
  @ApiOperation({ summary: 'Create purchase bill' })
  @RequirePermissions('purchases.invoices.create')
  createInvoice(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreatePurchaseInvoiceDto,
  ) {
    return this.purchasesService.createInvoice(tenantId, dto, userId);
  }

  @Put('invoices/:id')
  @ApiOperation({ summary: 'Update purchase bill details, items, notes or attachments' })
  @RequirePermissions('purchases.invoices.edit')
  updateInvoice(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') invoiceId: string,
    @Body() dto: UpdatePurchaseInvoiceDto,
  ) {
    return this.purchasesService.updateInvoice(tenantId, invoiceId, dto, userId);
  }

  @Post('invoices/:id/post')
  @ApiOperation({ summary: 'Post draft bill (atomic stock addition, WAC calculation, payable increment)' })
  @RequirePermissions('purchases.invoices.post')
  postInvoice(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') invoiceId: string,
  ) {
    return this.purchasesService.postInvoice(tenantId, invoiceId, userId);
  }

  @Post('invoices/:id/quick-payment')
  @ApiOperation({ summary: 'Record quick partial or full bill payment and generate payment voucher' })
  @RequirePermissions('purchases.invoices.edit')
  quickPayment(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') invoiceId: string,
    @Body()
    body: {
      amount: number;
      accountId: string;
      paymentMethod?: string;
      referenceNumber?: string;
      notes?: string;
    },
  ) {
    return this.purchasesService.quickBillPayment(tenantId, invoiceId, body, userId);
  }

  // --- Purchase Returns ---

  @Get('returns')
  @ApiOperation({ summary: 'List all purchase return documents' })
  @RequireFeature('purchases.returns')
  listReturns(@CurrentTenant() tenantId: string) {
    return this.purchasesService.listPurchaseReturns(tenantId);
  }

  @Post('returns')
  @ApiOperation({ summary: 'Create purchase return linked to original bill with stock reversal' })
  @RequireFeature('purchases.returns')
  @RequirePermissions('purchases.returns.create')
  createReturn(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreatePurchaseReturnDto,
  ) {
    return this.purchasesService.createPurchaseReturn(tenantId, dto, userId);
  }
}
