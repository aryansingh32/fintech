import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { SubjectType } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequireSubject } from '../common/decorators/require-subject.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { Permission } from '../rbac/permissions';
import { ReceiptsService } from './receipts.service';

@UseGuards(JwtAuthGuard)
@Controller({ path: 'receipts', version: '1' })
export class ReceiptsController {
  constructor(private readonly receipts: ReceiptsService) {}

  @RequireSubject(SubjectType.CUSTOMER)
  @Get('me')
  myReceipts(@CurrentUser() user: AuthUser) {
    return this.receipts.listForCustomer(user.id, user);
  }

  @Get('loan/:loanId')
  forLoan(@Param('loanId') loanId: string, @CurrentUser() user: AuthUser) {
    return this.receipts.listForLoan(loanId, user);
  }

  /** Staff-side: a customer's full receipt history across all their loans. */
  @RequireSubject(SubjectType.STAFF)
  @RequirePermissions(Permission.PAYMENT_VIEW)
  @Get('customer/:customerId')
  forCustomer(@Param('customerId') customerId: string, @CurrentUser() user: AuthUser) {
    return this.receipts.listForCustomer(customerId, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.receipts.findById(id, user);
  }

  /** Tamper-evident public verification (e.g. scanning a QR code on a printed receipt) - intentionally no auth required. */
  @Public()
  @Get('verify/:verificationId')
  verify(@Param('verificationId') verificationId: string) {
    return this.receipts.findByVerificationId(verificationId);
  }
}
