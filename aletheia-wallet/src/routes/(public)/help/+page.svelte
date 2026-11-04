<script lang="ts">
  // Help (wallet prompt 8): editorial documentation with anchors and a search over its sections.
  import Editorial from "$lib/layouts/Editorial.svelte";
  import TextField from "$lib/components/inputs/TextField.svelte";

  const TOPICS = [
    {
      id: "create",
      label: "Creating a wallet",
      body: "Choose Create a wallet, read the three statements, and generate your 24 words. Reveal them on the Recovery Certificate, write them in order on paper, then confirm four of them. Finally choose a password to seal this device's copy.",
    },
    {
      id: "restore",
      label: "Restoring a wallet",
      body: "Choose Restore, enter your 24 words (pasting splits them into place) and set a new password. A keystore file made by the command-line tool can also be opened with its own password.",
    },
    {
      id: "receive",
      label: "Receiving",
      body: "Open Receive to show your address and its QR code. You can add an amount to make a payment link. Addresses begin with alt: and their letter case is a checksum: share them exactly.",
    },
    {
      id: "send",
      label: "Sending",
      body: "Enter the recipient, asset and amount, then Price this transfer: the network simulates it and reports the fee. Review the Instruction to Transfer and hold to sign. The transfer moves through Signed, Submitted, Accepted and Finalized.",
    },
    {
      id: "fees",
      label: "Fees",
      body: "Fees are paid in ALnT or AEY and set by the network from the execution units a transfer uses. The review shows the fee from simulation and the maximum allowed. A fee is charged even when a transfer fails on chain.",
    },
    {
      id: "finality",
      label: "Finality",
      body: "A transfer is final when the network has finalized the block that holds it, usually within about a second. Until then it is shown as awaiting finality — never as complete.",
    },
    {
      id: "activity",
      label: "Activity",
      body: "Activity lists transfers this wallet sent and those it saw arrive while open. The full history of any account is on the Explorer.",
    },
    {
      id: "lock",
      label: "Locking and passwords",
      body: "The wallet locks after a period of inactivity you choose, and when the tab stays hidden. A forgotten password is replaced by restoring from your recovery phrase.",
    },
    {
      id: "safety",
      label: "Staying safe",
      body: "No one from Aletheia will ever ask for your phrase or password. Check that you are on the official address, and check pasted addresses: some malware swaps them in the clipboard.",
    },
  ];

  let query = $state("");
  const visible = $derived(
    TOPICS.filter((t) => !query.trim() || `${t.label} ${t.body}`.toLowerCase().includes(query.trim().toLowerCase())),
  );
</script>

<Editorial
  eyebrow="Help"
  title="Using the wallet"
  lede="Short answers to the questions people ask most."
  sections={TOPICS.map(({ id, label }) => ({ id, label }))}
>
  <TextField label="Search help" bind:value={query} type="search" autocomplete="off" />
  {#each visible as topic (topic.id)}
    <section id={topic.id}>
      <h2>{topic.label}</h2>
      <p>{topic.body}</p>
    </section>
  {:else}
    <p>No help section matches “{query}”.</p>
  {/each}
</Editorial>
