import { IsString, MinLength } from 'class-validator';

export class AcceptConsentDto {
  @IsString()
  @MinLength(1)
  consentType: string;

  @IsString()
  @MinLength(1)
  version: string;
}
