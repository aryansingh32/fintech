import { Injectable, NotFoundException } from '@nestjs/common';
import { AgreementTemplateKey } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditActorType } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { PublishAgreementTemplateDto } from './dto/agreement.dto';

/**
 * Global, versioned Terms-of-Service / default-loan-agreement text. Publishing
 * a new version never edits the old one in place (same immutable-history
 * pattern as LoanProductVersion) - loans that already froze a copy of an
 * older version's text into their own Agreement.termsSnapshot are unaffected.
 */
@Injectable()
export class AgreementTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getActive(key: AgreementTemplateKey) {
    const template = await this.prisma.agreementTemplate.findFirst({
      where: { key, isActive: true },
      orderBy: { version: 'desc' },
    });
    if (!template) throw new NotFoundException(`No published ${key} template yet.`);
    return template;
  }

  listVersions(key: AgreementTemplateKey) {
    return this.prisma.agreementTemplate.findMany({ where: { key }, orderBy: { version: 'desc' } });
  }

  async publish(key: AgreementTemplateKey, dto: PublishAgreementTemplateDto, staff: AuthUser) {
    const latest = await this.prisma.agreementTemplate.findFirst({ where: { key }, orderBy: { version: 'desc' } });
    const nextVersion = (latest?.version ?? 0) + 1;

    const created = await this.prisma.$transaction(async (tx) => {
      await tx.agreementTemplate.updateMany({ where: { key, isActive: true }, data: { isActive: false } });
      return tx.agreementTemplate.create({
        data: {
          key,
          version: nextVersion,
          title: dto.title,
          content: dto.content,
          isActive: true,
          createdByStaffId: staff.id,
        },
      });
    });

    await this.audit.record({
      actorType: AuditActorType.STAFF,
      actorId: staff.id,
      role: staff.role,
      action: 'AGREEMENT_TEMPLATE_PUBLISHED',
      entityType: 'AgreementTemplate',
      entityId: created.id,
      afterState: { key, version: nextVersion },
    });

    return created;
  }
}
