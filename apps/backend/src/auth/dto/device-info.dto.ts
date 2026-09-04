import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class DeviceInfoDto {
  @IsString()
  @IsNotEmpty()
  deviceIdentifier: string;

  @IsIn(['ANDROID', 'IOS'])
  platform: 'ANDROID' | 'IOS';

  @IsOptional()
  @IsString()
  appVersion?: string;

  @IsOptional()
  @IsString()
  pushToken?: string;
}
