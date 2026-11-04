import { fail, json, route } from '@/lib/server/http';
import { requireOfficer } from '@/lib/server/officers';
import { chainSupply } from '@/lib/server/chain-account';
import { issuances } from '@/lib/server/wallet';

/**
 * The Treasury view: the native assets' supply as AletheiaChain reports it, and, read-only, the
 * records of the retired off-chain ledger so nothing that was recorded disappears.
 */
export const GET = route(async (req) => {
  await requireOfficer(req, { administrator: true });
  const [supply, archive] = await Promise.all([chainSupply(), issuances()]);
  return json({ supply, archive: { issuances: archive, total: archive.reduce((n, i) => n + i.amount, 0) } });
});

/**
 * Retired. AEY is issued only on AletheiaChain, by a mint authorization signed under the Reserve
 * Bank's monetary authority keys; the portal cannot create it.
 */
export const POST = route(async (req) => {
  await requireOfficer(req, { administrator: true });
  return fail(410, 'AEY is issued only on AletheiaChain under the Reserve Bank’s monetary authority. The portal cannot issue it.');
});
