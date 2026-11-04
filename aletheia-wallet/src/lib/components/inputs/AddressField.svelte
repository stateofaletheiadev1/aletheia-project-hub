<script lang="ts">
  // Recipient entry (wallet prompt 9): live strict parse, network check, address-book match, and
  // payment URIs pasted whole. Nothing is normalised: a non-canonical spelling is explained.
  import TextField from "./TextField.svelte";
  import { config } from "$lib/config";
  import { addressProblem } from "$lib/stablechain/addresses/identifiers";
  import { networkLabel } from "$lib/stablechain/network/kind";
  import type { Contact } from "$lib/storage/db";

  let {
    value = $bindable(""),
    contacts = [],
    self = null,
    onuri,
    touched = false,
  }: {
    value?: string;
    contacts?: Contact[];
    self?: string | null;
    onuri?: (uri: string) => void;
    touched?: boolean;
  } = $props();

  const text = $derived(value.trim());
  const problem = $derived(text ? addressProblem(text, config.network) : null);
  const match = $derived(problem ? null : (contacts.find((c) => c.address === text) ?? null));
  const error = $derived.by(() => {
    if (!text || !touched) return null;
    if (text.startsWith("aletheia:")) return null;
    if (!problem) return null;
    if (problem.problem === "wrong-network") {
      return `This address belongs to ${problem.foundNetwork ? networkLabel(problem.foundNetwork) : "another network"}. Funds sent to it on ${networkLabel(config.network)} would reach no one.`;
    }
    if (problem.problem === "non-canonical")
      return "Address not in its checksummed form. Copy it again from its owner; letter case carries the checksum.";
    if (text.startsWith("0x")) return "AletheiaChain addresses begin with alt:, not 0x.";
    return "Address not recognised on AletheiaChain. It begins with alt: followed by 40 characters.";
  });
  const hint = $derived(
    match
      ? `Saved as “${match.name}”`
      : !problem && text && text === self
        ? "This is your own address."
        : !problem && text
          ? "Checksum verified for this network."
          : "Paste an alt: address or an aletheia: payment link.",
  );

  function onpaste(event: ClipboardEvent) {
    const pasted = event.clipboardData?.getData("text")?.trim() ?? "";
    if (pasted.startsWith("aletheia:") && onuri) {
      event.preventDefault();
      onuri(pasted);
    }
  }
</script>

<TextField label="To" bind:value {error} {hint} placeholder="alt:…" autocomplete="off" autocapitalize="off" {onpaste} />
