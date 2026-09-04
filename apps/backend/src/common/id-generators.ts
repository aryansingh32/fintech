import { randomInt } from 'crypto';

/**
 * Human-readable business identifiers (SPTC-LOAN-10234, CUST-1023, ...).
 * These are display/search identifiers only - the database primary key is
 * always the UUID `id`. Callers should retry on a unique-constraint
 * violation (P2002) using retryOnConflict below, since generation here is
 * optimistic rather than backed by a DB sequence.
 */
export function generateCustomerCode(): string {
  return `CUST-${randomInt(1000, 999999)}`;
}

export function generateLoanNumber(): string {
  return `SPTC-LOAN-${randomInt(10000, 99999)}`;
}

export function generatePaymentNumber(): string {
  return `SPTC-PAY-${Date.now().toString(36).toUpperCase()}${randomInt(100, 999)}`;
}

export function generateReceiptNumber(): string {
  return `SPTC-RCPT-${Date.now().toString(36).toUpperCase()}${randomInt(100, 999)}`;
}

export function generateTicketNumber(): string {
  return `SPTC-TKT-${randomInt(10000, 99999)}`;
}

export function generateVerificationId(): string {
  return `SPTC-VRF-${randomInt(10 ** 9, 10 ** 10 - 1)}`;
}

export async function retryOnConflict<T>(fn: () => Promise<T>, attempts = 5): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const code = (err as { code?: string })?.code;
      if (code !== 'P2002') throw err;
    }
  }
  throw lastError;
}
