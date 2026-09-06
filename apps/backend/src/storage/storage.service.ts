import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { UploadPurpose } from './dto/storage.dto';

const KEY_PREFIX: Record<UploadPurpose, string> = {
  [UploadPurpose.CUSTOMER_PHOTO]: 'customer-photos',
  [UploadPurpose.REFERENCE_PHOTO]: 'reference-photos',
  [UploadPurpose.KYC_DOCUMENT]: 'kyc-documents',
  [UploadPurpose.SUPPORT_ATTACHMENT]: 'support-attachments',
};

const PRESIGN_TTL_SECONDS = 300;

/**
 * Cloudflare R2 (S3-compatible) object storage for customer/reference
 * photos and KYC document scans. Clients upload directly to R2 via a
 * short-lived presigned PUT URL - binary bytes never transit this API
 * process. Fails closed (throws) rather than silently no-op-ing when
 * unconfigured, matching the SMS/payment-gateway provider pattern.
 *
 * Configure via: STORAGE_PROVIDER=r2, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID,
 * R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_BASE_URL.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private client: S3Client | null = null;

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return (
      this.config.get<string>('STORAGE_PROVIDER') === 'r2' &&
      Boolean(this.config.get<string>('R2_ACCOUNT_ID')) &&
      Boolean(this.config.get<string>('R2_ACCESS_KEY_ID')) &&
      Boolean(this.config.get<string>('R2_SECRET_ACCESS_KEY')) &&
      Boolean(this.config.get<string>('R2_BUCKET_NAME')) &&
      Boolean(this.config.get<string>('R2_PUBLIC_BASE_URL'))
    );
  }

  private getClient(): S3Client {
    if (this.client) return this.client;
    const accountId = this.config.get<string>('R2_ACCOUNT_ID')!;
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: this.config.get<string>('R2_ACCESS_KEY_ID')!,
        secretAccessKey: this.config.get<string>('R2_SECRET_ACCESS_KEY')!,
      },
    });
    return this.client;
  }

  async createUploadUrl(
    purpose: UploadPurpose,
    contentType: string,
    subjectId: string,
  ): Promise<{ uploadUrl: string; publicUrl: string; key: string }> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException('File storage is not configured.');
    }
    const bucket = this.config.get<string>('R2_BUCKET_NAME')!;
    const publicBase = this.config.get<string>('R2_PUBLIC_BASE_URL')!.replace(/\/+$/, '');
    const extension = extensionFor(contentType);
    const key = `${KEY_PREFIX[purpose]}/${subjectId}/${randomUUID()}${extension}`;

    try {
      const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType });
      const uploadUrl = await getSignedUrl(this.getClient(), command, { expiresIn: PRESIGN_TTL_SECONDS });
      return { uploadUrl, publicUrl: `${publicBase}/${key}`, key };
    } catch (err) {
      this.logger.error(`Failed to presign R2 upload: ${(err as Error).message}`);
      throw new ServiceUnavailableException('Could not prepare file upload right now. Please try again.');
    }
  }
}

function extensionFor(contentType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/heic': '.heic',
    'application/pdf': '.pdf',
  };
  return map[contentType] ?? '';
}
