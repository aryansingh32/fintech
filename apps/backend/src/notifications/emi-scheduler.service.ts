import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InstallmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import { NotificationEvent } from './notification-events';
import { computeInstallmentStatus } from '../loans/installment-status';

/**
 * The only place installment status transitions to DUE/OVERDUE purely from
 * the passage of time (as opposed to a payment changing paidAmount) - see
 * blueprint #38 EMI_APPROACHING/EMI_DUE/EMI_OVERDUE events. Runs once daily;
 * idempotent by construction (recomputing status from amounts + dates never
 * produces a different answer for the same day, so running it twice is safe).
 */
@Injectable()
export class EmiSchedulerService {
  private readonly logger = new Logger(EmiSchedulerService.name);
  private static readonly APPROACHING_WINDOW_DAYS = 3;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async runDailySweep(): Promise<void> {
    await this.sweepStatuses();
    await this.sendApproachingReminders();
    await this.sendDueTodayNotifications();
    await this.sendOverdueNotifications();
    await this.notifications.retryFailed();
  }

  private async sweepStatuses(): Promise<void> {
    const openInstallments = await this.prisma.installment.findMany({
      where: { status: { in: [InstallmentStatus.UPCOMING, InstallmentStatus.DUE] } },
    });

    let transitioned = 0;
    for (const installment of openInstallments) {
      const newStatus = computeInstallmentStatus(installment.totalAmount, installment.paidAmount, installment.dueDate);
      if (newStatus !== installment.status) {
        await this.prisma.installment.update({ where: { id: installment.id }, data: { status: newStatus } });
        transitioned++;
      }
    }
    this.logger.log(`Daily sweep: ${transitioned} installment(s) transitioned status.`);
  }

  private async sendApproachingReminders(): Promise<void> {
    const windowStart = startOfDay(addDays(new Date(), 1));
    const windowEnd = startOfDay(addDays(new Date(), EmiSchedulerService.APPROACHING_WINDOW_DAYS));

    const installments = await this.prisma.installment.findMany({
      where: { status: InstallmentStatus.UPCOMING, dueDate: { gte: windowStart, lte: windowEnd } },
      include: { loan: true },
    });

    for (const installment of installments) {
      const ids = await this.notifications.enqueue(this.prisma, {
        event: NotificationEvent.EMI_APPROACHING,
        customerId: installment.loan.customerId,
        payload: {
          amount: installment.totalAmount.toFixed(2),
          loanNumber: installment.loan.loanNumber,
          dueDate: installment.dueDate.toISOString().slice(0, 10),
        },
      });
      await this.notifications.dispatchAll(ids);
    }
  }

  private async sendDueTodayNotifications(): Promise<void> {
    const installments = await this.prisma.installment.findMany({
      where: { status: InstallmentStatus.DUE },
      include: { loan: true },
    });

    for (const installment of installments) {
      const ids = await this.notifications.enqueue(this.prisma, {
        event: NotificationEvent.EMI_DUE,
        customerId: installment.loan.customerId,
        payload: { amount: installment.totalAmount.toFixed(2), loanNumber: installment.loan.loanNumber },
      });
      await this.notifications.dispatchAll(ids);
    }
  }

  private async sendOverdueNotifications(): Promise<void> {
    const installments = await this.prisma.installment.findMany({
      where: { status: InstallmentStatus.OVERDUE },
      include: { loan: true },
    });

    for (const installment of installments) {
      const ids = await this.notifications.enqueue(this.prisma, {
        event: NotificationEvent.EMI_OVERDUE,
        customerId: installment.loan.customerId,
        payload: { amount: installment.totalAmount.toFixed(2), loanNumber: installment.loan.loanNumber },
      });
      await this.notifications.dispatchAll(ids);
    }
  }
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
