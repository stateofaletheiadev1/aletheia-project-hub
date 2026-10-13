import { body, json, oneOf, route, str } from '@/lib/server/http';
import { requireOfficer } from '@/lib/server/officers';
import { documentView, reviewDocument } from '@/lib/server/documents';

export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { officer } = await requireOfficer(req);
  const { id } = await params;
  const b = await body(req);
  const doc = await reviewDocument(id, oneOf(b, 'decision', ['verify', 'flag'] as const), str(b, 'note', { max: 500, optional: true }), officer);
  return json({ document: await documentView(doc) });
});
