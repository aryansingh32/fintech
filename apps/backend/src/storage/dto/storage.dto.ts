import { IsEnum, IsString } from 'class-validator';

export enum UploadPurpose {
  CUSTOMER_PHOTO = 'customer-photo',
  REFERENCE_PHOTO = 'reference-photo',
  KYC_DOCUMENT = 'kyc-document',
  SUPPORT_ATTACHMENT = 'support-attachment',
}

export class PresignUploadDto {
  @IsEnum(UploadPurpose)
  purpose: UploadPurpose;

  /** e.g. "image/jpeg" - used both to key the object and as the presigned PUT's required Content-Type. */
  @IsString()
  contentType: string;
}
