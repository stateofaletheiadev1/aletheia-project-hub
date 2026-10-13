import { json, route } from '@/lib/server/http';
import { requireOfficer } from '@/lib/server/officers';
import { AUDIT_CATEGORIES, recentAudit, type AuditCategory } from '@/lib/server/records';

/** The audit trail, newest first, 100 per page; `before` is the cursor from the previous page. */
export const GET = route(async (req) => {
  await requireOfficer(req);
  const category = req.nextUrl.searchParams.get('category');
  const filter = category && AUDIT_CATEGORIES.includes(category as AuditCategory) ? { category } : {};
  const { events, next } = await recentAudit(filter, { limit: 100, before: req.nextUrl.searchParams.get('before') });
  return json({
    categories: AUDIT_CATEGORIES,
    events: events.map((e) => ({ id: e._id, timestamp: e.at, actor: e.actor, category: e.category, action: e.action, hash: e.hash, outcome: e.outcome })),
    next,
  });
});
