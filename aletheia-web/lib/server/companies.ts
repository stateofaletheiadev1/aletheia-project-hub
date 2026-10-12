import 'server-only';
import type { Doc } from '@aletheia/aletheiadb';
import { collection } from './db';
import { fail, oneOf, str } from './http';
import type { StoredAccount } from './accounts';
import type { StoredOfficer } from './officers';
import { audit, nextNumber, notify } from './records';
import { issueDocument } from './documents';

// The commercial register: formations filed from the portal, reviewed by officers.

export const STRUCTURES = ['SARL (Limited)', 'AG (Corporation)', 'Maritime Trust'] as const;
export type Structure = (typeof STRUCTURES)[number];
export type CompanyStatus = 'Pending Review' | 'Active / Chartered' | 'Changes Requested';

export type Company = {
  regNumber: string;
  name: string;
  structure: Structure;
  accountId: string;
  founder: string;
  shareCapital: number;
  beneficialOwners: string;
  purpose: string;
  status: CompanyStatus;
  submittedAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
  note: string | null;
};

export const companies = () => collection<Company>('companies');

const CODE: Record<Structure, string> = { 'SARL (Limited)': 'SARL', 'AG (Corporation)': 'AG', 'Maritime Trust': 'TRUST' };

export type CompanyInput = { name: string; structure: Structure; shareCapital: number; beneficialOwners: string; purpose: string };

export async function fileCompany(account: StoredAccount, input: CompanyInput): Promise<Doc<Company>> {
  if (account.status !== 'e-resident' && account.status !== 'citizen') fail(403, 'Companies can be formed by e-residents and citizens. Apply for e-residency first.');
  const year = new Date().getUTCFullYear();
  const code = CODE[input.structure];
  const regNumber = `ALE-${code}-${year}-${String(await nextNumber(`company-${code}-${year}`)).padStart(4, '0')}`;
  const c = await companies().insertOne({
    ...input,
    regNumber,
    accountId: account._id,
    founder: account.name,
    status: 'Pending Review',
    submittedAt: new Date().toISOString(),
    decidedAt: null,
    decidedBy: null,
    note: null,
  });
  await audit({ category: 'Incorporation', actor: account.name, actorId: account._id, subjectAccountId: account._id, action: `Filed formation of ${input.name} (${regNumber})` });
  return c;
}

export async function refileCompany(account: StoredAccount, id: string, input: CompanyInput): Promise<Doc<Company>> {
  const c = await companies().findById(id);
  if (!c || c.accountId !== account._id) return fail(404, 'No such company.');
  if (c.status !== 'Changes Requested') return fail(409, 'Only a filing with requested changes can be amended.');
  const updated = await companies().updateOne(c._id, c._rev, { $set: { ...input, status: 'Pending Review', submittedAt: new Date().toISOString() } });
  await audit({ category: 'Incorporation', actor: account.name, actorId: account._id, subjectAccountId: account._id, action: `Amended formation of ${input.name} (${c.regNumber})` });
  return updated;
}

export async function decideCompany(id: string, decision: 'approve' | 'request-changes', note: string, officer: StoredOfficer): Promise<Doc<Company>> {
  const c = await companies().findById(id);
  if (!c) return fail(404, 'No such company.');
  if (c.status !== 'Pending Review') return fail(409, 'This filing is not waiting for review.');
  if (decision === 'request-changes' && !note) return fail(400, 'Say which changes are needed.');
  const updated = await companies().updateOne(c._id, c._rev, {
    $set: { status: decision === 'approve' ? 'Active / Chartered' : 'Changes Requested', decidedAt: new Date().toISOString(), decidedBy: officer.officerId, note: note || null },
  });
  if (decision === 'approve') {
    await issueDocument({ accountId: c.accountId, holder: c.founder, kind: 'company-charter', name: `${c.name.replace(/[^\w]+/g, '_')}_Charter.pdf`, docType: 'Commercial Register Charter', authority: 'Registrar of Companies', relatedId: c._id });
  }
  await notify({
    accountId: c.accountId,
    title: decision === 'approve' ? 'Company chartered' : 'Changes requested to your company filing',
    message: decision === 'approve' ? `${c.name} has been entered into the commercial register (${c.regNumber}).` : `The Registrar asks for changes to ${c.name} (${c.regNumber}): ${note}`,
    category: 'Corporate',
    linkText: 'View your companies',
    linkHref: '/portal/companies',
  });
  await audit({ category: 'Incorporation', actor: officer.name, actorId: officer._id, subjectAccountId: c.accountId, action: `${decision === 'approve' ? 'Chartered' : 'Requested changes to'} ${c.name} (${c.regNumber})` });
  return updated;
}

export function companyView(c: Doc<Company>) {
  return {
    id: c._id,
    regNumber: c.regNumber,
    name: c.name,
    structure: c.structure,
    founder: c.founder,
    shareCapital: c.shareCapital,
    beneficialOwners: c.beneficialOwners,
    purpose: c.purpose,
    status: c.status,
    submittedAt: c.submittedAt,
    decidedAt: c.decidedAt,
    note: c.note,
  };
}

export function companyInput(b: Record<string, unknown>): CompanyInput {
  const shareCapital = Number(b.shareCapital);
  if (!Number.isFinite(shareCapital) || shareCapital < 1 || shareCapital > 1e12) fail(400, 'Share capital must be a positive number of AEY.');
  return {
    name: str(b, 'name', { max: 120, label: 'Company name' }),
    structure: oneOf(b, 'structure', STRUCTURES),
    shareCapital: Math.round(shareCapital * 100) / 100,
    beneficialOwners: str(b, 'beneficialOwners', { max: 500, label: 'Beneficial owners' }),
    purpose: str(b, 'purpose', { max: 500, label: 'Purpose' }),
  };
}
