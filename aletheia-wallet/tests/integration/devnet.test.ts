// Against a real aletheiad devnet (tests/devnet/node.toml), never production funds. Proves the
// TypeScript ACE layout, digest, signature, address commitment and tx id against the Rust node:
// the node accepts, executes and finalizes what this code signs, and names it the same id.

import { beforeAll, describe, expect, it } from "vitest";
import { ed25519 } from "@noble/curves/ed25519.js";
import { ChainClient } from "$lib/stablechain/rpc/client";
import { ChainError } from "$lib/stablechain/rpc/errors";
import { verifyNetwork, type VerifiedNetwork } from "$lib/stablechain/network/gate";
import { addressBytes, parseAddress } from "$lib/stablechain/addresses/identifiers";
import { ed25519Address } from "$lib/stablechain/addresses/derive";
import { encodeBody } from "$lib/stablechain/transactions/body";
import { buildTransfer, finalTerms, priceFrom, pricingTerms } from "$lib/stablechain/transactions/build";
import { trackTransaction } from "$lib/stablechain/transactions/track";
import { signTransferWithKey } from "$lib/wallet/signing/sign";
import { accountSeed } from "$lib/wallet/derivation/slip10";
import { newMnemonic, seedOf } from "$lib/wallet/mnemonic/mnemonic";
import { ASSETS } from "$lib/stablechain/assets/assets";

const RPC = process.env.DEVNET_RPC ?? "http://127.0.0.1:7791";
const client = new ChainClient({ rpcUrl: `${RPC}/rpc/v1`, restUrl: `${RPC}/api/v1` });
const devKey = new Uint8Array(32).fill(0xa1); // published devnet seed, genesis-funded
let network: VerifiedNetwork;

beforeAll(async () => {
  const genesis = await client.blockByHeight(0);
  network = await verifyNetwork(client, {
    chainId: 7771,
    kind: "devnet",
    genesisBlock: genesis.id,
    protocolVersions: [1],
  });
});

async function priceAndSign(key: Uint8Array, recipient: string, asset: "AEY" | "ALnT", amount: bigint) {
  const sender = ed25519Address(network, ed25519.getPublicKey(key));
  const [account, head, feeBalance] = await Promise.all([
    client.account(sender),
    client.finalizedHead(),
    client.balance(sender, "ALnT"),
  ]);
  const draft = {
    sender: addressBytes(sender, network.kind),
    recipient: addressBytes(parseAddress(recipient, network.kind), network.kind),
    asset: ASSETS[asset].id,
    amount,
    memo: new TextEncoder().encode("wallet integration test"),
    feeAsset: ASSETS.ALnT.id,
  };
  const facts = { nonce: BigInt(account.nonce), slot: BigInt(head.slot) };
  const pricing = buildTransfer(draft, network, facts, pricingTerms(BigInt(feeBalance.available)));
  const priced = await client.simulate(signTransferWithKey(encodeBody(pricing), key, network).signed);
  expect(priced.receipt.status).toBe("SUCCESS");
  const price = priceFrom(BigInt(priced.euUsed), BigInt(priced.fee.amount));
  const body = buildTransfer(draft, network, facts, finalTerms(BigInt(priced.euUsed), price));
  const final = signTransferWithKey(encodeBody(body), key, network);
  const check = await client.simulate(final.signed);
  expect(check.receipt.status).toBe("SUCCESS");
  return { final, body, fee: BigInt(check.fee.amount), sender };
}

describe("devnet: network gate", () => {
  it("verifies the devnet and refuses it as mainnet", async () => {
    expect(network.kind).toBe("devnet");
    expect(network.assets.AEY.transferable).toBe(true);
    await expect(
      verifyNetwork(client, { chainId: 7770, kind: "mainnet", genesisBlock: null, protocolVersions: [1] }),
    ).rejects.toMatchObject({
      info: { kind: "WrongNetwork" },
    });
    await expect(
      verifyNetwork(client, {
        chainId: 7771,
        kind: "devnet",
        genesisBlock: "alt:B7d6ec0526856a85C12a0B95edC508D378b8dfF222e7caC6cE8C7D026278a4819",
        protocolVersions: [1],
      }),
    ).rejects.toMatchObject({ info: { kind: "WrongNetwork" } });
  });
});

describe("devnet: a transfer signed in TypeScript", () => {
  it("is priced, accepted under the same id, finalized and credited", async () => {
    // A fresh BIP-39 wallet account as the recipient, exactly as the wallet derives it.
    const seed = seedOf(newMnemonic());
    const recipientKey = accountSeed(seed, 0);
    const recipient = ed25519Address(network, ed25519.getPublicKey(recipientKey));
    const amount = 1_500_000_000_000_000_000n; // 1.5 AEY
    const { final, body } = await priceAndSign(devKey, recipient, "AEY", amount);

    const submitted = await client.submit(final.signed);
    expect(submitted.status).toBe("ACCEPTED");
    expect(submitted.txId).toBe(final.txId);

    const outcome = await trackTransaction(client, final.txId, {
      expirySlot: Number(body.expirySlot),
      submittedAt: Date.now(),
    });
    expect(outcome.kind).toBe("finalized");
    if (outcome.kind !== "finalized") return;
    expect(outcome.tx.sender).toBe(ed25519Address(network, ed25519.getPublicKey(devKey)));
    expect(outcome.tx.transfer?.recipient).toBe(recipient);
    expect(outcome.tx.transfer?.amount).toBe(amount.toString());
    expect(outcome.tx.receipt?.status).toBe("SUCCESS");

    const receipt = await client.receipt(final.txId);
    expect(receipt.status).toBe("SUCCESS");
    const balance = await client.balance(recipient, "AEY");
    expect(balance.available).toBe(amount.toString());

    // Submitting the same signed bytes again is refused by the network, not silently accepted.
    await expect(client.submit(final.signed)).rejects.toBeInstanceOf(ChainError);
  });

  it("reports a transfer that would fail before anything is signed for submission", async () => {
    const empty = new Uint8Array(32).fill(0x07);
    const sender = ed25519Address(network, ed25519.getPublicKey(empty));
    const head = await client.finalizedHead();
    const body = buildTransfer(
      {
        sender: addressBytes(sender, network.kind),
        recipient: addressBytes(sender, network.kind),
        asset: 1,
        amount: 1n,
        memo: new Uint8Array(),
        feeAsset: 2,
      },
      network,
      { nonce: 0n, slot: BigInt(head.slot) },
      pricingTerms(0n),
    );
    const failure = client.simulate(signTransferWithKey(encodeBody(body), empty, network).signed);
    await expect(failure).rejects.toMatchObject({ info: { kind: "NodeError" } });
  });

  it("reads an unknown account as nonce 0, still able to receive", async () => {
    const stranger = ed25519Address(network, ed25519.getPublicKey(new Uint8Array(32).fill(0x55)));
    expect(await client.account(stranger)).toMatchObject({ exists: false, nonce: 0 });
    const balances = await client.balances(stranger);
    expect(balances.map((b) => b.available)).toEqual(["0", "0"]);
  });
});

describe("devnet: node ADR-064 (preview pricing, history, WebSocket)", () => {
  it("prices an unsigned preview exactly as a signed copy, and never admits it", async () => {
    const { encodePreview } = await import("$lib/stablechain/transactions/body");
    const key = new Uint8Array(32).fill(0xa3);
    const publicKey = ed25519.getPublicKey(key);
    const sender = ed25519Address(network, publicKey);
    const [account, head] = await Promise.all([client.account(sender), client.finalizedHead()]);
    const body = buildTransfer(
      {
        sender: addressBytes(sender, network.kind),
        recipient: addressBytes(parseAddress("alt:a7c308Be39bA1F33fa045Dde6A90b4E623360162", "devnet"), network.kind),
        asset: 2,
        amount: 1_000n,
        memo: new Uint8Array(),
        feeAsset: 2,
      },
      network,
      { nonce: BigInt(account.nonce), slot: BigInt(head.slot) },
      { maxFee: 10_000n, euLimit: 10_000n },
    );
    const bytes = encodeBody(body);
    const preview = await client.simulate(encodePreview(bytes, publicKey));
    const signed = await client.simulate(signTransferWithKey(bytes, key, network).signed);
    expect(preview.receipt.status).toBe("SUCCESS");
    expect(preview.fee).toEqual(signed.fee);
    expect(preview.euUsed).toBe(signed.euUsed);
    await expect(client.submit(encodePreview(bytes, publicKey))).rejects.toMatchObject({
      info: { kind: "Rejected", name: "TX_THRESHOLD_NOT_MET" },
    });
    // A preview with another key does not price someone else's account.
    const other = await client
      .simulate(encodePreview(bytes, ed25519.getPublicKey(new Uint8Array(32).fill(0x11))))
      .catch((e: ChainError) => e);
    expect(other instanceof ChainError || (other as { receipt: { status: string } }).receipt.status !== "SUCCESS").toBe(
      true,
    );
  });

  it("serves account history and pushes account events and finality over WebSocket", async () => {
    const stranger = ed25519Address(network, ed25519.getPublicKey(new Uint8Array(32).fill(Date.now() % 200)));
    const socket = new WebSocket(`${RPC.replace("http", "ws")}/ws/v1`);
    const events: { method?: string; params?: { result?: { transaction?: { txId: string } } } }[] = [];
    await new Promise<void>((resolve, reject) => {
      socket.onopen = () => resolve();
      socket.onerror = () => reject(new Error("socket failed"));
    });
    socket.onmessage = (m) => events.push(JSON.parse(String(m.data)));
    socket.send(
      JSON.stringify({ jsonrpc: "2.0", id: 1, method: "subscribe", params: { topic: "account", address: stranger } }),
    );
    await new Promise((r) => setTimeout(r, 300));

    const { final, body } = await priceAndSign(devKey, stranger, "ALnT", 2_500n);
    socket.send(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "subscribe",
        params: { topic: "transactionStatus", txId: final.txId },
      }),
    );
    await client.submit(final.signed);
    await trackTransaction(client, final.txId, { expirySlot: Number(body.expirySlot), submittedAt: Date.now() });
    await new Promise((r) => setTimeout(r, 1500));
    socket.close();

    const pushed = events
      .filter((e) => e.method === "subscription")
      .map((e) => e.params?.result?.transaction?.txId ?? (e.params?.result as { txId?: string })?.txId);
    expect(pushed.filter((id) => id === final.txId).length).toBeGreaterThanOrEqual(2);

    const history = await client.accountHistory(stranger, { limit: 5 });
    expect(history.transactions[0]?.txId).toBe(final.txId);
    expect(history.next).toBeNull();
  });
});
