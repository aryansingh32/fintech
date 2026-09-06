import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateLoanProductDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateLoanProductDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class FeeRuleDto {
  @IsString()
  code: string;

  @IsIn(['FLAT', 'PERCENT_OF_PRINCIPAL'])
  type: 'FLAT' | 'PERCENT_OF_PRINCIPAL';

  @IsNumber()
  amount: number;
}

export class CreateLoanProductVersionDto {
  @IsIn(['FLAT', 'REDUCING', 'ZERO_COST'])
  interestType: 'FLAT' | 'REDUCING' | 'ZERO_COST';

  @IsOptional()
  @IsNumber()
  interestRateAnnual?: number;

  @IsInt()
  @Min(1)
  minInstallments: number;

  @IsInt()
  @Min(1)
  maxInstallments: number;

  @IsIn(['WEEKLY', 'BIWEEKLY', 'MONTHLY'])
  installmentFrequency: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FeeRuleDto)
  feeRules: FeeRuleDto[];

  @IsOptional()
  @IsInt()
  @Min(0)
  gracePeriodDays?: number;

  @IsObject()
  latePaymentRules: Record<string, unknown>;

  @IsObject()
  partialPaymentRules: Record<string, unknown>;

  @IsObject()
  prepaymentRules: Record<string, unknown>;

  @IsObject()
  earlyClosureRules: Record<string, unknown>;

  @IsObject()
  settlementRules: Record<string, unknown>;

  @IsObject()
  waiverRules: Record<string, unknown>;

  @IsObject()
  reversalRules: Record<string, unknown>;
}

/**
 * Versions are immutable once created (existing loans reference a specific
 * version and never re-read it live), so this only allows toggling isActive -
 * that's the safe "edit" of a version: stop offering it for new loans without
 * touching its frozen terms. To change actual terms, create a new version.
 */
export class UpdateLoanProductVersionDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
