import { json, route } from '@/lib/server/http';
import { requireOfficer } from '@/lib/server/officers';
import { collection } from '@/lib/server/db';
import { AUDIT_CATEGORIES, type AuditCategory, type AuditEvent } from '@/lib/server/records';

export const GET = route(async (req) => {
  await requireOfficer(req);
  const category = req.nextUrl.searchParams.get('category');
  const filter = category && AUDIT_CATEGORIES.includes(category as AuditCategory) ? { category } : {};
  const { documents } = await collection<AuditEvent>('audit_events').find(filter, { sort: { at: -1 }, limit: 200 });
  return json({
    categories: AUDIT_CATEGORIES,
    events: documents.map((e) => ({ id: e._id, timestamp: e.at, actor: e.actor, category: e.category, action: e.action, hash: e.hash, outcome: e.outcome })),
  });
});
