import { Body, Controller, ForbiddenException, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { SubjectType, SupportTicketStatus } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequireSubject } from '../common/decorators/require-subject.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { Permission } from '../rbac/permissions';
import { StaffPermissionsService } from '../rbac/staff-permissions.service';
import { SupportService } from './support.service';
import {
  AddMessageDto,
  AssignTicketDto,
  CreateTicketDto,
  EscalateTicketDto,
  UpdateTicketStatusDto,
} from './dto/support.dto';

/**
 * Ticket read/reply endpoints are shared by both identity domains (a
 * customer sees their own ticket, staff see their branch's), so they can't
 * carry a blanket @RequirePermissions - that would reject every customer
 * request outright (AccessGuard treats a role/permission decorator as
 * staff-only). Staff-side authorization on those shared routes is therefore
 * checked explicitly in code below instead of declaratively.
 */
@UseGuards(JwtAuthGuard)
@Controller({ path: 'support/tickets', version: '1' })
export class SupportController {
  constructor(
    private readonly support: SupportService,
    private readonly staffPermissions: StaffPermissionsService,
  ) {}

  private async assertStaffCanView(user: AuthUser): Promise<void> {
    if (user.subjectType !== SubjectType.STAFF) return;
    const allowed = await this.staffPermissions.hasAll(user.id, user.role!, [Permission.SUPPORT_VIEW]);
    if (!allowed) throw new ForbiddenException('You do not have permission to view support tickets.');
  }

  private async assertStaffCanReply(user: AuthUser): Promise<void> {
    if (user.subjectType !== SubjectType.STAFF) return;
    const allowed = await this.staffPermissions.hasAll(user.id, user.role!, [Permission.SUPPORT_REPLY]);
    if (!allowed) throw new ForbiddenException('You do not have permission to reply to support tickets.');
  }

  @RequireSubject(SubjectType.CUSTOMER)
  @Post()
  create(@Body() dto: CreateTicketDto, @CurrentUser() user: AuthUser) {
    return this.support.createTicket(user.id, dto);
  }

  /** Customers see only their own tickets; staff see their branch's tickets (RequirePermissions below is applied via the service's internal role check). */
  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: SupportTicketStatus,
    @Query('assignedToMe') assignedToMe?: string,
  ) {
    await this.assertStaffCanView(user);
    if (user.subjectType === SubjectType.CUSTOMER) {
      return this.support.listForCustomer(user.id);
    }
    return this.support.listForStaff(user, { status, assignedToMe: assignedToMe === 'true' });
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.assertStaffCanView(user);
    return this.support.findById(id, user);
  }

  @Post(':id/messages')
  async addMessage(@Param('id') id: string, @Body() dto: AddMessageDto, @CurrentUser() user: AuthUser) {
    await this.assertStaffCanReply(user);
    return this.support.addMessage(id, user, dto.message);
  }

  @RequireSubject(SubjectType.STAFF)
  @RequirePermissions(Permission.SUPPORT_REPLY)
  @Post(':id/assign')
  assign(@Param('id') id: string, @Body() dto: AssignTicketDto, @CurrentUser() user: AuthUser) {
    return this.support.assign(id, dto.staffId, user);
  }

  @RequireSubject(SubjectType.STAFF)
  @RequirePermissions(Permission.SUPPORT_ESCALATE)
  @Post(':id/escalate')
  escalate(@Param('id') id: string, @Body() dto: EscalateTicketDto, @CurrentUser() user: AuthUser) {
    return this.support.escalate(id, dto.reason, user);
  }

  @RequireSubject(SubjectType.STAFF)
  @RequirePermissions(Permission.SUPPORT_REPLY)
  @Post(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateTicketStatusDto, @CurrentUser() user: AuthUser) {
    return this.support.updateStatus(id, dto.status, user);
  }
}
