import { Injectable, UnauthorizedException } from '@nestjs/common';
import { StaffRole, SubjectType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TokenService } from './token.service';
import { DeviceInfoDto } from './dto/device-info.dto';

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface SubjectContext {
  subjectType: SubjectType;
  customerId?: string;
  staffUserId?: string;
  role?: StaffRole;
  branchId?: string | null;
  isGlobal?: boolean;
}

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  async upsertDevice(
    subject: SubjectContext,
    device: DeviceInfoDto,
    markTrusted = false,
  ): Promise<{ id: string; isTrusted: boolean }> {
    const existing = await this.prisma.device.findFirst({
      where: {
        subjectType: subject.subjectType,
        customerId: subject.customerId ?? null,
        staffUserId: subject.staffUserId ?? null,
        deviceIdentifier: device.deviceIdentifier,
      },
    });

    if (existing) {
      return this.prisma.device.update({
        where: { id: existing.id },
        data: {
          platform: device.platform,
          appVersion: device.appVersion,
          pushToken: device.pushToken,
          lastSeenAt: new Date(),
          isTrusted: existing.isTrusted || markTrusted,
        },
      });
    }

    return this.prisma.device.create({
      data: {
        subjectType: subject.subjectType,
        customerId: subject.customerId,
        staffUserId: subject.staffUserId,
        deviceIdentifier: device.deviceIdentifier,
        platform: device.platform,
        appVersion: device.appVersion,
        pushToken: device.pushToken,
        isTrusted: markTrusted,
      },
    });
  }

  async issueSession(
    subject: SubjectContext,
    deviceId: string | undefined,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<IssuedTokens> {
    const refresh = this.tokens.generateRefreshToken();

    const session = await this.prisma.session.create({
      data: {
        subjectType: subject.subjectType,
        customerId: subject.customerId,
        staffUserId: subject.staffUserId,
        deviceId,
        refreshTokenHash: refresh.hash,
        expiresAt: refresh.expiresAt,
        ipAddress,
        userAgent,
      },
    });

    const accessToken = this.tokens.signAccessToken({
      sub: subject.customerId ?? subject.staffUserId!,
      subjectType: subject.subjectType,
      sessionId: session.id,
      deviceId,
      role: subject.role,
      branchId: subject.branchId,
      isGlobal: subject.isGlobal,
    });

    return { accessToken, refreshToken: refresh.token, expiresAt: refresh.expiresAt };
  }

  /** Rotates the refresh token on use (prevents replay of a stolen old token). */
  async refresh(refreshToken: string): Promise<IssuedTokens> {
    const hash = this.tokens.hashRefreshToken(refreshToken);
    const session = await this.prisma.session.findFirst({ where: { refreshTokenHash: hash } });
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expired. Please log in again.');
    }

    let role: StaffRole | undefined;
    let branchId: string | null | undefined;
    let isGlobal = false;
    if (session.subjectType === SubjectType.STAFF && session.staffUserId) {
      const staff = await this.prisma.staffUser.findUnique({ where: { id: session.staffUserId } });
      if (!staff || !staff.isActive) throw new UnauthorizedException('Account is not active.');
      role = staff.role;
      branchId = staff.branchId;
      isGlobal = staff.isGlobal;
    }

    const newRefresh = this.tokens.generateRefreshToken();
    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: newRefresh.hash,
        expiresAt: newRefresh.expiresAt,
        lastUsedAt: new Date(),
      },
    });

    const accessToken = this.tokens.signAccessToken({
      sub: session.customerId ?? session.staffUserId!,
      subjectType: session.subjectType,
      sessionId: session.id,
      deviceId: session.deviceId ?? undefined,
      role,
      branchId,
      isGlobal,
    });

    return { accessToken, refreshToken: newRefresh.token, expiresAt: newRefresh.expiresAt };
  }

  async revokeSession(sessionId: string, reason = 'LOGOUT'): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }

  async revokeAllOtherSessions(
    subjectType: SubjectType,
    subjectId: string,
    keepSessionId: string,
  ): Promise<number> {
    const where =
      subjectType === SubjectType.CUSTOMER
        ? { customerId: subjectId, subjectType }
        : { staffUserId: subjectId, subjectType };

    const result = await this.prisma.session.updateMany({
      where: { ...where, id: { not: keepSessionId }, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: 'LOGOUT_OTHER_DEVICES' },
    });
    return result.count;
  }

  async listActiveSessions(subjectType: SubjectType, subjectId: string) {
    const where =
      subjectType === SubjectType.CUSTOMER
        ? { customerId: subjectId, subjectType }
        : { staffUserId: subjectId, subjectType };

    return this.prisma.session.findMany({
      where: { ...where, revokedAt: null, expiresAt: { gt: new Date() } },
      include: { device: true },
      orderBy: { lastUsedAt: 'desc' },
    });
  }
}
