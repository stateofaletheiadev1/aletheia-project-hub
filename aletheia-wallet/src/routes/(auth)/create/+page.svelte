<script lang="ts">
  // Create (wallet prompt 8): Understand → Generate → Certificate (S-2) → Verify → Seal (S-3).
  // The phrase is generated in the worker; its words are shown here only for the Certificate and
  // the verification, then dropped. The worker seals the entropy it already holds.
  import { goto } from "$app/navigation";
  import { onDestroy } from "svelte";
  import CeremonyShell from "$lib/layouts/CeremonyShell.svelte";
  import RecoveryCertificate from "$lib/components/data/RecoveryCertificate.svelte";
  import SealMark from "$lib/components/data/SealMark.svelte";
  import Button from "$lib/components/inputs/Button.svelte";
  import HoldButton from "$lib/components/inputs/HoldButton.svelte";
  import PasswordField from "$lib/components/inputs/PasswordField.svelte";
  import TextField from "$lib/components/inputs/TextField.svelte";
  import InlineStatus from "$lib/components/feedback/InlineStatus.svelte";
  import Icon from "$lib/design/icons/Icon.svelte";
  import { session } from "$lib/state/session.svelte";
  import { config } from "$lib/config";
  import { networkLabel } from "$lib/stablechain/network/kind";

  const STEPS = ["Understand", "Generate", "Certificate", "Verify", "Seal"] as const;
  let step = $state(0);
  let words = $state<string[]>([]);
  let revealed = $state(false);
  let busy = $state(false);
  let problem = $state<string | null>(null);

  // Verify
  let positions = $state<number[]>([]);
  let bank = $state<string[]>([]);
  let filled = $state<Record<number, string>>({});
  let wrong = $state<string | null>(null);

  // Seal
  let name = $state("Account 1");
  let password = $state("");
  let confirm = $state("");
  let score = $state<number | null>(null);
  let touched = $state(false);
  let seal = $state<"idle" | "working" | "sealed">("idle");

  const ackItems = [
    "The recovery phrase is the wallet. Whoever holds it holds the funds.",
    "The password only protects this device's copy. It cannot recover the wallet.",
    "No one — not the State, not the network — can restore a lost phrase.",
  ];
  let acks = $state([false, false, false]);

  async function generate() {
    busy = true;
    problem = null;
    try {
      words = (await session.worker.request({ op: "generate" })).words;
      revealed = false;
      step = 2;
    } catch {
      problem = "The phrase could not be generated in this browser.";
    } finally {
      busy = false;
    }
  }

  function shuffle<T>(items: T[]): T[] {
    const out = [...items];
    const random = crypto.getRandomValues(new Uint32Array(out.length));
    for (let i = out.length - 1; i > 0; i--) {
      const j = random[i]! % (i + 1);
      [out[i], out[j]] = [out[j]!, out[i]!];
    }
    return out;
  }

  function startVerify() {
    const order = shuffle(words.map((_, i) => i));
    positions = order.slice(0, 4).sort((a, b) => a - b);
    const decoys = order.slice(4, 12).map((i) => words[i]!);
    bank = shuffle([...positions.map((i) => words[i]!), ...decoys]);
    filled = {};
    wrong = null;
    step = 3;
  }

  const nextPosition = $derived(positions.find((p) => !(p in filled)) ?? null);

  function pick(word: string) {
    if (nextPosition === null) return;
    if (words[nextPosition] === word) {
      filled = { ...filled, [nextPosition]: word };
      wrong = null;
    } else {
      wrong = `That is not word ${nextPosition + 1}. Check your written copy.`;
    }
  }

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

  async function sealWallet(event: SubmitEvent) {
    event.preventDefault();
    touched = true;
    if (passwordError || confirmError || !password) return;
    busy = true;
    seal = "working";
    problem = null;
    try {
      const created = await session.worker.request({
        op: "createFromPending",
        password,
        network: session.network,
        name: name.trim() || "Account 1",
      });
      words = [];
      password = "";
      confirm = "";
      seal = "sealed";
      await session.adoptCreated(created);
      await new Promise((resolve) => setTimeout(resolve, 900));
      await goto("/dashboard");
    } catch {
      seal = "idle";
      problem = "The wallet could not be sealed. Nothing was stored.";
    } finally {
      busy = false;
    }
  }

  onDestroy(() => {
    words = [];
    if (step < 4 || seal !== "sealed") void session.worker.request({ op: "discardPending" }).catch(() => undefined);
  });
</script>

<CeremonyShell steps={STEPS} current={step}>
  {#if step === 0}
    <section class="stage settle">
      <p class="eyebrow">Step I · Understand</p>
      <h1>Before your ledger is made</h1>
      <p class="lede">
        You are about to create a wallet on {networkLabel(config.network)}. It will be generated here, in this browser,
        and nowhere else.
      </p>
      <ul class="acks">
        {#each ackItems as item, i (i)}
          <li>
            <label>
              <input type="checkbox" bind:checked={acks[i]} />
              <span>{item}</span>
            </label>
          </li>
        {/each}
      </ul>
      <div class="actions">
        <Button variant="primary" disabled={!acks.every(Boolean)} onclick={() => (step = 1)}>I understand</Button>
        <Button variant="plain" href="/import">I already have a phrase</Button>
      </div>
    </section>
  {:else if step === 1}
    <section class="stage settle">
      <p class="eyebrow">Step II · Generate</p>
      <h1>Generate your recovery phrase</h1>
      <p class="lede">
        24 words from 256 bits of your device's randomness. Have paper and a pen ready; choose a private place.
      </p>
      <InlineStatus tone="info" title="Write it by hand"
        >Screenshots and cloud notes can be read by others. Paper, kept somewhere safe, cannot.</InlineStatus
      >
      {#if problem}<InlineStatus tone="rejected" title="Not generated">{problem}</InlineStatus>{/if}
      <div class="actions">
        <Button variant="primary" icon="key" {busy} onclick={generate}>Generate 24 words</Button>
      </div>
    </section>
  {:else if step === 2}
    <section class="stage settle">
      <p class="eyebrow">Step III · Certificate</p>
      <h1>Your Recovery Certificate</h1>
      <p class="lede">Reveal the words, write all 24 in order, then hold to confirm.</p>
      <RecoveryCertificate {words} {revealed} />
      <div class="actions spread">
        <Button variant="quiet" icon={revealed ? "eye-off" : "eye"} onclick={() => (revealed = !revealed)}
          >{revealed ? "Mask words" : "Reveal words"}</Button
        >
        <HoldButton label="I have written this down" duration={1200} disabled={!revealed} onconfirm={startVerify} />
      </div>
    </section>
  {:else if step === 3}
    <section class="stage settle">
      <p class="eyebrow">Step IV · Verify</p>
      <h1>Confirm four words</h1>
      <p class="lede">From your written copy, choose the word for each numbered place.</p>
      <ol class="verify">
        {#each positions as p (p)}
          <li class:filled={p in filled} class:next={p === nextPosition}>
            <span class="n numerals">{String(p + 1).padStart(2, "0")}</span>
            <span class="slot">{filled[p] ?? (p === nextPosition ? "Choose…" : "")}</span>
            {#if p in filled}<Icon name="check" size={16} />{/if}
          </li>
        {/each}
      </ol>
      <div
        class="bank"
        role="group"
        aria-label="Word choices for place {nextPosition !== null ? nextPosition + 1 : ''}"
      >
        {#each bank as word, i (i)}
          <button
            type="button"
            class="chip"
            disabled={Object.values(filled).includes(word) || nextPosition === null}
            onclick={() => pick(word)}>{word}</button
          >
        {/each}
      </div>
      <p class="feedback" role="status">{wrong ?? ""}</p>
      <div class="actions">
        <Button variant="primary" disabled={nextPosition !== null} onclick={() => ((revealed = false), (step = 4))}
          >Continue</Button
        >
        <Button variant="plain" onclick={() => (step = 2)}>Back to the certificate</Button>
      </div>
    </section>
  {:else}
    <section class="stage seal-stage settle">
      <div class="seal-copy">
        <p class="eyebrow">Step V · Seal</p>
        <h1>Seal it on this device</h1>
        <p class="lede">
          A password encrypts this device's copy with Argon2id and XChaCha20-Poly1305. It never leaves the browser.
        </p>
        <form class="form" onsubmit={sealWallet} novalidate>
          <TextField label="Account name" bind:value={name} hint="Only you see this name." autocomplete="off" />
          <PasswordField
            label="New password"
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
          {#if problem}<InlineStatus tone="rejected" title="Not sealed">{problem}</InlineStatus>{/if}
          <div class="actions">
            <Button variant="primary" type="submit" icon="lock" {busy}
              >{seal === "working" ? "Sealing…" : "Seal wallet"}</Button
            >
          </div>
          {#if seal === "working"}<p class="micro" role="status">
              Deriving the encryption key — this is intentionally slow.
            </p>{/if}
          {#if seal === "sealed"}<p class="micro sealed" role="status">Sealed. Opening your ledger…</p>{/if}
        </form>
      </div>
      <div class="seal-art"><SealMark state={seal} size={196} /></div>
    </section>
  {/if}
</CeremonyShell>

<style>
  .stage {
    display: grid;
    gap: var(--space-6);
  }

  h1 {
    font-size: var(--type-display);
    font-weight: var(--type-display-weight);
    letter-spacing: var(--type-display-track);
    line-height: var(--leading-tight);
  }

  .acks {
    display: grid;
    border-top: var(--hairline) solid var(--rule-hairline);
  }

  .acks li {
    border-bottom: var(--hairline) solid var(--rule-hairline);
  }

  .acks label {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--space-4);
    align-items: start;
    padding: var(--space-4) 0;
    cursor: pointer;
    font-weight: 500;
  }

  .acks input {
    width: 18px;
    height: 18px;
    margin-top: 4px;
    accent-color: var(--accent-authority);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-4);
  }

  .spread {
    justify-content: space-between;
    align-items: flex-start;
  }

  .verify {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--space-6);
  }

  .verify li {
    display: grid;
    grid-template-columns: 2.4ch 1fr auto;
    align-items: baseline;
    gap: var(--space-2);
    min-height: 52px;
    padding-top: var(--space-3);
    border-bottom: var(--hairline) solid var(--rule-control);
    color: var(--ink-muted);
  }

  .verify .next {
    border-bottom: 1.5px solid var(--focus-ring);
  }

  .verify .filled {
    color: var(--state-verified);
    border-bottom-color: var(--state-verified);
  }

  .verify .filled .slot {
    color: var(--ink-heading);
    font-weight: 650;
    animation: press 360ms var(--ease-seal);
  }

  @keyframes press {
    from {
      transform: scale(1.12);
      opacity: 0.4;
    }
  }

  .n {
    font-size: var(--type-micro);
    font-weight: 600;
  }

  .bank {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .chip {
    min-height: var(--target-touch);
    padding: 0 var(--space-4);
    border: var(--hairline) solid var(--rule-control);
    border-radius: var(--radius-2);
    font-weight: 600;
    color: var(--ink-heading);
    background: var(--surface-sheet);
  }

  .chip:hover:not(:disabled) {
    border-color: var(--rule-strong);
  }

  .chip:disabled {
    opacity: 0.35;
  }

  .feedback {
    min-height: 1.5em;
    color: var(--state-rejected);
    font-weight: 600;
  }

  .seal-stage {
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--space-12);
  }

  .seal-copy {
    display: grid;
    gap: var(--space-5);
  }

  .form {
    display: grid;
    gap: var(--space-6);
    max-width: 460px;
  }

  .sealed {
    color: var(--state-verified);
  }

  @media (max-width: 860px) {
    .verify {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .seal-stage {
      grid-template-columns: minmax(0, 1fr);
    }

    .seal-art {
      order: -1;
    }
  }
</style>
