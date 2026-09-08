import { IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class CreateProductDto {
  @IsString()
  brand: string;

  @IsString()
  model: string;

  @IsOptional()
  @IsString()
  specs?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  purchasePrice?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  sellingPrice?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  financePrice?: number;

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
