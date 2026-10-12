import 'server-only';
import type { Doc } from '@aletheia/aletheiadb';
import { collection } from './db';
import { sha256 } from './crypto';
import { fail, retryOnConflict } from './http';
import { accounts, type StoredAccount } from './accounts';
import { audit, nextReference, notify } from './records';

// AEY balances between portal accounts, kept in AletheiaDB (not on StableChain).
// AletheiaDB has no multi-document transactions, so a transfer is a small state machine:
//   pending → debited (sender's balance reduced, revision-checked) → completed (recipient credited).
// The debit and its marker (the transfer id in the sender's appliedDebits) are one atomic
// update of the sender's account, so settle() — run on every wallet read — can always tell
// whether a transfer interrupted by a crash took the money: if so it finishes it, if not it
// marks it failed.
// Amounts are whole cents; balances never go below zero.

export type Transfer = {
  reference: string;
  fromAccountId: string;
  toAccountId: string;
  fromName: string;
  toName: string;
  amountCents: number;
  memo: string;
  state: 'pending' | 'debited' | 'completed' | 'failed';
  hash: string;
  createdAt: string;
};

export type Entry = {
  accountId: string;
  transferId: string;
  type: 'Credit' | 'Debit';
  amountCents: number;
  description: string;
  hash: string;
  at: string;
};

const transfers = () => collection<Transfer>('wallet_transfers');
const entries = () => collection<Entry>('wallet_entries');

async function credit(t: Doc<Transfer>): Promise<void> {
  if (!(await entries().findOne({ transferId: t._id, accountId: t.fromAccountId }))) {
    await entries().insertOne({ accountId: t.fromAccountId, transferId: t._id, type: 'Debit', amountCents: t.amountCents, description: `Transfer to ${t.toName}${t.memo ? ` · ${t.memo}` : ''}`, hash: t.hash, at: new Date().toISOString() });
  }
  // Idempotent: the credit entry is the marker that the recipient was paid.
  if (!(await entries().findOne({ transferId: t._id, accountId: t.toAccountId }))) {
    await retryOnConflict(async () => {
      const to = (await accounts().findById(t.toAccountId))!;
      await accounts().updateOne(to._id, to._rev, { $inc: { balanceCents: t.amountCents } });
    });
    await entries().insertOne({ accountId: t.toAccountId, transferId: t._id, type: 'Credit', amountCents: t.amountCents, description: `Transfer from ${t.fromName}${t.memo ? ` · ${t.memo}` : ''}`, hash: t.hash, at: new Date().toISOString() });
  }
  await retryOnConflict(async () => {
    const cur = (await transfers().findById(t._id))!;
    if (cur.state !== 'completed') await transfers().updateOne(cur._id, cur._rev, { $set: { state: 'completed' } });
  });
}

export async function transfer(from: StoredAccount, recipientId: string, amountCents: number, memo: string): Promise<Doc<Transfer>> {
  if (!Number.isInteger(amountCents) || amountCents <= 0) return fail(400, 'Enter an amount greater than zero.');
  if (amountCents > 1_000_000_000_00) return fail(400, 'That amount is too large.');
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
    fromName: from.name,
    toName: to.name,
    amountCents,
    memo,
    state: 'pending',
    hash: sha256(JSON.stringify({ reference, from: from.aletheiaId, to: to.aletheiaId, amountCents, memo, createdAt })),
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
  await notify({ accountId: to._id, title: 'AEY received', message: `${from.name} sent you ${(amountCents / 100).toFixed(2)} AEY (${reference}).`, category: 'Financial', linkText: 'Open AEY Wallet', linkHref: '/portal/wallet' });
  await audit({ category: 'Wallet', actor: from.name, actorId: from._id, subjectAccountId: from._id, action: `Transferred ${(amountCents / 100).toFixed(2)} AEY to ${to.aletheiaId} (${reference})` });
  return (await transfers().findById(t._id))!;
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
    transactions: list.map((e) => ({ id: e._id, type: e.type, description: e.description, amount: e.amountCents / 100, date: e.at, hash: e.hash })),
  };
}
