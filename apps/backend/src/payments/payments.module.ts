import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { ReversalService } from './reversal.service';
import { RazorpayGatewayService } from './gateway/razorpay-gateway.service';
import { PaymentsController } from './payments.controller';
import { PaymentsWebhookController } from './payments-webhook.controller';

@Module({
  controllers: [PaymentsController, PaymentsWebhookController],
  providers: [PaymentsService, ReversalService, RazorpayGatewayService],
  exports: [PaymentsService, ReversalService],
})
export class PaymentsModule {}
