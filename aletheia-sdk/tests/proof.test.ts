// State proofs checked in TypeScript against answers produced by the node itself
// (fixtures/state-proofs.json, from aletheia-node `sdk_state_proof_vectors`).

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fromHex, toHex } from "../src/encoding/hex.js";
import { parseNetworkKind } from "../src/network/kind.js";
import { METHODS } from "../src/rpc/types.js";
import type { StateProofAnswer } from "../src/rpc/types.js";
import { ProofError, checkStateProof, decodeStateProof, stateKey, verifyStateProof } from "../src/state/proof.js";

interface Case {
  name: string;
  asked: { kind: "account" | "balance" | "supply"; address?: string; assetId?: number };
  answer: StateProofAnswer;
}
const vectors = JSON.parse(readFileSync(new URL("./fixtures/state-proofs.json", import.meta.url), "utf8")) as {
  network: { chainId: number; kind: string };
  stateRoot: string;
  cases: Case[];
};
const network = { chainId: vectors.network.chainId, kind: parseNetworkKind(vectors.network.kind)! };
const root = fromHex(vectors.stateRoot);

function asked(c: Case): Parameters<typeof stateKey>[1] {
  const { kind, address, assetId } = c.asked;
  if (kind === "account") return { kind, address: fromHex(address!) };
  if (kind === "balance") return { kind, address: fromHex(address!), assetId: assetId! };
  return { kind, assetId: assetId! };
}

const byName = (name: string) => vectors.cases.find((c) => c.name === name)!;

describe("state proofs from the node", () => {
  it("derives the same state keys as the node", () => {
    for (const c of vectors.cases) expect(toHex(stateKey(network, asked(c))), c.name).toBe(c.answer.key);
  });

  it("verifies inclusion of an account, a balance and a supply ledger", () => {
    for (const name of ["account", "balance", "supply"]) {
      const c = byName(name);
      const value = verifyStateProof(network, root, asked(c), c.answer);
      expect(value && toHex(value), name).toBe(c.answer.value);
    }
  });

  it("verifies that a never-created account is absent", () => {
    const c = byName("absent");
    expect(c.answer.value).toBeNull();
    expect(verifyStateProof(network, root, asked(c), c.answer)).toBeNull();
  });

  it("refuses a changed value, a claimed absence and another key's answer", () => {
    const c = byName("balance");
    const value = fromHex(c.answer.value!);
    const proof = decodeStateProof(fromHex(c.answer.proof));
    const key = fromHex(c.answer.key);
    const forged = value.slice();
    forged[0] = forged[0]! ^ 1;
    expect(() => checkStateProof(network, root, key, forged, proof)).toThrow(ProofError);
    expect(() => checkStateProof(network, root, key, null, proof)).toThrow(ProofError);
    // The account answer offered for the balance question.
    expect(() => verifyStateProof(network, root, asked(c), { ...byName("account").answer, record: "balance" })).toThrow(
      /different state key/,
    );
  });

  it("refuses an answer against an untrusted root or on another network", () => {
    const c = byName("account");
    const other = root.slice();
    other[31] = other[31]! ^ 1;
    expect(() => verifyStateProof(network, other, asked(c), c.answer)).toThrow(/different state root/);
    // Same bytes, another chain id: every digest changes, so the key no longer matches.
    expect(() => verifyStateProof({ ...network, chainId: network.chainId + 1 }, root, asked(c), c.answer)).toThrow(
      ProofError,
    );
  });

  it("refuses non-canonical proof encodings", () => {
    const bytes = fromHex(byName("account").answer.proof);
    expect(() => decodeStateProof(Uint8Array.of(...bytes, 0))).toThrow();
    const badTag = bytes.slice();
    badTag[badTag.length - 65] = 7;
    expect(() => decodeStateProof(badTag)).toThrow();
  });
});

describe("the SDK and the node's published interface", () => {
  it("knows exactly the node's methods", () => {
    const doc = JSON.parse(
      readFileSync(new URL("../../aletheia-node/crates/rpc/openrpc.json", import.meta.url), "utf8"),
    ) as { methods: { name: string }[] };
    expect([...METHODS]).toEqual(doc.methods.map((m) => m.name));
  });
});
