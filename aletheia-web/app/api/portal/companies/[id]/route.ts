import { body, json, route } from '@/lib/server/http';
import { requireAccount } from '@/lib/server/accounts';
import { companyInput, companyView, refileCompany } from '@/lib/server/companies';

export const PUT = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { account } = await requireAccount(req);
  const { id } = await params;
  const company = await refileCompany(account, id, companyInput(await body(req)));
  return json({ company: companyView(company) });
});
