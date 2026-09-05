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
export function canManageBranchesAndStaff(role: StaffRole): boolean {
  return role === StaffRole.OWNER;
}

export function canApproveLoans(role: StaffRole): boolean {
  return role === StaffRole.OWNER || role === StaffRole.MANAGER || role === StaffRole.SHOPKEEPER;
}

export function canCollectPayments(role: StaffRole): boolean {
  return role !== StaffRole.SUPPORT_AGENT;
}

export function canViewReports(role: StaffRole): boolean {
  return role === StaffRole.OWNER || role === StaffRole.MANAGER || role === StaffRole.SHOPKEEPER;
}

export function canManageCustomersAndLoans(role: StaffRole): boolean {
  return role === StaffRole.OWNER || role === StaffRole.MANAGER || role === StaffRole.SHOPKEEPER;
}

export function canUseSupport(role: StaffRole): boolean {
  return role === StaffRole.OWNER || role === StaffRole.MANAGER || role === StaffRole.SUPPORT_AGENT;
}

export function roleLabel(role: StaffRole): string {
  return role
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}
