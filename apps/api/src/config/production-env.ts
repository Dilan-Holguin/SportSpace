const PLACEHOLDER_SECRET = /^change-me/i;
const LOOPBACK_ORIGIN = /localhost|127\.0\.0\.1/i;

const REQUIRED_SECRETS = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const;

export function assertProductionSecrets(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV !== 'production') {
    return;
  }

  const invalid: string[] = [];

  for (const key of REQUIRED_SECRETS) {
    const value = env[key] ?? '';
    if (!value.trim() || PLACEHOLDER_SECRET.test(value)) {
      invalid.push(key);
    }
  }

  if (
    env.JWT_ACCESS_SECRET &&
    env.JWT_REFRESH_SECRET &&
    env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET
  ) {
    invalid.push('JWT_REFRESH_SECRET (must differ from JWT_ACCESS_SECRET)');
  }

  const origin = env.WEB_ORIGIN ?? '';
  if (!origin.trim() || LOOPBACK_ORIGIN.test(origin)) {
    invalid.push('WEB_ORIGIN');
  }

  if (invalid.length > 0) {
    throw new Error(
      `Production requires unique JWT secrets and a public WEB_ORIGIN. Invalid: ${invalid.join(', ')}`,
    );
  }

  if (!env.ADMIN_PASSWORD || env.ADMIN_PASSWORD === 'Admin1234') {
    console.warn(
      'ADMIN_PASSWORD is still the development default; change it before exposing the host.',
    );
  }
}
