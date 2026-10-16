<script lang="ts">
  import Icon, { type IconName } from "./Icon.svelte";

  let {
    icon,
    label,
    value,
    unit = "",
    note = "",
  }: { icon: IconName; label: string; value: string; unit?: string; note?: string } = $props();
</script>

<div class="tile panel">
  <span class="plate"><Icon name={icon} size={20} /></span>
  <div class="body">
    <span class="label">{label}</span>
    <span class="value num">
      {#key value}<span class="figure">{value}</span>{/key}
      {#if unit}<span class="unit">{unit}</span>{/if}
    </span>
    {#if note}<span class="note">{note}</span>{/if}
  </div>
</div>

<style>
  .tile {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.2rem 1.3rem;
    min-width: 0;
    transition:
      transform var(--calm) var(--ease),
      border-color var(--calm) var(--ease);
  }
  .tile:hover {
    border-color: rgb(196 154 78 / 0.45);
  }
  /* A navy plate with a gold rim, as the arms frame their charges. */
  .plate {
    display: grid;
    place-items: center;
    width: 2.75rem;
    height: 2.75rem;
    flex: none;
    border-radius: 0.7rem;
    color: var(--brand-gold-bright);
    background: linear-gradient(170deg, var(--brand-navy), var(--brand-navy-deep));
    border: 1px solid rgb(196 154 78 / 0.5);
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 0.08),
      0 8px 18px -10px rgb(3 12 58 / 0.8);
  }
  .body {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 0;
  }
  .value {
    display: flex;
    align-items: baseline;
    gap: 0.35rem;
    margin-block: 0.1rem;
    font-size: 1.75rem;
    font-weight: 800;
    line-height: 1.1;
    letter-spacing: -0.035em;
    white-space: nowrap;
  }
  .figure {
    animation: ink-in var(--calm) var(--ease);
  }
  .unit {
    font-size: var(--fs-xs);
    font-weight: 800;
    letter-spacing: 0.06em;
    color: var(--gold);
  }
  .note {
    font-size: var(--fs-xs);
    color: var(--text-faint);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
