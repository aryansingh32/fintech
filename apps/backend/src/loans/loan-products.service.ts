import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLoanProductDto, CreateLoanProductVersionDto } from './dto/loan-product.dto';

@Injectable()
export class LoanProductsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateLoanProductDto) {
    return this.prisma.loanProduct.create({ data: dto });
  }

  list() {
    return this.prisma.loanProduct.findMany({
      where: { isActive: true },
      include: { versions: { where: { isActive: true }, orderBy: { versionNumber: 'desc' } } },
    });
  }

  /**
   * Creates a new immutable version of a plan. Existing loans keep pointing
   * at their original LoanProductVersion row, so editing terms here NEVER
   * changes a loan that has already been originated (blueprint #26, TEST 5).
   */
  async createVersion(loanProductId: string, dto: CreateLoanProductVersionDto) {
    const loanProduct = await this.prisma.loanProduct.findUnique({ where: { id: loanProductId } });
    if (!loanProduct) throw new NotFoundException('Loan product not found.');

    const latest = await this.prisma.loanProductVersion.findFirst({
      where: { loanProductId },
      orderBy: { versionNumber: 'desc' },
    });
    const nextVersion = (latest?.versionNumber ?? 0) + 1;

    return this.prisma.loanProductVersion.create({
      data: {
        loanProductId,
        versionNumber: nextVersion,
        interestType: dto.interestType,
        interestRateAnnual: dto.interestRateAnnual,
        minInstallments: dto.minInstallments,
        maxInstallments: dto.maxInstallments,
        installmentFrequency: dto.installmentFrequency,
        feeRules: dto.feeRules as never,
        gracePeriodDays: dto.gracePeriodDays ?? 0,
        latePaymentRules: dto.latePaymentRules as never,
        partialPaymentRules: dto.partialPaymentRules as never,
        prepaymentRules: dto.prepaymentRules as never,
        earlyClosureRules: dto.earlyClosureRules as never,
        settlementRules: dto.settlementRules as never,
        waiverRules: dto.waiverRules as never,
        reversalRules: dto.reversalRules as never,
      },
    });
  }
}
