// Helper for the end-to-end test: funds FUND_TO on the local devnet from the published
// development account. Skipped unless FUND_TO is set.
import { it, expect } from "vitest";
import { ed25519 } from "@noble/curves/ed25519.js";
import { ChainClient } from "$lib/stablechain/rpc/client";
import { verifyNetwork } from "$lib/stablechain/network/gate";
import { addressBytes, parseAddress } from "$lib/stablechain/addresses/identifiers";
import { ed25519Address } from "$lib/stablechain/addresses/derive";
import { encodeBody } from "$lib/stablechain/transactions/body";
import { buildTransfer, finalTerms, priceFrom, pricingTerms } from "$lib/stablechain/transactions/build";
import { trackTransaction } from "$lib/stablechain/transactions/track";
import { signTransferWithKey } from "$lib/wallet/signing/sign";

const RPC = process.env.DEVNET_RPC ?? "http://127.0.0.1:7791";
const to = process.env.FUND_TO;

it.skipIf(!to)("funds an address on the devnet", async () => {
  const client = new ChainClient({ rpcUrl: `${RPC}/rpc/v1`, restUrl: `${RPC}/api/v1` });
  const genesis = await client.blockByHeight(0);
  const network = await verifyNetwork(client, {
    chainId: 7771,
    kind: "devnet",
    genesisBlock: genesis.id,
    protocolVersions: [1],
  });
  const key = new Uint8Array(32).fill(0xa2);
  const sender = ed25519Address(network, ed25519.getPublicKey(key));
  for (const [asset, amount] of [
    [2, 250_000n],
    [1, 5_000_000_000_000_000_000n],
  ] as const) {
    const [account, head, fee] = await Promise.all([
      client.account(sender),
      client.finalizedHead(),
      client.balance(sender, "ALnT"),
    ]);
    const draft = {
      sender: addressBytes(sender, "devnet"),
      recipient: addressBytes(parseAddress(to!, "devnet"), "devnet"),
      asset,
      amount,
      memo: new Uint8Array(),
      feeAsset: 2,
    };
    const facts = { nonce: BigInt(account.nonce), slot: BigInt(head.slot) };
    const priced = await client.simulate(
      signTransferWithKey(
        encodeBody(buildTransfer(draft, network, facts, pricingTerms(BigInt(fee.available)))),
        key,
        network,
      ).signed,
    );
    const body = buildTransfer(
      draft,
      network,
      facts,
      finalTerms(BigInt(priced.euUsed), priceFrom(BigInt(priced.euUsed), BigInt(priced.fee.amount))),
    );
    const signed = signTransferWithKey(encodeBody(body), key, network);
    await client.submit(signed.signed);
    const outcome = await trackTransaction(client, signed.txId, {
      expirySlot: Number(body.expirySlot),
      submittedAt: Date.now(),
    });
    expect(outcome.kind).toBe("finalized");
  }
});
