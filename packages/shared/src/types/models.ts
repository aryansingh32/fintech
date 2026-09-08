import {
  AgreementTemplateKey,
  AllocationComponent,
  InstallmentFrequency,
  InstallmentStatus,
  KycDocumentType,
  KycStatus,
  LoanStatus,
  NotificationChannel,
  NotificationStatus,
  PaymentMethod,
  PaymentSource,
  PaymentStatus,
  ProductIdentifierStatus,
  StaffRole,
  SupportCategory,
  SupportSenderType,
  SupportTicketStatus,
} from './enums';

/**
 * Every money field is a string with exactly 2 decimal places (the backend
 * patches Decimal.prototype.toJSON to guarantee this - see
 * apps/backend/src/common/decimal-serialization.ts). Never parseFloat() a
 * money field for a calculation the user will see as authoritative - only
 * for display formatting. The server is always the source of truth for
 * balances; these types exist to render what it already computed.
 */
export type Money = string;
export type IsoDateString = string;

export interface Customer {
  id: string;
  branchId: string | null;
  customerCode: string;
  mobile: string;
  name: string;
  email?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  photoUrl?: string | null;
  referenceName?: string | null;
  referenceMobile?: string | null;
  referencePhotoUrl?: string | null;
  kycStatus: KycStatus;
  isActive: boolean;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface CustomerLoanSummary {
  loanId: string;
  outstanding: string;
  overdue: string;
}

export interface LedgerEntry {
  id: string;
  customerId: string;
  loanId?: string | null;
  entryType: string;
  debit: Money;
  credit: Money;
  balanceAfter: Money;
  referenceType: string;
  referenceId: string;
  description: string;
  createdAt: IsoDateString;
}

export interface AuditEvent {
  id: string;
  actorType: 'CUSTOMER' | 'STAFF' | 'SYSTEM';
  actorId?: string | null;
  role?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  beforeState?: unknown;
  afterState?: unknown;
  reason?: string | null;
  ipAddress?: string | null;
  deviceId?: string | null;
  sessionId?: string | null;
  createdAt: IsoDateString;
}

export interface CustomerLoanBadges {
  hasActiveLoan: boolean;
  hasOverdueLoan: boolean;
  hasCompletedLoan: boolean;
  hasNoLoans: boolean;
  outstanding: string;
}

export interface CustomerListItem extends Customer {
  loanSummary: CustomerLoanBadges;
}

export interface PreviewInstallment {
  sequence: number;
  dueDate: IsoDateString;
  principalAmount: Money;
  chargesAmount: Money;
  totalAmount: Money;
}

export interface LoanSchedulePreview {
  financedPrincipal: Money;
  financeCharges: Money;
  feesTotal: Money;
  totalPayable: Money;
  installmentAmount: Money;
  numberOfInstallments: number;
  maturityDate: IsoDateString;
  installments: PreviewInstallment[];
}

export interface CustomerSummary {
  totalPaid: string;
  totalOutstanding: string;
  totalOverdue: string;
  nextDue: { loanId: string; installmentId: string; amount: string; dueDate: IsoDateString } | null;
  perLoan: CustomerLoanSummary[];
}

export interface KYCRecord {
  id: string;
  customerId: string;
  documentType: KycDocumentType;
  maskedIdentifier: string;
  documentRef: string;
  status: KycStatus;
  verifiedByStaffId?: string | null;
  verifiedAt?: IsoDateString | null;
  rejectionReason?: string | null;
  expiresAt?: IsoDateString | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface StaffUserSummary {
  id: string;
  name: string;
  mobile: string;
  role: StaffRole;
  branchId: string | null;
  isGlobal: boolean;
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

export interface Product {
  id: string;
  brand: string;
  model: string;
  category: string;
  sku: string;
  purchasePrice: Money;
  sellingPrice: Money;
  financePrice: Money;
  warrantyMonths?: number | null;
  isActive: boolean;
  identifiers?: ProductIdentifier[];
}

export interface ProductIdentifier {
  id: string;
  productId: string;
  imei1?: string | null;
  imei2?: string | null;
  serialNumber?: string | null;
  status: ProductIdentifierStatus;
  loanId?: string | null;
  product?: Product;
}

export interface LoanProductVersion {
  id: string;
  loanProductId: string;
  versionNumber: number;
  interestType: 'FLAT' | 'REDUCING' | 'ZERO_COST';
  interestRateAnnual?: string | null;
  interestBasis?: 'FINANCED_PRINCIPAL' | 'TOTAL_CASH_PRICE';
  minInstallments: number;
  maxInstallments: number;
  installmentFrequency: InstallmentFrequency;
  isActive: boolean;
}

export interface LoanProduct {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  versions?: LoanProductVersion[];
}

export interface Installment {
  id: string;
  loanId: string;
  sequence: number;
  dueDate: IsoDateString;
  principalAmount: Money;
  chargesAmount: Money;
  penaltyAmount?: Money;
  totalAmount: Money;
  paidAmount: Money;
  status: InstallmentStatus;
}

export interface RepaymentProfile {
  score: number | null;
  onTimePaymentRate: number | null;
  completedLoans: number;
  currentOverdueInstallments: number;
  reasons: string[];
  isAdvisoryOnly: true;
}

export interface Agreement {
  id: string;
  loanId: string;
  version: number;
  termsSnapshot: Record<string, unknown>;
  documentRef?: string | null;
  updatedByStaffId?: string | null;
  updatedAt?: IsoDateString | null;
  acceptedByCustomerAt?: IsoDateString | null;
  acceptedIp?: string | null;
  createdAt: IsoDateString;
}

export interface AgreementTemplate {
  id: string;
  key: AgreementTemplateKey;
  version: number;
  title: string;
  content: string;
  isActive: boolean;
  createdByStaffId: string;
  createdAt: IsoDateString;
}

export interface Loan {
  id: string;
  loanNumber: string;
  customerId: string;
  branchId: string;
  productId?: string | null;
  loanProductVersionId: string;
  cashPrice: Money;
  downPaymentAmount: Money;
  downPaymentPaid: Money;
  pendingUdhaarAmount: Money;
  financedPrincipal: Money;
  financeCharges: Money;
  feesTotal: Money;
  totalPayable: Money;
  installmentAmount: Money;
  numberOfInstallments: number;
  installmentFrequency: InstallmentFrequency;
  startDate: IsoDateString;
  maturityDate: IsoDateString;
  status: LoanStatus;
  approvalDecision?: string | null;
  approvalReason?: string | null;
  approvedAt?: IsoDateString | null;
  riskScoreSnapshot?: RepaymentProfile | null;
  createdAt: IsoDateString;
  installments: Installment[];
  productIdentifier?: ProductIdentifier | null;
  customer?: Customer;
  agreement?: Agreement | null;
}

export interface PaymentAllocation {
  id: string;
  paymentId: string;
  component: AllocationComponent;
  installmentId?: string | null;
  amount: Money;
}

export interface Payment {
  id: string;
  paymentNumber: string;
  customerId: string;
  loanId: string;
  amount: Money;
  method: PaymentMethod;
  status: PaymentStatus;
  referenceId?: string | null;
  source: PaymentSource;
  createdAt: IsoDateString;
  confirmedAt?: IsoDateString | null;
  allocations: PaymentAllocation[];
}

export interface Receipt {
  id: string;
  receiptNumber: string;
  paymentId: string;
  customerId: string;
  loanId: string;
  amount: Money;
  previousBalance: Money;
  newBalance: Money;
  collectorLabel: string;
  verificationId: string;
  createdAt: IsoDateString;
}

export interface AllocationPreviewLine {
  component: AllocationComponent;
  installmentId?: string;
  amount: Money;
}

export interface AllocationPreview {
  lines: AllocationPreviewLine[];
}

export interface SupportAttachment {
  id: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
}

export interface SupportMessage {
  id: string;
  ticketId: string;
  senderType: SupportSenderType;
  senderId?: string | null;
  message: string;
  createdAt: IsoDateString;
  attachments?: SupportAttachment[];
}

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  customerId: string;
  category: SupportCategory;
  status: SupportTicketStatus;
  assignedStaffId?: string | null;
  chatApprovedAt?: IsoDateString | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
  messages: SupportMessage[];
  customer?: Customer;
}

export interface StaffAccount {
  id: string;
  name: string;
  mobile: string;
  email?: string | null;
  role: StaffRole;
  isActive: boolean;
  isApproved: boolean;
  isGlobal: boolean;
  branchId?: string | null;
  approvedByStaffId?: string | null;
  approvedAt?: IsoDateString | null;
  createdAt: IsoDateString;
  lastLoginAt?: IsoDateString | null;
}

export interface AppNotification {
  id: string;
  event: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  payload: Record<string, unknown>;
  createdAt: IsoDateString;
  sentAt?: IsoDateString | null;
  readAt?: IsoDateString | null;
}

export interface DeviceSession {
  id: string;
  deviceId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: IsoDateString;
  lastUsedAt: IsoDateString;
  expiresAt: IsoDateString;
  device?: { platform: string; deviceIdentifier: string; lastSeenAt: IsoDateString } | null;
}

export interface GatewayOrder {
  orderId: string;
  keyId: string;
  amount: number; // paise
  currency: string;
}

export interface OverdueAgingRow {
  loanId: string;
  loanNumber: string;
  customerName: string;
  dueDate: IsoDateString;
  daysOverdue: number;
  overdueAmount: Money;
}
