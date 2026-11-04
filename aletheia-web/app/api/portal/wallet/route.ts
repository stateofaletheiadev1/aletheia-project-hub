import { body, clientIp, json, rateLimit, route } from '@/lib/server/http';
import { requireAccount } from '@/lib/server/accounts';
import { chainAccountView, linkAddress } from '@/lib/server/chain-account';

/** The person's AletheiaChain account: balances and history read from the chain. */
export const GET = route(async (req) => {
  const { account } = await requireAccount(req);
  return json(await chainAccountView(account));
});

/** Links (or, with `address: null`, unlinks) the person's own AletheiaChain address. */
export const PUT = route(async (req) => {
  const { account } = await requireAccount(req);
  rateLimit(`chain-link:${account._id}:${clientIp(req)}`, 10, 60_000);
  const b = await body(req);
  const address = b.address === null ? null : typeof b.address === 'string' ? b.address : '';
  const updated = await linkAddress(account, address);
  return json(await chainAccountView(updated));
});
