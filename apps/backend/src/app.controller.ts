import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';

@Controller({ path: '', version: '1' })
export class AppController {
  @Public()
  @Get('health')
  health() {
    return { status: 'ok', service: 'sptc-finance-backend', timestamp: new Date().toISOString() };
  }
}
