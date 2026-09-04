import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TokenService } from './token.service';
import { OtpService } from './otp.service';
import { SessionService } from './session.service';
import { CustomerAuthService } from './customer-auth.service';
import { StaffAuthService } from './staff-auth.service';
import { CustomerAuthController } from './customer-auth.controller';
import { StaffAuthController } from './staff-auth.controller';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [CustomerAuthController, StaffAuthController],
  providers: [
    JwtStrategy,
    TokenService,
    OtpService,
    SessionService,
    CustomerAuthService,
    StaffAuthService,
    // Not registered as APP_GUARD here - AppModule registers all global
    // guards together, in explicit order, so JWT auth always runs before
    // RBAC checks regardless of module import order.
    JwtAuthGuard,
  ],
  exports: [TokenService, OtpService, SessionService, JwtAuthGuard],
})
export class AuthModule {}
