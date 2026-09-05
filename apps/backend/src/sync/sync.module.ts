import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { SyncService } from './sync.service';
import { SyncController } from './sync.controller';

@Module({
  imports: [PaymentsModule],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
