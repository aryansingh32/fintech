import { IsEnum, IsOptional, IsString } from 'class-validator';
import { KycDocumentType } from '@prisma/client';

export class SubmitKycDocumentDto {
  @IsEnum(KycDocumentType)
  documentType: KycDocumentType;

  @IsString()
  maskedIdentifier: string;

  /** Pointer to encrypted-at-rest document storage - never the raw file/base64 (blueprint #23, #40). */
  @IsString()
  documentRef: string;
}

export class VerifyKycDocumentDto {
  @IsEnum(['VERIFIED', 'REJECTED'])
  decision: 'VERIFIED' | 'REJECTED';

  @IsOptional()
  @IsString()
  rejectionReason?: string;
}
