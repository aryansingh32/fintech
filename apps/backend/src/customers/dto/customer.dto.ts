import { IsOptional, IsString, Length } from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  @Length(10, 15)
  mobile: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  addressLine1?: string;

  @IsOptional()
  @IsString()
  addressLine2?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  pincode?: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;

  @IsOptional()
  @IsString()
  referenceName?: string;

  @IsOptional()
  @IsString()
  referenceMobile?: string;

  @IsOptional()
  @IsString()
  referencePhotoUrl?: string;
}

export class UpdateCustomerDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  addressLine1?: string;

  @IsOptional()
  @IsString()
  addressLine2?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  pincode?: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;

  @IsOptional()
  @IsString()
  referenceName?: string;

  @IsOptional()
  @IsString()
  referenceMobile?: string;

  @IsOptional()
  @IsString()
  referencePhotoUrl?: string;
}

export class DeleteCustomerDto {
  @IsString()
  currentPassword: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class AddCustomerNoteDto {
  @IsString()
  note: string;
}

export class SearchCustomerDto {
  @IsString()
  query: string;
}
