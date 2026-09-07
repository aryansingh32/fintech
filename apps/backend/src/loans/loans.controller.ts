import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { LoanStatus, SubjectType } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequireSubject } from '../common/decorators/require-subject.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { Permission } from '../rbac/permissions';
import { LoansService } from './loans.service';
import { LoanProductsService } from './loan-products.service';
import { CreateLoanDto, ApproveLoanDto, ApplyPenaltyDto, PreviewLoanDto, RescheduleInstallmentDto } from './dto/loan.dto';
import {
  CreateLoanProductDto,
  CreateLoanProductVersionDto,
  UpdateLoanProductDto,
  UpdateLoanProductVersionDto,
} from './dto/loan-product.dto';

@UseGuards(JwtAuthGuard)
@RequireSubject(SubjectType.STAFF)
@Controller({ path: 'loans', version: '1' })
export class LoansController {
  constructor(private readonly loans: LoansService) {}

  @RequirePermissions(Permission.LOAN_CREATE)
  @Post()
  create(@Body() dto: CreateLoanDto, @CurrentUser() user: AuthUser) {
    return this.loans.create(dto, user);
  }

  @RequirePermissions(Permission.LOAN_CREATE)
  @Post('preview')
  preview(@Body() dto: PreviewLoanDto) {
    return this.loans.previewSchedule(dto);
  }

  @RequirePermissions(Permission.LOAN_VIEW)
  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: LoanStatus,
    @Query('customerId') customerId?: string,
  ) {
    return this.loans.list(user, { status, customerId });
  }

  @RequirePermissions(Permission.LOAN_VIEW)
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.loans.findById(id, user);
  }

  @RequirePermissions(Permission.LOAN_APPROVE)
  @Post(':id/decision')
  decide(@Param('id') id: string, @Body() dto: ApproveLoanDto, @CurrentUser() user: AuthUser) {
    return this.loans.decide(id, dto, user);
  }

  @RequirePermissions(Permission.LOAN_RESCHEDULE)
  @Patch(':id/installments/:installmentId/reschedule')
  reschedule(
    @Param('id') id: string,
    @Param('installmentId') installmentId: string,
    @Body() dto: RescheduleInstallmentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.loans.rescheduleInstallment(id, installmentId, dto, user);
  }

  @RequirePermissions(Permission.OVERDUE_MANAGE)
  @Post(':id/installments/:installmentId/penalty')
  applyPenalty(
    @Param('id') id: string,
    @Param('installmentId') installmentId: string,
    @Body() dto: ApplyPenaltyDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.loans.applyPenalty(id, installmentId, dto, user);
  }

  @RequirePermissions(Permission.OVERDUE_MANAGE)
  @Post(':id/installments/:installmentId/notify-overdue')
  notifyOverdue(@Param('id') id: string, @Param('installmentId') installmentId: string, @CurrentUser() user: AuthUser) {
    return this.loans.notifyOverdueInstallment(id, installmentId, user);
  }
}

/** Customer App's own loan list/detail - separate controller since the Business App's is staff-only at the class level. */
@UseGuards(JwtAuthGuard)
@RequireSubject(SubjectType.CUSTOMER)
@Controller({ path: 'loans/me', version: '1' })
export class CustomerLoansController {
  constructor(private readonly loans: LoansService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.loans.listForCustomer(user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.loans.findByIdForCustomer(id, user.id);
  }
}

@Controller({ path: 'loan-products', version: '1' })
@UseGuards(JwtAuthGuard)
@RequireSubject(SubjectType.STAFF)
export class LoanProductsController {
  constructor(private readonly loanProducts: LoanProductsService) {}

  @RequirePermissions(Permission.LOAN_PRODUCT_MANAGE)
  @Post()
  create(@Body() dto: CreateLoanProductDto) {
    return this.loanProducts.create(dto);
  }

  @RequirePermissions(Permission.LOAN_VIEW)
  @Get()
  list(@Query('all') all?: string) {
    return all === 'true' ? this.loanProducts.listAll() : this.loanProducts.list();
  }

  @RequirePermissions(Permission.LOAN_PRODUCT_MANAGE)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateLoanProductDto) {
    return this.loanProducts.update(id, dto);
  }

  @RequirePermissions(Permission.LOAN_PRODUCT_MANAGE)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.loanProducts.remove(id);
  }

  @RequirePermissions(Permission.LOAN_PRODUCT_MANAGE)
  @Post(':id/versions')
  createVersion(@Param('id') id: string, @Body() dto: CreateLoanProductVersionDto) {
    return this.loanProducts.createVersion(id, dto);
  }

  @RequirePermissions(Permission.LOAN_PRODUCT_MANAGE)
  @Patch(':id/versions/:versionId')
  updateVersion(
    @Param('id') id: string,
    @Param('versionId') versionId: string,
    @Body() dto: UpdateLoanProductVersionDto,
  ) {
    return this.loanProducts.updateVersion(id, versionId, dto);
  }

  @RequirePermissions(Permission.LOAN_PRODUCT_MANAGE)
  @Delete(':id/versions/:versionId')
  removeVersion(@Param('id') id: string, @Param('versionId') versionId: string) {
    return this.loanProducts.removeVersion(id, versionId);
  }
}
