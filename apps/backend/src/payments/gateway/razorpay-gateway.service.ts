import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

export interface GatewayOrder {
  orderId: string;
  keyId: string;
  amount: number; // paise
  currency: string;
}

/**
 * Real integration with Razorpay (the most common gateway for Indian retail
 * financing). This is the only place that talks to the gateway; every
 * caller treats a thrown error as "the checkout cannot start / the payment
 * is not confirmed" - never a reason to fall back to trusting the client's
 * own claim (blueprint #9, #52, #63).
 *
 * Configure via: PAYMENT_GATEWAY_PROVIDER=razorpay, RAZORPAY_KEY_ID,
 * RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET.
 */
@Injectable()
export class RazorpayGatewayService {
  private readonly logger = new Logger(RazorpayGatewayService.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return (
      this.config.get<string>('PAYMENT_GATEWAY_PROVIDER') === 'razorpay' &&
      Boolean(this.config.get<string>('RAZORPAY_KEY_ID')) &&
      Boolean(this.config.get<string>('RAZORPAY_KEY_SECRET'))
    );
  }

  async createOrder(amountRupees: number, receiptRef: string, notes: Record<string, string> = {}): Promise<GatewayOrder> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException('Payment gateway not configured.');
    }
    const keyId = this.config.get<string>('RAZORPAY_KEY_ID')!;
    const keySecret = this.config.get<string>('RAZORPAY_KEY_SECRET')!;
    const amountPaise = Math.round(amountRupees * 100);

    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ amount: amountPaise, currency: 'INR', receipt: receiptRef, notes }),
    });

    const payload = (await response.json().catch(() => null)) as { id?: string; error?: { description?: string } } | null;
    if (!response.ok || !payload?.id) {
      this.logger.error(`Razorpay order creation failed: ${payload?.error?.description ?? response.status}`);
      throw new ServiceUnavailableException('Could not start payment right now. Please try again.');
    }

    return { orderId: payload.id, keyId, amount: amountPaise, currency: 'INR' };
  }

  /** Used by the webhook handler to recover which loan an order was for (we stash it in `notes` at creation time). */
  async getOrder(orderId: string): Promise<{ id: string; notes: Record<string, string>; amount: number }> {
    const keyId = this.config.get<string>('RAZORPAY_KEY_ID')!;
    const keySecret = this.config.get<string>('RAZORPAY_KEY_SECRET')!;

    const response = await fetch(`https://api.razorpay.com/v1/orders/${orderId}`, {
      headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}` },
    });
    const payload = (await response.json().catch(() => null)) as
      | { id?: string; notes?: Record<string, string>; amount?: number }
      | null;
    if (!response.ok || !payload?.id) {
      throw new ServiceUnavailableException('Could not look up payment order.');
    }
    return { id: payload.id, notes: payload.notes ?? {}, amount: payload.amount ?? 0 };
  }

  /**
   * Verifies the checkout-callback signature (HMAC-SHA256 of
   * `orderId|paymentId` using the key secret). This is cryptographically
   * unforgeable without the secret Razorpay holds - it is authoritative
   * proof, not a bare client claim, even though it arrives via the app
   * rather than a server-to-server webhook.
   */
  verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
    if (!this.isConfigured()) return false;
    const keySecret = this.config.get<string>('RAZORPAY_KEY_SECRET')!;
    const expected = createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest('hex');
    return safeEqual(expected, signature);
  }

  /** Verifies an inbound webhook's `X-Razorpay-Signature` against the raw request body. */
  verifyWebhookSignature(rawBody: Buffer | string, signature: string): boolean {
    const webhookSecret = this.config.get<string>('RAZORPAY_WEBHOOK_SECRET');
    if (!webhookSecret) return false;
    const expected = createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
    return safeEqual(expected, signature);
  }
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
