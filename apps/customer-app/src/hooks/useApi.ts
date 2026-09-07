import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/apiClient';
import { AgreementTemplateKey, SupportAttachmentInput, SupportCategory } from '@sptc/shared';

export function useLoanList() {
  return useQuery({
    queryKey: ['loans', 'list'],
    queryFn: () => apiClient.myLoans.list(),
    refetchInterval: 20_000,
  });
}

export function useLoanDetail(loanId: string | undefined) {
  return useQuery({
    queryKey: ['loans', 'detail', loanId],
    queryFn: () => apiClient.myLoans.getById(loanId!),
    enabled: Boolean(loanId),
    refetchInterval: 20_000,
  });
}

export function useReceipts() {
  return useQuery({
    queryKey: ['receipts', 'me'],
    queryFn: () => apiClient.receipts.listMine(),
    refetchInterval: 20_000,
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

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.notifications.markAllRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function useKycStatus() {
  return useQuery({
    queryKey: ['kyc', 'me'],
    queryFn: () => apiClient.kyc.myRecords(),
    refetchInterval: 20_000,
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
    refetchInterval: 15_000,
  });
}

export function useSupportTicket(id: string | undefined) {
  return useQuery({
    queryKey: ['support', 'ticket', id],
    queryFn: () => apiClient.support.getById(id!),
    enabled: Boolean(id),
    refetchInterval: 5_000,
  });
}

export function useCreateSupportTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      category,
      message,
      attachment,
    }: {
      category: SupportCategory;
      message: string;
      attachment?: SupportAttachmentInput;
    }) => apiClient.support.createTicket(category, message, attachment),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['support', 'tickets'] }),
  });
}

/** Presigns an R2 upload then PUTs the file directly to storage, returning the public URL to attach to a support message. */
export function useUploadSupportAttachment() {
  return useMutation({
    mutationFn: async ({ uri, contentType }: { uri: string; contentType: string }) => {
      const { uploadUrl, publicUrl } = await apiClient.uploads.presign('support-attachment', contentType);
      const file = await fetch(uri);
      const blob = await file.blob();
      const putResponse = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: blob });
      if (!putResponse.ok) throw new Error('Upload failed. Please try again.');
      return { url: publicUrl, mimeType: contentType, sizeBytes: blob.size } satisfies SupportAttachmentInput;
    },
  });
}

export function useAddSupportMessage(ticketId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ message, attachment }: { message: string; attachment?: SupportAttachmentInput }) =>
      apiClient.support.addMessage(ticketId, message, attachment),
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

// ---------------------------------------------------------------------
// Agreements / consents
// ---------------------------------------------------------------------
export function useActiveAgreementTemplate(key: AgreementTemplateKey) {
  return useQuery({
    queryKey: ['agreement-templates', key, 'active'],
    queryFn: () => apiClient.agreementTemplates.getActive(key),
    retry: false,
  });
}

export function useMyConsents() {
  return useQuery({
    queryKey: ['consents', 'me'],
    queryFn: () => apiClient.consents.list(),
  });
}

export function useAcceptConsent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ consentType, version }: { consentType: string; version: string }) =>
      apiClient.consents.accept(consentType, version),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['consents', 'me'] }),
  });
}

export function useAcceptLoanAgreement(loanId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.loanAgreements.accept(loanId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['loans', 'detail', loanId] }),
  });
}

