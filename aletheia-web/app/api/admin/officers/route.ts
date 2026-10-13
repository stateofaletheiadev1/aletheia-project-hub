import { body, fail, isEmail, json, oneOf, route, str } from '@/lib/server/http';
import { passwordProblem } from '@/lib/server/crypto';
import { createOfficer, officers, officerView, requireOfficer } from '@/lib/server/officers';
import { audit } from '@/lib/server/records';

export const GET = route(async (req) => {
  await requireOfficer(req, { administrator: true });
  const { documents } = await officers().find({}, { sort: { createdAt: 1 }, limit: 500 });
  return json({ officers: await Promise.all(documents.map(officerView)) });
});

/** Creates an officer. The response carries the authenticator secret once: hand it to the officer. */
export const POST = route(async (req) => {
  const { officer: admin } = await requireOfficer(req, { administrator: true });
  const b = await body(req);
  const email = str(b, 'email', { max: 254, label: 'Email' });
  if (!isEmail(email)) fail(400, 'Enter a valid email address.');
  const temporaryPassphrase = typeof b.temporaryPassphrase === 'string' ? b.temporaryPassphrase : '';
  const problem = passwordProblem(temporaryPassphrase, email);
  if (problem) fail(400, problem);
  const { officer, totpSecret } = await createOfficer({
    name: str(b, 'name', { max: 120, label: 'Full name' }),
    email,
    role: oneOf(b, 'role', ['administrator', 'officer'] as const),
    clearance: str(b, 'clearance', { max: 120, optional: true }) || 'Registry access',
    department: str(b, 'department', { max: 120, optional: true }) || 'General Secretariat of State',
    badgeNumber: str(b, 'badgeNumber', { max: 40, optional: true }),
    temporaryPassword: temporaryPassphrase,
    createdBy: admin.officerId,
  });
  await audit({ category: 'Security', actor: admin.officerId, actorId: admin._id, action: `Created officer ${officer.officerId} (${officer.role})` });
  return json({ officer: await officerView(officer), totpSecret, otpauthUri: `otpauth://totp/Aletheia:${officer.officerId}?secret=${totpSecret}&issuer=Aletheia` }, 201);
});
