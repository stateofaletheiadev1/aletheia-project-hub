import { json, route } from '@/lib/server/http';
import { requireOfficer } from '@/lib/server/officers';
import { companies, companyView } from '@/lib/server/companies';

export const GET = route(async (req) => {
  await requireOfficer(req);
  const { documents } = await companies().find({}, { sort: { submittedAt: -1 }, limit: 500 });
  return json({ companies: documents.map(companyView) });
});
