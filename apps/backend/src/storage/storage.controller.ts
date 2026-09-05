import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { StorageService } from './storage.service';
import { PresignUploadDto } from './dto/storage.dto';

/**
 * No @RequireSubject here deliberately - both STAFF (capturing a customer's
 * photo/KYC doc in the Business App) and CUSTOMER (uploading their own
 * profile photo) are allowed to request an upload URL.
 */
@UseGuards(JwtAuthGuard)
@Controller({ path: 'uploads', version: '1' })
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  @Post('presign')
  presign(@Body() dto: PresignUploadDto, @CurrentUser() user: AuthUser) {
    return this.storage.createUploadUrl(dto.purpose, dto.contentType, user.id);
  }
}
