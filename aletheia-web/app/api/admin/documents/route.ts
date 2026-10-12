import { json, route } from '@/lib/server/http';
import { requireOfficer } from '@/lib/server/officers';
import { documents, documentView } from '@/lib/server/documents';

export const GET = route(async (req) => {
  await requireOfficer(req);
  const { documents: list } = await documents().find({ direction: 'submitted' }, { sort: { createdAt: -1 }, limit: 500 });
  return json({ documents: list.map(documentView) });
});
