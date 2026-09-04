import { Body, Controller, Get, Ip, Post, UseGuards } from '@nestjs/common';
import { SubjectType } from '@prisma/client';
import { Public } from '../common/decorators/public.decorator';
import { RequireSubject } from '../common/decorators/require-subject.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { StaffAuthService } from './staff-auth.service';
import { SessionService } from './session.service';
import { RefreshTokenDto } from './dto/customer-auth.dto';
import { StaffLoginDto, VerifyStaffDeviceOtpDto } from './dto/staff-auth.dto';

@Controller({ path: 'auth/staff', version: '1' })
export class StaffAuthController {
  constructor(
    private readonly staffAuth: StaffAuthService,
    private readonly sessions: SessionService,
  ) {}

  @Public()
  @Post('login')
  login(@Body() dto: StaffLoginDto, @Ip() ip: string) {
    return this.staffAuth.login(dto.mobile, dto.password, dto.device, ip);
  }

  @Public()
  @Post('device/verify')
  verifyDevice(@Body() dto: VerifyStaffDeviceOtpDto, @Ip() ip: string) {
    return this.staffAuth.verifyDeviceOtp(dto.mobile, dto.otp, dto.device, ip);
  }

  @Public()
  @Post('token/refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.sessions.refresh(dto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @RequireSubject(SubjectType.STAFF)
  @Post('logout')
  logout(@CurrentUser() user: AuthUser) {
    return this.sessions.revokeSession(user.sessionId).then(() => ({ success: true }));
  }

  @UseGuards(JwtAuthGuard)
  @RequireSubject(SubjectType.STAFF)
  @Post('logout-other-devices')
  async logoutOtherDevices(@CurrentUser() user: AuthUser) {
    const count = await this.sessions.revokeAllOtherSessions(SubjectType.STAFF, user.id, user.sessionId);
    return { success: true, revokedSessions: count };
  }

  @UseGuards(JwtAuthGuard)
  @RequireSubject(SubjectType.STAFF)
  @Get('devices')
  listDevices(@CurrentUser() user: AuthUser) {
    return this.sessions.listActiveSessions(SubjectType.STAFF, user.id);
  }
}
