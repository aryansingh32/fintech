import { StaffRole } from '@prisma/client';
import { IsEnum, IsOptional, IsString, Length, MinLength } from 'class-validator';

export class CreateStaffDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @Length(10, 15)
  mobile: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsEnum(StaffRole)
  role: StaffRole;

  @IsOptional()
  @IsString()
  branchId?: string;
}

export class RejectStaffDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
