import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { SubjectType } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequireSubject } from '../common/decorators/require-subject.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { Permission } from '../rbac/permissions';
import { LoansService } from './loans.service';
import { LoanProductsService } from './loan-products.service';
import { CreateLoanDto, ApproveLoanDto } from './dto/loan.dto';
import { CreateLoanProductDto, CreateLoanProductVersionDto } from './dto/loan-product.dto';

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
  list() {
    return this.loanProducts.list();
  }

  @RequirePermissions(Permission.LOAN_PRODUCT_MANAGE)
  @Post(':id/versions')
  createVersion(@Param('id') id: string, @Body() dto: CreateLoanProductVersionDto) {
    return this.loanProducts.createVersion(id, dto);
  }
}
