import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditActorType, KycStatus, SubjectType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { assertBranchAccess } from '../rbac/branch-scope.util';
import { SubmitKycDocumentDto } from './dto/kyc.dto';

/**
 * KYC records store only a maskedIdentifier and a pointer (documentRef) to
 * encrypted-at-rest storage - never the raw document/number - per blueprint
 * #23 "Encrypt sensitive KYC data" / #40 "PII masking wherever possible."
 * This service does not implement any identity verification itself; VERIFIED
 * / REJECTED is always a human staff decision (blueprint #23: "do not build
 * unofficial identity scraping or verification bypasses").
 */
@Injectable()
export class KycService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async assertCustomerAccess(customerId: string, user: AuthUser): Promise<void> {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new NotFoundException('Customer not found.');
    if (user.subjectType === SubjectType.CUSTOMER) {
      if (customerId !== user.id) throw new ForbiddenException('You do not have access to this record.');
    } else {
      assertBranchAccess(user, customer.branchId);
    }
  }

  async submit(customerId: string, dto: SubmitKycDocumentDto, staff: AuthUser) {
    await this.assertCustomerAccess(customerId, staff);

    const record = await this.prisma.$transaction(async (tx) => {
      const created = await tx.kYCRecord.create({
        data: {
          customerId,
          documentType: dto.documentType,
          maskedIdentifier: dto.maskedIdentifier,
          documentRef: dto.documentRef,
          status: KycStatus.SUBMITTED,
        },
      });
      await tx.customer.update({ where: { id: customerId }, data: { kycStatus: KycStatus.SUBMITTED } });
      return created;
    });

    await this.audit.record({
      actorType: AuditActorType.STAFF,
      actorId: staff.id,
      role: staff.role,
      action: 'KYC_DOCUMENT_SUBMITTED',
      entityType: 'KYCRecord',
      entityId: record.id,
      afterState: { documentType: dto.documentType, maskedIdentifier: dto.maskedIdentifier },
    });

    return record;
  }

  async verify(recordId: string, decision: 'VERIFIED' | 'REJECTED', reason: string | undefined, staff: AuthUser) {
    const record = await this.prisma.kYCRecord.findUnique({ where: { id: recordId } });
    if (!record) throw new NotFoundException('KYC record not found.');
    await this.assertCustomerAccess(record.customerId, staff);

    const status = decision === 'VERIFIED' ? KycStatus.VERIFIED : KycStatus.REJECTED;
    const updated = await this.prisma.$transaction(async (tx) => {
      const rec = await tx.kYCRecord.update({
        where: { id: recordId },
        data: { status, verifiedByStaffId: staff.id, verifiedAt: new Date(), rejectionReason: reason },
      });
      await tx.customer.update({ where: { id: record.customerId }, data: { kycStatus: status } });
      return rec;
    });

    await this.audit.record({
      actorType: AuditActorType.STAFF,
      actorId: staff.id,
      role: staff.role,
      action: decision === 'VERIFIED' ? 'KYC_VERIFIED' : 'KYC_REJECTED',
      entityType: 'KYCRecord',
      entityId: recordId,
      reason,
    });

    return updated;
  }

  async listForCustomer(customerId: string, user: AuthUser) {
    await this.assertCustomerAccess(customerId, user);
    return this.prisma.kYCRecord.findMany({ where: { customerId }, orderBy: { createdAt: 'desc' } });
  }
}
