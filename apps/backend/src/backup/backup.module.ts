import { Module } from '@nestjs/common';
import { BackupService } from './backup.service';
import { BackupController } from './backup.controller';
import { GoogleDriveService } from './google-drive.service';

@Module({
  controllers: [BackupController],
  providers: [BackupService, GoogleDriveService],
  exports: [BackupService],
})
export class BackupModule {}
