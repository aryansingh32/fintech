import { StaffRole } from '@sptc/shared';

/**
 * Every approved staff account has full access to every screen and action -
 * same data, same functions, same commands as the super admin, regardless
 * of role (see backend DEFAULT_ROLE_PERMISSIONS, which grants every role
 * every Permission). These all return true unconditionally so the UI never
 * hides something the backend would actually allow. The role parameter is
 * kept so call sites don't need to change if a real restriction is ever
 * reintroduced.
 */
export function canManageBranchesAndStaff(_role: StaffRole): boolean {
  return true;
}

export function canApproveLoans(_role: StaffRole): boolean {
  return true;
}

export function canCollectPayments(_role: StaffRole): boolean {
  return true;
}

export function canViewReports(_role: StaffRole): boolean {
  return true;
}

export function canManageCustomersAndLoans(_role: StaffRole): boolean {
  return true;
}

export function canUseSupport(_role: StaffRole): boolean {
  return true;
}

export function canManageAgreements(_role: StaffRole): boolean {
  return true;
}

/** Mirrors StaffUser.isGlobal - every role is global now, so "Manage Loan Products" etc. show for everyone. */
export function isGlobalRole(_role: StaffRole): boolean {
  return true;
}

export function roleLabel(role: StaffRole): string {
  return role
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}
