import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { ReversalService } from './reversal.service';
import { PaymentsController } from './payments.controller';

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, ReversalService],
  exports: [PaymentsService, ReversalService],
})
export class PaymentsModule {}
