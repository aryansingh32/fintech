import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditActorType, SubjectType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { assertBranchAccess } from '../rbac/branch-scope.util';
import { UpdateLoanAgreementDto } from './dto/agreement.dto';

@Injectable()
export class LoanAgreementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async loadWithAccess(loanId: string, user: AuthUser) {
    const loan = await this.prisma.loan.findUnique({ where: { id: loanId }, include: { agreement: true } });
    if (!loan) throw new NotFoundException('Loan not found.');
    if (!loan.agreement) throw new NotFoundException('This loan does not have an agreement yet.');

    if (user.subjectType === SubjectType.CUSTOMER) {
      if (loan.customerId !== user.id) throw new ForbiddenException('You do not have access to this loan.');
    } else {
      assertBranchAccess(user, loan.branchId);
    }
    return loan;
  }

  /**
   * Overrides one loan's frozen agreement content (a manually negotiated
   * clause, a correction to the generated text). Blocked once the customer
   * has already accepted - accepted terms are exactly what they agreed to
   * and must never change under them.
   */
  async updateForLoan(loanId: string, dto: UpdateLoanAgreementDto, staff: AuthUser) {
    const loan = await this.loadWithAccess(loanId, staff);
    const agreement = loan.agreement!;
    if (agreement.acceptedByCustomerAt) {
      throw new BadRequestException('This agreement was already accepted by the customer and can no longer be edited.');
    }

    const updated = await this.prisma.agreement.update({
      where: { id: agreement.id },
      data: {
        version: agreement.version + 1,
        ...(dto.termsSnapshot !== undefined ? { termsSnapshot: dto.termsSnapshot as never } : {}),
        ...(dto.documentRef !== undefined ? { documentRef: dto.documentRef } : {}),
        updatedByStaffId: staff.id,
        updatedAt: new Date(),
      },
    });

    await this.audit.record({
      actorType: AuditActorType.STAFF,
      actorId: staff.id,
      role: staff.role,
      action: 'LOAN_AGREEMENT_UPDATED',
      entityType: 'Agreement',
      entityId: agreement.id,
      beforeState: { version: agreement.version },
      afterState: { version: updated.version },
    });

    return updated;
  }

  /** Customer accepts their loan's current agreement - permanently freezes it and records a Consent row for audit. */
  async acceptForLoan(loanId: string, customerId: string, ipAddress: string | undefined) {
    const loan = await this.prisma.loan.findUnique({ where: { id: loanId }, include: { agreement: true } });
    if (!loan) throw new NotFoundException('Loan not found.');
    if (loan.customerId !== customerId) throw new ForbiddenException('You do not have access to this loan.');
    if (!loan.agreement) throw new NotFoundException('This loan does not have an agreement yet.');
    if (loan.agreement.acceptedByCustomerAt) return loan.agreement;

    const [updated] = await this.prisma.$transaction([
      this.prisma.agreement.update({
        where: { id: loan.agreement.id },
        data: { acceptedByCustomerAt: new Date(), acceptedIp: ipAddress },
      }),
      this.prisma.consent.create({
        data: {
          customerId,
          consentType: 'LOAN_AGREEMENT',
          version: String(loan.agreement.version),
          ipAddress,
        },
      }),
    ]);

    await this.audit.record({
      actorType: AuditActorType.CUSTOMER,
      actorId: customerId,
      action: 'LOAN_AGREEMENT_ACCEPTED',
      entityType: 'Agreement',
      entityId: loan.agreement.id,
      ipAddress,
    });

    return updated;
  }
}
