import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuditActorType, StaffRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { CreateStaffDto } from './dto/staff.dto';

const STAFF_LIST_SELECT = {
  id: true,
  name: true,
  mobile: true,
  email: true,
  role: true,
  isActive: true,
  isApproved: true,
  isGlobal: true,
  branchId: true,
  approvedByStaffId: true,
  approvedAt: true,
  createdAt: true,
  lastLoginAt: true,
} as const;

/**
 * Staff account creation/approval. Only reachable with Permission.STAFF_MANAGE
 * (SUPER_ADMIN by default - see DEFAULT_ROLE_PERMISSIONS). A newly created
 * account always starts isApproved:false and cannot log in (see
 * StaffAuthService.login) until explicitly approved here, regardless of role.
 */
@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list() {
    return this.prisma.staffUser.findMany({ select: STAFF_LIST_SELECT, orderBy: { createdAt: 'desc' } });
  }

  async create(dto: CreateStaffDto, actor: AuthUser) {
    const existing = await this.prisma.staffUser.findUnique({ where: { mobile: dto.mobile } });
    if (existing) throw new ConflictException('A staff account with this mobile number already exists.');

    const created = await this.prisma.staffUser.create({
      data: {
        name: dto.name,
        mobile: dto.mobile,
        email: dto.email,
        passwordHash: await argon2.hash(dto.password),
        role: dto.role,
        branchId: dto.branchId,
        isGlobal: dto.role === StaffRole.SUPER_ADMIN || dto.role === StaffRole.ADMIN || dto.role === StaffRole.OWNER,
        isApproved: false,
      },
      select: STAFF_LIST_SELECT,
    });

    await this.audit.record({
      actorType: AuditActorType.STAFF,
      actorId: actor.id,
      role: actor.role,
      action: 'STAFF_ACCOUNT_CREATED',
      entityType: 'StaffUser',
      entityId: created.id,
      afterState: { name: dto.name, mobile: dto.mobile, role: dto.role },
    });

    return created;
  }

  async approve(staffId: string, actor: AuthUser) {
    const staff = await this.prisma.staffUser.findUnique({ where: { id: staffId } });
    if (!staff) throw new NotFoundException('Staff account not found.');

    const updated = await this.prisma.staffUser.update({
      where: { id: staffId },
      data: { isApproved: true, isActive: true, approvedByStaffId: actor.id, approvedAt: new Date() },
      select: STAFF_LIST_SELECT,
    });

    await this.audit.record({
      actorType: AuditActorType.STAFF,
      actorId: actor.id,
      role: actor.role,
      action: 'STAFF_ACCOUNT_APPROVED',
      entityType: 'StaffUser',
      entityId: staffId,
    });

    return updated;
  }

  async reject(staffId: string, reason: string | undefined, actor: AuthUser) {
    const staff = await this.prisma.staffUser.findUnique({ where: { id: staffId } });
    if (!staff) throw new NotFoundException('Staff account not found.');

    const updated = await this.prisma.staffUser.update({
      where: { id: staffId },
      data: { isApproved: false, isActive: false },
      select: STAFF_LIST_SELECT,
    });

    await this.audit.record({
      actorType: AuditActorType.STAFF,
      actorId: actor.id,
      role: actor.role,
      action: 'STAFF_ACCOUNT_REJECTED',
      entityType: 'StaffUser',
      entityId: staffId,
      reason,
    });

    return updated;
  }
}
