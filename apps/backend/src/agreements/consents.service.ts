import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditActorType } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AcceptConsentDto } from './dto/consent.dto';

/** Free-standing consent acceptance (general Terms of Service, privacy policy, etc) - not tied to a specific loan. */
@Injectable()
export class ConsentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async accept(customerId: string, dto: AcceptConsentDto, ipAddress: string | undefined) {
    const consent = await this.prisma.consent.create({
      data: { customerId, consentType: dto.consentType, version: dto.version, ipAddress },
    });

    await this.audit.record({
      actorType: AuditActorType.CUSTOMER,
      actorId: customerId,
      action: 'CONSENT_ACCEPTED',
      entityType: 'Consent',
      entityId: consent.id,
      afterState: { consentType: dto.consentType, version: dto.version },
      ipAddress,
    });

    return consent;
  }

  listForCustomer(customerId: string) {
    return this.prisma.consent.findMany({ where: { customerId }, orderBy: { givenAt: 'desc' } });
  }
}
