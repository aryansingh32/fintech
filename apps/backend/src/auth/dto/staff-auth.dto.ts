import { Type } from 'class-transformer';
import { IsString, Length, MinLength, ValidateNested } from 'class-validator';
import { DeviceInfoDto } from './device-info.dto';

export class StaffLoginDto {
  @IsString()
  @Length(10, 15)
  mobile: string;

  @IsString()
  @MinLength(8)
  password: string;

  @ValidateNested()
  @Type(() => DeviceInfoDto)
  device: DeviceInfoDto;
}

export class VerifyStaffDeviceOtpDto {
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
