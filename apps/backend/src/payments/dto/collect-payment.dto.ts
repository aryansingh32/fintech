import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { AllocationComponent, PaymentMethod } from '@prisma/client';

export class AllocationLineDto {
  @IsEnum(AllocationComponent)
  component: AllocationComponent;

  @IsOptional()
  @IsUUID()
  installmentId?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number;
}

export class CollectPaymentDto {
  @IsUUID()
  loanId: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number;

  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @IsOptional()
  @IsString()
  referenceId?: string;

  @IsString()
  idempotencyKey: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AllocationLineDto)
  allocation?: AllocationLineDto[];

  /** Set by the staff app when a payment was originally recorded offline. */
  @IsOptional()
  @IsString()
  clientTransactionId?: string;
}

export class ReversePaymentDto {
  @IsString()
  reason: string;
}
