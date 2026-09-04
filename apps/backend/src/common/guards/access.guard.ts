import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SubjectType } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { SUBJECT_TYPE_KEY } from '../decorators/require-subject.decorator';
import { StaffPermissionsService } from '../../rbac/staff-permissions.service';
import { AuthUser } from '../interfaces/auth-user.interface';

/**
 * Single guard enforcing @RequireSubject / @Roles / @RequirePermissions.
 * Runs after JwtAuthGuard, so req.user is already populated and trustworthy
 * (derived from a verified JWT + a live, non-revoked Session row).
 */
@Injectable()
export class AccessGuard {
  constructor(
    private readonly reflector: Reflector,
    private readonly staffPermissions: StaffPermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredSubject = this.reflector.getAllAndOverride<SubjectType>(SUBJECT_TYPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const requiredPermissions = this.reflector.getAllAndOverride(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]) as string[] | undefined;

    if (!requiredSubject && !requiredRoles?.length && !requiredPermissions?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthUser | undefined;
    if (!user) throw new ForbiddenException('Not authenticated.');

    if (requiredSubject && user.subjectType !== requiredSubject) {
      throw new ForbiddenException('This action is not available for this account type.');
    }

    if ((requiredRoles?.length || requiredPermissions?.length) && user.subjectType !== SubjectType.STAFF) {
      throw new ForbiddenException('Staff access required.');
    }

    if (requiredRoles?.length && !requiredRoles.includes(user.role as string)) {
      throw new ForbiddenException('Your role does not permit this action.');
    }

    if (requiredPermissions?.length) {
      const allowed = await this.staffPermissions.hasAll(
        user.id,
        user.role!,
        requiredPermissions as never,
      );
      if (!allowed) {
        throw new ForbiddenException('You do not have permission to perform this action.');
      }
    }

    return true;
  }
}
