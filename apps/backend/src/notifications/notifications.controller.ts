import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { SubjectType } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { NotificationsService } from './notifications.service';

@UseGuards(JwtAuthGuard)
@Controller({ path: 'notifications', version: '1' })
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return user.subjectType === SubjectType.CUSTOMER
      ? this.notifications.listForCustomer(user.id)
      : this.notifications.listForStaff(user.id);
  }

  @Post(':id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.notifications.markRead(id, this.recipientFor(user));
  }

  @Post('read-all')
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllRead(this.recipientFor(user));
  }

  private recipientFor(user: AuthUser) {
    return user.subjectType === SubjectType.CUSTOMER ? { customerId: user.id } : { staffUserId: user.id };
  }
}
