import { json, route } from '@/lib/server/http';
import { requireOfficer } from '@/lib/server/officers';
import { applications, applicationView } from '@/lib/server/registry';
import { kycStatus } from '@/lib/server/documents';

export const GET = route(async (req) => {
  await requireOfficer(req);
  const type = req.nextUrl.searchParams.get('type');
  const filter: Record<string, unknown> = {};
  if (type === 'e-residency' || type === 'citizenship') filter.type = type;
  const { documents: list } = await applications().find(filter, { sort: { submittedAt: -1 }, limit: 200 });
  const rows = await Promise.all(
    list.map(async (a) => {
      const kyc = await kycStatus(a.accountId);
      return { ...(await applicationView(a)), kycStatus: kyc.status, documentCount: kyc.count };
    }),
  );
  return json({ applications: rows });
});
