import { Type } from 'class-transformer';
import { IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { DeviceInfoDto } from './device-info.dto';

export class GoogleLoginDto {
  /** Firebase ID token obtained client-side from Google Sign-In, verified server-side via Firebase Admin. */
  @IsString()
  @IsNotEmpty()
  idToken: string;

  @ValidateNested()
  @Type(() => DeviceInfoDto)
  device: DeviceInfoDto;
}
