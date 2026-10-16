<script lang="ts">
  import CodeBlock from "$lib/components/CodeBlock.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import { EXAMPLES, SAMPLE_ADDRESS, SAMPLE_BLOCK, SAMPLE_HEIGHT, SAMPLE_TX } from "$lib/docs/examples";
  import { PUBLIC } from "$lib/network";

  const sections = [
    { id: "overview", title: "Overview" },
    { id: "quick-start", title: "Quick start" },
    { id: "identifiers", title: "Identifiers & amounts" },
    { id: "rest", title: "REST reference" },
    { id: "json-rpc", title: "JSON-RPC 2.0" },
    { id: "transactions", title: "Sending transactions" },
    { id: "errors", title: "Errors" },
    { id: "limits", title: "Limits & behaviour" },
    { id: "cli", title: "Wallet & CLI" },
  ];

  type Endpoint = { method: "GET" | "POST"; path: string; rpc: string; what: string; example?: string };
  const endpoints: Endpoint[] = [
    { method: "GET", path: "/network/status", rpc: "getNetworkStatus", what: "Chain ID, network, protocol version and the latest finalized block.", example: "status" },
    { method: "GET", path: "/chain/head", rpc: "getChainHead", what: "The latest finalized block (the head is always the finalized head).", example: "head" },
    { method: "GET", path: "/chain/finalized", rpc: "getFinalizedHead", what: "The same block as /chain/head, by its explicit name." },
    { method: "GET", path: "/chain/params", rpc: "getChainParams", what: "Chain ID, protocol version and the assets that may pay fees.", example: "params" },
    { method: "GET", path: "/blocks/height/{height}", rpc: "getBlockByHeight", what: "A finalized block by height." },
    { method: "GET", path: "/blocks/{alt:B…}", rpc: "getBlock", what: "A finalized block by its identifier." },
    { method: "GET", path: "/blocks/{alt:B…}/finality", rpc: "getFinalityProof", what: "The 2-chain finality certificate of a block, where one is stored." },
    { method: "GET", path: "/transactions/{alt:T…}", rpc: "getTransaction", what: "A finalized transaction with its block, fee terms, payload and receipt summary.", example: "tx" },
    { method: "GET", path: "/receipts/{alt:T…}", rpc: "getReceipt", what: "The full receipt: status, execution units, fee, write-set hash and events.", example: "receipt" },
    { method: "GET", path: "/accounts/{alt:…}", rpc: "getAccount", what: "Whether the account exists, and its next nonce.", example: "account" },
    { method: "GET", path: "/accounts/{alt:…}/nonce", rpc: "getAccount", what: "Only the next nonce, for wallets." },
    { method: "GET", path: "/accounts/{alt:…}/balances?asset=AEY", rpc: "getBalance", what: "Balances in AEY and ALnT, or one asset with ?asset=.", example: "balances" },
    { method: "GET", path: "/assets", rpc: "getAssets", what: "The asset registry: identifiers, names and decimals.", example: "assets" },
    { method: "GET", path: "/monetary/{asset}/supply", rpc: "getMonetarySupply", what: "The supply ledger: issued, burned, redeemed, circulating, locked and the rest.", example: "supply" },
    { method: "GET", path: "/validators?epoch={n}", rpc: "getValidatorSet", what: "The validator set of an epoch (default: the current one).", example: "validators" },
    { method: "POST", path: "/transactions/simulate", rpc: "simulateTransaction", what: "Executes a signed transaction against the finalized state without committing it." },
    { method: "POST", path: "/transactions", rpc: "submitTransaction", what: "Admits a signed transaction to the mempool and returns its identifier." },
  ];
  let open = $state<string | null>("status");

  const errors = [
    ["-32700", "400", "PARSE_ERROR", "The body is not valid JSON."],
    ["-32600", "400", "INVALID_REQUEST", "Not a JSON-RPC 2.0 request, or an HTTP method the route does not use."],
    ["-32601", "400", "METHOD_NOT_FOUND", "No method by that name."],
    ["-32602", "400", "INVALID_PARAMS", "A parameter is missing, unknown or malformed, including any 0x-prefixed value."],
    ["-32001", "429", "RATE_LIMITED", "Too many requests from this address; slow down and retry."],
    ["-32002", "404", "NOT_FOUND", "No finalized block, transaction, receipt or record matches."],
    ["-32010", "400", "TX_REJECTED", "The transaction was refused at admission; data names the protocol error."],
    ["-32011", "400", "SIMULATION_FAILED", "The transaction would fail on chain; data names the protocol error."],
    ["-32603", "500", "INTERNAL", "The node could not answer; nothing was changed."],
  ];

  const quickRest = `curl ${PUBLIC.rest}/network/status`;
  const quickRpc = `curl ${PUBLIC.jsonRpc} \\
  -H 'content-type: application/json' \\
  -d '{"jsonrpc":"2.0","id":1,"method":"getNetworkStatus","params":{}}'`;
  const rpcCall = `curl ${PUBLIC.jsonRpc} \\
  -H 'content-type: application/json' \\
  -d '{"jsonrpc":"2.0","id":7,"method":"getTransaction","params":{"txId":"${SAMPLE_TX}"}}'`;
  const submit = `# 1. Simulate: what the chain would do, and what it would charge
curl -X POST ${PUBLIC.rest}/transactions/simulate \\
  -H 'content-type: application/json' -d '{"tx":"<signed transaction, base16>"}'

# 2. Submit: admitted to the mempool; the answer carries the alt:T… identifier
curl -X POST ${PUBLIC.rest}/transactions \\
  -H 'content-type: application/json' -d '{"tx":"<signed transaction, base16>"}'

# 3. Track: 404 until the block holding it is final, then the transaction
curl ${PUBLIC.rest}/transactions/alt:T…`;
  const cli = `aletheia-cli --rpc 127.0.0.1:7781 status
aletheia-cli keys new  --keystore wallet.json
aletheia-cli keys show --keystore wallet.json
aletheia-cli balance ${SAMPLE_ADDRESS} --asset AEY
aletheia-cli transfer --keystore wallet.json --to alt:… --amount 25.50 --asset AEY
aletheia-cli tx show ${SAMPLE_TX}
aletheia-cli block show 1200
aletheia-cli --output json --network mainnet status`;
  const cliOut = `Network          devnet (chain 7771)
Protocol         1
Finalized        #${SAMPLE_HEIGHT.toLocaleString("en")}   ${SAMPLE_BLOCK}`;
</script>

<svelte:head>
  <title>Developer Docs · Aletheia Explorer</title>
  <meta name="description" content="The Aletheia StableChain RPC: REST and JSON-RPC reference, identifiers, amounts, transactions, errors and the CLI." />
</svelte:head>

<section class="hero container">
  <p class="eyebrow">Protocol resources</p>
  <h1>Developer Docs</h1>
  <p class="lede">
    Everything needed to read Aletheia StableChain and to send transactions to it: the public RPC, its REST and JSON-RPC
    interfaces, how identifiers and amounts are written, and the command-line client. Every example on this page is a real
    response from a running node.
  </p>
  <div class="endpoints">
    <div><span class="label">REST</span><span class="mono">{PUBLIC.rest}</span></div>
    <div><span class="label">JSON-RPC</span><span class="mono">{PUBLIC.jsonRpc}</span></div>
    <div><span class="label">Explorer</span><span class="mono">{PUBLIC.explorer}</span></div>
  </div>
</section>

<div class="container layout">
  <nav class="toc" aria-label="On this page">
    <p class="label">On this page</p>
    {#each sections as s, i (s.id)}
      <a href="#{s.id}"><span class="num">{String(i + 1).padStart(2, "0")}</span>{s.title}</a>
    {/each}
  </nav>

  <div class="content">
    <section id="overview" class="panel doc">
      <h2><span class="n">01</span> Overview</h2>
      <p>
        The RPC is the public read interface of the national ledger. It serves <strong>finalized data only</strong>: every block,
        transaction and balance it returns is final and will never change. Nothing speculative or pending is ever served, so a
        result you have read can be relied on and cached.
      </p>
      <div class="cards">
        <div class="card">
          <Icon name="search" size={18} />
          <h3>Read</h3>
          <p>Blocks, transactions, receipts, accounts, balances, assets, supply and the validator set.</p>
        </div>
        <div class="card">
          <Icon name="activity" size={18} />
          <h3>Simulate</h3>
          <p>Run a signed transaction against the finalized state to see its result and fee before sending it.</p>
        </div>
        <div class="card">
          <Icon name="swap" size={18} />
          <h3>Submit</h3>
          <p>Hand a signed transaction to the network and track it until its block is final, about a second later.</p>
        </div>
      </div>
      <h3>Networks</h3>
      <div class="table-wrap">
        <table class="scan">
          <thead><tr><th>Network</th><th>Purpose</th><th>RPC</th><th>Address prefix</th></tr></thead>
          <tbody>
            <tr><td><strong>Mainnet</strong></td><td>The national ledger</td><td class="mono">{PUBLIC.rpc}</td><td class="mono">alt: · checksum al</td></tr>
            <tr><td><strong>Private validation</strong></td><td>Multi-operator rehearsal before mainnet</td><td class="faint">Operators only</td><td class="mono">checksum alt</td></tr>
            <tr><td><strong>Devnet</strong></td><td>Development and testing</td><td class="mono">{PUBLIC.localRpc}</td><td class="mono">checksum ald</td></tr>
          </tbody>
        </table>
      </div>
      <p class="note">
        An address carries its network inside its checksum, so an address from one network is refused by another. The mainnet
        chain ID is assigned at the genesis ceremony.
      </p>
    </section>

    <section id="quick-start" class="panel doc">
      <h2><span class="n">02</span> Quick start</h2>
      <p>Ask the node where the chain is. The same question works through either interface and gets the same answer.</p>
      <div class="pair">
        <CodeBlock label="REST" lang="shell" code={quickRest} />
        <CodeBlock label="JSON-RPC" lang="shell" code={quickRpc} />
      </div>
      <CodeBlock label="Response · devnet" lang="json" code={EXAMPLES["status"] ?? ""} />
      <p>
        <code>finalizedHeight</code> is the latest final block; <code>finalizedBlock</code> is its identifier. A new block is
        produced every 500 ms and becomes final two slots later.
      </p>
    </section>

    <section id="identifiers" class="panel doc">
      <h2><span class="n">03</span> Identifiers & amounts</h2>
      <p>
        Aletheia writes every identifier in one human-checkable form: a prefix that says what it is, and a hex body whose
        capital letters are a checksum, the EIP-55 rule Ethereum addresses use, with the network folded in. It catches typing
        errors and an identifier from another network. Addresses are 20 bytes, so they look like Ethereum addresses after
        <code>alt:</code>; copy them exactly, capitals included. <strong>Aletheia never uses the <code>0x</code> prefix</strong>;
        the RPC refuses any value that carries it.
      </p>
      <div class="table-wrap">
        <table class="scan">
          <thead><tr><th>What</th><th>Form</th><th>Example</th></tr></thead>
          <tbody>
            <tr><td>Account address</td><td class="mono">alt:…</td><td class="mono wrap">{SAMPLE_ADDRESS}</td></tr>
            <tr><td>Transaction</td><td class="mono">alt:T…</td><td class="mono wrap">{SAMPLE_TX}</td></tr>
            <tr><td>Block</td><td class="mono">alt:B…</td><td class="mono wrap">{SAMPLE_BLOCK}</td></tr>
            <tr><td>Hashes and roots</td><td>64 lowercase hex characters</td><td class="mono wrap">627df554bc4d8c1b83ac2ab8c9e0ca6f211d9f45cbdee23f590ff9956141215f</td></tr>
          </tbody>
        </table>
      </div>
      <h3>Amounts are exact</h3>
      <p>
        Every amount travels as a <strong>decimal string of base units</strong>, never as a JSON number: a 64-bit float cannot
        hold an 18-decimal value and would round it silently. Parse amounts as big integers. Where the node knows an asset's
        decimals it adds a <code>display</code> field for people; programs should use <code>amount</code> or
        <code>available</code>.
      </p>
      <div class="assets">
        <div class="asset-card">
          <span class="code-name">AEY</span>
          <strong>Aletheian Guilder</strong>
          <span>18 decimals · 1 AEY = 10<sup>18</sup> base units</span>
          <span class="faint">Legal tender; 1 AEY = 1 EUR</span>
        </div>
        <div class="asset-card">
          <span class="code-name">ALnT</span>
          <strong>Aletheia Talent</strong>
          <span>3 decimals · 1 ALnT = 1,000 base units</span>
          <span class="faint">Utility and staking asset; pays fees</span>
        </div>
      </div>
      <CodeBlock label={"GET /accounts/{alt:…}/balances · devnet"} lang="json" code={EXAMPLES["balances"] ?? ""} />
      <CodeBlock label="A 0x-prefixed value is refused" lang="json" code={EXAMPLES["rpc-0x"] ?? ""} />
    </section>

    <section id="rest" class="panel doc">
      <h2><span class="n">04</span> REST reference</h2>
      <p>
        All paths are below <span class="mono">{PUBLIC.rest}</span>. Identifiers go in the path as written. Every REST route has
        a JSON-RPC method that returns identical data. Select a route to see a real response.
      </p>
      <div class="routes">
        {#each endpoints as e (e.path + e.method)}
          <div class="route" class:open={open === e.example && e.example !== undefined}>
            <button
              type="button"
              class="route-head"
              onclick={() => (open = e.example && open !== e.example ? e.example : null)}
              disabled={!e.example}
              aria-expanded={open === e.example && e.example !== undefined}
            >
              <span class="verb {e.method.toLowerCase()}">{e.method}</span>
              <span class="mono path">{e.path}</span>
              <span class="what">{e.what}</span>
              <span class="mono rpc">{e.rpc}</span>
            </button>
            {#if e.example && open === e.example}
              <div class="route-body">
                <CodeBlock label="Response · devnet" lang="json" code={EXAMPLES[e.example] ?? ""} />
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </section>

    <section id="json-rpc" class="panel doc">
      <h2><span class="n">05</span> JSON-RPC 2.0</h2>
      <p>
        Send <code>POST</code> requests to <span class="mono">{PUBLIC.jsonRpc}</span> with a JSON-RPC 2.0 envelope. Parameters
        are always named (an object, never a list), and unknown parameters are refused so a typing mistake cannot pass
        silently. The method names are listed beside each route above.
      </p>
      <CodeBlock label="Request" lang="shell" code={rpcCall} />
      <CodeBlock label="Response envelope · devnet" lang="json" code={EXAMPLES["rpc-status"] ?? ""} />
    </section>

    <section id="transactions" class="panel doc">
      <h2><span class="n">06</span> Sending transactions</h2>
      <p>
        A transaction is signed by its sender with Ed25519 over a digest that names the chain and network, so a signature made
        for one network can never be replayed on another. Wallets and the CLI do this for you; the RPC never sees a private key.
      </p>
      <ol class="steps">
        <li><span class="step-n">1</span><div><strong>Read the nonce.</strong> Each account's transactions are numbered; use <code>/accounts/{"{alt:…}"}/nonce</code>.</div></li>
        <li><span class="step-n">2</span><div><strong>Build and sign.</strong> Set the fee terms (fee asset, execution-unit limit, maximum fee) and a validity window in slots.</div></li>
        <li><span class="step-n">3</span><div><strong>Simulate.</strong> See the result and the exact fee before anything is sent.</div></li>
        <li><span class="step-n">4</span><div><strong>Submit.</strong> The answer carries the <code>alt:T…</code> identifier.</div></li>
        <li><span class="step-n">5</span><div><strong>Track.</strong> The transaction is served once its block is final, about a second later.</div></li>
      </ol>
      <CodeBlock label="The three calls" lang="shell" code={submit} />
      <h3>Fees</h3>
      <p>
        A fee is the execution units a transaction uses multiplied by the published price per unit, in AEY or ALnT. Prices are
        set by governance and never auctioned, so a busy period never raises them. A simple transfer uses 2,000 units. A
        transaction that fails still pays for the units it used; nothing else moves.
      </p>
      <CodeBlock label={"GET /transactions/{alt:T…} · devnet"} lang="json" code={EXAMPLES["tx"] ?? ""} />
    </section>

    <section id="errors" class="panel doc">
      <h2><span class="n">07</span> Errors</h2>
      <p>
        REST answers with an HTTP status and <code>{"{ error: { code, name, message, details } }"}</code>. JSON-RPC answers with
        a standard error object whose <code>data</code> names the protocol error, for example <code>TX_NONCE_TOO_LOW</code>.
      </p>
      <div class="table-wrap">
        <table class="scan">
          <thead><tr><th>JSON-RPC</th><th>HTTP</th><th>Name</th><th>Meaning</th></tr></thead>
          <tbody>
            {#each errors as [code, http, name, meaning] (code)}
              <tr><td class="mono">{code}</td><td class="mono">{http}</td><td class="mono">{name}</td><td class="wrap">{meaning}</td></tr>
            {/each}
          </tbody>
        </table>
      </div>
      <CodeBlock label="GET /blocks/height/99999999 · 404" lang="json" code={EXAMPLES["notfound"] ?? ""} />
    </section>

    <section id="limits" class="panel doc">
      <h2><span class="n">08</span> Limits & behaviour</h2>
      <div class="facts">
        <div><strong>Rate limit</strong><span>Requests are budgeted per client address (50 per second by default). Past it the node answers 429 / <code>-32001</code>; wait and retry.</span></div>
        <div><strong>Request size</strong><span>Bodies are limited to 1 MiB.</span></div>
        <div><strong>Finality</strong><span>Only final data is served. A submitted transaction returns 404 until its block is final, then never changes.</span></div>
        <div><strong>Caching</strong><span>Finalized blocks, transactions and receipts never change and can be cached indefinitely. Balances and the head change with every block.</span></div>
        <div><strong>Read-only access</strong><span>The RPC is the State's constitutionally authorised read interface. It never holds keys and cannot move funds.</span></div>
      </div>
    </section>

    <section id="cli" class="panel doc">
      <h2><span class="n">09</span> Wallet & CLI</h2>
      <p>
        <code>aletheia-cli</code> is the State's command-line client for people and scripts. It keeps keys in an encrypted
        keystore (Argon2id and XChaCha20-Poly1305), asks for the password without echo, and checks that the node is on the
        network you expect before it signs anything. Every transfer is simulated and summarised before it is signed.
      </p>
      <CodeBlock label="Commands" lang="shell" code={cli} />
      <CodeBlock label="aletheia-cli status · devnet" lang="text" code={cliOut} />
      <p class="note">
        <code>--output json</code> gives a stable schema for scripts; <code>--network mainnet</code> refuses to talk to a node on
        any other network. For automation, <code>ALETHEIA_PASSWORD_FILE</code> names a file holding the keystore password.
      </p>
    </section>
  </div>
</div>

<style>
  .hero {
    padding-top: 2.75rem;
    padding-bottom: 2rem;
  }
  .eyebrow {
    display: inline-flex;
    align-items: center;
    margin-bottom: 0.8rem;
    font-size: var(--fs-2xs);
    font-weight: 800;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--brand-gold-bright);
  }
  h1 {
    font-size: var(--fs-2xl);
    font-weight: 800;
    letter-spacing: -0.035em;
  }
  .lede {
    margin-top: 0.7rem;
    max-width: 48rem;
    font-size: var(--fs-md);
    line-height: 1.65;
    color: var(--text-soft);
  }
  .endpoints {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
    margin-top: 1.4rem;
  }
  .endpoints div {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.45rem 0.8rem;
    font-size: var(--fs-sm);
    background: var(--brand-navy);
    border: 1px solid rgb(196 154 78 / 0.45);
    border-radius: 0.5rem;
  }
  .endpoints .label {
    color: var(--brand-gold-bright);
  }
  .endpoints .mono {
    color: var(--brand-cream);
  }
  .layout {
    display: grid;
    grid-template-columns: 14rem minmax(0, 1fr);
    gap: 1.75rem;
    align-items: start;
  }
  .toc {
    position: sticky;
    top: 5.5rem;
    display: grid;
    gap: 0.15rem;
    padding: 1rem;
    background: rgb(255 255 255 / 0.04);
    border: 1px solid rgb(255 255 255 / 0.09);
    border-radius: var(--radius);
  }
  .toc .label {
    margin-bottom: 0.4rem;
  }
  .toc a {
    display: flex;
    gap: 0.6rem;
    padding: 0.42rem 0.5rem;
    font-size: var(--fs-sm);
    font-weight: 600;
    color: var(--text-soft);
    border-radius: 0.4rem;
    transition:
      background var(--quick) var(--ease),
      color var(--quick) var(--ease);
  }
  .toc a:hover {
    color: var(--text);
    background: rgb(255 255 255 / 0.06);
  }
  .toc .num {
    font-size: var(--fs-xs);
    font-weight: 800;
    color: var(--brand-gold-bright);
  }
  .content {
    display: grid;
    gap: 1.25rem;
    min-width: 0;
  }
  .doc {
    display: grid;
    gap: 1rem;
    padding: 1.6rem 1.75rem;
    scroll-margin-top: 5.5rem;
  }
  h2 {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    padding-bottom: 0.9rem;
    font-size: var(--fs-lg);
    font-weight: 800;
    letter-spacing: -0.02em;
    border-bottom: 1px solid rgb(196 154 78 / 0.28);
  }
  .n {
    display: inline-grid;
    place-items: center;
    min-width: 2rem;
    height: 2rem;
    font-size: var(--fs-xs);
    font-weight: 800;
    color: var(--brand-cream);
    background: var(--brand-navy);
    border: 1px solid rgb(196 154 78 / 0.55);
    border-radius: 0.5rem;
  }
  h3 {
    margin-top: 0.4rem;
    font-size: var(--fs-md);
    font-weight: 800;
  }
  .doc p {
    font-size: var(--fs-base);
    line-height: 1.7;
    color: var(--text-soft);
  }
  .doc strong {
    color: var(--text);
  }
  code {
    padding: 0.05rem 0.35rem;
    font-family: var(--mono);
    font-size: 0.85em;
    color: var(--brand-cream);
    background: var(--brand-navy);
    border: 1px solid rgb(196 154 78 / 0.3);
    border-radius: 0.3rem;
  }
  .note {
    padding: 0.8rem 1rem;
    font-size: var(--fs-sm) !important;
    background: rgb(255 255 255 / 0.04);
    border-left: 2px solid var(--brand-gold);
    border-radius: 0 0.4rem 0.4rem 0;
  }
  .cards {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.8rem;
  }
  .card {
    display: grid;
    gap: 0.4rem;
    padding: 1rem 1.1rem;
    color: var(--brand-gold-bright);
    background: rgb(255 255 255 / 0.045);
    border: 1px solid rgb(255 255 255 / 0.09);
    border-radius: var(--radius);
  }
  .card h3 {
    margin: 0;
    color: var(--text);
  }
  .card p {
    font-size: var(--fs-sm) !important;
    line-height: 1.55 !important;
  }
  .table-wrap {
    overflow-x: auto;
  }
  .table-wrap .scan {
    min-width: 40rem;
  }
  .wrap {
    white-space: normal !important;
    word-break: break-all;
  }
  .faint {
    color: var(--text-faint);
  }
  .pair {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.8rem;
  }
  .assets {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.8rem;
  }
  .asset-card {
    display: grid;
    gap: 0.25rem;
    padding: 1rem 1.1rem;
    font-size: var(--fs-sm);
    color: var(--text-soft);
    background: var(--brand-navy);
    border: 1px solid rgb(196 154 78 / 0.45);
    border-radius: var(--radius);
  }
  .asset-card strong {
    font-size: var(--fs-md);
  }
  .code-name {
    font-size: var(--fs-xs);
    font-weight: 800;
    letter-spacing: 0.08em;
    color: var(--gold);
  }
  .routes {
    display: grid;
    gap: 0.45rem;
  }
  .route {
    overflow: hidden;
    background: rgb(255 255 255 / 0.04);
    border: 1px solid rgb(255 255 255 / 0.09);
    border-radius: var(--radius);
    transition: border-color var(--quick) var(--ease);
  }
  .route.open {
    border-color: rgb(196 154 78 / 0.55);
  }
  .route-head {
    display: grid;
    grid-template-columns: 3.4rem minmax(12rem, 18rem) minmax(0, 1fr) auto;
    gap: 0.9rem;
    align-items: center;
    width: 100%;
    padding: 0.7rem 0.9rem;
    border: 0;
    background: none;
    text-align: left;
    cursor: pointer;
  }
  .route-head:disabled {
    cursor: default;
  }
  .route-head:not(:disabled):hover {
    background: rgb(255 255 255 / 0.04);
  }
  .verb {
    padding: 0.18rem 0;
    font-size: var(--fs-2xs);
    font-weight: 800;
    text-align: center;
    border-radius: 0.3rem;
  }
  .verb.get {
    color: var(--brand-laurel-bright);
    background: #1d4a39;
    border: 1px solid rgb(143 214 173 / 0.4);
  }
  .verb.post {
    color: var(--brand-gold-bright);
    background: var(--brand-navy);
    border: 1px solid rgb(196 154 78 / 0.55);
  }
  .path {
    font-size: var(--fs-sm);
    font-weight: 600;
    color: var(--text);
    word-break: break-all;
  }
  .what {
    font-size: var(--fs-sm);
    color: var(--text-soft);
  }
  .rpc {
    font-size: var(--fs-xs);
    color: var(--text-faint);
  }
  .route-body {
    padding: 0 0.9rem 0.9rem;
  }
  .steps {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.55rem;
  }
  .steps li {
    display: flex;
    gap: 0.8rem;
    align-items: flex-start;
    font-size: var(--fs-base);
    line-height: 1.6;
    color: var(--text-soft);
  }
  .step-n {
    display: inline-grid;
    place-items: center;
    width: 1.7rem;
    height: 1.7rem;
    flex: none;
    font-size: var(--fs-xs);
    font-weight: 800;
    color: var(--brand-laurel-bright);
    background: #1d4a39;
    border: 1px solid rgb(143 214 173 / 0.4);
    border-radius: 50%;
  }
  .facts {
    display: grid;
    gap: 0.6rem;
  }
  .facts div {
    display: grid;
    grid-template-columns: 11rem 1fr;
    gap: 1rem;
    padding: 0.8rem 1rem;
    font-size: var(--fs-sm);
    line-height: 1.6;
    color: var(--text-soft);
    background: rgb(255 255 255 / 0.04);
    border: 1px solid rgb(255 255 255 / 0.08);
    border-radius: var(--radius);
  }
  .facts strong {
    color: var(--brand-gold-bright);
  }
  @media (max-width: 64rem) {
    .layout {
      grid-template-columns: 1fr;
    }
    .toc {
      position: static;
      grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
    }
    .route-head {
      grid-template-columns: 3.4rem minmax(0, 1fr);
    }
    .route-head .what,
    .route-head .rpc {
      grid-column: 2;
    }
  }
  @media (max-width: 40rem) {
    .cards,
    .pair,
    .assets {
      grid-template-columns: 1fr;
    }
    .facts div {
      grid-template-columns: 1fr;
      gap: 0.3rem;
    }
    .doc {
      padding: 1.25rem 1.1rem;
    }
  }
</style>
