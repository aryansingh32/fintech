import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { SubjectType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { assertBranchAccess } from '../rbac/branch-scope.util';

@Injectable()
export class ReceiptsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForCustomer(customerId: string, user: AuthUser) {
    if (user.subjectType === SubjectType.CUSTOMER && customerId !== user.id) {
      throw new ForbiddenException('You do not have access to these receipts.');
    }
    if (user.subjectType === SubjectType.STAFF) {
      const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
      if (!customer) throw new NotFoundException('Customer not found.');
      assertBranchAccess(user, customer.branchId);
    }
    return this.prisma.receipt.findMany({ where: { customerId }, orderBy: { createdAt: 'desc' } });
  }

  async listForLoan(loanId: string, user: AuthUser) {
    const loan = await this.prisma.loan.findUnique({ where: { id: loanId } });
    if (!loan) throw new NotFoundException('Loan not found.');
    if (user.subjectType === SubjectType.CUSTOMER) {
      if (loan.customerId !== user.id) throw new ForbiddenException('You do not have access to this loan.');
    } else {
      assertBranchAccess(user, loan.branchId);
    }
    return this.prisma.receipt.findMany({ where: { loanId }, orderBy: { createdAt: 'desc' } });
  }

  async findById(id: string, user: AuthUser) {
    const receipt = await this.prisma.receipt.findUnique({
      where: { id },
      include: { payment: { include: { allocations: true } } },
    });
    if (!receipt) throw new NotFoundException('Receipt not found.');
    if (user.subjectType === SubjectType.CUSTOMER) {
      if (receipt.customerId !== user.id) throw new ForbiddenException('You do not have access to this receipt.');
    } else {
      const loan = await this.prisma.loan.findUniqueOrThrow({ where: { id: receipt.loanId } });
      assertBranchAccess(user, loan.branchId);
    }
    return receipt;
  }

  /** verificationId is a tamper-evident lookup key that doesn't require auth - meant for a shared/printed receipt QR link. */
  async findByVerificationId(verificationId: string) {
    const receipt = await this.prisma.receipt.findUnique({ where: { verificationId } });
    if (!receipt) throw new NotFoundException('Receipt not found or verification ID is invalid.');
    return receipt;
  }
}
