import { body, json, oneOf, route, str } from '@/lib/server/http';
import { requireOfficer } from '@/lib/server/officers';
import { companyView, decideCompany } from '@/lib/server/companies';

export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { officer } = await requireOfficer(req);
  const { id } = await params;
  const b = await body(req);
  const company = await decideCompany(id, oneOf(b, 'decision', ['approve', 'request-changes'] as const), str(b, 'note', { max: 500, optional: true }), officer);
  return json({ company: companyView(company) });
});
