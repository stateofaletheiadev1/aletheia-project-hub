<script lang="ts">
  // Unlock (wallet prompt 8): arms, account name, password; the seal breaks open on success (S-3).
  // Wrong passwords are throttled with a visible countdown; a damaged keystore gets recovery
  // guidance rather than a retry loop.
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import CeremonyShell from "$lib/layouts/CeremonyShell.svelte";
  import Arms from "$lib/components/foundations/Arms.svelte";
  import SealMark from "$lib/components/data/SealMark.svelte";
  import Identifier from "$lib/components/data/Identifier.svelte";
  import PasswordField from "$lib/components/inputs/PasswordField.svelte";
  import Button from "$lib/components/inputs/Button.svelte";
  import InlineStatus from "$lib/components/feedback/InlineStatus.svelte";
  import { session } from "$lib/state/session.svelte";

  let password = $state("");
  let error = $state<string | null>(null);
  let fatal = $state<string | null>(null);
  let busy = $state(false);
  let seal = $state<"sealed" | "working" | "broken">("sealed");
  let wait = $state(0);
  let timer: ReturnType<typeof setInterval> | undefined;

  function countdown(ms: number) {
    wait = Math.ceil(ms / 1000);
    clearInterval(timer);
    if (wait <= 0) return;
    timer = setInterval(() => {
      wait = Math.max(0, Math.ceil(session.throttleWait() / 1000));
      if (wait === 0) clearInterval(timer);
    }, 500);
  }

  onMount(() => {
    const stop = $effect.root(() => {
      $effect(() => {
        if (session.phase === "empty") void goto("/");
        if (session.phase === "unlocked") setTimeout(() => void goto("/dashboard"), seal === "broken" ? 650 : 0);
      });
    });
    countdown(session.throttleWait());
    return () => {
      stop();
      clearInterval(timer);
    };
  });

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!password || wait > 0) return;
    busy = true;
    error = null;
    seal = "working";
    const result = await session.unlock(password);
    password = "";
    busy = false;
    if (result.ok) {
      seal = "broken";
      return;
    }
    seal = "sealed";
    if (result.kind === "wrong-password" || result.kind === "throttled") {
      error = result.kind === "throttled" ? "Too many attempts. Wait for the countdown." : result.message;
      countdown(result.waitMs);
    } else {
      fatal = result.message;
    }
  }
</script>

<CeremonyShell>
  <section class="unlock settle">
    <div class="mark">
      <SealMark state={seal} size={148} />
      <div class="arms" class:hidden={seal !== "broken"}><Arms size={72} decorative /></div>
    </div>
    <div class="copy">
      <p class="eyebrow">Private ledger</p>
      <h1>Unlock</h1>
      {#if session.lockedReason === "idle"}
        <p class="micro">Locked after a period without activity.</p>
      {:else if session.lockedReason === "manual"}
        <p class="micro">Locked. Your keys were cleared from memory.</p>
      {/if}
      {#if session.accounts[0]}
        <div class="who">
          <p class="eyebrow">{session.accounts[0].name}</p>
          <Identifier value={session.accounts[0].address} label="Address" truncate copy={false} />
        </div>
      {/if}

      {#if fatal}
        <InlineStatus tone="rejected" title="This wallet cannot be opened here">
          {fatal} Your recovery phrase still restores it: <a href="/import">restore from your phrase</a>, or read the
          <a href="/recovery">recovery guide</a>.
        </InlineStatus>
      {:else}
        <form onsubmit={submit} novalidate>
          <PasswordField bind:value={password} {error} autocomplete="current-password" />
          <Button variant="primary" type="submit" icon="unlock" {busy} disabled={wait > 0 || !password} wide>
            {busy ? "Deriving the key…" : wait > 0 ? `Try again in ${wait}s` : "Unlock"}
          </Button>
        </form>
      {/if}
      <p class="links micro">
        <a href="/import">Restore with a recovery phrase</a> · <a href="/recovery">Forgotten password?</a>
      </p>
    </div>
  </section>
</CeremonyShell>

<style>
  .unlock {
    display: grid;
    grid-template-columns: auto minmax(0, 420px);
    gap: var(--space-12);
    align-items: center;
    justify-content: center;
    min-height: 60dvh;
  }

  .mark {
    position: relative;
    display: grid;
    place-items: center;
  }

  .arms {
    position: absolute;
    transition: opacity var(--dur-considered) var(--ease-ink) 300ms;
  }

  .hidden {
    opacity: 0;
  }

  .copy {
    display: grid;
    gap: var(--space-5);
  }

  h1 {
    font-size: var(--type-display);
    font-weight: var(--type-display-weight);
    letter-spacing: var(--type-display-track);
    line-height: var(--leading-tight);
  }

  .who {
    display: grid;
    gap: var(--space-1);
    padding: var(--space-4) 0;
    border-top: var(--hairline) solid var(--rule-hairline);
    border-bottom: var(--hairline) solid var(--rule-hairline);
  }

  form {
    display: grid;
    gap: var(--space-5);
  }

  .links a {
    color: var(--ink-secondary);
  }

  @media (max-width: 720px) {
    .unlock {
      grid-template-columns: minmax(0, 1fr);
      justify-items: start;
      gap: var(--space-6);
    }
  }
</style>
