<script lang="ts">
  import { groupIdentifier } from "$lib/format/identifier";

  // An identifier set like an engraved serial (spec 41A.3). The prefix sits back, the
  // characters that tell identifiers apart come forward. Compact form: head … tail. Full form:
  // groups of four, spaced with margins so a copy yields the canonical string exactly.
  let { value, full = false, head = 8, tail = 6 }: { value: string; full?: boolean; head?: number; tail?: number } = $props();

  const parts = $derived(groupIdentifier(value));
  const body = $derived(parts.groups.join(""));
  const compact = $derived(!full && body.length > head + tail + 1);
</script>

<!-- Written without whitespace between the parts, so none is rendered or copied. -->
<span class="ident mono" class:full title={value}
  >{#if parts.prefix}<span class="pfx">{parts.prefix}</span>{/if}{#if full}{#each parts.groups as group, i (i)}<span class="g"
        >{group}</span
      >{/each}{:else if compact}<span>{body.slice(0, head)}</span><span class="ell" aria-hidden="true">…</span><span
      >{body.slice(-tail)}</span
    >{:else}<span>{body}</span>{/if}</span
>

<style>
  .ident {
    display: inline;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .full {
    white-space: normal;
    overflow-wrap: anywhere;
  }
  .pfx {
    opacity: 0.62;
    font-weight: 500;
  }
  .ell {
    display: inline-block;
    padding-inline: 0.12em;
    opacity: 0.55;
  }
  .g {
    display: inline-block;
  }
  /* Space trails each group, so a wrapped line starts flush. */
  .g:not(:last-child) {
    margin-right: 0.32em;
  }
  .pfx + .g {
    margin-left: 0.08em;
  }
</style>
