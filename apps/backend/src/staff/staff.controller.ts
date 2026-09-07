import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { SubjectType } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequireSubject } from '../common/decorators/require-subject.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { Permission } from '../rbac/permissions';
import { StaffService } from './staff.service';
import { CreateStaffDto, RejectStaffDto } from './dto/staff.dto';

/** Staff-account creation and approval - gated to Permission.STAFF_MANAGE (SUPER_ADMIN by default). */
@UseGuards(JwtAuthGuard)
@RequireSubject(SubjectType.STAFF)
@RequirePermissions(Permission.STAFF_MANAGE)
@Controller({ path: 'staff', version: '1' })
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Get()
  list() {
    return this.staff.list();
  }

  @Post()
  create(@Body() dto: CreateStaffDto, @CurrentUser() user: AuthUser) {
    return this.staff.create(dto, user);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.staff.approve(id, user);
  }

  @Post(':id/reject')
  reject(@Param('id') id: string, @Body() dto: RejectStaffDto, @CurrentUser() user: AuthUser) {
    return this.staff.reject(id, dto.reason, user);
  }
}
