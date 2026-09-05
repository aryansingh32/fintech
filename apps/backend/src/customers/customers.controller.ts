import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { SubjectType } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequireSubject } from '../common/decorators/require-subject.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { Permission } from '../rbac/permissions';
import { CustomersService } from './customers.service';
import { AddCustomerNoteDto, CreateCustomerDto, DeleteCustomerDto, UpdateCustomerDto } from './dto/customer.dto';

@UseGuards(JwtAuthGuard)
@RequireSubject(SubjectType.STAFF)
@Controller({ path: 'customers', version: '1' })
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @RequirePermissions(Permission.CUSTOMER_CREATE)
  @Post()
  create(@Body() dto: CreateCustomerDto, @CurrentUser() user: AuthUser) {
    return this.customers.create(dto, user);
  }

  @RequirePermissions(Permission.CUSTOMER_VIEW)
  @Get()
  search(@Query('q') query: string, @CurrentUser() user: AuthUser) {
    return this.customers.search(query ?? '', user);
  }

  @RequirePermissions(Permission.CUSTOMER_VIEW)
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.customers.findById(id, user);
  }

  @RequirePermissions(Permission.CUSTOMER_VIEW)
  @Get(':id/repayment-profile')
  repaymentProfile(@Param('id') id: string) {
    return this.customers.getRepaymentProfile(id);
  }

  @RequirePermissions(Permission.CUSTOMER_VIEW)
  @Get(':id/summary')
  summary(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.customers.getSummary(id, user);
  }

  @RequirePermissions(Permission.CUSTOMER_EDIT)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCustomerDto, @CurrentUser() user: AuthUser) {
    return this.customers.update(id, dto, user);
  }

  @RequirePermissions(Permission.CUSTOMER_DELETE)
  @Delete(':id')
  remove(@Param('id') id: string, @Body() dto: DeleteCustomerDto, @CurrentUser() user: AuthUser) {
    return this.customers.remove(id, dto, user);
  }

  @RequirePermissions(Permission.CUSTOMER_NOTE_ADD)
  @Post(':id/notes')
  addNote(@Param('id') id: string, @Body() dto: AddCustomerNoteDto, @CurrentUser() user: AuthUser) {
    return this.customers.addNote(id, dto.note, user);
  }
}

/** Customer App's own profile - separate controller since CustomersController above is staff-only at the class level. */
@UseGuards(JwtAuthGuard)
@RequireSubject(SubjectType.CUSTOMER)
@Controller({ path: 'customers/me', version: '1' })
export class CustomerProfileController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  me(@CurrentUser() user: AuthUser) {
    return this.customers.getOwnProfile(user.id);
  }
}
