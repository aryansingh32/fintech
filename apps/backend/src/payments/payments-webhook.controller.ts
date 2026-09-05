import { BadRequestException, Controller, Headers, Logger, Post, RawBodyRequest, Req } from '@nestjs/common';
import { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { PaymentsService } from './payments.service';
import { RazorpayGatewayService } from './gateway/razorpay-gateway.service';

interface RazorpayWebhookPayload {
  event: string;
  payload: {
    payment: {
      entity: {
        id: string;
        order_id: string;
        amount: number;
        status: string;
      };
    };
  };
}

/**
 * Server-to-server confirmation from Razorpay - the authoritative fallback
 * for when the app's own signature-verified confirm call never arrives
 * (killed mid-checkout, connectivity dropped right after paying). No
 * session/JWT applies here; trust comes entirely from verifying the
 * request body against RAZORPAY_WEBHOOK_SECRET (blueprint #9, #12 "webhook
 * confirmation").
 */
@Controller({ path: 'payments/webhook', version: '1' })
export class PaymentsWebhookController {
  private readonly logger = new Logger(PaymentsWebhookController.name);

  constructor(
    private readonly payments: PaymentsService,
    private readonly gateway: RazorpayGatewayService,
  ) {}

  @Public()
  @Post('razorpay')
  async handleRazorpayWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-razorpay-signature') signature: string,
  ): Promise<{ received: true }> {
    if (!req.rawBody || !signature || !this.gateway.verifyWebhookSignature(req.rawBody, signature)) {
      throw new BadRequestException('Invalid webhook signature.');
    }

    const payload = JSON.parse(req.rawBody.toString('utf-8')) as RazorpayWebhookPayload;

    if (payload.event === 'payment.captured') {
      const { order_id: orderId, id: paymentId, amount } = payload.payload.payment.entity;
      try {
        await this.payments.handleRazorpayWebhookPaymentCaptured(orderId, paymentId, amount);
      } catch (err) {
        // Never fail this endpoint back to Razorpay with a 5xx for a
        // business-logic issue (e.g. loan already closed) - log it for
        // manual reconciliation instead of triggering their retry storm.
        this.logger.error(`Failed to post webhook-captured payment ${paymentId}: ${(err as Error).message}`);
      }
    }

    return { received: true };
  }
}
