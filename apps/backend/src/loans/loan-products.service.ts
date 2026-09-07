import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateLoanProductDto,
  CreateLoanProductVersionDto,
  UpdateLoanProductDto,
  UpdateLoanProductVersionDto,
} from './dto/loan-product.dto';

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

  /** Includes inactive/deleted plans and versions - used by the admin screen so staff can still see (and reactivate) them. */
  listAll() {
    return this.prisma.loanProduct.findMany({
      include: { versions: { orderBy: { versionNumber: 'desc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Only touches name/description/isActive. Financial terms are never edited
   * in place on the LoanProduct or an existing LoanProductVersion - a rate or
   * fee change always goes through createVersion() so loans already
   * originated against an older version are provably unaffected.
   */
  async update(loanProductId: string, dto: UpdateLoanProductDto) {
    const loanProduct = await this.prisma.loanProduct.findUnique({ where: { id: loanProductId } });
    if (!loanProduct) throw new NotFoundException('Loan product not found.');

    return this.prisma.loanProduct.update({
      where: { id: loanProductId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  /**
   * Soft-delete: marks the plan and all of its versions inactive so it stops
   * appearing for new loans. Never a hard delete - loans reference a specific
   * LoanProductVersion row via a required FK, and every financial figure on
   * those loans was captured at origination time rather than read live from
   * the version, so this is always safe regardless of loan history.
   */
  async remove(loanProductId: string) {
    const loanProduct = await this.prisma.loanProduct.findUnique({ where: { id: loanProductId } });
    if (!loanProduct) throw new NotFoundException('Loan product not found.');

    await this.prisma.$transaction([
      this.prisma.loanProductVersion.updateMany({
        where: { loanProductId },
        data: { isActive: false },
      }),
      this.prisma.loanProduct.update({ where: { id: loanProductId }, data: { isActive: false } }),
    ]);
    return { success: true };
  }

  /** Toggle a single version's availability without affecting the plan or its other versions. */
  async updateVersion(loanProductId: string, versionId: string, dto: UpdateLoanProductVersionDto) {
    const version = await this.prisma.loanProductVersion.findFirst({
      where: { id: versionId, loanProductId },
    });
    if (!version) throw new NotFoundException('Loan product version not found.');

    return this.prisma.loanProductVersion.update({
      where: { id: versionId },
      data: { ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}) },
    });
  }

  /** Soft-delete a single version (isActive=false) - stops it being offered for new loans; existing loans are unaffected. */
  async removeVersion(loanProductId: string, versionId: string) {
    const version = await this.prisma.loanProductVersion.findFirst({
      where: { id: versionId, loanProductId },
    });
    if (!version) throw new NotFoundException('Loan product version not found.');

    return this.prisma.loanProductVersion.update({ where: { id: versionId }, data: { isActive: false } });
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
        interestBasis: dto.interestBasis ?? 'FINANCED_PRINCIPAL',
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
