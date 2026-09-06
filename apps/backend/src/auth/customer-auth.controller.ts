import { Body, Controller, Delete, Get, Ip, Param, Post, UseGuards } from '@nestjs/common';
import { SubjectType } from '@prisma/client';
import { Public } from '../common/decorators/public.decorator';
import { RequireSubject } from '../common/decorators/require-subject.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { CustomerAuthService } from './customer-auth.service';
import { SessionService } from './session.service';
import {
  CustomerPinLoginDto,
  RefreshTokenDto,
  RequestCustomerOtpDto,
  SetCustomerPinDto,
  VerifyCustomerOtpDto,
} from './dto/customer-auth.dto';
import { GoogleLoginDto } from './dto/google-auth.dto';

@Controller({ path: 'auth/customer', version: '1' })
export class CustomerAuthController {
  constructor(
    private readonly customerAuth: CustomerAuthService,
    private readonly sessions: SessionService,
  ) {}

  @Public()
  @Post('otp/request')
  requestOtp(@Body() dto: RequestCustomerOtpDto, @Ip() ip: string) {
    return this.customerAuth.requestOtp(dto.mobile, ip);
  }

  @Public()
  @Post('otp/verify')
  verifyOtp(@Body() dto: VerifyCustomerOtpDto, @Ip() ip: string) {
    return this.customerAuth.verifyOtpAndLogin(dto.mobile, dto.otp, dto.device, ip);
  }

  @Public()
  @Post('pin/login')
  pinLogin(@Body() dto: CustomerPinLoginDto, @Ip() ip: string) {
    return this.customerAuth.pinLogin(dto.mobile, dto.pin, dto.device, ip);
  }

  @Public()
  @Post('google')
  googleLogin(@Body() dto: GoogleLoginDto, @Ip() ip: string) {
    return this.customerAuth.googleLogin(dto.idToken, dto.device, ip);
  }

  @Public()
  @Post('token/refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.sessions.refresh(dto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @RequireSubject(SubjectType.CUSTOMER)
  @Post('pin/set')
  setPin(@CurrentUser() user: AuthUser, @Body() dto: SetCustomerPinDto) {
    return this.customerAuth.setPin(user.id, dto.pin).then(() => ({ success: true }));
  }

  @UseGuards(JwtAuthGuard)
  @RequireSubject(SubjectType.CUSTOMER)
  @Post('logout')
  logout(@CurrentUser() user: AuthUser) {
    return this.sessions.revokeSession(user.sessionId).then(() => ({ success: true }));
  }

  @UseGuards(JwtAuthGuard)
  @RequireSubject(SubjectType.CUSTOMER)
  @Post('logout-other-devices')
  async logoutOtherDevices(@CurrentUser() user: AuthUser) {
    const count = await this.sessions.revokeAllOtherSessions(SubjectType.CUSTOMER, user.id, user.sessionId);
    return { success: true, revokedSessions: count };
  }

  @UseGuards(JwtAuthGuard)
  @RequireSubject(SubjectType.CUSTOMER)
  @Get('devices')
  listDevices(@CurrentUser() user: AuthUser) {
    return this.sessions.listActiveSessions(SubjectType.CUSTOMER, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @RequireSubject(SubjectType.CUSTOMER)
  @Delete('devices/:sessionId')
  async revokeDevice(@CurrentUser() user: AuthUser, @Param('sessionId') sessionId: string) {
    await this.sessions.revokeSession(sessionId, 'REVOKED_BY_CUSTOMER');
    return { success: true };
  }
}
