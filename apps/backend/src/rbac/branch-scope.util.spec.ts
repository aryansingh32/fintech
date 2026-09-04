import { ForbiddenException } from '@nestjs/common';
import { SubjectType } from '@prisma/client';
import { assertBranchAccess, branchWhereClause } from './branch-scope.util';
import { AuthUser } from '../common/interfaces/auth-user.interface';

function staffUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 'staff-1',
    subjectType: SubjectType.STAFF,
    sessionId: 'session-1',
    branchId: 'branch-A',
    isGlobal: false,
    ...overrides,
  };
}

describe('assertBranchAccess', () => {
  it('denies a collection agent in Branch A from accessing a loan/customer in Branch B', () => {
    const agent = staffUser({ branchId: 'branch-A' });
    expect(() => assertBranchAccess(agent, 'branch-B')).toThrow(ForbiddenException);
  });

  it('allows a staff member to access a resource in their own branch', () => {
    const staff = staffUser({ branchId: 'branch-A' });
    expect(() => assertBranchAccess(staff, 'branch-A')).not.toThrow();
  });

  it('allows OWNER-level (isGlobal) staff to access any branch', () => {
    const owner = staffUser({ branchId: 'branch-A', isGlobal: true });
    expect(() => assertBranchAccess(owner, 'branch-B')).not.toThrow();
  });

  it('does not throw for a resource with no branch (global resource)', () => {
    const staff = staffUser({ branchId: 'branch-A' });
    expect(() => assertBranchAccess(staff, null)).not.toThrow();
  });
});

describe('branchWhereClause', () => {
  it('scopes queries to the branch for non-global staff', () => {
    const staff = staffUser({ branchId: 'branch-A' });
    expect(branchWhereClause(staff)).toEqual({ branchId: 'branch-A' });
  });

  it('returns an unrestricted filter for global staff', () => {
    const owner = staffUser({ isGlobal: true });
    expect(branchWhereClause(owner)).toEqual({});
  });
});
