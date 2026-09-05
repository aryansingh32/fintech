import { Global, Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { EmiSchedulerService } from './emi-scheduler.service';
import { PushProviderService } from './push/push-provider.service';

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, EmiSchedulerService, PushProviderService],
  exports: [NotificationsService, PushProviderService],
})
export class NotificationsModule {}
