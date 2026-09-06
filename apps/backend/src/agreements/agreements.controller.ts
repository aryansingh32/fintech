import { Body, Controller, Get, Ip, Param, ParseEnumPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { SubjectType, AgreementTemplateKey } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequireSubject } from '../common/decorators/require-subject.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { Permission } from '../rbac/permissions';
import { AgreementTemplatesService } from './agreement-templates.service';
import { LoanAgreementsService } from './loan-agreements.service';
import { ConsentsService } from './consents.service';
import { PublishAgreementTemplateDto, UpdateLoanAgreementDto } from './dto/agreement.dto';
import { AcceptConsentDto } from './dto/consent.dto';

/** Global template read/publish - reachable by both identity domains (a customer reads the active Terms of Service; only staff publish). */
@UseGuards(JwtAuthGuard)
@Controller({ path: 'agreement-templates', version: '1' })
export class AgreementTemplatesController {
  constructor(private readonly templates: AgreementTemplatesService) {}

  @Get(':key/active')
  getActive(@Param('key', new ParseEnumPipe(AgreementTemplateKey)) key: AgreementTemplateKey) {
    return this.templates.getActive(key);
  }

  @RequireSubject(SubjectType.STAFF)
  @RequirePermissions(Permission.AGREEMENT_MANAGE)
  @Get(':key/versions')
  listVersions(@Param('key', new ParseEnumPipe(AgreementTemplateKey)) key: AgreementTemplateKey) {
    return this.templates.listVersions(key);
  }

  @RequireSubject(SubjectType.STAFF)
  @RequirePermissions(Permission.AGREEMENT_MANAGE)
  @Post(':key')
  publish(
    @Param('key', new ParseEnumPipe(AgreementTemplateKey)) key: AgreementTemplateKey,
    @Body() dto: PublishAgreementTemplateDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.templates.publish(key, dto, user);
  }
}

/** Per-loan agreement edit (staff) / acceptance (customer) - shared path, same reasoning as SupportController. */
@UseGuards(JwtAuthGuard)
@Controller({ path: 'loans/:loanId/agreement', version: '1' })
export class LoanAgreementsController {
  constructor(private readonly agreements: LoanAgreementsService) {}

  @RequireSubject(SubjectType.STAFF)
  @RequirePermissions(Permission.AGREEMENT_MANAGE)
  @Patch()
  update(@Param('loanId') loanId: string, @Body() dto: UpdateLoanAgreementDto, @CurrentUser() user: AuthUser) {
    return this.agreements.updateForLoan(loanId, dto, user);
  }

  @RequireSubject(SubjectType.CUSTOMER)
  @Post('accept')
  accept(@Param('loanId') loanId: string, @CurrentUser() user: AuthUser, @Ip() ip: string) {
    return this.agreements.acceptForLoan(loanId, user.id, ip);
  }
}

/** General consent acceptance (Terms of Service, privacy policy) - independent of any specific loan. */
@UseGuards(JwtAuthGuard)
@RequireSubject(SubjectType.CUSTOMER)
@Controller({ path: 'consents', version: '1' })
export class ConsentsController {
  constructor(private readonly consents: ConsentsService) {}

  @Get('me')
  list(@CurrentUser() user: AuthUser) {
    return this.consents.listForCustomer(user.id);
  }

  @Post('accept')
  accept(@Body() dto: AcceptConsentDto, @CurrentUser() user: AuthUser, @Ip() ip: string) {
    return this.consents.accept(user.id, dto, ip);
  }
}
