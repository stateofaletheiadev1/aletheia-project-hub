import 'server-only';
import type { Doc } from '@aletheia/aletheiadb';
import { collection } from './db';
import { sha256 } from './crypto';
import { fail, retryOnConflict } from './http';
import { accounts, type StoredAccount } from './accounts';
import type { StoredOfficer } from './officers';
import { audit, nextNumber, nextReference, notify } from './records';
import { issueDocument } from './documents';

// Applications (e-residency and citizenship), the citizen registry, rescission proceedings
// and border checks.

export type ApplicationType = 'e-residency' | 'citizenship';
export type ApplicationRoute = 'e-residency' | 'naturalisation' | 'investor';
export type DecisionStatus = 'Pending' | 'Approved' | 'Rejected';

export type Application = {
  reference: string;
  type: ApplicationType;
  route: ApplicationRoute;
  investOption: string | null;
  accountId: string;
  applicant: string;
  email: string;
  nationality: string;
  dob: string;
  passportNumber: string;
  purpose: string;
  intendedEntity: string;
  publicKey: string;
  acceptedCovenant: boolean;
  status: DecisionStatus;
  submittedAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
  decisionNote: string | null;
};

export type CitizenType = 'Founding Citizen' | 'Naturalised' | 'Covenant Investor' | 'Covenant Descent' | 'Honorary';
export type CitizenStatus = 'Active' | 'Under Review' | 'Suspended' | 'Rescinded';

export type Citizen = {
  nationalId: string;
  passportNumber: string;
  accountId: string;
  name: string;
  dob: string;
  type: CitizenType;
  nationalityOfOrigin: string;
  registeredDate: string;
  status: CitizenStatus;
  covenantHash: string;
  applicationReference: string;
};

export type RescissionBasis = 'Voluntary Renunciation' | 'Fraudulent Acquisition' | 'Covenant Treason / Sanction' | 'Dual Allegiance Conflict';
export type RescissionStage = 'Hearing Scheduled' | 'Evidence Review' | 'Judicial Finality';
export type Rescission = {
  reference: string;
  nationalId: string;
  citizenName: string;
  basis: RescissionBasis;
  stage: RescissionStage;
  dossierRef: string;
  initiatedDate: string;
  initiatedBy: string;
  status: 'Active Proceeding' | 'Rescinded' | 'Dismissed';
  decidedAt: string | null;
  decidedBy: string | null;
};

export type BorderCrossing = {
  passportNumber: string;
  name: string;
  decision: 'CLEARED' | 'FLAGGED';
  officer: string;
  officerId: string;
  at: string;
};

export const applications = () => collection<Application>('applications');
export const citizens = () => collection<Citizen>('citizens');
export const rescissions = () => collection<Rescission>('rescissions');
const crossings = () => collection<BorderCrossing>('border_crossings');

const PREFIX: Record<ApplicationType, string> = { 'e-residency': 'ERES', citizenship: 'CIT-APP' };

export async function submitApplication(
  account: StoredAccount,
  input: Omit<Application, 'reference' | 'type' | 'accountId' | 'applicant' | 'email' | 'status' | 'submittedAt' | 'decidedAt' | 'decidedBy' | 'decisionNote'>,
): Promise<Doc<Application>> {
  const type: ApplicationType = input.route === 'e-residency' ? 'e-residency' : 'citizenship';
  if (type === 'e-residency' && (account.status === 'e-resident' || account.status === 'citizen')) fail(409, 'You already hold e-residency.');
  if (type === 'citizenship' && account.status === 'citizen') fail(409, 'You are already a citizen.');
  if (await applications().findOne({ accountId: account._id, type, status: 'Pending' })) fail(409, 'You already have an application of this kind under review.');
  const app = await applications().insertOne({
    ...input,
    reference: await nextReference(PREFIX[type]),
    type,
    accountId: account._id,
    applicant: account.name,
    email: account.email,
    status: 'Pending',
    submittedAt: new Date().toISOString(),
    decidedAt: null,
    decidedBy: null,
    decisionNote: null,
  });
  await retryOnConflict(async () => {
    const a = (await accounts().findById(account._id))!;
    await accounts().updateOne(a._id, a._rev, {
      $set: { nationality: input.nationality, dob: input.dob, foreignPassport: input.passportNumber, publicKey: a.publicKey ?? input.publicKey, keyRotatedAt: a.keyRotatedAt ?? new Date().toISOString() },
    });
  });
  await notify({
    accountId: account._id,
    title: type === 'e-residency' ? 'E-Residency application received' : 'Citizenship application received',
    message: `Your application ${app.reference} has been received and is waiting for review by a registry officer.`,
    category: 'Identity',
    linkText: 'View your dashboard',
    linkHref: '/portal',
  });
  await audit({
    category: type === 'e-residency' ? 'E-Residency' : 'Citizenship',
    actor: account.name,
    actorId: account._id,
    subjectAccountId: account._id,
    action: `Application ${app.reference} submitted (${input.route})`,
  });
  return app;
}

const addYears = (d: Date, years: number) => new Date(Date.UTC(d.getUTCFullYear() + years, d.getUTCMonth(), d.getUTCDate())).toISOString();

export async function decideApplication(id: string, decision: 'approve' | 'reject', note: string, officer: StoredOfficer): Promise<Doc<Application>> {
  const app = await applications().findById(id);
  if (!app) return fail(404, 'No such application.');
  if (app.status !== 'Pending') return fail(409, `This application was already ${app.status.toLowerCase()}.`);
  const now = new Date();
  const decided = await applications().updateOne(app._id, app._rev, {
    $set: { status: decision === 'approve' ? 'Approved' : 'Rejected', decidedAt: now.toISOString(), decidedBy: officer.officerId, decisionNote: note || null },
  });
  const label = app.type === 'e-residency' ? 'E-Residency' : 'Citizenship';

  if (decision === 'reject') {
    await notify({
      accountId: app.accountId,
      title: `${label} application not approved`,
      message: `Your application ${app.reference} was not approved.${note ? ` Reason: ${note}` : ''}`,
      category: 'Identity',
    });
    await audit({ category: label, actor: officer.name, actorId: officer._id, subjectAccountId: app.accountId, action: `Rejected ${label.toLowerCase()} application ${app.reference} (${app.applicant})` });
    return decided;
  }

  if (app.type === 'e-residency') {
    await retryOnConflict(async () => {
      const a = (await accounts().findById(app.accountId))!;
      await accounts().updateOne(a._id, a._rev, {
        $set: { status: a.status === 'citizen' ? 'citizen' : 'e-resident', residency: { validFrom: now.toISOString(), validUntil: addYears(now, 3) } },
      });
    });
    await issueDocument({ accountId: app.accountId, holder: app.applicant, kind: 'e-residence-certificate', name: 'Aletheia_E_Residence_Certificate.pdf', docType: 'Official Residency Certificate', authority: 'General Secretariat of State', relatedId: app._id });
    await issueDocument({ accountId: app.accountId, holder: app.applicant, kind: 'tax-residency', name: 'Fiscal_Status_Declaration.pdf', docType: 'Fiscal Status Attestation', authority: 'Ministry of Treasury & Finance', relatedId: app._id });
    await notify({
      accountId: app.accountId,
      title: 'E-Residency granted',
      message: `Your application ${app.reference} has been approved. Your e-residency is valid for three years and your certificate is in your document vault.`,
      category: 'Identity',
      linkText: 'Open document vault',
      linkHref: '/portal/documents',
    });
  } else {
    const year = now.getUTCFullYear();
    const nationalId = `ALE-NAT-${year}-${String(await nextNumber(`national-id-${year}`)).padStart(6, '0')}`;
    const passportNumber = `ALE-${String(await nextNumber('passport')).padStart(6, '0')}`;
    const record = {
      nationalId,
      passportNumber,
      accountId: app.accountId,
      name: app.applicant,
      dob: app.dob,
      type: (app.route === 'investor' ? 'Covenant Investor' : 'Naturalised') as CitizenType,
      nationalityOfOrigin: app.nationality,
      registeredDate: now.toISOString().slice(0, 10),
      status: 'Active' as CitizenStatus,
      applicationReference: app.reference,
    };
    await citizens().insertOne({ ...record, covenantHash: sha256(JSON.stringify(record)) });
    await retryOnConflict(async () => {
      const a = (await accounts().findById(app.accountId))!;
      await accounts().updateOne(a._id, a._rev, { $set: { status: 'citizen', nationalId, passportNumber } });
    });
    await issueDocument({ accountId: app.accountId, holder: app.applicant, kind: 'digital-credential', name: 'Aletheia_Citizenship_Credential.pdf', docType: 'Certificate of Citizenship', authority: 'General Secretariat of State', relatedId: app._id });
    await notify({
      accountId: app.accountId,
      title: 'Citizenship granted',
      message: `Your application ${app.reference} has been approved. National ID ${nationalId}, passport number ${passportNumber}.`,
      category: 'Identity',
      linkText: 'View your identity',
      linkHref: '/portal/identity',
    });
  }
  await audit({ category: label, actor: officer.name, actorId: officer._id, subjectAccountId: app.accountId, action: `Approved ${label.toLowerCase()} application ${app.reference} (${app.applicant})` });
  return decided;
}

// ---------------------------------------------------------------- rescissions

export async function openRescission(input: { nationalId: string; basis: RescissionBasis; stage: RescissionStage; dossierRef: string }, officer: StoredOfficer): Promise<Doc<Rescission>> {
  const c = await citizens().findOne({ nationalId: input.nationalId.toUpperCase() });
  if (!c) return fail(404, 'No citizen with that national ID.');
  if (c.status === 'Rescinded') return fail(409, 'This citizenship has already been rescinded.');
  if (await rescissions().findOne({ nationalId: c.nationalId, status: 'Active Proceeding' })) return fail(409, 'A proceeding is already open for this citizen.');
  const r = await rescissions().insertOne({
    reference: await nextReference('RESC', 4),
    nationalId: c.nationalId,
    citizenName: c.name,
    basis: input.basis,
    stage: input.stage,
    dossierRef: input.dossierRef,
    initiatedDate: new Date().toISOString().slice(0, 10),
    initiatedBy: officer.officerId,
    status: 'Active Proceeding',
    decidedAt: null,
    decidedBy: null,
  });
  await retryOnConflict(async () => {
    const cur = (await citizens().findById(c._id))!;
    await citizens().updateOne(cur._id, cur._rev, { $set: { status: 'Under Review' } });
  });
  await audit({ category: 'Citizenship', actor: officer.name, actorId: officer._id, subjectAccountId: c.accountId, action: `Opened rescission proceeding ${r.reference} for ${c.name} (${input.basis})` });
  return r;
}

export async function decideRescission(id: string, decision: 'rescind' | 'dismiss', officer: StoredOfficer): Promise<Doc<Rescission>> {
  const r = await rescissions().findById(id);
  if (!r) return fail(404, 'No such proceeding.');
  if (r.status !== 'Active Proceeding') return fail(409, 'This proceeding is already closed.');
  const decided = await rescissions().updateOne(r._id, r._rev, {
    $set: { status: decision === 'rescind' ? 'Rescinded' : 'Dismissed', stage: 'Judicial Finality', decidedAt: new Date().toISOString(), decidedBy: officer.officerId },
  });
  const c = await citizens().findOne({ nationalId: r.nationalId });
  if (c) {
    await retryOnConflict(async () => {
      const cur = (await citizens().findById(c._id))!;
      await citizens().updateOne(cur._id, cur._rev, { $set: { status: decision === 'rescind' ? 'Rescinded' : 'Active' } });
    });
    if (decision === 'rescind') {
      await retryOnConflict(async () => {
        const a = await accounts().findById(c.accountId);
        if (a) await accounts().updateOne(a._id, a._rev, { $set: { status: a.residency ? 'e-resident' : 'registered' } });
      });
    }
    await notify({
      accountId: c.accountId,
      title: decision === 'rescind' ? 'Citizenship rescinded' : 'Rescission proceeding dismissed',
      message: decision === 'rescind' ? `Following proceeding ${r.reference}, your citizenship has been rescinded.` : `Proceeding ${r.reference} has been dismissed. Your citizenship is reaffirmed.`,
      category: 'Identity',
    });
  }
  await audit({ category: 'Citizenship', actor: officer.name, actorId: officer._id, subjectAccountId: c?.accountId ?? null, action: `${decision === 'rescind' ? 'Rescinded citizenship' : 'Dismissed proceeding'} ${r.reference} (${r.citizenName})` });
  return decided;
}

// ---------------------------------------------------------------- border

export async function lookupTraveller(passportNumber: string) {
  const c = await citizens().findOne({ passportNumber: passportNumber.toUpperCase() });
  if (!c) return null;
  const { documents: history } = await crossings().find({ passportNumber: c.passportNumber }, { sort: { at: -1 }, limit: 5 });
  return {
    passportNumber: c.passportNumber,
    name: c.name,
    nationalId: c.nationalId,
    dob: c.dob,
    nationality: 'Sovereign Covenant State of Aletheia (ALE)',
    documentType: 'Aletheia passport (registry record)',
    status: c.status === 'Active' ? ('CLEARED' as const) : ('FLAGGED' as const),
    permitType: c.status === 'Active' ? 'Citizen of Aletheia (unconditional entry right)' : `Citizenship ${c.status.toLowerCase()}`,
    history: history.map((h) => ({ decision: h.decision, officer: h.officer, at: h.at })),
  };
}

export async function recordCrossing(passportNumber: string, decision: 'CLEARED' | 'FLAGGED', officer: StoredOfficer): Promise<void> {
  const traveller = await lookupTraveller(passportNumber);
  const name = traveller?.name ?? 'Unregistered document';
  await crossings().insertOne({ passportNumber: passportNumber.toUpperCase(), name, decision, officer: officer.name, officerId: officer._id, at: new Date().toISOString() });
  await audit({ category: 'Border / E-Gate', actor: officer.name, actorId: officer._id, action: `${decision === 'CLEARED' ? 'Cleared' : 'Flagged'} ${passportNumber.toUpperCase()} (${name})` });
}
