import { json, route } from '@/lib/server/http';
import { requireOfficer } from '@/lib/server/officers';
import { citizens } from '@/lib/server/registry';

export const GET = route(async (req) => {
  await requireOfficer(req);
  const { documents } = await citizens().find({}, { sort: { registeredDate: -1 }, limit: 1000 });
  return json({
    citizens: documents.map((c) => ({
      id: c._id,
      nationalId: c.nationalId,
      name: c.name,
      type: c.type,
      passportNumber: c.passportNumber,
      nationalityOfOrigin: c.nationalityOfOrigin,
      registeredDate: c.registeredDate,
      status: c.status,
      covenantHash: c.covenantHash,
    })),
  });
});
