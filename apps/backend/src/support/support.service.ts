import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditActorType, SubjectType, SupportSenderType, SupportTicketStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationEvent } from '../notifications/notification-events';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { assertBranchAccess, branchWhereClause } from '../rbac/branch-scope.util';
import { generateTicketNumber, retryOnConflict } from '../common/id-generators';
import { CreateTicketDto } from './dto/support.dto';

@Injectable()
export class SupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async createTicket(customerId: string, dto: CreateTicketDto) {
    const ticket = await retryOnConflict(() =>
      this.prisma.supportTicket.create({
        data: {
          ticketNumber: generateTicketNumber(),
          customerId,
          category: dto.category,
          status: SupportTicketStatus.OPEN,
          messages: {
            create: { senderType: SupportSenderType.CUSTOMER, senderId: customerId, message: dto.message },
          },
        },
        include: { messages: true },
      }),
    );

    await this.audit.record({
      actorType: AuditActorType.CUSTOMER,
      actorId: customerId,
      action: 'SUPPORT_TICKET_CREATED',
      entityType: 'SupportTicket',
      entityId: ticket.id,
    });

    return ticket;
  }

  async listForCustomer(customerId: string) {
    return this.prisma.supportTicket.findMany({
      where: { customerId },
      orderBy: { updatedAt: 'desc' },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
  }

  async listForStaff(user: AuthUser, filters: { status?: SupportTicketStatus; assignedToMe?: boolean }) {
    return this.prisma.supportTicket.findMany({
      where: {
        status: filters.status,
        assignedStaffId: filters.assignedToMe ? user.id : undefined,
        customer: branchWhereClause(user),
      },
      orderBy: { updatedAt: 'desc' },
      include: { customer: true },
    });
  }

  async findById(ticketId: string, user: AuthUser) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: { messages: { orderBy: { createdAt: 'asc' } }, customer: true },
    });
    if (!ticket) throw new NotFoundException('Support ticket not found.');

    if (user.subjectType === SubjectType.CUSTOMER) {
      if (ticket.customerId !== user.id) throw new ForbiddenException('You do not have access to this ticket.');
    } else {
      assertBranchAccess(user, ticket.customer.branchId);
    }
    return ticket;
  }

  async addMessage(ticketId: string, user: AuthUser, message: string) {
    const ticket = await this.findById(ticketId, user);
    const senderType = user.subjectType === SubjectType.CUSTOMER ? SupportSenderType.CUSTOMER : SupportSenderType.STAFF;

    const created = await this.prisma.supportMessage.create({
      data: { ticketId, senderType, senderId: user.id, message },
    });

    const newStatus =
      senderType === SupportSenderType.STAFF && ticket.status === SupportTicketStatus.OPEN
        ? SupportTicketStatus.IN_PROGRESS
        : ticket.status;
    await this.prisma.supportTicket.update({ where: { id: ticketId }, data: { status: newStatus } });

    if (senderType === SupportSenderType.CUSTOMER && ticket.assignedStaffId) {
      const ids = await this.notifications.enqueue(this.prisma, {
        event: NotificationEvent.SUPPORT_MESSAGE_RECEIVED,
        staffUserId: ticket.assignedStaffId,
        payload: { ticketNumber: ticket.ticketNumber },
      });
      await this.notifications.dispatchAll(ids);
    } else if (senderType === SupportSenderType.STAFF) {
      const ids = await this.notifications.enqueue(this.prisma, {
        event: NotificationEvent.SUPPORT_REPLY,
        customerId: ticket.customerId,
        payload: { ticketNumber: ticket.ticketNumber },
      });
      await this.notifications.dispatchAll(ids);
    }

    return created;
  }

  async assign(ticketId: string, staffId: string, actor: AuthUser) {
    const ticket = await this.findById(ticketId, actor);
    const updated = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        assignedStaffId: staffId,
        status: ticket.status === SupportTicketStatus.OPEN ? SupportTicketStatus.IN_PROGRESS : ticket.status,
      },
    });
    await this.audit.record({
      actorType: AuditActorType.STAFF,
      actorId: actor.id,
      role: actor.role,
      action: 'SUPPORT_TICKET_ASSIGNED',
      entityType: 'SupportTicket',
      entityId: ticketId,
      afterState: { assignedStaffId: staffId },
    });
    return updated;
  }

  async escalate(ticketId: string, reason: string, actor: AuthUser) {
    await this.findById(ticketId, actor);
    const updated = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status: SupportTicketStatus.ESCALATED },
    });
    await this.audit.record({
      actorType: AuditActorType.STAFF,
      actorId: actor.id,
      role: actor.role,
      action: 'SUPPORT_TICKET_ESCALATED',
      entityType: 'SupportTicket',
      entityId: ticketId,
      reason,
    });
    return updated;
  }

  async updateStatus(ticketId: string, status: SupportTicketStatus, actor: AuthUser) {
    await this.findById(ticketId, actor);
    const updated = await this.prisma.supportTicket.update({ where: { id: ticketId }, data: { status } });
    await this.audit.record({
      actorType: AuditActorType.STAFF,
      actorId: actor.id,
      role: actor.role,
      action: 'SUPPORT_TICKET_STATUS_CHANGED',
      entityType: 'SupportTicket',
      entityId: ticketId,
      afterState: { status },
    });
    return updated;
  }
}
