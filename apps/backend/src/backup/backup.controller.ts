import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { BackupTrigger, StaffRole, SubjectType } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequireSubject } from '../common/decorators/require-subject.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { Permission } from '../rbac/permissions';
import { BackupService } from './backup.service';
import { ListBackupsDto } from './dto/backup.dto';

/**
 * Backups expose the raw database (customers, loans, payments - everything)
 * and can push a copy to an external Google Drive account, so this
 * controller is deliberately restricted to SUPER_ADMIN specifically via
 * @Roles - NOT opened to every role via SETTINGS_MANAGE alone the way most
 * of this app is (see DEFAULT_ROLE_PERMISSIONS parity). RequirePermissions
 * is kept too, purely for a consistent audit/permission-check trail.
 */
@UseGuards(JwtAuthGuard)
@RequireSubject(SubjectType.STAFF)
@RequirePermissions(Permission.SETTINGS_MANAGE)
@Roles(StaffRole.SUPER_ADMIN)
@Controller({ path: 'backups', version: '1' })
export class BackupController {
  constructor(private readonly backups: BackupService) {}

  @Get()
  list(@Query() query: ListBackupsDto) {
    // Date-only strings ("2026-09-08") are parsed as the START of that day
    // in IST (this app's users are all India-based), not UTC midnight -
    // `new Date("2026-09-08")` alone would parse as UTC and quietly shift
    // the range by 5:30h. A full ISO datetime (already has an offset) is
    // passed straight through.
    return this.backups.list({
      from: query.from ? new Date(query.from.length === 10 ? `${query.from}T00:00:00+05:30` : query.from) : undefined,
      to: query.to ? new Date(query.to.length === 10 ? `${query.to}T23:59:59.999+05:30` : query.to) : undefined,
    });
  }

  @Post('run')
  run(@CurrentUser() user: AuthUser) {
    return this.backups.run(BackupTrigger.MANUAL, user.id);
  }

  @Get(':id/download')
  download(@Param('id') id: string) {
    return this.backups.getDownloadUrl(id);
  }

  @Post(':id/send-to-drive')
  sendToDrive(@Param('id') id: string) {
    return this.backups.sendToDrive(id);
  }
}
