import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateLeadDto,
  UpdateLeadDto,
  CreateOpportunityDto,
  CreateActivityDto,
} from './dto/crm.dto';
import { Prisma, LeadStatus, PartyType } from '@prisma/client';

@Injectable()
export class CRMService {
  private readonly logger = new Logger(CRMService.name);

  constructor(private prisma: PrismaService) {}

  // --- Leads ---

  async listLeads(tenantId: string, status?: LeadStatus, search?: string) {
    const where: Prisma.CRMLeadWhereInput = { tenantId };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search.trim(), mode: 'insensitive' } },
        { companyName: { contains: search.trim(), mode: 'insensitive' } },
        { phone: { contains: search.trim(), mode: 'insensitive' } },
        { email: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    return this.prisma.cRMLead.findMany({
      where,
      include: {
        assignedUser: { select: { id: true, name: true, email: true } },
        activities: { take: 5, orderBy: { createdAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getLead(tenantId: string, leadId: string) {
    const lead = await this.prisma.cRMLead.findUnique({
      where: { id: leadId },
      include: {
        assignedUser: true,
        opportunities: { include: { stage: true } },
        activities: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!lead || lead.tenantId !== tenantId) {
      throw new NotFoundException('Lead not found');
    }

    return lead;
  }

  async createLead(tenantId: string, dto: CreateLeadDto) {
    return this.prisma.cRMLead.create({
      data: {
        tenantId,
        name: dto.name,
        companyName: dto.companyName,
        phone: dto.phone,
        email: dto.email,
        status: dto.status || LeadStatus.NEW,
        source: dto.source,
        assignedToUserId: dto.assignedToUserId,
        notes: dto.notes,
      },
    });
  }

  async updateLead(tenantId: string, leadId: string, dto: UpdateLeadDto) {
    const lead = await this.prisma.cRMLead.findUnique({ where: { id: leadId } });
    if (!lead || lead.tenantId !== tenantId) throw new NotFoundException('Lead not found');

    return this.prisma.cRMLead.update({
      where: { id: leadId },
      data: {
        name: dto.name ?? lead.name,
        companyName: dto.companyName ?? lead.companyName,
        phone: dto.phone ?? lead.phone,
        email: dto.email ?? lead.email,
        status: dto.status ?? lead.status,
        source: dto.source ?? lead.source,
        assignedToUserId: dto.assignedToUserId ?? lead.assignedToUserId,
        notes: dto.notes ?? lead.notes,
      },
    });
  }

  async convertLeadToCustomer(tenantId: string, leadId: string, userId: string) {
    const lead = await this.prisma.cRMLead.findUnique({ where: { id: leadId } });
    if (!lead || lead.tenantId !== tenantId) throw new NotFoundException('Lead not found');

    if (lead.convertedPartyId) {
      throw new BadRequestException('Lead has already been converted to customer');
    }

    return this.prisma.$transaction(async (tx) => {
      // Generate customer code
      const partyCode = `CUST-${Math.floor(1000 + Math.random() * 9000)}`;

      const party = await tx.party.create({
        data: {
          tenantId,
          type: PartyType.CUSTOMER,
          code: partyCode,
          name: lead.companyName || lead.name,
          nameAr: lead.companyName || lead.name,
          phone: lead.phone,
          email: lead.email,
          notes: `Converted from lead: ${lead.name}. ${lead.notes || ''}`,
          contacts: {
            create: {
              tenantId,
              name: lead.name,
              phone: lead.phone,
              email: lead.email,
              isPrimary: true,
            },
          },
        },
      });

      const updatedLead = await tx.cRMLead.update({
        where: { id: leadId },
        data: {
          status: LeadStatus.WON,
          convertedPartyId: party.id,
          convertedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'LEAD_CONVERTED_TO_CUSTOMER',
          entityType: 'CRMLead',
          entityId: leadId,
          newValues: { partyId: party.id, partyCode: party.code },
        },
      });

      return {
        lead: updatedLead,
        party,
      };
    });
  }

  // --- Pipelines & Opportunities ---

  async listPipelines(tenantId: string) {
    let pipelines = await this.prisma.cRMPipeline.findMany({
      where: { tenantId },
      include: {
        stages: {
          orderBy: { sortOrder: 'asc' },
          include: {
            opportunities: {
              include: { lead: true },
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
    });

    if (pipelines.length === 0) {
      // Auto-seed default sales pipeline for tenant
      const defaultPipeline = await this.prisma.cRMPipeline.create({
        data: {
          tenantId,
          name: 'Main Sales Pipeline',
          nameAr: 'مسار المبيعات الرئيسي',
          isDefault: true,
          stages: {
            create: [
              { tenantId, name: 'Lead / Discovery', nameAr: 'عميل محتمل / استكشاف', probability: 20, sortOrder: 1 },
              { tenantId, name: 'Qualified', nameAr: 'تم التواصل والتأهيل', probability: 40, sortOrder: 2 },
              { tenantId, name: 'Proposal Sent', nameAr: 'تم تقديم عرض الأسعار', probability: 70, sortOrder: 3 },
              { tenantId, name: 'Negotiation', nameAr: 'مفاوضات ختامية', probability: 90, sortOrder: 4 },
              { tenantId, name: 'Won Deal', nameAr: 'صفقة رابحة', probability: 100, sortOrder: 5 },
              { tenantId, name: 'Lost Deal', nameAr: 'صفقة خاسرة', probability: 0, sortOrder: 6 },
            ],
          },
        },
        include: {
          stages: {
            orderBy: { sortOrder: 'asc' },
            include: {
              opportunities: {
                include: { lead: true },
              },
            },
          },
        },
      });
      pipelines = [defaultPipeline];
    }

    return pipelines;
  }

  async createOpportunity(tenantId: string, dto: CreateOpportunityDto) {
    return this.prisma.cRMOpportunity.create({
      data: {
        tenantId,
        pipelineId: dto.pipelineId,
        stageId: dto.stageId,
        leadId: dto.leadId,
        partyId: dto.partyId,
        title: dto.title,
        expectedValue: new Prisma.Decimal(dto.expectedValue),
        closeDate: dto.closeDate ? new Date(dto.closeDate) : null,
        notes: dto.notes,
      },
      include: {
        lead: true,
        stage: true,
      },
    });
  }

  async updateOpportunityStage(
    tenantId: string,
    opportunityId: string,
    stageId: string,
    status?: string,
  ) {
    const opp = await this.prisma.cRMOpportunity.findUnique({
      where: { id: opportunityId },
      include: { stage: true },
    });
    if (!opp || opp.tenantId !== tenantId) throw new NotFoundException('Opportunity not found');

    const targetStage = await this.prisma.cRMStage.findUnique({ where: { id: stageId } });

    let finalStatus = status || opp.status;
    if (targetStage) {
      if (targetStage.probability === 100) finalStatus = 'WON';
      else if (targetStage.probability === 0) finalStatus = 'LOST';
      else if (opp.status === 'WON' || opp.status === 'LOST') finalStatus = 'OPEN';
    }

    return this.prisma.cRMOpportunity.update({
      where: { id: opportunityId },
      data: {
        stageId,
        status: finalStatus,
      },
      include: {
        stage: true,
        lead: true,
      },
    });
  }

  async deleteOpportunity(tenantId: string, opportunityId: string) {
    const opp = await this.prisma.cRMOpportunity.findUnique({ where: { id: opportunityId } });
    if (!opp || opp.tenantId !== tenantId) throw new NotFoundException('Opportunity not found');

    await this.prisma.cRMOpportunity.delete({ where: { id: opportunityId } });
    return { success: true, deleted: true };
  }

  // --- Activities & Tasks ---

  async listActivities(tenantId: string, isCompleted?: boolean) {
    const where: Prisma.CRMActivityWhereInput = { tenantId };
    if (isCompleted !== undefined) where.isCompleted = isCompleted;

    return this.prisma.cRMActivity.findMany({
      where,
      include: {
        lead: { select: { id: true, name: true, phone: true } },
        opportunity: { select: { id: true, title: true } },
        assignedUser: { select: { id: true, name: true } },
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  async createActivity(tenantId: string, dto: CreateActivityDto) {
    return this.prisma.cRMActivity.create({
      data: {
        tenantId,
        leadId: dto.leadId || undefined,
        opportunityId: dto.opportunityId || undefined,
        assignedToUserId: dto.assignedToUserId || undefined,
        type: dto.type,
        subject: dto.subject,
        description: dto.description,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      },
      include: {
        lead: true,
        opportunity: true,
      },
    });
  }

  async toggleActivityCompleted(tenantId: string, activityId: string, isCompleted: boolean) {
    const activity = await this.prisma.cRMActivity.findUnique({ where: { id: activityId } });
    if (!activity || activity.tenantId !== tenantId) throw new NotFoundException('Activity not found');

    return this.prisma.cRMActivity.update({
      where: { id: activityId },
      data: {
        isCompleted,
        completedAt: isCompleted ? new Date() : null,
      },
    });
  }

  async deleteActivity(tenantId: string, activityId: string) {
    const activity = await this.prisma.cRMActivity.findUnique({ where: { id: activityId } });
    if (!activity || activity.tenantId !== tenantId) throw new NotFoundException('Activity not found');

    await this.prisma.cRMActivity.delete({ where: { id: activityId } });
    return { success: true, deleted: true };
  }

  async deleteLead(tenantId: string, leadId: string) {
    const lead = await this.prisma.cRMLead.findUnique({ where: { id: leadId } });
    if (!lead || lead.tenantId !== tenantId) throw new NotFoundException('Lead not found');

    await this.prisma.cRMLead.delete({ where: { id: leadId } });
    return { success: true, deleted: true };
  }
}
