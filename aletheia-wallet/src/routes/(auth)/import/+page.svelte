<script lang="ts">
  // Import (wallet prompt 8): from a recovery phrase (per-word autocomplete, checksum), or from a
  // keystore file written by aletheia-cli. After sealing, the derived address is shown with what
  // the network knows of it; an account the chain has not seen yet is still valid.
  import { goto } from "$app/navigation";
  import CeremonyShell from "$lib/layouts/CeremonyShell.svelte";
  import MnemonicGrid from "$lib/components/inputs/MnemonicGrid.svelte";
  import PasswordField from "$lib/components/inputs/PasswordField.svelte";
  import TextField from "$lib/components/inputs/TextField.svelte";
  import SegmentedControl from "$lib/components/inputs/SegmentedControl.svelte";
  import Button from "$lib/components/inputs/Button.svelte";
  import InlineStatus from "$lib/components/feedback/InlineStatus.svelte";
  import Identifier from "$lib/components/data/Identifier.svelte";
  import { mnemonicProblem } from "$lib/wallet/mnemonic/mnemonic";
  import { WalletWorkerError } from "$lib/wallet/worker/client";
  import type { CreatedWallet } from "$lib/wallet/worker/protocol";
  import { session } from "$lib/state/session.svelte";
  import { chain } from "$lib/state/chain";
  import { config } from "$lib/config";
  import { networkLabel } from "$lib/stablechain/network/kind";

  let mode = $state<"phrase" | "keystore">("phrase");
  let words = $state<string[]>(Array(24).fill(""));
  let name = $state("Account 1");
  let password = $state("");
  let confirm = $state("");
  let score = $state<number | null>(null);
  let fileText = $state<string | null>(null);
  let fileName = $state("");
  let filePassword = $state("");
  let touched = $state(false);
  let busy = $state(false);
  let problem = $state<string | null>(null);
  let restored = $state<{ created: CreatedWallet; onChain: boolean | null } | null>(null);

  const filledCount = $derived(words.filter((w) => w.trim()).length);
  const phraseProblem = $derived(filledCount === 24 ? mnemonicProblem(words) : null);
  const phraseMessage = $derived(
    !phraseProblem
      ? null
      : phraseProblem.kind === "unknown-word"
        ? `Word ${phraseProblem.position} is not in the recovery wordlist.`
        : phraseProblem.kind === "checksum"
          ? "Every word is valid, but together they do not form a valid phrase. Check the order and spelling."
          : "A recovery phrase has 12 to 24 words.",
  );
  const passwordError = $derived(
    !touched
      ? null
      : password.length < 12
        ? "Use at least 12 characters."
        : (score ?? 0) < 2
          ? "Choose a less guessable password."
          : null,
  );
  const confirmError = $derived(touched && confirm !== password ? "The two passwords differ." : null);

  function describe(error: unknown): string {
    if (error instanceof WalletWorkerError) {
      if (error.kind === "wrong-password") return "That password does not open this keystore.";
      if (error.kind === "wrong-network") return error.message.charAt(0).toUpperCase() + error.message.slice(1) + ".";
      if (error.kind === "invalid-words") return "The phrase is not valid.";
      if (error.kind === "corrupt" || error.kind === "unsupported")
        return `This file cannot be used: ${error.message}.`;
    }
    return "The wallet could not be restored. Nothing was stored.";
  }

  async function finish(created: CreatedWallet) {
    await session.adoptCreated(created);
    restored = { created, onChain: null };
    try {
      const account = await chain.account(created.accounts[0]!.address);
      restored = { created, onChain: account.exists };
    } catch {
      restored = { created, onChain: null };
    }
  }

  async function importPhrase(event: SubmitEvent) {
    event.preventDefault();
    touched = true;
    if (filledCount !== 24 || phraseProblem || passwordError || confirmError) return;
    busy = true;
    problem = null;
    try {
      const created = await session.worker.request({
        op: "importWords",
        words: words.map((w) => w.trim().toLowerCase()),
        password,
        network: session.network,
        name: name.trim() || "Account 1",
      });
      words = Array(24).fill("");
      password = confirm = "";
      await finish(created);
    } catch (error) {
      problem = describe(error);
    } finally {
      busy = false;
    }
  }

  async function onfile(event: Event) {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > 64 * 1024) {
      problem = "That file is too large to be a keystore.";
      return;
    }
    fileName = file.name;
    fileText = await file.text();
    problem = null;
  }

  async function importFile(event: SubmitEvent) {
    event.preventDefault();
    if (!fileText) return;
    busy = true;
    problem = null;
    let parsed: unknown;
    try {
      parsed = JSON.parse(fileText);
    } catch {
      busy = false;
      problem = "That file is not a keystore (it is not JSON).";
      return;
    }
    try {
      const created = await session.worker.request({
        op: "importKeystore",
        file: parsed,
        password: filePassword,
        network: session.network,
      });
      filePassword = "";
      fileText = null;
      await finish(created);
    } catch (error) {
      problem = describe(error);
    } finally {
      busy = false;
    }
  }
</script>

<CeremonyShell>
  {#if restored}
    <section class="stage settle">
      <p class="eyebrow">Restored</p>
      <h1>Your ledger is open</h1>
      <div class="result">
        <p class="eyebrow">{restored.created.accounts[0]?.name} · {networkLabel(config.network)}</p>
        <Identifier value={restored.created.accounts[0]?.address ?? ""} label="Your address" size="large" />
        {#if restored.onChain === true}
          <InlineStatus tone="verified" title="Found on AletheiaChain"
            >This account has a history on the network.</InlineStatus
          >
        {:else if restored.onChain === false}
          <InlineStatus tone="info" title="Not yet seen on the network"
            >The address is valid and can receive. It appears on chain with its first transfer.</InlineStatus
          >
        {:else}
          <InlineStatus tone="pending" title="Network not reached"
            >The wallet is restored; its on-chain record will load when the network answers.</InlineStatus
          >
        {/if}
      </div>
      <div class="actions"><Button variant="primary" onclick={() => goto("/dashboard")}>Open the ledger</Button></div>
    </section>
  {:else}
    <section class="stage settle">
      <p class="eyebrow">Restore</p>
      <h1>Restore a wallet</h1>
      <p class="lede">
        Bring an existing wallet to this browser. It is sealed here with a new password; nothing is sent anywhere.
      </p>
      <SegmentedControl
        label="Restore from"
        bind:value={mode}
        options={[
          { value: "phrase", label: "Recovery phrase" },
          { value: "keystore", label: "Keystore file" },
        ]}
      />

      {#if mode === "phrase"}
        <form class="form" onsubmit={importPhrase} novalidate>
          <MnemonicGrid bind:words />
          {#if phraseMessage}<InlineStatus tone="rejected" title="Check the phrase">{phraseMessage}</InlineStatus>{/if}
          <p class="micro">{filledCount} of 24 words · derivation m/44'/7771'/0'/0'/i' (SLIP-0010, Ed25519)</p>
          <div class="fields">
            <TextField label="Account name" bind:value={name} autocomplete="off" />
            <PasswordField
              label="New password for this device"
              bind:value={password}
              error={passwordError}
              strength
              bind:score
              autocomplete="new-password"
            />
            <PasswordField
              label="Repeat password"
              bind:value={confirm}
              error={confirmError}
              autocomplete="new-password"
            />
          </div>
          {#if problem}<InlineStatus tone="rejected" title="Not restored">{problem}</InlineStatus>{/if}
          <div class="actions">
            <Button variant="primary" type="submit" icon="lock" {busy} disabled={filledCount !== 24 || !!phraseProblem}
              >{busy ? "Deriving the key…" : "Restore and seal"}</Button
            >
          </div>
        </form>
      {:else}
        <form class="form" onsubmit={importFile} novalidate>
          <InlineStatus tone="info" title="Keystore files from aletheia-cli">
            A version 1 file holds one account and opens with the password it was made with. It has no recovery phrase
            to show.
          </InlineStatus>
          <label class="file">
            <span class="eyebrow">Keystore file</span>
            <input type="file" accept="application/json,.json" onchange={onfile} />
            <span class="micro">{fileName || "Choose a .json keystore"}</span>
          </label>
          <PasswordField label="Keystore password" bind:value={filePassword} />
          {#if problem}<InlineStatus tone="rejected" title="Not restored">{problem}</InlineStatus>{/if}
          <div class="actions">
            <Button variant="primary" type="submit" icon="unlock" {busy} disabled={!fileText || !filePassword}
              >{busy ? "Opening…" : "Open keystore"}</Button
            >
          </div>
        </form>
      {/if}
    </section>
  {/if}
</CeremonyShell>

<style>
  .stage,
  .form {
    display: grid;
    gap: var(--space-6);
  }

  h1 {
    font-size: var(--type-display);
    font-weight: var(--type-display-weight);
    letter-spacing: var(--type-display-track);
    line-height: var(--leading-tight);
  }

  .fields {
    display: grid;
    gap: var(--space-6);
    max-width: 460px;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-4);
  }

  .file {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-5);
    border: var(--hairline) dashed var(--rule-control);
    border-radius: var(--radius-3);
    max-width: 460px;
  }

  .file input {
    font-size: 0.875rem;
  }

  .result {
    display: grid;
    gap: var(--space-4);
    padding: var(--space-6) 0;
    border-top: var(--hairline) solid var(--rule-strong);
    border-bottom: var(--hairline) solid var(--rule-hairline);
  }
</style>
