import { IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class CreateProductDto {
  @IsString()
  brand: string;

  @IsString()
  model: string;

  @IsString()
  category: string;

  @IsString()
  sku: string;

  @IsNumber()
  @IsPositive()
  purchasePrice: number;

  @IsNumber()
  @IsPositive()
  sellingPrice: number;

  @IsNumber()
  @IsPositive()
  financePrice: number;

  @IsOptional()
  @IsNumber()
  warrantyMonths?: number;
}

export class CreateProductIdentifierDto {
  @IsOptional()
  @IsString()
  imei1?: string;

  @IsOptional()
  @IsString()
  imei2?: string;

  @IsOptional()
  @IsString()
  serialNumber?: string;
}
