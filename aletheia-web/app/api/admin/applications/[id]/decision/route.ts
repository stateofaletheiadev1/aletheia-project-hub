import { body, json, oneOf, route, str } from '@/lib/server/http';
import { requireOfficer } from '@/lib/server/officers';
import { decideApplication } from '@/lib/server/registry';

export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { officer } = await requireOfficer(req);
  const { id } = await params;
  const b = await body(req);
  const app = await decideApplication(id, oneOf(b, 'decision', ['approve', 'reject'] as const), str(b, 'note', { max: 500, optional: true }), officer);
  return json({ application: { id: app._id, reference: app.reference, status: app.status } });
});
