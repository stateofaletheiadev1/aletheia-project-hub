import { json, route } from '@/lib/server/http';
import { officerView, requireOfficer } from '@/lib/server/officers';

export const GET = route(async (req) => {
  const { officer } = await requireOfficer(req);
  return json({ officer: officerView(officer) });
});
