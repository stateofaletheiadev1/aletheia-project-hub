<script lang="ts">
  // Security (wallet prompt 8, 11): auto-lock, motion, re-verify the recovery phrase, change
  // password (re-encrypt with fresh salt and nonce), encrypted backup, remove from this device.
  // Hardware wallets and sessions are Planned and say so.
  import SegmentedControl from "$lib/components/inputs/SegmentedControl.svelte";
  import PasswordField from "$lib/components/inputs/PasswordField.svelte";
  import Button from "$lib/components/inputs/Button.svelte";
  import InlineStatus from "$lib/components/feedback/InlineStatus.svelte";
  import RecoveryCertificate from "$lib/components/data/RecoveryCertificate.svelte";
  import Dialog from "$lib/components/overlays/Dialog.svelte";
  import { session } from "$lib/state/session.svelte";
  import { prefs } from "$lib/state/prefs.svelte";
  import { WalletWorkerError } from "$lib/wallet/worker/client";
  import { goto } from "$app/navigation";

  let autoLock = $state(String(prefs.autoLockMinutes));
  $effect(() => {
    prefs.autoLockMinutes = Number(autoLock);
    session.rearm();
  });

  // Re-verify phrase
  let revealPassword = $state("");
  let revealError = $state<string | null>(null);
  let words = $state<string[] | null>(null);
  let revealing = $state(false);

  async function reveal(event: SubmitEvent) {
    event.preventDefault();
    revealing = true;
    revealError = null;
    try {
      words = await session.revealWords(revealPassword);
    } catch (error) {
      revealError =
        error instanceof WalletWorkerError && error.kind === "wrong-password"
          ? "That password does not open this wallet."
          : "The phrase could not be shown.";
    } finally {
      revealPassword = "";
      revealing = false;
    }
  }

  // Change password
  let oldPassword = $state("");
  let newPassword = $state("");
  let repeat = $state("");
  let score = $state<number | null>(null);
  let changing = $state(false);
  let changeResult = $state<{ ok: boolean; text: string } | null>(null);
  const newError = $derived(
    newPassword && newPassword.length < 12
      ? "Use at least 12 characters."
      : newPassword && (score ?? 0) < 2
        ? "Choose a less guessable password."
        : null,
  );
  const repeatError = $derived(repeat && repeat !== newPassword ? "The two passwords differ." : null);

  async function change(event: SubmitEvent) {
    event.preventDefault();
    if (!oldPassword || !newPassword || newError || repeatError || repeat !== newPassword) return;
    changing = true;
    changeResult = null;
    try {
      await session.changePassword(oldPassword, newPassword);
      changeResult = {
        ok: true,
        text: "Re-sealed with the new password. The old password no longer opens this device's copy.",
      };
    } catch (error) {
      changeResult = {
        ok: false,
        text:
          error instanceof WalletWorkerError && error.kind === "wrong-password"
            ? "The current password is not right."
            : "The password was not changed.",
      };
    } finally {
      oldPassword = newPassword = repeat = "";
      changing = false;
    }
  }

  function backup() {
    const text = session.exportKeystore();
    if (!text) return;
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `aletheia-wallet-keystore-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  let forgetOpen = $state(false);
  let forgetAck = $state(false);
  async function forget() {
    await session.forget();
    forgetOpen = false;
    await goto("/");
  }
</script>

<svelte:head><title>Security · Aletheia Wallet</title></svelte:head>

<div class="security">
  <header class="settle">
    <p class="eyebrow">Your keys, this device</p>
    <h1>Security</h1>
  </header>

  <section>
    <h2>Locking</h2>
    <div class="rows">
      <SegmentedControl
        label="Lock after inactivity"
        bind:value={autoLock}
        options={[
          { value: "1", label: "1 min" },
          { value: "5", label: "5 min" },
          { value: "15", label: "15 min" },
          { value: "30", label: "30 min" },
        ]}
      />
      <p class="micro">
        The wallet also locks when this tab stays hidden for a minute. Locking clears the keys from memory.
      </p>
      <SegmentedControl
        label="Motion"
        bind:value={prefs.motion}
        options={[
          { value: "system", label: "Follow system" },
          { value: "full", label: "Full" },
          { value: "reduce", label: "Reduced" },
        ]}
      />
    </div>
  </section>

  <section>
    <h2>Recovery phrase</h2>
    <div class="rows">
      {#if !session.hasWords}
        <InlineStatus tone="info" title="No phrase in this keystore"
          >This wallet was opened from a command-line keystore, which holds a key rather than words.</InlineStatus
        >
      {:else if words}
        <RecoveryCertificate {words} revealed />
        <Button variant="quiet" onclick={() => (words = null)}>Hide the phrase</Button>
      {:else}
        <p class="text">Check your written copy against the wallet. You will need your password.</p>
        <form class="form" onsubmit={reveal}>
          <PasswordField bind:value={revealPassword} error={revealError} />
          <Button type="submit" variant="quiet" icon="eye" busy={revealing} disabled={!revealPassword}
            >Show the phrase</Button
          >
        </form>
      {/if}
    </div>
  </section>

  {#if session.keystoreVersion === 2}
    <section>
      <h2>Password</h2>
      <form class="form rows" onsubmit={change}>
        <PasswordField label="Current password" bind:value={oldPassword} />
        <PasswordField
          label="New password"
          bind:value={newPassword}
          error={newError}
          strength
          bind:score
          autocomplete="new-password"
        />
        <PasswordField
          label="Repeat new password"
          bind:value={repeat}
          error={repeatError}
          autocomplete="new-password"
        />
        {#if changeResult}<InlineStatus tone={changeResult.ok ? "verified" : "rejected"}
            >{changeResult.text}</InlineStatus
          >{/if}
        <Button type="submit" variant="quiet" icon="lock" busy={changing}
          >{changing ? "Re-sealing…" : "Change password"}</Button
        >
      </form>
    </section>
  {/if}

  <section>
    <h2>Backup</h2>
    <div class="rows">
      <p class="text">
        Download this device's sealed keystore. It opens only with your password; the recovery phrase remains the true
        backup.
      </p>
      <Button variant="quiet" icon="download" onclick={backup}>Download encrypted keystore</Button>
    </div>
  </section>

  <section>
    <h2>Devices</h2>
    <div class="rows">
      <InlineStatus tone="planned" title="Hardware wallets — planned"
        >Signing on a hardware device that shows the transfer before approving it. The wallet is built to accept such a
        signer.</InlineStatus
      >
      <InlineStatus tone="planned" title="Sessions across devices — planned"
        >Each browser holds its own sealed copy today.</InlineStatus
      >
    </div>
  </section>

  <section>
    <h2>Remove</h2>
    <div class="rows">
      <p class="text">
        Remove the wallet from this browser. Funds stay on AletheiaChain and return with your recovery phrase.
      </p>
      <Button variant="danger" icon="trash" onclick={() => (forgetOpen = true)}>Remove from this device</Button>
    </div>
  </section>
</div>

<Dialog bind:open={forgetOpen} title="Remove the wallet from this device?">
  <p>Without your recovery phrase, this cannot be undone. Make sure the 24 words are written down.</p>
  <label class="ack"><input type="checkbox" bind:checked={forgetAck} /> I have my recovery phrase.</label>
  {#snippet actions()}
    <Button variant="plain" onclick={() => (forgetOpen = false)}>Keep the wallet</Button>
    <Button variant="danger" disabled={!forgetAck} onclick={forget}>Remove</Button>
  {/snippet}
</Dialog>

<style>
  .security {
    display: grid;
    gap: var(--space-10);
    max-width: 960px;
  }

  h1 {
    font-size: var(--type-display);
    font-weight: var(--type-display-weight);
    letter-spacing: var(--type-display-track);
  }

  section {
    display: grid;
    grid-template-columns: 16ch minmax(0, 1fr);
    gap: var(--space-8);
    padding-top: var(--space-6);
    border-top: var(--hairline) solid var(--rule-strong);
  }

  h2 {
    font-size: 1rem;
    font-weight: 650;
  }

  .rows {
    display: grid;
    gap: var(--space-5);
    justify-items: start;
  }

  .rows > :global(.certificate) {
    justify-self: stretch;
  }

  .form {
    display: grid;
    gap: var(--space-5);
    justify-items: start;
    width: min(100%, 440px);
  }

  .form > :global(*) {
    justify-self: stretch;
  }

  .form > :global(.button) {
    justify-self: start;
  }

  .text {
    color: var(--ink-secondary);
    max-width: 60ch;
  }

  .ack {
    display: flex;
    gap: var(--space-3);
    align-items: center;
    font-weight: 600;
    color: var(--ink-primary);
  }

  @media (max-width: 720px) {
    section {
      grid-template-columns: minmax(0, 1fr);
      gap: var(--space-4);
    }
  }
</style>
