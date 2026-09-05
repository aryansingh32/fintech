import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomInt, createHash } from 'crypto';
import { OtpPurpose } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SmsProviderService } from '../notifications/sms/sms-provider.service';

class TooManyRequestsException extends HttpException {
  constructor(message: string) {
    super({ message, code: 'RATE_LIMITED' }, HttpStatus.TOO_MANY_REQUESTS);
  }
}

export interface OtpRequestResult {
  requestId: string;
  expiresAt: Date;
  /** Only ever populated outside production, when no real SMS provider is configured. */
  devOtp?: string;
}

/**
 * Centralizes OTP issuance/verification with rate limiting and abuse
 * protection (blueprint #4.1, #14, #61 test "OTP rate limiting").
 * Never marks an OTP as "sent" unless a real provider is configured; in a
 * provider-less dev sandbox it surfaces the code out-of-band for testing
 * instead of pretending delivery happened.
 */
@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly sms: SmsProviderService,
  ) {}

  async requestOtp(
    mobile: string,
    purpose: OtpPurpose,
    context: { ipAddress?: string; deviceId?: string; customerId?: string },
  ): Promise<OtpRequestResult> {
    const maxPerHour = Number(this.config.get('OTP_MAX_REQUESTS_PER_HOUR') ?? 5);
    const resendCooldownSec = Number(this.config.get('OTP_RESEND_COOLDOWN_SECONDS') ?? 45);
    const ttlSec = Number(this.config.get('OTP_TTL_SECONDS') ?? 300);

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await this.prisma.otpAttempt.count({
      where: { mobile, purpose, createdAt: { gte: oneHourAgo } },
    });
    if (recentCount >= maxPerHour) {
      throw new TooManyRequestsException(
        'Too many OTP requests. Please wait before requesting another code.',
      );
    }

    const lastAttempt = await this.prisma.otpAttempt.findFirst({
      where: { mobile, purpose },
      orderBy: { createdAt: 'desc' },
    });
    if (lastAttempt && Date.now() - lastAttempt.createdAt.getTime() < resendCooldownSec * 1000) {
      throw new TooManyRequestsException('Please wait before requesting another code.');
    }

    const otp = randomInt(100000, 999999).toString();
    const otpHash = this.hashOtp(mobile, purpose, otp);
    const expiresAt = new Date(Date.now() + ttlSec * 1000);

    const attempt = await this.prisma.otpAttempt.create({
      data: {
        mobile,
        purpose,
        otpHash,
        expiresAt,
        ipAddress: context.ipAddress,
        deviceId: context.deviceId,
        customerId: context.customerId,
      },
    });

    if (this.sms.isConfigured()) {
      // Delivery status is whatever the provider's API call actually
      // returns - a thrown error here means the OTP request itself fails,
      // it is never swallowed into a false "sent" response.
      await this.sms.send(mobile, `${otp} is your SPTC Finance verification code. Valid for ${Math.round(ttlSec / 60)} minutes.`);
      return { requestId: attempt.id, expiresAt };
    }

    if (this.config.get('NODE_ENV') === 'production') {
      throw new ServiceUnavailableException(
        'SMS provider not configured. Cannot deliver verification codes.',
      );
    }

    this.logger.warn(
      `SMS provider not configured (dev mode) - OTP for ${this.maskMobile(mobile)}: ${otp}`,
    );
    return { requestId: attempt.id, expiresAt, devOtp: otp };
  }

  async verifyOtp(mobile: string, purpose: OtpPurpose, otp: string): Promise<boolean> {
    const maxAttempts = Number(this.config.get('OTP_MAX_ATTEMPTS') ?? 5);
    const attempt = await this.prisma.otpAttempt.findFirst({
      where: { mobile, purpose, verified: false },
      orderBy: { createdAt: 'desc' },
    });
    if (!attempt) throw new BadRequestException('No pending verification code for this number.');
    if (attempt.expiresAt < new Date()) throw new BadRequestException('Verification code expired.');
    if (attempt.attempts >= maxAttempts) {
      throw new TooManyRequestsException('Too many incorrect attempts. Request a new code.');
    }

    const suppliedHash = this.hashOtp(mobile, purpose, otp);
    const isValid = suppliedHash === attempt.otpHash;

    await this.prisma.otpAttempt.update({
      where: { id: attempt.id },
      data: {
        attempts: { increment: 1 },
        verified: isValid,
        verifiedAt: isValid ? new Date() : undefined,
      },
    });

    return isValid;
  }

  private hashOtp(mobile: string, purpose: OtpPurpose, otp: string): string {
    const pepper = this.config.get<string>('JWT_ACCESS_SECRET') ?? '';
    return createHash('sha256').update(`${mobile}:${purpose}:${otp}:${pepper}`).digest('hex');
  }

  private maskMobile(mobile: string): string {
    return mobile.length <= 4 ? '****' : `${'*'.repeat(mobile.length - 4)}${mobile.slice(-4)}`;
  }
}
