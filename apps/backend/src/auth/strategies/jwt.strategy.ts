import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { AccessTokenPayload } from '../token.service';
import { AuthUser } from '../../common/interfaces/auth-user.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET'),
    });
  }

  /**
   * Beyond verifying the JWT signature/expiry, this re-checks the backing
   * Session row so a revoked/logged-out session stops working immediately -
   * a short-lived access token alone cannot satisfy "logout from other
   * devices" or "session revocation" (blueprint #4.1, #14).
   */
  async validate(payload: AccessTokenPayload): Promise<AuthUser> {
    const session = await this.prisma.session.findUnique({ where: { id: payload.sessionId } });
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session is no longer valid. Please log in again.');
    }

    return {
      id: payload.sub,
      subjectType: payload.subjectType,
      sessionId: payload.sessionId,
      deviceId: payload.deviceId,
      role: payload.role,
      branchId: payload.branchId,
      isGlobal: payload.isGlobal,
    };
  }
}
