/**
 * Splits a Postgres connection URL into the standard libpq environment
 * variables (PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE) instead of passing
 * it as a pg_dump argument - argv is visible to anyone on the box via `ps`,
 * env vars of another process are not.
 */
export function pgEnvFromUrl(databaseUrl: string): NodeJS.ProcessEnv {
  const url = new URL(databaseUrl);
  return {
    PGHOST: url.hostname,
    PGPORT: url.port || '5432',
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: url.pathname.replace(/^\//, ''),
  };
}
