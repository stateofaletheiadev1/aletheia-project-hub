import { json, route } from '@/lib/server/http';
import { officers, requireOfficer } from '@/lib/server/officers';
import { accounts } from '@/lib/server/accounts';
import { collection } from '@/lib/server/db';
import type { AuditEvent } from '@/lib/server/records';

export const GET = route(async (req) => {
  await requireOfficer(req);
  const now = new Date().toISOString();
  const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
  const sessions = collection<{ kind: string; expiresAt: string }>('sessions');
  const audit = collection<AuditEvent>('audit_events');
  const [officerSessions, portalSessions, lockedAccounts, lockedOfficers, failed, events, officerCount] = await Promise.all([
    sessions.count({ kind: 'officer', expiresAt: { $gt: now } }),
    sessions.count({ kind: 'citizen', expiresAt: { $gt: now } }),
    accounts().count({ lockedUntil: { $gt: now } }),
    officers().count({ lockedUntil: { $gt: now } }),
    audit.count({ category: 'Security', outcome: 'failure', at: { $gt: since } }),
    audit.find({ category: 'Security' }, { sort: { at: -1 }, limit: 20 }),
    officers().count({ disabled: false }),
  ]);
  return json({
    metrics: { officerSessions, portalSessions, locked: lockedAccounts + lockedOfficers, failedSignIns24h: failed, officers: officerCount },
    events: events.documents.map((e) => ({ id: e._id, at: e.at, action: e.action, actor: e.actor, outcome: e.outcome })),
  });
});
