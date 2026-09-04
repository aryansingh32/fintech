import { Type } from 'class-transformer';
import { IsNotEmpty, IsString, Length, ValidateNested } from 'class-validator';
import { DeviceInfoDto } from './device-info.dto';

export class RequestCustomerOtpDto {
  @IsString()
  @Length(10, 15)
  mobile: string;
}

export class VerifyCustomerOtpDto {
  @IsString()
  @Length(10, 15)
  mobile: string;

  @IsString()
  @Length(6, 6)
  otp: string;

  @ValidateNested()
  @Type(() => DeviceInfoDto)
  device: DeviceInfoDto;
}

export class SetCustomerPinDto {
  @IsString()
  @Length(4, 6)
  pin: string;
}

export class CustomerPinLoginDto {
  @IsString()
  @Length(10, 15)
  mobile: string;

  @IsString()
  @Length(4, 6)
  pin: string;

  @ValidateNested()
  @Type(() => DeviceInfoDto)
  device: DeviceInfoDto;
}

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
