import { fail, route } from '@/lib/server/http';
import { requireAccount } from '@/lib/server/accounts';

/**
 * Retired. AEY moves only on AletheiaChain, signed in the holder's own wallet; the portal holds
 * no balance and moves nothing (see lib/server/chain-account.ts).
 */
export const POST = route(async (req) => {
  await requireAccount(req);
  return fail(410, 'AEY moves only on AletheiaChain. Send it from your own wallet; the portal shows the result.');
});
