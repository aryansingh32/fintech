import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuditActorType, OtpPurpose, SubjectType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { OtpService } from './otp.service';
import { SessionService, IssuedTokens } from './session.service';
import { DeviceInfoDto } from './dto/device-info.dto';
import { generateCustomerCode, retryOnConflict } from '../common/id-generators';

@Injectable()
export class CustomerAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
  ) {}

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
