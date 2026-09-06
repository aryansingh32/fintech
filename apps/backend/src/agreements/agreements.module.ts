import { Module } from '@nestjs/common';
import { AgreementTemplatesService } from './agreement-templates.service';
import { LoanAgreementsService } from './loan-agreements.service';
import { ConsentsService } from './consents.service';
import { AgreementTemplatesController, ConsentsController, LoanAgreementsController } from './agreements.controller';

@Module({
  controllers: [AgreementTemplatesController, LoanAgreementsController, ConsentsController],
  providers: [AgreementTemplatesService, LoanAgreementsService, ConsentsService],
})
export class AgreementsModule {}
