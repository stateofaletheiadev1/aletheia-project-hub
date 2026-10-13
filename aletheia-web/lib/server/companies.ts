import 'server-only';
import type { Doc } from '@aletheia/aletheiadb';
import { collection } from './db';
import { fail, oneOf, str } from './http';
import { accountPii, type StoredAccount } from './accounts';
import { ERASED, openFields, sealFields, type Sealed } from './envelope';
import type { StoredOfficer } from './officers';
import { audit, nextNumber, notify } from './records';
import { issueDocument } from './documents';

// The commercial register: formations filed from the portal, reviewed by officers. The
// company's name, form, capital and purpose are register facts; the founder's name and the
// beneficial owners are personal data, sealed under the founder's key.

export const STRUCTURES = ['SARL (Limited)', 'AG (Corporation)', 'Maritime Trust'] as const;
export type Structure = (typeof STRUCTURES)[number];
export type CompanyStatus = 'Pending Review' | 'Active / Chartered' | 'Changes Requested';

export type Company = {
  regNumber: string;
  name: string;
  structure: Structure;
  accountId: string;
  subject: string;
  /** { founder, beneficialOwners } */
  sealed: Sealed;
  shareCapital: number;
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
  const { beneficialOwners, ...facts } = input;
  const c = await companies().insertOne({
    ...facts,
    regNumber,
    accountId: account._id,
    subject: account.subject,
    sealed: await sealFields(account.subject, { founder: (await accountPii(account)).name, beneficialOwners }, 'companies'),
    status: 'Pending Review',
    submittedAt: new Date().toISOString(),
    decidedAt: null,
    decidedBy: null,
    note: null,
  });
  await audit({ category: 'Incorporation', actor: account.aletheiaId, actorId: account._id, subjectAccountId: account._id, action: `Filed formation of ${input.name} (${regNumber})` });
  return c;
}

export async function refileCompany(account: StoredAccount, id: string, input: CompanyInput): Promise<Doc<Company>> {
  const c = await companies().findById(id);
  if (!c || c.accountId !== account._id) return fail(404, 'No such company.');
  if (c.status !== 'Changes Requested') return fail(409, 'Only a filing with requested changes can be amended.');
  const { beneficialOwners, ...facts } = input;
  const updated = await companies().updateOne(c._id, c._rev, {
    $set: { ...facts, sealed: await sealFields(c.subject, { founder: (await accountPii(account)).name, beneficialOwners }, 'companies'), status: 'Pending Review', submittedAt: new Date().toISOString() },
  });
  await audit({ category: 'Incorporation', actor: account.aletheiaId, actorId: account._id, subjectAccountId: account._id, action: `Amended formation of ${input.name} (${c.regNumber})` });
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
    await issueDocument({ accountId: c.accountId, kind: 'company-charter', name: `${c.name.replace(/[^\w]+/g, '_')}_Charter.pdf`, docType: 'Commercial Register Charter', authority: 'Registrar of Companies', relatedId: c._id });
  }
  await notify({
    accountId: c.accountId,
    title: decision === 'approve' ? 'Company chartered' : 'Changes requested to your company filing',
    message: decision === 'approve' ? `${c.name} has been entered into the commercial register (${c.regNumber}).` : `The Registrar asks for changes to ${c.name} (${c.regNumber}): ${note}`,
    category: 'Corporate',
    linkText: 'View your companies',
    linkHref: '/portal/companies',
  });
  await audit({ category: 'Incorporation', actor: officer.officerId, actorId: officer._id, subjectAccountId: c.accountId, action: `${decision === 'approve' ? 'Chartered' : 'Requested changes to'} ${c.name} (${c.regNumber})` });
  return updated;
}

export async function companyView(c: Doc<Company>) {
  const { founder, beneficialOwners } = await openFields(c.subject, c.sealed, 'companies', { founder: ERASED, beneficialOwners: ERASED });
  return {
    id: c._id,
    regNumber: c.regNumber,
    name: c.name,
    structure: c.structure,
    founder,
    shareCapital: c.shareCapital,
    beneficialOwners,
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
