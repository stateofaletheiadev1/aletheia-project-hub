import 'server-only';
import type { Doc } from '@aletheia/aletheiadb';
import { collection } from './db';
import { sha256 } from './crypto';
import { ERASED, openFields, sealFields, type Sealed } from './envelope';
import { fail, retryOnConflict } from './http';
import { accountPii, accounts, updateAccountPii, type StoredAccount } from './accounts';
import type { StoredOfficer } from './officers';
import { audit, nextNumber, nextReference, notify } from './records';
import { issueDocument } from './documents';

// Applications (e-residency and citizenship), the citizen registry with the oath of
// allegiance, rescission proceedings and border checks. Personal fields are sealed under the
// applicant's key; identifiers the State issues (references, national ID, passport number)
// stay in clear so they can be looked up.

export type ApplicationType = 'e-residency' | 'citizenship';
export type ApplicationRoute = 'e-residency' | 'naturalisation' | 'investor';
export type DecisionStatus = 'Pending' | 'Approved' | 'Rejected';
type ApplicantPii = { applicant: string; email: string; nationality: string; dob: string; passportNumber: string };

export type Application = {
  reference: string;
  type: ApplicationType;
  route: ApplicationRoute;
  investOption: string | null;
  accountId: string;
  subject: string;
  pii: Sealed;
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
export type CitizenStatus = 'Oath Pending' | 'Active' | 'Under Review' | 'Suspended' | 'Rescinded';
type CitizenPii = { name: string; dob: string; nationalityOfOrigin: string };

export type Citizen = {
  nationalId: string;
  passportNumber: string | null;
  accountId: string;
  subject: string;
  pii: Sealed;
  type: CitizenType;
  registeredDate: string;
  oathTakenAt: string | null;
  status: CitizenStatus;
  covenantHash: string;
  applicationReference: string;
};

export type RescissionBasis = 'Voluntary Renunciation' | 'Fraudulent Acquisition' | 'Covenant Treason / Sanction' | 'Dual Allegiance Conflict';
export type RescissionStage = 'Hearing Scheduled' | 'Evidence Review' | 'Judicial Finality';
export type Rescission = {
  reference: string;
  nationalId: string;
  basis: RescissionBasis;
  stage: RescissionStage;
  dossierRef: string;
  initiatedDate: string;
  initiatedBy: string;
  status: 'Active Proceeding' | 'Rescinded' | 'Dismissed';
  decidedAt: string | null;
  decidedBy: string | null;
};

export type BorderCrossing = { passportNumber: string; decision: 'CLEARED' | 'FLAGGED'; officerId: string; officer: string; at: string };

export const applications = () => collection<Application>('applications');
export const citizens = () => collection<Citizen>('citizens');
export const rescissions = () => collection<Rescission>('rescissions');
const crossings = () => collection<BorderCrossing>('border_crossings');

const PREFIX: Record<ApplicationType, string> = { 'e-residency': 'ERES', citizenship: 'CIT-APP' };
const ERASED_APPLICANT: ApplicantPii = { applicant: ERASED, email: '', nationality: '', dob: '', passportNumber: '' };
const ERASED_CITIZEN: CitizenPii = { name: ERASED, dob: '', nationalityOfOrigin: '' };

export const applicantPii = (a: Pick<Application, 'subject' | 'pii'>) => openFields(a.subject, a.pii, 'applications', ERASED_APPLICANT);
export const citizenPii = (c: Pick<Citizen, 'subject' | 'pii'>) => openFields(c.subject, c.pii, 'citizens', ERASED_CITIZEN);

export const OATH_TEXT =
  'I swear allegiance to the Sovereign Covenant State of Aletheia, to uphold its Covenant and its laws, to respect the rights and freedoms of others, and to fulfil faithfully my duties as a citizen.';

export async function submitApplication(
  account: StoredAccount,
  input: { route: ApplicationRoute; investOption: string | null; nationality: string; dob: string; passportNumber: string; purpose: string; intendedEntity: string; publicKey: string },
): Promise<Doc<Application>> {
  const type: ApplicationType = input.route === 'e-residency' ? 'e-residency' : 'citizenship';
  if (type === 'e-residency' && (account.status === 'e-resident' || account.status === 'citizen')) fail(409, 'You already hold e-residency.');
  if (type === 'citizenship' && (account.status === 'citizen' || account.oathPending)) fail(409, 'You have already been granted citizenship.');
  if (await applications().findOne({ accountId: account._id, type, status: 'Pending' })) fail(409, 'You already have an application of this kind under review.');
  const pii = await accountPii(account);
  const app = await applications().insertOne({
    reference: await nextReference(PREFIX[type]),
    type,
    route: input.route,
    investOption: input.investOption,
    accountId: account._id,
    subject: account.subject,
    pii: await sealFields(account.subject, { applicant: pii.name, email: pii.email, nationality: input.nationality, dob: input.dob, passportNumber: input.passportNumber } satisfies ApplicantPii, 'applications'),
    purpose: input.purpose,
    intendedEntity: input.intendedEntity,
    publicKey: input.publicKey,
    acceptedCovenant: true,
    status: 'Pending',
    submittedAt: new Date().toISOString(),
    decidedAt: null,
    decidedBy: null,
    decisionNote: null,
  });
  const cur = (await accounts().findById(account._id))!;
  await updateAccountPii(account._id, { nationality: input.nationality, dob: input.dob, foreignPassport: input.passportNumber }, cur.publicKey ? {} : { publicKey: input.publicKey, keyRotatedAt: new Date().toISOString() });
  await notify({
    accountId: account._id,
    title: type === 'e-residency' ? 'E-Residency application received' : 'Citizenship application received',
    message: `Your application ${app.reference} has been received and is waiting for review by a registry officer.`,
    category: 'Identity',
    linkText: 'View your dashboard',
    linkHref: '/portal',
  });
  await audit({ category: type === 'e-residency' ? 'E-Residency' : 'Citizenship', actor: account.aletheiaId, actorId: account._id, subjectAccountId: account._id, action: `Application ${app.reference} submitted (${input.route})` });
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
  const auditBase = { category: label, actor: officer.officerId, actorId: officer._id, subjectAccountId: app.accountId } as const;

  if (decision === 'reject') {
    await notify({ accountId: app.accountId, title: `${label} application not approved`, message: `Your application ${app.reference} was not approved.${note ? ` Reason: ${note}` : ''}`, category: 'Identity' });
    await audit({ ...auditBase, action: `Rejected ${label.toLowerCase()} application ${app.reference}` });
    return decided;
  }

  const p = await applicantPii(app);
  if (app.type === 'e-residency') {
    await retryOnConflict(async () => {
      const a = (await accounts().findById(app.accountId))!;
      await accounts().updateOne(a._id, a._rev, { $set: { status: a.status === 'citizen' ? 'citizen' : 'e-resident', residency: { validFrom: now.toISOString(), validUntil: addYears(now, 3) } } });
    });
    await issueDocument({ accountId: app.accountId, kind: 'e-residence-certificate', name: 'Aletheia_E_Residence_Certificate.pdf', docType: 'Official Residency Certificate', authority: 'General Secretariat of State', relatedId: app._id });
    await issueDocument({ accountId: app.accountId, kind: 'tax-residency', name: 'Fiscal_Status_Declaration.pdf', docType: 'Fiscal Status Attestation', authority: 'Ministry of Treasury & Finance', relatedId: app._id });
    await notify({
      accountId: app.accountId,
      title: 'E-Residency granted',
      message: `Your application ${app.reference} has been approved. Your e-residency is valid for three years and your certificate is in your document vault.`,
      category: 'Identity',
      linkText: 'Open document vault',
      linkHref: '/portal/documents',
    });
  } else {
    // Citizenship is granted now; it takes effect, and the passport is issued, when the oath is sworn.
    const year = now.getUTCFullYear();
    const nationalId = `ALE-NAT-${year}-${String(await nextNumber(`national-id-${year}`)).padStart(6, '0')}`;
    const record = { nationalId, accountId: app.accountId, type: (app.route === 'investor' ? 'Covenant Investor' : 'Naturalised') as CitizenType, registeredDate: now.toISOString().slice(0, 10), applicationReference: app.reference };
    await citizens().insertOne({
      ...record,
      passportNumber: null,
      subject: app.subject,
      pii: await sealFields(app.subject, { name: p.applicant, dob: p.dob, nationalityOfOrigin: p.nationality } satisfies CitizenPii, 'citizens'),
      oathTakenAt: null,
      status: 'Oath Pending',
      covenantHash: sha256(JSON.stringify({ ...record, name: p.applicant, dob: p.dob })),
    });
    await retryOnConflict(async () => {
      const a = (await accounts().findById(app.accountId))!;
      await accounts().updateOne(a._id, a._rev, { $set: { oathPending: { nationalId, grantedAt: now.toISOString() } } });
    });
    await notify({
      accountId: app.accountId,
      title: 'Citizenship granted: take the oath',
      message: `Your application ${app.reference} has been approved. Swear the oath of allegiance in the portal to become a citizen and receive your passport number.`,
      category: 'Identity',
      linkText: 'Take the oath',
      linkHref: '/portal/identity',
    });
  }
  await audit({ ...auditBase, action: `Approved ${label.toLowerCase()} application ${app.reference}` });
  return decided;
}

/** The oath of allegiance: the citizen types their full name and swears; citizenship takes effect. */
export async function takeOath(account: StoredAccount, typedName: string): Promise<StoredAccount> {
  if (!account.oathPending) return fail(409, 'There is no citizenship waiting for your oath.');
  const { name } = await accountPii(account);
  const norm = (s: string) => s.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
  if (norm(typedName) !== norm(name)) return fail(400, 'Type your full name exactly as it appears on your account.');
  const c = await citizens().findOne({ nationalId: account.oathPending.nationalId });
  if (!c || c.status !== 'Oath Pending') return fail(409, 'This grant of citizenship is no longer open.');
  const passportNumber = `ALE-${String(await nextNumber('passport')).padStart(6, '0')}`;
  const now = new Date().toISOString();
  await retryOnConflict(async () => {
    const cur = (await citizens().findById(c._id))!;
    await citizens().updateOne(cur._id, cur._rev, { $set: { status: 'Active', passportNumber, oathTakenAt: now } });
  });
  const updated = await retryOnConflict(async () => {
    const a = (await accounts().findById(account._id))!;
    return accounts().updateOne(a._id, a._rev, { $set: { status: 'citizen', nationalId: c.nationalId, passportNumber, oathPending: null } });
  });
  await issueDocument({ accountId: account._id, kind: 'digital-credential', name: 'Aletheia_Citizenship_Credential.pdf', docType: 'Certificate of Citizenship', authority: 'General Secretariat of State', relatedId: c._id });
  await notify({ accountId: account._id, title: 'Welcome, citizen of Aletheia', message: `You have sworn the oath. National ID ${c.nationalId}, passport number ${passportNumber}.`, category: 'Identity', linkText: 'View your identity', linkHref: '/portal/identity' });
  await audit({ category: 'Citizenship', actor: account.aletheiaId, actorId: account._id, subjectAccountId: account._id, action: `Oath of allegiance sworn; ${c.nationalId} active, passport ${passportNumber} issued` });
  return updated;
}

export async function citizenView(c: Doc<Citizen>) {
  const p = await citizenPii(c);
  return {
    id: c._id,
    nationalId: c.nationalId,
    name: p.name,
    type: c.type,
    passportNumber: c.passportNumber ?? '—',
    nationalityOfOrigin: p.nationalityOfOrigin,
    registeredDate: c.registeredDate,
    status: c.status,
    covenantHash: c.covenantHash,
  };
}

// ---------------------------------------------------------------- rescissions

export async function openRescission(input: { nationalId: string; basis: RescissionBasis; stage: RescissionStage; dossierRef: string }, officer: StoredOfficer): Promise<Doc<Rescission>> {
  const c = await citizens().findOne({ nationalId: input.nationalId.toUpperCase() });
  if (!c) return fail(404, 'No citizen with that national ID.');
  if (c.status === 'Rescinded') return fail(409, 'This citizenship has already been rescinded.');
  if (c.status === 'Oath Pending') return fail(409, 'This citizenship has not taken effect yet (oath pending).');
  if (await rescissions().findOne({ nationalId: c.nationalId, status: 'Active Proceeding' })) return fail(409, 'A proceeding is already open for this citizen.');
  const r = await rescissions().insertOne({
    reference: await nextReference('RESC', 4),
    nationalId: c.nationalId,
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
  await audit({ category: 'Citizenship', actor: officer.officerId, actorId: officer._id, subjectAccountId: c.accountId, action: `Opened rescission proceeding ${r.reference} for ${c.nationalId} (${input.basis})` });
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
  await audit({ category: 'Citizenship', actor: officer.officerId, actorId: officer._id, subjectAccountId: c?.accountId ?? null, action: `${decision === 'rescind' ? 'Rescinded citizenship' : 'Dismissed proceeding'} ${r.reference} (${r.nationalId})` });
  return decided;
}

export async function rescissionView(r: Doc<Rescission>) {
  const c = await citizens().findOne({ nationalId: r.nationalId });
  return {
    id: r._id,
    reference: r.reference,
    citizenName: c ? (await citizenPii(c)).name : ERASED,
    nationalId: r.nationalId,
    basis: r.basis,
    stage: r.stage,
    dossierRef: r.dossierRef,
    initiatedDate: r.initiatedDate,
    status: r.status,
  };
}

// ---------------------------------------------------------------- border

export async function lookupTraveller(passportNumber: string) {
  const c = await citizens().findOne({ passportNumber: passportNumber.toUpperCase() });
  if (!c || !c.passportNumber) return null;
  const p = await citizenPii(c);
  const { documents: history } = await crossings().find({ passportNumber: c.passportNumber }, { sort: { at: -1 }, limit: 5 });
  return {
    passportNumber: c.passportNumber,
    name: p.name,
    nationalId: c.nationalId,
    dob: p.dob,
    nationality: 'Sovereign Covenant State of Aletheia (ALE)',
    documentType: 'Aletheia passport (registry record)',
    status: c.status === 'Active' ? ('CLEARED' as const) : ('FLAGGED' as const),
    permitType: c.status === 'Active' ? 'Citizen of Aletheia (unconditional entry right)' : `Citizenship ${c.status.toLowerCase()}`,
    history: history.map((h) => ({ decision: h.decision, officer: h.officer, at: h.at })),
  };
}

export async function recordCrossing(passportNumber: string, decision: 'CLEARED' | 'FLAGGED', officer: StoredOfficer): Promise<void> {
  const pn = passportNumber.toUpperCase();
  await crossings().insertOne({ passportNumber: pn, decision, officer: officer.officerId, officerId: officer._id, at: new Date().toISOString() });
  await audit({ category: 'Border / E-Gate', actor: officer.officerId, actorId: officer._id, action: `${decision === 'CLEARED' ? 'Cleared' : 'Flagged'} passport ${pn}` });
}

export async function applicationView(a: Doc<Application>) {
  const p = await applicantPii(a);
  return {
    id: a._id,
    reference: a.reference,
    type: a.type,
    route: a.route,
    investOption: a.investOption,
    applicant: p.applicant,
    email: p.email,
    nationality: p.nationality,
    dob: p.dob,
    passportNumber: p.passportNumber,
    purpose: a.purpose,
    intendedEntity: a.intendedEntity,
    publicKey: a.publicKey,
    status: a.status,
    submittedAt: a.submittedAt,
    decidedAt: a.decidedAt,
    decisionNote: a.decisionNote,
  };
}
