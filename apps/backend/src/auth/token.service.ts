import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, createHash } from 'crypto';
import { StaffRole, SubjectType } from '@prisma/client';

export interface AccessTokenPayload {
  sub: string;
  subjectType: SubjectType;
  sessionId: string;
  deviceId?: string;
  role?: StaffRole;
  branchId?: string | null;
  isGlobal?: boolean;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  signAccessToken(payload: AccessTokenPayload): string {
    return this.jwt.sign(payload, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get<string>('JWT_ACCESS_TTL') ?? '15m',
    });
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    return this.jwt.verify<AccessTokenPayload>(token, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET'),
    });
  }

  /** Opaque, high-entropy refresh token. Only its SHA-256 hash is ever persisted. */
  generateRefreshToken(): { token: string; hash: string; expiresAt: Date } {
    const token = randomBytes(48).toString('base64url');
    const hash = this.hashRefreshToken(token);
    const ttlMs = this.parseTtlMs(this.config.get<string>('JWT_REFRESH_TTL') ?? '30d');
    return { token, hash, expiresAt: new Date(Date.now() + ttlMs) };
  }

  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private parseTtlMs(ttl: string): number {
    const match = /^(\d+)([smhd])$/.exec(ttl);
    if (!match) return 30 * 24 * 60 * 60 * 1000;
    const value = Number(match[1]);
    const unit = match[2];
    const multipliers: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
    return value * multipliers[unit];
  }
}
