import { IsObject, IsOptional, IsString, MinLength } from 'class-validator';
import { AgreementTemplateKey } from '@prisma/client';

export { AgreementTemplateKey };

export class PublishAgreementTemplateDto {
  @IsString()
  @MinLength(1)
  title: string;

  @IsString()
  @MinLength(1)
  content: string;
}

/** Staff override of one loan's frozen agreement - only permitted before the customer has accepted it. */
export class UpdateLoanAgreementDto {
  @IsOptional()
  @IsString()
  documentRef?: string;

  @IsOptional()
  @IsObject()
  termsSnapshot?: Record<string, unknown>;
}
