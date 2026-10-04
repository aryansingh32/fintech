import { ForbiddenException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuditActorType, SubjectType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SessionService, IssuedTokens } from './session.service';
import { DeviceInfoDto } from './dto/device-info.dto';
import { GoogleTokenService } from './google-token.service';

export type StaffLoginResult = IssuedTokens & { status: 'SUCCESS'; staffUserId: string };

@Injectable()
export class StaffAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
    private readonly googleTokens: GoogleTokenService,
  ) {}

  /** Google Sign-In for an existing staff account matched by verified email - never a self-signup path (staff accounts are provisioned by an Owner). */
  async googleLogin(idToken: string, device: DeviceInfoDto, ipAddress?: string): Promise<StaffLoginResult> {
    if (!this.googleTokens.isConfigured()) {
      throw new ServiceUnavailableException('Google Sign-In is not configured.');
    }

    const result = await this.googleTokens.verify(idToken);
    if (!result.ok) {
      throw new UnauthorizedException(
        result.reason === 'email_not_verified'
          ? 'Your Google account has no verified email.'
          : 'Invalid or expired Google sign-in token.',
      );
    }
    const { email } = result;

    const staff = await this.prisma.staffUser.findFirst({ where: { email, isActive: true } });
    if (!staff) {
      throw new UnauthorizedException('No staff account is linked to this Google email yet.');
    }
    if (!staff.isApproved) {
      throw new ForbiddenException('Your account is pending approval by the super admin.');
    }

    return this.completeLogin(staff.id, device, ipAddress);
  }

  /** Password login - a valid mobile + password issues a session directly, same as Google Sign-In. */
  async login(mobile: string, password: string, device: DeviceInfoDto, ipAddress?: string): Promise<StaffLoginResult> {
    const staff = await this.prisma.staffUser.findUnique({ where: { mobile } });
    if (!staff || !staff.isActive) throw new UnauthorizedException('Invalid credentials.');

    const passwordValid = await argon2.verify(staff.passwordHash, password);
    if (!passwordValid) throw new UnauthorizedException('Invalid credentials.');

    if (!staff.isApproved) {
      throw new ForbiddenException('Your account is pending approval by the super admin.');
    }

    return this.completeLogin(staff.id, device, ipAddress);
  }

  private async completeLogin(
    staffUserId: string,
    device: DeviceInfoDto,
    ipAddress?: string,
  ): Promise<StaffLoginResult> {
    const staff = await this.prisma.staffUser.findUniqueOrThrow({ where: { id: staffUserId } });
    if (!staff.isApproved) {
      throw new ForbiddenException('Your account is pending approval by the super admin.');
    }

    const deviceRow = await this.sessions.upsertDevice(
      { subjectType: SubjectType.STAFF, staffUserId: staff.id },
      device,
      true,
    );

    const tokens = await this.sessions.issueSession(
      {
        subjectType: SubjectType.STAFF,
        staffUserId: staff.id,
        role: staff.role,
        branchId: staff.branchId,
        isGlobal: staff.isGlobal,
      },
      deviceRow.id,
      ipAddress,
    );

    await this.prisma.staffUser.update({ where: { id: staff.id }, data: { lastLoginAt: new Date() } });

    await this.audit.record({
      actorType: AuditActorType.STAFF,
      actorId: staff.id,
      role: staff.role,
      action: 'STAFF_LOGIN',
      entityType: 'StaffUser',
      entityId: staff.id,
      ipAddress,
      deviceId: deviceRow.id,
    });

    return { status: 'SUCCESS', staffUserId: staff.id, ...tokens };
  }
}
