import { InstallmentStatus } from '@sptc/shared';

/** Money fields from the API are already fixed to 2dp strings - this only adds the ₹ + thousands separators for display. */
export function formatMoney(value: string | number): string {
  const num = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(num)) return '₹0';
  return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function daysUntil(iso: string): number {
  const due = new Date(iso);
  const now = new Date();
  const dueDay = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate());
  const nowDay = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((dueDay - nowDay) / 86_400_000);
}

export const INSTALLMENT_STATUS_LABEL: Record<InstallmentStatus, string> = {
  [InstallmentStatus.UPCOMING]: 'Upcoming',
  [InstallmentStatus.DUE]: 'Due Today',
  [InstallmentStatus.OVERDUE]: 'Overdue',
  [InstallmentStatus.PARTIALLY_PAID]: 'Partially Paid',
  [InstallmentStatus.PAID]: 'Paid',
  [InstallmentStatus.CANCELLED]: 'Cancelled',
  [InstallmentStatus.ADJUSTED]: 'Adjusted',
};
