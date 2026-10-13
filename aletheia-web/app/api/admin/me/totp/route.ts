import { body, json, route, str } from '@/lib/server/http';
import { beginTotp, confirmTotp, disableTotp, officerView, requireOfficer } from '@/lib/server/officers';

/** Start: a new secret to add to the authenticator app (shown once). */
export const POST = route(async (req) => {
  const { officer } = await requireOfficer(req);
  return json(await beginTotp(officer));
});

/** Confirm with a first code; from then on sign-in asks for the code. */
export const PUT = route(async (req) => {
  const { officer } = await requireOfficer(req);
  const updated = await confirmTotp(officer, str(await body(req), 'code', { max: 10, label: 'Code' }).replace(/\s/g, ''));
  return json({ officer: await officerView(updated) });
});

/** Switch off (asks for the passphrase). */
export const DELETE = route(async (req) => {
  const { officer } = await requireOfficer(req);
  const b = await body(req);
  const updated = await disableTotp(officer, typeof b.passphrase === 'string' ? b.passphrase : '');
  return json({ officer: await officerView(updated) });
});
