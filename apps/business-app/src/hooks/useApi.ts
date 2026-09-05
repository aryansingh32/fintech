import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/apiClient';
import { LoanStatus, SupportTicketStatus } from '@sptc/shared';

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
  return useQuery({ queryKey: ['loan-products'], queryFn: () => apiClient.loanProducts.list() });
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
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['loans', 'detail', vars.loanId] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

export function useReversePayment() {
  return useMutation({
    mutationFn: ({ paymentId, reason }: { paymentId: string; reason: string }) => apiClient.payments.reverse(paymentId, reason),
  });
}

// ---------------------------------------------------------------------
// Support
// ---------------------------------------------------------------------
export function useStaffSupportTickets(filters?: { status?: SupportTicketStatus; assignedToMe?: boolean }) {
  return useQuery({
    queryKey: ['support', 'tickets', filters],
    queryFn: () => apiClient.support.list(filters),
  });
}

export function useStaffSupportTicket(id: string | undefined) {
  return useQuery({
    queryKey: ['support', 'ticket', id],
    queryFn: () => apiClient.support.getById(id!),
    enabled: Boolean(id),
    refetchInterval: 15_000,
  });
}

export function useStaffAddMessage(ticketId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (message: string) => apiClient.support.addMessage(ticketId, message),
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

// ---------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------
export function useDailyCollection(query?: Record<string, string>) {
  return useQuery({ queryKey: ['reports', 'daily-collection', query], queryFn: () => apiClient.reports.dailyCollection(query) });
}

export function useLoanPortfolio() {
  return useQuery({ queryKey: ['reports', 'loan-portfolio'], queryFn: () => apiClient.reports.loanPortfolio() });
}

export function useOverdueAging() {
  return useQuery({ queryKey: ['reports', 'overdue-aging'], queryFn: () => apiClient.reports.overdueAging() });
}

export function useEmiDueToday() {
  const today = new Date().toISOString().slice(0, 10);
  return useQuery({
    queryKey: ['reports', 'emi-due', today],
    queryFn: () => apiClient.reports.emiDue({ fromDate: today, toDate: today }),
  });
}

export function useStaffPerformance() {
  return useQuery({ queryKey: ['reports', 'staff-performance'], queryFn: () => apiClient.reports.staffPerformance() });
}

export function usePaymentReconciliation() {
  return useQuery({
    queryKey: ['reports', 'payment-reconciliation'],
    queryFn: () => apiClient.reports.paymentReconciliation(),
  });
}
