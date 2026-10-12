import { body, json, oneOf, route } from '@/lib/server/http';
import { requireOfficer } from '@/lib/server/officers';
import { decideRescission } from '@/lib/server/registry';

export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { officer } = await requireOfficer(req, { administrator: true });
  const { id } = await params;
  const r = await decideRescission(id, oneOf(await body(req), 'decision', ['rescind', 'dismiss'] as const), officer);
  return json({ case: { id: r._id, reference: r.reference, status: r.status } });
});
