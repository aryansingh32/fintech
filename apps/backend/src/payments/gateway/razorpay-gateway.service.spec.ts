import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { RazorpayGatewayService } from './razorpay-gateway.service';

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as unknown as Response;
}

// ConfigService.get() checks process.env before the constructor's
// internalConfig object, and .env.test sets PAYMENT_GATEWAY_PROVIDER="" -
// so these tests set process.env directly (matching how a real deployment
// configures it) rather than relying on internalConfig, which would be
// shadowed by that ambient empty value.
const ENV_KEYS = ['PAYMENT_GATEWAY_PROVIDER', 'RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET'] as const;

describe('RazorpayGatewayService', () => {
  const originalEnv: Record<string, string | undefined> = {};
  let gateway: RazorpayGatewayService;
  let fetchMock: jest.SpyInstance;

  beforeAll(() => {
    for (const key of ENV_KEYS) originalEnv[key] = process.env[key];
  });

  afterAll(() => {
    for (const key of ENV_KEYS) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  });

  beforeEach(() => {
    process.env.PAYMENT_GATEWAY_PROVIDER = 'razorpay';
    process.env.RAZORPAY_KEY_ID = 'rzp_test_key';
    process.env.RAZORPAY_KEY_SECRET = 'test_secret';
    process.env.RAZORPAY_WEBHOOK_SECRET = 'webhook_secret';
    gateway = new RazorpayGatewayService(new ConfigService({}));
    fetchMock = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  it('reports unconfigured when the provider or keys are missing', () => {
    delete process.env.PAYMENT_GATEWAY_PROVIDER;
    const unconfigured = new RazorpayGatewayService(new ConfigService({}));
    expect(unconfigured.isConfigured()).toBe(false);
  });

  it('creates an order with the amount converted to paise', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 'order_abc123' }));

    const order = await gateway.createOrder(500.5, 'loan_SPTC-1', { loanId: 'loan-1' });

    expect(order).toEqual({ orderId: 'order_abc123', keyId: 'rzp_test_key', amount: 50050, currency: 'INR' });
    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body as string);
    expect(body.amount).toBe(50050);
    expect(body.notes).toEqual({ loanId: 'loan-1' });
  });

  it('throws (never fabricates an order) when Razorpay rejects the request', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: { description: 'bad request' } }, false, 400));
    await expect(gateway.createOrder(100, 'loan_x')).rejects.toThrow(ServiceUnavailableException);
  });

  it('verifies a payment signature that matches the HMAC of orderId|paymentId', () => {
    const signature = createHmac('sha256', 'test_secret').update('order_1|pay_1').digest('hex');
    expect(gateway.verifyPaymentSignature('order_1', 'pay_1', signature)).toBe(true);
  });

  it('rejects a forged or mismatched payment signature', () => {
    expect(gateway.verifyPaymentSignature('order_1', 'pay_1', 'not-a-real-signature')).toBe(false);
    const wrongSecretSig = createHmac('sha256', 'someone-elses-secret').update('order_1|pay_1').digest('hex');
    expect(gateway.verifyPaymentSignature('order_1', 'pay_1', wrongSecretSig)).toBe(false);
  });

  it('verifies a webhook body against RAZORPAY_WEBHOOK_SECRET', () => {
    const rawBody = JSON.stringify({ event: 'payment.captured' });
    const signature = createHmac('sha256', 'webhook_secret').update(rawBody).digest('hex');
    expect(gateway.verifyWebhookSignature(rawBody, signature)).toBe(true);
    expect(gateway.verifyWebhookSignature(rawBody, 'tampered')).toBe(false);
  });

  it('rejects a webhook when no webhook secret is configured', () => {
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    const noWebhookSecret = new RazorpayGatewayService(new ConfigService({}));
    expect(noWebhookSecret.verifyWebhookSignature('{}', 'anything')).toBe(false);
  });
});
