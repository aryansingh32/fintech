import { StaffRole, SubjectType } from '@prisma/client';

/** Shape attached to `req.user` by JwtStrategy after token validation. */
export interface AuthUser {
  id: string; // StaffUser.id or Customer.id
  subjectType: SubjectType;
  sessionId: string;
  deviceId?: string;
  // Staff-only fields:
  role?: StaffRole;
  branchId?: string | null;
  isGlobal?: boolean;
}
