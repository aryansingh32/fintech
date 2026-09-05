import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { SubjectType } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequireSubject } from '../common/decorators/require-subject.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { Permission } from '../rbac/permissions';
import { SyncService } from './sync.service';
import { PullSinceDto, SyncPaymentsBatchDto } from './dto/sync.dto';

@UseGuards(JwtAuthGuard)
@RequireSubject(SubjectType.STAFF)
@Controller({ path: 'sync', version: '1' })
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @RequirePermissions(Permission.PAYMENT_COLLECT)
  @Post('payments/batch')
  syncPayments(@Body() dto: SyncPaymentsBatchDto, @CurrentUser() user: AuthUser) {
    return this.sync.syncPayments(dto.payments, user);
  }

  @Get('pull')
  pull(@CurrentUser() user: AuthUser, @Query() query: PullSinceDto) {
    return this.sync.pull(user, query.since);
  }
}
