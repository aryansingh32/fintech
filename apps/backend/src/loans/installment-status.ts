import Decimal from 'decimal.js';
import { InstallmentStatus } from '@prisma/client';

/**
 * Pure status derivation for a single installment given its totals and the
 * current date. Called every time paidAmount changes (payment, reversal,
 * adjustment) and also by the daily overdue sweep - never stored as an
 * independently-editable field that could drift from the underlying amounts.
 */
export function computeInstallmentStatus(
  totalAmount: Decimal.Value,
  paidAmount: Decimal.Value,
  dueDate: Date,
  now: Date = new Date(),
): InstallmentStatus {
  const total = new Decimal(totalAmount);
  const paid = new Decimal(paidAmount);

  if (paid.gte(total)) return InstallmentStatus.PAID;
  if (paid.gt(0)) return InstallmentStatus.PARTIALLY_PAID;

  const dueDateOnly = new Date(Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate()));
  const nowDateOnly = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  if (dueDateOnly.getTime() < nowDateOnly.getTime()) return InstallmentStatus.OVERDUE;
  if (dueDateOnly.getTime() === nowDateOnly.getTime()) return InstallmentStatus.DUE;
  return InstallmentStatus.UPCOMING;
}
