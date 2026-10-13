import { json, route } from '@/lib/server/http';
import { officers, requireOfficer } from '@/lib/server/officers';
import { accounts } from '@/lib/server/accounts';
import { collection } from '@/lib/server/db';
import { auditEvents, recentAudit } from '@/lib/server/records';

export const GET = route(async (req) => {
  await requireOfficer(req);
  const now = Date.now();
  const iso = new Date(now).toISOString();
  const days = [0, 1].map((d) => new Date(now - d * 86_400_000).toISOString().slice(0, 10));
  const sessions = collection<{ kind: string; expiresAt: string }>('sessions');
  const [officerSessions, portalSessions, lockedAccounts, lockedOfficers, failed, events, officerCount] = await Promise.all([
    sessions.count({ kind: 'officer', expiresAt: { $gt: iso } }),
    sessions.count({ kind: 'citizen', expiresAt: { $gt: iso } }),
    accounts().count({ lockedUntil: { $gt: iso } }),
    officers().count({ lockedUntil: { $gt: iso } }),
    auditEvents().count({ day: { $in: days }, category: 'Security', outcome: 'failure', at: { $gt: new Date(now - 86_400_000).toISOString() } }),
    recentAudit({ category: 'Security' }, { limit: 20, maxDays: 90 }),
    officers().count({ disabled: false }),
  ]);
  return json({
    metrics: { officerSessions, portalSessions, locked: lockedAccounts + lockedOfficers, failedSignIns24h: failed, officers: officerCount },
    events: events.events.map((e) => ({ id: e._id, at: e.at, action: e.action, actor: e.actor, outcome: e.outcome })),
  });
});
