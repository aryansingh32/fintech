import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/apiClient';
import { SupportCategory } from '@sptc/shared';

export function useLoanList() {
  return useQuery({
    queryKey: ['loans', 'list'],
    queryFn: () => apiClient.myLoans.list(),
  });
}

export function useLoanDetail(loanId: string | undefined) {
  return useQuery({
    queryKey: ['loans', 'detail', loanId],
    queryFn: () => apiClient.myLoans.getById(loanId!),
    enabled: Boolean(loanId),
  });
}

export function useReceipts() {
  return useQuery({
    queryKey: ['receipts', 'me'],
    queryFn: () => apiClient.receipts.listMine(),
  });
}

export function useReceiptDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['receipts', 'detail', id],
    queryFn: () => apiClient.receipts.getById(id!),
    enabled: Boolean(id),
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiClient.notifications.list(),
    refetchInterval: 60_000,
  });
}

export function useKycStatus() {
  return useQuery({
    queryKey: ['kyc', 'me'],
    queryFn: () => apiClient.kyc.myRecords(),
  });
}

export function useMyDevices() {
  return useQuery({
    queryKey: ['devices', 'me'],
    queryFn: () => apiClient.customerAuth.listDevices(),
  });
}

export function useSupportTickets() {
  return useQuery({
    queryKey: ['support', 'tickets'],
    queryFn: () => apiClient.support.list(),
  });
}

export function useSupportTicket(id: string | undefined) {
  return useQuery({
    queryKey: ['support', 'ticket', id],
    queryFn: () => apiClient.support.getById(id!),
    enabled: Boolean(id),
    refetchInterval: 15_000,
  });
}

export function useCreateSupportTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ category, message }: { category: SupportCategory; message: string }) =>
      apiClient.support.createTicket(category, message),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['support', 'tickets'] }),
  });
}

export function useAddSupportMessage(ticketId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (message: string) => apiClient.support.addMessage(ticketId, message),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['support', 'ticket', ticketId] }),
  });
}

export function useAllocationPreview(loanId: string | undefined, amount: number) {
  return useQuery({
    queryKey: ['payments', 'preview', loanId, amount],
    queryFn: () => apiClient.payments.previewAllocation(loanId!, amount),
    enabled: Boolean(loanId) && amount > 0,
  });
}

