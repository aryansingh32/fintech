import { StaffRole } from '@sptc/shared';

/**
 * Coarse, role-only UI gating - decides which screens/buttons to SHOW.
 * This is a convenience layer, not a security boundary: the backend's
 * AccessGuard (role defaults + per-staff StaffPermission overrides) is the
 * only thing that actually decides whether a call succeeds (blueprint
 * #41). A staff member whose permission was individually revoked might
 * still see a button here and get a 403 from the server when they tap it -
 * that's a display gap, not a security one.
 */

/** Only SUPER_ADMIN can create/approve/reject other staff accounts (Permission.STAFF_MANAGE - see DEFAULT_ROLE_PERMISSIONS). */
export function canManageBranchesAndStaff(role: StaffRole): boolean {
  return role === StaffRole.SUPER_ADMIN;
}

export function canApproveLoans(role: StaffRole): boolean {
  return [StaffRole.SUPER_ADMIN, StaffRole.ADMIN, StaffRole.OWNER, StaffRole.MANAGER, StaffRole.SHOPKEEPER].includes(role);
}

export function canCollectPayments(role: StaffRole): boolean {
  return role !== StaffRole.SUPPORT_AGENT;
}

export function canViewReports(role: StaffRole): boolean {
  return [StaffRole.SUPER_ADMIN, StaffRole.ADMIN, StaffRole.OWNER, StaffRole.MANAGER, StaffRole.SHOPKEEPER].includes(role);
}

export function canManageCustomersAndLoans(role: StaffRole): boolean {
  return [StaffRole.SUPER_ADMIN, StaffRole.ADMIN, StaffRole.OWNER, StaffRole.MANAGER, StaffRole.SHOPKEEPER].includes(role);
}

export function canUseSupport(role: StaffRole): boolean {
  return [StaffRole.SUPER_ADMIN, StaffRole.ADMIN, StaffRole.OWNER, StaffRole.MANAGER, StaffRole.SUPPORT_AGENT].includes(role);
}

export function canManageAgreements(role: StaffRole): boolean {
  return [StaffRole.SUPER_ADMIN, StaffRole.ADMIN, StaffRole.OWNER, StaffRole.MANAGER].includes(role);
}

/** Mirrors StaffUser.isGlobal for the two new top-of-hierarchy roles, so "Manage Loan Products" etc. also show for them. */
export function isGlobalRole(role: StaffRole): boolean {
  return [StaffRole.SUPER_ADMIN, StaffRole.ADMIN, StaffRole.OWNER].includes(role);
}

export function roleLabel(role: StaffRole): string {
  return role
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}
