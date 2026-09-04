import { ForbiddenException } from '@nestjs/common';
import { AuthUser } from '../common/interfaces/auth-user.interface';

/**
 * Enforces branch isolation at the point a resource's owning branch is known.
 * OWNER-level / isGlobal staff bypass the restriction; everyone else can only
 * touch resources in their own branch, regardless of what the client sends.
 * This must be called from every service method that reads or writes a
 * branch-scoped resource (Customer, Loan, Payment, Product, ...).
 */
export function assertBranchAccess(user: AuthUser, resourceBranchId: string | null | undefined): void {
  if (user.isGlobal) return;
  if (!resourceBranchId) return;
  if (user.branchId !== resourceBranchId) {
    throw new ForbiddenException('You do not have access to this branch.');
  }
}

/** Returns a Prisma `where` fragment restricting queries to the caller's branch. */
export function branchWhereClause(user: AuthUser): { branchId?: string } {
  if (user.isGlobal) return {};
  return { branchId: user.branchId ?? '__no_branch__' };
}
