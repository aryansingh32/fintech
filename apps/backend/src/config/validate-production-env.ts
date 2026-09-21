const PLACEHOLDER_MARKERS = ['change-me', 'changeme', 'replace', 'example', 'test-secret'];

function isWeakSecret(value: string | undefined): boolean {
  if (!value || value.length < 32) return true;
  const lower = value.toLowerCase();
  return PLACEHOLDER_MARKERS.some((marker) => lower.includes(marker));
}

/**
 * Fails fast on boot rather than letting a misconfigured production deploy
 * run with default/placeholder secrets or no delivery providers wired up -
 * those are silent-failure modes that are much worse discovered at runtime.
 */
export function validateProductionEnv(env: NodeJS.ProcessEnv): void {
  if (env.NODE_ENV !== 'production') return;

  const problems: string[] = [];

  if (isWeakSecret(env.JWT_ACCESS_SECRET)) {
    problems.push('JWT_ACCESS_SECRET is missing, too short, or a placeholder value.');
  }
  if (isWeakSecret(env.JWT_REFRESH_SECRET)) {
    problems.push('JWT_REFRESH_SECRET is missing, too short, or a placeholder value.');
  }
  if (env.JWT_ACCESS_SECRET && env.JWT_REFRESH_SECRET && env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
    problems.push('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must not be the same value.');
  }
  if (!env.DATABASE_URL) {
    problems.push('DATABASE_URL is not set.');
  }
  if (!env.CORS_ORIGINS) {
    problems.push('CORS_ORIGINS is not set - the API would reject every browser-based request.');
  }
  if (env.SMS_PROVIDER && env.SMS_PROVIDER !== 'twilio') {
    problems.push(`Unsupported SMS_PROVIDER "${env.SMS_PROVIDER}" - only "twilio" is implemented.`);
  }
  if (env.PUSH_PROVIDER && !['expo', 'fcm'].includes(env.PUSH_PROVIDER)) {
    problems.push(`Unsupported PUSH_PROVIDER "${env.PUSH_PROVIDER}" - only "expo" and "fcm" are implemented.`);
  }
  if (env.PUSH_PROVIDER === 'fcm' && !env.FIREBASE_SERVICE_ACCOUNT_JSON && !env.GOOGLE_APPLICATION_CREDENTIALS) {
    problems.push('PUSH_PROVIDER=fcm requires FIREBASE_SERVICE_ACCOUNT_JSON (or GOOGLE_APPLICATION_CREDENTIALS) to be set.');
  }
  if (env.PAYMENT_GATEWAY_PROVIDER && env.PAYMENT_GATEWAY_PROVIDER !== 'razorpay') {
    problems.push(
      `Unsupported PAYMENT_GATEWAY_PROVIDER "${env.PAYMENT_GATEWAY_PROVIDER}" - only "razorpay" is implemented.`,
    );
  }
  if (env.STORAGE_PROVIDER && env.STORAGE_PROVIDER !== 'r2') {
    problems.push(`Unsupported STORAGE_PROVIDER "${env.STORAGE_PROVIDER}" - only "r2" is implemented.`);
  }

  // Backups are mandatory in production - this is a financial ledger, not
  // something to run without a tested daily copy. BACKUP_R2_BUCKET_NAME
  // must be a SEPARATE, private bucket from R2_BUCKET_NAME (which is
  // served publicly via R2_PUBLIC_BASE_URL) so encrypted backups are never
  // reachable by a guessable public URL.
  if (isWeakSecret(env.BACKUP_ENCRYPTION_PASSPHRASE)) {
    problems.push('BACKUP_ENCRYPTION_PASSPHRASE is missing, too short, or a placeholder value.');
  }
  if (!env.BACKUP_R2_BUCKET_NAME) {
    problems.push('BACKUP_R2_BUCKET_NAME is not set - daily database backups have nowhere to go.');
  }
  if (env.BACKUP_R2_BUCKET_NAME && env.BACKUP_R2_BUCKET_NAME === env.R2_BUCKET_NAME) {
    problems.push('BACKUP_R2_BUCKET_NAME must be a different, private bucket from R2_BUCKET_NAME (which is public via R2_PUBLIC_BASE_URL).');
  }
  if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
    problems.push('R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY are required for backups even if STORAGE_PROVIDER is unset.');
  }

  if (problems.length > 0) {
    throw new Error(
      `Refusing to start in production with an unsafe configuration:\n` +
        problems.map((p) => `  - ${p}`).join('\n'),
    );
  }
}
