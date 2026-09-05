import { IsEnum, IsString, IsUUID, MinLength } from 'class-validator';
import { SupportCategory, SupportTicketStatus } from '@prisma/client';

export class CreateTicketDto {
  @IsEnum(SupportCategory)
  category: SupportCategory;

  @IsString()
  @MinLength(1)
  message: string;
}

export class AddMessageDto {
  @IsString()
  @MinLength(1)
  message: string;
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
