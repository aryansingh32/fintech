import AsyncStorage from '@react-native-async-storage/async-storage';
import { AllocationComponent, PaymentMethod, generateClientTransactionId } from '@sptc/shared';

const QUEUE_KEY = 'sptc_offline_payment_queue';

export interface QueuedPayment {
  clientTransactionId: string;
  loanId: string;
  loanNumber: string;
  customerName: string;
  amount: number;
  method: PaymentMethod;
  referenceId?: string;
  allocation?: { component: AllocationComponent; installmentId?: string; amount: number }[];
  queuedAt: string;
}

/**
 * Local transaction queue for payments recorded while offline (blueprint
 * #13, #39). Every entry gets a unique clientTransactionId at the moment
 * it's queued - that id is what the sync endpoint dedups on, so even if
 * this queue is flushed twice (app killed mid-sync, user taps "Sync now"
 * again) the server can only ever create one payment per entry.
 */
export async function enqueueOfflinePayment(
  payment: Omit<QueuedPayment, 'clientTransactionId' | 'queuedAt'>,
): Promise<QueuedPayment> {
  const entry: QueuedPayment = {
    ...payment,
    clientTransactionId: generateClientTransactionId(),
    queuedAt: new Date().toISOString(),
  };
  const existing = await listQueuedPayments();
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify([...existing, entry]));
  return entry;
}

export async function listQueuedPayments(): Promise<QueuedPayment[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as QueuedPayment[];
  } catch {
    return [];
  }
}

export async function removeQueuedPayments(clientTransactionIds: string[]): Promise<void> {
  const existing = await listQueuedPayments();
  const remaining = existing.filter((p) => !clientTransactionIds.includes(p.clientTransactionId));
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
}
