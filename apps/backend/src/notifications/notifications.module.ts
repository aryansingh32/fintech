import { Global, Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { EmiSchedulerService } from './emi-scheduler.service';

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, EmiSchedulerService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
