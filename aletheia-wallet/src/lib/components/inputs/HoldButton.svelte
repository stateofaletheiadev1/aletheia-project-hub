<script lang="ts">
  // Press-and-hold confirmation (S-2, S-4). The ring fills like ink while held; releasing early
  // cancels. Keyboard: hold Enter or Space. Assistive technology: a confirm checkbox plus a normal
  // activation, offered by "Confirm without holding" (wallet prompt 9, 15.1).
  import { onDestroy } from "svelte";

  let {
    label,
    duration = 1000,
    disabled = false,
    onconfirm,
    hint = "Press and hold",
  }: { label: string; duration?: number; disabled?: boolean; onconfirm: () => void; hint?: string } = $props();

  let progress = $state(0);
  let holding = $state(false);
  let done = $state(false);
  let alternative = $state(false);
  let ticked = $state(false);
  let frame = 0;
  let started = 0;

  const R = 26;
  const CIRC = 2 * Math.PI * R;

  function step(now: number) {
    progress = Math.min(1, (now - started) / duration);
    if (progress >= 1) {
      holding = false;
      done = true;
      onconfirm();
      return;
    }
    frame = requestAnimationFrame(step);
  }

  function start() {
    if (disabled || holding || done) return;
    holding = true;
    started = performance.now();
    frame = requestAnimationFrame(step);
  }

  function cancel() {
    if (!holding) return;
    cancelAnimationFrame(frame);
    holding = false;
    progress = 0;
  }

  function onkeydown(event: KeyboardEvent) {
    if ((event.key === "Enter" || event.key === " ") && !event.repeat) {
      event.preventDefault();
      start();
    }
  }

  function onkeyup(event: KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") cancel();
  }

  export function reset() {
    done = false;
    progress = 0;
    ticked = false;
  }

  onDestroy(() => cancelAnimationFrame(frame));
</script>

<div class="hold" class:holding class:done class:disabled>
  {#if !alternative}
    <button
      type="button"
      class="press"
      {disabled}
      onpointerdown={start}
      onpointerup={cancel}
      onpointerleave={cancel}
      onpointercancel={cancel}
      oncontextmenu={(e) => e.preventDefault()}
      {onkeydown}
      {onkeyup}
      aria-describedby="hold-hint"
    >
      <svg viewBox="0 0 60 60" width="60" height="60" aria-hidden="true">
        <circle class="track" cx="30" cy="30" r={R} />
        <circle
          class="ink"
          cx="30"
          cy="30"
          r={R}
          style:stroke-dashoffset={CIRC * (1 - progress)}
          style:stroke-dasharray={CIRC}
        />
        <circle class="core" cx="30" cy="30" r={R - 6} style:transform="scale({0.86 + progress * 0.14})" />
      </svg>
      <span class="label">{label}</span>
    </button>
    <p id="hold-hint" class="micro">{done ? "Confirmed" : holding ? "Keep holding…" : `${hint} · or hold Enter`}</p>
    <button type="button" class="alt-link micro" onclick={() => (alternative = true)} {disabled}
      >Confirm without holding</button
    >
  {:else}
    <div class="alt">
      <label class="check">
        <input type="checkbox" bind:checked={ticked} {disabled} />
        <span>I have read the details above and confirm them.</span>
      </label>
      <button
        type="button"
        class="confirm"
        disabled={disabled || !ticked || done}
        onclick={() => {
          done = true;
          onconfirm();
        }}>{label}</button
      >
    </div>
  {/if}
</div>

<style>
  .hold {
    display: grid;
    justify-items: start;
    gap: var(--space-2);
  }

  .press {
    display: inline-flex;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-2) var(--space-6) var(--space-2) var(--space-2);
    border: var(--hairline) solid var(--rule-strong);
    border-radius: var(--radius-3);
    background: var(--surface-sheet);
    color: var(--ink-heading);
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    transition: background-color var(--dur-quick) var(--ease-ink);
  }

  .press:hover:not(:disabled) {
    background: var(--surface-sunken);
  }

  .label {
    font-weight: 700;
    font-size: 1rem;
    letter-spacing: 0.01em;
  }

  svg {
    transform: rotate(-90deg);
  }

  .track {
    fill: none;
    stroke: var(--rule-hairline);
    stroke-width: 2;
  }

  .ink {
    fill: none;
    stroke: var(--accent-seal);
    stroke-width: 2.5;
    stroke-linecap: butt;
  }

  .core {
    fill: var(--accent-authority);
    transform-origin: 30px 30px;
    transition: fill var(--dur-base) var(--ease-ink);
  }

  .done .core {
    fill: var(--state-verified);
  }

  .disabled .press {
    color: var(--ink-disabled);
    border-style: dashed;
    border-color: var(--rule-hairline);
  }

  .disabled .core {
    fill: var(--state-disabled);
  }

  .alt-link {
    color: var(--ink-secondary);
    text-decoration: underline;
    text-decoration-color: var(--rule-control);
    text-underline-offset: 0.25em;
    min-height: var(--target-min);
  }

  .alt {
    display: grid;
    gap: var(--space-3);
  }

  .check {
    display: flex;
    gap: var(--space-3);
    align-items: flex-start;
    max-width: 44ch;
  }

  .check input {
    width: 18px;
    height: 18px;
    margin-top: 3px;
    accent-color: var(--accent-authority);
  }

  .confirm {
    justify-self: start;
    min-height: var(--button-height);
    padding: 0 var(--space-6);
    border-radius: var(--radius-2);
    background: var(--accent-authority);
    color: var(--ink-on-accent);
    font-weight: 700;
  }

  .confirm:disabled {
    background: transparent;
    color: var(--ink-disabled);
    border: var(--hairline) dashed var(--rule-hairline);
  }
</style>
