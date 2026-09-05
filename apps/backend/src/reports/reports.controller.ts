import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { PaymentMethod, SubjectType } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequireSubject } from '../common/decorators/require-subject.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { Permission } from '../rbac/permissions';
import { CustomersService } from '../customers/customers.service';
import { ReportsService, ReportFilters } from './reports.service';

@UseGuards(JwtAuthGuard)
@RequireSubject(SubjectType.STAFF)
@RequirePermissions(Permission.REPORTS_VIEW_BRANCH)
@Controller({ path: 'reports', version: '1' })
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly customers: CustomersService,
  ) {}

  private filtersFrom(query: Record<string, string | undefined>): ReportFilters {
    return {
      fromDate: query.fromDate,
      toDate: query.toDate,
      staffId: query.staffId,
      method: query.method as PaymentMethod | undefined,
      customerId: query.customerId,
      loanId: query.loanId,
      branchId: query.branchId,
    };
  }

  @Get('daily-collection')
  dailyCollection(@CurrentUser() user: AuthUser, @Query() query: Record<string, string>) {
    return this.reports.dailyCollection(user, this.filtersFrom(query));
  }

  @Get('outstanding')
  outstanding(@CurrentUser() user: AuthUser, @Query() query: Record<string, string>) {
    return this.reports.outstanding(user, this.filtersFrom(query));
  }

  @Get('overdue-aging')
  overdueAging(@CurrentUser() user: AuthUser, @Query() query: Record<string, string>) {
    return this.reports.overdueAging(user, this.filtersFrom(query));
  }

  @Get('emi-due')
  emiDue(@CurrentUser() user: AuthUser, @Query() query: Record<string, string>) {
    return this.reports.emiDue(user, this.filtersFrom(query));
  }

  @Get('customer-ledger/:customerId')
  async customerLedger(@Param('customerId') customerId: string, @CurrentUser() user: AuthUser) {
    await this.customers.findById(customerId, user); // enforces branch access
    return this.reports.customerLedger(customerId);
  }

  @Get('loan-portfolio')
  loanPortfolio(@CurrentUser() user: AuthUser, @Query() query: Record<string, string>) {
    return this.reports.loanPortfolio(user, this.filtersFrom(query));
  }

  @Get('product-finance')
  productFinance(@CurrentUser() user: AuthUser, @Query() query: Record<string, string>) {
    return this.reports.productFinance(user, this.filtersFrom(query));
  }

  @Get('staff-performance')
  staffPerformance(@CurrentUser() user: AuthUser, @Query() query: Record<string, string>) {
    return this.reports.staffPerformance(user, this.filtersFrom(query));
  }

  @Get('payment-reconciliation')
  paymentReconciliation(@CurrentUser() user: AuthUser, @Query() query: Record<string, string>) {
    return this.reports.paymentReconciliation(user, this.filtersFrom(query));
  }

  @Get('audit')
  auditReport(@CurrentUser() user: AuthUser, @Query() query: Record<string, string>) {
    return this.reports.auditReport(user, query);
  }
}
