import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PartiesService } from './parties.service';
import { CreatePartyDto, UpdatePartyDto, CreateContactDto } from './dto/party.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { EntitlementGuard } from '../common/guards/entitlement.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireFeature } from '../common/decorators/require-feature.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PartyType } from '@prisma/client';

@ApiTags('Parties (Customers & Suppliers)')
@Controller('parties')
@UseGuards(JwtAuthGuard, TenantGuard, EntitlementGuard, PermissionsGuard)
@RequireFeature('crm.contacts')
@ApiBearerAuth()
export class PartiesController {
  constructor(private readonly partiesService: PartiesService) {}

  @Get()
  @ApiOperation({ summary: 'List customers and suppliers with search and filters' })
  @ApiQuery({ name: 'type', enum: PartyType, required: false })
  @ApiQuery({ name: 'search', required: false })
  listParties(
    @CurrentTenant() tenantId: string,
    @Query('type') type?: PartyType,
    @Query('search') search?: string,
  ) {
    return this.partiesService.listParties(tenantId, type, search);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get party profile, recent invoices, and balance summary' })
  getParty(
    @CurrentTenant() tenantId: string,
    @Param('id') partyId: string,
  ) {
    return this.partiesService.getParty(tenantId, partyId);
  }

  @Get(':id/statement')
  @ApiOperation({ summary: 'Get derived Statement of Account with chronological running ledger' })
  @ApiQuery({ name: 'fromDate', required: false })
  @ApiQuery({ name: 'toDate', required: false })
  getStatement(
    @CurrentTenant() tenantId: string,
    @Param('id') partyId: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    return this.partiesService.getStatementOfAccount(
      tenantId,
      partyId,
      fromDate ? new Date(fromDate) : undefined,
      toDate ? new Date(toDate) : undefined,
    );
  }

  @Post()
  @ApiOperation({ summary: 'Create new customer or supplier with optional opening balance' })
  @RequirePermissions('crm.contacts.create')
  createParty(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreatePartyDto,
  ) {
    return this.partiesService.createParty(tenantId, dto, userId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update customer or supplier details' })
  updateParty(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') partyId: string,
    @Body() dto: UpdatePartyDto,
  ) {
    return this.partiesService.updateParty(tenantId, partyId, dto, userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete or archive customer or supplier safely' })
  @RequirePermissions('crm.contacts.delete')
  deleteParty(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') partyId: string,
  ) {
    return this.partiesService.deleteParty(tenantId, partyId, userId);
  }

  @Post(':id/contacts')
  @ApiOperation({ summary: 'Add contact person to customer or supplier' })
  addContact(
    @CurrentTenant() tenantId: string,
    @Param('id') partyId: string,
    @Body() dto: CreateContactDto,
  ) {
    return this.partiesService.addContact(tenantId, partyId, dto);
  }

  @Delete(':id/contacts/:contactId')
  @ApiOperation({ summary: 'Remove contact person' })
  deleteContact(
    @CurrentTenant() tenantId: string,
    @Param('id') partyId: string,
    @Param('contactId') contactId: string,
  ) {
    return this.partiesService.deleteContact(tenantId, partyId, contactId);
  }
}
