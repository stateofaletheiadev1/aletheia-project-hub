import 'server-only';
import { STABLECHAIN, explorerUrl } from '@/lib/stablechain';
import { fail, retryOnConflict } from './http';
import { accounts, type StoredAccount } from './accounts';
import { audit } from './records';

// A portal account's AletheiaChain account. AEY exists only on AletheiaChain: the portal holds
// no balance of its own. A person links the address of their own wallet (non-custodial; the
// portal never sees a key), and the portal reads that account's finalized balances and history
// from the node. The node checks every address: it refuses anything that is not a canonical,
// checksummed address of this network, so the portal stores only what the chain accepts.
//
// The earlier AletheiaDB ledger (collections wallet_transfers and wallet_entries) is retired;
// its records are kept as they are, untouched, and nothing new is written to them.

const TIMEOUT_MS = 6_000;

type NodeError = { error?: { name?: string; message?: string; details?: { detail?: string } } };

async function node<T>(path: string): Promise<{ status: number; body: T & NodeError }> {
  let response: Response;
  try {
    response = await fetch(`${STABLECHAIN.rest}${path}`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    });
  } catch {
    return fail(503, 'AletheiaChain could not be reached. Try again in a moment.');
  }
  return { status: response.status, body: (await response.json().catch(() => ({}))) as T & NodeError };
}

type Balance = { asset: string; available: string; locked: string; display: string | null; height: number };
type HistoryTx = {
  txId: string;
  sender: string;
  block: { height: number; slot: number };
  transfer?: { recipient: string; asset: string; amount: string; display: string | null };
  receipt?: { status: string; errorName: string };
  type: string;
};

/** Checks `address` with the node and returns it exactly as the chain writes it. */
export async function canonicalAddress(address: string): Promise<string> {
  const text = address.trim();
  if (!/^alt:[0-9a-fA-F]{40}$/.test(text)) fail(400, 'An AletheiaChain address is alt: followed by 40 characters.');
  const { status, body } = await node<{ address?: string }>(`/accounts/${encodeURIComponent(text)}`);
  if (status === 200 && body.address === text) return text;
  const detail = body.error?.details?.detail ?? body.error?.message ?? '';
  if (/wrong network|valid for/i.test(detail)) fail(400, 'That address belongs to another Aletheia network.');
  if (/checksum|non.?canonical|casing/i.test(detail)) fail(400, 'Copy the address exactly as your wallet shows it: its letter case is its checksum.');
  return fail(400, 'AletheiaChain does not recognise that address.');
}

export async function linkAddress(account: StoredAccount, address: string | null): Promise<StoredAccount> {
  const canonical = address === null ? null : await canonicalAddress(address);
  const updated = await retryOnConflict(async () => {
    const fresh = (await accounts().findById(account._id))!;
    return accounts().updateOne(fresh._id, fresh._rev, { $set: { chainAddress: canonical, chainAddressLinkedAt: canonical ? new Date().toISOString() : null } });
  });
  await audit({
    category: 'Wallet',
    actor: account.aletheiaId,
    actorId: account._id,
    subjectAccountId: account._id,
    action: canonical ? `Linked AletheiaChain account ${canonical}` : 'Unlinked the AletheiaChain account',
  });
  return updated;
}

export type ChainAccountView =
  | { linked: false; network: string }
  | {
      linked: true;
      network: string;
      address: string;
      explorer: string;
      height: number;
      balances: { asset: string; available: string; locked: string; display: string | null }[];
      transactions: {
        txId: string;
        direction: 'in' | 'out' | 'self';
        counterparty: string;
        asset: string;
        amount: string;
        display: string | null;
        status: 'finalized' | 'failed';
        height: number;
        explorer: string;
      }[];
      more: boolean;
    };

/** The linked account as the chain reports it: balances and the latest finalized transfers. */
export async function chainAccountView(account: StoredAccount): Promise<ChainAccountView> {
  const network = 'AletheiaChain Mainnet Beta';
  const address = (account as StoredAccount & { chainAddress?: string | null }).chainAddress ?? null;
  if (!address) return { linked: false, network };
  const encoded = encodeURIComponent(address);
  const [balances, history] = await Promise.all([
    node<Balance[]>(`/accounts/${encoded}/balances`),
    node<{ transactions: HistoryTx[]; next: string | null }>(`/accounts/${encoded}/transactions?limit=25`),
  ]);
  if (balances.status !== 200 || !Array.isArray(balances.body)) fail(502, 'AletheiaChain did not return the balances.');
  const rows = Array.isArray(balances.body) ? balances.body : [];
  const txs = history.status === 200 && Array.isArray(history.body.transactions) ? history.body.transactions : [];
  return {
    linked: true,
    network,
    address,
    explorer: explorerUrl.address(address),
    height: Math.max(0, ...rows.map((b) => b.height)),
    balances: rows.map(({ asset, available, locked, display }) => ({ asset, available, locked, display })),
    transactions: txs
      .filter((tx) => tx.transfer)
      .map((tx) => {
        const out = tx.sender === address;
        const incoming = tx.transfer!.recipient === address;
        return {
          txId: tx.txId,
          direction: out && incoming ? 'self' : out ? 'out' : 'in',
          counterparty: out ? tx.transfer!.recipient : tx.sender,
          asset: tx.transfer!.asset,
          amount: tx.transfer!.amount,
          display: tx.transfer!.display,
          status: tx.receipt && tx.receipt.status !== 'SUCCESS' ? 'failed' : 'finalized',
          height: tx.block.height,
          explorer: explorerUrl.tx(tx.txId),
        } as const;
      }),
    more: history.status === 200 && history.body.next !== null,
  };
}

/** The native assets' supply ledgers, as the chain reports them (for the Treasury view). */
export async function chainSupply() {
  const assets = ['AEY', 'ALnT'] as const;
  const results = await Promise.all(
    assets.map((asset) =>
      node<{ asset: string; height: number; issuedTotal: string; circulating: string; locked: string; burnedTotal: string }>(`/monetary/${asset}/supply`),
    ),
  );
  return results.map((r, i) => (r.status === 200 ? r.body : { asset: assets[i], unavailable: true }));
}
