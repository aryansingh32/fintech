import { Global, Module } from '@nestjs/common';
import { StaffPermissionsService } from './staff-permissions.service';
import { AccessGuard } from '../common/guards/access.guard';

// Not registered as APP_GUARD here - see AppModule for the single ordered
// list of global guards (Throttler -> JwtAuth -> Access).
@Global()
@Module({
  providers: [StaffPermissionsService, AccessGuard],
  exports: [StaffPermissionsService, AccessGuard],
})
export class RbacModule {}
