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
  AGREEMENT_MANAGE = 'agreement.manage',
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
 * Every role gets full, identical access to every permission-gated action.
 * There is deliberately no per-role restriction here: any staff account
 * that is approved by the super admin (see StaffModule / isApproved) has
 * exactly the same capabilities as the super admin - same data, same
 * functions, same commands, across every branch. The role field still
 * exists for labeling/organizational purposes (and for StaffPermission
 * overrides on top of this, if ever needed), but it no longer restricts
 * anything by itself.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<StaffRole, Permission[]> = {
  [StaffRole.SUPER_ADMIN]: Object.values(Permission),
  [StaffRole.ADMIN]: Object.values(Permission),
  [StaffRole.OWNER]: Object.values(Permission),
  [StaffRole.MANAGER]: Object.values(Permission),
  [StaffRole.SHOPKEEPER]: Object.values(Permission),
  [StaffRole.COLLECTION_AGENT]: Object.values(Permission),
  [StaffRole.SUPPORT_AGENT]: Object.values(Permission),
};
