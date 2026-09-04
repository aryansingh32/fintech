import { Injectable } from '@nestjs/common';
import { AuditActorType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEventInput {
  actorType: AuditActorType;
  actorId?: string;
  role?: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeState?: unknown;
  afterState?: unknown;
  reason?: string;
  ipAddress?: string;
  deviceId?: string;
  sessionId?: string;
}

/**
 * Every sensitive operation (loan approval/decline, payment posting/reversal,
 * permission changes, KYC changes, ...) must call this. Rows are append-only:
 * no service in this codebase is permitted to UPDATE or DELETE an AuditEvent.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(event: AuditEventInput): Promise<void> {
    await this.prisma.auditEvent.create({
      data: {
        actorType: event.actorType,
        actorId: event.actorId,
        role: event.role,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId,
        beforeState: event.beforeState as never,
        afterState: event.afterState as never,
        reason: event.reason,
        ipAddress: event.ipAddress,
        deviceId: event.deviceId,
        sessionId: event.sessionId,
      },
    });
  }
}
