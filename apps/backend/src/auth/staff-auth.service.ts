import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuditActorType, OtpPurpose, SubjectType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { OtpService } from './otp.service';
import { SessionService, IssuedTokens } from './session.service';
import { DeviceInfoDto } from './dto/device-info.dto';
import { FirebaseAdminService } from '../firebase/firebase-admin.service';

export type StaffLoginResult =
  | { status: 'DEVICE_VERIFICATION_REQUIRED'; requestId: string; devOtp?: string }
  | (IssuedTokens & { status: 'SUCCESS'; staffUserId: string });

@Injectable()
export class StaffAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
    private readonly firebase: FirebaseAdminService,
  ) {}

  /** Google Sign-In for an existing staff account matched by verified email - never a self-signup path (staff accounts are provisioned by an Owner). */
  async googleLogin(idToken: string, device: DeviceInfoDto, ipAddress?: string): Promise<StaffLoginResult> {
    const auth = this.firebase.getAuth();
    if (!auth) throw new ServiceUnavailableException('Google Sign-In is not configured.');

    let email: string | undefined;
    try {
      const decoded = await auth.verifyIdToken(idToken);
      email = decoded.email_verified ? decoded.email : undefined;
    } catch {
      throw new UnauthorizedException('Invalid or expired Google sign-in token.');
    }
    if (!email) throw new UnauthorizedException('Your Google account has no verified email.');

    const staff = await this.prisma.staffUser.findFirst({ where: { email, isActive: true } });
    if (!staff) {
      throw new UnauthorizedException('No staff account is linked to this Google email yet.');
    }

    return this.completeLogin(staff.id, device, ipAddress);
  }

  /**
   * Password login. A staff member on a device that has never verified with
   * OTP is asked to step up before a session is issued (protects against a
   * leaked password alone being sufficient on an unknown device).
   */
  async login(mobile: string, password: string, device: DeviceInfoDto, ipAddress?: string): Promise<StaffLoginResult> {
    const staff = await this.prisma.staffUser.findUnique({ where: { mobile } });
    if (!staff || !staff.isActive) throw new UnauthorizedException('Invalid credentials.');

    const passwordValid = await argon2.verify(staff.passwordHash, password);
    if (!passwordValid) throw new UnauthorizedException('Invalid credentials.');

    const knownDevice = await this.prisma.device.findFirst({
      where: {
        subjectType: SubjectType.STAFF,
        staffUserId: staff.id,
        deviceIdentifier: device.deviceIdentifier,
        isTrusted: true,
      },
    });

    if (!knownDevice) {
      const result = await this.otp.requestOtp(mobile, OtpPurpose.STAFF_STEP_UP, {
        ipAddress,
        deviceId: device.deviceIdentifier,
      });
      return { status: 'DEVICE_VERIFICATION_REQUIRED', requestId: result.requestId, devOtp: result.devOtp };
    }

    return this.completeLogin(staff.id, device, ipAddress);
  }

  async verifyDeviceOtp(
    mobile: string,
    otp: string,
    device: DeviceInfoDto,
    ipAddress?: string,
  ): Promise<StaffLoginResult> {
    const staff = await this.prisma.staffUser.findUnique({ where: { mobile } });
    if (!staff || !staff.isActive) throw new UnauthorizedException('Invalid credentials.');

    const isValid = await this.otp.verifyOtp(mobile, OtpPurpose.STAFF_STEP_UP, otp);
    if (!isValid) throw new UnauthorizedException('Incorrect or expired verification code.');

    return this.completeLogin(staff.id, device, ipAddress);
  }

  private async completeLogin(
    staffUserId: string,
    device: DeviceInfoDto,
    ipAddress?: string,
  ): Promise<StaffLoginResult> {
    const staff = await this.prisma.staffUser.findUniqueOrThrow({ where: { id: staffUserId } });

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
