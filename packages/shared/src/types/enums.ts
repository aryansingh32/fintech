/**
 * Mirrors apps/backend/prisma/schema.prisma enums exactly. Keep these two
 * files in sync by hand - there is no build step that generates one from
 * the other, so any enum added/renamed in the schema must be updated here
 * too, or the mobile apps will silently mis-render values the API sends.
 */

export enum StaffRole {
  OWNER = 'OWNER',
  MANAGER = 'MANAGER',
  SHOPKEEPER = 'SHOPKEEPER',
  COLLECTION_AGENT = 'COLLECTION_AGENT',
  SUPPORT_AGENT = 'SUPPORT_AGENT',
}

export enum KycStatus {
  NOT_STARTED = 'NOT_STARTED',
  PENDING = 'PENDING',
  SUBMITTED = 'SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
}

export enum KycDocumentType {
  AADHAAR = 'AADHAAR',
  PAN = 'PAN',
  VOTER_ID = 'VOTER_ID',
  DRIVING_LICENSE = 'DRIVING_LICENSE',
  PASSPORT = 'PASSPORT',
  UTILITY_BILL = 'UTILITY_BILL',
  OTHER = 'OTHER',
}

export enum ProductIdentifierStatus {
  INVENTORY = 'INVENTORY',
  RESERVED = 'RESERVED',
  FINANCED = 'FINANCED',
  PAID_OFF = 'PAID_OFF',
  RETURNED = 'RETURNED',
  EXCHANGED = 'EXCHANGED',
  OTHER = 'OTHER',
}

export enum InstallmentFrequency {
  WEEKLY = 'WEEKLY',
  BIWEEKLY = 'BIWEEKLY',
  MONTHLY = 'MONTHLY',
}

export enum LoanStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  DECLINED = 'DECLINED',
  CANCELLED = 'CANCELLED',
  DEFAULTED = 'DEFAULTED',
  SETTLED = 'SETTLED',
}

export enum InstallmentStatus {
  UPCOMING = 'UPCOMING',
  DUE = 'DUE',
  OVERDUE = 'OVERDUE',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
  ADJUSTED = 'ADJUSTED',
}

export enum PaymentMethod {
  CASH = 'CASH',
  UPI = 'UPI',
  BANK = 'BANK',
  GATEWAY = 'GATEWAY',
  OTHER = 'OTHER',
}

export enum PaymentStatus {
  INITIATED = 'INITIATED',
  PENDING = 'PENDING',
  SUCCESSFUL = 'SUCCESSFUL',
  FAILED = 'FAILED',
  REVERSED = 'REVERSED',
  REFUNDED = 'REFUNDED',
}

export enum PaymentSource {
  CUSTOMER_ONLINE = 'CUSTOMER_ONLINE',
  STAFF_COLLECTED = 'STAFF_COLLECTED',
  OFFLINE_SYNCED = 'OFFLINE_SYNCED',
}

export enum AllocationComponent {
  DOWN_PAYMENT = 'DOWN_PAYMENT',
  EMI_PRINCIPAL = 'EMI_PRINCIPAL',
  EMI_CHARGES = 'EMI_CHARGES',
  OVERDUE_PENALTY = 'OVERDUE_PENALTY',
  FEE = 'FEE',
  OTHER = 'OTHER',
}

export enum SupportCategory {
  PAYMENT = 'PAYMENT',
  EMI = 'EMI',
  RECEIPT = 'RECEIPT',
  LOAN = 'LOAN',
  KYC = 'KYC',
  TECHNICAL_ISSUE = 'TECHNICAL_ISSUE',
  OTHER = 'OTHER',
}

export enum SupportTicketStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  ESCALATED = 'ESCALATED',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

export enum SupportSenderType {
  CUSTOMER = 'CUSTOMER',
  STAFF = 'STAFF',
  SYSTEM = 'SYSTEM',
}

export enum NotificationChannel {
  PUSH = 'PUSH',
  SMS = 'SMS',
  EMAIL = 'EMAIL',
  IN_APP = 'IN_APP',
}

export enum NotificationStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
}
