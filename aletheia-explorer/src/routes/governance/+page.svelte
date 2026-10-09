<script lang="ts">
  import Facts from "$lib/components/Facts.svelte";
  import Flow from "$lib/components/Flow.svelte";
  import Topic from "$lib/components/Topic.svelte";
  import TopicHero from "$lib/components/TopicHero.svelte";

  const actions = [
    ["Suspend a payment participant", "Immediate", "For cause: a suspension takes effect in the same block."],
    ["Pause a bridge route", "Immediate", "Stops new bridge messages at once; balances are never touched."],
    ["Register or deactivate an issuer", "1 epoch", "Identity and residence issuers, and land authorities, with their scopes."],
    ["Set a fee price", "1 epoch", "The price per execution unit of a fee asset; at most doubling or halving per proposal."],
    ["Admit or change a participant", "1 epoch", "Banks and payment institutions in the payment network."],
    ["Resume a bridge route", "1 epoch", "A resumption waits one epoch after approval."],
    ["Set AEY authorized capacity", "4 epochs", "Never below outstanding supply, and rising by at most the governed maximum."],
    ["Open a bridge route or set its guardians", "4 epochs", "Routes always open paused; guardian sets need a two-thirds threshold."],
    ["Schedule a protocol upgrade", "8 epochs", "The new rules activate at a set height, after every operator has had time to upgrade."],
    ["Replace the council", "8 epochs", "The longest notice, because it changes who governs."],
  ];
</script>

<svelte:head>
  <title>Governance · Aletheia Explorer</title>
  <meta name="description" content="How the Sovereign Covenant State governs StableChain: the council, proposals, votes, timelocks and the closed list of actions." />
</svelte:head>

<TopicHero
  eyebrow="Consensus & Staking"
  title="Governance"
  lede="StableChain changes only by open, recorded decisions of the council. Every proposal, every vote and every change is a transaction on the ledger, and every change waits out a public notice period before it takes effect."
  keys={[
    { icon: "shield", label: "Decided by", value: "A council of 1 to 32 members, M of N" },
    { icon: "clock", label: "Notice before a change", value: "From immediate to 8 epochs" },
    { icon: "layers", label: "What it can do", value: "A closed list of bounded actions" },
  ]}
/>

<div class="container grid">
  <Topic n={1} title="How a decision is made" wide>
    <p>
      A council member proposes one action. Members vote until the threshold of approvals is reached, or until so many reject it
      that it can no longer pass. An approved proposal then waits out its timelock, and anyone may execute it once the timelock
      ends. If nobody executes it within the execution window, it expires.
    </p>
    <Flow
      steps={[
        { name: "Proposed", text: "A council member submits the action; its identifier binds proposer, nonce and action." },
        { name: "Voting", text: "Members approve or reject during the voting period." },
        { name: "Timelocked", text: "Approved by the threshold; the public notice period runs." },
        { name: "Executed", text: "Anyone triggers it after the timelock; the change takes effect.", tone: "ok" },
        { name: "Or expired", text: "Rejected, or not executed within the window: nothing changes.", tone: "stop" },
      ]}
    />
  </Topic>

  <Topic n={2} title="What governance may do" wide>
    <p>
      Governance can only perform actions from a closed list, each with built-in bounds. It cannot move anyone's balance, write
      arbitrary state, or reverse a final block. The notice period grows with the weight of the change.
    </p>
    <div class="table-wrap">
      <table class="scan">
        <thead><tr><th>Action</th><th>Timelock</th><th>Bounds</th></tr></thead>
        <tbody>
          {#each actions as [action, lock, bounds] (action)}
            <tr>
              <td><strong>{action}</strong></td>
              <td><span class="lock" class:now={lock === "Immediate"}>{lock}</span></td>
              <td class="wrap">{bounds}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </Topic>

  <Topic n={3} title="The council">
    <Facts
      columns={1}
      items={[
        ["Membership", "Between 1 and 32 accounts, with an M-of-N threshold, set at genesis and changed only by a council proposal with the longest notice."],
        ["Rejection", "A proposal fails as soon as more members reject it than the council could spare and still reach the threshold."],
        ["Identity of a proposal", "Each proposal's identifier is a hash of its proposer, the proposer's nonce and the action, so the same proposal cannot be submitted twice."],
      ]}
    />
  </Topic>

  <Topic n={4} title="Epochs and timing">
    <Facts
      columns={1}
      items={[
        ["Governance epoch", "Timelocks are counted in governance epochs of a fixed number of slots, set at genesis: 512 slots, about 4 minutes 16 seconds at 500 ms each."],
        ["Execution window", "After its timelock, an approved proposal must be executed within a set number of epochs, or it expires."],
        ["Upgrades", "A protocol upgrade names the height at which the new rules begin, so every node switches at the same block."],
      ]}
    />
  </Topic>

  <Topic n={5} title="Seeing it on the ledger" wide>
    <p>
      Proposals, votes and executions are ordinary transactions of the governance types (80 Propose, 81 Vote, 82 Execute), signed by
      council members and settled in finalized blocks. They appear in the <a class="link" href="/transactions">Transactions</a>
      register as <strong>Registry</strong> transactions, with the proposal recorded in each receipt's events. Each executed change
      is final like any other block: the record of who proposed, who voted and when it took effect can never be altered.
    </p>
  </Topic>
</div>

<style>
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.25rem;
  }
  .table-wrap {
    overflow-x: auto;
  }
  .table-wrap .scan {
    min-width: 40rem;
  }
  .wrap {
    white-space: normal !important;
    color: var(--text-soft);
  }
  .lock {
    display: inline-block;
    padding: 0.18rem 0.55rem;
    font-size: var(--fs-xs);
    font-weight: 800;
    color: var(--brand-cream);
    background: var(--brand-navy);
    border: 1px solid rgb(196 154 78 / 0.55);
    border-radius: 0.375rem;
  }
  .lock.now {
    color: var(--warn);
    border-color: rgb(255 216 137 / 0.5);
  }
  .link {
    color: var(--accent);
    font-weight: 700;
  }
  @media (max-width: 64rem) {
    .grid {
      grid-template-columns: 1fr;
    }
  }
</style>
