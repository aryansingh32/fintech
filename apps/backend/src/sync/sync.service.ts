import { Injectable, Logger } from '@nestjs/common';
import { AuditActorType, PaymentSource } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { branchWhereClause } from '../rbac/branch-scope.util';
import { OfflinePaymentDto } from './dto/sync.dto';

export interface SyncPaymentResult {
  clientTransactionId: string;
  status: 'SYNCED' | 'ALREADY_SYNCED' | 'FAILED';
  paymentId?: string;
  receiptId?: string;
  error?: string;
}

/**
 * Offline-first sync for the Business App (blueprint #13, #39). The
 * dedup key is ALWAYS derived from clientTransactionId, never trusted from
 * the request body - so replaying the same locally-queued payment (app
 * killed mid-sync, retried after reconnecting, synced twice from two
 * devices by mistake) can only ever produce one Payment row. Each item in
 * the batch is processed independently so one bad record doesn't block the
 * rest of the queue from syncing.
 */
@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
  ) {}

  async syncPayments(items: OfflinePaymentDto[], staff: AuthUser): Promise<SyncPaymentResult[]> {
    const results: SyncPaymentResult[] = [];

    for (const item of items) {
      const derivedIdempotencyKey = `offline:${item.clientTransactionId}`;
      try {
        const { payment, receipt, idempotentReplay } = await this.payments.collectPayment({
          loanId: item.loanId,
          amount: item.amount,
          method: item.method,
          referenceId: item.referenceId,
          idempotencyKey: derivedIdempotencyKey,
          clientTransactionId: item.clientTransactionId,
          allocation: item.allocation,
          source: PaymentSource.OFFLINE_SYNCED,
          collectedByStaffId: staff.id,
          branchId: staff.branchId ?? undefined,
          requestingUser: staff,
          actor: { actorType: AuditActorType.STAFF, actorId: staff.id, role: staff.role },
        });

        results.push({
          clientTransactionId: item.clientTransactionId,
          status: idempotentReplay ? 'ALREADY_SYNCED' : 'SYNCED',
          paymentId: payment.id,
          receiptId: receipt.id,
        });
      } catch (err) {
        this.logger.warn(`Offline payment sync failed for ${item.clientTransactionId}: ${(err as Error).message}`);
        results.push({
          clientTransactionId: item.clientTransactionId,
          status: 'FAILED',
          error: (err as Error).message,
        });
      }
    }

    return results;
  }

  /**
   * Cached-data pull for offline caching. Scoped to the staff member's own
   * branch (never global unless they are), and incremental via `since` so a
   * device that already has yesterday's data doesn't re-download everything.
   */
  async pull(staff: AuthUser, since?: string) {
    const updatedAt = since ? { gte: new Date(since) } : undefined;
    const branchFilter = branchWhereClause(staff);

    const [customers, loans] = await Promise.all([
      this.prisma.customer.findMany({
        where: { ...branchFilter, updatedAt },
        select: {
          id: true,
          customerCode: true,
          mobile: true,
          name: true,
          kycStatus: true,
          branchId: true,
          updatedAt: true,
        },
        take: 500,
      }),
      this.prisma.loan.findMany({
        where: { ...branchFilter, status: 'ACTIVE', updatedAt },
        include: { installments: true },
        take: 500,
      }),
    ]);

    return { syncedAt: new Date().toISOString(), customers, loans };
  }
}
