import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/apiClient';
import { AgreementTemplateKey, LoanStatus, StaffRole, SupportAttachmentInput, SupportTicketStatus } from '@sptc/shared';

// ---------------------------------------------------------------------
// Sessions / devices
// ---------------------------------------------------------------------
export function useStaffDevices() {
  return useQuery({
    queryKey: ['auth', 'devices'],
    queryFn: () => apiClient.staffAuth.listDevices(),
  });
}

export function useLogoutOtherDevices() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.staffAuth.logoutOtherDevices(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['auth', 'devices'] }),
  });
}

// ---------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------
/** Empty query returns the branch's most recently created customers (see backend CustomersService.search). */
export function useCustomerSearch(query: string) {
  return useQuery({
    queryKey: ['customers', 'search', query],
    queryFn: () => apiClient.customers.search(query),
  });
}

export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: ['customers', 'detail', id],
    queryFn: () => apiClient.customers.getById(id!),
    enabled: Boolean(id),
    refetchInterval: 20_000,
  });
}

export function useRepaymentProfile(customerId: string | undefined) {
  return useQuery({
    queryKey: ['customers', 'repayment-profile', customerId],
    queryFn: () => apiClient.customers.repaymentProfile(customerId!),
    enabled: Boolean(customerId),
  });
}

export function useCustomerLoans(customerId: string | undefined) {
  return useQuery({
    queryKey: ['loans', 'byCustomer', customerId],
    queryFn: () => apiClient.loans.list({ customerId }),
    enabled: Boolean(customerId),
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: apiClient.customers.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers'] }),
  });
}

export function useUpdateCustomer(customerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: Parameters<typeof apiClient.customers.update>[1]) => apiClient.customers.update(customerId, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customers', 'detail', customerId] });
    },
  });
}

export function useDeleteCustomer(customerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ currentPassword, reason }: { currentPassword: string; reason?: string }) =>
      apiClient.customers.delete(customerId, currentPassword, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers'] }),
  });
}

export function useCustomerKyc(customerId: string) {
  return useQuery({
    queryKey: ['kyc', customerId],
    queryFn: () => apiClient.kyc.listForCustomer(customerId),
  });
}

export function useSubmitKyc(customerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: { documentType: string; maskedIdentifier: string; documentRef: string }) =>
      apiClient.kyc.submit(customerId, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kyc', customerId] });
      queryClient.invalidateQueries({ queryKey: ['customers', 'detail', customerId] });
    },
  });
}

export function useVerifyKyc(customerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ recordId, decision, rejectionReason }: { recordId: string; decision: 'VERIFIED' | 'REJECTED'; rejectionReason?: string }) =>
      apiClient.kyc.verify(recordId, decision, rejectionReason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kyc', customerId] });
      queryClient.invalidateQueries({ queryKey: ['customers', 'detail', customerId] });
    },
  });
}

export function useCustomerSummary(customerId: string | undefined) {
  return useQuery({
    queryKey: ['customers', 'summary', customerId],
    queryFn: () => apiClient.customers.summary(customerId!),
    enabled: Boolean(customerId),
    refetchInterval: 20_000,
  });
}

/** Presigns an R2 upload then PUTs the file directly to storage, returning the public URL to save on the record. */
export function useUploadFile() {
  return useMutation({
    mutationFn: async ({
      uri,
      contentType,
      purpose,
    }: {
      uri: string;
      contentType: string;
      purpose: 'customer-photo' | 'reference-photo' | 'kyc-document';
    }) => {
      const { uploadUrl, publicUrl } = await apiClient.uploads.presign(purpose, contentType);
      const file = await fetch(uri);
      const blob = await file.blob();
      const putResponse = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: blob });
      if (!putResponse.ok) throw new Error('Upload failed. Please try again.');
      return publicUrl;
    },
  });
}

// ---------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------
export function useProducts() {
  return useQuery({ queryKey: ['products'], queryFn: () => apiClient.products.list() });
}

export function useIdentifierSearch(query: string) {
  return useQuery({
    queryKey: ['products', 'identifiers', query],
    queryFn: () => apiClient.products.searchIdentifiers(query),
    enabled: query.trim().length > 2,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: apiClient.products.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useAddIdentifier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, dto }: { productId: string; dto: { imei1?: string; imei2?: string; serialNumber?: string } }) =>
      apiClient.products.addIdentifier(productId, dto),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
  });
}

// ---------------------------------------------------------------------
// Loan products
// ---------------------------------------------------------------------
export function useLoanProducts() {
  return useQuery({ queryKey: ['loan-products'], queryFn: () => apiClient.loanProducts.list({ all: true }) });
}

// ---------------------------------------------------------------------
// Loans
// ---------------------------------------------------------------------
export function useLoans(filters?: { status?: LoanStatus; customerId?: string }) {
  return useQuery({
    queryKey: ['loans', 'list', filters],
    queryFn: () => apiClient.loans.list(filters),
  });
}

export function useLoan(id: string | undefined) {
  return useQuery({
    queryKey: ['loans', 'detail', id],
    queryFn: () => apiClient.loans.getById(id!),
    enabled: Boolean(id),
    refetchInterval: 20_000,
  });
}

export function useRescheduleInstallment(loanId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ installmentId, newDueDate, reason }: { installmentId: string; newDueDate: string; reason: string }) =>
      apiClient.loans.rescheduleInstallment(loanId, installmentId, newDueDate, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['loans', 'detail', loanId] }),
  });
}

export function useApplyPenalty(loanId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ installmentId, amount, reason }: { installmentId: string; amount: number; reason: string }) =>
      apiClient.loans.applyPenalty(loanId, installmentId, amount, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['loans', 'detail', loanId] }),
  });
}

export function useNotifyOverdue(loanId: string) {
  return useMutation({
    mutationFn: (installmentId: string) => apiClient.loans.notifyOverdue(loanId, installmentId),
  });
}

export function useLoanPreview(dto: {
  loanProductVersionId?: string;
  cashPrice: number;
  downPaymentAmount: number;
  numberOfInstallments: number;
  manualInterestAmount?: number;
}) {
  return useQuery({
    queryKey: ['loans', 'preview', dto],
    queryFn: () =>
      apiClient.loans.preview({
        loanProductVersionId: dto.loanProductVersionId!,
        cashPrice: dto.cashPrice,
        downPaymentAmount: dto.downPaymentAmount,
        numberOfInstallments: dto.numberOfInstallments,
        manualInterestAmount: dto.manualInterestAmount,
      }),
    enabled: Boolean(dto.loanProductVersionId) && dto.cashPrice > 0 && dto.numberOfInstallments > 0,
  });
}

export function useCreateLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: apiClient.loans.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['loans'] }),
  });
}

export function useDecideLoan(loanId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ decision, reason }: { decision: 'APPROVED' | 'DECLINED' | 'MANUAL_REVIEW'; reason?: string }) =>
      apiClient.loans.decide(loanId, decision, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['loans', 'detail', loanId] });
    },
  });
}

// ---------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------
export function useAllocationPreview(loanId: string | undefined, amount: number) {
  return useQuery({
    queryKey: ['payments', 'preview', loanId, amount],
    queryFn: () => apiClient.payments.previewAllocation(loanId!, amount),
    enabled: Boolean(loanId) && amount > 0,
  });
}

export function useCollectPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: apiClient.payments.collect,
    onSuccess: (data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['loans', 'detail', vars.loanId] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      queryClient.invalidateQueries({ queryKey: ['customers', 'summary', data.payment.customerId] });
    },
  });
}

// ---------------------------------------------------------------------
// Receipts
// ---------------------------------------------------------------------
export function useReceipt(id: string | undefined) {
  return useQuery({
    queryKey: ['receipts', 'detail', id],
    queryFn: () => apiClient.receipts.getById(id!),
    enabled: Boolean(id),
  });
}

export function useCustomerReceipts(customerId: string | undefined) {
  return useQuery({
    queryKey: ['receipts', 'byCustomer', customerId],
    queryFn: () => apiClient.receipts.listForCustomer(customerId!),
    enabled: Boolean(customerId),
  });
}

export function useReversePayment() {
  return useMutation({
    mutationFn: ({ paymentId, reason }: { paymentId: string; reason: string }) => apiClient.payments.reverse(paymentId, reason),
  });
}

// ---------------------------------------------------------------------
// Agreements
// ---------------------------------------------------------------------
export function useActiveAgreementTemplate(key: AgreementTemplateKey) {
  return useQuery({
    queryKey: ['agreement-templates', key, 'active'],
    queryFn: () => apiClient.agreementTemplates.getActive(key),
    retry: false,
  });
}

export function useAgreementTemplateVersions(key: AgreementTemplateKey) {
  return useQuery({
    queryKey: ['agreement-templates', key, 'versions'],
    queryFn: () => apiClient.agreementTemplates.listVersions(key),
  });
}

export function usePublishAgreementTemplate(key: AgreementTemplateKey) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: { title: string; content: string }) => apiClient.agreementTemplates.publish(key, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agreement-templates', key] });
    },
  });
}

export function useUpdateLoanAgreement(loanId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: { documentRef?: string; termsSnapshot?: Record<string, unknown> }) =>
      apiClient.loanAgreements.update(loanId, dto),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['loans', 'detail', loanId] }),
  });
}

// ---------------------------------------------------------------------
// Support
// ---------------------------------------------------------------------
export function useStaffSupportTickets(filters?: { status?: SupportTicketStatus; assignedToMe?: boolean }) {
  return useQuery({
    queryKey: ['support', 'tickets', filters],
    queryFn: () => apiClient.support.list(filters),
    refetchInterval: 15_000,
  });
}

export function useStaffSupportTicket(id: string | undefined) {
  return useQuery({
    queryKey: ['support', 'ticket', id],
    queryFn: () => apiClient.support.getById(id!),
    enabled: Boolean(id),
    refetchInterval: 5_000,
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

export function useStaffAddMessage(ticketId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ message, attachment }: { message: string; attachment?: SupportAttachmentInput }) =>
      apiClient.support.addMessage(ticketId, message, attachment),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['support', 'ticket', ticketId] }),
  });
}

export function useEscalateTicket(ticketId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) => apiClient.support.escalate(ticketId, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['support'] }),
  });
}

export function useUpdateTicketStatus(ticketId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (status: SupportTicketStatus) => apiClient.support.updateStatus(ticketId, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['support'] }),
  });
}

export function useApproveTicket(ticketId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.support.approve(ticketId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['support'] }),
  });
}

// ---------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------
export function useDailyCollection(query?: Record<string, string>) {
  return useQuery({
    queryKey: ['reports', 'daily-collection', query],
    queryFn: () => apiClient.reports.dailyCollection(query),
    refetchInterval: 30_000,
  });
}

export function useLoanPortfolio() {
  return useQuery({ queryKey: ['reports', 'loan-portfolio'], queryFn: () => apiClient.reports.loanPortfolio(), refetchInterval: 30_000 });
}

export function useOverdueAging() {
  return useQuery({ queryKey: ['reports', 'overdue-aging'], queryFn: () => apiClient.reports.overdueAging(), refetchInterval: 30_000 });
}

export function useEmiDueToday() {
  const today = new Date().toISOString().slice(0, 10);
  return useQuery({
    queryKey: ['reports', 'emi-due', today],
    queryFn: () => apiClient.reports.emiDue({ fromDate: today, toDate: today }),
    refetchInterval: 30_000,
  });
}

export function useStaffPerformance() {
  return useQuery({ queryKey: ['reports', 'staff-performance'], queryFn: () => apiClient.reports.staffPerformance() });
}

export function useCustomerLedger(customerId: string | undefined) {
  return useQuery({
    queryKey: ['reports', 'customer-ledger', customerId],
    queryFn: () => apiClient.reports.customerLedger(customerId!),
    enabled: Boolean(customerId),
  });
}

export function useAuditLog(query?: Record<string, string>) {
  return useQuery({
    queryKey: ['reports', 'audit', query],
    queryFn: () => apiClient.reports.auditReport(query),
  });
}

export function usePaymentReconciliation() {
  return useQuery({
    queryKey: ['reports', 'payment-reconciliation'],
    queryFn: () => apiClient.reports.paymentReconciliation(),
  });
}

// ---------------------------------------------------------------------
// Staff management (SUPER_ADMIN only)
// ---------------------------------------------------------------------
export function useStaffAccounts() {
  return useQuery({ queryKey: ['staff'], queryFn: () => apiClient.staff.list() });
}

export function useCreateStaffAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: { name: string; mobile: string; email?: string; password: string; role: StaffRole; branchId?: string }) =>
      apiClient.staff.create(dto),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staff'] }),
  });
}

export function useApproveStaffAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.staff.approve(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staff'] }),
  });
}

export function useRejectStaffAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => apiClient.staff.reject(id, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staff'] }),
  });
}
