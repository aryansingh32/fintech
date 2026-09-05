import { StaffRole } from '@prisma/client';

/**
 * Every permission-gated action in the Business App maps to one key here.
 * This is enforced entirely server-side (guards read this table, never the
 * client) so that a modified/rooted client cannot grant itself capability.
 * See blueprint #41 "Backend must reject unauthorized API calls even if
 * someone manipulates the frontend."
 */
export enum Permission {
  BRANCH_MANAGE = 'branch.manage',
  STAFF_MANAGE = 'staff.manage',
  PERMISSION_MANAGE = 'permission.manage',
  LOAN_PRODUCT_MANAGE = 'loan_product.manage',
  SETTINGS_MANAGE = 'settings.manage',
  AUDIT_VIEW = 'audit.view',
  REPORTS_VIEW_ALL_BRANCHES = 'reports.view_all_branches',
  REPORTS_VIEW_BRANCH = 'reports.view_branch',

  CUSTOMER_CREATE = 'customer.create',
  CUSTOMER_VIEW = 'customer.view',
  CUSTOMER_EDIT = 'customer.edit',
  CUSTOMER_DELETE = 'customer.delete',
  CUSTOMER_NOTE_ADD = 'customer.note_add',

  KYC_CAPTURE = 'kyc.capture',
  KYC_VERIFY = 'kyc.verify',

  PRODUCT_MANAGE = 'product.manage',

  LOAN_CREATE = 'loan.create',
  LOAN_VIEW = 'loan.view',
  LOAN_APPROVE = 'loan.approve',
  LOAN_RESCHEDULE = 'loan.reschedule',

  PAYMENT_COLLECT = 'payment.collect',
  PAYMENT_ALLOCATE = 'payment.allocate',
  PAYMENT_VIEW = 'payment.view',
  PAYMENT_REVERSE = 'payment.reverse',
  PAYMENT_WAIVE = 'payment.waive',

  COLLECTION_VIEW_ASSIGNED = 'collection.view_assigned',
  COLLECTION_ASSIGN = 'collection.assign',
  OVERDUE_MANAGE = 'overdue.manage',

  SUPPORT_VIEW = 'support.view',
  SUPPORT_REPLY = 'support.reply',
  SUPPORT_ESCALATE = 'support.escalate',
}

/**
 * Default permission set per role. StaffPermission rows can add/revoke
 * individual keys on top of this without inventing a new role.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<StaffRole, Permission[]> = {
  [StaffRole.OWNER]: Object.values(Permission),
  [StaffRole.MANAGER]: [
    Permission.CUSTOMER_CREATE,
    Permission.CUSTOMER_VIEW,
    Permission.CUSTOMER_EDIT,
    Permission.CUSTOMER_DELETE,
    Permission.CUSTOMER_NOTE_ADD,
    Permission.KYC_CAPTURE,
    Permission.KYC_VERIFY,
    Permission.PRODUCT_MANAGE,
    Permission.LOAN_CREATE,
    Permission.LOAN_VIEW,
    Permission.LOAN_APPROVE,
    Permission.LOAN_RESCHEDULE,
    Permission.PAYMENT_COLLECT,
    Permission.PAYMENT_ALLOCATE,
    Permission.PAYMENT_VIEW,
    Permission.PAYMENT_REVERSE,
    Permission.COLLECTION_VIEW_ASSIGNED,
    Permission.COLLECTION_ASSIGN,
    Permission.OVERDUE_MANAGE,
    Permission.REPORTS_VIEW_BRANCH,
    Permission.SUPPORT_VIEW,
    Permission.SUPPORT_REPLY,
    Permission.SUPPORT_ESCALATE,
  ],
  [StaffRole.SHOPKEEPER]: [
    Permission.CUSTOMER_CREATE,
    Permission.CUSTOMER_VIEW,
    Permission.CUSTOMER_EDIT,
    Permission.CUSTOMER_NOTE_ADD,
    Permission.KYC_CAPTURE,
    Permission.KYC_VERIFY,
    Permission.PRODUCT_MANAGE,
    Permission.LOAN_CREATE,
    Permission.LOAN_VIEW,
    Permission.LOAN_APPROVE,
    Permission.LOAN_RESCHEDULE,
    Permission.PAYMENT_COLLECT,
    Permission.PAYMENT_ALLOCATE,
    Permission.PAYMENT_VIEW,
    Permission.OVERDUE_MANAGE,
    Permission.REPORTS_VIEW_BRANCH,
  ],
  [StaffRole.COLLECTION_AGENT]: [
    Permission.CUSTOMER_VIEW,
    Permission.LOAN_VIEW,
    Permission.PAYMENT_COLLECT,
    Permission.PAYMENT_VIEW,
    Permission.COLLECTION_VIEW_ASSIGNED,
  ],
  [StaffRole.SUPPORT_AGENT]: [
    Permission.CUSTOMER_VIEW,
    Permission.SUPPORT_VIEW,
    Permission.SUPPORT_REPLY,
    Permission.SUPPORT_ESCALATE,
  ],
};
