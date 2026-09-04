import { IsIn, IsInt, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Min } from 'class-validator';

export class CreateLoanDto {
  @IsUUID()
  customerId: string;

  @IsOptional()
  @IsUUID()
  productIdentifierId?: string;

  @IsUUID()
  loanProductVersionId: string;

  @IsNumber()
  @IsPositive()
  cashPrice: number;

  @IsNumber()
  @Min(0)
  downPaymentAmount: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pendingUdhaarAmount?: number;

  @IsInt()
  @Min(1)
  numberOfInstallments: number;

  @IsOptional()
  @IsString()
  startDate?: string; // ISO date; defaults to now
}

export class ApproveLoanDto {
  @IsIn(['APPROVED', 'DECLINED', 'MANUAL_REVIEW'])
  decision: 'APPROVED' | 'DECLINED' | 'MANUAL_REVIEW';

  @IsOptional()
  @IsString()
  reason?: string;
}
