import { body, fail, json, route, str } from '@/lib/server/http';
import { requireOfficer } from '@/lib/server/officers';
import { issuances, issue } from '@/lib/server/wallet';

export const GET = route(async (req) => {
  await requireOfficer(req, { administrator: true });
  const list = await issuances();
  return json({ issuances: list, total: list.reduce((n, i) => n + i.amount, 0) });
});

/** Treasury issuance of new AEY to an account (administrators only, reason required, audited). */
export const POST = route(async (req) => {
  const { officer } = await requireOfficer(req, { administrator: true });
  const b = await body(req);
  const amount = Number(b.amount);
  if (!Number.isFinite(amount) || amount <= 0) fail(400, 'Enter an amount greater than zero.');
  const cents = Math.round(amount * 100);
  if (Math.abs(cents - amount * 100) > 1e-6) fail(400, 'Use at most two decimal places.');
  const t = await issue(officer, str(b, 'recipient', { max: 40, label: 'Recipient Aletheia ID' }), cents, str(b, 'reason', { max: 300, label: 'Reason' }));
  return json({ issuance: { reference: t.reference, amount: t.amountCents / 100, state: t.state, hash: t.hash } }, 201);
});
