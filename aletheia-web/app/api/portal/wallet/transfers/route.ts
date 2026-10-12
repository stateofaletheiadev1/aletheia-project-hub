import { body, clientIp, fail, json, rateLimit, route, str } from '@/lib/server/http';
import { requireAccount } from '@/lib/server/accounts';
import { transfer, walletView } from '@/lib/server/wallet';

export const POST = route(async (req) => {
  const { account } = await requireAccount(req);
  rateLimit(`transfer:${account._id}:${clientIp(req)}`, 20, 60_000);
  const b = await body(req);
  const recipient = str(b, 'recipient', { max: 40, label: 'Recipient Aletheia ID' });
  const amount = Number(b.amount);
  if (!Number.isFinite(amount) || amount <= 0) fail(400, 'Enter an amount greater than zero.');
  const cents = Math.round(amount * 100);
  if (Math.abs(cents - amount * 100) > 1e-6) fail(400, 'Use at most two decimal places.');
  const t = await transfer(account, recipient, cents, str(b, 'memo', { max: 140, optional: true }));
  return json({ transfer: { reference: t.reference, state: t.state, amount: t.amountCents / 100, hash: t.hash }, wallet: await walletView(account) }, 201);
});
