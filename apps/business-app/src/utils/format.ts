import { InstallmentStatus } from '@sptc/shared';

export const INSTALLMENT_STATUS_LABEL: Record<InstallmentStatus, string> = {
  [InstallmentStatus.UPCOMING]: 'Upcoming',
  [InstallmentStatus.DUE]: 'Due Today',
  [InstallmentStatus.OVERDUE]: 'Overdue',
  [InstallmentStatus.PARTIALLY_PAID]: 'Partially Paid',
  [InstallmentStatus.PAID]: 'Paid',
  [InstallmentStatus.CANCELLED]: 'Cancelled',
  [InstallmentStatus.ADJUSTED]: 'Adjusted',
};

export function formatMoney(value: string | number): string {
  const num = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(num)) return '₹0';
  return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
