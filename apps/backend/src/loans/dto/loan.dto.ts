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

  // Staff-chosen finance-charge override, entered directly at loan-creation
  // time instead of relying on the plan's rate formula.
  @IsOptional()
  @IsNumber()
  @Min(0)
  manualInterestAmount?: number;
}

export class PreviewLoanDto {
  @IsUUID()
  loanProductVersionId: string;

  @IsNumber()
  @IsPositive()
  cashPrice: number;

  @IsNumber()
  @Min(0)
  downPaymentAmount: number;

  @IsInt()
  @Min(1)
  numberOfInstallments: number;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  manualInterestAmount?: number;
}

export class RescheduleInstallmentDto {
  @IsString()
  newDueDate: string; // ISO date

  @IsString()
  reason: string;
}

export class ApplyPenaltyDto {
  @IsNumber()
  @IsPositive()
  amount: number;

  @IsString()
  reason: string;
}

export class ApproveLoanDto {
  @IsIn(['APPROVED', 'DECLINED', 'MANUAL_REVIEW'])
  decision: 'APPROVED' | 'DECLINED' | 'MANUAL_REVIEW';

  @IsOptional()
  @IsString()
  reason?: string;
}
