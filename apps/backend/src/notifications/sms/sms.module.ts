import { Global, Module } from '@nestjs/common';
import { SmsProviderService } from './sms-provider.service';

@Global()
@Module({
  providers: [SmsProviderService],
  exports: [SmsProviderService],
})
export class SmsModule {}
