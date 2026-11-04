<script lang="ts">
  // A modal dialog on the native <dialog> element: focus is trapped and the page behind is inert by
  // the platform. Opens with the sheet-unfold motion (M-08).
  import type { Snippet } from "svelte";

  let {
    open = $bindable(false),
    title,
    children,
    actions,
  }: { open?: boolean; title: string; children: Snippet; actions?: Snippet } = $props();
  let dialog = $state<HTMLDialogElement>();

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  });
</script>

<dialog bind:this={dialog} onclose={() => (open = false)} aria-labelledby="dialog-title" class="unfold">
  <h2 id="dialog-title">{title}</h2>
  <div class="body">{@render children()}</div>
  {#if actions}<div class="actions">{@render actions()}</div>{/if}
</dialog>

<style>
  dialog {
    width: min(520px, calc(100vw - var(--space-8)));
    padding: var(--space-8);
    border: var(--hairline) solid var(--rule-strong);
    border-radius: var(--sheet-radius);
    background: var(--sheet-bg);
    color: var(--ink-primary);
  }

  dialog::backdrop {
    background: var(--surface-scrim);
  }

  h2 {
    font-size: var(--type-title);
    font-weight: 600;
    margin-bottom: var(--space-4);
  }

  .body {
    display: grid;
    gap: var(--space-4);
    color: var(--ink-secondary);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--space-3);
    margin-top: var(--space-8);
  }
</style>
