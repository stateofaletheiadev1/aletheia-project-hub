import { body, json, route } from '@/lib/server/http';
import { requireAccount } from '@/lib/server/accounts';
import { companies, companyInput, companyView, fileCompany } from '@/lib/server/companies';

export const GET = route(async (req) => {
  const { account } = await requireAccount(req);
  const { documents } = await companies().find({ accountId: account._id }, { sort: { submittedAt: -1 }, limit: 100 });
  return json({ companies: documents.map(companyView) });
});

export const POST = route(async (req) => {
  const { account } = await requireAccount(req);
  const company = await fileCompany(account, companyInput(await body(req)));
  return json({ company: companyView(company) }, 201);
});
