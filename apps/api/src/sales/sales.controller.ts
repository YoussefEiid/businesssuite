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
import { SalesService } from './sales.service';
import {
  CreateSalesQuotationDto,
  CreateSalesInvoiceDto,
  CreateSalesReturnDto,
} from './dto/sales.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { EntitlementGuard } from '../common/guards/entitlement.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireFeature } from '../common/decorators/require-feature.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { DocumentStatus } from '@prisma/client';

@ApiTags('Sales & Invoicing')
@Controller('sales')
@UseGuards(JwtAuthGuard, TenantGuard, EntitlementGuard, PermissionsGuard)
@RequireFeature('sales.core')
@ApiBearerAuth()
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  // --- Quotations ---

  @Get('quotations')
  @ApiOperation({ summary: 'List sales quotations' })
  @RequireFeature('sales.quotations')
  listQuotations(@CurrentTenant() tenantId: string) {
    return this.salesService.listQuotations(tenantId);
  }

  @Post('quotations')
  @ApiOperation({ summary: 'Create sales quotation' })
  @RequireFeature('sales.quotations')
  @RequirePermissions('sales.quotations.create')
  createQuotation(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateSalesQuotationDto,
  ) {
    return this.salesService.createQuotation(tenantId, dto, userId);
  }

  @Post('quotations/:id/convert')
  @ApiOperation({ summary: 'Convert quotation to draft sales invoice carrying over all items' })
  @RequireFeature('sales.quotations')
  @RequirePermissions('sales.invoices.create')
  convertQuotation(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') quotationId: string,
  ) {
    return this.salesService.convertQuotationToInvoice(tenantId, quotationId, userId);
  }

  // --- Invoices ---

  @Get('invoices')
  @ApiOperation({ summary: 'List sales invoices with status and party filter' })
  @ApiQuery({ name: 'partyId', required: false })
  @ApiQuery({ name: 'status', enum: DocumentStatus, required: false })
  @ApiQuery({ name: 'search', required: false })
  listInvoices(
    @CurrentTenant() tenantId: string,
    @Query('partyId') partyId?: string,
    @Query('status') status?: DocumentStatus,
    @Query('search') search?: string,
  ) {
    return this.salesService.listInvoices(tenantId, { partyId, status, search });
  }

  @Get('invoices/:id')
  @ApiOperation({ summary: 'Get invoice details, lines, payments, and return status' })
  getInvoice(
    @CurrentTenant() tenantId: string,
    @Param('id') invoiceId: string,
  ) {
    return this.salesService.getInvoice(tenantId, invoiceId);
  }

  @Post('invoices')
  @ApiOperation({ summary: 'Create sales invoice with line discounts and optional immediate posting' })
  @RequirePermissions('sales.invoices.create')
  createInvoice(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateSalesInvoiceDto,
  ) {
    return this.salesService.createInvoice(tenantId, dto, userId);
  }

  @Post('invoices/:id/post')
  @ApiOperation({ summary: 'Post draft sales invoice (atomic stock deduction, receivable update, COGS snapshot)' })
  @RequirePermissions('sales.invoices.post')
  postInvoice(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') invoiceId: string,
    @Body() body: { isCashSale?: boolean; treasuryAccountId?: string },
  ) {
    return this.salesService.postInvoice(
      tenantId,
      invoiceId,
      userId,
      body.isCashSale,
      body.treasuryAccountId,
    );
  }

  @Post('invoices/:id/quick-payment')
  @ApiOperation({ summary: 'Record quick partial or full invoice collection and generate receipt voucher' })
  @RequirePermissions('sales.invoices.edit')
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
    return this.salesService.quickInvoicePayment(tenantId, invoiceId, body, userId);
  }

  // --- Sales Returns ---

  @Get('returns')
  @ApiOperation({ summary: 'List all sales return documents' })
  @RequireFeature('sales.returns')
  listReturns(@CurrentTenant() tenantId: string) {
    return this.salesService.listSalesReturns(tenantId);
  }

  @Post('returns')
  @ApiOperation({ summary: 'Create sales return linked to original invoice with max quantity validation' })
  @RequireFeature('sales.returns')
  @RequirePermissions('sales.returns.create')
  createReturn(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateSalesReturnDto,
  ) {
    return this.salesService.createSalesReturn(tenantId, dto, userId);
  }
}
