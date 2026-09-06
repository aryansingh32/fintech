import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Min, MinLength, ValidateIf, ValidateNested } from 'class-validator';
import { SupportCategory, SupportTicketStatus } from '@prisma/client';

export class AttachmentInputDto {
  @IsString()
  url: string;

  @IsString()
  mimeType: string;

  @IsInt()
  @Min(0)
  sizeBytes: number;
}

/** message is only required when there's no attachment - lets a customer send just a photo, WhatsApp-style. */
export class CreateTicketDto {
  @IsEnum(SupportCategory)
  category: SupportCategory;

  @ValidateIf((dto: CreateTicketDto) => !dto.attachment)
  @IsString()
  @MinLength(1)
  message?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AttachmentInputDto)
  attachment?: AttachmentInputDto;
}

export class AddMessageDto {
  @ValidateIf((dto: AddMessageDto) => !dto.attachment)
  @IsString()
  @MinLength(1)
  message?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AttachmentInputDto)
  attachment?: AttachmentInputDto;
}

export class AssignTicketDto {
  @IsUUID()
  staffId: string;
}

export class UpdateTicketStatusDto {
  @IsEnum(SupportTicketStatus)
  status: SupportTicketStatus;
}

export class EscalateTicketDto {
  @IsString()
  reason: string;
}
