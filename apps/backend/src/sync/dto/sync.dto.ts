import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { CollectPaymentDto } from '../../payments/dto/collect-payment.dto';

/** clientTransactionId is required here (not optional as in the online DTO) - it IS the sync dedup key. */
export class OfflinePaymentDto extends CollectPaymentDto {
  @IsString()
  clientTransactionId: string;
}

export class SyncPaymentsBatchDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OfflinePaymentDto)
  payments: OfflinePaymentDto[];
}

export class PullSinceDto {
  @IsOptional()
  @IsString()
  since?: string;
}
