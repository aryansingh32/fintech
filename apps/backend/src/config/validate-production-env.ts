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
  if (env.PAYMENT_GATEWAY_PROVIDER && env.PAYMENT_GATEWAY_PROVIDER !== 'razorpay') {
    problems.push(
      `Unsupported PAYMENT_GATEWAY_PROVIDER "${env.PAYMENT_GATEWAY_PROVIDER}" - only "razorpay" is implemented.`,
    );
  }

  if (problems.length > 0) {
    throw new Error(
      `Refusing to start in production with an unsafe configuration:\n` +
        problems.map((p) => `  - ${p}`).join('\n'),
    );
  }
}
