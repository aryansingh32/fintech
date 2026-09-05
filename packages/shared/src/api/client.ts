import { ApiError, ApiErrorBody, DeviceInfo, IssuedTokens } from '../types/api';
import {
  AllocationComponent,
  LoanStatus,
  PaymentMethod,
  SupportCategory,
  SupportTicketStatus,
} from '../types/enums';
import {
  AllocationPreview,
  AppNotification,
  AuditEvent,
  Customer,
  CustomerListItem,
  CustomerSummary,
  DeviceSession,
  GatewayOrder,
  Installment,
  LedgerEntry,
  Loan,
  LoanProduct,
  LoanProductVersion,
  LoanSchedulePreview,
  OverdueAgingRow,
  Payment,
  Product,
  ProductIdentifier,
  Receipt,
  RepaymentProfile,
  SupportTicket,
} from '../types/models';

export type IdentityDomain = 'customer' | 'staff';

export interface ApiClientConfig {
  baseUrl: string;
  domain: IdentityDomain;
  getAccessToken: () => Promise<string | null>;
  getRefreshToken: () => Promise<string | null>;
  onTokensRefreshed: (tokens: IssuedTokens) => Promise<void>;
  /** Called when the refresh token itself is rejected - the caller should clear storage and route to login. */
  onAuthFailure: () => Promise<void>;
}

interface RequestOptions {
  auth?: boolean; // default true
  query?: Record<string, string | number | boolean | undefined>;
}

/** Client-side unique id, sufficient for payment idempotency keys - does not need to be cryptographically random, only unique per request. */
export function generateIdempotencyKey(): string {
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export function generateClientTransactionId(): string {
  return `ctx-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Thin typed wrapper over the SPTC Finance REST API. Framework-agnostic (no
 * AsyncStorage/SecureStore import here) - token persistence is injected by
 * the app via the getAccessToken/getRefreshToken/onTokensRefreshed
 * callbacks, so this file works the same in the Customer App and Business
 * App despite their different storage choices.
 */
export class ApiClient {
  constructor(private readonly config: ApiClientConfig) {}

  /**
   * De-dupes concurrent refresh attempts. The backend rotates the refresh
   * token on every use (single-use, prevents replay of a stolen token) -
   * without this, two requests that both hit a 401 around the same moment
   * (very plausible with several screens polling on refetchInterval) would
   * each call /token/refresh with the same old token; whichever loses the
   * race gets "session not found" for a token that was actually still
   * good, and is force-logged-out even though the session is fine. Sharing
   * one in-flight promise means only one network refresh ever happens per
   * expiry, and every caller waiting on a 401 gets its result.
   */
  private refreshPromise: Promise<IssuedTokens | null> | null = null;

  private async request<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown,
    options: RequestOptions = {},
  ): Promise<T> {
    const auth = options.auth ?? true;
    const url = this.buildUrl(path, options.query);

    const doFetch = async (accessToken: string | null): Promise<Response> => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;
      return fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    };

    let accessToken = auth ? await this.config.getAccessToken() : null;
    let response = await doFetch(accessToken);

    if (auth && response.status === 401) {
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        accessToken = refreshed.accessToken;
        response = await doFetch(accessToken);
      }
    }

    if (!response.ok) {
      let errorBody: ApiErrorBody['error'] = { code: 'ERROR', message: 'Something went wrong. Please try again.' };
      try {
        const parsed = (await response.json()) as ApiErrorBody;
        if (parsed?.error) errorBody = parsed.error;
      } catch {
        // Response body wasn't JSON (e.g. a proxy error page) - fall back to the generic message above.
      }
      throw new ApiError(response.status, errorBody);
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  private tryRefresh(): Promise<IssuedTokens | null> {
    if (!this.refreshPromise) {
      this.refreshPromise = this.performRefresh().finally(() => {
        this.refreshPromise = null;
      });
    }
    return this.refreshPromise;
  }

  private async performRefresh(): Promise<IssuedTokens | null> {
    const refreshToken = await this.config.getRefreshToken();
    if (!refreshToken) {
      await this.config.onAuthFailure();
      return null;
    }
    try {
      const path = `/auth/${this.config.domain}/token/refresh`;
      const response = await fetch(this.buildUrl(path), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!response.ok) throw new Error('refresh failed');
      const tokens = (await response.json()) as IssuedTokens;
      await this.config.onTokensRefreshed(tokens);
      return tokens;
    } catch {
      await this.config.onAuthFailure();
      return null;
    }
  }

  private buildUrl(path: string, query?: RequestOptions['query']): string {
    const base = this.config.baseUrl.replace(/\/$/, '');
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(`${base}/v1${normalizedPath}`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) url.searchParams.set(key, String(value));
      }
    }
    return url.toString();
  }

  // ---------------------------------------------------------------------
  // Customer auth
  // ---------------------------------------------------------------------
  customerAuth = {
    requestOtp: (mobile: string) =>
      this.request<{ requestId: string; expiresAt: string; devOtp?: string }>(
        'POST',
        '/auth/customer/otp/request',
        { mobile },
        { auth: false },
      ),
    verifyOtp: (mobile: string, otp: string, device: DeviceInfo) =>
      this.request<IssuedTokens & { customerId: string; pinSetupRequired: boolean }>(
        'POST',
        '/auth/customer/otp/verify',
        { mobile, otp, device },
        { auth: false },
      ),
    pinLogin: (mobile: string, pin: string, device: DeviceInfo) =>
      this.request<IssuedTokens & { customerId: string }>(
        'POST',
        '/auth/customer/pin/login',
        { mobile, pin, device },
        { auth: false },
      ),
    setPin: (pin: string) => this.request<{ success: true }>('POST', '/auth/customer/pin/set', { pin }),
    logout: () => this.request<{ success: true }>('POST', '/auth/customer/logout'),
    logoutOtherDevices: () =>
      this.request<{ success: true; revokedSessions: number }>('POST', '/auth/customer/logout-other-devices'),
    listDevices: () => this.request<DeviceSession[]>('GET', '/auth/customer/devices'),
    revokeDevice: (sessionId: string) =>
      this.request<{ success: true }>('DELETE', `/auth/customer/devices/${sessionId}`),
  };

  // ---------------------------------------------------------------------
  // Staff auth
  // ---------------------------------------------------------------------
  staffAuth = {
    login: (mobile: string, password: string, device: DeviceInfo) =>
      this.request<
        | { status: 'DEVICE_VERIFICATION_REQUIRED'; requestId: string; devOtp?: string }
        | (IssuedTokens & { status: 'SUCCESS'; staffUserId: string })
      >('POST', '/auth/staff/login', { mobile, password, device }, { auth: false }),
    verifyDevice: (mobile: string, otp: string, device: DeviceInfo) =>
      this.request<IssuedTokens & { status: 'SUCCESS'; staffUserId: string }>(
        'POST',
        '/auth/staff/device/verify',
        { mobile, otp, device },
        { auth: false },
      ),
    logout: () => this.request<{ success: true }>('POST', '/auth/staff/logout'),
    logoutOtherDevices: () =>
      this.request<{ success: true; revokedSessions: number }>('POST', '/auth/staff/logout-other-devices'),
    listDevices: () => this.request<DeviceSession[]>('GET', '/auth/staff/devices'),
  };

  // ---------------------------------------------------------------------
  // Customers (staff-side)
  // ---------------------------------------------------------------------
  customers = {
    create: (dto: {
      mobile: string;
      name: string;
      email?: string;
      addressLine1?: string;
      addressLine2?: string;
      city?: string;
      state?: string;
      pincode?: string;
      photoUrl?: string;
      referenceName?: string;
      referenceMobile?: string;
      referencePhotoUrl?: string;
    }) => this.request<Customer>('POST', '/customers', dto),
    update: (
      id: string,
      dto: Partial<{
        name: string;
        email: string;
        addressLine1: string;
        addressLine2: string;
        city: string;
        state: string;
        pincode: string;
        photoUrl: string;
        referenceName: string;
        referenceMobile: string;
        referencePhotoUrl: string;
      }>,
    ) => this.request<Customer>('PATCH', `/customers/${id}`, dto),
    search: (query: string) => this.request<CustomerListItem[]>('GET', '/customers', undefined, { query: { q: query } }),
    delete: (id: string, currentPassword: string, reason?: string) =>
      this.request<{ mode: 'deleted' | 'deactivated' }>('DELETE', `/customers/${id}`, { currentPassword, reason }),
    getById: (id: string) => this.request<Customer>('GET', `/customers/${id}`),
    repaymentProfile: (id: string) => this.request<RepaymentProfile>('GET', `/customers/${id}/repayment-profile`),
    summary: (id: string) => this.request<CustomerSummary>('GET', `/customers/${id}/summary`),
    addNote: (id: string, note: string) => this.request<{ id: string }>('POST', `/customers/${id}/notes`, { note }),
  };

  // ---------------------------------------------------------------------
  // My profile (Customer App)
  // ---------------------------------------------------------------------
  myProfile = {
    get: () => this.request<Customer>('GET', '/customers/me'),
  };

  // ---------------------------------------------------------------------
  // Products / IMEI
  // ---------------------------------------------------------------------
  products = {
    create: (dto: {
      brand: string;
      model: string;
      category: string;
      sku: string;
      purchasePrice: number;
      sellingPrice: number;
      financePrice: number;
      warrantyMonths?: number;
    }) => this.request<Product>('POST', '/products', dto),
    list: () => this.request<Product[]>('GET', '/products'),
    searchIdentifiers: (query: string) =>
      this.request<ProductIdentifier[]>('GET', '/products/identifiers/search', undefined, { query: { q: query } }),
    addIdentifier: (productId: string, dto: { imei1?: string; imei2?: string; serialNumber?: string }) =>
      this.request<ProductIdentifier>('POST', `/products/${productId}/identifiers`, dto),
  };

  // ---------------------------------------------------------------------
  // Loan products
  // ---------------------------------------------------------------------
  loanProducts = {
    create: (dto: { name: string; description?: string }) =>
      this.request<LoanProduct>('POST', '/loan-products', dto),
    list: () => this.request<LoanProduct[]>('GET', '/loan-products'),
    createVersion: (loanProductId: string, dto: Record<string, unknown>) =>
      this.request<LoanProductVersion>('POST', `/loan-products/${loanProductId}/versions`, dto),
  };

  // ---------------------------------------------------------------------
  // Loans
  // ---------------------------------------------------------------------
  loans = {
    create: (dto: {
      customerId: string;
      productIdentifierId?: string;
      loanProductVersionId: string;
      cashPrice: number;
      downPaymentAmount: number;
      pendingUdhaarAmount?: number;
      numberOfInstallments: number;
      startDate?: string;
    }) => this.request<Loan>('POST', '/loans', dto),
    preview: (dto: {
      loanProductVersionId: string;
      cashPrice: number;
      downPaymentAmount: number;
      numberOfInstallments: number;
      startDate?: string;
    }) => this.request<LoanSchedulePreview>('POST', '/loans/preview', dto),
    list: (filters?: { status?: LoanStatus; customerId?: string }) =>
      this.request<Loan[]>('GET', '/loans', undefined, { query: filters }),
    getById: (id: string) => this.request<Loan>('GET', `/loans/${id}`),
    decide: (id: string, decision: 'APPROVED' | 'DECLINED' | 'MANUAL_REVIEW', reason?: string) =>
      this.request<Loan>('POST', `/loans/${id}/decision`, { decision, reason }),
    rescheduleInstallment: (loanId: string, installmentId: string, newDueDate: string, reason: string) =>
      this.request<Installment>('PATCH', `/loans/${loanId}/installments/${installmentId}/reschedule`, {
        newDueDate,
        reason,
      }),
  };

  // ---------------------------------------------------------------------
  // Customer's own loans (Customer App)
  // ---------------------------------------------------------------------
  myLoans = {
    list: () => this.request<Loan[]>('GET', '/loans/me'),
    getById: (id: string) => this.request<Loan>('GET', `/loans/me/${id}`),
  };

  // ---------------------------------------------------------------------
  // Receipts
  // ---------------------------------------------------------------------
  receipts = {
    listMine: () => this.request<Receipt[]>('GET', '/receipts/me'),
    listForLoan: (loanId: string) => this.request<Receipt[]>('GET', `/receipts/loan/${loanId}`),
    listForCustomer: (customerId: string) => this.request<Receipt[]>('GET', `/receipts/customer/${customerId}`),
    getById: (id: string) => this.request<Receipt>('GET', `/receipts/${id}`),
  };

  // ---------------------------------------------------------------------
  // File uploads (Cloudflare R2, direct-to-storage presigned PUT)
  // ---------------------------------------------------------------------
  uploads = {
    presign: (purpose: 'customer-photo' | 'reference-photo' | 'kyc-document', contentType: string) =>
      this.request<{ uploadUrl: string; publicUrl: string; key: string }>('POST', '/uploads/presign', {
        purpose,
        contentType,
      }),
  };

  // ---------------------------------------------------------------------
  // KYC
  // ---------------------------------------------------------------------
  kyc = {
    myRecords: () => this.request<import('../types/models').KYCRecord[]>('GET', '/kyc/me'),
    listForCustomer: (customerId: string) =>
      this.request<import('../types/models').KYCRecord[]>('GET', `/kyc/customers/${customerId}/records`),
    submit: (
      customerId: string,
      dto: { documentType: string; maskedIdentifier: string; documentRef: string },
    ) => this.request<import('../types/models').KYCRecord>('POST', `/kyc/customers/${customerId}/records`, dto),
    verify: (recordId: string, decision: 'VERIFIED' | 'REJECTED', rejectionReason?: string) =>
      this.request<import('../types/models').KYCRecord>('POST', `/kyc/records/${recordId}/verify`, {
        decision,
        rejectionReason,
      }),
  };

  // ---------------------------------------------------------------------
  // Payments
  // ---------------------------------------------------------------------
  payments = {
    previewAllocation: (loanId: string, amount: number) =>
      this.request<AllocationPreview>('GET', `/payments/loans/${loanId}/allocation-preview`, undefined, {
        query: { amount },
      }),
    /** Opens a checkout session. Fails closed (throws ApiError) when no gateway is configured - see backend PaymentsService.initiateCustomerPayment. */
    customerInitiate: (loanId: string, amount: number) =>
      this.request<GatewayOrder>('POST', '/payments/customer-initiate', { loanId, amount }),
    /** Verifies the checkout SDK's signed callback and posts the payment through the same path a staff collection uses. */
    customerConfirm: (dto: {
      loanId: string;
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
      amount: number;
    }) =>
      this.request<{ payment: Payment; receipt: Receipt; idempotentReplay: boolean }>(
        'POST',
        '/payments/customer-confirm',
        dto,
      ),
    collect: (dto: {
      loanId: string;
      amount: number;
      method: PaymentMethod;
      referenceId?: string;
      idempotencyKey: string;
      allocation?: { component: AllocationComponent; installmentId?: string; amount: number }[];
      clientTransactionId?: string;
    }) =>
      this.request<{ payment: Payment; receipt: Receipt; idempotentReplay: boolean }>(
        'POST',
        '/payments/collect',
        dto,
      ),
    reverse: (paymentId: string, reason: string) =>
      this.request<{ id: string; originalPaymentId: string }>('POST', `/payments/${paymentId}/reverse`, { reason }),
  };

  // ---------------------------------------------------------------------
  // Support
  // ---------------------------------------------------------------------
  support = {
    createTicket: (category: SupportCategory, message: string) =>
      this.request<SupportTicket>('POST', '/support/tickets', { category, message }),
    list: (filters?: { status?: SupportTicketStatus; assignedToMe?: boolean }) =>
      this.request<SupportTicket[]>('GET', '/support/tickets', undefined, {
        query: { status: filters?.status, assignedToMe: filters?.assignedToMe },
      }),
    getById: (id: string) => this.request<SupportTicket>('GET', `/support/tickets/${id}`),
    addMessage: (id: string, message: string) =>
      this.request<{ id: string }>('POST', `/support/tickets/${id}/messages`, { message }),
    assign: (id: string, staffId: string) =>
      this.request<SupportTicket>('POST', `/support/tickets/${id}/assign`, { staffId }),
    escalate: (id: string, reason: string) =>
      this.request<SupportTicket>('POST', `/support/tickets/${id}/escalate`, { reason }),
    updateStatus: (id: string, status: SupportTicketStatus) =>
      this.request<SupportTicket>('POST', `/support/tickets/${id}/status`, { status }),
  };

  // ---------------------------------------------------------------------
  // Reports (Business App only)
  // ---------------------------------------------------------------------
  reports = {
    dailyCollection: (query?: Record<string, string>) =>
      this.request<{ total: string; count: number; payments: Payment[] }>('GET', '/reports/daily-collection', undefined, {
        query,
      }),
    outstanding: (query?: Record<string, string>) =>
      this.request<{ total: string; count: number; rows: unknown[] }>('GET', '/reports/outstanding', undefined, {
        query,
      }),
    overdueAging: (query?: Record<string, string>) =>
      this.request<Record<'1-7' | '8-30' | '31-60' | '60+', OverdueAgingRow[]>>(
        'GET',
        '/reports/overdue-aging',
        undefined,
        { query },
      ),
    emiDue: (query?: Record<string, string>) => this.request<unknown[]>('GET', '/reports/emi-due', undefined, { query }),
    customerLedger: (customerId: string) =>
      this.request<LedgerEntry[]>('GET', `/reports/customer-ledger/${customerId}`),
    loanPortfolio: (query?: Record<string, string>) =>
      this.request<{ status: string; count: number; totalPayable: string }[]>(
        'GET',
        '/reports/loan-portfolio',
        undefined,
        { query },
      ),
    productFinance: (query?: Record<string, string>) =>
      this.request<unknown[]>('GET', '/reports/product-finance', undefined, { query }),
    staffPerformance: (query?: Record<string, string>) =>
      this.request<unknown[]>('GET', '/reports/staff-performance', undefined, { query }),
    paymentReconciliation: (query?: Record<string, string>) =>
      this.request<unknown[]>('GET', '/reports/payment-reconciliation', undefined, { query }),
    auditReport: (query?: Record<string, string>) =>
      this.request<{ restricted: true; events: never[] } | AuditEvent[]>('GET', '/reports/audit', undefined, { query }),
  };

  // ---------------------------------------------------------------------
  // Offline sync (Business App only)
  // ---------------------------------------------------------------------
  sync = {
    syncPayments: (
      payments: {
        loanId: string;
        amount: number;
        method: PaymentMethod;
        referenceId?: string;
        clientTransactionId: string;
        allocation?: { component: AllocationComponent; installmentId?: string; amount: number }[];
      }[],
    ) =>
      this.request<
        { clientTransactionId: string; status: 'SYNCED' | 'ALREADY_SYNCED' | 'FAILED'; paymentId?: string; error?: string }[]
      >('POST', '/sync/payments/batch', {
        payments: payments.map((p) => ({ ...p, idempotencyKey: generateIdempotencyKey() })),
      }),
    pull: (since?: string) =>
      this.request<{ syncedAt: string; customers: Customer[]; loans: Loan[] }>('GET', '/sync/pull', undefined, {
        query: { since },
      }),
  };

  // ---------------------------------------------------------------------
  // Notifications
  // ---------------------------------------------------------------------
  notifications = {
    list: () => this.request<AppNotification[]>('GET', '/notifications'),
  };
}
