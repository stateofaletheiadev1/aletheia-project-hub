import { body, fail, json, oneOf, route, str } from '@/lib/server/http';
import { requireAccount } from '@/lib/server/accounts';
import { applications, submitApplication } from '@/lib/server/registry';

export const GET = route(async (req) => {
  const { account } = await requireAccount(req);
  const { documents } = await applications().find({ accountId: account._id }, { sort: { submittedAt: -1 }, limit: 50 });
  return json({ applications: documents.map((a) => ({ id: a._id, reference: a.reference, type: a.type, route: a.route, status: a.status, submittedAt: a.submittedAt, decidedAt: a.decidedAt, decisionNote: a.decisionNote })) });
});

export const POST = route(async (req) => {
  const { account } = await requireAccount(req);
  const b = await body(req);
  const route_ = oneOf(b, 'route', ['e-residency', 'naturalisation', 'investor'] as const);
  const dob = str(b, 'dob', { max: 10, label: 'Date of birth' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || Number.isNaN(Date.parse(dob)) || Date.parse(dob) > Date.now()) fail(400, 'Enter a valid date of birth.');
  const publicKey = str(b, 'publicKey', { max: 64, label: 'Public key' }).toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(publicKey)) fail(400, 'The public key must be 64 hexadecimal characters (an Ed25519 key).');
  if (b.acceptedCovenant !== true) fail(400, 'You must accept the Covenant declaration.');
  const app = await submitApplication(account, {
    route: route_,
    investOption: route_ === 'investor' ? str(b, 'investOption', { max: 60, optional: true }) || null : null,
    nationality: str(b, 'nationality', { max: 60, label: 'Nationality' }),
    dob,
    passportNumber: str(b, 'passportNumber', { max: 30, label: 'Passport number' }).toUpperCase(),
    purpose: str(b, 'purpose', { max: 60, label: 'Purpose' }),
    intendedEntity: str(b, 'intendedEntity', { max: 60, optional: true }),
    publicKey,
    acceptedCovenant: true,
  });
  return json({ application: { id: app._id, reference: app.reference, status: app.status, type: app.type } }, 201);
});
