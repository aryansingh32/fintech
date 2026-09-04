import { Body, Controller, Get, Ip, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AuditActorType, PaymentSource, SubjectType } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { RequireSubject } from '../common/decorators/require-subject.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { Permission } from '../rbac/permissions';
import { PaymentsService } from './payments.service';
import { ReversalService } from './reversal.service';
import { CollectPaymentDto, ReversePaymentDto } from './dto/collect-payment.dto';

@UseGuards(JwtAuthGuard)
@Controller({ path: 'payments', version: '1' })
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly reversals: ReversalService,
  ) {}

  /** Shows exactly how a payment WOULD be allocated, before anything is posted. */
  @Get('loans/:loanId/allocation-preview')
  previewAllocation(
    @Param('loanId') loanId: string,
    @Query('amount') amount: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.payments.previewAllocation(loanId, Number(amount), user);
  }

  @RequireSubject(SubjectType.STAFF)
  @RequirePermissions(Permission.PAYMENT_COLLECT)
  @Post('collect')
  collect(@Body() dto: CollectPaymentDto, @CurrentUser() user: AuthUser, @Ip() ip: string) {
    return this.payments.collectPayment({
      loanId: dto.loanId,
      amount: dto.amount,
      method: dto.method,
      referenceId: dto.referenceId,
      idempotencyKey: dto.idempotencyKey,
      clientTransactionId: dto.clientTransactionId,
      allocation: dto.allocation,
      source: dto.clientTransactionId ? PaymentSource.OFFLINE_SYNCED : PaymentSource.STAFF_COLLECTED,
      collectedByStaffId: user.id,
      requestingUser: user,
      actor: {
        actorType: AuditActorType.STAFF,
        actorId: user.id,
        role: user.role,
        ipAddress: ip,
        deviceId: user.deviceId,
        sessionId: user.sessionId,
      },
    });
  }

  @RequireSubject(SubjectType.STAFF)
  @RequirePermissions(Permission.PAYMENT_REVERSE)
  @Post(':paymentId/reverse')
  reverse(
    @Param('paymentId') paymentId: string,
    @Body() dto: ReversePaymentDto,
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ) {
    return this.reversals.reverse({
      paymentId,
      reason: dto.reason,
      initiatedByStaffId: user.id,
      actor: { role: user.role, ipAddress: ip, deviceId: user.deviceId, sessionId: user.sessionId },
    });
  }
}
