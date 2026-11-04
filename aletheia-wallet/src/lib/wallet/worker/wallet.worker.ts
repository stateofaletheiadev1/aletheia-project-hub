/// <reference lib="webworker" />
// The only place secrets exist (wallet prompt 10.2). Routes each request to the vault and posts
// back the result. Errors carry a kind and a plain message, never key material.

import * as vault from "./vault";
import type { RequestEnvelope, WalletErrorKind, WorkerMessage } from "./protocol";

const session = vault.newSession();
const scope = self as unknown as DedicatedWorkerGlobalScope;

async function handle({ request }: RequestEnvelope): Promise<unknown> {
  switch (request.op) {
    case "generate":
      return vault.generate(session);
    case "discardPending":
      return vault.discardPending(session);
    case "createFromPending":
      return vault.createFromPending(session, request.password, request.network, request.name);
    case "importWords":
      return vault.importWords(session, request.words, request.password, request.network, request.name);
    case "importKeystore":
      return vault.importKeystore(session, request.file, request.password, request.network);
    case "unlock":
      return vault.unlock(session, request.keystore, request.password, request.network);
    case "addAccount":
      return vault.addAccount(session, request.name);
    case "sign":
      return vault.sign(session, request.bodyHex, request.index, request.network);
    case "revealWords":
      return vault.revealWords(request.keystore, request.password);
    case "changePassword":
      return vault.changePassword(request.keystore, request.oldPassword, request.newPassword);
    case "lock":
      vault.wipeSession(session);
      return {};
  }
}

scope.onmessage = async (event: MessageEvent<RequestEnvelope>) => {
  const { id } = event.data;
  let message: WorkerMessage;
  try {
    message = { id, ok: true, result: await handle(event.data) };
  } catch (error) {
    const kind: WalletErrorKind = error instanceof vault.VaultError ? error.kind : "internal";
    message = {
      id,
      ok: false,
      error: {
        kind,
        message: error instanceof vault.VaultError ? error.message : "the wallet could not complete that",
      },
    };
  }
  scope.postMessage(message);
};
