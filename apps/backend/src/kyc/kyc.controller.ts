import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { SubjectType } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequireSubject } from '../common/decorators/require-subject.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { Permission } from '../rbac/permissions';
import { KycService } from './kyc.service';
import { SubmitKycDocumentDto, VerifyKycDocumentDto } from './dto/kyc.dto';

@UseGuards(JwtAuthGuard)
@Controller({ path: 'kyc', version: '1' })
export class KycController {
  constructor(private readonly kyc: KycService) {}

  @RequireSubject(SubjectType.STAFF)
  @RequirePermissions(Permission.KYC_CAPTURE)
  @Post('customers/:customerId/records')
  submit(
    @Param('customerId') customerId: string,
    @Body() dto: SubmitKycDocumentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.kyc.submit(customerId, dto, user);
  }

  @RequireSubject(SubjectType.STAFF)
  @RequirePermissions(Permission.KYC_VERIFY)
  @Post('records/:id/verify')
  verify(@Param('id') id: string, @Body() dto: VerifyKycDocumentDto, @CurrentUser() user: AuthUser) {
    return this.kyc.verify(id, dto.decision, dto.rejectionReason, user);
  }

  /** Works for both a customer viewing their own status and staff viewing a customer's (branch-scoped). */
  @Get('customers/:customerId/records')
  listForCustomer(@Param('customerId') customerId: string, @CurrentUser() user: AuthUser) {
    return this.kyc.listForCustomer(customerId, user);
  }

  @RequireSubject(SubjectType.CUSTOMER)
  @Get('me')
  myRecords(@CurrentUser() user: AuthUser) {
    return this.kyc.listForCustomer(user.id, user);
  }
}
