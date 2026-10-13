import { databaseStatus } from '@/lib/server/db';
import { encryptionConfigured } from '@/lib/server/envelope';

// Readiness: whether this deployment reaches AletheiaDB with its key, whether the database has
// been set up (npm run db:bootstrap), and whether the personal-data key is present. The portal
// and the officer console work only when all three are "ok"/"configured". Never exposes values,
// hosts or errors.
export const dynamic = 'force-dynamic';

export async function GET() {
  const checks = { database: await databaseStatus(), encryption: encryptionConfigured() ? 'configured' : 'not_configured' } as const;
  const ready = checks.database === 'ok' && checks.encryption === 'configured';
  return Response.json({ status: ready ? 'ok' : 'degraded', checks }, { headers: { 'cache-control': 'no-store' } });
}
