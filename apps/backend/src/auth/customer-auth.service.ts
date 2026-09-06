import { BadRequestException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuditActorType, OtpPurpose, SubjectType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { OtpService } from './otp.service';
import { SessionService, IssuedTokens } from './session.service';
import { DeviceInfoDto } from './dto/device-info.dto';
import { generateCustomerCode, retryOnConflict } from '../common/id-generators';
import { FirebaseAdminService } from '../firebase/firebase-admin.service';

@Injectable()
export class CustomerAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
    private readonly firebase: FirebaseAdminService,
  ) {}

  /**
   * Google Sign-In only logs in a customer whose account ALREADY carries the
   * verified Google email - it is an additional login method for an existing
   * account, never a self-signup path. Customer.mobile is required and
   * unique in this schema, so there's no safe way to create a brand-new
   * customer from an email-only identity; a genuinely new person still needs
   * a store visit / OTP signup to get a mobile-linked account first.
   */
  async googleLogin(
    idToken: string,
    device: DeviceInfoDto,
    ipAddress?: string,
  ): Promise<IssuedTokens & { customerId: string }> {
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

    const customer = await this.prisma.customer.findFirst({ where: { email, isActive: true } });
    if (!customer) {
      throw new UnauthorizedException(
        'No SPTC Finance account is linked to this Google email yet. Sign in with your mobile number, or ask your store to add this email to your profile.',
      );
    }

    const deviceRow = await this.sessions.upsertDevice(
      { subjectType: SubjectType.CUSTOMER, customerId: customer.id },
      device,
      true,
    );
    const tokens = await this.sessions.issueSession(
      { subjectType: SubjectType.CUSTOMER, customerId: customer.id },
      deviceRow.id,
      ipAddress,
    );

    await this.audit.record({
      actorType: AuditActorType.CUSTOMER,
      actorId: customer.id,
      action: 'CUSTOMER_GOOGLE_LOGIN',
      entityType: 'Customer',
      entityId: customer.id,
      ipAddress,
      deviceId: deviceRow.id,
    });

    return { ...tokens, customerId: customer.id };
  }

  async requestOtp(mobile: string, ipAddress?: string) {
    const result = await this.otp.requestOtp(mobile, OtpPurpose.CUSTOMER_LOGIN, { ipAddress });
    return { requestId: result.requestId, expiresAt: result.expiresAt, devOtp: result.devOtp };
  }

  async verifyOtpAndLogin(
    mobile: string,
    otp: string,
    device: DeviceInfoDto,
    ipAddress?: string,
  ): Promise<IssuedTokens & { customerId: string; pinSetupRequired: boolean }> {
    const isValid = await this.otp.verifyOtp(mobile, OtpPurpose.CUSTOMER_LOGIN, otp);
    if (!isValid) throw new BadRequestException('Incorrect or expired verification code.');

    let customer = await this.prisma.customer.findUnique({ where: { mobile } });
    let isNewCustomer = false;
    if (!customer) {
      customer = await retryOnConflict(() =>
        this.prisma.customer.create({
          data: {
            mobile,
            name: 'New Customer',
            customerCode: generateCustomerCode(),
          },
        }),
      );
      isNewCustomer = true;
    }

    if (!customer.isActive) {
      throw new UnauthorizedException('This account has been deactivated. Contact support.');
    }

    const deviceRow = await this.sessions.upsertDevice(
      { subjectType: SubjectType.CUSTOMER, customerId: customer.id },
      device,
      true,
    );

    const tokens = await this.sessions.issueSession(
      { subjectType: SubjectType.CUSTOMER, customerId: customer.id },
      deviceRow.id,
      ipAddress,
    );

    await this.audit.record({
      actorType: AuditActorType.CUSTOMER,
      actorId: customer.id,
      action: isNewCustomer ? 'CUSTOMER_SIGNUP' : 'CUSTOMER_LOGIN',
      entityType: 'Customer',
      entityId: customer.id,
      ipAddress,
      deviceId: deviceRow.id,
    });

    return { ...tokens, customerId: customer.id, pinSetupRequired: !customer.pinHash };
  }

  async setPin(customerId: string, pin: string): Promise<void> {
    if (!/^\d{4,6}$/.test(pin)) {
      throw new BadRequestException('PIN must be 4-6 digits.');
    }
    const pinHash = await argon2.hash(pin);
    await this.prisma.customer.update({ where: { id: customerId }, data: { pinHash } });
    await this.audit.record({
      actorType: AuditActorType.CUSTOMER,
      actorId: customerId,
      action: 'CUSTOMER_PIN_SET',
      entityType: 'Customer',
      entityId: customerId,
    });
  }

  async pinLogin(
    mobile: string,
    pin: string,
    device: DeviceInfoDto,
    ipAddress?: string,
  ): Promise<IssuedTokens & { customerId: string }> {
    const customer = await this.prisma.customer.findUnique({ where: { mobile } });
    if (!customer || !customer.pinHash || !customer.isActive) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    // PIN login is only permitted from a device that already completed a
    // full OTP verification and was marked trusted - prevents PIN brute
    // force from an unrecognized device even if the PIN is guessed.
    const trustedDevice = await this.prisma.device.findFirst({
      where: {
        subjectType: SubjectType.CUSTOMER,
        customerId: customer.id,
        deviceIdentifier: device.deviceIdentifier,
        isTrusted: true,
      },
    });
    if (!trustedDevice) {
      throw new UnauthorizedException('Please verify this device with an OTP first.');
    }

    const pinValid = await argon2.verify(customer.pinHash, pin);
    if (!pinValid) throw new UnauthorizedException('Invalid credentials.');

    const tokens = await this.sessions.issueSession(
      { subjectType: SubjectType.CUSTOMER, customerId: customer.id },
      trustedDevice.id,
      ipAddress,
    );

    await this.audit.record({
      actorType: AuditActorType.CUSTOMER,
      actorId: customer.id,
      action: 'CUSTOMER_PIN_LOGIN',
      entityType: 'Customer',
      entityId: customer.id,
      ipAddress,
      deviceId: trustedDevice.id,
    });

    return { ...tokens, customerId: customer.id };
  }
}
