import { json, route } from '@/lib/server/http';
import { requireOfficer } from '@/lib/server/officers';
import { citizens, citizenView } from '@/lib/server/registry';

export const GET = route(async (req) => {
  await requireOfficer(req);
  const { documents } = await citizens().find({}, { sort: { registeredDate: -1 }, limit: 1000 });
  return json({ citizens: await Promise.all(documents.map(citizenView)) });
});
