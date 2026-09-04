import { Injectable } from '@nestjs/common';
import { StaffRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_ROLE_PERMISSIONS, Permission } from './permissions';

@Injectable()
export class StaffPermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Effective permission set = role defaults, plus explicit grants, minus
   * explicit revocations. Always computed server-side from the database -
   * never trusted from a client-supplied token claim.
   */
  async getEffectivePermissions(staffUserId: string, role: StaffRole): Promise<Set<Permission>> {
    const effective = new Set<Permission>(DEFAULT_ROLE_PERMISSIONS[role]);
    const overrides = await this.prisma.staffPermission.findMany({ where: { staffUserId } });
    for (const override of overrides) {
      const key = override.permissionKey as Permission;
      if (override.allowed) {
        effective.add(key);
      } else {
        effective.delete(key);
      }
    }
    return effective;
  }

  async hasAll(staffUserId: string, role: StaffRole, required: Permission[]): Promise<boolean> {
    if (required.length === 0) return true;
    const effective = await this.getEffectivePermissions(staffUserId, role);
    return required.every((p) => effective.has(p));
  }
}
