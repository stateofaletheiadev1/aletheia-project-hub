import 'server-only';
import type { Doc } from '@aletheia/aletheiadb';
import { collection } from './db';
import { sha256 } from './crypto';
import { ERASED, openFields, sealFields, type Sealed } from './envelope';
import { fail, retryOnConflict } from './http';
import { accountPii, accounts, type StoredAccount } from './accounts';
import type { StoredOfficer } from './officers';
import { audit, nextReference, notify } from './records';

// AEY balances of portal accounts, kept in AletheiaDB (not on StableChain).
//
// AEY enters only by Treasury issuance: an administrator credits an account, with a stated
// reason, and the issuance is audited. Otherwise AEY only moves between accounts.
//
// AletheiaDB has no multi-document transactions, so a transfer is a small state machine:
//   pending → debited (sender's balance reduced, revision-checked) → completed (recipient credited).
// The debit and its marker (the transfer id in the sender's appliedDebits) are one atomic
// update of the sender's account, so settle() — run on every wallet read — can always tell
// whether a transfer interrupted by a crash took the money: if so it finishes it, if not it
// marks it failed. Amounts are whole cents; balances never go below zero.

export const TREASURY = 'treasury';

export type Transfer = {
  reference: string;
  fromAccountId: string;
  toAccountId: string;
  amountCents: number;
  /** The sender's note, sealed under the sender's key (transfers between accounts). */
  memo: Sealed | null;
  /** Treasury issuances: the stated reason and the administrator who issued. */
  reason: string | null;
  issuedBy: string | null;
  state: 'pending' | 'debited' | 'completed' | 'failed';
  hash: string;
  createdAt: string;
};

// An entry's description names the other party, so it is sealed under the wallet owner's key.
export type Entry = { accountId: string; transferId: string; type: 'Credit' | 'Debit'; amountCents: number; sealed: Sealed; hash: string; at: string };

export const transfers = () => collection<Transfer>('wallet_transfers');
const entries = () => collection<Entry>('wallet_entries');
const MAX_CENTS = 1_000_000_000_00;

async function partyLabel(accountId: string): Promise<string> {
  const a = await accounts().findById(accountId);
  return a ? `${(await accountPii(a)).name} (${a.aletheiaId})` : ERASED;
}

async function memoOf(t: Transfer): Promise<string> {
  if (!t.memo) return t.reason ?? '';
  const from = await accounts().findById(t.fromAccountId);
  return from ? (await openFields(from.subject, t.memo, 'wallet_transfers', { memo: '' })).memo : '';
}

async function addEntry(accountId: string, t: Doc<Transfer>, type: Entry['type'], description: string): Promise<void> {
  if (await entries().findOne({ transferId: t._id, accountId })) return; // idempotent
  const a = await accounts().findById(accountId);
  if (!a) return;
  const memo = await memoOf(t);
  await entries().insertOne({
    accountId,
    transferId: t._id,
    type,
    amountCents: t.amountCents,
    sealed: await sealFields(a.subject, { description: `${description}${memo ? ` · ${memo}` : ''}` }, 'wallet_entries'),
    hash: t.hash,
    at: new Date().toISOString(),
  });
}

/** Pays the recipient of a debited transfer and records both sides. Safe to repeat. */
async function credit(t: Doc<Transfer>): Promise<void> {
  if (t.fromAccountId !== TREASURY) await addEntry(t.fromAccountId, t, 'Debit', `Transfer to ${await partyLabel(t.toAccountId)}`);
  // The credit entry is the marker that the recipient was paid.
  if (!(await entries().findOne({ transferId: t._id, accountId: t.toAccountId }))) {
    await retryOnConflict(async () => {
      const to = (await accounts().findById(t.toAccountId))!;
      await accounts().updateOne(to._id, to._rev, { $inc: { balanceCents: t.amountCents } });
    });
    await addEntry(t.toAccountId, t, 'Credit', t.fromAccountId === TREASURY ? 'Issued by the Treasury' : `Transfer from ${await partyLabel(t.fromAccountId)}`);
  }
  await retryOnConflict(async () => {
    const cur = (await transfers().findById(t._id))!;
    if (cur.state !== 'completed') await transfers().updateOne(cur._id, cur._rev, { $set: { state: 'completed' } });
  });
}

const money = (cents: number) => (cents / 100).toFixed(2);

export async function transfer(from: StoredAccount, recipientId: string, amountCents: number, memo: string): Promise<Doc<Transfer>> {
  if (!Number.isInteger(amountCents) || amountCents <= 0) return fail(400, 'Enter an amount greater than zero.');
  if (amountCents > MAX_CENTS) return fail(400, 'That amount is too large.');
  const to = await accounts().findOne({ aletheiaId: recipientId.trim().toUpperCase() });
  if (!to) return fail(404, 'No account has that Aletheia ID.');
  if (to._id === from._id) return fail(400, 'You cannot send AEY to yourself.');
  if (from.balanceCents < amountCents) return fail(400, 'Your balance is not enough for this transfer.');

  const reference = await nextReference('TX');
  const createdAt = new Date().toISOString();
  const t = await transfers().insertOne({
    reference,
    fromAccountId: from._id,
    toAccountId: to._id,
    amountCents,
    memo: memo ? await sealFields(from.subject, { memo }, 'wallet_transfers') : null,
    reason: null,
    issuedBy: null,
    state: 'pending',
    hash: sha256(JSON.stringify({ reference, from: from.aletheiaId, to: to.aletheiaId, amountCents, createdAt })),
    createdAt,
  });

  try {
    await retryOnConflict(async () => {
      const cur = (await accounts().findById(from._id))!;
      if (cur.balanceCents < amountCents) fail(400, 'Your balance is not enough for this transfer.');
      await accounts().updateOne(cur._id, cur._rev, {
        $inc: { balanceCents: -amountCents },
        $set: { appliedDebits: [t._id, ...(cur.appliedDebits ?? [])].slice(0, 50) },
      });
    });
  } catch (e) {
    await transfers().updateOne(t._id, t._rev, { $set: { state: 'failed' } }).catch(() => undefined);
    throw e;
  }
  const debited = await retryOnConflict(async () => {
    const cur = (await transfers().findById(t._id))!;
    return transfers().updateOne(cur._id, cur._rev, { $set: { state: 'debited' } });
  });
  await credit(debited);
  await notify({ accountId: to._id, title: 'AEY received', message: `You received ${money(amountCents)} AEY from ${from.aletheiaId} (${reference}).`, category: 'Financial', linkText: 'Open AEY Wallet', linkHref: '/portal/wallet' });
  await audit({ category: 'Wallet', actor: from.aletheiaId, actorId: from._id, subjectAccountId: from._id, action: `Transferred ${money(amountCents)} AEY to ${to.aletheiaId} (${reference})` });
  return (await transfers().findById(t._id))!;
}

/** Treasury issuance: new AEY credited to an account. Administrators only (checked by the route). */
export async function issue(officer: StoredOfficer, recipientId: string, amountCents: number, reason: string): Promise<Doc<Transfer>> {
  if (!Number.isInteger(amountCents) || amountCents <= 0) return fail(400, 'Enter an amount greater than zero.');
  if (amountCents > MAX_CENTS) return fail(400, 'That amount is too large.');
  if (reason.length < 5) return fail(400, 'State the reason for the issuance.');
  const to = await accounts().findOne({ aletheiaId: recipientId.trim().toUpperCase() });
  if (!to) return fail(404, 'No account has that Aletheia ID.');
  const reference = await nextReference('ISS');
  const createdAt = new Date().toISOString();
  // Nothing is debited: the issuance starts in the "debited" state and is credited at once.
  const t = await transfers().insertOne({
    reference,
    fromAccountId: TREASURY,
    toAccountId: to._id,
    amountCents,
    memo: null,
    reason,
    issuedBy: officer.officerId,
    state: 'debited',
    hash: sha256(JSON.stringify({ reference, to: to.aletheiaId, amountCents, reason, issuedBy: officer.officerId, createdAt })),
    createdAt,
  });
  await credit(t);
  await notify({ accountId: to._id, title: 'AEY issued to your wallet', message: `The Treasury issued ${money(amountCents)} AEY to your wallet (${reference}): ${reason}`, category: 'Financial', linkText: 'Open AEY Wallet', linkHref: '/portal/wallet' });
  await audit({ category: 'Treasury', actor: officer.officerId, actorId: officer._id, subjectAccountId: to._id, action: `Issued ${money(amountCents)} AEY to ${to.aletheiaId} (${reference}): ${reason}` });
  return (await transfers().findById(t._id))!;
}

export async function issuances(limit = 200) {
  const { documents } = await transfers().find({ fromAccountId: TREASURY }, { sort: { createdAt: -1 }, limit });
  return Promise.all(
    documents.map(async (t) => {
      const to = await accounts().findById(t.toAccountId);
      return { id: t._id, reference: t.reference, recipient: to?.aletheiaId ?? ERASED, amount: t.amountCents / 100, reason: t.reason, issuedBy: t.issuedBy, state: t.state, createdAt: t.createdAt, hash: t.hash };
    }),
  );
}

/** Finishes or fails this account's transfers that a crash left half-way. */
async function settle(accountId: string): Promise<void> {
  const { documents: open } = await transfers().find({ fromAccountId: accountId, state: { $in: ['pending', 'debited'] } }, { limit: 50 });
  const account = await accounts().findById(accountId);
  for (const t of open) {
    try {
      if (t.state === 'debited') await credit(t);
      else if (Date.now() - Date.parse(t.createdAt) > 30_000) {
        if (account?.appliedDebits?.includes(t._id)) await credit(await transfers().updateOne(t._id, t._rev, { $set: { state: 'debited' } }));
        else await transfers().updateOne(t._id, t._rev, { $set: { state: 'failed' } });
      }
    } catch (e) {
      console.error(`[wallet] could not settle ${t.reference}:`, e);
    }
  }
}

export async function walletView(account: StoredAccount) {
  await settle(account._id);
  const fresh = (await accounts().findById(account._id))!;
  const { documents: list } = await entries().find({ accountId: account._id }, { sort: { at: -1 }, limit: 100 });
  return {
    balance: fresh.balanceCents / 100,
    address: fresh.aletheiaId,
    transactions: await Promise.all(
      list.map(async (e) => ({
        id: e._id,
        type: e.type,
        description: (await openFields(fresh.subject, e.sealed, 'wallet_entries', { description: ERASED })).description,
        amount: e.amountCents / 100,
        date: e.at,
        hash: e.hash,
      })),
    ),
  };
}
