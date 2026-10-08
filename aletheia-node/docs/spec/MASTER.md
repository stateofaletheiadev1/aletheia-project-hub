# Aletheia StableChain --- Master Engineering Specification & Claude Code Handoff (v4.0 --- Rust)

**Project:** Sovereign Covenant State of Aletheia
**System:** Aletheia StableChain
**National currency:** AEY --- the **Aletheian Guilder**
**Document:** Master Engineering Prompt v4.0 --- Rust Core + APS Foundation + DSP v0.1 + Arno v0.1 + APN + Aletheian PayNet Integration + External Rail Interoperability + Chain Continuity + AEY Monetary & Physical Cash Architecture
**Core Implementation Language:** Rust (stable toolchain, pinned per repository)
**Smart-Contract Language:** Arno (`.arno`)
**Execution Model:** Native deterministic state machine, versioned by protocol version (Section 44) + sandboxed Arno VM (out-of-process executor)
**Consensus:** DSP --- Deterministic Sovereign Pipeline (pipelined 2-chain BFT with chrono-slots)
**Primary Databases:** RocksDB (consensus state/indexes) + append-only compressed block archive; PostgreSQL (off-chain indexer, explorer API, gateway and rail-adapter ledgers); ClickHouse (compressed logs/telemetry)
**Interfaces:** REST (`/api/v1`) + JSON-RPC 2.0 (`/rpc/v1`) + Finalized Event Stream (APS-0058); public stablechain bridge (APS-0046)
**Text encoding:** Aletheia-native identifiers (`AL:`, `AL:T`, `AL:B`); no `0x` anywhere
**Payments:** Aletheia Payment Network (APN, Section 40B), operated through **Aletheian PayNet** (Section 40D); SEPA / SWIFT CBPR+ / Fedwire / FedNow / T2 / CHAPS interoperability through a canonical payment model and versioned rail profiles (Section 40C)
**Continuity:** Every release continues the chain from the last finalized block. No re-genesis, no resync, no hand-edited state --- ever (Section 44)
**Explorer:** Aletheia Explorer --- "The Public Ledger", Manrope only, generative guilloche seals (Section 41A)
**Craft:** Human-crafted code, prose and design standard (Sections 3.4, 41A, 46A)
**Status:** Authoritative engineering handoff --- supersedes v1, v2, v2.1, v2.2, v2.3 and v3.0
**Audience:** Senior Rust blockchain, protocol, smart-contract, cybersecurity, DevSecOps, payments, platform and infrastructure engineers; Claude Code

------------------------------------------------------------------------

## The Engineering Team Writing This Specification

This revision is written from four seats at once, and every section was
reviewed from each of them:

1.  **Rust stablechain / L1 protocol engineer** --- owns determinism,
    consensus, state, monetary invariants and the versioned rules that
    let the chain evolve for decades without ever restarting.
2.  **Senior full-stack engineer (L1 stablechains)** --- owns the
    Explorer, the explorer API, the indexer, SDKs and the interfaces
    Aletheian PayNet and participants build on.
3.  **Senior DevOps / SRE engineer** --- owns release engineering,
    reproducible builds, staged fleet rollout, upgrade switchover,
    backups, disaster recovery and observability.
4.  **Senior cybersecurity engineer** --- owns the threat model, supply
    chain, key custody, payment-message attack surface, explorer
    hardening and the security review of every upgrade.

Claude Code is expected to work the same way: before closing any task,
re-read the change from all four seats and answer, in the PR
description, the four questions in Section 1.4.

------------------------------------------------------------------------

## v4.0 Engineering Decisions --- Mandatory Changes from v3.0

v4.0 keeps every sound protocol, consensus and monetary decision from
v3.0. It adds four capabilities that v3.0 described only in outline,
and repairs defects left by the C++ → Rust conversion.

1.  **Chain continuity is a protocol guarantee, not an operational
    hope.** Any new functionality --- a transaction type, a native
    module, a fee rule, a VM change, a storage layout, a crypto profile
    --- ships in a binary that opens the existing data directory,
    verifies it, migrates it if needed and continues from the last
    finalized block. Historical blocks always replay under the rules
    that were in force when they were finalized. (Section 44, APS-0054,
    APS-0055, ADR-029, ADR-030)
2.  **External-rail interoperability is engineered for correctness,
    message by message.** All rails map through one **Aletheia
    Canonical Payment (ACP)** model. Each rail (SEPA SCT, SCT Inst,
    SDD, SWIFT CBPR+, Fedwire Funds, FedNow, T2, CHAPS, partner instant
    schemes) is a **versioned rail profile**: message versions, usage
    guideline rules, character sets, field lengths, calendars, cut-offs
    and limits are data with effective dates, not code. External legs
    settle through an on-chain **escrow-lock** so that no external
    failure, timeout or duplicate can create or destroy AEY.
    (Section 40C, APS-0056, ADR-031)
3.  **Aletheian PayNet is the operator of the payment rail and a
    first-class consumer of the chain.** v4.0 defines the boundary:
    what PayNet owns, what the chain owns, the settlement submission
    interface, the Finalized Event Stream, consensus-level payment
    de-duplication, reconciliation R4--R7 and joint upgrade rules.
    (Section 40D, APS-0057, APS-0058, ADR-032)
4.  **The Explorer and the node are specified to a production
    standard.** The Explorer gains a complete design system, a
    generative guilloche seal derived from each block hash,
    version-aware rendering, its own Rust read API, immutable caching
    of finalized data and an "AI-tell" CI gate. The node gains a
    supervision tree, a documented startup/shutdown order, an
    operator-facing voice for logs and CLI, and an explicit list of
    machine-generated-code patterns that reviewers reject.
    (Sections 41A, 46A, ADR-033, ADR-034)
5.  **Fleet operations are part of the protocol's safety.** Staged
    rollout never takes more than `f` validators down at once; upgrade
    switchover is rehearsed on a shadow fork of real state before every
    activation. (Section 59A, ADR-035)
6.  **AEY is the Aletheian Guilder**, the national currency of the
    Sovereign Covenant State of Aletheia. The name "Aletheia Euro Unit"
    is retired everywhere: specs, APS-0018, Rust doc comments, RPC
    `asset.name`, wallet and Explorer copy, ISO 20022 supplementary
    data, genesis metadata and test vectors. Only the name changes:
    the code stays `AEY`, the decimals stay 18, and the EUR reference
    value, reserve composition and redemption rules of Section 18 are
    unchanged. Display names: "Aletheian Guilder" (singular), "Aletheian
    Guilders" (plural), "guilder" in running text after first use;
    translations in all five official languages are fixed by the
    Monetary Authority. A currency symbol is not assigned in this
    revision --- until the Monetary Authority adopts one, every UI shows
    the code `AEY` after the amount. A CI check
    (`scripts/check_banned.sh`) fails on the strings "Aletheia Euro"
    and "Euro Unit" anywhere except the change-history tables of
    `docs/spec/MASTER.md`.
7.  **Every empty normative Rust block from v3.0 is either filled in
    or turned into a tracked Phase 0 obligation** (Appendix R).

### v4.0 Architecture in one view

``` text
   Citizens · businesses · government · banks · PSPs · merchants
                              │
              ┌───────────────▼────────────────┐
              │        ALETHEIAN PAYNET        │  operator of the payment rail
              │  participant APIs · wallets    │  (Section 40D)
              │  ledger · limits · screening   │
              │  APN messaging · rail adapters │
              └──────┬─────────────────┬───────┘
     signed txs      │                 │  Finalized Event Stream (APS-0058)
     (settlement     │                 │  + finality proofs
      accounts, HSM) ▼                 │
┌─────────────────────────────────────────────────────────────────────┐
│                    ALETHEIA STABLECHAIN (aletheiad)                 │
│  DSP BFT · versioned rules registry (v1, v2, … frozen once active) │
│  AEY · ALnT · cash ledger · APN on-chain modules · registries      │
│  payment de-dup · external-leg escrow · protocol schedule          │
│  JMT + RocksDB · WAL · archive · data-dir manifest + migrations    │
└───────────────┬───────────────────────────────┬─────────────────────┘
                │                               │
     ISO 20022 Gateway + Rail Adapters      Indexer → Explorer API → Explorer
     (canonical payment model, rail          (version-aware decoding,
      profiles with effective dates)          immutable finalized pages)
                │
   SEPA SCT / SCT Inst / SDD · SWIFT CBPR+ · Fedwire · FedNow · T2 · CHAPS
   (always through authorized partner institutions — Section 40B.8)
```

------------------------------------------------------------------------

## Changes in v4.0

  ------------------------------------------------------------------------------------------------
  \#    Area                    v3.0                               v4.0                             Section
  ----- ----------------------- ---------------------------------- -------------------------------- ---------
  1     Upgrades                `UpgradePlan` + epoch activation   Full continuity architecture:    44
                                only                               change classes 0--5, versioned
                                                                   rules registry, protocol
                                                                   schedule in state, clean halt
                                                                   at unsupported height, binary
                                                                   switchover, emergency halt and
                                                                   resume, historical replay gate

  2     Storage evolution       Not specified                      Data-directory manifest,         44.5
                                                                   storage schema version,
                                                                   forward-only journaled
                                                                   migrations on a checkpoint,
                                                                   refuse-newer rule

  3     External rails          Adapter list and principle         Canonical payment model, rail    40C
                                                                   profiles as data, layered
                                                                   validation, escrow-lock
                                                                   external legs, amount
                                                                   conversion rule, calendars,
                                                                   R-transactions, rail
                                                                   simulators, conformance packs

  4     PayNet                  Not named                          Aletheian PayNet defined as      40D
                                                                   rail operator; integration
                                                                   contract; Finalized Event
                                                                   Stream; on-chain payment
                                                                   de-dup; R4--R7

  5     Explorer                Concept, tokens, one component     Complete design system,          41A
                                                                   generative seal, page catalog
                                                                   incl. Payments, Directory and
                                                                   Chronicle, version-aware
                                                                   rendering, explorer API,
                                                                   caching, AI-tell gate, Svelte 5

  6     Node craft              Section 3.4 (general)              Node-specific engineering        46A
                                                                   standard, supervision tree,
                                                                   startup/shutdown order,
                                                                   operator voice, rejected
                                                                   patterns, exemplar code

  7     Fleet operations        Runbook list                       Release trains, environments,    59A
                                                                   quorum-safe rollout, shadow
                                                                   fork rehearsal, backups, DR,
                                                                   SLOs

  8     Security                Threat model                       Threats for upgrades, rails,     48A
                                                                   PayNet and Explorer

  9     State namespaces        up to 106                          66 Protocol schedule; 107        15, 40C,
                                                                   Payment de-dup; 108 External     40D, 44
                                                                   leg escrow

  10    Tx types                up to 140                          144--147 external legs           40C

  11    APS                     up to APS-0053                     APS-0054 ... APS-0058            8, 65

  12    ADR                     up to ADR-028                      ADR-029 ... ADR-036              4, 65

  14    RPC logs and disk       Node logs compressed; RPC request  Binary, sampled, rolled-up and   45.6,
                                logs and disk exhaustion not       zstd-compressed RPC logs with    45.7
                                addressed                          their own budget; no logs in
                                                                   PostgreSQL; disk budget guard
                                                                   with forecast, shedding order
                                                                   and clean stop

  13    Currency name           AEY --- "Aletheia Euro Unit"       AEY --- **Aletheian Guilder**;   Header,
                                                                   code, decimals and EUR           18.3,
                                                                   reference unchanged              41A
  ------------------------------------------------------------------------------------------------

## Corrections to v3.0 (defects repaired in this revision)

v3.0 was converted from a C++ predecessor and kept several artifacts of
that conversion. Each is a defect; Claude Code must not reproduce them.

  ------------------------------------------------------------------------------------------
  Location in v3.0                    Defect                                Correction
  ----------------------------------- ------------------------------------- ----------------
  27 `rust` blocks                    Empty "Normative Rust implementation  Filled in where
                                      requirement" placeholders             this revision
                                                                            owns the area;
                                                                            the rest are
                                                                            Phase 0
                                                                            obligations
                                                                            (Appendix R)

  CLAUDE.md work loop                 "include/aletheia/<module>/"          Public API lives
                                      (C++ header path)                     in
                                                                            `crates/<crate>/src/lib.rs`

  CLAUDE.md prime directive 2         `src/core, src/consensus …`           `crates/core`,
                                                                            `crates/consensus`
                                                                            …

  Section 9                           `encode(ace::Writer&) const` /        Rust traits
                                      `static Result<T> decode(...)`        `AceEncode` /
                                                                            `AceDecode`
                                                                            (Appendix R.3)

  Section 36                          "TLS 1.3 … (OpenSSL 3)"               rustls (as
                                                                            Section 5.1
                                                                            already states)

  Section 41A.7                       Rust verifiers compiled with          `wasm-bindgen`
                                      Emscripten                            /
                                                                            `wasm32-unknown-unknown`

  Section 42.1                        `kvstore_conformance.cpp`             `crates/storage/tests/kvstore_conformance.rs`

  Section 46.1                        "io_context pool (Asio)"              Tokio runtime
                                                                            (I/O only)

  Build profiles                      asan / ubsan / tsan presets           Rust profiles +
                                                                            nightly
                                                                            `-Zsanitizer`
                                                                            CI jobs and Miri
                                                                            (Section 51)

  Header                              "Mandatory Changes from v3.0"         Retitled
                                      inside v3.0                           "Changes from
                                                                            v2.5"

  Phase 0                             ADR-001...018                         ADR-001...035

  Section 5.5                         `toml` code fence never closed (the   Closed
                                      rest of the document rendered as
                                      code in some viewers)
  ------------------------------------------------------------------------------------------

------------------------------------------------------------------------

## v3.0 Engineering Decisions (retained) --- Changes from v2.5

This revision is a **true Rust redesign of the implementation layer**,
not a mechanical language substitution. The protocol intent and sound
consensus/monetary decisions from v2.5 are retained unless explicitly
changed below.

1.  **Rust replaces C++23** for the StableChain node, validator,
    consensus engine, state machine, storage layer, P2P stack, RPC
    services, monetary modules, Arno VM, signer, gateway and protocol
    tooling where Rust is appropriate.
2.  **Arno remains the native smart-contract language.** Quorlin is not
    substituted for Arno. Arno remains Pascal/Delphi-style and is part
    of Aletheia StableChain's identity.
3.  **No EVM, Solidity, Ethereum execution model, Cosmos SDK, Substrate
    or imported blockchain consensus implementation.**
4.  **A Cargo workspace replaces the C++ build system.** Dependency versions are
    pinned in `Cargo.lock`; toolchain is pinned in
    `rust-toolchain.toml`; release dependencies are audited and
    reproducibly built.
5.  **Memory safety is a protocol-security objective.** `unsafe` is
    forbidden in consensus-critical crates unless a narrowly scoped,
    reviewed FFI boundary requires it; every such use requires an ADR,
    safety comment and dedicated tests.
6.  **No public testnet is required before mainnet.** Development uses
    local/regtest and private multi-operator validation networks. A
    public testnet is optional and cannot be a mandatory mainnet gate.
    Mainnet is launched once the private validation, audit, recovery and
    readiness gates are satisfied.
7.  **AEY has two physical forms of the same monetary unit:** digital
    AEY on StableChain and physical AEY banknotes issued by the Aletheia
    Monetary Authority. Converting between forms does not create or
    destroy monetary value. Physical cash is represented in the monetary
    accounting model without placing personal cash transactions
    on-chain.
8.  **Financial interoperability is a first-class subsystem.**
    StableChain exposes standards-compatible interfaces for ISO 20022
    and external-rail gateways. SWIFT, SEPA, Fedwire, instant-payment
    systems, correspondent banks and PSPs are reached through authorized
    institutions and rail adapters; StableChain does not claim direct
    membership in a rail merely because an adapter exists.
9.  **The Aletheia Payment Network (APN) remains distinct from external
    rails.** APN is Aletheia's internal participant, payment, messaging,
    settlement and reconciliation layer; external systems remain
    external settlement environments.
10. **The chain remains non-EVM and purpose-built.** A DEX is not a
    genesis requirement. KortanaSwap is not duplicated inside Aletheia
    unless a later monetary/market-design decision establishes a real
    need.
11. **The core remains fail-stop rather than fail-open** for consensus,
    state, monetary and finality violations.

### v3.0 Architecture in one view (superseded by the v4.0 view above)

``` text
Aletheia applications / national portal / wallets / banks / enterprises
                              │
                       REST / JSON-RPC
                              │
                 ┌────────────▼────────────┐
                 │      StableChain        │
                 │      Rust node          │
                 ├─────────────────────────┤
                 │ DSP BFT consensus       │
                 │ Deterministic execution │
                 │ Arno VM                 │
                 │ AEY + ALnT              │
                 │ Physical-cash ledger    │
                 │ APN + registries        │
                 │ JMT + RocksDB           │
                 └────────────┬────────────┘
                              │
              ┌───────────────┼────────────────┐
              │               │                │
        APN / Gateway      Reserve/Bank     External rails
              │               │                │
       ISO 20022 MX       EUR reserves    SWIFT / SEPA /
       + UETR + APN       + redemption    Fedwire / PSPs

Digital AEY and physical AEY banknotes are two forms of the same
monetary unit and are reconciled by the Monetary Authority.
```

------------------------------------------------------------------------

## How to Read This Document

-   **MUST / MUST NOT / SHOULD / MAY** follow RFC 2119 meaning.
-   Sections marked **\[CONSENSUS-CRITICAL\]** define behavior that
    every honest validator must implement bit-for-bit identically.
    Changing them requires a protocol version bump (APS-0036).
-   Sections marked **\[DECISION ADR-xxx\]** record an engineering
    decision made in this revision. Each must be written up under
    `docs/adr/` (Section 4).
-   Code snippets are **normative in shape, illustrative in detail**:
    the types, invariants, byte layouts and control flow are required;
    naming and minor structure may be adapted.
-   Values marked **(devnet default --- benchmark before freezing)** are
    starting points, not protocol constants.

------------------------------------------------------------------------

## Changes From v1 (Summary for Reviewers)

  --------------------------------------------------------------------------------------------------------------------------
  \#        Area                v1                        v2                                        Why
  --------- ------------------- ------------------------- ----------------------------------------- ------------------------
  1         Naming              Mixed `alethia` /         Normalized to **`aletheia`** everywhere   Consistency; a typo in a
                                `aletheia` in repo and                                              binary name becomes
                                CLI names                                                           permanent operational
                                                                                                    debt

  2         Block header        Header contained its own  Header hash excludes the certificate;     v1 layout was circular
                                `Block Hash` and          each header carries the **parent's** QC;  --- a certificate cannot
                                `Consensus Certificate`   finality proof stored separately          be inside the bytes it
                                                                                                    certifies

  3         Block timestamp     Free "Timestamp/Protocol  **Protocol time derived from slot**       Removes
                                Time"                     (`genesis_time + slot × slot_duration`)   proposer-controlled
                                                                                                    wall-clock input from
                                                                                                    consensus

  4         Block body          Contained "Execution      Results are **derived**, committed via    Less bandwidth; no trust
                                Results"                  `receipt_root`; not transmitted           in proposer-supplied
                                                                                                    results

  5         QC signatures       "Threshold BLS" for       **Aggregate BLS multi-signatures + signer Aggregate QCs keep
                                quorum certificates       bitmap + proof-of-possession** for QCs;   **accountability** (who
                                                          threshold BLS reserved for the randomness signed) --- required for
                                                          beacon (DSP v0.2)                         equivocation evidence.
                                                                                                    Threshold QCs hide
                                                                                                    signers

  6         DSP                 Pipeline described,       Concrete **2-chain voting/commit/timeout  Consensus cannot be
                                safety rules unspecified  rules** with persisted safety data and    implemented from a
                                                          remote-signer double-sign protection      diagram

  7         Clock               PTP role ambiguous        PTP affects **liveness/pacing only**,     BFT safety must not
                                                          never safety                              depend on synchronized
                                                                                                    clocks

  8         Ordering            "Protocol-defined"        Concrete **canonical ordering             Determinism + reduced
                                                          algorithm**; validators reject blocks not proposer front-running
                                                          in canonical order                        

  9         Tx ID               "Derived from canonical   ID = hash of **body only** (signature     Prevents
                                transaction"              excluded); separate witness hash          signature-malleability
                                                                                                    changing IDs

  10        Addresses           "`AL:` + Bech32m          Exact format: `AL:` + Bech32m data part,  Single canonical
                                preferably"               33-byte payload, network bound into       length/encoding as v1
                                                          checksum                                  demanded

  11        Arno VM             "Isolated VM"             Interpreter (no JIT in consensus) running Defense in depth against
                                                          in an **out-of-process sandboxed          VM escape
                                                          executor** (seccomp-bpf, namespaces,      
                                                          rlimits)                                  

  12        Monetary            Supply buckets listed     Exact **supply-ledger equations**,        "No unauthorized supply
                                                          per-epoch issuance caps, M-of-N mint      creation" must be
                                                          authorization, block-level invariant      machine-checked every
                                                          checker with **fail-stop**                block

  13        Storage             "Storage abstraction"     Concrete: **RocksDB** + **Jellyfish       v1 asked for no database
                                                          Merkle Tree** + **zstd-compressed         choice; v2 fixes one
                                                          append-only block archive** + custom      
                                                          **consensus WAL**                         

  14        Logs                Structured observability  **Binary structured logs + zstd           Requirement: logs
                                                          dictionary compression before             compressed before
                                                          persistence**, shipped to **ClickHouse**  storage
                                                          with columnar codecs                      

  15        Stability           Implicit                  Dedicated section: threading model,       Requirement: code must
                                                          bounded queues, backpressure, watchdogs,  maintain stability
                                                          fail-stop, memory budgets, soak tests     

  16        Frameworks          Not specified             Pinned dependency set (Section 5)         Handoff must be
                                                                                                    buildable

  17        Key safety          HSM mentioned             **Remote signer** with persistent         Most real validator
                                                          double-sign protection, PKCS#11 through   slashing incidents are
                                                          an isolated Rust signer crate and HSM     key/signer failures
                                                          backend                                   
  --------------------------------------------------------------------------------------------------------------------------

## Changes in v2.1

  ------------------------------------------------------------------------------------------------
  \#      Area               v2             v2.1                            Section
  ------- ------------------ -------------- ------------------------------- ----------------------
  1       Arno syntax        Brace-based,   **Pascal / Delphi (Object       25
                             Rust-like      Pascal) style**, English        
                                            keywords, `begin … end`,        
                                            `require … otherwise`,          
                                            plain-English compiler errors   

  2       JSON-RPC           REST only      **JSON-RPC 2.0** over HTTPS and 37.2
                                            WebSocket alongside REST, one   
                                            shared service layer, OpenRPC   
                                            spec, parity tests              

  3       Hex display        `0x…` in       **No `0x` anywhere**; new       12.1, 12.2
                             examples       `AL:B` block IDs; unprefixed    
                                            lowercase base16; spec codes in 
                                            decimal; parsers reject `0x`    

  4       Test quality       Test types     **Coverage gates**              52.1--52.5
                             listed         (line/branch/function/MC-DC),   
                                            ratchet, mutation testing,      
                                            requirement traceability, e2e   
                                            suite                           

  5       Interoperability   None           **Public stablechain bridge**:  40A
                                            light-client / guardian /       
                                            issuer-attested routes,         
                                            lock-and-mint, per-route caps,  
                                            invariants I10--I12             
  ------------------------------------------------------------------------------------------------

## Changes in v2.2

  -----------------------------------------------------------------------------
  \#      Area           v2.1           v2.2              Section
  ------- -------------- -------------- ----------------- ---------------------
  1       Craft          Implicit       **Human-crafted   3.4
                                        standard** for    
                                        code, comments,   
                                        errors, commits,  
                                        docs and UI copy; 
                                        banned-phrase     
                                        check; human      
                                        review gate       

  2       Explorer       Not specified  **Aletheia        41A
                                        Explorer** ---    
                                        "The Public       
                                        Ledger" design:   
                                        paper-and-ink     
                                        palette, folio    
                                        block pages,      
                                        brass finality    
                                        seal, live slot   
                                        ribbon,           
                                        in-browser proof  
                                        verification      

  3       Typography     Not specified  **Manrope only**, 41A.3
                                        self-hosted,      
                                        tabular figures   
                                        everywhere; CI    
                                        blocks any other  
                                        font              

  4       Design quality Not specified  Human designer    41A.11
                                        sign-off, visual  
                                        regression,       
                                        accessibility and 
                                        performance       
                                        budgets as merge  
                                        gates             
  -----------------------------------------------------------------------------

## Changes in v2.3

  -------------------------------------------------------------------------------------
  \#      Area             v2.2           v2.3                    Section
  ------- ---------------- -------------- ----------------------- ---------------------
  1       Payment network  ISO 20022      **Aletheia Payment      40B.1--40B.5
                           gateway only   Network (APN)**:        
                                          participant directory   
                                          (AIC), AAN account      
                                          numbers, proxy aliases, 
                                          secure ISO 20022        
                                          messaging anchored      
                                          on-chain, UETR tracking 

  2       Settlement &     Implicit       Final AEY settlement    40B.6
          reconciliation                  24/7; prefunded         
                                          partner-bank accounts;  
                                          reconciliation          
                                          invariants R1--R3       

  3       Payment schemes  Transfer only  Instant credit          40B.7
                                          transfer, bulk,         
                                          request-to-pay, direct  
                                          debit mandates,         
                                          standing orders,        
                                          returns, recalls,       
                                          investigations,         
                                          merchant, statements    

  4       Outside          Bank gateway + SWIFT via               40B.8
          connectivity     bridge         partner/correspondent   
                                          banks, instant schemes  
                                          via partner PSPs,       
                                          mobile money, cards, FX 
                                          with PvP, bridge        

  5       Compliance       Gateway hooks  KYC tiers with on-chain 40B.9
                                          limits, fail-closed     
                                          screening, Travel Rule  
                                          (IVMS 101), off-chain   
                                          AML                     

  6       Participants     ---            APIs, sandbox,          40B.10
                                          certification suite     

  7       ISO codes        Not addressed  `AL` is Albania's ISO   40B.2, 40B.7
                                          3166 code --- never     
                                          used in ISO country     
                                          fields; `AEY` is not    
                                          ISO 4217 --- `EUR` +    
                                          supplementary data in   
                                          external messages       

  8       Account numbers  Territory      **`ALX` + 2 check       40B.2, 40B.3.1
          (v3.0            code + digits  digits + 16 digits**;   
          predecessor)                    ISO country fields use  
                                          a 2-letter              
                                          user-assigned code      
                                          (proposal `XL`)         
  -------------------------------------------------------------------------------------

## Changes in v3.0

  ------------------------------------------------------------------------------------------
  \#      Area           v3.0 predecessor      v3.0                    Section
  ------- -------------- --------------------- ----------------------- ---------------------
  1       Currency name  **ALUSD**             **AEY --- Aletheian     18, 18.3, 18.5, 40B
                         (USD-denominated, 1:1 Guilder** (v4.0 name;  
                         to the US dollar)     (EUR-denominated,       
                                               targets EUR 1.00);      
                                               Blueprint 2026.3        
                                               retires the name ALUSD  

  2       Decimals       6 (base unit = 10⁻⁶   **18** (base unit =     18.3, ADR-015, 37.2,
                         ALUSD)                10⁻¹⁸ AEY); Rust types, 41, 56
                                               RPC display strings,    
                                               wallet URIs and fee     
                                               examples updated        

  3       Reference      US dollar (USD)       **Euro (EUR)**; reserve 18.1, 18.7, 40, 40B.7
          currency                             composition,            
                                               attestation values,     
                                               redemption and ISO      
                                               20022 currency fields   
                                               reference EUR           

  4       Reserve        Fixed policy table in **Indicative            18.7
          composition    US assets             EUR-denominated**: cash 
                                               at partner banks 10--15 
                                               %, overnight reverse    
                                               repo 15--25 %,          
                                               short-dated EUR         
                                               government bills 60--75 
                                               %; longer bonds,        
                                               equities and            
                                               crypto-assets not       
                                               permitted               

  5       Sovereign      Not addressed         **Sovereign Development 18.1
          bonds                                Bonds** issued as       
                                               native AEY-denominated  
                                               instruments on the      
                                               StableChain; coupons    
                                               and principal paid      
                                               automatically from      
                                               Treasury accounts       

  6       Approval gate  Not addressed         Protocol-level code     18.1
                                               changes (genesis, token 
                                               metadata, interfaces)   
                                               are implemented only    
                                               **after** the AEY       
                                               monetary specification  
                                               is formally approved;   
                                               this revision records   
                                               the intent              

  7       Official       English, German,      **Dutch** added as      41A
          languages      Serbian, Italian      fifth official language 
                                               (English, German,       
                                               Dutch, Serbian,         
                                               Italian); affects       
                                               Explorer, wallets,      
                                               state apps, passport    
                                               labels                  

  8       Security       Unified Security      **ADSS** (Aletheian     ---
          service        Force                 Defence & Security      
                                               Service); no change of  
                                               function                

  9       APS-0018       `APS-0018-alusd.md`   Renamed to              8
                                               **`APS-0018-aey.md`**   

  10      Rust           `AlusdTag`,           Renamed to              18.2
          identifiers    `AlusdAmount`         **`AeyTag`**,           
                                               **`AeyAmount`**         
  ------------------------------------------------------------------------------------------

------------------------------------------------------------------------

# 0. Engineering Mandate

You are implementing a new blockchain/stablechain from first principles.

This document is the authoritative engineering handoff. Do **not**
reinterpret the system as an EVM chain, Solidity chain, Ethereum fork,
Cosmos SDK chain, Substrate chain, or renamed existing blockchain. Do
not import another chain's protocol, transaction model, VM or consensus
code.

The implementation is a **native Rust blockchain** with its own:

-   protocol, transaction model, block model and address system;
-   monetary primitives (AEY, ALnT) as native protocol assets;
-   deterministic state machine and authenticated state tree;
-   consensus mechanism (DSP);
-   P2P protocol;
-   storage, WAL and crash-recovery architecture;
-   cryptographic abstraction with algorithm agility;
-   smart-contract language (Arno), compiler and deterministic VM;
-   RPC/API layer, wallet standard and SDK;
-   validator infrastructure, remote signer and HSM integration;
-   observability with compressed log persistence;
-   security model, threat model and conformance tests;
-   developer and operator tooling.

The system must be **deterministic, auditable, crash-safe, stable under
load, security-conscious, operationally deployable, and suitable for
decades-long infrastructure**.

Do not take shortcuts merely to produce a demo.

------------------------------------------------------------------------

# 1. Claude Code Operating Rules

These rules govern how Claude Code works on this repository. They must
be copied into the repository root as `CLAUDE.md`.

## 1.1 `CLAUDE.md` (place at repo root)

``` markdown
# CLAUDE.md — Aletheia StableChain

## Prime directives
1. The spec at docs/spec/MASTER.md is authoritative. Do not silently change protocol decisions.
2. Consensus-critical code (crates/core, crates/consensus, crates/execution, crates/state,
   crates/monetary, crates/vm, crates/crypto, crates/verify) MUST be deterministic: no floats, no unordered iteration feeding
   hashes/state, no wall-clock reads, no locale, no UB, no platform-dependent sizes.
3. Every subsystem ships with tests in the same change. No test = not done.
4. Never fake cryptography, consensus, persistence or monetary accounting. Mocks live only
   under tests/ or src/**/testing/, are marked NON-PRODUCTION, and are excluded from
   Release / HardenedRelease builds by Cargo.
5. Ambiguity → write an ADR in docs/adr/ (template in docs/adr/0000-template.md), choose the
   option that best preserves: Determinism > Safety > Security > Auditability >
   Upgradeability > Operational simplicity > Performance. Then implement.
6. Never disable warnings, sanitizers or tests to make CI pass.
7. Never log secrets. Secret-bearing values are wrapped in aletheia_crypto::Secret<T>, which has no Debug/Display.
8. Never emit or accept "0x"-prefixed text. Use AL:, AL:T, AL:B identifiers and unprefixed
   lowercase base16 (Section 12.2). Write protocol codes in decimal.
9. Arno is Pascal-style (Section 25). Do not introduce C/Rust/Solidity-like syntax.
10. Write like a careful human engineer (Section 3.4): domain names, comments that explain why,
    specific error messages, specific commit messages. No filler words, no emoji.
11. Explorer and every UI use Manrope only and follow Section 41A. No UI kits, no gradients,
    no generic card grids. A human designer signs off every page.
12. Payments follow Section 40B: one lifecycle, UETR everywhere, never put personal data on-chain,
    never use "AL" as an ISO country code. Account numbers use the ALX prefix (Section 40B.3.1).
13. Continuity (Section 44): never edit a frozen rule set; every behaviour that can change a
    hash belongs to a protocol version; no feature flags in consensus; never write code that
    needs re-genesis, a resync or a manual state edit to deploy. Label every PR with its
    change class (0–5).
14. Storage layout changes bump `storage_schema` and ship a journaled, resumable migration with
    a crash test (Section 44.5). Old archive segments are never rewritten.
15. Rails (Section 40C): all rails go through the canonical payment model; operator-changeable
    values live in rail profiles with effective dates; never truncate or transliterate silently;
    an instant-payment time-out is not a failure; external legs use the escrow-lock.
16. PayNet (Section 40D): off-chain consumers use the Finalized Event Stream and commit their
    cursor with their effects; nothing is reported final before a verified finality proof.
17. Node craft (Section 46A): one owner per piece of mutable state, every queue bounded and
    declared in crates/node/src/channels.rs, every spawned task supervised; patterns N1–N20
    are review failures.
18. Explorer (Section 41A): scripts/check_ui_tells.sh must pass; Svelte 5 runes; amounts via
    BigInt only; the seal is ornament, the Verify button is proof.
19. Logs and disk (Sections 45.6, 45.7): RPC/API request logs are binary, sampled, rolled up
    and zstd-compressed before they touch disk; never write access logs or bodies to PostgreSQL;
    every log store has a byte budget; the disk guard sheds logs long before chain data is at risk.

## Work loop (per task)
1. Read the relevant APS doc(s) in docs/aps/. If missing, write/extend them first.
2. Define/extend the public interface in the owning crate (crates/<crate>/src/lib.rs); keep it pub(crate) unless it is API.
3. Write failing tests (unit + property; fuzz target for any parser/decoder).
4. Implement.
5. Run: `cargo fmt --check && cargo clippy --workspace --all-targets --all-features -- -D warnings && cargo test --workspace --locked && ./scripts/lint.sh`
6. Run the applicable sanitizer/concurrency/fault-injection jobs for touched modules; do not substitute a passing debug build for sanitizer coverage.
7. Run: ./scripts/coverage.sh — LLVM coverage gates and ratchet (Section 52.1) must pass.
8. Update docs to match actual behavior. Update docs/STATUS.md (implemented vs planned).
9. Commit in small, reviewable units: "<module>: <imperative summary>" + APS/ADR references.
10. Write the four-seat answers (Section 1.4) and the change class (Section 44.2) in the PR.

## Build profiles
dev | test | coverage | fuzz | release | hardened-release (Cargo profiles), plus CI jobs: miri (unsafe
boundaries), nightly -Zsanitizer=address|thread (FFI and concurrency crates), loom (lock-free code).
These jobs are CI-only; building the node never requires nightly (Section 5.5).

## Forbidden in consensus-critical code
floating-point arithmetic, nondeterministic map/set iteration feeding protocol outputs, OS/random APIs in consensus semantics, wall-clock reads in consensus semantics, unchecked panics, unsafe pointer casts in consensus code, and unreviewed FFI.
```

## 1.2 Definition of "Implemented"

Claude Code must maintain `docs/STATUS.md` with a table per module:
`Specified / Implemented / Tested / Fuzzed / Documented / Benchmarked`.
Documentation must never describe planned behavior as implemented
(Section 60).

## 1.3 Order of Work

Follow the phases in Section 62 strictly. **Do not start networking
before single-node determinism tests pass. Do not start the Arno
compiler before the native state machine, storage and recovery are
complete.**

## 1.4 The Four-Seat Review (every PR description answers these)

1.  **Protocol seat** --- Can this change any hash, receipt, event or
    state root? If yes: which protocol version introduces it, and which
    test vectors prove the old versions are untouched?
2.  **Full-stack seat** --- What does the Explorer, the explorer API,
    the indexer, the SDK and PayNet see after this change, including on
    a block produced before it?
3.  **DevOps seat** --- How is this deployed to a running network
    without stopping history? Which change class, which rollout, which
    rollback until when, which new alert or runbook?
4.  **Security seat** --- What new input crosses a trust boundary, what
    is its size and rate limit, what is the worst thing a malicious
    sender can do with it, and which test shows they cannot?

A PR that leaves any of the four blank is not reviewed.

------------------------------------------------------------------------

# 2. Product and System Vision

Aletheia StableChain is the foundational digital financial and state
infrastructure layer for the Aletheia project.

The chain must support:

1.  high-performance digital payments;
2.  native stable-value monetary instruments (AEY);
3.  a native network utility/staking asset (ALnT);
4.  programmable financial applications (Arno);
5.  native identity and credential registries;
6.  residence and land registries;
7.  institutional and enterprise applications;
8.  future government/state infrastructure;
9.  external financial-system integration (ISO 20022 gateway);
10. secure, HSM-backed validator infrastructure.

The physical and legal status of any future settlement is outside the
blockchain implementation. The engineering task is the technical
infrastructure. The protocol MUST NOT encode legal claims it cannot
enforce (e.g., the land registry records protocol-level control
references, not legal title determinations).

------------------------------------------------------------------------

# 3. Non-Negotiable Technical Decisions

## 3.1 Rust

The blockchain core, validator, consensus engine, state machine, VM,
executor, storage engine and P2P stack MUST be Rust.

Supporting tooling MAY use other languages (e.g., Python for test
orchestration, TypeScript for the explorer UI and JS SDK, Bash for
scripts). Nothing in the validator's consensus path may depend on them.

Mandatory Rust engineering practices:

-   Rust ownership, borrowing and `Drop` semantics for every resource
    (files, sockets, locks, DB handles, HSM sessions);
-   owned values by default; `Box`, `Arc` or synchronization primitives
    only with documented ownership/concurrency semantics;
-   value semantics and immutability for protocol objects;
-   strong types for every protocol quantity (no bare integer types
    without a domain-specific newtype for heights, slots, amounts);
-   slices (`&[u8]`), `&str` / byte slices and bounds-checked access at
    trust boundaries;
-   `Result<T, AletheiaError>` for fallible consensus-path operations;
-   explicit, hand-written canonical serialization (no reflection-based
    or protobuf encoding for consensus bytes);
-   sanitizers, static analysis, fuzzing, hardened compiler/linker
    flags.

Rust toolchain: stable Rust pinned in `rust-toolchain.toml`. Target:
Linux x86-64 and aarch64. Validators run Linux only. The exact toolchain
is a reproducibility input and changes only through reviewed
dependency/toolchain updates.

## 3.2 Strong Types (required pattern)

``` rust
// crates/core/src/types.rs
// Every protocol quantity is its own type. Arithmetic is explicit and checked; there is no
// `impl Add` that could silently wrap, and no `From<u64>` that would let a Slot become a Height.

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct Height(u64);

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct Slot(u64);

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct Epoch(u64);

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct ProtocolVersion(u16);

impl Height {
    pub const GENESIS: Height = Height(0);

    pub const fn new(value: u64) -> Height { Height(value) }
    pub const fn get(self) -> u64 { self.0 }

    /// The next height. Overflow is unreachable in practice (5.8 × 10^11 years at 500 ms),
    /// but it is still an error rather than a wrap, because "unreachable" is not a proof.
    pub fn next(self) -> Result<Height, AletheiaError> {
        self.0.checked_add(1).map(Height).ok_or_else(|| {
            AletheiaError::new(ErrorCode::ArithmeticOverflow, "height overflow".to_owned())
        })
    }
}

impl core::fmt::Display for Height {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result { self.0.fmt(f) }
}

/// Amount of one asset in base units. Never a float, never mixed across assets.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct Amount<A: AssetTag> { units: u128, asset: core::marker::PhantomData<A> }

impl<A: AssetTag> Amount<A> {
    pub const ZERO: Amount<A> = Amount { units: 0, asset: core::marker::PhantomData };
    pub const fn from_units(units: u128) -> Amount<A> { Amount { units, asset: core::marker::PhantomData } }
    pub const fn units(self) -> u128 { self.units }

    pub fn checked_add(self, other: Amount<A>) -> Result<Amount<A>, AletheiaError> {
        self.units.checked_add(other.units).map(Amount::from_units).ok_or_else(|| {
            AletheiaError::new(ErrorCode::ArithmeticOverflow, format!("{} + {} overflows u128", self.units, other.units))
        })
    }

    pub fn checked_sub(self, other: Amount<A>) -> Result<Amount<A>, AletheiaError> {
        self.units.checked_sub(other.units).map(Amount::from_units).ok_or_else(|| {
            AletheiaError::new(ErrorCode::InsufficientBalance, format!("{} − {} is negative", self.units, other.units))
        })
    }
}

pub trait AssetTag: Copy + Eq + Ord + core::fmt::Debug { const ASSET_ID: AssetId; const DECIMALS: u8; }

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct AeyTag;
impl AssetTag for AeyTag { const ASSET_ID: AssetId = AssetId::AEY; const DECIMALS: u8 = 18; }

pub type AeyAmount = Amount<AeyTag>;
```

A function taking `(Height, Slot)` must not compile when called with
`(Slot, Height)`.

## 3.3 Error Handling Model **\[DECISION ADR-001\]**

-   Consensus, execution, state, storage, crypto and VM code return
    `Result<T, AletheiaError>`.
-   Panics are permitted only in explicitly unreachable startup/tooling
    conditions; consensus worker code must return `Result` and handle
    errors explicitly.
-   Any panic escaping a consensus worker boundary triggers
    **fail-stop** after durable safety state is written and WAL policy
    is satisfied --- never "continue in an unknown state".
-   `AletheiaError` carries a stable, versioned protocol error code
    (Section 57).

``` rust
// crates/core/src/error.rs

/// The error type of every consensus-path operation.
///
/// `code` is protocol: stable, versioned, allowed into receipts. `detail` is for people:
/// it may change between releases and MUST NOT enter any hashed structure.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AletheiaError {
    code: ErrorCode,
    detail: String,
}

impl AletheiaError {
    pub fn new(code: ErrorCode, detail: String) -> AletheiaError { AletheiaError { code, detail } }
    pub fn code(&self) -> ErrorCode { self.code }
    pub fn detail(&self) -> &str { &self.detail }

    /// True for errors after which the node must stop rather than continue (Section 46.3):
    /// invariant violations, storage corruption, finality conflicts.
    pub fn is_fail_stop(&self) -> bool { self.code.class() == ErrorClass::FailStop }
}

impl core::fmt::Display for AletheiaError {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        write!(f, "{} ({}): {}", self.code.name(), self.code.get(), self.detail)
    }
}

impl std::error::Error for AletheiaError {}

// crates/core/src/error_codes.rs is generated from docs/aps/APS-0038-error-codes.toml.
// Codes are u32, grouped by thousands per subsystem, never reused.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
#[non_exhaustive]
pub enum ErrorCode {
    DecodeNonCanonical,      // 1001
    DecodeLengthExceeded,    // 1002
    DecodeTrailingBytes,     // 1003
    TxNonceTooLow,           // 2003
    TxTypeNotActive,         // 2020
    PayDuplicate,            // 6010
    ArithmeticOverflow,      // 9001
    InsufficientBalance,     // 9002
    FinalizeOutOfOrder,      // 11001  fail-stop
    FinalizeParentMismatch,  // 11002  fail-stop
    ProtocolVersionUnsupported, // 12001
    // … full list generated; this excerpt only shows the shape
}
```

Only `ErrorCode` (never `detail`) may enter receipts or any hashed
structure.

## 3.4 Human-Crafted Engineering Standard **\[DECISION ADR-025\]**

Everything in this repository --- code, docs, UI copy, commit messages
--- must read as if a careful senior engineer wrote it by hand.
Reviewers reject work that looks machine-generated, even if it compiles
and passes tests.

**Code**

-   Names say what a thing *is* in this domain: `finalized_height`,
    `mint_authorization`, `route_exposure`. Never `data`, `info`,
    `result2`, `helper`, `manager`, `handle_stuff`, `processData`.
-   Comments explain *why* (a constraint, a trade-off, an attack being
    prevented, the APS rule it implements). They never narrate what the
    next line obviously does. No comment banners like
    `// ===== HELPERS =====`, no `// This function …` preambles, no
    emoji.
-   Small functions with one job; no speculative abstraction ("in case
    we need it later"); no factory-of-factories; no interface with one
    implementation unless it is a real seam (storage backend, key
    backend, transport).
-   Consistent, boring formatting enforced by `rustfmt`, `prettier` and
    `arno fmt` --- style arguments are settled by the formatter, not by
    the author.
-   Error messages are specific and useful:
    `mint authorization 9f3c…e1a0 expired at epoch 4096 (current 4101)`,
    never `An error occurred`.
-   No dead code, no commented-out code, no `TODO` without an issue
    number and owner.
-   Commit messages: imperative, specific, with the reason ---
    `consensus: persist safety data before signing timeouts (APS-0007 R14)`.
    Never `Update files`, `Fix bug`, `Refactor code`.

**Prose (docs, UI copy, runbooks)**

-   Plain, precise, specific. Short sentences. Numbers instead of
    adjectives.
-   Banned in docs and UI copy (CI check `scripts/check_prose.sh`):
    *seamless, robust, leverage, delve, cutting-edge, revolutionary,
    empower, unlock, elevate, supercharge, game-changer, in today's
    fast-paced world, it's worth noting, harness the power*, and emoji.
-   Docs describe what the system does now, with examples that actually
    run.

**Review gate**: every pull request gets a human review that explicitly
checks this section. The PR template contains the line: *"Reads as
hand-written: names, comments, errors, copy --- reviewed."*

------------------------------------------------------------------------

# 4. Architecture Decision Records

Every decision tagged **\[DECISION ADR-xxx\]** in this document must
exist as `docs/adr/ADR-xxx-<slug>.md` using this template:

``` markdown
# ADR-xxx: <title>
Status: Accepted | Superseded by ADR-yyy
Date: YYYY-MM-DD
Context: <problem, constraints, spec sections>
Options considered: <A, B, C with trade-offs>
Decision: <chosen option>
Consequences: <determinism, security, performance, upgrade impact>
Protocol impact: <APS docs changed, protocol version bump? y/n>
```

Initial ADR register:

  -----------------------------------------------------------------------
  ADR                     Decision
  ----------------------- -----------------------------------------------
  001                     Rust `Result<T, AletheiaError>` error model;
                          fail-stop on consensus panics or unrecoverable
                          safety errors

  002                     Hash function: BLAKE3-256 for protocol
                          commitments; SHA-256 available for external
                          interop

  003                     Account signatures: Ed25519 (strict
                          ZIP-215-free RFC 8032 verification with
                          canonical S and point checks)

  004                     Consensus signatures: BLS12-381 (min-pk)
                          aggregate multi-signatures with
                          proof-of-possession

  005                     Canonical encoding: ACE (Aletheia Canonical
                          Encoding), fixed-width little-endian, no
                          varints

  006                     State tree: Jellyfish Merkle Tree (versioned
                          sparse 16-ary Merkle tree) over RocksDB

  007                     Block archive: append-only zstd-compressed
                          segment files + RocksDB index

  008                     Consensus: 2-chain pipelined BFT (DSP v0.1),
                          round == slot

  009                     Execution: execute-before-vote; speculative
                          execution of N+1 on prepared N

  010                     Arno VM: register-based interpreter, no JIT in
                          consensus, out-of-process sandboxed executor

  011                     Transaction ID excludes authorization (witness)
                          data

  012                     Canonical in-block transaction ordering
                          (Section 22)

  013                     Logs: binary structured records + zstd
                          dictionary compression → ClickHouse

  014                     Fee assets: AEY and ALnT, EU price per asset
                          set by governance

  015                     AEY base unit = 10⁻¹⁸ AEY (18 decimals); ALnT
                          base unit = Mite (10⁻³ ALnT)

  016                     P2P transport: TLS 1.3 mutual authentication
                          over TCP (QUIC reserved for v0.2)

  017                     Remote signer with persistent double-sign
                          protection; PKCS#11 through an isolated Rust
                          signer crate and HSM backend

  018                     Randomness: v0.1 deterministic permuted
                          round-robin; v0.2 threshold-BLS beacon

  019                     Arno uses Pascal / Delphi-style, English-like
                          syntax

  020                     JSON-RPC 2.0 public interface alongside REST,
                          shared service layer

  021                     No `0x` text encoding; `AL:B` block IDs;
                          unprefixed lowercase base16

  022                     Public stablechain bridge: native module,
                          tiered verification, lock-and-mint, per-route
                          caps

  023                     Coverage gates, mutation testing and
                          requirement traceability as merge requirements

  024                     Aletheia Explorer: "The Public Ledger" design
                          system, SvelteKit, Manrope only, WASM proof
                          verification

  025                     Human-crafted engineering standard for code,
                          prose and design, enforced in review and CI

  026                     Aletheia Payment Network: on-chain participant
                          directory, schemes and settlement; off-chain
                          encrypted messaging anchored on-chain

  027                     External connectivity via partner banks, PSPs
                          and rail adapters; no Aletheia use of ISO
                          country code `AL`

  028                     Compliance: KYC-tier limits enforced on-chain;
                          screening fail-closed; Travel Rule data
                          off-chain

  029                     Rust implementation language, Cargo workspace,
                          pinned toolchain and unsafe-code policy

  030                     No public testnet requirement; private
                          validation network is the production readiness
                          gate

  031                     AEY physical banknotes as a second form of the
                          same monetary unit; cash reconciliation
                          invariants

  032                     Financial rail interoperability through
                          authorized institutions and adapters; rail
                          access is not implied by protocol code
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 5. Technology Stack, Frameworks and Databases

All dependencies are pinned through Cargo manifests and a committed
`Cargo.lock`. The Rust toolchain is pinned in `rust-toolchain.toml`. No
dependency may be fetched at build time outside Cargo. Every dependency
is recorded in the SBOM (Section 50).

## 5.1 Core Rust Stack

The repository is a Cargo workspace. Exact crate versions are pinned in
`Cargo.lock`; production builds use a pinned `rust-toolchain.toml`. No
dependency is fetched dynamically during a release build.

  ------------------------------------------------------------------------------
  Concern                 Rust choice             Rule
  ----------------------- ----------------------- ------------------------------
  Async runtime           Tokio                   Outside consensus semantics;
                                                  bounded tasks/channels

  HTTP/REST               Axum + Hyper            Gateway/RPC only; no consensus
                                                  dependency

  JSON-RPC                Axum/Hyper + explicit   JSON is never consensus
                          method registry         serialization

  Admin RPC               tonic where             Never for consensus wire bytes
                          process-to-process RPC  
                          is useful               

  TLS                     rustls                  TLS 1.3; mTLS for
                                                  validator/service channels

  Hash                    blake3                  Protocol commitment hash in
                                                  v0.1

  Ed25519                 ed25519-dalek           Strict RFC 8032 verification
                                                  policy

  BLS12-381               blst bindings           Aggregate QCs + PoP

  Secure memory           zeroize                 Secret material must be
                                                  zeroized

  RNG                     getrandom / OS CSPRNG   Keys only; never consensus
                                                  randomness

  Storage                 rocksdb Rust binding    State/index persistence

  Compression             zstd                    Archive/log compression; never
                                                  commitment bytes

  Checksums               crc32c / xxhash-rust    WAL/archive integrity only

  Config                  toml                    Strict schema, no silent
                                                  defaults for safety settings

  CLI                     clap                    Stable JSON output schemas

  Serialization           custom ACE              Mandatory for all consensus
                                                  objects

  RPC JSON                serde_json              Boundary representation only

  Testing                 proptest, cargo-fuzz,   Property/fuzz/benchmark gates
                          Criterion               

  Coverage                llvm-cov +              Hard gates + ratchet
                          cargo-llvm-cov          

  Mutation                cargo-mutants           Consensus/monetary/VM/bridge
                                                  targets

  Static analysis         rustc warnings, clippy, Release gate
                          CodeQL, Semgrep,        
                          cargo-deny, cargo-audit 
  ------------------------------------------------------------------------------

### 5.2 Rust engineering rules

-   `#![forbid(unsafe_code)]` is the default for consensus-critical
    crates.
-   Any required `unsafe` or FFI is isolated in a dedicated
    crate/module, reviewed, documented with a Rust safety invariant,
    fuzzed and covered by an ADR.
-   `panic!`, `unwrap()`, `expect()` and indexing that can panic are
    forbidden in consensus execution paths. They MAY be used in tests
    and unreachable startup assertions only when justified.
-   Consensus code uses explicit domain newtypes (`Height`, `Slot`,
    `Epoch`, `AssetId`, `ExecutionUnits`, `ChainId`, etc.).
-   Protocol collections use `BTreeMap`/`BTreeSet` or sorted vectors.
    `HashMap`/`HashSet` may exist only for caches that cannot influence
    output, and this is enforced by review/CI.
-   No floating-point arithmetic in consensus, monetary, VM or ordering
    code.
-   No wall-clock reads in consensus semantics.
-   No async task scheduling order may influence state transition
    results.
-   `Send`/`Sync` requirements are explicit at thread/process
    boundaries.
-   Avoid `Arc<Mutex<_>>` in hot consensus paths; ownership is preferred
    and locks require a documented reason.
-   Serialization is handwritten through ACE; Serde derives MUST NOT
    define consensus bytes.

## 5.2 Testing and Quality Frameworks

The test stack MUST include unit tests, integration tests, `proptest`
properties, `cargo-fuzz` targets, deterministic network simulation,
crash/power-loss testing, Criterion benchmarks, `cargo-llvm-cov`
coverage, mutation testing and requirement traceability.

## 5.3 Databases --- What Goes Where **\[DECISION ADR-006, ADR-007, ADR-013\]**

``` text
┌────────────────────────── VALIDATOR / FULL NODE (consensus-relevant) ──────────────────────────┐
│                                                                                                │
│  Consensus WAL (custom)        ──  safety data, votes, pending proposals, pipeline state       │
│  RocksDB "state" instance      ──  Jellyfish Merkle Tree nodes, account/asset/registry values  │
│  RocksDB "chain" instance      ──  block index, tx index, receipts (zstd), events (zstd),      │
│                                    finality proofs, metadata                                   │
│  Block Archive (custom files)  ──  append-only segments, zstd-compressed canonical blocks      │
│  Snapshot Store (files)        ──  chunked, zstd-compressed state snapshots + manifest         │
│  Local log ring (files)        ──  zstd-dictionary-compressed binary log batches (bounded)     │
│                                                                                                │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
┌────────────────────────── OFF-CHAIN SERVICES (never consensus-relevant) ───────────────────────┐
│  PostgreSQL 16      ──  indexer/explorer query DB; ISO 20022 gateway audit ledger              │
│  ClickHouse 24.x    ──  compressed logs, traces, long-term metrics analytics                   │
│  Prometheus / VictoriaMetrics ── short-term metrics; Grafana dashboards                        │
│  HashiCorp Vault    ──  operational secrets (TLS certs, API tokens) — NOT consensus keys       │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
```

Rationale:

-   **RocksDB**: embedded (no network hop in the consensus path), LSM
    write throughput, column families, atomic `WriteBatch`, per-level
    compression with zstd dictionaries, snapshots/checkpoints, block
    checksums. Proven in production blockchains.
-   **Custom block archive**: finalized blocks are immutable and
    append-only; flat compressed segments are cheaper, simpler to verify
    and back up than LSM storage.
-   **Custom consensus WAL**: safety-critical data needs a minimal,
    auditable, fsync-controlled format independent of any DB engine's
    internal WAL.
-   **PostgreSQL**: rich querying for explorers, analytics and the
    gateway's regulated audit trail --- deliberately outside the node.
-   **ClickHouse**: columnar storage with per-column codecs (Delta,
    DoubleDelta, T64, ZSTD) gives 10--30× compression on structured
    logs.

Consensus correctness MUST NOT depend on RocksDB specifics: all access
goes through `aletheia_storage::KvStore` (Section 42) with a conformance
suite that a second backend must pass.

## 5.4 Deployment Stack

  -----------------------------------------------------------------------
  Layer                          Choice
  ------------------------------ ----------------------------------------
  Validators                     Bare metal or dedicated instances, Linux
                                 (Debian 12 / RHEL 9), **systemd**
                                 services, no container orchestration in
                                 the signing path

  Full nodes / RPC / indexer /   OCI containers (**distroless** base),
  gateway                        **Kubernetes**

  Infrastructure as code         **Terraform** (infra) + **Ansible**
                                 (host config)

  Time sync                      **linuxptp** (`ptp4l`, `phc2sys`) with
                                 hardware timestamping NICs; **chrony**
                                 (NTS) fallback

  Secrets                        HSM for consensus/monetary keys; Vault
                                 for operational secrets

  CI/CD                          GitHub Actions (or GitLab CI) with
                                 self-hosted hardened runners for release
                                 builds
  -----------------------------------------------------------------------

## 5.5 Cargo workspace

The root `Cargo.toml` defines a workspace containing the protocol crates
and binaries. `Cargo.lock` is committed. Release builds use
`cargo build --locked`; CI fails if the lockfile changes unexpectedly.

Minimum workspace policy:

``` toml
[workspace]
resolver = "2"
members = [
  "crates/core", "crates/crypto", "crates/storage", "crates/state",
  "crates/monetary", "crates/execution", "crates/vm", "crates/arno",
  "crates/identity", "crates/residence", "crates/land", "crates/governance",
  "crates/validator", "crates/consensus", "crates/mempool", "crates/p2p",
  "crates/rpc", "crates/wallet", "crates/gateway", "crates/apn",
  "crates/bridge", "crates/indexer", "crates/observability", "crates/node",
  "apps/*",
]

[workspace.package]
edition = "2024"
license = "Apache-2.0"

[profile.release]
codegen-units = 1
lto = "fat"
panic = "abort"
strip = "symbols"

[profile.hardened-release]
inherits = "release"
overflow-checks = true

[profile.dev]
overflow-checks = true
```

The exact Rust version is pinned in `rust-toolchain.toml`. The project MUST NOT require nightly Rust unless an ADR explicitly accepts the supply-chain and reproducibility consequences. Dependency updates require review, CI, security scanning and an ADR when they affect consensus, cryptography, serialization, storage or execution.

## 5.6 Build, lint and release commands

```text
cargo fmt --check
cargo check --workspace --locked
cargo clippy --workspace --all-targets --all-features -- -D warnings
cargo test --workspace --locked
cargo test --workspace --release --locked
cargo build --release --locked
cargo deny check
cargo audit
```

Sanitizer/undefined-behavior concerns are addressed through Rust's
memory-safety model plus dedicated FFI tests, Miri where applicable,
AddressSanitizer/LeakSanitizer on supported CI targets, ThreadSanitizer
for concurrency components where supported, and
fault-injection/loom-style concurrency tests for protocol state
machines.

## 5.7 Hardened Rust build policy

Release binaries MUST use reproducible build settings, locked
dependencies, symbol/provenance verification, SBOM generation and signed
release artifacts. CI treats warnings as errors. `panic = "abort"` is
required for production binaries. Consensus crates use
`#![forbid(unsafe_code)]` unless an approved FFI exception exists.

The CI gate MUST reject:

-   floating-point operations in consensus/monetary/VM/order code;
-   `unwrap`, `expect`, unchecked indexing or `panic!` in consensus
    execution paths unless explicitly allowlisted as unreachable and
    reviewed;
-   nondeterministic map/set iteration feeding hashes, serialization,
    ordering or state;
-   wall-clock reads in consensus semantics;
-   network/file-system access from Arno contracts;
-   dependency versions not present in `Cargo.lock`;
-   release builds with debug-only keys, test faucets or development
    monetary authority credentials.

# 6. Architecture Principles

### 6.1 Determinism

Every honest validator must obtain exactly the same result from:

``` text
(previous finalized state,
 canonical ordered transaction set,
 protocol version,
 contract bytecode,
 block context {height, slot, epoch, protocol_time, proposer, parent_hash})
```

### 6.2 Explicitness

Consensus-critical behavior never depends on undefined behavior, locale,
platform-specific sizes, unordered iteration, floating point, wall
clocks, thread scheduling or allocation addresses.

### 6.3 Cryptographic Verifiability

Every protocol claim (balance, receipt, registry entry, finality, supply
figure) is provable against a finalized header via Merkle proofs and a
finality certificate.

### 6.4 Crash Safety

Deterministic recovery after process crash, reboot, power loss, storage
interruption, partial writes and network interruption. A node never
proceeds from unverified state.

### 6.5 Stability

The node degrades gracefully under load (bounded queues, backpressure,
load shedding on non-consensus work), never deadlocks, never grows
memory unboundedly, and **fails stop rather than diverges** (Section
46).

### 6.6 Cryptographic Agility

Every signature, public key and hash in protocol objects is tagged with
an algorithm ID; algorithms are selected per protocol version.

### 6.7 Separation of Concerns

``` text
Consensus │ Execution │ State │ Storage │ P2P │ RPC │ Wallet │ VM/Executor │ Crypto │ Monetary │ Observability
```

Dependencies flow downward only (Section 55 lists the allowed graph).
`consensus` never includes `rpc`; `vm` never includes `p2p`; `crypto`
depends on nothing protocol-specific.

### 6.8 Security by Construction

Security is a design input: typed secrets, validated boundaries, least
privilege processes, no backdoors.

------------------------------------------------------------------------

# 7. High-Level System Architecture

``` text
                                ALETHEIA STABLECHAIN

  External Financial Systems (banks, PSPs)
                │  ISO 20022 over mTLS
                ▼
  ┌──────────────────────────┐        ┌─────────────────────────┐
  │ ISO 20022 Gateway (svc)  │──PG───▶│ PostgreSQL audit ledger │
  └────────────┬─────────────┘        └─────────────────────────┘
               │ signed protocol transactions (gateway operator account, limits)
               ▼
  ┌────────────────────────────────── aletheiad (node process) ─────────────────────────────────┐
  │  RPC (REST /api/v1, JSON-RPC /rpc/v1, WS) ─▶ Mempool ──▶ DSP Consensus ◀──▶ P2P (TLS 1.3 mTLS channels)      │
  │                                  │            ▲                                            │
  │                                  ▼            │ votes/timeouts                             │
  │                        Execution Pipeline ─────┘         ◀── gRPC ──▶ aletheia-signer (HSM) │
  │                         │               │                                                  │
  │               Native Protocol     Arno host bridge ◀══ shared mem ══▶ aletheia-arno-exec    │
  │               Modules (AEY,           │                         (seccomp sandbox, VM)    │
  │               ALnT, registries,         │                                                  │
  │               governance, validators)   │                                                  │
  │                         └──────┬────────┘                                                  │
  │                                ▼                                                           │
  │                 Deterministic State Machine + Invariant Checker (fail-stop)                │
  │                                ▼                                                           │
  │  Storage: Consensus WAL │ RocksDB(state: JMT) │ RocksDB(chain) │ Block Archive │ Snapshots  │
  │  Observability: binary logs ─zstd─▶ local ring ─▶ shipper ─▶ ClickHouse; /metrics; OTLP    │
  └────────────────────────────────────────────────────────────────────────────────────────────┘
```

Process model **\[DECISION ADR-010, ADR-017\]**:

  -----------------------------------------------------------------------------
  Process                     Privileges                 Purpose
  --------------------------- -------------------------- ----------------------
  aletheiad                   Unprivileged user, no key  Node: consensus,
                              material except TLS        execution
                              transport key              coordination, storage,
                                                         P2P, RPC

  aletheia-signer             Separate user; only        Signs consensus
                              process with HSM access    messages; enforces
                                                         double-sign protection

  aletheia-arno-exec          Sandboxed (seccomp, no     Executes Arno bytecode
                              network, no FS beyond      
                              shared memory)             

  `aletheia-gateway`          Separate host/network zone ISO 20022 integration
                                                         boundary

  `aletheia-indexer`          Read-only node client      Feeds PostgreSQL

  `aletheia-logship`          Reads compressed local log Ships to ClickHouse
                              ring                       

  `aletheia-bridge-relayer`   Untrusted, no keys         Carries bridge proofs
                                                         between Aletheia and
                                                         remote chains (anyone
                                                         can run one)

  `aletheia-guardian`         Separate host; HSM-backed  Bridge Guardian
                              signer                     attestation (Tier B
                                                         routes)
  -----------------------------------------------------------------------------

------------------------------------------------------------------------

# 8. Aletheia Protocol Standards (APS)

**APS --- Aletheia Protocol Standards** is the formal standards
namespace. Each APS document lives in `docs/aps/APS-NNNN-<slug>.md` and
MUST contain:

``` markdown
# APS-NNNN: <Title>
Status: Draft | Review | Final | Superseded
Version: x.y
Protocol versions: <range this applies to>
Requires: <APS dependencies>
## 1. Motivation
## 2. Terminology
## 3. Normative Requirements (MUST/SHOULD)
## 4. Binary Format (byte-exact tables)
## 5. Validation Rules (ordered; first failure → error code)
## 6. Error Conditions (ErrorCode list)
## 7. Security Considerations
## 8. Compatibility / Upgrade Considerations
## 9. Test Vectors (hex, in tests/vectors/APS-NNNN/*.json)
## 10. Reference Implementation (paths)
```

Initial standards:

``` text
APS-0001  Network and Chain Identity
APS-0002  Address and Identifier Format
APS-0003  Transaction Format
APS-0004  Block Format
APS-0005  State Commitments and State Root
APS-0006  Merkle Structures
APS-0007  DSP Consensus
APS-0008  Validator Identity
APS-0009  BLS Signatures (Aggregate QC + Threshold Beacon)
APS-0010  Chrono-Slot Synchronization
APS-0011  Deterministic Transaction Ordering
APS-0012  Deterministic Execution Model
APS-0013  Arno Language
APS-0014  Arno Bytecode
APS-0015  Arno VM
APS-0016  Execution Units
APS-0017  Native Asset Model
APS-0018  AEY
APS-0019  ALnT
APS-0020  Monetary Issuance
APS-0021  Mint, Burn, Lock and Redemption
APS-0022  Identity Registry
APS-0023  Residence Registry
APS-0024  Land Registry
APS-0025  Validator Registry
APS-0026  Governance
APS-0027  ISO-20022 Gateway
APS-0028  RPC
APS-0029  P2P Protocol
APS-0030  Wallet Interoperability
APS-0031  Transaction Receipts
APS-0032  Events and Logs
APS-0033  State Snapshots
APS-0034  WAL and Crash Recovery
APS-0035  Genesis
APS-0036  Protocol Upgrades
APS-0037  Cryptographic Agility
APS-0038  Security Requirements
APS-0039  Development and Private Validation Networks
APS-0040  Conformance Testing
APS-0041  Canonical Encoding (ACE)                  ← new in v2
APS-0042  Fees and Fee Assets                        ← new in v2
APS-0043  Remote Signer and Double-Sign Protection   ← new in v2
APS-0044  Node Observability and Log Format          ← new in v2
APS-0045  Oracles and Reserve Attestations           ← new in v2
APS-0046  Public Stablechain Bridge                  ← new in v2.1
APS-0047  JSON-RPC 2.0 Interface                     ← new in v2.1
APS-0048  Text Encoding of Identifiers and Binary Values (no 0x)  ← new in v2.1
APS-0049  APN Participant Directory and AIC           ← new in v2.3
APS-0050  AAN Account Numbers and Proxy Aliases       ← new in v2.3
APS-0051  APN Messaging and On-Chain Anchoring        ← new in v2.3
APS-0052  APN Scheme Rulebook (payment types)         ← new in v2.3
APS-0053  APN External Rails, FX and Reconciliation   ← new in v2.3
```

Reserved ranges:

  -----------------------------------------------------------------------
  Range                                  Use
  -------------------------------------- --------------------------------
  0001--0099                             Core protocol (Aletheia protocol
                                         team only)

  0100--0199                             Native registries and state
                                         infrastructure

  0200--0299                             Monetary and financial standards

  0300--0499                             Arno application standards
                                         (token interfaces, escrow, etc.)

  0500--0999                             Reserved

  1000+                                  Community proposals (assigned by
                                         governance, never self-assigned)
  -----------------------------------------------------------------------

Application developers MUST NOT self-assign APS identifiers; the
registry file `docs/aps/REGISTRY.md` is the single source of truth and
CI fails on duplicates.

------------------------------------------------------------------------

# 9. Canonical Encoding --- ACE (APS-0041) **\[CONSENSUS-CRITICAL\] \[DECISION ADR-005\]**

Every consensus object has exactly one valid byte representation.

Rules:

1.  Integers: fixed width, **little-endian**
    (`u8, u16, u32, u64, u128`). No varints anywhere in consensus
    encoding.
2.  Booleans: `u8` ∈ {0, 1}; any other value → `DecodeNonCanonical`.
3.  Fixed byte arrays: raw bytes, no prefix.
4.  Variable byte strings / lists: `u32` LE length prefix, then
    elements; each type defines a maximum; exceeding it →
    `DecodeLengthExceeded`.
5.  Enums/variants: `u8` or `u16` tag, then payload; unknown tag →
    `DecodeNonCanonical`.
6.  Optional: `u8` presence tag (0/1) then value.
7.  Structs: fields in declared order, no padding, no field names.
8.  Maps are forbidden in wire objects; use lists sorted by key with
    strict ascending order (duplicates or disorder →
    `DecodeNonCanonical`).
9.  Decoders MUST consume the entire input; trailing bytes →
    `DecodeTrailingBytes`.
10. Round-trip property: `encode(decode(b)) == b` for every accepted `b`
    (property-tested and fuzzed).

``` rust
// crates/core/src/ace.rs

/// Canonical encoding. Implemented by hand for every consensus type: the byte layout is
/// protocol, so it must be visible in the source, not derived by a macro.
pub trait AceEncode {
    fn encode(&self, out: &mut AceWriter);

    fn to_ace_bytes(&self) -> Vec<u8> {
        let mut out = AceWriter::with_capacity(self.encoded_len_hint());
        self.encode(&mut out);
        out.into_bytes()
    }

    fn encoded_len_hint(&self) -> usize { 64 }
}

pub trait AceDecode: Sized {
    fn decode(input: &mut AceReader<'_>) -> Result<Self, AletheiaError>;

    /// Decodes a complete value. Trailing bytes are an error (rule 9), never ignored.
    fn from_ace_bytes(bytes: &[u8]) -> Result<Self, AletheiaError> {
        let mut reader = AceReader::new(bytes);
        let value = Self::decode(&mut reader)?;
        reader.finish()?;
        Ok(value)
    }
}

pub struct AceReader<'a> { bytes: &'a [u8], position: usize }

impl<'a> AceReader<'a> {
    pub fn new(bytes: &'a [u8]) -> AceReader<'a> { AceReader { bytes, position: 0 } }

    pub fn u64(&mut self) -> Result<u64, AletheiaError> {
        let raw = self.take(8)?;
        let mut le = [0u8; 8];
        le.copy_from_slice(raw);
        Ok(u64::from_le_bytes(le))
    }

    pub fn bool(&mut self) -> Result<bool, AletheiaError> {
        match self.take(1)?[0] {
            0 => Ok(false),
            1 => Ok(true),
            other => Err(AletheiaError::new(ErrorCode::DecodeNonCanonical, format!("bool byte {other} at offset {}", self.position - 1))),
        }
    }

    /// Length-prefixed list with a per-type maximum (rule 4).
    pub fn list<T: AceDecode>(&mut self, max_len: u32) -> Result<Vec<T>, AletheiaError> {
        let len = self.u32()?;
        if len > max_len {
            return Err(AletheiaError::new(ErrorCode::DecodeLengthExceeded, format!("list of {len} exceeds maximum {max_len}")));
        }
        (0..len).map(|_| T::decode(self)).collect()
    }

    pub fn finish(self) -> Result<(), AletheiaError> {
        if self.position == self.bytes.len() { return Ok(()); }
        Err(AletheiaError::new(ErrorCode::DecodeTrailingBytes, format!("{} trailing bytes", self.bytes.len() - self.position)))
    }

    fn take(&mut self, n: usize) -> Result<&'a [u8], AletheiaError> {
        let end = self.position.checked_add(n).filter(|&end| end <= self.bytes.len()).ok_or_else(|| {
            AletheiaError::new(ErrorCode::DecodeLengthExceeded, format!("need {n} bytes at offset {}, have {}", self.position, self.bytes.len() - self.position))
        })?;
        let slice = &self.bytes[self.position..end];
        self.position = end;
        Ok(slice)
    }

    // u8, u16, u32, u128, fixed arrays, optional, sorted-list helpers follow the same pattern.
}
```

Every consensus type implements `AceEncode` and `AceDecode` by hand. Test vectors for each type live
in `tests/vectors/`.

------------------------------------------------------------------------

# 10. Network Identity (APS-0001) **\[CONSENSUS-CRITICAL\]**

  ---------------------------------------------------------------------------------------
  Field                Type     Mainnet      Private      Devnet     Local/regtest
                                             validation              
  -------------------- -------- ------------ ------------ ---------- --------------------
  `chain_id`           u32      assigned at  ≠ mainnet    ≠ others   random per run
                                genesis                              

  `network_kind`       u8       1            2            3          4

  Address checksum HRP ascii    `al`         `alt`        `ald`      `alr`

  `protocol_version`   u32      per upgrade                          

  `genesis_id`         Hash32   BLAKE3 of                            
                                canonical                            
                                genesis                              
                                config                               
  ---------------------------------------------------------------------------------------

Domain separation for every hash and signature:

``` text
H_domain(tag, msg) = BLAKE3( u8(len(tag)) || tag || u32_le(chain_id) || u8(network_kind) || msg )
```

Registered domain tags (ASCII; extending requires an APS update):

``` text
"ALETHEIA/TXID/v1"       transaction ID
"ALETHEIA/TXWIT/v1"      transaction witness hash
"ALETHEIA/TXSIG/v1"      transaction signing digest
"ALETHEIA/BLOCK/v1"      block header hash
"ALETHEIA/VOTE/v1"       DSP vote
"ALETHEIA/TIMEOUT/v1"    DSP timeout
"ALETHEIA/PROPOSAL/v1"   DSP proposal
"ALETHEIA/BLS-POP/v1"    BLS proof-of-possession
"ALETHEIA/ADDR/v1"       address derivation
"ALETHEIA/STATEKEY/v1"   state key derivation
"ALETHEIA/JMT-LEAF/v1"   JMT leaf
"ALETHEIA/JMT-NODE/v1"   JMT internal node
"ALETHEIA/MERKLE-LEAF/v1", "ALETHEIA/MERKLE-NODE/v1"  list Merkle trees
"ALETHEIA/ORDER/v1"      canonical ordering seed
"ALETHEIA/MINTAUTH/v1"   monetary mint authorization
"ALETHEIA/GENESIS/v1"    genesis
"ALETHEIA/BLOCKID/v1"    reserved (block IDs reuse block_hash)
"ALETHEIA/BRIDGE-MSG/v1"    bridge message ID
"ALETHEIA/BRIDGE-ATTEST/v1" bridge guardian attestation
```

Because `chain_id` and `network_kind` are inside every signed digest, a
mainnet signature is invalid on private-validation/devnet/regtest
networks and vice versa. Replay across networks is structurally
impossible.

``` rust
// Phase 0 obligation R.1 (Appendix R): write this interface from the normative text
// of this section, in the style of Sections 3.2, 9 and 15. Preserve the types, invariants,
// ordering and error semantics stated here. Consensus bytes go through ACE, never Serde;
// fallible operations return Result<T, AletheiaError>. Record it in the APS named in
// Appendix R and obtain the listed sign-off before anything depends on it.
```

------------------------------------------------------------------------

### Public-network policy

`network_kind = 2` may exist for a **private validation network**, but
no public testnet endpoint, public faucet or public validator onboarding
is required by this specification. Mainnet is not activated until
private validation and all readiness gates pass. A public testnet may be
created later as an optional developer service without becoming part of
the consensus or monetary safety assumptions.

# 11. Address Standard (APS-0002) **\[CONSENSUS-CRITICAL\]**

Human-facing format:

``` text
AL:<bech32m-data-part>
```

Binary payload (33 bytes):

  ------------------------------------------------------------------------
  Offset                 Size                   Field
  ---------------------- ---------------------- --------------------------
  0                      1                      `address_type` (0 =
                                                Ed25519 account, 1 =
                                                multisig account, 2 = Arno
                                                contract, 3 = native
                                                module, 4 = ML-DSA account
                                                (reserved))

  1                      32                     `account_hash`
  ------------------------------------------------------------------------

Derivation:

``` text
account_hash (Ed25519)  = H_domain("ALETHEIA/ADDR/v1", u8(0) || u8(alg_id) || pubkey)
account_hash (multisig) = H_domain("ALETHEIA/ADDR/v1", u8(1) || ace(threshold, sorted_pubkeys))
account_hash (contract) = H_domain("ALETHEIA/ADDR/v1", u8(2) || deployer || u64(deployer_nonce) || code_hash)
account_hash (module)   = fixed constants published in APS-0002 (e.g., AEY module, Validator Registry)
```

Encoding:

-   33 bytes → 5-bit groups (Bech32 charset
    `qpzry9x8gf2tvdw0s3jn54khce6mua7l`) = **53 characters**.
-   6-character **Bech32m** checksum computed with HRP = network HRP
    (`al` / `alt` / `ald` / `alr`). The HRP is **not displayed**; it is
    implied by the network, so an address copied from the private
    validation network fails checksum on mainnet.
-   Canonical form: literal uppercase prefix `AL:` + 59 lowercase
    characters. **Total length: 62 characters.**
-   Mixed case, uppercase data, whitespace, wrong length, wrong
    checksum, non-zero padding bits, or unknown `address_type` → reject
    (`AddrMalformed`, `AddrWrongNetwork`, `AddrNonCanonical`).

Example (illustrative, not a real vector):

``` text
AL:qz7m4k0f3v8u2d6y9p5x1w7c3n8e0h4s6j2r5t9g7l3a8q0u4m6k2d5vxl0e
```

``` rust
// Phase 0 obligation R.2 (Appendix R): write this interface from the normative text
// of this section, in the style of Sections 3.2, 9 and 15. Preserve the types, invariants,
// ordering and error semantics stated here. Consensus bytes go through ACE, never Serde;
// fallible operations return Result<T, AletheiaError>. Record it in the APS named in
// Appendix R and obtain the listed sign-off before anything depends on it.
```

Arbitrary human usernames are never protocol addresses. A future naming
service MAY map names → addresses as an Arno application or native
registry, but the protocol only transacts in canonical addresses.

------------------------------------------------------------------------

# 12. Transaction Identifier Standard **\[CONSENSUS-CRITICAL\] \[DECISION ADR-011\]**

``` text
AL:T<bech32m-data-part>
```

-   `tx_id = H_domain("ALETHEIA/TXID/v1", ace(TransactionBody))` ---
    **authorization/signatures are excluded**, so a re-signed or
    malleated signature cannot produce a different ID for the same
    intent.
-   `witness_hash = H_domain("ALETHEIA/TXWIT/v1", ace(SignedTransaction))`
    --- commits the full signed bytes into the block's `tx_root`.
-   Encoding: 32 bytes → 52 chars + 6 Bech32m checksum chars (HRP =
    network HRP + `t`, e.g. `alt`→`altt`) = 58 chars. Canonical form:
    `AL:T` + 58 lowercase chars = **62 characters**.

Transaction IDs are never random UUIDs, timestamps, database IDs or node
counters.

A transaction ID is unique per chain because the body includes
`sender` + `nonce`; the protocol rejects any second inclusion of a
`(sender, nonce)` pair.

## 12.1 Block Identifier Standard (`AL:B`)

``` text
AL:B<bech32m-data-part>
```

-   `block_id` = the 32-byte `block_hash` (Section 14.1), encoded
    exactly like `AL:T`: 52 data characters + 6-character Bech32m
    checksum computed with HRP = network HRP + `b` (e.g. `al` → `alb`).
    Canonical form: `AL:B` + 58 lowercase characters = **62
    characters**.
-   A block ID copied from the private validation network fails the
    checksum on mainnet, exactly like addresses and transaction IDs.

## 12.2 Text Encoding of Binary Values --- No `0x` **\[CONSENSUS-CRITICAL for parsers\] \[DECISION ADR-021\]**

Aletheia follows no Ethereum conventions. The `0x` prefix is **not used
anywhere**: not in RPC (REST or JSON-RPC), CLI output, logs,
configuration, genesis files, test vectors, SDKs or documentation.

  -----------------------------------------------------------------------
  Value           Canonical text form
  --------------- -------------------------------------------------------
  Account /       `AL:` + Bech32m (Section 11)
  contract        
  address         

  Transaction ID  `AL:T` + Bech32m (Section 12)

  Block ID        `AL:B` + Bech32m (Section 12.1)

  Other hashes    Lowercase base16, **no prefix**, exactly 64 characters
  (state root,    
  receipt root,   
  code hash,      
  message IDs)    

  Public keys,    Lowercase base16, **no prefix**, even length, exact
  signatures,     length where the type is fixed-size
  proofs, raw     
  transaction     
  bytes           

  Amounts         Decimal string of base units (optional separate
                  `display` string with decimals)

  Protocol tags,  Written in **decimal**
  type codes,     
  namespaces in   
  specs           
  -----------------------------------------------------------------------

Parser rules:

-   Input beginning with `0x` or `0X` is rejected
    (`EncPrefixedHexRejected`, JSON-RPC `-32602`) --- it is never
    silently stripped.
-   Uppercase base16 is rejected (one canonical form only); odd length
    or wrong fixed length is rejected.
-   Remote-chain values (bridge recipients and token identifiers,
    Section 40A) are stored as raw bytes and shown in unprefixed base16
    together with a `format` field; wallets may render them in the
    remote chain's own convention only on screens that belong to that
    remote chain.

``` rust
// Phase 0 obligation R.3 (Appendix R): write this interface from the normative text
// of this section, in the style of Sections 3.2, 9 and 15. Preserve the types, invariants,
// ordering and error semantics stated here. Consensus bytes go through ACE, never Serde;
// fallible operations return Result<T, AletheiaError>. Record it in the APS named in
// Appendix R and obtain the listed sign-off before anything depends on it.
```

A CI gate (`scripts/check_no_0x.sh`) fails the build if `0x` appears in
RPC fixtures, CLI golden outputs, docs, configs or test vectors (Rust
source may use numeric literals internally, but never emits them as
text). The gate allowlists only the lines that state or test this rule
itself.

------------------------------------------------------------------------

# 13. Transaction Standard (APS-0003) **\[CONSENSUS-CRITICAL\]**

``` text
SignedTransaction
├── body: TransactionBody
│   ├── version            u16
│   ├── chain_id           u32
│   ├── network_kind       u8
│   ├── tx_type            u16            (enum; see below)
│   ├── sender             Address (33 bytes)
│   ├── nonce              u64            (must equal account.next_nonce)
│   ├── fee
│   │   ├── fee_asset      AssetId (u32)  (AEY or ALnT in v0.1)
│   │   ├── max_fee        u128           (base units of fee_asset)
│   │   └── eu_limit       u64
│   ├── valid_from_slot    u64
│   ├── expiry_slot        u64            (expiry_slot - valid_from_slot ≤ MAX_TX_VALIDITY_SLOTS)
│   ├── memo               bytes ≤ 256    (opaque, no semantics)
│   └── payload            Payload (tagged variant)
└── authorization: Authorization
    ├── scheme             u8 (Ed25519 | MultiEd25519 | ML-DSA(reserved))
    └── signatures         list of { signer_index u8, alg_id u8, signature bytes }
```

Transaction types (v0.1):

  -----------------------------------------------------------------------
  Tag (decimal)  Type                   Handler
  -------------- ---------------------- ---------------------------------
  1              `Transfer`             Native asset module

  2              `BatchTransfer` (≤ 256 Native asset module
                 legs)                  

  16             `Mint`                 Monetary module (requires
                                        MintAuthorization)

  17             `Burn`                 Monetary module

  18             `Lock` / 19 `Unlock`   Monetary module

  20             `Redeem`               Monetary module

  32             `ContractDeploy`       Arno

  33             `ContractCall`         Arno

  48--63         Identity / Residence / Native registries
                 Land registry ops      

  64--79         Validator registry ops Validator module
                 (register, rotate      
                 keys, exit)            

  80--95         Governance (propose,   Governance module
                 vote, execute)         

  96             `ReserveAttestation`   Monetary/oracle module

  128--140       APN payments:          APN module (Section 40B.7)
                 `Payment`,             
                 `BatchPayment`,        
                 request-to-pay,        
                 mandates,              
                 `DirectDebit`,         
                 `ScheduledPayment`,    
                 returns, recalls,      
                 `MessageAnchor` (140)  

  112--127       Bridge operations      Bridge module (Section 40A.10)
                 (`BridgeOut`,          
                 `BridgeIn`, settle,    
                 flag, pause/resume,    
                 guardian set,          
                 light-client update)   
  -----------------------------------------------------------------------

v4.0 adds tx types **144--147** (`ExternalLegLock`, `ExternalLegSettle`, `ExternalLegRelease`,
`ExternalInboundCredit`; Section 40C.7). 141--143 stay reserved for APN.

Signing:

``` text
signing_digest = H_domain("ALETHEIA/TXSIG/v1", ace(TransactionBody))
signature      = Ed25519.Sign(sk, signing_digest)     // 32-byte prehash eases hardware wallets
```

Limits (devnet defaults --- benchmark before freezing):
`MAX_TX_BYTES = 64 KiB` (ContractDeploy: 512 KiB),
`MAX_TX_VALIDITY_SLOTS = 7200`, `MAX_MEMO = 256`.

Stateless validation (in order; first failure wins): size → decode
(canonical) → version supported → chain_id/network → type allowed at
protocol version → field ranges → validity window well-formed →
signature scheme/threshold → signature verification (strict Ed25519:
reject non-canonical S, small-order points).

Stateful validation (at mempool admission and again at execution):
nonce, fee affordability, slot within `[valid_from_slot, expiry_slot]`,
type-specific authorization.

``` rust
// Phase 0 obligation R.4 (Appendix R): write this interface from the normative text
// of this section, in the style of Sections 3.2, 9 and 15. Preserve the types, invariants,
// ordering and error semantics stated here. Consensus bytes go through ACE, never Serde;
// fallible operations return Result<T, AletheiaError>. Record it in the APS named in
// Appendix R and obtain the listed sign-off before anything depends on it.
```

------------------------------------------------------------------------

# 14. Block Standard (APS-0004) **\[CONSENSUS-CRITICAL\]**

## 14.1 Header (hash-committed)

``` text
BlockHeader
├── version                 u16
├── chain_id                u32
├── height                  u64
├── epoch                   u64
├── slot                    u64           (== DSP round)
├── protocol_time_ms        u64           (MUST == genesis_time_ms + slot × slot_duration_ms(version))
├── proposer                u16           (ValidatorIndex; MUST == leader(epoch, slot))
├── parent_hash             Hash32
├── parent_qc               QuorumCertificate   (certifies parent_hash; genesis: empty)
├── timeout_cert            Optional<TimeoutCertificate>  (present when slot-1 timed out)
├── tx_root                 Hash32        (Merkle root of witness_hashes in canonical order)
├── receipt_root            Hash32        (Merkle root of receipt hashes)
├── state_root              Hash32        (JMT root AFTER executing this block)
├── event_root              Hash32        (Merkle root of all events, for light-client proofs)
├── validator_set_hash      Hash32        (active set for this epoch)
├── next_validator_set_hash Hash32        (set taking effect at next epoch boundary)
├── monetary_root           Hash32        (commitment to supply ledger — also inside state_root; duplicated for cheap audit proofs)
├── eu_used                 u64
├── tx_count                u32
└── extensions              list<ExtensionField> sorted by u16 id (empty in v0.1)

block_hash = H_domain("ALETHEIA/BLOCK/v1", ace(BlockHeader))
```

Key corrections vs v1:

-   The **block's own** certificate is not in its header (circular). The
    header carries the **parent's** QC. The QC for block N appears in
    block N+1 and in the separately stored **finality proof**.
-   `protocol_time_ms` is derived, not chosen. Contracts read time only
    through this value.
-   Execution results are not transmitted; they are recomputed and
    committed via `receipt_root`, `event_root`, `state_root`.

## 14.2 Body

``` text
BlockBody
└── transactions: list<SignedTransaction>   (MUST be in canonical order — Section 22)
```

## 14.3 Proposal and Finality Proof

``` text
Proposal       = { header, body, proposer_signature: BLS(sk_consensus, H_domain("ALETHEIA/PROPOSAL/v1", block_hash)) }
FinalityProof  = { block_hash, qc(block), qc(child_block), child_header }   // 2-chain proof (Section 19.5)
```

Limits (devnet defaults): `MAX_BLOCK_BYTES = 4 MiB`,
`MAX_BLOCK_EU = 2,000,000,000`, `MAX_BLOCK_TXS = 20,000`.

------------------------------------------------------------------------

# 15. State Model (APS-0005) **\[CONSENSUS-CRITICAL\]**

State is logically separate from historical block storage. State is a
single authenticated key--value map.

State key derivation:

``` text
state_key = H_domain("ALETHEIA/STATEKEY/v1", u8(namespace) || ace(namespace_key))
```

  ---------------------------------------------------------------------------------------------------------------------
  Namespace                   ID          Key                Value
                              (decimal)                      
  --------------------------- ----------- ------------------ ----------------------------------------------------------
  Accounts                    1           Address            `{next_nonce, auth_scheme, pubkey_commitment, flags}`

  Balances                    2           (Address, AssetId) `{available u128, locked u128}`

  Assets                      3           AssetId            asset config (decimals, flags, authority)

  Monetary ledger             4           AssetId            SupplyLedger (Section 18.4)

  Mint authorizations         5           authorization_id   consumed flag, epoch

  Validator registry          16          ValidatorId        Validator record

  Validator sets              17          Epoch              ordered ValidatorSet

  Identity registry           32          IdentityId         Identity record

  Credentials                 33          CredentialId       commitment, status

  Residence registry          34          ResidenceId        Residence record

  Land registry               35          ParcelId           Parcel record

  Land history                36          (ParcelId, u64     historical entry
                                          seq)               

  Contract code               48          code_hash          bytecode

  Contract meta               49          contract Address   `{code_hash, deployer, arno_version, storage_root_hint}`

  Contract storage            50          (contract Address, bytes ≤ 16 KiB
                                          slot key)          

  Governance                  64          proposal_id        proposal

  Protocol params             65          param_id           value + version

  Oracles/attestations        80          (feed_id, epoch)   attestation

  Bridge routes               96          route_id           route config, limits, status

  Bridge messages             97          message_id         pending / consumed / flagged

  Bridged assets              98          (route_id,         AssetId mapping + ledger
                                          remote_token)      

  Bridge light clients        99          remote_chain_id    verified remote headers / validator sets

  APN participants            100         AIC                participant record

  AAN mapping                 101         AAN                `AL:` address

  Proxy aliases               102         H(salt ‖ alias)    `AL:` address (resolution restricted)

  Mandates                    103         mandate_id         mandate

  Payment requests /          104         request_id /       status, terms
  scheduled payments                      schedule_id        

  Message anchors             105         batch_id           Merkle root of APN message envelope hashes

  Scheme rules and KYC-tier   106         scheme_id / tier   governed parameters
  limits                                                     
  ---------------------------------------------------------------------------------------------------------------------

v4.0 adds namespace **66** Protocol schedule (key: protocol_version; Section 44.4), **107** Payment
de-duplication (key: `PaymentDedupKey`; Section 40D.5) and **108** External-leg escrow (key: `leg_id`;
Section 40C.7). Each is introduced by the protocol version that activates its APS (Section 44.3).

Every state write happens through a `StateOverlay` (copy-on-write view
per block); the overlay is committed atomically only when the block is
finalized (Section 20).

``` rust
// crates/state/src/overlay.rs

/// Copy-on-write view of state for one block, layered on its parent's view.
///
/// Reads fall through: this overlay → parent overlays (speculative/prepared) → committed JMT.
/// Writes stay here until the block is finalized and `write_into` flattens them into one batch.
/// `BTreeMap` keeps keys sorted so flattening and hashing never depend on insertion order.
pub struct StateOverlay<'p> {
    base: &'p dyn StateView,
    writes: BTreeMap<StateKey, Option<StateValue>>,   // None = deleted
    checkpoints: Vec<usize>,                            // journal lengths for tx-level revert
    journal: Vec<(StateKey, Option<Option<StateValue>>)>,
}

pub trait StateView {
    fn get(&self, key: &StateKey) -> Result<Option<StateValue>, AletheiaError>;
}

impl<'p> StateOverlay<'p> {
    pub fn get(&self, key: &StateKey) -> Result<Option<StateValue>, AletheiaError> {
        match self.writes.get(key) {
            Some(value) => Ok(value.clone()),
            None => self.base.get(key),
        }
    }

    pub fn put(&mut self, key: StateKey, value: StateValue) {
        let previous = self.writes.insert(key.clone(), Some(value));
        self.journal.push((key, previous));
    }

    pub fn delete(&mut self, key: StateKey) {
        let previous = self.writes.insert(key.clone(), None);
        self.journal.push((key, previous));
    }

    /// Marks the start of a transaction. A trap reverts to here; fees are charged after.
    pub fn checkpoint(&mut self) { self.checkpoints.push(self.journal.len()); }

    pub fn revert_to_checkpoint(&mut self) -> Result<(), AletheiaError> {
        let mark = self.checkpoints.pop().ok_or_else(|| {
            AletheiaError::new(ErrorCode::StateNoCheckpoint, "revert without checkpoint".to_owned())
        })?;
        while self.journal.len() > mark {
            if let Some((key, previous)) = self.journal.pop() {
                match previous {
                    Some(value) => { self.writes.insert(key, value); }
                    None => { self.writes.remove(&key); }
                }
            }
        }
        Ok(())
    }

    pub fn commit_checkpoint(&mut self) { self.checkpoints.pop(); }

    /// Sorted, deduplicated writes for the JMT update and the finalize batch.
    pub fn changes(&self) -> impl Iterator<Item = (&StateKey, Option<&StateValue>)> {
        self.writes.iter().map(|(k, v)| (k, v.as_ref()))
    }
}
```

------------------------------------------------------------------------

# 16. State Root and Merkle Structures (APS-0005, APS-0006) **\[CONSENSUS-CRITICAL\] \[DECISION ADR-006\]**

## 16.1 State Tree: Jellyfish Merkle Tree (JMT)

-   Sparse, versioned, 16-ary (nibble-path) Merkle tree over 256-bit
    `state_key`.
-   Leaf hash:
    `H_domain("ALETHEIA/JMT-LEAF/v1", state_key || H(value))`.
-   Internal node: `H_domain("ALETHEIA/JMT-NODE/v1", child_hash[0..15])`
    with placeholder hash for empty children.
-   Versioned by block height: node keys in RocksDB =
    `u64_be(version) || nibble_path`, enabling historical proofs and
    pruning.
-   Supports inclusion and non-inclusion proofs.
-   Updates for a block are applied in ascending `state_key` order
    (ordered write-set) → deterministic node creation.

## 16.2 List Merkle Trees (tx_root, receipt_root, event_root)

Binary Merkle tree, RFC 6962-style:

``` text
leaf  = H_domain("ALETHEIA/MERKLE-LEAF/v1", item)
node  = H_domain("ALETHEIA/MERKLE-NODE/v1", left || right)
odd   : promote the last node unpaired (no duplication — prevents CVE-2012-2459-style mutation)
empty : root = H_domain("ALETHEIA/MERKLE-LEAF/v1", empty)
```

## 16.3 Proof APIs

``` rust
// Phase 0 obligation R.5 (Appendix R): write this interface from the normative text
// of this section, in the style of Sections 3.2, 9 and 15. Preserve the types, invariants,
// ordering and error semantics stated here. Consensus bytes go through ACE, never Serde;
// fallible operations return Result<T, AletheiaError>. Record it in the APS named in
// Appendix R and obtain the listed sign-off before anything depends on it.
```

Light-client verification path:
`FinalityProof → header.state_root → StateProof → value`.

------------------------------------------------------------------------

# 17. Cryptographic Abstraction (APS-0037) **\[DECISION ADR-002/003/004\]**

``` rust
// Phase 0 obligation R.6 (Appendix R): write this interface from the normative text
// of this section, in the style of Sections 3.2, 9 and 15. Preserve the types, invariants,
// ordering and error semantics stated here. Consensus bytes go through ACE, never Serde;
// fallible operations return Result<T, AletheiaError>. Record it in the APS named in
// Appendix R and obtain the listed sign-off before anything depends on it.
```

Required categories: hash, signature, key generation (ed25519-dalek /
zeroize / getrandom CSPRNG / HSM), address derivation, BLS (blst Rust
bindings), Merkle trees, state commitments, secure randomness (OS CSPRNG
for keys only --- never in consensus), key derivation (HKDF-SHA256 /
SLIP-0010 for wallets).

No custom cryptographic primitives. Cryptographic libraries are wrapped,
never modified. Every wrapper has known-answer tests from the upstream
test vectors.

------------------------------------------------------------------------

# 18. Native Monetary Architecture (APS-0017 ... APS-0021, APS-0045) **\[CONSENSUS-CRITICAL\]**

## 18.1 Governed Monetary Capacity (no hard-coded 830T)

The previously discussed **830 trillion USD-equivalent** figure is a
preliminary planning estimate only. It MUST NOT appear in code as a
lifetime supply ceiling.

The protocol uses a **governed monetary-capacity model**:

-   `authorized_capacity` --- a governed state parameter per asset,
    changeable only via a governance-approved `MonetaryPolicyUpdate`
    (Section 35), timelocked, logged and bounded by
    `max_capacity_increase_per_epoch`.
-   `epoch_issuance_cap` --- maximum new issuance per epoch per asset.
-   Issuance never exceeds either limit; no unlimited discretionary
    minting exists anywhere, including in development builds on
    production genesis.

The architecture supports future capacity expansion without redesign:
capacity is data, not code.

## 18.2 Monetary Arithmetic (APS-0020)

-   All balances and amounts are **unsigned 128-bit integers of base
    units**.
-   No `float`, `double`, `long double` in any monetary path (enforced
    by CI gate).
-   Overflow/underflow → deterministic failure
    (`ExecArithmeticOverflow`), the transaction fails, fees are charged,
    state is reverted to the transaction checkpoint.
-   Multiplication/division uses 256-bit intermediates
    (`primitive-types / uint / fixed-width checked arithmetic selected and pinned by ADR::uint256`)
    with **explicit rounding mode** per operation: `Floor` (default for
    amounts paid out by the protocol), `Ceil` (fees charged to users),
    `HalfEven` (reporting only, never in state).
-   Division by zero is impossible by construction (divisors validated
    as non-zero parameters) and additionally returns an error.

``` rust
// Phase 0 obligation R.7 (Appendix R): write this interface from the normative text
// of this section, in the style of Sections 3.2, 9 and 15. Preserve the types, invariants,
// ordering and error semantics stated here. Consensus bytes go through ACE, never Serde;
// fallible operations return Result<T, AletheiaError>. Record it in the APS named in
// Appendix R and obtain the listed sign-off before anything depends on it.
```

`kMaxBaseUnits = 2¹²⁰ − 1` (≈ 1.33 × 10³⁶ base units) gives ≈ 1.33 ×
10¹⁸ AEY at 18 decimals --- far above any conceivable capacity, leaving
8 bits of headroom so sums of two maximal values cannot wrap a `u128`.

## 18.3 Asset Definitions **\[DECISION ADR-015\]**

  -------------------------------------------------------------------------------------
  Asset       AssetId         Base unit          Decimals         Kind
  ----------- --------------- ------------------ ---------------- ---------------------
  **AEY**     1               10⁻¹⁸ AEY          18               Native stable-value
  (Aletheian                                                      EUR-denominated
  Guilder)                                                        settlement unit;
                                                                  protocol-controlled
                                                                  issuance

  **ALnT**    2               **Mite** (1 ALnT = 3                Native network
  (Aletheia                   1,000 Mites)                        utility / staking
  Talent)                                                         asset
  -------------------------------------------------------------------------------------

ALnT's 3-decimal granularity is preserved exactly as specified.
Consequence: the smallest ALnT fee is 1 Mite; fee schedules in ALnT must
account for this granularity (APS-0042). The ALnT monetary and staking
policy lives in a separate versioned specification (APS-0019) --- v0.1
genesis fixes an initial supply and validator bonding requirement
defined in genesis config, with no inflation schedule until governance
adopts one.

## 18.4 Supply Ledger and Invariants **\[CONSENSUS-CRITICAL\]**

Per asset, the state holds:

``` rust
// Phase 0 obligation R.8 (Appendix R): write this interface from the normative text
// of this section, in the style of Sections 3.2, 9 and 15. Preserve the types, invariants,
// ordering and error semantics stated here. Consensus bytes go through ACE, never Serde;
// fallible operations return Result<T, AletheiaError>. Record it in the APS named in
// Appendix R and obtain the listed sign-off before anything depends on it.
```

Invariants checked **after every block** by `MonetaryInvariantChecker`:

``` text
I1  outstanding            = issued_total − burned_total
I2  outstanding            = circulating + locked + reserved + bridge_escrow + physical_cash_outstanding
I3  outstanding            ≤ authorized_capacity
I4  issued_this_epoch      ≤ epoch_issuance_cap
I5  redeemed_total         ≤ burned_total
I6  issued_total, burned_total, redeemed_total are monotonic non-decreasing
I7  Σ digital balances(asset) over all accounts == circulating + locked + reserved + bridge_escrow   (full audit mode;
    incremental: Δ of per-account balances in the block equals Δ of ledger buckets)
I8  (reserve-backed AEY) outstanding_liabilities = outstanding
I9  (reserve-backed AEY, if policy.enforce_reserve_ratio)
       attested_reserve_value × 10_000 ≥ outstanding × policy.min_reserve_ratio_bps
       with a fresh attestation (attestation_epoch ≥ current_epoch − max_attestation_age)
I10–I12  bridge escrow, bridged-asset backing and per-route flow limits; C1–C6 physical-cash reconciliation (Section 40A.9)
```

Violation handling: an invariant violation during execution of a
proposed block → the node **refuses to vote** and records evidence. An
invariant violation detected on already-finalized state (should be
impossible) → **fail-stop halt** of block production with a critical
alert. The node never "fixes" balances automatically.

Off-chain reserves are never represented as existing on-chain.
`attested_reserve_value` is a number signed by a quorum of registered
attestors (Section 18.8), with full history kept in state.

## 18.5 AEY --- Native Operations (APS-0018, APS-0021)

AEY is a native protocol asset, never an Arno contract.

  --------------------------------------------------------------------------------
  Operation              Authorized by                   Effect
  ---------------------- ------------------------------- -------------------------
  `MINT`                 Valid `MintAuthorization`       `issued_total += a`,
                         (M-of-N monetary authority      credit destination
                         keys)                           (reserve or recipient)

  `TRANSFER`             Sender signature                Move available balance

  `BURN`                 Holder signature                `burned_total += a`,
                                                         debit holder

  `LOCK`                 Holder signature or authorized  available → locked
                         module (escrow, staking)        

  `UNLOCK`               Lock owner/module per lock      locked → available
                         terms                           

  `REDEEM`               Holder + registered redemption  Burn +
                         agent co-authorization          `redeemed_total += a` +
                                                         emits
                                                         `RedemptionRequested`
                                                         event for off-chain
                                                         settlement via gateway
  --------------------------------------------------------------------------------

`MintAuthorization`:

``` text
MintAuthorization
├── authorization_id   Hash32   (unique; consumed exactly once)
├── asset_id           u32
├── amount             u128
├── destination        Address
├── reserve_ref        Hash32   (links to ReserveAttestation / off-chain settlement reference)
├── valid_until_epoch  u64
└── signatures         list<{authority_index u8, ed25519_sig}>   ≥ threshold M of N
digest = H_domain("ALETHEIA/MINTAUTH/v1", ace(fields without signatures))
```

``` rust
// Phase 0 obligation R.9 (Appendix R): write this interface from the normative text
// of this section, in the style of Sections 3.2, 9 and 15. Preserve the types, invariants,
// ordering and error semantics stated here. Consensus bytes go through ACE, never Serde;
// fallible operations return Result<T, AletheiaError>. Record it in the APS named in
// Appendix R and obtain the listed sign-off before anything depends on it.
```

Monetary authority keys are HSM-resident, distinct from validator keys,
rotated via governance, and listed in state (namespace 65 parameters).

## 18.6 Physical AEY Banknotes --- Same Monetary Unit, Separate Settlement Form

AEY is a **dual-form monetary unit**: digital AEY exists as balances on
StableChain; physical AEY exists as banknotes issued by the Aletheia
Monetary Authority. There is no second currency and no independent
paper-money supply.

Physical banknotes are bearer instruments and MUST NOT contain personal
identity data. The protocol does not record the identity of a person
spending cash. The Monetary Authority maintains the authoritative
off-chain note inventory and production/custody controls, while
StableChain maintains the monetary liability and aggregate
cash-outstanding accounting needed for supply reconciliation.

### Physical-cash model

``` text
Digital AEY ──cash withdrawal──▶ Authorized cash agent ──▶ AEY banknotes
      ▲                                      │
      │                                      │ cash deposit / redemption
      └───────────────digital credit─────────┘

Both forms represent the same AEY monetary unit.
Form conversion changes the representation, not the total outstanding monetary liability.
```

The monetary ledger therefore adds a `physical_cash_outstanding` bucket
for AEY. The total AEY outstanding calculation MUST include digital
balances, locked/reserved balances, bridge escrow and physical cash
outstanding. Cash conversion MUST NOT be implemented as a hidden
mint/burn path.

### Banknote series and controls

Each approved denomination/series has a governance-controlled
configuration containing denomination, series identifier,
security-feature profile, issuance authority, first/last serial range,
status and withdrawal date where applicable. Individual serial numbers
are managed by the Monetary Authority's secure cash system. Only
aggregate issuance/withdrawal/reconciliation commitments are anchored
on-chain.

Required operations: `CashSeriesCreate`, `CashIssue`,
`CashWithdrawFromCirculation`, `CashDeposit`, `CashRedeem`,
`CashSeriesSuspend`, `CashSeriesRetire`, and `CashReconciliationReport`.
These operations are privileged Monetary Authority operations and
require the same authorization, audit and fail-safe standards as other
monetary operations.

Counterfeit detection is an off-chain physical control. StableChain MUST
never claim that a note is genuine merely because its serial appears in
a ledger. A note-status query can report issuance/retirement state
without becoming a substitute for physical authentication.

### Cash invariants

``` text
C1  physical_cash_outstanding ≥ 0
C2  physical_cash_outstanding = issued physical notes − permanently withdrawn/redeemed notes
C3  AEY total outstanding = digital circulating + digital locked + digital reserved + bridge escrow + physical_cash_outstanding
C4  converting digital AEY to physical cash decreases digital outstanding by exactly the same amount that physical_cash_outstanding increases
C5  converting physical cash to digital AEY decreases physical_cash_outstanding by exactly the same amount that digital balance increases
C6  no cash operation may bypass Monetary Authority authorization, audit logging or reserve policy
```

Physical-cash records MUST never expose personal cash transaction
history on-chain.

## 18.7 ALnT (APS-0019)

-   `1 ALnT = 1,000 Mites`; all state and arithmetic in Mites.
-   Uses: validator bonding (staking), fee payment, governance weight
    (if adopted by governance policy).
-   No minting path exists for ALnT in v0.1 beyond genesis allocation,
    unless governance activates an issuance schedule through a protocol
    upgrade.

## 18.8 Oracles and Reserve Attestations (APS-0045)

No HTTP/API response may influence consensus. External data enters only
as signed transactions:

``` text
ReserveAttestation
├── feed_id            u32
├── epoch              u64
├── value              u128   (EUR base units; precision defined by the attestation standard)
├── observed_slot      u64
├── evidence_ref       Hash32 (auditor report hash, off-chain)
└── signatures         ≥ attestor_threshold of registered attestors
```

Acceptance rules: authenticated origin (registered attestors), quorum
threshold, freshness (`observed_slot` within `max_age_slots`), deviation
limit vs previous value (larger deviations require a higher threshold),
and full history retained. On attestation failure/staleness: if
`enforce_reserve_ratio` is on, **new MINT is blocked**; transfers, burns
and redemptions continue.

------------------------------------------------------------------------

# 19. DSP v0.1 --- Deterministic Sovereign Pipeline (APS-0007 ... APS-0011) **\[CONSENSUS-CRITICAL\] \[DECISION ADR-008\]**

DSP combines: deterministic leader scheduling; synchronized chrono-slots
for pacing; pipelined execution; authenticated proposals; aggregate BLS
quorum certificates; deterministic 2-chain finality.

**Safety never depends on clocks, PTP, or network timing. Timing affects
only liveness.**

## 19.1 Validator Model

-   Active set size `N`, Byzantine tolerance `F = ⌊(N − 1) / 3⌋`,
    requirement `N ≥ 3F + 1`.
-   v0.1: **equal-weight permissioned validators** (weights = 1);
    stake-weighting is reserved in the data model (`voting_power u64`)
    for a later version.
-   Quorum `Q = 2F + 1` votes (with equal weight: `Q = N − F`). Quorum
    is computed from the **epoch's** validator set, fixed at epoch
    start.
-   Validator set changes take effect only at epoch boundaries and are
    committed via `next_validator_set_hash`.

Validator status machine:

``` text
REGISTERED ──activate(epoch)──▶ ACTIVE ──request_exit──▶ EXITING ──epoch end──▶ REMOVED
     │                            │  ▲
     │                            ▼  │ reinstate (governance)
     └────────────reject───────▶ SUSPENDED (equivocation evidence / governance / HSM compromise)
```

Validator record:

``` text
Validator
├── validator_id           Hash32
├── operator_address       Address
├── node_identity_pubkey   Ed25519        (P2P identity)
├── consensus_pubkey       BLS12-381 G1   (+ proof_of_possession)
├── transport_cert_hash    Hash32         (TLS certificate pin)
├── management_pubkey      Ed25519        (key rotation / exit requests)
├── voting_power           u64            (v0.1 = 1)
├── status                 enum
├── activation_epoch       u64
├── deactivation_epoch     Optional<u64>
└── metadata_hash          Hash32         (operator legal/ops metadata, off-chain)
```

## 19.2 Validator Keys (APS-0008, APS-0043) **\[DECISION ADR-017\]**

  ----------------------------------------------------------------------------
  Key          Algorithm              Storage             Used for
  ------------ ---------------------- ------------------- --------------------
  Node         Ed25519                Encrypted file or   P2P peer identity
  identity key                        HSM                 

  Consensus    BLS12-381              **HSM via           Proposals, votes,
  signing key                         aletheia-signer**   timeouts

  BLS          BLS12-381              HSM                 Randomness beacon
  threshold                                               
  key share                                               
  (v0.2)                                                  

  Transport    ECDSA P-256 / Ed25519  Encrypted file,     TLS 1.3 mTLS
  key          X.509                  rotated 90d         

  Management   Ed25519                Offline / cold HSM  Rotation, exit,
  key                                                     operator actions
  ----------------------------------------------------------------------------

High-value keys never exist as plaintext config. Development plaintext
keys are only allowed with `network_kind ∈ {devnet, regtest}` and are
rejected at startup on mainnet or private-validation genesis.

**Remote signer with double-sign protection** --- the signer persists,
per consensus key, the highest signed round for each message class, and
refuses anything that could equivocate even if aletheiad is compromised
or restored from an old backup:

``` rust
// Phase 0 obligation R.10 (Appendix R): write this interface from the normative text
// of this section, in the style of Sections 3.2, 9 and 15. Preserve the types, invariants,
// ordering and error semantics stated here. Consensus bytes go through ACE, never Serde;
// fallible operations return Result<T, AletheiaError>. Record it in the APS named in
// Appendix R and obtain the listed sign-off before anything depends on it.
```

The signer is the **last line of defense** against slashing-grade
equivocation; it must be tested with kill -9 between persist and sign,
and with restored-older-state scenarios (must refuse to start if its
state file is older than its HSM-side monotonic counter where the HSM
supports one).

## 19.3 BLS Signatures (APS-0009) **\[DECISION ADR-004\]**

-   Curve: **BLS12-381**, min-pk variant (public keys in G1, signatures
    in G2) via **blst Rust bindings**; ciphersuite
    `BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_POP_`.
-   **Proof-of-possession** required at registration (defends against
    rogue-key attacks on aggregation).
-   **Quorum certificates use aggregate multi-signatures**, not
    threshold signatures:

``` text
QuorumCertificate
├── round            u64
├── block_hash       Hash32
├── epoch            u64
├── signer_bitmap    bitset[N]   (MUST have ≥ Q bits set; bit i ↔ validator index i of epoch set)
└── aggregate_sig    G2 (96 bytes)

Verification:
  1. epoch known, bitmap length == N, popcount(bitmap) ≥ Q, no bits beyond N
  2. agg_pk = Σ pk_i for i in bitmap (cache per (epoch,bitmap) optional)
  3. verify(agg_pk, H_domain("ALETHEIA/VOTE/v1", ace(round, block_hash, epoch)), aggregate_sig)
```

Why not threshold for QCs: threshold signatures are constant-size but
hide *which* validators signed, breaking equivocation accountability,
and require a DKG before the first block. Threshold BLS (with DKG or a
genesis ceremony) is implemented in **DSP v0.2** for the unbiasable
randomness beacon, where signer anonymity is acceptable. This satisfies
v1's instruction "do not confuse ordinary aggregation with threshold
security" by using each where it is correct.

Duplicate signers are impossible by bitmap construction; aggregating
from individual votes MUST de-duplicate by validator index and verify
each vote (or batch-verify) before inclusion. Conflicting certificates
(two QCs for different blocks in the same round) are cryptographic proof
of ≥ F+1 equivocators and are recorded as evidence.

## 19.4 Chrono-Slots (APS-0010)

``` text
Epoch (E micro-epochs)  └── Micro-Epoch (M slots)  └── Slot (== consensus round)
```

Nominal slot timeline (**devnet defaults --- benchmark before
freezing**):

``` text
slot_duration_ms = 500
 ├─ 0   –  60 ms  proposal build (leader: select, order, execute, assemble)
 ├─ 60  – 200 ms  propagation window
 ├─ 200 – 350 ms  validation/execution + vote window
 ├─ 350 – 450 ms  QC aggregation / certificate window
 └─ 450 – 500 ms  slack / recovery
timeout_ms        = base 1500, exponential backoff ×1.5 per consecutive timeout, cap 12000
micro_epoch       = 32 slots  (metrics/rotation granularity)
epoch             = 16 micro-epochs = 512 slots  (validator-set changes, cap resets)
```

Progress is **event-driven**: a node enters slot `s+1` as soon as it
holds `QC(s)` or `TC(s)`; the clock only paces (a node won't propose
before `slot_start(s) − max_early_ms`) and triggers timeouts. All
durations are protocol-version parameters.

## 19.5 Consensus Rules (safety core)

Persistent safety data (fsynced in the consensus WAL **before** any
message is sent):

``` text
SafetyData { epoch, last_voted_round, preferred_round, highest_qc_round, last_timeout_round }
```

**Voting rule** --- vote for proposal `B` in round `r` iff all hold:

``` text
V1  B passes full validation and re-execution yields B.header.{state_root, receipt_root, event_root, eu_used}
V2  r > last_voted_round
V3  r > last_timeout_round            (never vote in a round we already timed out)
V4  either  B.parent_qc.round + 1 == r
    or      B.timeout_cert.round + 1 == r  and  B.parent_qc.round ≥ max(TC.high_qc_rounds)
V5  B.parent_qc.round ≥ preferred_round
```

**Lock update** --- on observing a valid QC for block `P` whose own
parent QC is for round `P.parent_qc.round`:
`preferred_round = max(preferred_round, P.parent_qc.round)`.

**Commit rule (2-chain)** --- block `B` is **FINALIZED** when a valid QC
exists for a block `C` with `C.parent_hash == hash(B)` and
`C.round == B.round + 1`. Finalizing `B` finalizes all its uncommitted
ancestors.

**Timeout** --- on slot timer expiry without a QC, sign
`Timeout{round, highest_qc_round}`, set `last_timeout_round = r`,
broadcast. `Q` timeouts form a
`TimeoutCertificate{round, high_qc_rounds[], aggregate_sig}`.

``` rust
// Phase 0 obligation R.11 (Appendix R): write this interface from the normative text
// of this section, in the style of Sections 3.2, 9 and 15. Preserve the types, invariants,
// ordering and error semantics stated here. Consensus bytes go through ACE, never Serde;
// fallible operations return Result<T, AletheiaError>. Record it in the APS named in
// Appendix R and obtain the listed sign-off before anything depends on it.
```

Finality is a protocol fact: `FinalityProof` is stored and served by
RPC. An honest node never replaces a finalized block at the same height;
any attempt to do so via sync is rejected and raises a critical alert.

## 19.6 Deterministic Leader Scheduling (APS-0010) **\[DECISION ADR-018\]**

``` text
seed(epoch)          = H_domain("ALETHEIA/ORDER/v1", "leader" || u64(epoch) || finalized_hash_at(epoch_start − 1))
perm(epoch)          = Fisher–Yates over [0..N) using a BLAKE3-XOF stream keyed by seed(epoch)
                       (rejection sampling for unbiased indices; no modulo bias)
leader(epoch, slot)  = active_set(epoch)[ perm(epoch)[ slot mod N ] ]
```

Uses only finalized data, so every honest node computes the same
schedule. v0.2 replaces the seed with the threshold-BLS beacon output to
remove last-block grinding. No local randomness is ever used.

## 19.7 DSP Block Lifecycle State Machine

``` text
PROPOSED ─validate─▶ VALIDATED ─execute─▶ EXECUTED ─vote─▶ ATTESTED ─QC formed─▶ QUORUM-CERTIFIED ─2-chain─▶ FINALIZED
    │                    │                    │                                         │
    └──invalid──▶ REJECTED (evidence)         └──mismatch──▶ REJECTED                    └── orphaned if sibling finalized ──▶ DISCARDED
```

Legal transitions are exactly the arrows above; all others are
programming errors (`ALETHEIA_ASSERT` → fail-stop). `FINALIZED` is
terminal and irreversible. Implemented as an explicit enum with a
`transition(from, to)` table that is unit-tested for every pair.

## 19.8 Byzantine Scenarios (all must have simulator tests)

  -------------------------------------------------------------------------
  Scenario              Detection                  Response
  --------------------- -------------------------- ------------------------
  Malicious proposer    Validation/execution       Reject, record evidence,
  (invalid block)       mismatch                   no vote; slot times out
                                                   → TC → next leader

  Equivocating proposer Two signed proposals same  Record
                        slot                       `ProposalEquivocation`
                                                   evidence (both
                                                   signatures); submit to
                                                   Validator Registry →
                                                   SUSPENDED

  Equivocating voter    Two votes same round       Record
                        different hashes           `VoteEquivocation`
                                                   evidence; suspension

  Validator             Missed votes               Continue while ≥ Q live;
  disappearance                                    otherwise halt progress
                                                   (safety over liveness)

  Network partition     No QC in minority          Minority stalls;
                        partition                  majority (≥ Q)
                                                   continues; minority
                                                   rejoins via sync; never
                                                   two finalized
                                                   conflicting blocks

  PTP outage / clock    Offset monitor             Enter `CLOCK_DEGRADED`:
  fault                                            stop proposing, continue
                                                   voting on valid blocks
                                                   (voting is
                                                   clock-independent),
                                                   widen timeouts; resync
                                                   required to propose

  Conflicting           Two valid QCs, same round, Critical alert, preserve
  certificates          different blocks           evidence, never finalize
                                                   either branch until
                                                   resolved per rules;
                                                   indicates \> F faults

  HSM compromise        Operator report /          Governance/emergency
                        anomalous signatures       suspension tx; key
                                                   rotation via management
                                                   key; signer revocation
                                                   list

  Datacenter failure    Loss of co-located         Placement policy: no
                        validators                 more than F validators
                                                   per datacenter /
                                                   provider / jurisdiction
                                                   (checked at
                                                   registration; warning
                                                   metric)

  Long-range / stale    Sync from peers            Only accept chains
  sync                                             extending the locally
                                                   finalized chain;
                                                   checkpoints signed by
                                                   validator sets
  -------------------------------------------------------------------------

## 19.9 Clock Synchronization (APS-0010)

-   Validators run **linuxptp** with hardware timestamping; **chrony
    with NTS** as fallback.
-   The node reads offset/drift from `phc2sys`/chrony status via a
    monitor thread and exposes `clock_offset_ns`, `clock_sync_state`
    metrics.
-   Envelope (devnet defaults): `max_offset = 5 ms` (PTP) / `50 ms` (NTP
    fallback), `max_drift = 20 ppm`.
-   States: `SYNCED → DEGRADED → UNSYNCED`. In `DEGRADED`/`UNSYNCED` the
    node **does not propose** and does not emit timeouts early; it still
    validates and votes (votes do not depend on local time).
-   Monotonic OS clock isolated to the node pacing/watchdog layer drives
    all internal timers; wall-clock time is never read in consensus
    code.

------------------------------------------------------------------------

# 20. DSP Execution Pipeline (APS-0012) **\[DECISION ADR-009\]**

Execute-before-vote: the header commits the post-state of its own block;
every validator re-executes before voting.

``` text
Slot N:   [intake]→[order]→[execute N on finalized/prepared parent]→[assemble]→[propose]→[validators re-execute]→[vote]→[QC(N)]
Slot N+1:              leader of N+1 speculatively executes on PREPARED(N) while QC(N) forms ─────────────▶
Slot N+2:                                                              QC(N+1) ⇒ N FINALIZED (2-chain)
```

Pipeline state per block: `Speculative` (built on a non-certified
parent) → `Prepared` (parent has QC) → `Committed` (finalized). Rules:

1.  Speculative state lives only in memory as a chain of `StateOverlay`s
    keyed by block hash; it is never written to the state DB.
2.  If a parent is orphaned (sibling finalized), all dependent
    speculative overlays are discarded (explicit dependency tracking:
    ordered Rust map (`BTreeMap<BlockHash, PendingBlock>`) with parent
    links).
3.  On finalization, overlays are flattened and committed atomically:
    one RocksDB `WriteBatch` containing JMT nodes, state values,
    receipts, indexes and the `last_finalized` marker, written with
    `sync=true`, preceded by the consensus WAL record (Section 24).
4.  Execution within a block is **sequential** in v0.1. Parallel
    execution (v0.2) must use declared access sets and a deterministic
    scheduler whose committed result equals sequential execution in
    canonical order (property-tested).

------------------------------------------------------------------------

# 21. Mempool

The mempool is **not** consensus state; validators never assume others
share its contents.

-   Admission: stateless validation → stateful checks against latest
    committed state → per-sender queue.
-   Per-sender structure: `BTreeMap<Nonce, TxEntry>`; only a contiguous
    run from `account.next_nonce` is *ready*.
-   Duplicate detection by `tx_id`; replacement allowed for same
    `(sender, nonce)` only with fee bump ≥ 10 % (configurable).
-   Limits (defaults): 200 MB total, 64 pending per sender, 5,000 per
    peer origin per minute, `MAX_TX_BYTES`.
-   Eviction: expired (`expiry_slot` passed) first; then lowest
    fee-per-EU non-ready txs; never evict the lowest-nonce ready tx of a
    sender while higher ones stay.
-   Anti-spam: fee floor, per-IP/per-peer token buckets, signature
    verification cost bounded by batching and a verification thread pool
    with bounded queue.
-   Gossip: announce `tx_id` hashes; peers request bodies they lack
    (pull), limiting amplification.

------------------------------------------------------------------------

# 22. Deterministic Transaction Ordering (APS-0011) **\[CONSENSUS-CRITICAL\] \[DECISION ADR-012\]**

The proposer chooses **which** transactions to include (subject to
limits and fee policy). **Order within the block is fixed by protocol**;
blocks not in canonical order are invalid.

``` text
canonical_order(txs, parent_hash):
  1. Partition by priority class:  SYSTEM (validator/evidence) < MONETARY_AUTHORITY < GOVERNANCE < NORMAL
  2. Within a class, group by sender; each group sorted by nonce ascending and MUST be contiguous
     starting at the sender's next_nonce as of the parent state.
  3. Order groups by  k(sender) = H_domain("ALETHEIA/ORDER/v1", parent_hash || sender_address_bytes)
     ascending (bytewise), ties impossible (distinct senders).
  4. Concatenate classes in order, groups in order, txs in nonce order.
```

Properties: identical output on every node; fee does not buy position
(limits front-running within a block); the proposer cannot choose the
parent hash after the fact, so it cannot grind positions for a given
parent.

``` rust
// Phase 0 obligation R.12 (Appendix R): write this interface from the normative text
// of this section, in the style of Sections 3.2, 9 and 15. Preserve the types, invariants,
// ordering and error semantics stated here. Consensus bytes go through ACE, never Serde;
// fallible operations return Result<T, AletheiaError>. Record it in the APS named in
// Appendix R and obtain the listed sign-off before anything depends on it.
```

(deterministic slice sorting with an explicit total comparator with a
strict total order on unique keys is deterministic regardless of
algorithm stability.)

Validators check: recomputed order equals the block order; nonce
contiguity; no duplicate `(sender, nonce)`.

------------------------------------------------------------------------

# 23. Fees and Fee Assets (APS-0042) **\[DECISION ADR-014\]**

-   Fees are payable in **AEY** or **ALnT**.
-   Governance sets `eu_price[asset]` (base units per EU, integer), with
    `min_eu_price` floors.
-   `fee_charged = ceil(eu_used × eu_price[fee_asset])`
    (Rounding::Ceil), `≤ max_fee` else the tx is invalid at inclusion
    time.
-   Fee is charged even if execution fails (after passing validation),
    preventing free spam of failing transactions.
-   Fee distribution (v0.1): 100 % to a protocol fee-pool account,
    distributed to active validators at epoch end pro-rata to signed QCs
    (integer division, remainder carried to next epoch --- no dust
    loss). Burn share is a governance parameter (default 0).

------------------------------------------------------------------------

# 24. Consensus WAL and Crash Recovery (APS-0034) **\[CONSENSUS-CRITICAL\]**

## 24.1 WAL Format

Segmented, append-only files: `wal/000000000042.wal`, 64 MiB each.

``` text
Segment header:  magic "ALWAL\0\1\0" (8) | segment_seq u64 | created_protocol_version u32 | header_crc32c u32
Record:
  +0   u32  length (payload bytes)
  +4   u32  crc32c(type || seq || payload)
  +8   u8   record_type
  +9   u64  sequence (global, strictly +1)
  +17  ...  payload (ACE-encoded, uncompressed — WAL favors simplicity and recovery speed)
Record types: SAFETY_DATA, PROPOSAL_RECEIVED, BLOCK_EXECUTED(hash, roots), QC, TC,
              FINALIZE_BEGIN(height, hash), FINALIZE_COMMITTED(height, hash), EVIDENCE, CHECKPOINT
```

## 24.2 fsync Policy

  -----------------------------------------------------------------------
  Record                            Policy
  --------------------------------- -------------------------------------
  `SAFETY_DATA`                     durable file sync through Rust OS
                                    bindings isolated in the WAL crate
                                    **before** the related vote/timeout
                                    is sent

  `FINALIZE_BEGIN`                  durable file sync through Rust OS
                                    bindings isolated in the WAL crate
                                    before RocksDB commit

  RocksDB finalize `WriteBatch`     RocksDB synchronous write options
                                    through the Rust RocksDB binding

  `FINALIZE_COMMITTED`              durable file sync through Rust OS
                                    bindings isolated in the WAL crate
                                    after RocksDB commit

  Others                            group commit every ≤ 10 ms
  -----------------------------------------------------------------------

Segment rotation at 64 MiB; segments older than the last `CHECKPOINT`
whose finalized height is durable in RocksDB are deleted (retain ≥ 2).

## 24.3 Recovery Procedure

``` text
1.  Acquire exclusive data-dir lock (flock); refuse to start if held.
2.  Open WAL: validate segment headers; scan records; verify CRC and sequence continuity.
3.  Truncate at the first torn/corrupt record ONLY if it is in the last segment tail
    (torn write). Corruption earlier → refuse to start (StoWalChecksum), operator action.
4.  Open RocksDB with paranoid_checks; read last_finalized {height, hash, state_root}.
5.  Verify block archive entry for last_finalized: recompute block_hash from canonical bytes.
6.  Verify JMT root at version=height equals header.state_root (full re-hash of root path;
    optional deep verify with --verify-state).
7.  Reconcile: if WAL has FINALIZE_BEGIN(h) without FINALIZE_COMMITTED(h):
       if RocksDB last_finalized == h → append FINALIZE_COMMITTED (commit landed)
       else → re-execute block h from archive/WAL proposal and re-commit (idempotent)
8.  Restore SafetyData = max-merge of WAL SAFETY_DATA and signer state (never lower).
9.  Rebuild pipeline: re-execute non-finalized PROPOSAL_RECEIVED/QC records on top of finalized state.
10. Rebuild consensus view (highest QC/TC), sync missing blocks from peers (verify QCs + execution).
11. Rejoin: enter current slot as follower; resume voting only after catching up to the network's
    highest QC and satisfying V2/V3 with restored SafetyData.
```

A node never recovers from unverified partial state; any unverifiable
condition → refuse to start with an explicit error and runbook link
(`docs/operations/recovery.md`).

Power-loss testing is mandatory (Section 52): dm-log-writes replay of
every write-ordering prefix for the finalize path must recover to a
consistent state.

------------------------------------------------------------------------

# 25. Arno Smart-Contract Language (APS-0013) **\[DECISION ADR-019\]**

Arno is an independent language shaped like **Java and Solidity** (a
`contract { }` with `public` and `private` members, braces and
semicolons) that uses **English words where those languages use
symbols**, so that auditors, regulators and business analysts can follow
a contract, not only programmers. The syntax follows ADR-049, which
replaced the original Pascal-family syntax (ERRATA E-27).

  -----------------------------------------------------------------------
  Pillar                      Mechanism
  --------------------------- -------------------------------------------
  Reads like English          `is`, `is not`, `and`, `or`, `not`,
                              `require … otherwise`, `for each … in`,
                              `while … at most N times`, `emit`, `move`

  Familiar shape              `contract Name { }` holding constants,
                              enums, records, errors, events, private
                              variables, a `constructor` and
                              `public` / `private` / `view` functions

  Familiar operators          `=` assignment, `is` / `is not` comparison
                              (`==` is refused with a hint),
                              `and` / `or` / `not` / `xor`, `div` / `mod`
                              for integer division

  Case                        As in Java: keywords are lowercase and
                              names are case-sensitive (`Employee
                              employee` is two names); a name that
                              differs from a known one only by case
                              gets a "did you mean" hint (ADR-054)

  Statically typed            Every variable is declared with its type
                              (`UInt128 total = 0;`); no implicit
                              conversions, no type guessing beyond a
                              `for each` variable taking its items' type

  Deterministic               No `Real`/`Double`/`Single` types exist;
                              time only via `Chain.protocolTime`; every
                              loop has a compile-time bound

  Asset-safe                  `Coins of <Asset>` is a linear type: it
                              must be moved exactly once (into a `Vault`,
                              a `transfer`, or returned). Copying or
                              silently dropping coins does not compile

  Explicit authorization      Public functions receive a `Signer`
                              parameter; authority is a value you check,
                              not a hidden global

  Explicit effects            Each function declares what it does:
                              `changes storage`, `receives coins`,
                              `sends coins`, `emits events`,
                              `calls contracts`. Anything undeclared is a
                              compile error

  Safe by default             Integer overflow aborts the transaction;
                              re-entry is forbidden unless the function
                              is marked `reentrant`; call depth ≤ 16

  Versioned                   `version 0.1;` --- the VM executes each
                              contract under the semantics of its
                              declared version
  -----------------------------------------------------------------------

Source extension: `.arno`

## 25.1 Shape of an Arno Contract

``` text
contract <Name> {
    version <major.minor>;
    uses <standard units>;                       // Coins, Auth, Chain, Math, ...

    constant <Name> = <value>;
    enum <Name> { <A>, <B> }
    record <Name> { <Type> <field>; ... }
    error <Name> "<English message>";
    event <Name>(<Type> <field>, ...);

    private <Type> <variable>;                   // contract storage, always private

    constructor(Signer caller, ...) <effects> { ... }

    public function <name>(Signer caller, ...) <effects> { ... }       // callable entry
    public view function <name>(...) returns <Type> { return ...; }    // read by anyone
    private function <name>(...) [returns <Type>] <effects> { ... }    // internal helper
}
```

## 25.2 Example --- Escrow

``` arno
// Escrow: holds AEY until the arbiter releases it, or refunds the buyer after the deadline.
contract Escrow {
    version 0.1;
    uses Coins, Auth, Chain;

    enum Phase { Open, Funded, Released, Refunded }

    error WrongPhase  "The escrow is not in the right phase for this action.";
    error NotTheBuyer "Only the buyer can do this.";
    error NotArbiter  "Only the arbiter can do this.";
    error TooEarly    "The refund deadline has not passed yet.";

    event EscrowFunded(Address buyer, UInt128 total);
    event EscrowReleased(Address seller, UInt128 total);
    event EscrowRefunded(Address buyer, UInt128 total);

    private Address buyer, seller, arbiter;
    private Slot deadline;
    private Vault of AEY safe;
    private Phase state;

    constructor(Signer caller, Address theSeller, Address theArbiter, Slot theDeadline)
        changes storage
    {
        buyer    = caller.address;
        seller   = theSeller;
        arbiter  = theArbiter;
        deadline = theDeadline;
        safe     = Vault.Empty;
        state    = Open;
    }

    public function fund(Signer caller, Coins of AEY deposit)
        changes storage, receives coins, emits events
    {
        require state is Open otherwise WrongPhase;
        require caller.address is buyer otherwise NotTheBuyer;
        UInt128 total = deposit.value;
        safe.deposit(move deposit);        // deposit is used up here and can never be touched again
        state = Funded;
        emit EscrowFunded(buyer, total);
    }

    public function release(Signer caller)
        changes storage, sends coins, emits events
    {
        require state is Funded otherwise WrongPhase;
        require caller.address is arbiter otherwise NotArbiter;
        Coins of AEY payout = safe.withdrawAll;
        UInt128 total = payout.value;
        transfer(move payout, seller);
        state = Released;
        emit EscrowReleased(seller, total);
    }

    public function refund(Signer caller)
        changes storage, sends coins, emits events
    {
        require state is Funded otherwise WrongPhase;
        require caller.address is buyer otherwise NotTheBuyer;
        require Chain.slot > deadline otherwise TooEarly;
        Coins of AEY back = safe.withdrawAll;
        UInt128 total = back.value;
        transfer(move back, buyer);
        state = Refunded;
        emit EscrowRefunded(buyer, total);
    }

    public view function status() returns Phase {
        return state;
    }
}
```

`move deposit` hands the named coins over: after it, `deposit` cannot
be used again, and leaving a function while still holding coins does
not compile.

## 25.3 Example --- Payroll (loops, records, lists)

``` arno
// Payroll: pays every active employee from one vault, or nobody if the vault is short.
contract Payroll {
    version 0.1;
    uses Coins, Auth;

    constant MaxStaff = 500;

    record Employee {
        Address wallet;
        UInt128 salary;
        Boolean active;
    }

    error NotOwner  "Only the payroll owner can do this.";
    error NotEnough "The payroll vault does not hold enough AEY for this run.";

    event SalaryPaid(Address wallet, UInt128 amount);

    private Address owner;
    private List of Employee max MaxStaff staff;
    private Vault of AEY funds;

    public function payEveryone(Signer caller)
        changes storage, sends coins, emits events    // funds.withdraw changes the stored vault (ERRATA E-25)
    {
        require caller.address is owner otherwise NotOwner;

        UInt128 needed = 0;
        for each person in staff {
            if person.active {
                needed = needed + person.salary;      // overflow would abort, never wrap
            }
        }

        require funds.balance >= needed otherwise NotEnough;

        for each person in staff {                    // bounded: staff holds at most MaxStaff entries
            if person.active {
                transfer(funds.withdraw(person.salary), person.wallet);
                emit SalaryPaid(person.wallet, person.salary);
            }
        }
    }
}
```

A temporary `Coins` value produced by a call (such as
`funds.withdraw(...)`) and passed straight into another call is moved
automatically; only named `Coins` variables need the explicit `move`
keyword, so a reader always sees where a named value is handed over.

## 25.4 Statement Cheat-Sheet

``` text
x = y + 1;                                   assignment
UInt128 total = 0;                           declare a local variable (once per function)
if a and not b { ... } else if c { ... } else { ... }
switch state { case Open -> ...; case Funded, Released -> ...; default -> ...; }
for i from 1 to N { ... }                    N must be a constant
for each item in staff { ... }               over bounded lists / arrays
while remaining > 0 at most 100 times { ... }   every while-loop carries its bound
require condition otherwise ErrorName;       abort with a named error (state reverted)
fail ErrorName;                              abort unconditionally
emit EventName(arguments);                   record an event
move x                                       hand over a named Coins value (x is unusable afterwards)
return value;                                give back a function's result and leave
return;                                      leave a function that returns nothing
```

Comparisons: `is`, `is not`, `<`, `<=`, `>`, `>=`. Arithmetic: `+ - *`,
integer `div` (rounds toward zero) and `mod`. The `/` operator does not
exist. Money math uses `mulDiv(a, b, c, RoundDown)` or
`mulDiv(a, b, c, RoundUp)` from `Std.Math`, which uses a 256-bit
intermediate.

## 25.5 Types (v0.1)

  -----------------------------------------------------------------------
  Arno type                             Meaning
  ------------------------------------- ---------------------------------
  `Boolean`                             `True` / `False`

  `UInt8`, `UInt16`, `UInt32`,          Unsigned integers; overflow
  `UInt64`, `UInt128`                   aborts

  `Int64`                               Signed integer; overflow aborts

  `Address`                             An `AL:` account or contract
                                        address

  `Hash`                                32-byte hash

  `Height`, `Slot`, `Epoch`             Chain positions (distinct types;
                                        not interchangeable)

  `Text max N`                          Bounded UTF-8 text

  `Bytes[N]` / `Bytes max N`            Fixed / bounded raw bytes

  `enum Name { A, B, C }`               Enumeration

  `record Name { ... }`                 Structured value

  `array[1..N] of T`                    Fixed-size array (1-based)

  `List of T max N`                     Bounded list

  `Map of K to V`                       Ordered map, storage only

  `Optional of T`                       Either `Nothing` or a value

  `Coins of A`                          Linear asset value (AEY, ALnT, or
                                        a bridged asset)

  `Vault of A`                          Storage-held container of coins

  `Signer`                              Proof that an account signed this
                                        transaction
  -----------------------------------------------------------------------

Not in v0.1: pointers, `nil`, classes, inheritance, virtual methods,
dynamic dispatch, recursion, exceptions (`try`/`except`), floating
point. Contracts, records and functions give the shape of Java and
Solidity without class machinery. `interface` declarations for application
standards (APS-0300 range) are reserved for Arno v0.2.

## 25.6 Grammar Excerpt (EBNF, full grammar in `docs/arno/grammar.ebnf`)

``` ebnf
Unit          = "contract" Ident "{" "version" Version ";" [ UsesClause ] { Member } "}" ;
Member        = Constant | TypeAlias | Enum | Record | ErrorDecl | EventDecl
              | Variable | Constructor | Function ;
Variable      = [ "private" ] Type Ident { "," Ident } ";" ;
Constructor   = "constructor" Params [ Effects ] Block ;
Function      = { "public" | "private" | "view" | "reentrant" } "function" Ident Params
                [ "returns" Type ] [ Effects ] Block ;
Params        = "(" [ Type Ident { "," Type Ident } ] ")" ;
Effects       = Effect { "," Effect } ;
Effect        = "changes" "storage" | "receives" "coins" | "sends" "coins"
              | "emits" "events" | "calls" "contracts" ;
Block         = "{" { Statement } "}" ;
Statement     = LocalDecl | Assign | Call | IfStmt | SwitchStmt | ForStmt | ForEachStmt
              | WhileStmt | RequireStmt | FailStmt | EmitStmt | ReturnStmt | Block ;
RequireStmt   = "require" Expr "otherwise" Ident ";" ;
WhileStmt     = "while" Expr "at" "most" ConstExpr "times" Block ;
ForEachStmt   = "for" "each" [ Type ] Ident "in" Designator Block ;
Comparison    = Sum [ ( "is" | "is" "not" | "<" | "<=" | ">" | ">=" ) Sum ] ;
MoveExpr      = "move" Ident ;
```

The grammar is LL(1)-friendly and parsed by a hand-written
recursive-descent parser.

## 25.7 Compiler Messages Must Be Plain English

The compiler MUST produce these errors (each has a test in
`tests/arno/diagnostics/`), with file, line, column, a stable code and a
readable sentence:

``` text
escrow.arno(31,22): error A2004: 'deposit' was already moved on line 30 and cannot be used again.
escrow.arno(44,9):  error A2010: Coins value 'payout' is never moved. Coins cannot be dropped.
escrow.arno(52,26): error A3001: Function 'status' is marked view but changes storage.
escrow.arno(18,21): error A3005: 'release' sends coins, but its effects list does not include 'sends coins'.
payroll.arno(60,9): error A4002: This while-loop needs a bound, for example 'at most 100 times'.
escrow.arno(9,9):   error A6005: There is no function named 'Transfer'. Names are case-sensitive: did you mean 'transfer'?
payroll.arno(70,24): error A5001: Implicit conversion from UInt128 to UInt64 is not allowed. Use UInt64(...) with a range check.
payroll.arno(80,9): error A6001: Function 'walk' calls itself. Recursion is not allowed in Arno 0.1.
```

## 25.8 Standard Library

  -----------------------------------------------------------------------
  Unit                    Contents
  ----------------------- -----------------------------------------------
  `Std.Coins`             `AEY`, `ALnT`, registered bridged assets,
                          `Coins of`, `Vault of`, `Transfer`, `Split`,
                          `Join`

  `Std.Auth`              `Signer`, `Signer.Address`, multisig checks

  `Std.Chain`             `Chain.Height`, `Chain.Slot`, `Chain.Epoch`,
                          `Chain.ProtocolTime`, `Chain.TxId`,
                          `Chain.CallingContract`

  `Std.Crypto`            `Blake3`, `VerifyEd25519`, `VerifyBls` (all
                          metered in EU)

  `Std.Identity`          Read-only credential and residence status
                          queries

  `Std.Math`              `MulDiv(A, B, C, RoundDown / RoundUp)`, `Min`,
                          `Max`

  `Std.Text`              Bounded text helpers (length, compare,
                          concatenate within bounds)
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 26. Arno Compiler (`arno`, `arno-compile`, `arno-test`)

``` text
Arno Source (.arno)
    ↓  Lexer            (hand-written, UTF-8 validated, lowercase keywords, case-sensitive names, // and /* */ comments)
    ↓  Parser           (hand-written recursive descent + Pratt for expressions; error recovery)
    ↓  AST              (arena-allocated, immutable after parse)
    ↓  Name resolution  (modules, imports, symbols)
    ↓  Type checker     (+ linearity/borrow checker for resources)
    ↓  Effect checker   (declared vs used effects)
    ↓  Semantic checks  (loop bounds, no recursion, reentrant directive, case-clash check, storage layout)
    ↓  Arno IR (SSA)    (typed, explicit EU cost annotations)
    ↓  Optimizer        (deterministic passes only: const-fold, DCE, CSE; fixed pass order)
    ↓  Codegen          (register allocation → Arno bytecode)
    ↓  Verifier         (the same bytecode verifier the VM runs at deploy time)
    ↓  Package          (.arnobc: header + bytecode + ABI + source hash + compiler version)
```

Hand-written lexer/parser (no ANTLR/Bison) for full control of
plain-English error messages (Section 25.7), determinism and supply
chain. `arno fmt` is the canonical formatter (indentation, keyword
casing, brace alignment); CI rejects unformatted example
contracts.

Reproducibility: same source + same compiler version + same config ⇒
**byte-identical** `.arnobc`. CI builds all examples twice on different
machines/architectures and compares hashes. The compiler must not embed
timestamps, paths, or hash-map iteration order.

`arno-test`: runs Arno unit tests against an in-process test VM with a
deterministic mock chain context (test-only build; not linked into
validators).

------------------------------------------------------------------------

# 27. Arno Bytecode (APS-0014)

Package format:

``` text
ArnoPackage
├── magic "ARNO" u32 | format_version u16 | arno_version u16
├── code_hash          Hash32 (over everything below)
├── constants          list<Constant>          (≤ 4096)
├── types              list<TypeDef>
├── functions          list<FunctionDef{ name_idx, params, returns, n_registers ≤ 255, effects_mask, code_offset, code_len }>
├── storage_layout     list<StorageSlot{ name_idx, type_idx }>
├── abi                list<EntryAbi>
└── code               bytes (≤ 256 KiB)
```

Instruction format (register machine, 32-bit words, little-endian):

``` text
 31        24 23      16 15       8 7        0
┌───────────┬──────────┬──────────┬──────────┐
│  opcode   │    A     │    B     │    C     │     ABC form
├───────────┼──────────┴──────────┴──────────┤
│  opcode   │    A     │       Bx (u16)      │     ABx form (constants, jumps)
└───────────┴──────────┴─────────────────────┘
```

Opcode groups: `MOV/LOADK/LOADI`, checked arithmetic
`ADD_U64/SUB_U64/MUL_U64/DIV_U64/…/ADD_U128…` (trap on overflow),
comparisons, `JMP/JMPIF` (forward jumps + verified back-edges inside
bounded loops only), `CALL/RET`, `SLOAD/SSTORE`,
`ASSET_MOVE/ASSET_SPLIT/ASSET_JOIN/VAULT_*`, `EMIT`, `HOSTCALL id`,
`ABORT code`.

Deploy-time **bytecode verifier** (consensus-critical) rejects: invalid
opcodes, out-of-range registers/constants, jumps into non-instruction
boundaries, back-edges without a verified bound, type-inconsistent
register use, linear-resource leaks on any path, effects exceeding the
declared mask, stack/call depth over limits.

------------------------------------------------------------------------

# 28. Arno VM (APS-0015) **\[CONSENSUS-CRITICAL\] \[DECISION ADR-010\]**

-   **Interpreter only**. No JIT in consensus execution (JITs add
    non-determinism and a large attack surface).
-   Register file per frame (≤ 255 registers), call depth ≤ 16, memory
    per call ≤ 4 MiB, total per tx ≤ 32 MiB.
-   All host interactions through a fixed, versioned host-call table;
    each host call has a documented EU cost.
-   Contracts cannot access the OS, filesystem, network, native memory,
    threads, or clocks.
-   Reentrancy: a contract already on the call stack cannot be
    re-entered unless the routine carries the `reentrant` directive
    (compiler-enforced + VM-enforced).
-   Traps (overflow, abort, OOB, EU exhaustion) revert all state changes
    of the transaction since its checkpoint; fees are still charged; the
    receipt records the trap code.

Dispatch loop with metering:

``` rust
// Phase 0 obligation R.13 (Appendix R): write this interface from the normative text
// of this section, in the style of Sections 3.2, 9 and 15. Preserve the types, invariants,
// ordering and error semantics stated here. Consensus bytes go through ACE, never Serde;
// fallible operations return Result<T, AletheiaError>. Record it in the APS named in
// Appendix R and obtain the listed sign-off before anything depends on it.
```

## 28.1 Out-of-Process Executor Sandbox

aletheia-arno-exec workers (pool size = configurable, default 2) execute
contracts. aletheiad talks to them over a **shared-memory ring**
(memfd + futex) carrying ACE-encoded requests:
`Execute{tx_ctx, entry, args, eu_limit}` → host calls (`storage_read`,
`storage_write`, `emit`, `asset_op`, `crypto_*`) are answered by
aletheiad against the block's `StateOverlay`, so **state authority stays
in the node**; the executor only computes.

Sandbox (applied before loading any bytecode):

``` rust
// Phase 0 obligation R.14 (Appendix R): write this interface from the normative text
// of this section, in the style of Sections 3.2, 9 and 15. Preserve the types, invariants,
// ordering and error semantics stated here. Consensus bytes go through ACE, never Serde;
// fallible operations return Result<T, AletheiaError>. Record it in the APS named in
// Appendix R and obtain the listed sign-off before anything depends on it.
```

The node supervises executors: a per-request wall-clock watchdog (steady
clock) kills a stuck worker (defense against interpreter bugs --- EU
metering is the protocol-level bound), respawns it, and **re-executes
the transaction deterministically in a fresh worker**; repeated failure
on the same tx is a critical bug and fail-stops the node rather than
producing a divergent result.

Performance note: the IPC round-trip per host call is the main cost.
Mitigations (allowed): batch prefetch of declared storage keys, read
caching within a tx, zero-copy ring buffers. Profile before optimizing
(Section 58).

------------------------------------------------------------------------

# 29. Execution Units (APS-0016)

EU replaces gas terminology. Cost table is protocol-versioned data
(`src/vm/cost_table_v1.inc`):

  -----------------------------------------------------------------------
  Operation                                       EU (v1 devnet defaults
                                                  ---
                                                  benchmark-calibrated
                                                  before freeze)
  ----------------------------------------------- -----------------------
  Base instruction                                1

  u128 mul/div                                    4

  Storage read                                    200 + 1/byte

  Storage write (new key)                         5,000 + 10/byte

  Storage write (existing)                        1,500 + 10/byte

  Storage delete                                  500 (partial refund
                                                  policy: none in v0.1
                                                  --- simpler, no refund
                                                  games)

  Contract create                                 20,000 + 50/code byte

  Event emission                                  300 + 5/byte

  Memory growth                                   3 per 32 bytes

  Nested call                                     700

  blake3                                          30 + 1/64 bytes

  ed25519_verify                                  3,000

  bls_verify                                      60,000

  Native transfer (whole tx)                      2,000 flat
  -----------------------------------------------------------------------

Calibration method: benchmark each opcode on the reference validator
hardware; set EU so that `MAX_BLOCK_EU` executes within the execution
window with ≥ 40 % headroom on the slowest supported validator class.
Execution stops deterministically at `eu_used == eu_limit` (checked
*before* performing the metered action).

------------------------------------------------------------------------

# 30. Native vs Arno Functionality

  -----------------------------------------------------------------------
  Native protocol modules (Rust)      Arno applications
  ----------------------------------- -----------------------------------
  Accounts, nonces, authorization     DEXs, AMMs
  schemes                             

  AEY, ALnT, native asset framework   Escrow, payroll, subscriptions

  Monetary policy, supply ledger,     Lending, insurance
  reserve attestations                

  Validator registry, evidence,       Property management
  suspension                          

  Identity, Residence, Land           Utility billing
  registries                          

  Governance, protocol parameters,    Marketplaces
  upgrades                            

  Fees and fee distribution           Enterprise workflows
  -----------------------------------------------------------------------

Consensus-critical functionality is never pushed into contracts. Arno
accesses native modules only through metered, typed host calls with
explicit authorization.

------------------------------------------------------------------------

# 31. Identity Registry (APS-0022)

Native, privacy-preserving. The chain stores **no raw personal documents
or PII**.

``` text
Identity
├── identity_id          Hash32        (random 256-bit, issued off-chain, no PII derivation)
├── controller           Address       (key controlling the identity; rotatable)
├── status               ACTIVE | SUSPENDED | REVOKED
├── issuer_id            IssuerId
├── created_epoch / updated_epoch
└── attributes_commitment Hash32       (salted commitment to off-chain attribute set)

Credential
├── credential_id        Hash32
├── subject              identity_id
├── schema_id            u32           (registered schema)
├── issuer_id
├── commitment           Hash32        (salted hash of credential payload held off-chain)
├── status_list_index    u32           (bit in issuer's revocation bitmap)
├── issued_epoch / expiry_epoch
```

-   Issuers are registered by governance with scoped permissions (which
    schemas they may issue).
-   Revocation via per-issuer **status bitmaps** (compact,
    privacy-preserving batch updates).
-   Sensitive documents live in external encrypted storage; the chain
    holds commitments and proofs only. Selective disclosure / ZK proofs
    are reserved for a later APS; the commitment format must not
    preclude them (salted, per-attribute Merkle commitment).
-   GDPR-style erasure: because only salted commitments are on-chain,
    destroying the off-chain data and salt renders the commitment
    meaningless.

# 32. Residence Registry (APS-0023)

Permissioned at protocol level: only registered **residence issuers**
may create/update entries.

``` text
Residence { residence_id, identity_id, class u16, status (PENDING|ACTIVE|EXPIRED|REVOKED),
            issuer_id, issued_epoch, expiry_epoch, revocation_reason_code u16, history_seq u64 }
```

Expiration is evaluated deterministically against `protocol_time`/epoch,
never wall clock. Every change appends a history entry.

# 33. Land Registry (APS-0024)

``` text
Parcel { parcel_id, geometry_commitment Hash32 (off-chain survey/GIS data), controller_ref (identity_id | Address),
         status (REGISTERED|ENCUMBERED|FROZEN|RETIRED), encumbrances list<Encumbrance{kind, holder, ref_hash, until_epoch}>,
         registry_authority_id, history_seq }
LandHistory (parcel_id, seq) → { op, prior_controller, new_controller, authority_sig_ref, tx_id, epoch }
```

-   Transfers require the controller's authorization **and**, when
    configured per parcel class, the registry authority's co-signature.
-   Encumbered or frozen parcels cannot transfer.
-   The registry records protocol-level control references; it does not
    assert legal title beyond what the protocol can enforce.
-   Full history is retained in state (namespace 36) and provable.

------------------------------------------------------------------------

# 34. Validator Registry (APS-0025)

Operations: `RegisterValidator` (with PoP and bond in ALnT),
`ActivateValidator` (governance approval in v0.1 permissioned phase),
`RotateConsensusKey` (effective next epoch, new PoP),
`RotateTransportCert`, `RequestExit`, `SubmitEvidence`,
`Suspend`/`Reinstate` (governance). Evidence is verified on-chain (two
conflicting signed messages for the same round) and results in automatic
`SUSPENDED` at the next epoch boundary. Bond slashing parameters are
governance-set; v0.1 default: suspension only, slashing disabled until
audited.

------------------------------------------------------------------------

# 35. Governance (APS-0026)

-   Separate module, separate transaction types, never ordinary contract
    code.
-   v0.1 body: a **Governance Council** multisig (M-of-N, keys in HSMs),
    with designated parameter scopes.
-   Proposal lifecycle:
    `SUBMITTED → VOTING → APPROVED/REJECTED → TIMELOCKED → EXECUTED/EXPIRED`.
-   Timelocks by class: parameter change ≥ 1 epoch; monetary capacity
    change ≥ 4 epochs; protocol upgrade ≥ 8 epochs; emergency validator
    suspension: 0 (but requires higher threshold and auto-expires unless
    ratified).
-   **Only explicitly designated parameters are governable** (registry
    in APS-0026). There is no "arbitrary state write" proposal type.
    Governance cannot move user balances.
-   Every privileged operation is explicit, authenticated, emitted as an
    event, and constrained by bounds encoded in the parameter registry.

------------------------------------------------------------------------

# 36. P2P Architecture (APS-0029) **\[DECISION ADR-016\]**

Transport: TCP + **TLS 1.3 mutual authentication** (rustls).
Validator certificates are pinned to `transport_cert_hash` in the
validator registry; the TLS handshake is followed by an application
handshake signed with the node identity key (binds TLS session to
protocol identity, prevents relay).

Framing:

``` text
Frame: u32 length | u16 channel | u16 msg_type | u32 request_id | payload (ACE, optionally zstd for SYNC channels)
Max frame: 8 MiB (consensus), 16 MiB (sync), 256 KiB (tx gossip)
```

Channels (separate queues, priorities, bandwidth budgets):

  ------------------------------------------------------------------------
  Channel               Priority                   Content
  --------------------- -------------------------- -----------------------
  0 CONSENSUS           Highest (strict priority)  Proposals, votes,
                                                   timeouts, QCs/TCs

  1 BLOCK_PROP          High                       Finalized block
                                                   announcements/bodies

  2 TX_GOSSIP           Normal                     Tx hash announcements,
                                                   tx bodies

  3 STATE_SYNC          Low                        JMT chunks with proofs

  4 SNAPSHOT_SYNC       Low                        Snapshot chunks

  5 MGMT                Low                        Peer exchange, pings,
                                                   version
  ------------------------------------------------------------------------

Topology: validators maintain a full mesh among themselves over
dedicated links (sentry architecture: validators are not exposed
publicly; public peers connect to sentry full nodes). Full nodes use
bounded random peering (default 16 outbound, 64 inbound).

Controls: version negotiation (supported protocol version ranges),
per-peer token-bucket rate limits per channel, message size limits,
replay protection (request IDs + domain-separated signed consensus
messages with round binding), peer scoring (invalid message −100,
timeout −5, useful +1), quarantine/ban with decay, connection limits per
IP/subnet, and a hard cap on pending inbound handshakes (slowloris
defense).

------------------------------------------------------------------------

# 37. RPC / API --- REST and JSON-RPC 2.0 (APS-0028, APS-0047)

Two public interfaces over one shared service layer: **REST** under
`/api/v1/` and **JSON-RPC 2.0** under `/rpc/v1` (both on Axum + Hyper,
both with WebSocket subscriptions). Internal admin/signer/executor
control uses gRPC on separate, non-public interfaces.

## 37.1 REST (`/api/v1/`)

  -----------------------------------------------------------------------------------------------
  Category                        Endpoints
  ------------------------------- ---------------------------------------------------------------
  Network                         `GET /network/status`, `GET /network/peers` (admin)

  Chain                           `GET /chain/head`, `GET /chain/finalized`, `GET /chain/params`

  Blocks                          `GET /blocks/{AL:B…}`, `GET /blocks/height/{h}`,
                                  `GET /blocks/{AL:B…}/finality`

  Transactions                    `POST /transactions` (submitTransaction),
                                  `GET /transactions/{AL:T…}`, `POST /transactions/simulate`

  Accounts                        `GET /accounts/{AL:…}`, `GET /accounts/{AL:…}/balances`,
                                  `GET /accounts/{AL:…}/nonce`

  Assets / Monetary               `GET /assets`, `GET /monetary/{asset}/supply` (full ledger +
                                  proof)

  Validators                      `GET /validators`, `GET /validators/set/{epoch}`

  Contracts                       `GET /contracts/{AL:…}`, `POST /contracts/{AL:…}/view`

  Receipts / Events               `GET /receipts/{AL:T…}`,
                                  `GET /events?contract=&type=&from_height=&to_height=&cursor=`

  State                           `GET /state/root/{height}`, `GET /state/proof?key=&height=`

  Identity / Residence / Land     `GET /identity/{id}`, `GET /residence/{id}`,
                                  `GET /land/{parcel_id}` (+ history)

  Bridge                          `GET /bridge/routes`, `GET /bridge/transfers/{message_id}`
  -----------------------------------------------------------------------------------------------

Example:

``` http
GET /api/v1/transactions/AL:Tq9x...k3 HTTP/1.1
```

``` json
{
  "tx_id": "AL:Tq9x...k3",
  "status": "FINALIZED",
  "block": { "height": 1048576, "id": "AL:Bqk7r...m2x", "slot": 2097153 },
  "sender": "AL:qz7m...l0e",
  "type": "Transfer",
  "transfer": { "recipient": "AL:qv3r...8ha", "asset": "AEY", "amount": "125000000000000000000", "amount_display": "125.000000000000000000" },
  "fee": { "asset": "AEY", "charged": "2100000000000000", "eu_used": 2100 },
  "receipt": { "status": "SUCCESS", "error_code": 0, "events": 1 },
  "proof": { "receipt_proof": "9f3c…e1a0", "finality_proof_ref": "/api/v1/blocks/AL:Bqk7r...m2x/finality" }
}
```

Rules: all `u128` values as decimal strings; strict input size and JSON
depth limits; cursor pagination (max 1,000 items); per-API-key and
per-IP rate limits; CORS off by default; no secrets ever returned;
versioned --- breaking changes only in `/api/v2/`, with deprecation
headers for ≥ 2 releases. OpenAPI 3.1 spec is generated and checked into
`docs/rpc/openapi.yaml`, and conformance-tested.

## 37.2 JSON-RPC 2.0 (APS-0047) **\[DECISION ADR-020\]**

JSON-RPC 2.0 is a first-class public interface alongside REST. Both are
thin adapters over the **same service layer** (`ChainQueryService`,
`TransactionService`, `StateService`, `MonetaryService`,
`RegistryService`, `BridgeService`), so behavior, validation, limits and
errors are identical whichever interface a client uses. No business
logic lives in either adapter.

Transport:

  -----------------------------------------------------------------------
  Endpoint                                      Use
  --------------------------------------------- -------------------------
  `POST /rpc/v1` (HTTPS,                        Requests, notifications,
  `Content-Type: application/json`)             batches

  `GET /rpc/v1/ws` (WebSocket upgrade)          Same methods plus
                                                subscriptions
  -----------------------------------------------------------------------

Protocol rules (strict JSON-RPC 2.0):

-   `"jsonrpc": "2.0"` required; `id` is a string or integer (no
    fractions, no `null` for requests); requests without `id` are
    notifications and get no response.
-   **Named parameters only** (`params` is an object). Positional arrays
    are rejected with `-32602`, so adding optional parameters never
    breaks clients.
-   Batches: ≤ 50 calls and ≤ 1 MiB per batch; each call is rate-limited
    individually; responses may be returned in any order and are matched
    by `id`.
-   Value encoding follows Section 12.2: `AL:` / `AL:T` / `AL:B`
    identifiers, unprefixed lowercase base16 for other binary values,
    decimal strings for all amounts. Any `0x`-prefixed value is rejected
    with `-32602`.
-   Method names are Aletheia's own lowerCamelCase verbs (no foreign
    prefixes).
-   The machine-readable description is an **OpenRPC** document at
    `docs/rpc/openrpc.json`, generated from the method registry and
    contract-tested in CI; `rpc.discover` returns it.

Methods (v1):

  -----------------------------------------------------------------------------------------------------------------------------
  Method                  Params                                                      Result
  ----------------------- ----------------------------------------------------------- -----------------------------------------
  `getNetworkStatus`      ---                                                         chain id, network, protocol version,
                                                                                      peers, sync state, finalized height

  `getChainHead` /        ---                                                         latest / latest finalized block summary
  `getFinalizedHead`                                                                  

  `getChainParams`        ---                                                         protocol parameters in force

  `getBlock`              `{ block: "AL:B…" }`                                        header + tx IDs

  `getBlockByHeight`      `{ height }`                                                header + tx IDs

  `getFinalityProof`      `{ block: "AL:B…" }`                                        2-chain finality proof

  `submitTransaction`     `{ tx: "<base16 ACE bytes>" }`                              `{ txId: "AL:T…", status: "ACCEPTED" }`

  `simulateTransaction`   `{ tx }`                                                    eu_used, fee, effects, receipt preview

  `getTransaction`        `{ txId: "AL:T…" }`                                         transaction + status

  `getReceipt`            `{ txId }`                                                  receipt + receipt proof

  `getAccount`            `{ address: "AL:…" }`                                       nonce, auth scheme, flags

  `getBalance`            `{ address, asset }`                                        available, locked, display

  `getEvents`             `{ emitter?, eventType?, fromHeight, toHeight, cursor? }`   events page + next cursor

  `getStateRoot`          `{ height }`                                                state root

  `getStateProof`         `{ key, height }`                                           value + JMT proof

  `getValidatorSet`       `{ epoch? }`                                                ordered validator set

  `getAssets`             ---                                                         native and bridged assets

  `getMonetarySupply`     `{ asset }`                                                 full supply ledger + proof

  `callContractView`      `{ contract, function, args }`                              view-function result (read-only, metered)

  `getIdentity` /         `{ id }`                                                    registry record (+ history for land)
  `getResidence` /                                                                    
  `getLandParcel`                                                                     

  `getBridgeRoutes`       ---                                                         routes, status, limits, usage

  `getBridgeTransfer`     `{ messageId }`                                             bridge message status on both sides

  `subscribe` /           `{ topic, filter? }` / `{ subscription }`                   subscription id / `true`
  `unsubscribe`                                                                       
  -----------------------------------------------------------------------------------------------------------------------------

Subscription topics (WebSocket only): `finalizedBlocks`,
`transactionStatus` (filter by `txId`), `events` (filter by
emitter/eventType), `bridgeTransfers` (filter by route). Notifications
use method `subscription` with `{ subscription, result }`.

Errors:

  -----------------------------------------------------------------------
  Code                      Meaning
  ------------------------- ---------------------------------------------
  -32700                    Parse error

  -32600                    Invalid request

  -32601                    Method not found

  -32602                    Invalid params (includes `0x`-prefixed
                            values, wrong identifier network, positional
                            params)

  -32603                    Internal error (never leaks internals)

  -32001                    Rate limited

  -32002                    Not found

  -32003                    Not yet finalized

  -32010                    Transaction rejected --- `data.code` /
                            `data.name` carry the protocol `ErrorCode`

  -32011                    Simulation failed --- `data` carries the
                            trap/error code

  -32020                    Bridge route paused or limit reached
  -----------------------------------------------------------------------

Example:

``` json
{ "jsonrpc": "2.0", "id": 7, "method": "getBalance",
  "params": { "address": "AL:qz7m...l0e", "asset": "AEY" } }
```

``` json
{ "jsonrpc": "2.0", "id": 7,
  "result": { "address": "AL:qz7m...l0e", "asset": "AEY",
              "available": "125000000", "locked": "0", "display": "125.000000",
              "height": 1048576 } }
```

``` json
{ "jsonrpc": "2.0", "id": 9,
  "error": { "code": -32010, "message": "Transaction rejected",
             "data": { "code": 2003, "name": "TX_NONCE_TOO_LOW", "expected_nonce": "42" } } }
```

Dispatcher shape:

``` rust
// Phase 0 obligation R.15 (Appendix R): write this interface from the normative text
// of this section, in the style of Sections 3.2, 9 and 15. Preserve the types, invariants,
// ordering and error semantics stated here. Consensus bytes go through ACE, never Serde;
// fallible operations return Result<T, AletheiaError>. Record it in the APS named in
// Appendix R and obtain the listed sign-off before anything depends on it.
```

Tests: every method has success, invalid-params, not-found and
rate-limit tests; batch and notification semantics tests; REST vs
JSON-RPC **parity tests** (same query through both → identical data);
fuzzing of the JSON-RPC parser (depth ≤ 32, size limits); OpenRPC
contract tests.

------------------------------------------------------------------------

# 38. Transaction Receipts (APS-0031)

``` text
Receipt
├── tx_id              Hash32
├── height             u64
├── index_in_block     u32
├── status             SUCCESS | FAILED_EXECUTION | FAILED_VM_TRAP | OUT_OF_EU
├── error_code         u32 (ErrorCode, 0 on success)
├── eu_used            u64
├── fee_charged        {asset_id u32, amount u128}
├── write_set_hash     Hash32   (commitment to the tx's ordered state changes)
├── events             list<Event>   (≤ 256 per tx)
└── return_data        bytes ≤ 4 KiB
receipt_hash = H_domain(..., ace(Receipt)); receipt_root = Merkle(receipt_hash[])
```

Receipts are deterministic, contain no timestamps other than
protocol-derived values, and no node-local data.

# 39. Events and Logs (APS-0032)

``` text
Event { emitter Address, event_type Hash32 (= H(schema name)), topics list<Hash32> (≤ 4), data bytes ≤ 8 KiB }
```

Events are bounded, deterministic, committed via `event_root` and
`receipt_root`, indexed (RocksDB index CF by
`(emitter, event_type, height, index)` and by topic), and queryable via
RPC. "Logs" in the protocol sense = events; node operational logs are a
separate system (Section 45) and never enter consensus.

------------------------------------------------------------------------

# 40. ISO 20022 Gateway (APS-0027)

A separate service (`aletheia-gateway`, Rust, own host/zone) --- an
**integration boundary**, not a bank. It is one component of the
Aletheia Payment Network (Section 40B), which defines the participants,
schemes, messaging, settlement and external rails around it. Supporting
ISO 20022 parsing does not make the blockchain a payment institution.

Supported messages (v0.1): `pacs.008` (credit transfer), `pacs.002`
(status report), `pacs.004` (return), `camt.053`/`camt.054`
(statements/notifications), `pain.001` (initiation), `pain.002`.

Pipeline:

``` text
inbound (mTLS, counterparty cert pinned)
  → size/format guard (≤ 1 MiB, XML only, DTD/XXE disabled, entity expansion off)
  → XSD schema validation (quick-xml + XML schema validation at the gateway boundary, with hardened parser configuration, pinned schema versions)
  → counterparty authentication + message signature (if provided)
  → idempotency check (MsgId/EndToEndId in PostgreSQL, unique constraints)
  → compliance hooks (sanctions screening/AML adapters — pluggable, fail-closed)
  → deterministic mapping → protocol operation (Transfer / Mint-with-authorization / Redeem settlement)
  → sign with gateway operator key (HSM), per-counterparty limits enforced
  → submit → track finality → emit pacs.002 / camt.054 back
  → append-only audit record (hash-chained) at every step
```

Gateway audit ledger (PostgreSQL):

``` sql
CREATE TABLE gateway_audit (
    seq            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    occurred_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    counterparty   TEXT        NOT NULL,
    msg_type       TEXT        NOT NULL,              -- e.g. 'pacs.008.001.10'
    msg_id         TEXT        NOT NULL,
    end_to_end_id  TEXT,
    stage          TEXT        NOT NULL,              -- RECEIVED|VALIDATED|SCREENED|MAPPED|SUBMITTED|FINALIZED|REJECTED
    tx_id          TEXT,                              -- 'AL:T…' once submitted
    payload_zstd   BYTEA       NOT NULL,              -- zstd-compressed original message
    payload_sha256 BYTEA       NOT NULL,
    prev_hash      BYTEA       NOT NULL,
    record_hash    BYTEA       NOT NULL,              -- sha256(prev_hash || canonical row fields)
    UNIQUE (counterparty, msg_id, stage)
);
REVOKE UPDATE, DELETE ON gateway_audit FROM PUBLIC;   -- append-only; enforced also by trigger
```

The mapping from an external instruction to protocol operations is
deterministic and versioned; every mapping version has golden test
vectors.

------------------------------------------------------------------------

# 40A. Public Stablechain Bridge (APS-0046) **\[CONSENSUS-CRITICAL\] \[DECISION ADR-022\]**

Goal: let AEY move out to other public blockchains and stablechains, and
let their stablecoins come in --- without trusting any single party, and
without making Aletheia's own safety depend on any remote chain.

## 40A.1 Principles

1.  The bridge is a **native Rust protocol module** (`src/bridge/`),
    never an Arno contract.
2.  The remote side is an endpoint program written in each remote
    chain's own language and toolchain, kept in `bridges/<chain>/`, and
    audited separately. Remote conventions stay on the remote side;
    Aletheia's protocol, formats and tooling never adopt them (no `0x`,
    no EVM semantics).
3.  **Blast radius is capped per route**: a compromised or halted remote
    chain can at most affect assets bridged through that route, bounded
    by the route's limits.
4.  **Relayers are permissionless and untrusted**: they only carry
    proofs; they cannot forge, alter or redirect a transfer. Anyone can
    relay, so censorship by one relayer cannot block a transfer.
5.  **Exactly-once**: every message has a unique ID and per-route
    sequence; a message is consumed once or never.
6.  Bridged foreign stablecoins are **separate assets** with their own
    supply ledgers. They are never silently merged with AEY.
7.  No route is enabled without governance approval, an external audit
    of both sides, and passing the route test suite (Section 40A.11).

## 40A.2 Candidate Routes

Candidate targets are public chains that carry widely used stablecoins
or are themselves payment stablechains. **Availability, finality
characteristics and issuer terms must be verified at integration time**;
nothing below is enabled by default.

  -------------------------------------------------------------------------
  Route class       Examples (candidates)       Default verification
  ----------------- --------------------------- ---------------------------
  BFT chains with   Noble (native USDC), other  Tier A --- light client
  IBC-style light   Cosmos chains               
  clients                                       

  EVM chains and    Ethereum, Arbitrum, Base,   Tier B --- guardian quorum
  rollups carrying  Polygon                     after remote finality; Tier
  USDC / USDT                                   B+ where the issuer offers
                                                a burn-and-mint attestation
                                                service (e.g. Circle CCTP
                                                for USDC)

  Payment-focused   Plasma, Arc, Tempo,         Tier A where a light client
  stablechains      Stellar, Tron               is feasible, otherwise Tier
                                                B

  Other             Solana                      Tier B (Tier A when a
  high-throughput                               verifiable light client is
  chains                                        available)
  -------------------------------------------------------------------------

## 40A.3 Verification Tiers

  --------------------------------------------------------------------------------------------------
  Tier          How a remote event is proven on Aletheia                         Notes
  ------------- ---------------------------------------------------------------- -------------------
  **A --- Light Aletheia verifies the remote chain's headers, finality proofs    Strongest;
  client**      and Merkle inclusion proofs on-chain (header updates submitted   preferred
                by anyone via `UpdateLightClient`)                               

  **B ---       A registered **Bridge Guardian** set (N ≥ 7, threshold ≥ ⌈2N/3⌉) Guardians are
  Guardian      signs                                                            independent
  quorum**      `H_domain("ALETHEIA/BRIDGE-ATTEST/v1", message_id ‖ route_id)`   operators in
                with BLS12-381; the aggregate + signer bitmap is verified        different
                on-chain                                                         jurisdictions; each
                                                                                 runs its own
                                                                                 remote-chain full
                                                                                 node and signs only
                                                                                 after the route's
                                                                                 `finality_depth`;
                                                                                 keys in HSMs

  **B+ ---      Tier B **and** the stablecoin issuer's own attestation are both  Used where the
  Guardians +   required                                                         issuer runs a
  issuer**                                                                       burn-and-mint
                                                                                 protocol
  --------------------------------------------------------------------------------------------------

Outbound (Aletheia → remote): the remote endpoint verifies Aletheia
**finality proofs** (aggregate-BLS QCs against the Aletheia validator
set it tracks) where the remote chain can afford BLS12-381 pairing
checks; otherwise it verifies the guardian quorum.

Guardians use their own signer with double-sign protection per
`(route, direction, sequence)`: two different attestations for the same
sequence are cryptographic evidence, automatically pause the route and
trigger guardian suspension.

## 40A.4 Flows

``` text
OUTBOUND AEY  (Aletheia → remote chain)
  1. User: BridgeOut{route, remote_recipient, asset=AEY, amount, max_fee}
  2. Aletheia: AEY moves from the user into bridge escrow (ledger bucket bridge_escrow);
     BridgeMessage stored in state with the next outbound sequence; event BridgeOutInitiated
  3. After Aletheia finality: any relayer carries FinalityProof + state proof of the message to the remote endpoint
  4. Remote endpoint verifies and mints its bridged representation of AEY, 1:1

RETURN AEY  (remote chain → Aletheia)
  1. Holder burns the remote representation on the remote chain
  2. Relayer submits BridgeIn{message, proof} on Aletheia
  3. Aletheia verifies (Tier A/B/B+), enforces limits, releases AEY from bridge escrow to the recipient

INBOUND FOREIGN STABLECOIN  (e.g. USDC on route 3 → Aletheia)
  1. Holder locks (or issuer-burns) the stablecoin on the remote chain
  2. Relayer submits BridgeIn on Aletheia; after verification Aletheia mints the bridged asset
     registered for that route (its own AssetId, e.g. "USDC · route 3"), 1:1
  3. Going back: BridgeOut burns the bridged asset on Aletheia; the remote endpoint releases the original
```

Why AEY is **locked, not burned**, on the way out: the full AEY supply
stays accountable on Aletheia (escrow is part of outstanding supply), so
the reserve ratio (I9) covers remote holders too, and a remote-chain
failure cannot silently change AEY's issued totals.

## 40A.5 Message Format

``` text
BridgeMessage
├── version          u16
├── message_id       Hash32 = H_domain("ALETHEIA/BRIDGE-MSG/v1", ace(all fields below))
├── source_chain     u32   (RemoteChainId; Aletheia itself = 0)
├── dest_chain       u32
├── route_id         u32
├── sequence         u64   (strictly +1 per route and direction)
├── kind             u8    (1 = LockAndMint, 2 = BurnAndRelease, 3 = BurnAndMint)
├── asset_id         u32   (Aletheia AssetId)
├── remote_token     bytes ≤ 64   (raw bytes; unprefixed base16 in text)
├── sender           bytes ≤ 64
├── recipient        bytes ≤ 64   (raw bytes; layout given by the route's address_format)
├── amount           u128  (Aletheia base units)
├── fee              u128
└── expiry_slot      u64
```

Decimal conversion between Aletheia base units and remote token units is
**exact only**: an amount that cannot convert without remainder is
rejected (no rounding, no dust).

## 40A.6 Route Configuration (governance-controlled state)

``` toml
# Governance proposal payload (illustrative)
[route]
route_id                    = 3
remote_chain_id             = 101
remote_chain_kind           = "evm"            # evm | cosmos-ibc | solana | stellar | tron | other
address_format              = "raw20"          # recipient byte layout on the remote chain
verification                = "guardians+issuer"   # light-client | guardians | guardians+issuer
finality_depth              = 64               # remote finality requirement before guardians sign
assets = [
  { asset = "AEY", direction = "both",    remote_token = "5f2a…c9e1" },
  { asset = "USDC",  direction = "inbound", remote_token = "a0b8…eb48", aletheia_asset_id = 1003 },
]
per_tx_max                  = "1000000000000"      # base units
per_epoch_max               = "50000000000000"
global_exposure_max         = "500000000000000"
large_transfer_threshold    = "100000000000"
large_transfer_delay_epochs = 1
fee_bps                     = 5
status                      = "active"             # active | paused | retired
```

## 40A.7 Execution (inbound)

``` rust
// Phase 0 obligation R.16 (Appendix R): write this interface from the normative text
// of this section, in the style of Sections 3.2, 9 and 15. Preserve the types, invariants,
// ordering and error semantics stated here. Consensus bytes go through ACE, never Serde;
// fallible operations return Result<T, AletheiaError>. Record it in the APS named in
// Appendix R and obtain the listed sign-off before anything depends on it.
```

## 40A.8 Safety Controls

-   **Limits**: per-transaction, per-epoch and global exposure caps per
    route and asset.
-   **Large transfers**: above `large_transfer_threshold`, settlement
    waits `large_transfer_delay_epochs`. During the window a guardian
    quorum or the governance council may `FlagBridgeMessage`, which only
    **holds** the message for governance review; it can never redirect
    funds.
-   **Route pause**: guardian quorum or governance council can pause a
    route. A pause only stops **new** bridge messages; it never freezes
    or moves balances already on Aletheia. Pauses auto-expire after a
    governed number of epochs unless ratified, and are evented.
    Pause/resume are listed privileged operations (Section 51).
-   **Automatic pause**: conflicting attestations or proofs for the same
    sequence, a remote reorg deeper than `finality_depth`, or a
    light-client verification failure pauses the route.
-   **Guardian set changes**: governance timelock; suspension on
    evidence; keys rotated through the same ceremony rules as validator
    keys.

## 40A.9 Supply Invariants (added to Section 18.4)

``` text
I10  bridge_escrow(AEY) = Σ outbound AEY locked − Σ inbound AEY released     (per route and total)
I11  for every bridged asset B on route R:
       outstanding(B) ≤ Σ verified remote locks(R, B) − Σ verified releases(R, B)
I12  per-route flows in the current epoch ≤ per_epoch_max, and exposure ≤ global_exposure_max
```

Violations follow Section 18.4: refuse to vote on a violating block;
fail-stop if ever observed on finalized state.

## 40A.10 Transaction Types and State

  -----------------------------------------------------------------------
  Tag                          Type
  ---------------------------- ------------------------------------------
  112                          `BridgeOut`

  113                          `BridgeIn`

  114                          `SettleDelayedBridgeMessage`

  115                          `FlagBridgeMessage` (guardian quorum /
                               governance)

  116                          `PauseBridgeRoute` / 117
                               `ResumeBridgeRoute`

  118                          `RegisterGuardianSet` (governance,
                               timelocked)

  119                          `UpdateLightClient` (anyone; header +
                               finality proof of a remote chain)
  -----------------------------------------------------------------------

State namespaces 96 (routes), 97 (messages: pending / consumed /
flagged), 98 (bridged asset registry), 99 (light-client state per remote
chain).

## 40A.11 Components, Interfaces, Tests

-   `aletheia-bridge-relayer` --- untrusted, open-source, anyone can
    run; watches both sides and submits proofs.
-   `aletheia-guardian` --- guardian daemon: runs its own remote-chain
    full node client, signs attestations through an HSM-backed signer
    with double-sign protection.
-   RPC: `getBridgeRoutes`, `getBridgeTransfer` (REST and JSON-RPC) and
    the `bridgeTransfers` subscription.
-   Metrics: `bridge_escrow{asset}`,
    `bridge_flow_total{route,direction}`, `bridge_pending{route}`,
    `bridge_guardian_latency_ms`, `bridge_route_status{route}`.
-   Tests (all mandatory before a route is enabled): local devnets of
    each remote chain in the integration environment; forged proofs,
    replay, wrong destination, sequence gaps, decimal mismatch, expired
    messages, limit breaches, paused routes, guardian equivocation,
    remote reorgs within and beyond `finality_depth`, relayer censorship
    (a second relayer completes the transfer), large-transfer delay and
    flag paths; property tests for I10--I12 under random bridge flows;
    fuzzing of `BridgeMessage` decoding and every proof verifier;
    external audit of both sides per route; public bug bounty before
    mainnet routes open.

------------------------------------------------------------------------

# 40B. Aletheia Payment Network (APN) **\[CONSENSUS-CRITICAL for on-chain parts\] \[DECISION ADR-026, ADR-027, ADR-028\]**

The Aletheia Payment Network (APN) is Aletheia's **native payment and
financial-messaging network**: its participant directory, secure
messaging, payment schemes, on-chain AEY settlement, reconciliation and
adapters to external financial systems. APN is not SWIFT, Fedwire, SEPA
or a replacement for them; it is designed to interoperate with such
systems through authorized institutions and regulated access
arrangements.

APN payment processing is digital and message-based. Physical AEY
banknotes exist as a separate bearer-money form governed by Section
18.6; cash transactions are not represented as APN payment messages or
recorded as personal on-chain histories.

``` text
                ┌──────────────── OUTSIDE WORLD ────────────────┐
                │ Partner & correspondent banks (SWIFT MX / ISO │
                │ 20022), instant schemes via partner PSPs,     │
                │ card issuing partner, mobile money, public    │
                │ stablechains (bridge, Section 40A)            │
                └───────┬──────────────────┬───────────────┬────┘
                        │ ISO 20022 / mTLS │ partner APIs  │ bridge proofs
                        ▼                  ▼               ▼
┌─────────────────────────────── APN SERVICE LAYER ─────────────────────────────┐
│ ISO 20022 Gateway (40) │ External Rail Adapters │ FX Desk Adapter │ Bridge (40A)│
│ APN Messaging (secure, store-and-forward, E2E encrypted, on-chain anchored)    │
│ Compliance: screening · Travel Rule · limits by KYC tier · case management     │
│ Participant APIs: ISO 20022, REST, JSON-RPC, webhooks, sandbox, certification  │
└─────────────────────────────────────┬─────────────────────────────────────────┘
                                      ▼  signed protocol transactions
┌──────────────────────────── ALETHEIA STABLECHAIN (on-chain) ──────────────────┐
│ Participant Directory │ Payment instructions & mandates │ Settlement in AEY │
│ Proxy (alias) registry │ Returns / recalls │ Message anchors │ Scheme rules    │
└───────────────────────────────────────────────────────────────────────────────┘
```

## 40B.1 What SWIFT Does, and Where APN Covers It

  ----------------------------------------------------------------------------
  Function                SWIFT world                        APN
  ----------------------- ---------------------------------- -----------------
  Institution identity    BIC                                **Aletheia
                                                             Institution Code
                                                             (AIC)** + LEI +
                                                             BIC mapping
                                                             (40B.2)

  Account addressing      IBAN, account numbers              `AL:` addresses +
                                                             **Aletheia
                                                             Account Number
                                                             (AAN)** + proxy
                                                             aliases (40B.3)

  Messaging               FIN (MT), MX (ISO 20022)           ISO 20022 MX
                                                             natively, E2E
                                                             encrypted,
                                                             on-chain anchored
                                                             (40B.4)

  Payment tracking        gpi / UETR                         UETR carried
                                                             end-to-end and
                                                             linked to `AL:T`
                                                             (40B.5)

  Settlement              Correspondent banking, RTGS        **Final on-chain
                                                             settlement in
                                                             AEY**, 24/7,
                                                             seconds (40B.6)

  Schemes                 Bank rulebooks                     APN Scheme
                                                             Rulebook: instant
                                                             credit transfer,
                                                             request-to-pay,
                                                             direct debit,
                                                             bulk, returns
                                                             (40B.7)

  Connectivity to others  Direct membership                  Partner banks,
                                                             instant schemes,
                                                             cards, bridges
                                                             (40B.8)

  Compliance              Screening, Travel Rule             Built into the
                                                             flow, fail-closed
                                                             (40B.9)
  ----------------------------------------------------------------------------

## 40B.2 Participant Directory (on-chain, native module)

Every institution that sends or receives on APN is a registered
**participant**.

``` text
Participant                                   (state namespace 100)
├── aic                 Text[11]    Aletheia Institution Code (format below)
├── legal_name_hash     Hash        (full legal record held off-chain; commitment on-chain)
├── lei                 Optional Text[20]   (ISO 17442)
├── bic                 Optional Text[11]   (if the institution has one)
├── role                enum: DIRECT_PARTICIPANT | INDIRECT_PARTICIPANT | GATEWAY_OPERATOR
│                             | EXTERNAL_RAIL_OPERATOR | FX_PROVIDER | GOVERNMENT_AGENCY
│                             | LIQUIDITY_PROVIDER | TECHNICAL_SERVICE_PROVIDER
├── sponsor_aic         Optional    (indirect participants settle through a direct participant)
├── settlement_address  Address     (AL: account holding the participant's AEY)
├── messaging_keys      list<{alg, public_key, valid_from_epoch, valid_to_epoch}>
├── schemes             bitset      (which APN schemes it is certified for)
├── limits              {per_payment_max, daily_out_max, daily_in_max}
├── status              APPLIED | CERTIFIED | ACTIVE | SUSPENDED | TERMINATED
└── certified_epoch, updated_epoch
```

**AIC format** (8 or 11 characters, deliberately BIC-shaped so bank
systems accept it in the same fields):

``` text
AAAA  CC  LL  [BBB]
│     │   │    └─ optional branch / unit code
│     │   └────── location code
│     └────────── Aletheia territory code (see note below)
└──────────────── institution code
```

**Country-code note (important):** `AL` is **Albania's** ISO 3166-1
code. Aletheia's prefixes are split by where they appear:

  -----------------------------------------------------------------------
  Where            Prefix / code                            Why
  ---------------- ---------------------------------------- -------------
  Protocol         `AL:`, `AL:T`, `AL:B`                    Aletheia's
  addresses and                                             own format;
  IDs                                                       never parsed
                                                            as an ISO
                                                            country code

  Account numbers  **`ALX`**                                Aletheia's
  (AAN)                                                     IBAN-style
                                                            number; the
                                                            `X`
                                                            guarantees no
                                                            IBAN
                                                            validator
                                                            accepts it as
                                                            Albanian

  ISO country      A 2-letter code from the ISO 3166        These fields
  fields (AIC      **user-assigned range** `XA`--`XZ`,      accept
  positions 5--6,  fixed by governance (proposal: **`XL`**) exactly two
  ISO 20022                                                 letters, so
  `Ctry`,                                                   `ALX` cannot
  `CtryOfRes`,                                              go there, and
  postal                                                    `AL` would
  addresses)                                                mean Albania
  -----------------------------------------------------------------------

The user-assigned code is not an internationally recognized country
code. Partner banks must agree to accept it in the messages they
exchange with APN; where a partner will not, the gateway fills the field
according to that partner's agreed mapping.

Onboarding: application → KYB/due diligence (off-chain, recorded as a
credential commitment) → technical certification (40B.10) → governance
approval → ACTIVE. Suspension is immediate by governance vote for cause
and is evented.

## 40B.3 Addressing People and Businesses

A sender should never need to type a 62-character address.

  --------------------------------------------------------------------------------------------------
  Identifier                  Use              Resolution
  --------------------------- ---------------- -----------------------------------------------------
  `AL:` address               Canonical        ---
                              protocol         
                              identity         

  **AAN --- Aletheia Account  Human-friendly   On-chain AAN → `AL:` mapping (namespace 101)
  Number**                    account number   
                              for forms,       
                              invoices and     
                              external         
                              systems: `ALX` + 
                              2 check digits + 
                              16 digits, ISO   
                              7064 MOD 97-10   
                              check (the IBAN  
                              check algorithm; 
                              an AAN is        
                              **not** an IBAN) 
                              --- see 40B.3.1  

  **Proxy aliases**           Phone number,    Privacy-preserving proxy registry (namespace 102):
                              email, residence the chain stores `H(salt ‖ normalized_alias)` →
                              ID, business     `AL:`; only authorized participants can resolve, with
                              registration     rate limits and audit
                              number,          
                              `@handle`        

  Virtual IBANs               Receiving from   Issued by partner banks per customer or per
                              outside banking  participant; mapped to AAN in the gateway (never
                              systems          claimed as Aletheia IBANs)

  Payment QR                  In-person and    `aletheia:pay?to=AL:…&amount=12.50&asset=AEY&ref=…`
                              merchant         (payee name shown from the directory, never from the
                              payments         QR alone)
  --------------------------------------------------------------------------------------------------

### 40B.3.1 AAN Format --- `ALX`

``` text
ALX 47 1234 5678 9012 3456
│   │  └──────────────────── 16-digit account number (first 4 digits = participant routing code)
│   └─────────────────────── 2 check digits (ISO 7064 MOD 97-10)
└─────────────────────────── ALX = Aletheia account prefix
Stored / electronic form (no spaces): ALX471234567890123456 — 21 characters
(check digits in these examples are illustrative)
Printed / displayed form: groups of four after the prefix, as above
```

Check-digit rule (same arithmetic as IBAN): move `ALX` + check digits to
the end, replace letters with numbers (A = 10 ... Z = 35), and the
resulting integer mod 97 must equal 1.

``` rust
// crates/apn/src/aan.rs

/// Aletheia Account Number: "ALX" + 2 check digits + 16 digits (Section 40B.3.1).
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct Aan([u8; 21]);   // ASCII, electronic form, validated

impl Aan {
    pub fn parse(input: &str) -> Result<Aan, AletheiaError> {
        // People paste numbers with spaces from invoices; spaces are the only thing we forgive.
        let compact: String = input.chars().filter(|c| *c != ' ' && *c != '\u{2009}').collect();
        let bytes = compact.as_bytes();
        if bytes.len() != 21 || &bytes[..3] != b"ALX" || !bytes[3..].iter().all(u8::is_ascii_digit) {
            return Err(AletheiaError::new(ErrorCode::ApnAanMalformed,
                format!("\"{input}\" is not an AAN (expected ALX + 18 digits)")));
        }
        if mod97(bytes) != 1 {
            return Err(AletheiaError::new(ErrorCode::ApnAanCheckDigits,
                format!("check digits of {compact} do not match")));
        }
        let mut raw = [0u8; 21];
        raw.copy_from_slice(bytes);
        Ok(Aan(raw))
    }

    pub fn routing_code(&self) -> u16 {
        self.0[5..9].iter().fold(0u16, |acc, d| acc * 10 + u16::from(d - b'0'))
    }
}

/// ISO 7064 MOD 97-10 over the rearranged number (IBAN arithmetic), computed digit by
/// digit so no big integer is needed: move the first five characters to the end,
/// letters become two digits (A = 10 … Z = 35).
fn mod97(aan: &[u8]) -> u32 {
    aan[5..].iter().chain(&aan[..5]).fold(0u32, |rem, &c| {
        if c.is_ascii_digit() {
            (rem * 10 + u32::from(c - b'0')) % 97
        } else {
            (rem * 100 + u32::from(c - b'A') + 10) % 97
        }
    })
}

/// Computes the two check digits for a 16-digit account body.
pub fn check_digits(body: &[u8; 16]) -> [u8; 2] {
    let mut provisional = [0u8; 21];
    provisional[..3].copy_from_slice(b"ALX");
    provisional[3..5].copy_from_slice(b"00");
    provisional[5..].copy_from_slice(body);
    let value = 98 - mod97(&provisional);
    [b'0' + (value / 10) as u8, b'0' + (value % 10) as u8]
}
```

Why `ALX` is safe here: an IBAN's first two characters are an ISO
country code followed by two **digits**. An AAN has a letter (`X`) in
position three, so any IBAN validator rejects it immediately. It can
never pass as an Albanian IBAN (which starts `AL` + digits), and people
and systems can still see it is an Aletheia number.

Confirmation of Payee: before sending, wallets and participants show the
registered name (or business name) behind the resolved address, so
mistakes and impersonation are caught before money moves.

## 40B.4 APN Messaging

Institutions need to exchange more than value: status reports,
statements, investigations, remittance information, Travel Rule data.
APN Messaging is a secure, store-and-forward network between
participants.

-   **Format**: ISO 20022 MX messages (XML, validated against pinned
    XSDs); JSON representation available on participant APIs with
    lossless mapping.
-   **Security**: TLS 1.3 mTLS transport; each message signed by the
    sender's registered messaging key and encrypted to the receiver's
    key (HPKE, RFC 9180). Relays never see content.
-   **Non-repudiation without exposing data**: the hash of every message
    envelope (not its content) is **anchored on-chain** in batches
    (`MessageAnchor` transaction, Merkle root per batch), so any
    participant can later prove a message was sent, when, and unaltered.
-   **Delivery**: at-least-once with receiver-side idempotency (MsgId),
    acknowledgements (ACK/NAK), retry with backoff, guaranteed ordering
    per sender--receiver pair, 30-day store-and-forward.
-   **Storage**: PostgreSQL message store per APN node, payloads
    zstd-compressed then encrypted at rest; retention per scheme
    rulebook and law.

## 40B.5 End-to-End Tracking

-   Every payment carries an ISO 20022 **UETR** (UUID v4, generated by
    the originator per the ISO standard) plus `EndToEndId`, and after
    settlement the `AL:T` transaction ID.
-   The on-chain transaction memo carries `H(UETR)` (not the UETR
    itself), linking the external reference to the on-chain settlement
    without leaking it publicly.
-   Participants and customers can track a payment across every leg
    (Aletheia internal, partner bank, external scheme) with one lookup:
    `getPaymentStatus { uetr }`.

## 40B.6 Settlement Model

-   **Settlement asset**: AEY. On-chain finality **is** settlement
    finality: once a payment's transaction is finalized, it is
    irrevocable, 24/7/365, in seconds. There is no end-of-day netting
    cycle.
-   Each participant holds a **settlement account** (`AL:` address of
    participant type). Indirect participants settle through their
    sponsor.
-   **External legs** (money entering or leaving Aletheia) are backed by
    **prefunded accounts at partner banks** (nostro), reconciled daily
    and intraday:

``` text
R1  For each partner bank P and currency C:
      balance reported by P's camt.053 statement
    = Σ confirmed inbound external payments − Σ confirmed outbound external payments + opening balance
R2  AEY minted against external inflows ≤ confirmed prefunded balances + governed credit lines (if any)
R3  Every AEY MINT tied to an external inflow references the inbound message (reserve_ref = H(UETR ‖ MsgId))
```

Breaks in R1--R3 open an automatic reconciliation case, block further
minting for that partner and alert operations.

-   **Liquidity tools** for participants: intraday liquidity view,
    scheduled sweeps between settlement accounts, low-balance alerts,
    queued payments with priority (urgent / normal) when a participant's
    balance is short --- queues are off-chain in the participant's
    system; the chain only settles fully funded payments.

## 40B.7 APN Scheme Rulebook --- Payment Types

  --------------------------------------------------------------------------------------
  Scheme               ISO 20022         On-chain operation              Notes
  -------------------- ----------------- ------------------------------- ---------------
  **Instant credit     pacs.008 /        `Payment` (tx type 128)         24/7, final in
  transfer** (person,  pacs.002                                          seconds, max
  business,                                                              amount per KYC
  government)                                                            tier

  **Bulk payments**    pain.001 (batch)  `BatchPayment` (129, ≤ 1,000    Government
  (payroll, pensions,  → pacs.008        legs, atomic or per-leg)        disbursements
  social benefits,                                                       straight to
  supplier runs)                                                         citizens'
                                                                         accounts

  **Request-to-Pay**   pain.013 /        `PaymentRequest` (130),         Payer approves
  (invoices,           pain.014          `PaymentRequestResponse` (131)  in wallet;
  e-commerce, utility                                                    paying settles
  bills)                                                                 as a normal
                                                                         credit transfer

  **Direct debit with  pain.009--012,    `MandateCreate` (132),          Payer-signed
  mandate**            pacs.003          `MandateAmend` (133),           mandate stored
  (subscriptions,                        `MandateCancel` (134),          on-chain with
  taxes, utilities,                      `DirectDebit` (135)             max amount,
  loans)                                                                 frequency,
                                                                         expiry; debtor
                                                                         can cancel any
                                                                         time

  **Standing orders /  pain.001 with     `ScheduledPayment` (136)        Executed by the
  scheduled payments** execution date                                    protocol at the
                                                                         scheduled epoch
                                                                         only if funded

  **Returns**          pacs.004          `PaymentReturn` (137)           Receiver sends
                                                                         money back,
                                                                         linked to the
                                                                         original

  **Recall / request   camt.056 /        `RecallRequest` (138),          Finality
  for return**         camt.029          `RecallResponse` (139)          stands; recall
                                                                         is a request
                                                                         the receiver
                                                                         answers

  **Investigations &   camt.027 /        Off-chain APN messaging,        Case IDs link
  disputes**           camt.087 /        anchored                        to `AL:T`
                       camt.029                                          

  **Merchant           pain.013 or QR    `Payment` with merchant         POS and online
  payments**                             category and invoice reference  checkout via
                                                                         participant
                                                                         PSPs

  **Statements &       camt.052 /        Generated from indexed on-chain For
  notifications**      camt.053 /        data                            institutions
                       camt.054                                          and business
                                                                         customers

  **Conditional /      ---               Arno contracts (Section 25)     Trade,
  escrow payments**                                                      property,
                                                                         milestones
  --------------------------------------------------------------------------------------

On-chain structures:

``` text
PaymentInstruction                     (payload of tx type 128)
├── debtor              Address
├── creditor            Address
├── amount              u128   (AEY base units)
├── debtor_agent_aic    Text[11]
├── creditor_agent_aic  Text[11]
├── uetr_hash           Hash   (H(UETR))
├── purpose_code        Text[4]   (ISO 20022 ExternalPurpose1Code)
├── remittance_hash     Hash   (structured remittance info held off-chain in APN messaging)
└── scheme              u8     (instant, bulk leg, direct debit, standing order, …)

Mandate                                (state namespace 103)
├── mandate_id          Hash
├── debtor, creditor    Address
├── max_amount          u128
├── frequency           enum (once | weekly | monthly | quarterly | yearly | on_demand)
├── first_epoch, final_epoch
├── debtor_signature    (signed by the debtor's account key)
└── status              ACTIVE | SUSPENDED | CANCELLED | EXPIRED
```

Payment lifecycle (identical view for every participant and for
customers):

``` text
INITIATED → VALIDATED → SCREENED → SETTLED (on-chain final) → CONFIRMED (pacs.002 ACSC)
     │           │           │                                   └─ RETURNED (pacs.004)
     └─ REJECTED (RJCT + ISO reason code) ◀────────┘
External legs add:  EXTERNAL_SUBMITTED → EXTERNAL_CONFIRMED | EXTERNAL_FAILED (auto-refund to sender)
```

``` rust
// crates/apn/src/lifecycle.rs

/// One lifecycle for every payment, seen identically by every participant (Section 40B.7).
/// The transition function is the only way a status changes; the type makes illegal
/// transitions unrepresentable at the call site and the match makes them a compile error
/// to forget.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PaymentStatus {
    Initiated,
    Validated,
    Screened,
    Escrowed,            // external legs only (Section 40C.7)
    ExternalSubmitted,
    Investigating,       // instant-scheme time-out: outcome unknown, money held
    Settled,             // on-chain final
    Confirmed,           // pacs.002 ACSC sent / external confirmation received
    Returned,
    Rejected(IsoReason),
    ExternalFailedRefunded,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PaymentEvent {
    PassedValidation,
    PassedScreening,
    FailedWith(IsoReason),
    EscrowLocked,
    SubmittedExternally,
    ExternalTimeout,
    ExternalAccepted,
    ExternalRejected(IsoReason),
    InvestigationNotSettled,
    FinalizedOnChain,
    ConfirmationSent,
    ReturnFinalized,
}

pub fn transition(from: PaymentStatus, event: PaymentEvent) -> Result<PaymentStatus, AletheiaError> {
    use PaymentEvent as E;
    use PaymentStatus as S;
    let to = match (from, event) {
        (S::Initiated, E::PassedValidation) => S::Validated,
        (S::Validated, E::PassedScreening) => S::Screened,
        (S::Initiated | S::Validated | S::Screened, E::FailedWith(reason)) => S::Rejected(reason),
        (S::Screened, E::FinalizedOnChain) => S::Settled,
        (S::Screened, E::EscrowLocked) => S::Escrowed,
        (S::Escrowed, E::SubmittedExternally) => S::ExternalSubmitted,
        (S::ExternalSubmitted, E::ExternalTimeout) => S::Investigating,
        (S::ExternalSubmitted | S::Investigating, E::ExternalAccepted) => S::Settled,
        (S::ExternalSubmitted | S::Investigating, E::ExternalRejected(_))
        | (S::Investigating, E::InvestigationNotSettled) => S::ExternalFailedRefunded,
        (S::Settled, E::ConfirmationSent) => S::Confirmed,
        (S::Settled | S::Confirmed, E::ReturnFinalized) => S::Returned,
        (from, event) => {
            return Err(AletheiaError::new(ErrorCode::ApnIllegalTransition,
                format!("payment cannot go from {from:?} on {event:?}")));
        }
    };
    Ok(to)
}
```

ISO 20022 → protocol mapping (pacs.008 excerpt, versioned in
`docs/apn/mappings/pacs.008.md` with golden tests):

  -----------------------------------------------------------------------
  ISO 20022 element                     Protocol field
  ------------------------------------- ---------------------------------
  `CdtTrfTxInf/PmtId/UETR`              `uetr_hash` (hashed)

  `CdtTrfTxInf/PmtId/EndToEndId`        APN message store (off-chain)

  `IntrBkSttlmAmt` + `@Ccy`             `amount` (AEY base units); `Ccy`
                                        = `EUR` in external messages ---
                                        `AEY` is not an ISO 4217 code, so
                                        the settlement asset is stated in
                                        `SplmtryData`

  `DbtrAgt/FinInstnId/BICFI` or         `debtor_agent_aic`
  `Othr/Id`                             

  `CdtrAgt/FinInstnId/…`                `creditor_agent_aic`

  `Dbtr` / `DbtrAcct`                   resolved to `debtor` via AAN /
                                        proxy

  `Cdtr` / `CdtrAcct`                   resolved to `creditor` via AAN /
                                        proxy

  `Purp/Cd`                             `purpose_code`

  `RmtInf`                              APN message store;
                                        `remittance_hash` on-chain
  -----------------------------------------------------------------------

## 40B.8 Connectivity to the Outside World

### Rail-access principle

StableChain is **rail-neutral and institution-mediated**. The existence
of an adapter does not grant Aletheia, APN or any participant membership
in SWIFT, SEPA, Fedwire or another regulated payment system. Production
connectivity requires the applicable legal entity, account,
membership/access arrangement, correspondent relationship, scheme
sponsorship or licensed PSP relationship.

The gateway MUST distinguish: (1) on-chain AEY final settlement, (2) APN
payment state, (3) external submission, and (4) external confirmation.
An external rail outage MUST NOT roll back an already-finalized on-chain
transaction. External failure produces an APN status and, where the
scheme permits, a compensating/refund transaction.

**v4.0:** outbound external legs no longer need compensating transactions: the AEY is held in an
on-chain escrow until the external outcome is definitive (Section 40C.7), and the full rail engineering
is in Section 40C. The lifecycle below gains ESCROWED and INVESTIGATING (normative code in this section).

For EUR flows, ISO 20022 external messages use `EUR` as the settlement
currency where the external account is denominated in EUR. `AEY` remains
an Aletheia-native asset identifier and is carried in supplementary or
proprietary data where required by the external mapping.

  ------------------------------------------------------------------------------
  Rail              How APN connects                      Direction
  ----------------- ------------------------------------- ----------------------
  **International   Through licensed **partner /          In and out
  banks (SWIFT)**   correspondent banks**, exchanging ISO 
                    20022 MX (pacs.008/009, camt.053/054) 
                    over their SWIFT connectivity or a    
                    service bureau. APN can hold its own  
                    SWIFT connection only if a supervised 
                    Aletheia institution qualifies for    
                    SWIFT membership                      

  **Fedwire Funds   Through an appropriately authorized   In and out
  Service**         U.S.-connected partner/correspondent  
                    institution using the applicable      
                    Fedwire access and ISO 20022          
                    arrangements                          

  **SEPA / SEPA     Through an eligible SEPA participant, In and out
  Instant**         sponsor or PSP; APN maps AEY/EUR      
                    settlement instructions to the        
                    applicable SEPA scheme and keeps      
                    external confirmation separate from   
                    on-chain finality                     

  **Domestic        Via partner PSPs connected to schemes In and out
  instant schemes   such as SEPA Instant, UK Faster       
  abroad**          Payments, FedNow, NIP (Nigeria), PIX, 
                    UPI --- each subject to that          
                    partner's access and agreement        

  **Mobile money**  Partner APIs (for example M-Pesa, MTN In and out
                    MoMo) through External Rail Adapters  

  **Cards**         Card issuing partner: virtual and     Spend and accept
                    physical cards funded from AEY        
                    balances; card acquiring for          
                    merchants through partner acquirers   

  **Public          Bridge (Section 40A)                  In and out
  stablechains**                                          

  **FX**            Licensed **FX providers**             Conversion
                    (participants with role FX_PROVIDER)  
                    publish signed, expiring quotes;      
                    conversions settle                    
                    **payment-versus-payment** atomically 
                    on-chain for tokenized currencies, or 
                    against confirmed external legs       
                    otherwise                             
  ------------------------------------------------------------------------------

External Rail Adapter contract (each rail is an adapter; the core never
changes per rail):

``` rust
// crates/rails/src/adapter.rs

/// One external rail. The core never changes per rail; a rail is a profile (Section 40C.3)
/// plus an implementation of this trait. This is a real seam: several implementations
/// exist in production and the railsim implements it for every rail in tests.
pub trait RailAdapter: Send + Sync {
    fn rail(&self) -> RailId;

    /// Profile in force at `at` (acceptance instant). Rules are data with effective dates.
    fn profile_at(&self, at: UtcInstant) -> Result<&RailProfile, RailError>;

    /// Layers 1–3 for an outbound payment. Never mutates the payment to make it pass:
    /// a value the rail cannot carry is an error naming the field and the rule.
    fn validate_outbound(&self, payment: &CanonicalPayment, at: UtcInstant) -> Result<(), RailRejection>;

    /// Renders the rail message. Pure: same payment + profile → same bytes.
    fn render(&self, payment: &CanonicalPayment, profile: &RailProfile) -> Result<RailMessage, RailError>;

    /// Hands a rendered message to the partner. Idempotent per `outbox_id`: a retry after an
    /// unknown outcome must not create a second payment at the partner.
    fn submit(&self, outbox_id: OutboxId, message: &RailMessage) -> Result<SubmissionReceipt, RailError>;

    /// Parses and validates (layers 1–3) an inbound message into the canonical model.
    fn accept_inbound(&self, raw: &[u8], received_at: UtcInstant) -> Result<InboundItem, RailRejection>;

    /// Asks the partner for the definitive status of a payment whose outcome is unknown.
    fn investigate(&self, uetr: Uetr, original: &MessageRef) -> Result<InvestigationRequest, RailError>;
}

pub enum InboundItem {
    Credit(CanonicalPayment),
    Status { uetr: Uetr, original: MessageRef, status: ExternalStatus },
    Return { original: MessageRef, payment: CanonicalPayment, reason: IsoReason },
    RecallRequest { original: MessageRef, reason: IsoReason },
    Statement(Statement),
}
```

## 40B.9 Compliance Built Into the Flow

The protocol enforces what it can; the licensed participants and
operators remain responsible for their legal obligations.

-   **KYC tiers**: the Identity registry (Section 31) issues tier
    credentials (for example Tier 0 unverified, Tier 1 basic, Tier 2
    full, Tier 3 business). Scheme rules set per-payment and daily
    limits per tier, enforced on-chain at settlement.
-   **Sanctions screening**: every external leg and every
    cross-participant payment above a governed threshold is screened by
    the sending participant and the gateway before settlement; failure
    or timeout of screening **rejects** (fail-closed).
-   **Travel Rule**: originator and beneficiary information (IVMS 101
    data model) travels between participants over encrypted APN
    Messaging, never on-chain; its anchor hash is recorded.
-   **Monitoring**: AML analytics run off-chain on the indexer and APN
    message store; cases, holds and reports are managed in a
    case-management service with full audit.
-   **Privacy**: no personal data on-chain --- only addresses, amounts,
    hashes and codes. Personal and remittance data lives in encrypted
    participant and APN stores.

## 40B.10 Participant APIs, Sandbox and Certification

-   **Interfaces**: ISO 20022 over mTLS (gateway), Participant REST API,
    JSON-RPC methods (below), signed webhooks for status changes.
-   **Sandbox**: a permanent APN sandbox network with test AEY,
    simulated partner banks, simulated external rails and an ISO 20022
    message simulator.
-   **Certification suite** (like SWIFT onboarding): a participant
    becomes ACTIVE only after passing the scheme test cases for every
    scheme it joins --- happy paths, rejects with every reason code,
    returns, recalls, duplicate MsgIds, timeouts, screening failures and
    reconciliation.

JSON-RPC additions (Section 37.2): `sendPayment`,
`getPaymentStatus { uetr | txId }`, `resolveProxy`, `confirmPayee`,
`createPaymentRequest`, `respondToPaymentRequest`, `createMandate`,
`cancelMandate`, `getParticipant { aic }`, `listParticipants`,
`getStatement { account, from, to }`, `requestReturn`, `getFxQuote`, and
subscription topic `payments`.

## 40B.11 Operations and Tests

-   Availability target 24/7/365; RPO 0 for finalized payments (chain
    finality); RTO ≤ 15 min for APN services, with active-active
    deployment in at least two sites.
-   If an external rail is down, inbound and outbound payments for that
    rail queue in the adapter with clear status to customers; internal
    Aletheia payments continue unaffected.
-   Tests (mandatory, counted in coverage gates): scheme conformance for
    every payment type; ISO 20022 golden mapping tests for every
    supported message version; certification suite runs in CI against a
    reference participant; reconciliation property tests (R1--R3) with
    injected breaks; external-rail outage and duplicate-delivery chaos
    tests; screening fail-closed tests; proxy resolution privacy and
    rate-limit tests; end-to-end: citizen wallet → merchant → partner
    bank → foreign account and back.

------------------------------------------------------------------------

# 40C. External Rail Interoperability --- SEPA, SWIFT, Fedwire and Others (APS-0056) **\[DECISION ADR-031\]**

Section 40B.8 states the principle: Aletheia reaches external rails
through authorized partner institutions, and an adapter is not a
membership. This section specifies how those adapters are built so that
every message they produce is **accepted first time by the receiving
infrastructure**, and every message they receive is **applied exactly
once, to the right account, for the right amount**.

Interoperability fails in production for dull reasons: a character
outside the scheme's set, a field silently truncated, an address that
is unstructured after the deadline, a cut-off missed by one minute
across a daylight-saving change, a timeout treated as a failure when
the money had in fact moved. This section exists to make each of those
impossible by construction.

## 40C.1 Design: Hub, Not Mesh

``` text
pacs.008 (CBPR+) ─┐                                   ┌─ pacs.008 (EPC SCT Inst)
pacs.008 (Fedwire)┤                                   ├─ pacs.008 (CBPR+ via correspondent)
pacs.008 (EPC SCT)┼──▶ parse ─▶ validate ─▶  ACP  ─▶ ─┼─ pacs.009 / pacs.008 (Fedwire)
pain.001 (corp)   ┤    (rail      (4 layers)  model   ├─ partner instant-scheme API
camt.054 (credit) ┘    profile)                       └─ on-chain operations (APN, escrow)
```

All inbound and outbound traffic passes through one internal model,
the **Aletheia Canonical Payment (ACP)**. With `n` rails, mappings are
`2n`, not `n²`. A rail is added by writing a profile and two mappings,
never by touching the core or another rail.

## 40C.2 Aletheia Canonical Payment (ACP)

ACP is an off-chain model (Rust structs in `crates/rails-model`,
`serde` allowed --- it is never consensus bytes). It is a superset of
the ISO 20022 payment elements every supported rail uses, so that
nothing is lost on the way in.

``` rust
// crates/rails-model/src/acp.rs
pub struct CanonicalPayment {
    pub uetr: Uetr,                          // UUID v4, ISO 20022 form; never regenerated downstream
    pub end_to_end_id: Max35Text,
    pub instruction_id: Option<Max35Text>,
    pub message_id: Max35Text,               // the carrying message's MsgId
    pub rail: RailId,                        // which profile parsed or will emit it
    pub profile_version: RailProfileVersion,
    pub direction: Direction,                // Inbound | Outbound
    pub settlement: Settlement,              // amount, currency, interbank settlement date, method
    pub instructed: Option<InstructedAmount>,// original amount/currency before FX
    pub fx: Option<FxTerms>,                 // quote id, rate as exact decimal, provider AIC
    pub charge_bearer: ChargeBearer,         // DEBT | CRED | SHAR | SLEV
    pub debtor: Party,
    pub debtor_account: AccountRef,          // IBAN | AAN | Other{scheme, id} | Proxy
    pub debtor_agent: AgentRef,              // BICFI | AIC | ClrSysMmbId | LEI
    pub creditor: Party,
    pub creditor_account: AccountRef,
    pub creditor_agent: AgentRef,
    pub intermediaries: Vec<AgentRef>,       // ordered, max 3
    pub purpose: Option<PurposeCode>,
    pub category_purpose: Option<CategoryPurposeCode>,
    pub remittance: Remittance,              // Unstructured(Vec<Max140Text>) | Structured(..) | Both
    pub regulatory: Vec<RegulatoryReport>,
    pub supplementary: Vec<SupplementaryData>, // carries "AEY" settlement-asset statement where needed
}

pub struct Party {
    pub name: Max140Text,
    pub postal_address: Option<PostalAddress>, // structured fields kept separately, never concatenated
    pub identification: Option<PartyId>,       // LEI, org id, private id
    pub country_of_residence: Option<CountryCode>,
}

pub struct PostalAddress {
    pub street_name: Option<Max70Text>,
    pub building_number: Option<Max16Text>,
    pub post_code: Option<Max16Text>,
    pub town_name: Option<Max35Text>,          // required by structured/hybrid rules on most rails
    pub country: Option<CountryCode>,          // ISO 3166-1 alpha-2; Aletheia uses the governed user-assigned code (40B.2)
    pub address_lines: Vec<Max70Text>,         // hybrid form only; profile decides if allowed
    // further ISO 20022 elements (department, floor, post box, district …) as Option fields
}
```

Text types (`Max35Text`, `Max140Text`, …) validate length **in
characters as the ISO schema counts them** at construction and cannot
hold an over-long value. There is no `truncate()` in this crate.

## 40C.3 Rail Profiles --- Rules as Versioned Data

Each rail is described by a profile file under
`crates/rails/profiles/<rail>/<version>.toml`, reviewed like code,
loaded at gateway start, hashed, and the hash recorded in every audit
record the profile touched.

``` toml
# crates/rails/profiles/sepa-sct-inst/2025.toml
rail                = "sepa-sct-inst"
operator            = "European Payments Council (scheme) / CSM per partner"
rulebook            = "SCT Inst Rulebook — version in force; see source_documents"
effective_from      = "2025-10-05"          # the profile's own validity start, set at review
effective_until     = ""                    # empty = until superseded
source_documents    = [
  "EPC SCT Inst Rulebook (version in force on effective_from)",
  "EPC SCT Inst Interbank Implementation Guidelines",
  "Regulation (EU) 2024/886 (Instant Payments Regulation)",
]
reviewed_by         = ["payments-lead", "security-lead"]
reviewed_on         = "2026-09-30"

[messages]
credit_transfer     = "pacs.008.001.08"
status_report       = "pacs.002.001.10"
payment_return      = "pacs.004.001.09"
recall              = "camt.056.001.08"
recall_answer       = "camt.029.001.09"
status_investigation = "pacs.028.001.03"

[currency]
allowed             = ["EUR"]
minor_units         = 2

[timing]
max_execution_seconds = 10                  # scheme time-out window for the beneficiary PSP's answer
operating_calendar  = "always"              # 24/7/365
investigation_after_seconds = 25            # our own: when to send pacs.028 if no definitive status

[limits]
scheme_max_amount   = ""                    # empty = no scheme cap; partner and participant limits still apply
partner_max_amount  = "from-partner-agreement"

[charset]
set                 = "epc-latin"           # a–z A–Z 0–9 / - ? : ( ) . , ' + space
on_violation        = "reject"              # never transliterate silently; see 40C.4 layer 2

[fields]
end_to_end_id_max   = 35
remittance_unstructured_max = 140
remittance_structured_reference = "ISO 11649 (RF) or scheme-accepted"
charge_bearer       = "SLEV"
debtor_agent_bic    = "optional-when-iban-sufficient"

[verification_of_payee]
required            = true
interface           = "partner-vop"         # VoP request/response via the sending partner PSP
mismatch_behaviour  = "show-and-require-confirmation"

[address]
mode                = "structured-or-hybrid-when-provided"
```

Rules for profiles:

-   Numbers that a scheme operator may change (limits, time-outs,
    operating hours, cut-offs, message versions, address rules) live
    **only** in profiles, each with `effective_from`. The adapter picks
    the profile version by the payment's acceptance date-time, so a
    change takes effect at the right instant without a deploy.
-   A profile without `source_documents`, two reviewers and a review
    date fails CI.
-   **Release checklist item:** before each production release, the
    payments lead re-verifies every active profile against the scheme
    operator's current publications and the partner's current
    implementation guide, and records the check in
    `docs/apn/profile-verification/<release>.md`. The values in this
    document are the state of the art when it was written; the
    operators' publications win.

## 40C.4 Four Validation Layers

Every inbound message and every outbound message is validated in this
order. The first failure decides the outcome and the ISO reason code.

  ---------------------------------------------------------------------------------------------
  Layer   Checks                                      Implementation             On failure
  ------- ------------------------------------------- -------------------------- --------------
  1       Well-formed XML, size ≤ 1 MiB, no DTD, no   hardened `quick-xml`       Reject before
  Syntax  entities, XSD of the exact message version  reader + pinned XSDs in    parsing
          in the profile, BAH (`head.001`) where the  `crates/rails/xsd/`        content (`FF01`)
          rail requires it

  2       Usage-guideline rules beyond the XSD:       Rust rule functions, one   Inbound:
  Usage   character set, element cardinality the      per guideline rule,        reject with
  rules   guideline narrows, structured address       named after the rule ID    code from the
          rules, mandatory BICs, ID formats (IBAN     (`cbpr_plus_r_2_4`),       profile.
          MOD-97, LEI MOD-97, BIC shape, UETR v4      table-driven tests from    Outbound:
          format), date windows                       published samples          refuse to emit
                                                                                 and raise an
                                                                                 internal case

  3       Scheme business rules: currency allowed,    Rust, per rail             ISO reason code
  Scheme  amount limits, cut-off and calendar,                                   (`AM02`, `AC01`,
          duplicate detection key, charge bearer,                                `DUPL`, `CUTA`,
          R-transaction time windows                                             …)

  4       Aletheia rules: participant ACTIVE and      Rust, calls on-chain       Reject with
  Aletheia certified, KYC tier limits, sanctions      state through the gateway  mapped code;
          screening (fail-closed), AAN/proxy          client, screening          screening
          resolution, reserve/nostro headroom         adapter                    holds go to a
          (R2), escrow availability                                              case
  ---------------------------------------------------------------------------------------------

**Never transliterate or truncate silently.** Where a rail's character
set or field length cannot carry the original value, the outbound
mapping either (a) uses a transliteration table that the profile
explicitly enables and records the mapping in the audit trail, or (b)
refuses the payment with a precise reason shown to the sender
(`creditor name contains "Ł", which SEPA's character set cannot carry; use "L" or contact support`).
Truncation of names, addresses or remittance information is forbidden;
sanctions screening runs on the **original** value and on the emitted
value, and both results are recorded.

## 40C.5 Per-Rail Engineering Notes

What an engineer must get right on each rail. Exact figures belong in
the profiles, not here.

**SWIFT CBPR+ (through correspondent banks).** Messages: pacs.008,
pacs.009 (including the COV variant), pacs.002, pacs.004, camt.056 /
camt.029, camt.052 / camt.053 / camt.054, with the `head.001` Business
Application Header. Get right: MX only for cross-border payment
instructions (the MT/MX coexistence period ended in November 2025). The
BAH is mandatory and its identifiers must agree with the document. UETR
is mandatory and is carried unchanged by every hop. **Structured or
hybrid postal addresses only:** fully unstructured addresses are being
retired in CBPR+ from November 2026, so the adapter never emits them and
participant onboarding collects addresses in structured form. MT-era
truncation habits are not reintroduced. gpi tracker updates are
correlated by UETR and surfaced through `getPaymentStatus`.

**SEPA Credit Transfer (SCT).** Messages: pacs.008, pacs.002, pacs.004,
camt.056 / camt.029. Get right: EPC character set; IBAN mandatory; BIC
optional where the IBAN is sufficient; charge bearer `SLEV`;
`EndToEndId` ≤ 35 characters; unstructured remittance ≤ 140 characters
or a structured creditor reference. Execution is D+1 through the
partner's CSM with cut-offs from the TARGET calendar. Returns and
recalls follow the rulebook's time windows, which live in the profile.

**SEPA Instant (SCT Inst).** Messages: as SCT, plus pacs.028 for status
investigation. Get right: the beneficiary side must answer inside the
scheme time-out, and **a missing answer is not a rejection** --- the
payment may have settled. The adapter sends a status investigation and
keeps the escrow locked until a definitive status (Section 40C.7).
Verification of Payee before submission is mandatory for euro payments
under the Instant Payments Regulation; its result maps to APN
Confirmation of Payee and is shown to the sender before signing.

**SEPA Direct Debit (Core and B2B).** Messages: pain.008 (through the
partner), pacs.003, pacs.002, pacs.004, pacs.007. Get right: Creditor
Identifier; mandate reference and signature date carried exactly;
pre-notification; refund-right windows for authorized and unauthorized
debits differ and are profile data; B2B has no refund right for
authorized debits. An APN `Mandate` (namespace 103) is not a SEPA
mandate; the adapter keeps both references and never conflates them.

**Fedwire Funds Service (through a U.S. partner).** Messages: pacs.008
(customer transfers), pacs.009 (financial-institution transfers),
pacs.004, pacs.002 and camt.056 / camt.029 as the partner offers them.
Get right: Fedwire moved to ISO 20022 in July 2025. USD only --- AEY
never appears as a currency; an FX leg converts EUR-denominated value
to USD first (Section 40C.6). Fedwire runs on business days within
published hours; the calendar, the operator cut-offs and the partner's
earlier internal cut-off are profile data in `America/New_York` time.
Fedwire settlement is final; a recall is a request, never a right.

**FedNow (through a U.S. partner).** ISO 20022 pacs.008 / pacs.002 /
pacs.004 and request-for-payment (pain.013 / pain.014). 24/7/365.
Network and participant limits are profile data. Time-out handling is
the same as SCT Inst.

**T2 (Eurosystem RTGS) and TIPS.** ISO 20022 through the partner since
2023; settlement in central-bank money; T2 calendar and cut-offs in the
profile; TIPS behaves as an instant scheme.

**CHAPS (through a UK partner).** ISO 20022 pacs.008 / pacs.009; GBP
only; enhanced-data and purpose-code requirements follow the Bank of
England's published timetable, recorded in the profile.

**Partner instant schemes** (UK Faster Payments, NIP in Nigeria, PIX,
UPI, mobile money). Each partner integration is its own rail profile
with its own field mapping, limits and status model, mapped into ACP and
the APN lifecycle. Many of these are not ISO 20022 on the wire; the
adapter's job is the same.

## 40C.6 Amounts, Currencies and Conversion

AEY has 18 decimals; EUR has 2. The external world never sees a
fraction of a cent, and AEY is never lost in rounding.

1.  An outbound external leg in EUR MUST be an exact multiple of
    `10^16` AEY base units (one cent). The wallet and participant APIs
    round the user's requested amount **before** signing and show it;
    the gateway rejects a non-multiple with
    `RailAmountNotRepresentable (amount 12.504 AEY is not a whole number of euro cents)`.
    Nothing is rounded after signature.
2.  Inbound EUR is credited as `amount_cents × 10^16` base units ---
    exact.
3.  Non-EUR legs require an FX quote from an `FX_PROVIDER` participant:
    rate as an exact decimal string with declared precision, expiry,
    quote id, and the rounding rule (ISO 4217 minor units of the target
    currency, `HalfEven` only for the quoted target amount; the AEY debit
    is computed `Ceil` so the sender, never the network, bears sub-unit
    residue). The quote id is carried in ACP and in the audit ledger.
4.  `AEY` is not an ISO 4217 code. External messages state `EUR` (or
    the converted currency) in `Ccy` attributes; the settlement asset is
    stated in supplementary data only where the partner's mapping
    requires it (Section 40B.7).

## 40C.7 External Legs On-Chain: Escrow-Lock **\[CONSENSUS-CRITICAL\]**

On-chain finality cannot be undone (Section 40B.8). External rails can
reject, time out or settle late. The two are joined by an escrow, so
that the AEY involved is always in exactly one known place.

New transaction types (active from the protocol version that
introduces APS-0056; Section 44.3):

  --------------------------------------------------------------------------------------------
  Type   Name                    Signed by                  Effect
  ------ ----------------------- -------------------------- -----------------------------------
  144    `ExternalLegLock`       Sender's participant       Moves AEY from the sender to escrow
                                 (settlement account)       record `leg_id` (namespace 108);
                                                            status LOCKED; `uetr_hash`,
                                                            `rail`, `profile_hash`, expiry
                                                            epoch

  145    `ExternalLegSettle`     Gateway operator key       On definitive external acceptance
                                 (HSM, per-rail limits)     (`ACSC` or partner settlement
                                                            confirmation): escrow burned as
                                                            redemption against the partner
                                                            nostro (`reserve_ref = H(UETR ‖
                                                            MsgId)`); status SETTLED

  146    `ExternalLegRelease`    Gateway operator key       On definitive rejection (`RJCT`
                                                            with reason) or a confirmed
                                                            not-settled investigation: escrow
                                                            returned to the sender; status
                                                            RELEASED

  147    `ExternalInboundCredit` Gateway operator key +     Mints AEY to the resolved creditor
                                 Monetary Authority         against a confirmed inbound credit
                                 standing authorization     on a partner nostro; unique per
                                                            `(rail, H(UETR), H(MsgId),
                                                            amount)`; R2 enforced
  --------------------------------------------------------------------------------------------

Escrow invariants (added to Section 18.4 and checked after every
block, fail-stop on violation):

-   **I13** For every escrow record: exactly one of LOCKED, SETTLED,
    RELEASED. Transitions only LOCKED → SETTLED or LOCKED → RELEASED.
-   **I14** Σ AEY in LOCKED escrows = the escrow balance in the supply
    ledger.
-   **I15** An escrow never expires into RELEASED by time alone. When
    its expiry epoch passes, it moves to the gateway's **investigation
    queue** and the Monetary Authority dashboard; release requires a
    definitive external answer or a governed resolution.

Why I15: for an instant scheme, "no answer within 10 seconds" means the
beneficiary bank may have credited the money. Releasing the escrow on a
timer would let the sender spend money that has also left the nostro.
The adapter sends `pacs.028`, waits for the answer, and only then
settles or releases.

## 40C.8 Exactly Once, In Both Directions

Gateway and adapters keep their own PostgreSQL ledger next to the
`gateway_audit` table (Section 40):

-   **Inbox** (`rail_inbox`): every received message is stored with
    `UNIQUE (rail, sender_bic_or_member, msg_id)` before any processing.
    A duplicate delivery is acknowledged and ignored, and the original
    outcome is re-sent.
-   **Outbox** (`rail_outbox`): every message to emit is written in the
    same database transaction as the state change that caused it; a
    dispatcher sends it and records the partner's acknowledgement.
    Nothing is "sent and then saved".
-   **Business duplicate check** (scheme layer 3): `(UETR)` where the
    rail mandates it, otherwise `(EndToEndId, debtor account, amount,
    settlement date)` within the scheme's duplicate window.
-   **Chain side**: `ExternalInboundCredit` is unique by construction
    (namespace 108 key), and APN payments are de-duplicated by
    namespace 107 (Section 40D.5). A replayed signed transaction fails
    on nonce; a re-signed duplicate fails on the de-dup key.

## 40C.9 Calendars, Cut-offs and Time

-   Calendars (TARGET closing days, U.S. Federal Reserve holidays, Bank
    of England holidays, partner-specific closures) are data files with
    effective dates, loaded into the adapter. Times are computed with a
    pinned IANA time-zone database (`chrono-tz`, version recorded in the
    release manifest). This is never consensus code.
-   Every outbound payment records the **acceptance instant** and the
    profile version applied. "Missed cut-off" is decided once, at
    acceptance, and shown to the sender with the next execution date.
-   Daylight-saving transitions have explicit tests for every rail with
    a cut-off.

## 40C.10 Status and Reason Codes

One mapping table, `docs/apn/mappings/status-reasons.md`, generated from
`crates/rails/src/reasons.rs`, maps ISO `ExternalStatusReason1Code`
and `ExternalReturnReason1Code` values to APN lifecycle states and to
customer-facing text in the five official languages. Examples:

  -----------------------------------------------------------------------
  ISO code   Meaning                       APN state         Customer text (en)
  ---------- ----------------------------- ----------------- -------------------------------
  `AC01`     Incorrect account number      REJECTED          The receiving account number is
                                                             not valid. No money left your
                                                             account.

  `AC04`     Closed account                REJECTED /        The receiving account is closed.
                                           RETURNED

  `AM04`     Insufficient funds            REJECTED          ---

  `DUPL`     Duplicate payment             REJECTED          This payment was already sent.

  `RR04`     Regulatory reason             REJECTED          The receiving bank declined this
                                                             payment for regulatory reasons.

  `AB05` /   Time-out (instant)            INVESTIGATING     Your bank is confirming whether
  `AB06`                                                     this payment arrived. Your money
                                                             is held safely until it is
                                                             confirmed.
  -----------------------------------------------------------------------

The last row is the instant-payment rule of Section 40C.7 in customer
language: a time-out is not a failure.

## 40C.11 Reconciliation per Rail

R1--R3 (Section 40B.6) hold per partner and currency. In addition:

-   **R8** Every SETTLED escrow has exactly one matching debit on the
    partner nostro statement (`camt.053`/`camt.054`) within the
    profile's settlement window; every nostro credit has exactly one
    `ExternalInboundCredit` or one open inbound case.
-   **R9** Intraday (`camt.052`) and end-of-day (`camt.053`) balances
    agree with the gateway ledger after accounting for in-flight
    items listed by UETR.

Three-way matching (chain ↔ gateway ledger ↔ bank statement) runs every
15 minutes intraday and at each end of day; breaks are typed
(`MISSING_ON_STATEMENT`, `AMOUNT_MISMATCH`, `UNEXPECTED_CREDIT`,
`DUPLICATE_STATEMENT_ENTRY`, …) and open cases. R2 headroom for a
partner is frozen while it has an open break above the governed
threshold.

## 40C.12 Rail Simulators and Conformance Packs

Interoperability is tested against something that behaves like the
rail, not against mocks that return 200.

-   `aletheia-railsim` (Rust, test-only binary) simulates each rail
    profile end to end: correspondent bank with CBPR+ status flows,
    SEPA CSM with SCT Inst time-outs and late `ACSC`, Fedwire with
    business-day hours and cut-offs, partner instant APIs with their
    real error shapes. Time is virtual and controllable.
-   **Conformance packs** (`tests/rails/<rail>/`): published sample
    messages from the scheme operators and the partner's implementation
    guides (stored with their source and licence notes), each with
    expected parse result, layer-2 rule outcomes and ACP output.
-   Properties (proptest):
    `emit(parse(m)) ≡ m` modulo the fields the profile declares
    non-round-trippable; every ACP value accepted by layer 4 produces a
    message that passes layers 1--3 of its target profile; amount
    conversion never creates or loses a base unit.
-   Chaos: duplicate delivery, out-of-order status reports, late
    `ACSC` after a time-out, partner down for an hour, statement
    arriving before the payment message, clock skew on the adapter
    host. Invariants I13--I15 and R8--R9 must hold in every run.
-   **Partner certification**: before a rail goes live with a partner,
    the partner's own test environment receives the full outbound pack
    and returns the full inbound pack; results are archived with the
    profile version.

------------------------------------------------------------------------


# 40D. Aletheian PayNet Integration (APS-0057, APS-0058) **\[CONSENSUS-CRITICAL for on-chain parts\] \[DECISION ADR-032\]**

## 40D.1 What PayNet Is, and Where the Boundary Runs

**Aletheian PayNet** is the payment rail that runs on Aletheia
StableChain: the operator and platform that onboards participants,
exposes participant and customer APIs, runs APN messaging nodes, the
ISO 20022 gateway and the external rail adapters, keeps the
customer-facing payment ledger, screens, enforces limits, and supports
wallets, merchants and government disbursements. APN (Section 40B) is
the **scheme** --- rules, identifiers, message flows. PayNet is the
**operator and platform** that runs it. StableChain is the **settlement
layer** and the authority for everything on-chain.

PayNet is a separate deployable system with its own repository,
release train and (where required) its own licensed legal entity. It
depends on the chain only through the interfaces in this section. The
chain never depends on PayNet: if PayNet is down, the chain keeps
finalizing and every other participant keeps settling.

  ------------------------------------------------------------------------------------------
  Concern                               Owned by StableChain             Owned by PayNet
  ------------------------------------- -------------------------------- -------------------
  Final settlement of AEY               ✓ (finality = settlement)

  Participant directory, AAN map,       ✓ (namespaces 100--106)          Onboarding
  proxy commitments, mandates, scheme                                    workflow, KYB,
  limits                                                                 certification

  Payment de-duplication across all     ✓ (namespace 107)
  submitters

  External-leg escrow                   ✓ (namespace 108, I13--I15)      Driving the
                                                                         escrow through
                                                                         the gateway

  Personal data, remittance text,                                        ✓ (encrypted
  Travel Rule data, KYC files                                            stores; never
                                                                         on-chain)

  Customer ledger (holds, pending,                                       ✓
  notifications, disputes)

  ISO 20022 gateway, rail adapters,                                      ✓
  APN messaging nodes

  Screening, fraud and AML monitoring                                    ✓ (fail-closed)

  Minting AEY                           Monetary Authority only          Never
                                        (Section 18)
  ------------------------------------------------------------------------------------------

> **Scope note for the reader.** If Aletheian PayNet is instead meant to
> be the brand name of APN itself, the engineering is unchanged: read
> "PayNet" as "the APN service layer operator" throughout. The boundary
> above is what matters.

## 40D.2 Integration Surfaces

  -------------------------------------------------------------------------------------------
  Surface                    Direction           Transport                 Spec
  -------------------------- ------------------- ------------------------- ------------------
  Settlement submission      PayNet → chain      JSON-RPC `sendPayment`,   40D.4
                                                 `submitTransaction` over
                                                 mTLS to PayNet's own
                                                 sentry/full nodes

  Finalized Event Stream     chain → PayNet      gRPC server-streaming     APS-0058, 40D.3
                                                 (internal) and WebSocket
                                                 (`/rpc/v1/ws`, topic
                                                 `finalized-events`)

  Queries and proofs         PayNet → chain      REST / JSON-RPC +         37, 16.3
                                                 state/receipt/finality
                                                 proofs

  Proof verification         inside PayNet       `aletheia-verify` Rust    41A.12
                                                 crate (same crate the
                                                 browser uses)

  APN messaging anchors      PayNet → chain      `MessageAnchor` (tx 140)  40B.4
  -------------------------------------------------------------------------------------------

PayNet runs **its own non-validator full nodes** (at least two per
site) and talks only to them. It never relies on a third party's RPC
for settlement decisions, and it verifies finality proofs for every
settlement it reports to a customer as final.

## 40D.3 Finalized Event Stream (APS-0058)

The single way any off-chain system learns what happened on-chain.
Indexer, explorer API, gateway, rail adapters and PayNet all use it.

``` text
StreamRequest  { from_cursor: Cursor, kinds: list<EventKind> (empty = all), with_proofs: bool }
Cursor         { height u64, tx_index u32, event_index u32 }        // strictly increasing
Envelope
├── cursor
├── block_hash, block_time_ms (protocol time), protocol_version, event_schema u16
├── tx_id (AL:T…) | null for block-level events (migrations, epoch transitions, corrections)
├── kind (EventKind, decimal code) and payload (ACE bytes + JSON rendering)
└── proof (optional): event inclusion proof against header.event_root + finality proof ref
Heartbeat      { finalized_height, cursor_of_last_event }           // every 2 s when idle
```

Rules:

1.  **Finalized only.** The stream never carries speculative or merely
    certified data. There are no reorgs to handle because finalized
    blocks do not reorg; consumers must not build "unconfirmed" logic
    on this stream.
2.  **Ordered and resumable.** Events arrive in cursor order. A
    consumer reconnects with its last committed cursor and receives
    everything after it, exactly as the first time.
3.  **At-least-once delivery, exactly-once effect.** The consumer
    commits its cursor in the same database transaction as the effects
    it derives from the events (transactional inbox). The server may
    resend; the consumer's cursor check discards duplicates.
4.  **Gap detection.** Each envelope carries the cursor of the
    previous envelope sent on the same subscription; a consumer that
    sees a mismatch stops and resumes from its committed cursor.
5.  **Forward compatible.** An unknown `kind` or a newer `event_schema`
    is recorded and skipped, never fatal (Section 44.9).
6.  **Back-pressure.** The server's per-subscriber buffer is bounded;
    a slow consumer is disconnected with `STREAM_CONSUMER_TOO_SLOW` and
    resumes from its cursor. A slow consumer never slows the node.

## 40D.4 Settlement Submission

-   PayNet holds a **settlement account key per direct participant it
    operates for**, in an HSM, with per-key policy: allowed transaction
    types, per-transaction and per-hour value limits, and a dual-control
    threshold above which a second HSM-held approval key co-signs
    (multisig account, Section 13).
-   Every PayNet-originated payment is built, **simulated**
    (`/transactions/simulate`), screened, signed and submitted; its
    status in PayNet's ledger moves to SETTLED **only** when the
    Finalized Event Stream delivers the corresponding `PaymentSettled`
    event with a verified finality proof.
-   PayNet never reports a payment as final from a submission
    acknowledgement or a mempool admission.
-   Nonce management: one submitter task per settlement account,
    sequential nonces held in PayNet's database and reconciled with
    on-chain `next_nonce` on start-up; no parallel submitters per
    account.

## 40D.5 Payment De-duplication on Chain (namespace 107) **\[CONSENSUS-CRITICAL\]**

A retry that re-signs a payment with a new nonce would pass the nonce
check. De-duplication therefore lives in consensus:

``` text
PaymentDedupKey   = H_domain("ALETHEIA/PAYDEDUP/v1", debtor_agent_aic ‖ uetr_hash ‖ leg u8)
PaymentDedupEntry { tx_id, height, expires_epoch }        (state namespace 107)
```

-   `Payment`, `BatchPayment` legs, `DirectDebit`, `ScheduledPayment`
    execution and `ExternalLegLock` insert their key; an existing,
    unexpired key → `PayDuplicate` (receipt error, fee charged).
-   Entries expire after the governed retention window (default 400
    days, longer than any scheme's R-transaction window); expiry is
    processed deterministically at epoch boundaries in key order with a
    per-epoch work cap.

## 40D.6 Reconciliation Between PayNet and the Chain

In addition to R1--R3 and R8--R9:

-   **R4** For each participant settlement account: PayNet ledger
    balance = on-chain balance at the same finalized height, after
    subtracting PayNet-side holds that have not been submitted.
-   **R5** Every PayNet payment in state SETTLED has exactly one
    finalized on-chain transaction whose `uetr_hash` matches; every
    on-chain APN payment from a PayNet-operated account has exactly one
    PayNet ledger entry.
-   **R6** Every `MessageAnchor` batch root recomputes from PayNet's
    message store.
-   **R7** Every LOCKED escrow (namespace 108) originating from PayNet
    has a live gateway case or an outbound message in the outbox.

Reconciliation runs continuously from the event stream with a full
sweep at every epoch boundary; breaks open cases, and an R4 or R5 break
suspends new submissions from the affected account until resolved.

## 40D.7 Upgrades and Compatibility with PayNet

-   PayNet reads `getProtocolSchedule` and refuses to submit
    transaction types that are not active at the next height.
-   Every chain release with a class 2 or 3 change publishes, at least
    two release trains ahead, the new event kinds and schemas; PayNet
    ships support before activation.
-   The shadow-fork rehearsal (Section 59A.5) runs with a PayNet
    staging deployment attached; activation is not scheduled until
    PayNet signs off.
-   PayNet's own releases never require a chain release. Its interface
    is the public one.

## 40D.8 Limits, Kill Switches and Failure Behaviour

  ---------------------------------------------------------------------------------------
  Situation                            Chain behaviour                 PayNet behaviour
  ------------------------------------ ------------------------------- -------------------
  PayNet fully down                    Continues; other participants   Customers see a
                                       settle; nothing is lost         status page;
                                                                       queued intents are
                                                                       retried with the
                                                                       same UETR

  PayNet key compromise suspected      Governance suspends the         Revokes and
                                       participant (immediate,         rotates keys from
                                       evented); HSM policy caps the   cold management
                                       loss in the window              keys

  Event stream lag > 5 s               ---                             Alerts; customer
                                                                       statuses show
                                                                       "confirming", never
                                                                       "failed"

  Chain halted (Section 44.8)          No new finality                 Accepts no new
                                                                       outbound payments
                                                                       that need on-chain
                                                                       settlement;
                                                                       explains why
  ---------------------------------------------------------------------------------------

## 40D.9 Service Levels (targets, measured)

  ---------------------------------------------------------------------
  Measure                                              Target
  ---------------------------------------------------- ----------------
  Internal APN payment, wallet tap → finalized         p50 ≤ 2 s,
                                                       p99 ≤ 4 s

  Finalized → PayNet customer notification             p99 ≤ 500 ms

  Event stream availability per PayNet site            99.95 %

  Reconciliation sweep at epoch boundary               complete within
                                                       one epoch
  ---------------------------------------------------------------------

## 40D.10 Joint Tests and Certification

-   A **reference PayNet** (thin, test-only implementation inside this
    repository at `tests/paynet-reference/`) exercises every interface
    in this section in CI, so the chain can never break PayNet's
    contract without a red build.
-   End-to-end suites: wallet → PayNet → chain → merchant; PayNet →
    escrow → SCT Inst (railsim) → beneficiary, including time-out and
    late `ACSC`; PayNet restart at every step with exactly-once
    effects; stream disconnect and resume at random cursors; duplicate
    submissions with re-signed transactions (must hit namespace 107).
-   PayNet's own repository runs the APN certification suite (Section
    40B.10) against a private network built from this repository's
    release artifacts on every PayNet release.

------------------------------------------------------------------------


# 41. Wallet Standard (APS-0030)

-   Key derivation: BIP-39 mnemonic (optional) → **SLIP-0010 Ed25519**
    hardened path `m/44'/<ALETHEIA_COIN_TYPE>'/<account>'/0'/<index>'`
    (coin type registered/assigned and recorded in APS-0030).
-   Addresses `AL:…`, transaction IDs `AL:T…`, block IDs `AL:B…`;
    wallets never display `0x`; wallets MUST verify network (HRP
    checksum) and `chain_id` before signing.
-   Signing flow: build body → **simulate** (`/transactions/simulate`
    returns eu_used, fee, effects) → display human summary (recipient,
    asset, amount, fee, network) → sign digest → submit → track to
    FINALIZED.
-   Hardware wallet architecture: device signs the 32-byte `TXSIG`
    digest after displaying a decoded summary (device-side ACE decoder
    for `Transfer` and `BatchTransfer`).
-   QR: `aletheia:AL:…?asset=AEY&amount=125.000000000000000000&memo=…`
    (URI scheme spec in APS-0030).
-   Backup/recovery: mnemonic or encrypted keystore (Argon2id +
    XChaCha20-Poly1305); social/multisig recovery via multisig accounts.
-   Wallet code never logs seeds, private keys or mnemonics (`Secret<T>`
    enforced).

------------------------------------------------------------------------

# 41A. Aletheia Explorer **\[DECISION ADR-024, ADR-033\]**

The Aletheia Explorer is the public face of the chain and of the
Republic's money. It must be **breathtaking** --- the interface people
screenshot, print, frame and send to each other --- and it must look
**designed by people with taste and intent**: a type designer, a
banknote engraver and an information designer working together. It must
never look assembled from an AI template, a UI kit or a crypto
dashboard. And it must be exact: every number on it can be verified in
the browser.

"Beautiful" is not left to taste alone. Section 41A.19 turns it into
gates that a pull request can fail.

## 41A.1 Design Concept --- "The Public Ledger"

The Explorer is a modern reinterpretation of a fine printed ledger, a
central-bank annual report and an engraved banknote: warm paper, deep
ink, hairline rules, generous margins, one precious metal used only
where something is truly final. It feels calm, exact and permanent ---
an institution's record of itself.

Five ideas carry the whole design:

1.  **Folio** --- every block is a ledger folio. The block page is laid
    out like a printed page: folio number (height) set enormous and
    light in the margin, entries in ruled rows, the seal of finality at
    the foot.
2.  **Seal** --- finality is shown as a brass seal of fine guilloche
    line-work, **generated from the block's own hash** (Section 41A.6).
    No two blocks share a seal. It is the one ornamental element and
    appears only when something is final.
3.  **Ribbon** --- a live horizontal ribbon of slots across the home
    page shows the chain breathing: each slot is a thin vertical mark
    moving from *proposed* (outline) → *certified* (ink) → *finalized*
    (brass).
4.  **Watermark** --- each object page carries, at 3 % ink, a large
    guilloche rosette derived from that object's identifier, bleeding
    off the right margin like the watermark of a banknote. It is felt
    more than seen; it disappears in high-contrast and print modes.
5.  **Chronicle** --- the chain's history is one continuous line from
    genesis to now. Protocol upgrades are chapters on that line, never
    breaks in it (Section 41A.8, Section 44).

## 41A.2 What It Must Not Look Like

Rejected on sight in design review, and wherever possible by CI
(Section 41A.19):

-   Purple-to-blue or neon gradients, gradient text, glows, glassmorphism,
    blurred gradient blobs, "aurora" backgrounds, animated mesh
    gradients.
-   A grid of identical rounded cards with drop shadows; four KPI tiles
    in a row as a home page; three-column "feature" grids; pill badges
    on everything; avatar circles for addresses (no identicons ---
    the seal family is our only generated art).
-   Dark-mode-only "terminal" styling; stock 3D or isometric
    illustrations; sparkle, rocket or magic-wand icons; emoji anywhere.
-   Generic copy: "Welcome to the future of finance", "Explore the
    blockchain", "Lightning fast", "Seamless".
-   Default component-library looks: default Tailwind palette and radius
    scale, shadcn / Material / Bootstrap / Chakra / DaisyUI components,
    Lucide / Heroicons / Feather icon sets, `rounded-2xl` +
    `shadow-lg` + `bg-gray-50` as a visual language.
-   Shimmering gradient skeletons; spinners in the middle of empty
    rectangles; toast notifications for things that are not events.
-   Any typeface other than Manrope, including monospace fonts for
    hashes.
-   Truncated identifiers with an ellipsis in the middle as the *only*
    representation (we group, we do not mutilate --- Section 41A.3).

## 41A.3 Typography --- Manrope Only

**Manrope is the only typeface** in the Explorer, the docs site, the
wallet UI, charts, emails, Open Graph images and print output. The
system fallback exists only for the instant before Manrope loads.

-   Self-hosted variable WOFF2 (weights 200--800), subset to Latin,
    Latin Extended-A/B (Serbian Latin, Dutch, German, Italian), Cyrillic
    if Serbian Cyrillic is enabled, and the currency and math glyphs in
    use; served from the Explorer's own origin with
    `font-display: swap` and `<link rel="preload">`. No third-party
    font CDN at runtime. The SIL Open Font License ships with the font.
-   **All numbers use tabular figures**. Heights, amounts and times line
    up in columns to the pixel.
-   **Identifiers** (`AL:…`, `AL:T…`, `AL:B…`, base16 hashes, AAN, AIC)
    are set in Manrope weight 500, tabular figures, +0.02em tracking,
    shown in groups of four separated by a thin space (U+2009) that is
    **not** part of the copied text. Full identifiers are shown in full
    wherever there is room; in dense tables, the first 8 and last 6
    characters with a hairline gap and a full-value tooltip; copy always
    yields the exact canonical string; select-all on an identifier
    selects exactly the identifier.
-   **Labels** above values: 0.75rem, weight 600, uppercase, +0.08em
    tracking, `--ink-faint`. Values: 1rem, weight 500, `--ink`.
-   Optical details are part of the spec: hanging punctuation for
    quotes in prose (`hanging-punctuation: first`), `text-wrap: balance`
    on headings, `text-wrap: pretty` on paragraphs, no widows in
    figure captions, en dashes in ranges (`4,096–4,100`), true minus
    sign (U+2212) for negative amounts, multiplication sign (U+00D7)
    in dimensions.

``` css
/* explorer/src/styles/fonts.css */
@font-face {
  font-family: "Manrope";
  src: url("/fonts/manrope-variable.woff2") format("woff2-variations");
  font-weight: 200 800;
  font-style: normal;
  font-display: swap;
}

:root {
  --font: "Manrope", system-ui, sans-serif;   /* system-ui covers the first paint only */

  /* Hand-tuned scale. Each step was set on printed proofs, not generated from a ratio. */
  --text-folio:   clamp(4rem, 2.4rem + 6vw, 7.5rem);   /* block height on the folio page */
  --text-display: clamp(2.25rem, 1.6rem + 2.4vw, 3.5rem);
  --text-title:   1.75rem;
  --text-heading: 1.25rem;
  --text-body:    1rem;
  --text-small:   0.875rem;
  --text-caption: 0.75rem;

  --leading-tight: 1.05;
  --leading-body:  1.6;
}

body {
  font-family: var(--font);
  font-size: var(--text-body);
  line-height: var(--leading-body);
  font-feature-settings: "tnum" 1;
  font-optical-sizing: auto;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

h1, h2, h3 { text-wrap: balance; }
p { text-wrap: pretty; hanging-punctuation: first; }

.label {
  font-size: var(--text-caption);
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink-faint);
}

.identifier {
  font-weight: 500;
  letter-spacing: 0.02em;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.folio-number {
  font-size: var(--text-folio);
  font-weight: 200;               /* very light, very large — the page's signature */
  letter-spacing: -0.035em;
  line-height: var(--leading-tight);
  font-variant-numeric: tabular-nums lining-nums;
}
```

## 41A.4 Colour, Paper and Ink

``` css
/* explorer/src/styles/tokens.css */
:root {
  /* Paper (light) */
  --paper:        #F6F3EC;   /* page */
  --vellum:       #EDE8DD;   /* raised surfaces, table stripes */
  --rule:         #D8D1C2;   /* hairlines */
  --rule-strong:  #BDB4A2;   /* section rules, table heads */
  --ink:          #16181C;   /* primary text */
  --ink-soft:     #4A4E55;   /* secondary text */
  --ink-faint:    #6E7178;   /* captions, labels — 4.6:1 on --paper */

  /* Accents — used sparingly, each with one meaning */
  --ledger-green: #0F5C4A;   /* links, AEY, incoming value */
  --brass:        #A9824B;   /* finality: seal, finalized marks, focus rings. Nothing else. */
  --brass-deep:   #7E5F33;   /* brass text on paper (meets 4.5:1) */
  --oxblood:      #9B2F28;   /* failures, rejected, traps, corrections */
  --slate-blue:   #34506B;   /* ALnT, informational */

  --radius: 2px;             /* printed, not bubbly */
  --hairline: 1px solid var(--rule);
  --grain-opacity: 0.035;
}

:root[data-theme="dark"] {
  /* Night ledger — warm, low glare, never neon */
  --paper:        #111315;
  --vellum:       #181B1E;
  --rule:         #2A2E33;
  --rule-strong:  #3A3F45;
  --ink:          #ECE7DC;
  --ink-soft:     #B3AEA4;
  --ink-faint:    #8C877E;
  --ledger-green: #5FAF94;
  --brass:        #C9A46A;
  --brass-deep:   #D6B47E;
  --oxblood:      #D0685E;
  --slate-blue:   #8FA9C4;
  --grain-opacity: 0.05;
}

@media (prefers-contrast: more) {
  :root { --rule: #8C8576; --ink-faint: #4A4E55; --grain-opacity: 0; }
}
```

Rules: colour carries meaning, never decoration. Brass appears only for
finality (and for focus rings, which are a promise of action). Large
areas are paper and ink; accents cover under 10 % of any screen. Every
text/background pair meets WCAG 2.2 AA (4.5:1 body, 3:1 large text),
checked in CI from the token file.

**Paper grain**: one 256 × 256 px tile of hand-tuned noise, baked as an
AVIF of ≤ 6 KB, laid over `--paper` at `--grain-opacity`. Not an SVG
`feTurbulence` filter (cost on every repaint), not a texture photo.
Disabled for `prefers-contrast: more`, in print, and when the user
chooses "plain paper" in settings.

## 41A.5 Layout, Grid and Rhythm

-   12-column grid; content width capped at 1240 px; outer margins
    24 px (phone), 40 px (tablet), 64--96 px (desktop). A **margin
    column** (2 of 12 columns on desktop, collapsing above content on
    phones) holds folio numbers, timestamps and section marks, as in a
    printed report.
-   Baseline rhythm of 8 px; every vertical gap is a multiple of 8.
    Table rows are 44 px (comfortable) or 36 px (dense, user setting).
-   Hairline rules instead of boxes and shadows. Depth comes from paper
    tone (`--paper` vs `--vellum`), never from `box-shadow`.
-   Tables are the heart of the product: ruled rows, right-aligned
    tabular numbers, sticky headers with a `--rule-strong` underline,
    zebra striping in `--vellum` only on dense tables, column
    alignment by decimal separator for amounts.
-   Icons: a custom set of ≤ 40 line icons drawn for the Explorer on a
    20 px grid, 1.25 px stroke, square caps, mitred joins, stored as one
    SVG sprite. No off-the-shelf icon set.
-   Empty, loading and error states are designed pages: skeleton rows
    keep the exact table geometry in `--vellum` with no shimmer; errors
    say what happened and what to do, in one or two sentences.

## 41A.6 The Seal --- Generative Guilloche

Banknote engravers built guilloche with geometric lathes; we build it
from the block hash. The seal is what people screenshot.

-   Three rosette layers (outer, middle, inner), each a hypotrochoid
    whose rolling-circle size, pen distance and rotation come from
    different bytes of the block hash. A fixed outer border of two
    concentric hairlines and a ring of 120 fine ticks frames them.
-   Brass on paper (`--brass`), 0.6 px strokes at 96 px display size,
    scaled stroke at larger sizes (`vector-effect: non-scaling-stroke`
    is **not** used: the line weight should grow with the seal on the
    Open Graph image).
-   The seal draws itself once (≈ 600 ms, `stroke-dashoffset`) when a
    block you are viewing becomes final; otherwise it is static.
-   Deterministic to the pixel (rounded to 0.01 px), not to the bit.
    It is ornament and recognition, **never** proof. The Verify button
    is the proof (Section 41A.12).

``` ts
// explorer/src/lib/seal/guilloche.ts
//
// Every finalized block gets its own seal. The curves are hypotrochoids — the path of a pen
// fixed to a circle rolling inside another circle, the same geometry as a rose-engine lathe.
// The fixed circle has 120 "teeth" because 120 has many divisors: the rolling-circle sizes
// below all close after at most 9 turns, which keeps each path under ~2,200 points.
// Pen ranges were chosen on printed proofs; outside them the line-work turns to moiré at 96 px.

const FIXED_TEETH = 120;
const ROLLING_TEETH = [36, 45, 50, 54, 56, 64, 72] as const;

interface LayerSpec {
  readonly radius: number;        // in seal units; the seal's viewBox is −50…50
  readonly penMin: number;        // pen distance as a fraction of the rolling circle
  readonly penMax: number;
  readonly samplesPerTurn: number;
  readonly opacity: number;
}

const LAYERS: readonly LayerSpec[] = [
  { radius: 44, penMin: 0.55, penMax: 0.92, samplesPerTurn: 240, opacity: 1 },
  { radius: 31, penMin: 0.42, penMax: 0.85, samplesPerTurn: 200, opacity: 0.82 },
  { radius: 17, penMin: 0.30, penMax: 0.70, samplesPerTurn: 160, opacity: 0.68 },
];

export interface SealLayer {
  readonly d: string;
  readonly opacity: number;
}

export function sealLayers(blockHash: Uint8Array): SealLayer[] {
  if (blockHash.length !== 32) {
    throw new RangeError(`a block hash is 32 bytes; got ${blockHash.length}`);
  }
  return LAYERS.map((layer, i) => {
    const [teethByte, penByte, angleByte] = blockHash.subarray(i * 3, i * 3 + 3);
    const rolling = ROLLING_TEETH[teethByte % ROLLING_TEETH.length];
    const pen = rolling * (layer.penMin + (penByte / 255) * (layer.penMax - layer.penMin));
    const rotation = (angleByte / 256) * 2 * Math.PI;
    return {
      d: hypotrochoid(FIXED_TEETH, rolling, pen, rotation, layer.radius, layer.samplesPerTurn),
      opacity: layer.opacity,
    };
  });
}

function hypotrochoid(
  fixed: number,
  rolling: number,
  pen: number,
  rotation: number,
  radius: number,
  samplesPerTurn: number,
): string {
  const turns = rolling / gcd(fixed, rolling);
  const ratio = (fixed - rolling) / rolling;
  const scale = radius / (fixed - rolling + pen);
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const steps = turns * samplesPerTurn;

  const parts: string[] = [];
  for (let step = 0; step < steps; step++) {
    const t = (step / samplesPerTurn) * 2 * Math.PI;
    const x = (fixed - rolling) * Math.cos(t) + pen * Math.cos(ratio * t);
    const y = (fixed - rolling) * Math.sin(t) - pen * Math.sin(ratio * t);
    const px = scale * (x * cos - y * sin);
    const py = scale * (x * sin + y * cos);
    parts.push(`${step === 0 ? "M" : "L"}${px.toFixed(2)} ${py.toFixed(2)}`);
  }
  parts.push("Z");
  return parts.join("");
}

function gcd(a: number, b: number): number {
  while (b !== 0) [a, b] = [b, a % b];
  return a;
}
```

``` svelte
<!-- explorer/src/lib/components/Seal.svelte -->
<script lang="ts">
  import { sealLayers } from "$lib/seal/guilloche";

  let { blockHash, size = 96, drawOnMount = false }:
    { blockHash: Uint8Array; size?: number; drawOnMount?: boolean } = $props();

  const layers = $derived(sealLayers(blockHash));
  const ticks = Array.from({ length: 120 }, (_, i) => (i * 3 * Math.PI) / 180);
</script>

<svg
  class="seal"
  class:drawing={drawOnMount}
  width={size}
  height={size}
  viewBox="-50 -50 100 100"
  role="img"
  aria-label="Finality seal for this block"
>
  <circle r="49" />
  <circle r="47.5" />
  {#each ticks as angle}
    <line x1={Math.cos(angle) * 45.5} y1={Math.sin(angle) * 45.5}
          x2={Math.cos(angle) * 47}   y2={Math.sin(angle) * 47} />
  {/each}
  {#each layers as layer}
    <path d={layer.d} opacity={layer.opacity} pathLength="1" />
  {/each}
</svg>

<style>
  .seal { display: block; color: var(--brass); }
  circle, line, path { fill: none; stroke: currentColor; stroke-width: 0.6; }
  line { stroke-width: 0.4; }

  .drawing path {
    stroke-dasharray: 1;
    stroke-dashoffset: 1;
    animation: engrave 600ms cubic-bezier(0.2, 0.7, 0.1, 1) forwards;
  }
  .drawing path:nth-of-type(2) { animation-delay: 80ms; }
  .drawing path:nth-of-type(3) { animation-delay: 160ms; }

  @keyframes engrave { to { stroke-dashoffset: 0; } }

  @media (prefers-reduced-motion: reduce) {
    .drawing path { animation: none; stroke-dashoffset: 0; }
  }
</style>
```

## 41A.7 Amounts --- Exact and Calm

AEY has 18 decimals. Showing all 18 everywhere is noise; hiding them is
a lie. The Explorer shows the **precision tail**: the euro-cent part in
full ink, the remaining sub-cent digits in `--ink-faint` at 80 % size,
trailing zeros of the tail dropped, and the exact value in the copy
buffer and tooltip.

``` text
125.00 AEY                       exactly 125
125.00 0042 AEY                  125.0000420000… → tail shows significant sub-cent digits
1 250 000.00 AEY  (fr/nl/de/sr/it locale grouping applied to the whole part only)
```

``` ts
// explorer/src/lib/format/amount.ts
// Base units arrive as decimal strings (Section 37.1). BigInt only: a Number cannot hold
// 10^18-scaled values and would round silently.

export interface AmountParts {
  readonly whole: string;          // locale-grouped
  readonly fraction: string;       // the displayed decimals, e.g. "00"
  readonly tail: string;           // significant sub-display digits, grouped in fours, or ""
  readonly decimalSeparator: string;
  readonly exact: string;          // canonical decimal string for copy and title
  readonly negative: boolean;
}

export function splitAmount(
  baseUnits: string,
  decimals: number,
  displayDecimals: number,
  locale: string,
): AmountParts {
  if (!/^-?\d+$/.test(baseUnits)) {
    throw new TypeError(`amount must be a decimal string of base units; got "${baseUnits}"`);
  }
  const negative = baseUnits.startsWith("-");
  const units = BigInt(negative ? baseUnits.slice(1) : baseUnits);
  const scale = 10n ** BigInt(decimals);
  const wholeUnits = units / scale;
  const fractionDigits = (units % scale).toString().padStart(decimals, "0");

  const grouping = new Intl.NumberFormat(locale, { useGrouping: true, maximumFractionDigits: 0 });
  const decimalSeparator =
    new Intl.NumberFormat(locale).formatToParts(1.5).find((p) => p.type === "decimal")?.value ?? ".";

  const tailDigits = fractionDigits.slice(displayDecimals).replace(/0+$/, "");
  return {
    whole: grouping.format(wholeUnits),
    fraction: fractionDigits.slice(0, displayDecimals),
    tail: tailDigits.replace(/(\d{4})(?=\d)/g, "$1\u2009"),
    decimalSeparator,
    exact: `${negative ? "-" : ""}${wholeUnits}.${fractionDigits}`,
    negative,
  };
}
```

`Intl.NumberFormat.format` accepts `bigint` in every supported browser;
a CI test pins this behaviour.

## 41A.8 Signature Pages

  --------------------------------------------------------------------------------------
  Page                         Design
  ---------------------------- ---------------------------------------------------------
  **Home**                     The live Ribbon across the top. Beneath it, the current
                               finalized height as a light folio number with its seal.
                               A two-column ledger of latest blocks and latest
                               transactions. Network facts as one sentence, not tiles:
                               *"Finalized block 1,048,576 in 1.2 s · epoch 4,096 · 7 of
                               7 validators signing · 12.4 M AEY outstanding · protocol
                               version 3."*

  **Block (folio)**            Height huge in the margin column; header fields as a
                               ruled definition list; transactions as ruled entries;
                               the Seal at the foot with "Finalized · 2-chain
                               certificate · 7 of 7 signatures · protocol version 3" and
                               a **Verify** button. Previous/next folio navigation on
                               the page edges, keyboard `←` `→`.

  **Transaction (receipt)**    A well-designed receipt: sender → recipient with the
                               amount set large; fee and EU below a hairline; status
                               line; events as itemised lines; the proof trail
                               (receipt → block → finality) as a three-step line the
                               Verify button walks through.

  **Account**                  Balances per asset with the precision tail; nonce; AAN
                               where public; participant badge where the address is a
                               settlement account (AIC, role, status); activity ledger
                               with filters by asset, direction and type.

  **Treasury statement**       AEY and ALnT supply set like a central-bank statement:
                               issued, burned, redeemed, circulating, locked, reserved,
                               bridge escrow, external-leg escrow (namespace 108),
                               physical cash outstanding as reported. Every invariant
                               I1--I15 shown with its current check against the state
                               root, in plain words. Corrections (Section 44.8) listed
                               with their governance proposals.

  **Validators**               An epoch timetable: validators as rows, slots as fine
                               columns, each cell a signed / missed / proposed mark ---
                               beautiful at a glance, precise on hover.

  **Payments**                 Public view of APN settlement: volume by scheme, by
                               hour, as hand-drawn SVG bar charts in ink. Lookup by
                               UETR (hashed in the browser; the UETR never leaves the
                               device) shows the on-chain leg and, where present, the
                               external-leg escrow state as an **itinerary**: a single
                               ruled line with stations (Initiated → Escrowed →
                               Partner bank → SEPA Instant → Settled) and their protocol
                               times. Personal data is never shown --- it is not
                               on-chain. Authorized participants see the full itinerary
                               in PayNet's portal, built from the same components.

  **Directory**                APN participants: AIC, role, schemes, status, certified
                               epoch --- set like a printed bank directory, alphabetical
                               with section letters in the margin.

  **Bridge**                   Routes as timetables: route, remote chain, status,
                               limits and usage as slim bars, recent transfers with
                               both-side confirmations.

  **Registries**               Identity, residence and land records with their full,
                               readable history.

  **Chronicle**                The chain's life as one continuous vertical line from
                               genesis to the current height. Protocol versions are
                               chapters on the line (activation height, epoch, what
                               changed in plain words, links to APS and ADRs, approving
                               proposal). Halts and corrections appear as marked
                               passages in oxblood. The line never breaks: that is
                               Section 44 made visible.

  **Network**                  Finality latency p50/p99 over the last day as a fine
                               line chart; validator participation; peer versions
                               (public sentries); upcoming activation with a countdown
                               in heights, not seconds.

  **Not found**                "There is no folio at height 9,999,999 yet. The chain is
                               at 1,048,576." --- with the search field ready.
  --------------------------------------------------------------------------------------

## 41A.9 Search

One field, always reachable with `/`. It recognises, without a mode
switch: heights (with or without grouping), `AL:` addresses, `AL:T`
transaction IDs, `AL:B` block IDs, 64-character hashes (state roots,
code hashes), AAN (`ALX…`, MOD-97 checked before any request), AIC,
UETR (hashed locally, Section 41A.8), epoch (`epoch 4096`) and
validator names. Invalid checksums are explained inline
(`This AAN's check digits don't match — the last two digits may be swapped`).
`0x`-prefixed input is refused with one sentence explaining that
Aletheia does not use it (Section 12.2).

## 41A.10 Languages, Numbers and Time

-   Five official languages (English, German, Dutch, Serbian, Italian),
    with Serbian in Latin and, if enabled by governance, Cyrillic.
    Strings live in ICU MessageFormat files, written by native speakers;
    no machine-translated copy ships.
-   Numbers use the locale's grouping and decimal separator; identifiers
    are never localized.
-   Time: protocol time in UTC with the offset written out
    (`14:03:21 UTC`), local time as a secondary line on hover. Relative
    time ("12 s ago") only as a secondary hint, never as the only time.

## 41A.11 Motion

-   Quiet and purposeful: 160--240 ms, easing
    `cubic-bezier(0.2, 0.7, 0.1, 1)`; no bounce, no parallax, no
    auto-playing decoration.
-   The Ribbon advances smoothly as slots finalize; new rows enter
    tables by fading in their ink over 200 ms, never by sliding.
-   The Seal engraves itself once when a block you are viewing becomes
    final.
-   `prefers-reduced-motion: reduce` turns every motion into an instant
    state change.

``` svelte
<!-- explorer/src/lib/components/FinalityRibbon.svelte -->
<script lang="ts">
  import type { SlotMark } from "$lib/chain/types";
  import { formatHeight } from "$lib/format/height";

  let { slots, locale }: { slots: SlotMark[]; locale: string } = $props();

  // One mark plus its gap, in CSS pixels. At 500 ms slots this puts about two minutes
  // of history across the 1240 px content column — long enough to see a missed slot.
  const MARK = 3;
  const GAP = 2;

  const lastFinalized = $derived(slots.findLast((slot) => slot.state === "finalized"));
</script>

<figure class="ribbon" aria-label="Recent slots and their finality">
  <svg viewBox="0 0 {slots.length * (MARK + GAP)} 40" preserveAspectRatio="none" role="img">
    {#each slots as slot, i (slot.number)}
      <rect
        x={i * (MARK + GAP)}
        y={slot.state === "skipped" ? 30 : 4}
        width={MARK}
        height={slot.state === "skipped" ? 6 : 32}
        class={slot.state}
      >
        <title>Slot {formatHeight(slot.number, locale)} — {slot.state}</title>
      </rect>
    {/each}
  </svg>
  {#if lastFinalized}
    <figcaption>
      Finalized to block <strong>{formatHeight(lastFinalized.height, locale)}</strong>
    </figcaption>
  {/if}
</figure>

<style>
  .ribbon { margin: 0; }
  svg { width: 100%; height: 40px; display: block; }
  rect { transition: fill 200ms cubic-bezier(0.2, 0.7, 0.1, 1); }
  .proposed  { fill: none; stroke: var(--ink-faint); stroke-width: 1; }
  .certified { fill: var(--ink); }
  .finalized { fill: var(--brass); }
  .skipped   { fill: var(--rule); }
  figcaption { font-size: var(--text-small); color: var(--ink-soft); margin-top: 0.5rem; }

  @media (prefers-reduced-motion: reduce) {
    rect { transition: none; }
  }
</style>
```

## 41A.12 Verification in the Browser

Beauty must not cost trust. The Rust verifiers for finality proofs, JMT
state proofs, receipt proofs and event proofs live in one crate,
`crates/verify` (`no_std` + `alloc`, `#![forbid(unsafe_code)]`), which
the node, PayNet and the browser all use. The browser build targets
`wasm32-unknown-unknown` through `wasm-bindgen`, is built reproducibly
in the release pipeline, and its hash is published in the release
manifest. The Verify button runs locally and reports in plain words:
*"Verified in your browser against the validator set for epoch 4,096,
under protocol version 3."* The verifier supports every protocol
version in `frozen.toml` (Section 44.7).

## 41A.13 Version-Aware Rendering

The Explorer outlives every release. It decodes with a registry keyed
by `(protocol_version, tx_type)` and `(event_schema, event_kind)`,
generated from the APS type definitions. When it meets a type it does
not know:

``` text
Transaction type 151 · introduced in protocol version 5
This Explorer build does not have a reader for this type yet.
Canonical body (ACE, 412 bytes)   3c91 a0e4 7f12 …   [copy]   [verify inclusion]
```

The page still verifies, still links, still shows fees and status from
the receipt. Nothing breaks when the chain learns something new.

## 41A.14 Architecture and Data

  ---------------------------------------------------------------------------------------
  Concern               Choice                                 Why
  --------------------- -------------------------------------- --------------------------
  Framework             SvelteKit 2, Svelte 5 runes,           Small bundles, server
                        TypeScript strict, SSR with            rendering, plain HTML/CSS
                        `adapter-node`                         feel

  Read API              `aletheia-explorer-api` (Rust, Axum)   Typed, fast, one place for
                        over a PostgreSQL read replica of the  query limits; the Explorer
                        indexer; finality and proofs proxied   never talks to validators
                        from full nodes

  Live updates          One WebSocket per tab to the explorer  Ribbon, home ledger, block
                        API (`finalized-blocks`, `slots`),     becoming final
                        fed by the Finalized Event Stream

  Styling               Hand-written CSS with tokens; Svelte   No utility-class look, no
                        component styles                       kit defaults

  Charts                Hand-drawn SVG; `d3-scale` and         Charts in the ledger style
                        `d3-shape` for maths only              exactly

  Proofs                `crates/verify` → WASM                 Trust what you see

  OG images             Server-rendered SVG (seal + folio      Shared links look like the
                        number + Manrope) → PNG via `resvg`    product
  ---------------------------------------------------------------------------------------

Caching --- finalized data is immutable, so the Explorer is fast for
free:

-   Pages for finalized blocks, transactions and receipts are addressed
    by height and hash and served with
    `Cache-Control: public, max-age=31536000, immutable`.
-   Head-dependent pages (home, network, account balances) use
    `max-age=1, stale-while-revalidate=5` and hydrate live.
-   The explorer API rejects unbounded queries: cursor pagination only,
    max 1,000 rows, time-boxed SQL (`statement_timeout`), per-IP and
    per-key rate limits.

Print: a print stylesheet turns a block folio or a transaction receipt
into a one-page A4/Letter document with the seal, the full identifiers
and a QR code back to the canonical URL.

## 41A.15 Security of the Explorer

-   Strict CSP: `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; img-src 'self' data:; connect-src 'self' wss://<explorer-host>; frame-ancestors 'none'; base-uri 'none'; form-action 'self'`.
    No third-party scripts, analytics, fonts or CDNs.
-   HSTS with preload, `X-Content-Type-Options: nosniff`,
    `Referrer-Policy: strict-origin-when-cross-origin`,
    `Permissions-Policy` denying every sensor and payment API.
-   npm supply chain: lockfile committed, `npm ci --ignore-scripts`,
    allow-list of packages reviewed by security, provenance checks,
    Socket/OSV scan in CI; the production bundle contains no package
    outside the allow-list.
-   Lookalike-address defence: addresses are always shown with their
    Bech32m checksum intact and grouped; the search refuses addresses
    whose checksum fails and never "did you mean"s into a different
    valid address.

## 41A.16 Performance Budgets (CI-enforced, Lighthouse CI + WebPageTest)

-   LCP < 1.5 s on a mid-range phone over 4G for a cached folio page;
    < 2.0 s uncached.
-   Initial JS ≤ 90 KB gzipped (the WASM verifier loads only on
    **Verify**). CSS ≤ 30 KB. Manrope subset ≤ 70 KB.
-   CLS < 0.02; INP < 150 ms.
-   Lighthouse Performance, Accessibility, Best Practices ≥ 95.

## 41A.17 Accessibility

-   axe-core: zero violations on every page, light and dark.
-   Full keyboard navigation with a visible brass focus ring (2 px,
    offset 2 px).
-   Every chart has a data table equivalent one keystroke away.
-   The Seal and Watermark are `aria-hidden` ornament except where
    labelled as the finality indicator; finality is always also stated
    in words.

## 41A.18 Design System Source of Truth

`docs/design/explorer-design-system.md` holds tokens, type scale, grid,
icon set, components and page specs; the Figma file is linked from it
and is reviewed together with code. Tokens are generated into CSS from
one `tokens.json`; nobody types a hex value into a component.

## 41A.19 Quality Gates --- Making "Beautiful" Enforceable

  -------------------------------------------------------------------------------------
  Gate                          Check
  ----------------------------- -------------------------------------------------------
  Human design sign-off         A named designer approves every new or changed page
                                against 41A.1--41A.11 before merge.

  Design rubric                 Scored 1--5 by the designer on: typographic hierarchy,
                                alignment to grid and baseline, restraint of colour,
                                data density without clutter, the state designs
                                (empty/loading/error), motion restraint, "would someone
                                screenshot this?". Any score < 4 blocks merge.

  `scripts/check_ui_tells.sh`   Fails on: `font-family` other than Manrope (+ first-
                                paint fallback); any font file other than Manrope;
                                `linear-gradient`/`radial-gradient`/`conic-gradient`
                                except in the allow-listed paper-grain and print files;
                                `backdrop-filter`; `box-shadow` outside focus styles;
                                `border-radius` above `var(--radius)`; imports of
                                `lucide-*`, `@heroicons/*`, `feather-*`, `shadcn`,
                                `@mui/*`, `bootstrap`, `daisyui`, `tailwindcss`;
                                emoji code points in source or copy; hex colours outside
                                `tokens.json`.

  Visual regression             Playwright screenshots of every page in light and dark,
                                phone and desktop, five languages; any pixel change
                                needs approval.

  Accessibility                 axe-core zero violations; keyboard e2e paths.

  Copy                          `scripts/check_prose.sh` (Section 3.4); every string
                                reviewed by a native speaker per language.

  Tests and coverage            Vitest unit tests (amount formatting, seal determinism,
                                search parsing, decoders); Playwright e2e; Explorer
                                TypeScript coverage ≥ 85 % lines / 75 % branches;
                                explorer-api Rust coverage per Section 52.1.

  Performance                   Budgets in 41A.16.
  -------------------------------------------------------------------------------------

------------------------------------------------------------------------


# 42. Storage Engine and Databases (APS-0033, APS-0034) **\[DECISION ADR-006/007\]**

## 42.1 Storage Abstraction

``` rust
// crates/storage/src/kv.rs

/// The only way consensus code touches persistent key-value storage. RocksDB is the
/// production backend; an in-memory backend exists for tests; both pass the same
/// conformance suite (crates/storage/tests/kvstore_conformance.rs). Consensus correctness
/// must not depend on anything this trait does not promise.
pub trait KvStore: Send + Sync {
    fn get(&self, cf: ColumnFamily, key: &[u8]) -> Result<Option<Vec<u8>>, AletheiaError>;

    /// Ascending key order, bounded. Iteration order is part of the contract.
    fn range(&self, cf: ColumnFamily, from: &[u8], to: &[u8], limit: usize)
        -> Result<Vec<(Vec<u8>, Vec<u8>)>, AletheiaError>;

    fn batch(&self) -> WriteBatch;

    /// Atomic and durable when it returns Ok: all writes or none, surviving power loss.
    fn write_sync(&self, batch: WriteBatch) -> Result<(), AletheiaError>;

    /// Atomic, not yet durable. Never used on the finalize path.
    fn write(&self, batch: WriteBatch) -> Result<(), AletheiaError>;

    /// Consistent point-in-time read view (RPC, snapshots, migrations).
    fn snapshot(&self) -> Box<dyn KvSnapshot + '_>;

    /// Hard-link checkpoint into `dir` (Section 44.5 migration step 2).
    fn checkpoint(&self, dir: &std::path::Path) -> Result<(), AletheiaError>;
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum ColumnFamily { JmtNodes, StateValues, StaleJmtNodes, BlockIndex, TxIndex, Receipts, Events, FinalityProofs, Meta }
```

A `KvStore` conformance test suite
(`crates/storage/tests/kvstore_conformance.rs`) runs against every backend.

## 42.2 RocksDB Configuration (compression and integrity)

``` rust
// crates/storage/src/rocks.rs — the settings that matter, with the reason for each.

pub(crate) fn state_db_options(budget: &StorageBudget) -> rocksdb::Options {
    let mut options = rocksdb::Options::default();
    options.create_if_missing(false);              // a missing DB is an operator error, not a fresh start
    options.set_paranoid_checks(true);             // surface corruption at open, not at first read
    options.set_max_open_files(budget.max_open_files);
    options.set_bytes_per_sync(1 << 20);           // smooth background writeback; avoids fsync stalls
    options.set_max_background_jobs(budget.background_jobs);

    // Compression is a storage artifact only; commitments are over uncompressed ACE bytes.
    // LZ4 on hot levels for latency, zstd with a trained dictionary on cold levels for size.
    options.set_compression_per_level(&[
        rocksdb::DBCompressionType::None,
        rocksdb::DBCompressionType::Lz4,
        rocksdb::DBCompressionType::Lz4,
        rocksdb::DBCompressionType::Zstd,
        rocksdb::DBCompressionType::Zstd,
        rocksdb::DBCompressionType::Zstd,
        rocksdb::DBCompressionType::Zstd,
    ]);
    options.set_zstd_max_train_bytes(100 << 20);

    let mut table = rocksdb::BlockBasedOptions::default();
    table.set_block_cache(&rocksdb::Cache::new_lru_cache(budget.block_cache_bytes));
    table.set_bloom_filter(10.0, false);            // JMT node lookups are point reads
    table.set_format_version(5);
    table.set_checksum_type(rocksdb::ChecksumType::XXH3);
    options.set_block_based_table_factory(&table);
    options
}

pub(crate) fn finalize_write_options() -> rocksdb::WriteOptions {
    let mut write = rocksdb::WriteOptions::default();
    write.set_sync(true);        // Section 24.2: the finalize batch is durable before FINALIZE_COMMITTED
    write.disable_wal(false);    // RocksDB's own WAL stays on; the consensus WAL is in addition, not instead
    write
}
```

**Compression never affects commitments.** All hashes are computed over
canonical *uncompressed* ACE bytes; compressed bytes are storage
artifacts only.

## 42.3 Block Archive

``` text
blocks/seg-000000000123.blk   (≤ 256 MiB each, append-only, fsync on finalize)
Record:  u32 len | u32 crc32c | u64 height | Hash32 block_hash | zstd_frame(ACE(Proposal))
Dictionary: blocks/dict-v1.zdict (trained on devnet corpus; dict_id embedded in each zstd frame;
            old dictionaries retained forever)
Index (RocksDB BlockIndex CF): height → {segment, offset, len}, hash → height
Read path: read → verify crc → decompress → recompute block_hash from ACE bytes → must match
```

## 42.4 Pruning, Snapshots, State Sync

-   Node modes: `archive` (keep all JMT versions + all blocks), `full`
    (keep last `K` state versions, default 100,000 blocks; all blocks),
    `validator` (same as full; optional block pruning after snapshot).
-   JMT stale nodes are tracked in `StaleJmtNodes` CF and pruned in a
    background task rate-limited to protect consensus latency.
-   Snapshots every epoch boundary (configurable): state at finalized
    height `h`, chunked (16 MiB), zstd-compressed, with a manifest
    `{height, state_root, chunk_hashes[], finality_proof}`. Snapshots
    are verified chunk-by-chunk against JMT proofs during restore --- a
    snapshot is never trusted without proof.

## 42.5 Off-chain Indexer DB (PostgreSQL)

`aletheia-indexer` follows finalized blocks and writes query-optimized
tables (never read by consensus):

``` sql
CREATE TABLE blocks (
  height BIGINT PRIMARY KEY, hash BYTEA UNIQUE NOT NULL, slot BIGINT NOT NULL, epoch BIGINT NOT NULL,
  proposer SMALLINT NOT NULL, protocol_time TIMESTAMPTZ NOT NULL, tx_count INT NOT NULL,
  eu_used BIGINT NOT NULL, state_root BYTEA NOT NULL);

CREATE TABLE transactions (
  tx_id TEXT NOT NULL,                  -- 'AL:T…'
  height BIGINT NOT NULL REFERENCES blocks(height),
  idx INT NOT NULL, sender TEXT NOT NULL, tx_type SMALLINT NOT NULL, status SMALLINT NOT NULL,
  fee_asset INT NOT NULL, fee_charged NUMERIC(39,0) NOT NULL, eu_used BIGINT NOT NULL,
  body_zstd BYTEA NOT NULL,             -- compressed canonical body for detail views
  PRIMARY KEY (height, idx)
) PARTITION BY RANGE (height);
CREATE UNIQUE INDEX ON transactions (tx_id, height);
CREATE INDEX ON transactions (sender, height DESC);

CREATE TABLE transfers (
  height BIGINT, idx INT, leg SMALLINT, asset INT, sender TEXT, recipient TEXT,
  amount NUMERIC(39,0), PRIMARY KEY (height, idx, leg)) PARTITION BY RANGE (height);
```

Partitions per 10M heights; `pg_partman` for management; TOAST
compression set to `lz4`.

------------------------------------------------------------------------

# 43. Genesis (APS-0035)

Deterministic from a canonical TOML config → ACE-encoded `GenesisState`
→ `genesis_id`:

``` toml
# genesis/devnet.toml
[chain]
chain_id = 7771
network = "devnet"
protocol_version = 1
genesis_time_ms = 1767225600000
slot_duration_ms = 500

[crypto]
profile = "v1"            # BLAKE3-256, Ed25519, BLS12-381 min-pk

[[validators]]
operator = "AL:q…"
consensus_pubkey = "<base16>"
proof_of_possession = "<base16>"
node_identity_pubkey = "<base16>"
transport_cert_sha256 = "<base16>"

[assets.AEY]
authorized_capacity = "0"         # capacity is granted by governance after launch, not hard-coded
epoch_issuance_cap = "0"

[assets.ALnT]
initial_allocations = [ { address = "AL:q…", mites = "1000000000" } ]

[monetary_authority]
threshold = 3
keys = ["<base16>", "<base16>", "<base16>", "<base16>", "<base16>"]

[governance]
council_threshold = 4
council_keys = ["<base16>", "<base16>", "<base16>", "<base16>", "<base16>", "<base16>", "<base16>"]
```

`aletheia-genesis build genesis/devnet.toml` must produce identical
bytes and `genesis_id`/`state_root` on any machine (CI checks). Genesis
files for mainnet are produced in a documented ceremony with multiple
independent builders comparing hashes.

# 44. Chain Continuity and Protocol Evolution (APS-0036, APS-0054, APS-0055) **\[CONSENSUS-CRITICAL\] \[DECISION ADR-029, ADR-030\]**

Aletheia StableChain is national monetary infrastructure. It will gain
features for decades. Every one of those features must arrive without
stopping the chain's history: **the chain is born once, at genesis, and
never again.**

## 44.1 The Continuity Guarantee (normative)

For every release `R_new` and every supported earlier release `R_old`:

  --------------------------------------------------------------------------------
  ID     Guarantee
  ------ -------------------------------------------------------------------------
  C1     A node stopped under `R_old` at finalized height `h` MUST, when
         restarted with `R_new` on the same data directory, verify the
         directory, apply any storage migration, and continue at `h + 1`.
         No re-genesis, no resync from peers, no state export/import, no
         operator edits to state.

  C2     A fresh `R_new` node syncing from genesis MUST reproduce every
         historical block's `state_root`, `receipt_root` and `event_root`
         bit-for-bit, applying to each block the rules of the protocol
         version that was active at that block's height.

  C3     A node restoring a snapshot taken under any supported protocol
         version MUST verify it and continue from the snapshot height.

  C4     Finalized blocks are never rewritten, re-ordered, re-hashed or
         re-signed by any upgrade, migration or emergency procedure.

  C5     A binary that does not support the protocol version scheduled for
         the next height MUST stop cleanly at the last height it supports,
         with an exact message, and MUST NOT vote, propose or execute past
         it. It never diverges; it waits.

  C6     Off-chain services (indexer, explorer API, gateway, rail adapters,
         PayNet consumers of the event stream) continue from their last
         processed cursor across a protocol upgrade without re-indexing
         from zero.
  --------------------------------------------------------------------------------

C1, C2, C3 and C5 are **release gates** (Section 44.10). A release that
cannot demonstrate them is not shipped, whatever else it contains.

## 44.2 Change Classes

Every change is classified in its PR (label `change-class/N`) and in
the release manifest. The class decides the mechanism; nobody chooses
a mechanism by taste.

  ---------------------------------------------------------------------------------------------
  Class   What changes                         Mechanism                    Coordination
  ------- ------------------------------------ ---------------------------- -------------------
  0       Node-local behaviour that cannot     Ordinary release             Rolling restart,
          affect any hash: RPC additions,                                   quorum-safe
          logging, metrics, performance,                                    (Section 59A.4)
          caching, CLI

  1       On-disk layout: RocksDB column       Storage schema version +     Rolling restart;
          families, key encodings, archive     forward migration            migration runs at
          segment format, snapshot format,     (Section 44.5)               startup
          index layout

  2       Wire protocol: new P2P message       Protocol version range in    Support `N-1` and
          types, channels, sync formats        the handshake                `N` for one release
                                               (Section 36)                 train

  3       State-transition rules: new tx       New **protocol version**     Governance
          type, new native module, fee or      activated at an epoch        `UpgradePlan`,
          EU schedule, monetary rule, VM       boundary (Sections 44.3,     readiness
          semantics, new state namespace,      44.4)                        threshold,
          header extension                                                  switchover

  4       Cryptographic profile: hash,         New crypto profile id +      As class 3, plus a
          signature or aggregation algorithm   dual-acceptance window       key-rotation window
                                               (Section 17)

  5       Emergency: a safety or monetary      Coordinated halt and         Section 44.8
          defect in a live version             forward fix
  ---------------------------------------------------------------------------------------------

**Feature flags are forbidden in consensus code.** There is no
`if config.enable_x` anywhere that can change a hash. A behaviour that
affects state belongs to a protocol version, and a protocol version is
selected only by the height being executed.

## 44.3 Versioned Rules Registry **\[DECISION ADR-029\]**

The state-transition function is not one function that accumulates
`if version >= 3` branches over the years. Each protocol version has its
own rule set, and once a version has been active on mainnet its rule
set is **frozen**.

``` text
crates/execution/src/rules/
├── mod.rs          # Rules enum, dispatch by ProtocolVersion, shared helpers that are themselves frozen
├── v1/             # protocol version 1 — genesis rules (frozen at mainnet genesis)
│   ├── mod.rs
│   ├── transfer.rs
│   ├── fees.rs
│   └── …
├── v2/             # protocol version 2 — may reuse v1 modules by path; never edits them
└── frozen.toml     # versions active on any production network + mainnet activation heights
```

``` rust
// crates/execution/src/rules/mod.rs
//
// One variant per protocol version. Dispatch is an exhaustive match, not a trait object:
// adding a version is a compile error everywhere a version-specific decision is made,
// which is the point. A forgotten branch must not compile.

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum Rules {
    V1,
    V2,
}

impl Rules {
    pub fn for_version(version: ProtocolVersion) -> Result<Rules, AletheiaError> {
        match version.get() {
            1 => Ok(Rules::V1),
            2 => Ok(Rules::V2),
            other => Err(AletheiaError::new(
                ErrorCode::ProtocolVersionUnsupported,
                format!("protocol version {other} is newer than this binary (supports 1..=2)"),
            )),
        }
    }

    pub fn apply_transaction(
        self,
        overlay: &mut StateOverlay<'_>,
        tx: &VerifiedTransaction,
        ctx: &BlockContext,
    ) -> Result<Receipt, AletheiaError> {
        match self {
            Rules::V1 => v1::apply_transaction(overlay, tx, ctx),
            Rules::V2 => v2::apply_transaction(overlay, tx, ctx),
        }
    }

    pub fn tx_type_active(self, tx_type: TxType) -> bool {
        match self {
            Rules::V1 => v1::TX_TYPES.contains(&tx_type),
            Rules::V2 => v2::TX_TYPES.contains(&tx_type),
        }
    }
}
```

Rules:

1.  A rule-set module that appears in `frozen.toml` for a production
    network is changed only by refactors that the **historical replay
    gate** (Section 44.10) proves byte-identical. CI computes a
    fingerprint of each frozen module's source and fails with
    `frozen rule set v1 changed; attach replay evidence (label replay-verified)`
    unless the PR carries the replay label set by the release pipeline,
    not by the author.
2.  A bug in a frozen version is **never** fixed in place. It is fixed
    in the next protocol version, and any state it damaged is corrected
    by an explicit, governed state correction (Section 44.8).
3.  New transaction types, new state namespaces and new header
    extensions are introduced only by a new protocol version. Decoding a
    transaction type that is not active at the target height returns
    `TxTypeNotActive` at mempool admission and at execution.
4.  ACE structures are never extended by appending fields: decoders
    reject trailing bytes (Section 9 rule 9). A changed structure is a
    new tagged variant (`TransactionBodyV2`) or a sorted
    `ExtensionField` (Section 14.1). Old variants decode forever.
5.  Arno contracts record `arno_version` / VM version at deployment
    (namespace 49). Bytecode always executes under the VM semantics it
    was deployed with; the EU schedule for a call is the schedule of the
    **current** protocol version (fees are a network policy), but the
    instruction semantics are those of the contract's VM version.
    Moving a contract to a newer VM is an explicit, governed
    `ContractMigrate` operation with its own receipt.
6.  Shared helpers used by more than one version (`Amount::checked_add`,
    ACE primitives, hash domains) are themselves frozen once any
    version that uses them is frozen. A helper that needs to change is
    copied into the new version's module under a new name.

## 44.4 Protocol Schedule in State

The activation history lives in authenticated state so that every
node, light client, indexer and the Explorer reads the same answer.

``` text
ProtocolSchedule                         (state namespace 66, key: protocol_version u16)
├── protocol_version        u16
├── activation_height       u64       (first block executed under this version)
├── activation_epoch        u64
├── upgrade_id              Hash32    (UpgradePlan that scheduled it)
├── binary_hashes           list<Hash32>   (release manifest hashes approved for it)
├── migration_id            Optional<u32>  (deterministic state migration run in its first block)
└── recorded_at_height      u64
```

-   `UpgradePlan` (governance, timelock ≥ 8 epochs) writes a *pending*
    entry. At the epoch boundary before `activation_epoch`, the
    protocol checks readiness (`≥ min_readiness_bps` of voting power
    signed readiness, recorded on-chain). If met, the entry becomes
    *scheduled* with an exact `activation_height` (first height of the
    activation epoch). If not met, the plan expires deterministically
    and an `UpgradeNotActivated` event records why.
-   `BlockHeader.version` MUST equal the protocol version that the
    schedule assigns to `header.height`. A mismatch is
    `BlkVersionMismatch`.
-   The first block of a new version runs the version's deterministic
    migration (if any) **before** its transactions; the migration's
    effects are part of that block's state root and have test vectors.
-   RPC: `getProtocolSchedule`, `GET /api/v1/chain/protocol-schedule`.
    The Explorer's Chronicle page is built on it (Section 41A.8).

### Clean halt at the edge of a binary's knowledge (C5)

``` text
aletheiad 2.5.1 — stopped cleanly.

Protocol version 3 activates at height 4,194,304 (epoch 2,048).
This binary supports protocol versions 1–2.
Last finalized height: 4,194,303   hash: AL:Bq8f…7k2d   state root: 3c91…a0e4

Install a release that supports version 3 (approved hashes are in the
upgrade plan: `aletheia-cli upgrade show 9f3c…e1a0`) and start the node again.
It will continue from height 4,194,304. No other action is needed.
```

The node writes a `CHECKPOINT` WAL record, flushes, exits with status
`75` (`EX_TEMPFAIL`), and systemd does **not** restart it in a loop
(`RestartPreventExitStatus=75`, Section 59). The steward (Section
44.6) treats status 75 as "switch binary now".

## 44.5 Data Directory and Storage Schema (APS-0055) **\[DECISION ADR-030\]**

``` text
/var/lib/aletheia/
├── DATADIR                  ACE-encoded manifest + crc32c (authoritative)
├── DATADIR.txt              human-readable copy, written after DATADIR, never read by the node
├── LOCK                     flock target
├── wal/                     consensus WAL segments
├── state/                   RocksDB "state" instance
├── chain/                   RocksDB "chain" instance
├── blocks/                  archive segments + zstd dictionaries
├── snapshots/
└── migrations/              migration journal + pre-migration checkpoints
```

``` text
DataDirManifest
├── magic                    "ALDATA\0\1"
├── chain_id                 u32
├── genesis_id               Hash32
├── network_kind             u8
├── storage_schema           u32        (monotonic; one number for the whole directory)
├── min_reader_schema        u32        (oldest schema whose readers can still open this directory)
├── last_writer_release      Text[32]   ("aletheiad 2.5.1")
├── last_finalized           { height u64, hash Hash32, state_root Hash32 }
└── migration_in_progress    Optional<{ from u32, to u32, step u32, checkpoint_dir Text }>
```

Startup decision table:

  ----------------------------------------------------------------------------------------
  Condition                                     Action
  --------------------------------------------- ------------------------------------------
  `chain_id` or `genesis_id` differs from the   Refuse: `StoDataDirWrongChain` --- never
  configured genesis                            "fix up"

  `storage_schema == binary_schema`             Normal recovery (Section 24.3)

  `storage_schema < binary_schema`              Run migrations `s → s+1 → … → binary`,
                                                each on a checkpoint (below)

  `storage_schema > binary_schema` and          Open read-write; this is a downgrade the
  `min_reader_schema <= binary_schema`          newer release declared safe

  `storage_schema > binary_schema` and          Refuse:
  `min_reader_schema > binary_schema`           `data directory written by aletheiad 2.6.0 (schema 9); this binary reads schema ≤ 7`

  `migration_in_progress` is set                Resume that migration from its journal, or
                                                roll back to its checkpoint if the step is
                                                not resumable
  ----------------------------------------------------------------------------------------

Migration procedure (each step `s → s+1`):

1.  Recovery to a consistent finalized tip first (Section 24.3 steps
    1--8). Migrations never start from a dirty WAL.
2.  Create a RocksDB checkpoint of `state/` and `chain/` under
    `migrations/pre-<s>/` (hard links; seconds, not hours). Record
    `migration_in_progress` in `DATADIR` with `fsync` of file and
    directory.
3.  Run the step. Steps are written to be **idempotent and
    resumable**: they process keys in sorted order and journal the
    last completed key every 10,000 keys (`migrations/journal-<s>.ace`).
4.  Verify: recompute the JMT root at `last_finalized.height` from the
    migrated layout and compare with `last_finalized.state_root`;
    re-read the archive entry for the tip and recompute its block hash;
    run the step's own invariant check (for example, key counts per
    column family).
5.  Write the new `storage_schema` and clear `migration_in_progress`
    in one `DATADIR` replacement (write temp → `fsync` → rename →
    `fsync` directory). Keep `migrations/pre-<s>/` until the operator
    runs `aletheia-admin migrations prune` or the next successful
    release; never delete it automatically before one clean restart.

Archive segments carry their own format version in the segment header.
Old segments are read forever and are **never rewritten**; new segments
use the new format. zstd dictionaries are retained forever (Section
42.3). The WAL reader supports the current and the previous WAL format
(one release train), and a clean upgrade shutdown always leaves a
`CHECKPOINT` record at the finalized tip, so in practice the new binary
reads almost nothing in the old format.

## 44.6 Binary Switchover and `aletheia-steward`

`aletheia-steward` is an optional, deliberately small supervisor
(≤ 1,500 lines, no network listener) that runs `aletheiad` and switches
binaries at a scheduled height.

-   Operators stage the next release under
    `/opt/aletheia/releases/<version>/` with its signed release
    manifest. The steward verifies the cosign signature, the SLSA
    provenance and that the binary hash appears in the on-chain
    `ProtocolSchedule.binary_hashes` (read through the local node's
    RPC, verified with a state proof).
-   When `aletheiad` exits with status 75 at the activation edge, the
    steward atomically repoints `/opt/aletheia/current` to the staged
    release and starts it. It never downloads anything.
-   If the new binary fails to reach "following" within the configured
    window, the steward stops and pages; it does **not** fall back to
    the old binary after the activation height (the old binary cannot
    execute the new version, by C5).
-   Operators who do not use the steward perform the same switch by
    hand from the runbook; the node behaves identically either way.

Before activation, rolling back to the previous binary is allowed
(class 0--2 releases always; class 3 releases until the activation
height). After activation, there is only forward.

## 44.7 Sync, Snapshots and Light Clients Across Versions

-   Block sync applies `Rules::for_version(schedule(height))` per
    block. A syncing node learns the schedule from state as it
    executes; the schedule for heights it has not reached is never
    taken from peers on trust.
-   Snapshot manifests (Section 42.4) carry `protocol_version`,
    `storage_schema` and `snapshot_format`. Restore verifies chunks
    against JMT proofs, then runs any storage migrations needed for the
    local binary.
-   Finality proofs and validator-set transitions are versioned; the
    light-client verifier (also shipped to the browser, Section 41A.12)
    supports every version in `frozen.toml`.

## 44.8 Emergency Halt and Forward Fix (Class 5)

When a live protocol version has a defect that threatens safety, supply
or finality:

1.  **Stop finality, not history.** Validators stop voting (signer
    `pause` command, Section 49) --- the chain stops finalizing; nothing
    already final changes. Where governance can still finalize, a
    `HaltAtHeight{h}` governance action (council threshold +
    Monetary Authority threshold) makes every honest node stop cleanly
    after height `h`, exactly as in C5.
2.  Ship a release with a **new protocol version** that contains the
    fix, scheduled with an emergency timelock (minimum 1 epoch, both
    thresholds).
3.  If finalized state is wrong (for example, AEY created without a
    valid mint authorization), the new version's first block runs a
    **`StateCorrection`**: a deterministic migration whose every
    effect is enumerated in the governance proposal, emitted as events,
    reflected in the supply ledger with a reason code, and shown on the
    Explorer's Chronicle page. Corrections are public history, never
    silent edits.
4.  Restart. The chain continues from the halt height. No re-genesis.

Re-genesis, state export/import into a new chain, and "hard reset" are
**not recovery tools** for this network. Any proposal to use them
requires an ADR signed by all four leads and the Monetary Authority,
and the design of this section exists so that one is never needed.

## 44.9 Off-Chain Continuity (C6)

-   **Indexer**: PostgreSQL schema migrations are forward-only (`sqlx`
    migrations checked into `crates/indexer/migrations/`) and follow
    expand → backfill → contract, so the indexer keeps serving during
    a migration. The indexer stores its cursor
    `(height, tx_index, event_index)` in the same transaction as the
    rows it writes. Decoders for every historical transaction and
    event version stay in the indexer forever.
-   **Explorer API and Explorer**: render by `(protocol_version,
    tx_type)`; an unknown type renders as a typed raw view, never as an
    error page (Section 41A.13).
-   **RPC**: additive within `/api/v1` and `/rpc/v1`. New fields never
    change the meaning of old ones. Deprecations carry `Deprecation` and
    `Sunset` headers for at least two release trains.
-   **Gateway, rail adapters, PayNet**: consume the Finalized Event
    Stream (APS-0058) whose envelope carries `protocol_version` and an
    `event_schema` number; consumers must skip-and-record unknown event
    kinds rather than stop.

## 44.10 Release Gates for Continuity

  ------------------------------------------------------------------------------------
  Gate                          What runs                                   When
  ----------------------------- ------------------------------------------- ----------
  Upgrade matrix                For each release in the support window:     Every
                                data-dir fixtures at genesis+1, mid-epoch,  release
                                last block before an activation and the     candidate
                                first block after; start the candidate on
                                each; produce 1,000 blocks on a 7-node
                                network; roots must match a reference run

  Historical replay             Candidate replays the full archive of       Nightly +
                                mainnet and of the private validation       release
                                network from genesis; every block's state,
                                receipt and event roots must match

  Mixed-version network         `N` and `N+1` binaries together before      Every
                                activation (must agree); after activation   class 2/3
                                `N` binaries must stop cleanly at the edge  release
                                (must not diverge, must not vote)

  Migration crash               Kill -9 at every journaled migration step   Every
                                and at every `DATADIR` write; restart must  class 1
                                complete or roll back to the checkpoint     release

  Activation power loss         dm-log-writes replay of every write prefix  Every
                                around the first block of the new version   class 3
                                                                            release

  Shadow-fork rehearsal         Section 59A.5 on a copy of real state       Before
                                                                            every
                                                                            mainnet
                                                                            activation

  Historical decoders fuzz      Fuzz targets for every historical ACE       Nightly
                                variant and every historical tx type
  ------------------------------------------------------------------------------------

Support window: storage migrations from at least the two previous
release trains; P2P compatibility `N-1`; historical execution of every
protocol version ever active on a production network, indefinitely.
Retiring historical execution from full nodes (checkpoint sync) would
require a separate ADR; archive nodes keep it regardless.

------------------------------------------------------------------------


# 45. Operational Logging with Compression-Before-Persistence (APS-0044) **\[DECISION ADR-013\]**

Requirement: node logs must be highly compressed **before** they are
written to disk or any database, must never slow the consensus path, and
must never contain secrets.

## 45.1 Design

``` text
 hot threads                       log backend thread                     local disk                  central
┌────────────┐  lock-free SPSC   ┌──────────────────────────┐          ┌──────────────────┐       ┌────────────┐
│ LOG_EVENT( │  ring per thread  │ 1. drain rings            │  append  │ logs/ring/*.alz   │ ship  │ ClickHouse │
│  id, args) │ ───────────────▶  │ 2. binary-encode records  │ ───────▶ │ (bounded, e.g.    │ ────▶ │ ZSTD +     │
│  ~20-50 ns │  (drop+count on   │ 3. batch (≤1 MiB/≤1 s)    │          │  2 GiB total)     │       │ Delta/T64  │
└────────────┘   full, never     │ 4. zstd(level 3, dict)    │          └──────────────────┘       └────────────┘
                 block)          │ 5. crc32c + frame header  │
                                 └──────────────────────────┘
```

Key techniques (why it compresses 20--50×):

1.  **No format strings at runtime.** Each log site is a compile-time
    registered *event template* (`event_id` u32 → module, level, message
    template, typed field schema). Records carry only `event_id` + typed
    binary arguments.
2.  **Binary, typed, delta-friendly fields:** varint-encoded integers
    (allowed here --- logs are not consensus bytes), heights/slots
    delta-encoded within a batch, 32-byte hashes stored once per batch
    in a small dedup table and referenced by index.
3.  **Batching** into ≤ 1 MiB or ≤ 1 s blocks, then **zstd level 3 with
    a trained dictionary** (dictionary trained on devnet logs; `dict_id`
    embedded in every frame; dictionaries versioned and shipped with the
    binary).
4.  **Level and rate control:** per-module levels; DEBUG/TRACE sampled;
    repeated identical events coalesced (`count` field); token-bucket
    per event_id to stop log storms.
5.  **Bounded local ring:** fixed total disk budget; oldest segments
    deleted after successful shipping acknowledgment or when the budget
    is exhausted (counted in `log_segments_dropped_total`).

## 45.2 Record and Frame Format

``` text
LogFrame (file: logs/ring/<node>-<seq>.alz)
  magic "ALLG" u32 | version u16 | dict_id u32 | codec u8 (1=zstd) | raw_len u32 | comp_len u32 | crc32c u32
  | first_mono_ns u64 | record_count u32 | zstd(payload)

payload (before compression):
  hash_table: varint n, n × 32-byte hashes
  records: repeated {
      varint delta_mono_ns           // from previous record
      varint event_id
      u8     level
      varint thread_id
      varint trace_id_ref (0 = none)
      fields per event schema: varint | zigzag varint | bytes(len-prefixed) | hash_ref | bool
  }
```

## 45.3 API

``` rust
// Phase 0 obligation R.17 (Appendix R): write this interface from the normative text
// of this section, in the style of Sections 3.2, 9 and 15. Preserve the types, invariants,
// ordering and error semantics stated here. Consensus bytes go through ACE, never Serde;
// fallible operations return Result<T, AletheiaError>. Record it in the APS named in
// Appendix R and obtain the listed sign-off before anything depends on it.
```

Human-readable output: `aletheia-cli logs decode <file.alz>` (and
`--follow`) reconstructs text using the event table of the matching
binary version. In `Development` profile, a tracing + custom binary
persistence layer console sink additionally prints decoded text.

## 45.4 Central Storage --- ClickHouse

`aletheia-logship` decompresses frames, verifies CRC, and inserts in
native batches:

``` sql
CREATE TABLE aletheia.node_logs
(
    ts          DateTime64(9, 'UTC')        CODEC(DoubleDelta, ZSTD(3)),
    network     LowCardinality(String),
    node_id     LowCardinality(String),
    version     LowCardinality(String),
    module      LowCardinality(String),
    level       Enum8('TRACE'=0,'DEBUG'=1,'INFO'=2,'WARN'=3,'ERROR'=4,'CRITICAL'=5),
    event_id    UInt32                      CODEC(T64, ZSTD(3)),
    height      UInt64                      CODEC(Delta, ZSTD(3)),
    slot        UInt64                      CODEC(Delta, ZSTD(3)),
    trace_id    FixedString(16)             CODEC(ZSTD(3)),
    fields      String                      CODEC(ZSTD(6))   -- compact binary/JSON of remaining fields
)
ENGINE = MergeTree
PARTITION BY toYYYYMMDD(ts)
ORDER BY (network, node_id, module, event_id, ts)
TTL toDateTime(ts) + INTERVAL 30 DAY TO VOLUME 'cold',
    toDateTime(ts) + INTERVAL 400 DAY DELETE
SETTINGS storage_policy = 'hot_cold', index_granularity = 8192;
```

Security events (auth failures, evidence, signer refusals, governance
actions) are additionally shipped to a separate **immutable** security
table/SIEM with longer retention.

## 45.5 Metrics Targets

`log_records_total{level}`, `log_records_dropped_total`,
`log_bytes_raw_total`, `log_bytes_compressed_total` (compression ratio
is a dashboard panel; alert if \< 8×), `log_ring_disk_bytes`,
`logship_lag_seconds`.

## 45.6 RPC and API Request Logs --- Compressed Before They Reach Disk or a Database **\[DECISION ADR-036\]**

Public RPC nodes (sentries, full nodes, PayNet nodes, explorer API)
receive orders of magnitude more requests than validators produce log
events. Left as plain-text access logs or JSON rows in a database, they
are the most common reason a mainnet RPC host fills its disk overnight.
They therefore go through the same compress-before-persist pipeline as
every other node log, with tighter rules.

**What is recorded per request** (binary event `RPC_REQUEST`, fields
typed per Section 45.2):

``` text
RpcRequestRecord
├── request_id        u64          (also returned to the client in the X-Request-Id header)
├── interface         u8           (REST | JSON-RPC | WS | event stream)
├── method_id         u16          (index into the method registry — never the method name string)
├── status            u16          (HTTP status or JSON-RPC error code)
├── error_code        u32          (protocol ErrorCode, 0 = none)
├── latency_us        varint
├── bytes_in, bytes_out varint
├── client_key_id     u32          (API key index, 0 = anonymous)
├── client_ip_hash    u64          (keyed hash, key rotated daily, never the raw IP)
└── params_hash       Optional<hash_ref>  (errors only; for correlating repeats, not reconstruction)
```

Never recorded: request or response bodies, raw IP addresses, API key
values, auth headers, full query strings. A body is never "logged just
in case".

**Volume control**, in this order:

1.  **Per-minute roll-ups inside the node.** For every
    `(interface, method_id, status)` the node keeps a latency histogram,
    count and byte totals in memory and writes **one** `RPC_ROLLUP`
    record per minute. Exact request counts live here and in Prometheus
    metrics, not in per-request records.
2.  **Per-request records are sampled.** 100 % of errors, slow requests
    (`latency_us` above the per-method threshold) and admin calls; a
    configurable share of successful requests (default 1 in 100, `0`
    allowed). Sampling never affects the roll-ups.
3.  **Token bucket per client and per method** on log emission, so a
    client hammering one failing method produces a coalesced record with
    a `count`, not a flood.
4.  Binary encoding, per-batch deduplication and **zstd with a trained
    dictionary** (Section 45.1). Target compression for RPC logs: ≥ 15×.

**Where it is stored:**

-   **Local:** a dedicated ring `logs/rpc/*.alz` with its own byte budget
    (`rpc_ring_max_bytes`, default 1 GiB), separate from the node-log
    ring, deleted oldest-first after shipping acknowledgement or when the
    budget is reached. RPC logs can never consume the node-log budget,
    and neither can consume chain-data space (Section 45.7).
-   **Central (ClickHouse):** shipped by `aletheia-logship` into
    `aletheia.rpc_requests` and `aletheia.rpc_rollups`:

``` sql
CREATE TABLE aletheia.rpc_requests
(
    ts            DateTime64(6, 'UTC')        CODEC(DoubleDelta, ZSTD(3)),
    network       LowCardinality(String),
    node_id       LowCardinality(String),
    interface     Enum8('rest'=1,'jsonrpc'=2,'ws'=3,'stream'=4),
    method        LowCardinality(String),      -- resolved from method_id at ship time
    status        UInt16                       CODEC(T64, ZSTD(3)),
    error_code    UInt32                       CODEC(T64, ZSTD(3)),
    latency_us    UInt32                       CODEC(T64, ZSTD(3)),
    bytes_in      UInt32                       CODEC(T64, ZSTD(3)),
    bytes_out     UInt32                       CODEC(T64, ZSTD(3)),
    client_key_id UInt32                       CODEC(T64, ZSTD(3)),
    client_ip_hash UInt64                      CODEC(ZSTD(3)),
    request_id    UInt64                       CODEC(ZSTD(3))
)
ENGINE = MergeTree
PARTITION BY toYYYYMMDD(ts)
ORDER BY (network, node_id, method, ts)
TTL toDateTime(ts) + INTERVAL 7 DAY TO VOLUME 'cold',
    toDateTime(ts) + INTERVAL 30 DAY DELETE
SETTINGS storage_policy = 'hot_cold';

-- rpc_rollups: same codecs, ORDER BY (network, node_id, method, status, minute),
-- histogram stored as Array(UInt32) CODEC(ZSTD(6)), TTL 400 days.
```

-   **PostgreSQL is not a log store.** No request or access log is ever
    written to the indexer, explorer-API, gateway or PayNet PostgreSQL
    databases. PostgreSQL rows that must keep a payload (gateway audit,
    rail inbox/outbox, APN message store) store it **zstd-compressed
    before insert** (`payload_zstd`, as in Section 40), live in tables
    partitioned by day or by height, and are retained by dropping whole
    partitions on schedule (`pg_partman`), never by bulk `DELETE`. TOAST
    compression is `lz4` for every other large column.
-   **Everything else on the host is bounded too:** reverse proxy
    access logs disabled (the node's own records replace them) or
    written through the same shipper; `journald` capped
    (`SystemMaxUse=512M`, `MaxRetentionSec=7day`); container log driver
    capped (`max-size=50m`, `max-file=3`); no `nohup.out`, no debug dumps
    to disk.

## 45.7 Disk Budget Guard --- No Node Fills Its Disk "All of a Sudden"

Every node, and especially public RPC and VPS-hosted nodes, runs a disk
budget guard inside `aletheiad` (and the same logic in the explorer API
and logship). Disk exhaustion is predicted, announced and shed in a
fixed order, and never corrupts chain data.

**Layout first.** Chain data (`wal/`, `state/`, `chain/`, `blocks/`) and
logs (`logs/`, ClickHouse local volume, PostgreSQL) live on **separate
filesystems** on production hosts. On a single-disk VPS, logs live on a
fixed-size loop or quota-limited directory (`logs.max_bytes`) so that a
log storm can at worst fill the log area, never the chain area.

``` toml
# /etc/aletheia/node.toml (additions)
[disk]
chain_path          = "/var/lib/aletheia"
log_path            = "/var/log/aletheia"
warn_free_pct       = 20        # alert, show in `aletheia-cli node status`
shed_free_pct       = 15        # start shedding (table below)
critical_free_pct   = 8         # RPC read-only mode / validator page
stop_free_pct       = 4         # clean stop with CHECKPOINT before writes can fail
snapshots_keep      = 2

[logging]
ring_max_bytes      = 2147483648
rpc_ring_max_bytes  = 1073741824
rpc_sample_success  = 100       # 1 in N successful requests recorded; 0 = none
```

Shedding order (each step logged once and counted in metrics):

  ------------------------------------------------------------------------------------
  Free space          Action
  ------------------- ----------------------------------------------------------------
  < warn              Alert; `disk_days_to_full` forecast (linear fit over 6 h) on
                      the dashboard; page if forecast < 3 days

  < shed              RPC per-request sampling → errors only; DEBUG/TRACE off; delete
                      already-shipped log segments first, then oldest unshipped (counted
                      as dropped); keep only `snapshots_keep` snapshots; run JMT stale-
                      node pruning at full rate (full/validator modes)

  < critical          Public RPC: refuse new WebSocket subscriptions and expensive
                      range queries with `NODE_DISK_LOW` (503); keep serving point
                      reads. Validators: page the operator; consensus continues
                      (logs are already being dropped, never consensus writes)

  < stop              Write `CHECKPOINT`, stop cleanly with exit status 74 and the
                      message `stopped: 3.9 % free on /var/lib/aletheia (stop threshold
                      4 %); nothing is lost — free space or grow the volume and start
                      again`. The node never runs until a write fails mid-batch
  ------------------------------------------------------------------------------------

The guard **never** deletes WAL segments, state, the block archive or
finalized data on its own. Those shrink only through the configured
node mode (`full` pruning, Section 42.4) or an operator command.

RocksDB is configured to respect the same budget: an `SstFileManager`
with `max_allowed_space_usage` set below the stop threshold and
compaction space headroom accounted for, so a large compaction cannot
take the last free gigabytes.

**Sizing rule for RPC/VPS nodes** (in
`docs/operations/capacity.md`, recalculated every release): disk ≥ 2 ×
(current chain data for the chosen mode + 90 days of measured growth) +
log budgets + snapshot budget. Public RPC nodes run in `full` mode
with pruning unless they are explicitly designated archive nodes.

**Metrics:** `disk_free_bytes{path}`, `disk_days_to_full{path}`,
`disk_guard_state`, `rpc_log_records_sampled_total`,
`rpc_log_bytes_compressed_total`, `rpc_log_compression_ratio` (alert if
< 10×), `log_segments_dropped_total{ring}`.

**Tests (release gates):** a disk-fill test that fills the log
filesystem and then the chain filesystem on a running 4-node network,
asserting the shedding order, the clean stop, and a clean restart after
space is freed; an RPC load test at 20,000 requests/s for one hour
asserting that RPC log bytes on disk stay within `rpc_ring_max_bytes`
and that compression stays ≥ 15×.

------------------------------------------------------------------------

# 46. Stability Engineering

Stability is a first-class requirement. The node must run for months
without restart, under adversarial load, without memory growth,
deadlock, or divergence.

## 46.1 Threading Model

``` text
Thread / pool                  Count      Owns                                   Communicates via
────────────────────────────── ───────── ────────────────────────────────────── ────────────────────────────
io-runtime (Tokio)              2–4       sockets, TLS, RPC HTTP parsing          bounded MPSC queues
consensus loop                  1         SafetyRules, pacemaker, QC/TC building  single-threaded event loop
execution                       1 (v0.1)  StateOverlay chain, executor IPC        bounded queue from consensus
sig-verify pool                 N cores/2 batch Ed25519/BLS verification          bounded queue + futures
storage writer                  1         finalize WriteBatch, archive append     bounded queue, ack to consensus
background (compaction, prune)  rate-lim  RocksDB, JMT pruning, snapshots          rate limiters
log backend                     1         log rings → compressed frames            SPSC rings
metrics/admin                   1         /metrics, /health                        read-only snapshots
```

Rules:

-   Consensus-critical state is owned by exactly one thread (no shared
    mutable state, no locks in the consensus loop).
-   All inter-thread queues are **bounded**. No unbounded queue anywhere
    in the node.
-   Lock ordering documented where locks exist; ThreadSanitizer runs in
    CI on all multi-threaded tests.

``` rust
// crates/node/src/channels.rs — every queue in the node is declared here, with its capacity
// and what happens when it is full. Adding a queue anywhere else fails review.

/// Consensus → execution: blocks to execute. Full means execution is behind; consensus
/// waits (it cannot vote on a block it has not executed anyway).
pub const EXECUTION_QUEUE: usize = 8;

/// Execution → storage writer: finalized blocks to commit. Full means disk is behind;
/// consensus stops proposing until it drains (Section 46.2 step 5).
pub const FINALIZE_QUEUE: usize = 4;

/// P2P → consensus: votes, proposals, timeouts from active validators. Sized for two
/// rounds of full participation; never shed (Section 46.2).
pub const CONSENSUS_INBOX: usize = 4 * MAX_VALIDATORS;

/// P2P → mempool: gossiped transactions. Full means shed — oldest-first, lowest-fee-first.
pub const TX_GOSSIP_INBOX: usize = 16_384;

/// Event stream: per-subscriber buffer. Full means the subscriber is disconnected with
/// STREAM_CONSUMER_TOO_SLOW and resumes from its cursor (Section 40D.3).
pub const STREAM_SUBSCRIBER_BUFFER: usize = 4_096;

pub struct NodeChannels {
    pub to_execution: crossbeam_channel::Sender<ExecuteRequest>,
    pub to_storage: crossbeam_channel::Sender<FinalizeRequest>,
    pub to_consensus: crossbeam_channel::Sender<ConsensusInput>,
    pub to_mempool: tokio::sync::mpsc::Sender<GossipedTx>,
}
```

## 46.2 Backpressure and Load Shedding (priority order)

When overloaded, shed in this order, **never** touching consensus
messages from active validators:

1.  RPC read endpoints (HTTP 503 + `Retry-After`)
2.  New transaction admission (RPC 429, gossip ignore)
3.  State/snapshot sync serving to non-validators
4.  Debug/trace logs
5.  Tx gossip relay

## 46.3 Fail-Stop vs Degrade

  -----------------------------------------------------------------------
  Condition                           Response
  ----------------------------------- -----------------------------------
  Invariant violation on finalized    **Fail-stop**: flush WAL + logs,
  state, WAL corruption mid-log, exec emit CRITICAL, exit non-zero;
  mismatch with own finalized result, systemd restarts; recovery runs
  escaped exception, assertion        Section 24.3; repeated crash loop
  failure                             (\>3 in 10 min) → stays down, pages
                                      operator

  Peer misbehavior, invalid messages, Degrade: score/ban peer, rate limit
  RPC abuse                           

  Clock out of envelope               Degrade: stop proposing (Section
                                      19.9)

  Disk \> 85 %                        Degrade: stop serving snapshots,
                                      aggressive pruning, alert; \> 95 %
                                      → stop accepting txs; \< 2 GiB free
                                      → fail-stop before corruption risk

  Executor crash                      Respawn and re-execute
                                      deterministically; repeat on same
                                      tx → fail-stop

  Memory budget exceeded              Shed per 46.2; if still exceeded →
                                      fail-stop (better than OOM-kill
                                      mid-write)
  -----------------------------------------------------------------------

## 46.4 Resource Budgets

Configured and enforced: RocksDB block cache + memtables
(`WriteBufferManager`), mempool bytes, per-peer buffers, executor
RLIMIT_AS, log rings, pipeline depth (max speculative blocks = 3).
Allocator: **system allocator or mimalloc via an explicitly benchmarked
Rust allocator crate; never a consensus dependency** (secure mode in
HardenedRelease). Metrics: RSS, per-budget usage, allocator stats.

## 46.5 Watchdogs and Supervision

-   Every long-lived thread heartbeats a watchdog registry; a stalled
    thread (\> configurable deadline, e.g. consensus loop 5 s) is
    reported; consensus stall \> 30 s with pending work → fail-stop with
    stack dump (symbolized in debug-info-enabled builds).
-   systemd `WatchdogSec=` integration via `sd_notify(WATCHDOG=1)` from
    the watchdog thread only when all critical threads are healthy.
-   Graceful shutdown: stop intake → finish in-flight finalize → flush
    WAL/logs → close DB (bounded by 30 s, then abort safely --- WAL
    guarantees correctness).

## 46.6 Stability Testing (release gates)

-   **Soak**: 7-validator devnet, 72 h at 70 % of benchmarked capacity
    with continuous tx load: zero crashes, RSS growth \< 5 % after
    warm-up, p99 finality stable.
-   **Overload**: 3× capacity for 1 h → node sheds load, consensus keeps
    finalizing, recovers to normal within 5 min after load stops.
-   **Chaos**: random kill -9, partitions, packet loss 10 %, latency 200
    ms ± 100 ms, disk-full injection, clock steps.
-   **Leak checks**: LeakSanitizer in CI; heap profiling (heaptrack) run
    weekly on soak.

------------------------------------------------------------------------

# 46A. Node Engineering Standard --- A Node Built by Engineers **\[DECISION ADR-034\]**

Section 3.4 sets the craft standard for the whole repository. This
section applies it to `aletheiad` specifically, because the node is
where machine-shaped code does the most damage: it hides ordering
bugs, swallows errors, grows memory and makes incidents unreadable at
3 a.m.

## 46A.1 Process Structure --- a Supervision Tree, Not a Pile of Tasks

``` text
aletheiad (main thread: config, startup order, signal handling, exit codes)
├── storage-writer        (OS thread)  sole owner of WAL appends, finalize WriteBatch, archive append
├── consensus             (OS thread)  sole owner of SafetyRules, pacemaker, pipeline, QC/TC
├── execution             (OS thread)  sole owner of the StateOverlay chain and executor IPC
├── verify-pool           (N OS threads, rayon scoped) batch Ed25519/BLS verification
├── io-runtime            (Tokio, 2–4 workers) P2P, RPC, event stream, signer client — I/O only
│   ├── p2p supervisor    restarts peer tasks; never consensus state
│   ├── rpc supervisor    per-connection tasks with budgets
│   └── stream supervisor per-subscriber tasks with bounded buffers
├── background            (OS thread, rate-limited) compaction hints, JMT pruning, snapshots
└── log-backend           (OS thread) rings → zstd frames → local ring files
```

-   Consensus-critical state is owned by exactly one OS thread. Async
    code never touches it; it sends typed messages over bounded
    channels (`crossbeam_channel::bounded` between OS threads,
    `tokio::sync::mpsc` with explicit capacity inside the runtime).
-   Every spawned task has an owner that holds its `JoinHandle` and a
    `CancellationToken`. `tokio::spawn` without a stored handle is
    rejected in review and by a clippy `disallowed_methods` rule outside
    `crates/node/src/supervise.rs`.
-   A panic in a supervised I/O task is logged with its task name and
    the task is restarted with back-off. A panic or error crossing the
    boundary of `storage-writer`, `consensus` or `execution` is
    **fail-stop** (Section 3.3): flush safety data, write the
    fail-stop record, exit with status `70` (`EX_SOFTWARE`).

## 46A.2 Startup Order (each step logs one line; any failure exits with a reason)

1.  Parse and validate configuration (unknown keys are errors; safety
    settings have no defaults).
2.  Acquire the data-directory lock.
3.  Read `DATADIR`; decide migration per Section 44.5; run migrations.
4.  Open storage; WAL recovery (Section 24.3).
5.  Verify genesis id and chain id against configuration.
6.  Load protocol schedule from state; check that this binary supports
    the version at `tip + 1` (else C5 clean stop, exit 75).
7.  Connect to the signer; compare signer high-water marks with WAL
    safety data (max-merge, Section 24.3 step 8).
8.  Start execution and consensus threads in follower mode.
9.  Start P2P; sync to the network's highest QC.
10. Start RPC and the event stream **only after** the node is following
    (an RPC that serves stale state as if current is a correctness bug).
11. Notify systemd `READY=1`.

## 46A.3 Shutdown Order (SIGTERM)

1.  Stop accepting RPC and stream subscribers; finish in-flight
    requests within 5 s.
2.  Stop proposing and voting; tell the signer to refuse new requests.
3.  Drain the storage writer: any finalize in progress completes.
4.  Write `CHECKPOINT` to the WAL at the finalized tip; fsync.
5.  Close RocksDB cleanly; release the lock; exit 0.

The order is tested: SIGTERM at random points in a 7-node simulation
must never leave a WAL that recovery has to truncate.

## 46A.4 The Operator's Voice --- Logs and CLI

Logs are written for the operator who reads them during an incident.

``` text
finalized height=1048576 hash=AL:Bq8f…7k2d txs=212 eu=38190442 took_ms=1180
peer 9f3c…e1a0 dropped: invalid vote signature for round 2097152 (score −100, banned 10 min)
storage: compaction behind (L0 files=36, slowdown at 40); finalize latency p99 410 ms
signer refused timeout for round 2097153: already signed timeout for this round
stopped cleanly: protocol version 3 activates at height 4194304; this binary supports 1–2
```

Rules: lower-case message start; facts as `key=value`; numbers without
units in keys carry the unit in the key name (`took_ms`); no
"Successfully", no "Error occurred", no exclamation marks, no emoji, no
log line that only says a function was entered. Every `warn` and
`error` names what the operator should look at next, or links the
runbook section (`see docs/operations/recovery.md#torn-wal-tail`).

`aletheia-cli` output is designed: aligned columns, tabular numbers,
`--json` with a stable schema for every command, exit codes documented
in `docs/operations/exit-codes.md`.

``` text
$ aletheia-cli node status
Network        mainnet (chain 1)          Protocol    version 3 since height 4,194,304
Role           validator #4 (active)      Following   yes, 0 blocks behind
Finalized      1,048,576  AL:Bq8f…7k2d    Finality    p50 1.18 s  p99 1.92 s
Signer         connected, HSM slot 2      Last vote   round 2,097,153
Storage        412 GiB used, 1.4 TiB free, schema 7
Peers          6 validators, 14 sentries  Clock       ptp, offset 0.3 ms
```

## 46A.5 Patterns Reviewers Reject

These are the habits of generated code. Each one is a review comment
with the rule number; several are also lint rules.

  ---------------------------------------------------------------------------------------
  \#    Pattern                                       Write instead
  ----- --------------------------------------------- -------------------------------------
  N1    `.clone()` to quiet the borrow checker        Restructure ownership; pass
                                                      references; if a clone is genuinely
                                                      needed, a comment says why it is
                                                      cheap or necessary

  N2    `Arc<Mutex<T>>` as the default way to share   One owner + messages (46A.1); or
                                                      `ArcSwap` for read-mostly snapshots;
                                                      locks need a documented reason and
                                                      lock order

  N3    `Box<dyn Error>`, `anyhow` in library crates  `AletheiaError` with `ErrorCode`;
                                                      `anyhow` only in `apps/*` `main`

  N4    `unwrap()`, `expect("should not happen")`     `?` with a specific error; or a
                                                      proven invariant with a comment that
                                                      proves it

  N5    Traits with one implementation and no seam    A struct. Traits exist for real seams
                                                      (`KvStore`, key backend, transport,
                                                      rail adapter)

  N6    `utils.rs`, `helpers.rs`, `common.rs`,        Name the module after what it is
        `manager.rs`, `handler.rs`                    (`nonce_window.rs`, `fee_schedule.rs`)

  N7    Doc comments that restate the signature       Doc comments state contracts,
        (`/// Gets the height`)                       invariants, units, the APS rule

  N8    `// Step 1: …` narration, banner comments,    Comments explain *why*; code shows
        comments describing the next line             *what*

  N9    `async fn` for pure computation               Plain functions; async only at I/O
                                                      boundaries

  N10   Unbounded channels, `Vec` used as a queue     Bounded channels with a named
        without a cap                                 capacity constant and a back-pressure
                                                      policy

  N11   `loop { … sleep(…) }` polling                 Notifications, `select!` on channels
                                                      and timers with a reason

  N12   Magic numbers                                 Named constants with units and source
                                                      (`MAX_FRAME_CONSENSUS_BYTES`, APS ref)

  N13   `String` for typed values (addresses,         Newtypes parsed once at the boundary
        hashes, codes)

  N14   `impl Default` producing invalid protocol     No `Default` for protocol types;
        objects                                       constructors that validate

  N15   `println!` / `eprintln!` in the node          Structured binary logging (Section
                                                      45)

  N16   Generic "manager/service/processor"           Domain names: `Pacemaker`,
        structs                                       `FinalizeQueue`, `NonceWindow`

  N17   Catch-all `_ =>` arms over protocol enums     Exhaustive matches; adding a variant
                                                      must break the build

  N18   Tests named `test_1`, `it_works`,             Names that state the rule:
        `test_happy_path`                             `rejects_vote_for_round_below_locked_round`

  N19   Over-wide `pub`                               `pub(crate)` by default; the public
                                                      API is deliberate and documented

  N20   Large functions doing parse + validate +      One job per function; the ordering
        apply + log                                   of jobs is visible at the call site
  ---------------------------------------------------------------------------------------

Lint support: `clippy.toml` enables `clippy::pedantic` selectively,
plus `disallowed_methods` (`tokio::spawn` outside the supervisor,
`std::time::SystemTime::now` in consensus crates,
`std::collections::HashMap::iter` in consensus crates), and
`disallowed_types` (`std::collections::HashMap` in protocol-output
paths, `anyhow::Error` in library crates).

## 46A.6 Exemplar --- The Finalize Path

The level of care expected everywhere in the node:

``` rust
// crates/node/src/finalize.rs

/// Makes a finalized block durable.
///
/// The order of writes is the contract that crash recovery depends on (APS-0034 §7):
///   1. archive record (so recovery can always re-read the block it is told about),
///   2. WAL FINALIZE_BEGIN, fsynced,
///   3. one synchronous RocksDB batch: state, receipts, proof, last_finalized marker,
///   4. WAL FINALIZE_COMMITTED, fsynced.
/// A crash between any two steps leaves a state recovery can finish without guessing; an
/// archive record above `last_finalized` is reused if its hash matches the WAL proposal and
/// truncated otherwise (APS-0034 §7, archive tail rule).
pub(crate) fn commit_finalized(
    &mut self,
    block: ExecutedBlock,
    proof: &FinalityProof,
) -> Result<FinalizedTip, AletheiaError> {
    let height = block.header.height;
    let expected = self.tip.height.next();
    if height != expected {
        return Err(AletheiaError::new(
            ErrorCode::FinalizeOutOfOrder,
            format!("asked to finalize {height} while the tip is {}", self.tip.height),
        ));
    }
    if block.header.parent_hash != self.tip.hash {
        return Err(AletheiaError::new(
            ErrorCode::FinalizeParentMismatch,
            format!("block {height} does not extend finalized tip {}", self.tip.hash),
        ));
    }

    self.archive.append_durable(height, block.hash, &block.canonical_bytes)?;
    self.wal.append_durable(WalRecord::FinalizeBegin { height, hash: block.hash })?;

    let mut batch = self.state_db.batch();
    block.overlay.write_into(&mut batch)?;
    batch.put_receipts(height, &block.receipts)?;
    batch.put_finality_proof(height, proof)?;
    batch.set_last_finalized(LastFinalized {
        height,
        hash: block.hash,
        state_root: block.header.state_root,
    });
    self.state_db.write_sync(batch)?;

    self.wal.append_durable(WalRecord::FinalizeCommitted { height, hash: block.hash })?;

    self.tip = FinalizedTip { height, hash: block.hash };
    self.metrics.finalized_height.set(height.get());
    Ok(self.tip)
}
```

What makes this acceptable: the doc comment states the contract and
cites the APS; errors name both values that disagree; ownership moves
the executed block in (no clone); there are no comments narrating
lines; the function does one thing; and the test file next to it
kills the process between every pair of writes.

## 46A.7 Review Gate

The PR template adds, for any change under `crates/` or `apps/`:

-   *Ownership: which thread owns every new piece of mutable state?*
-   *Bounds: what is the capacity of every new queue, buffer and cache,
    and what happens when it is full?*
-   *Failure: what does the operator see when this fails, word for
    word?*
-   *Continuity: which change class (Section 44.2) is this, and which
    continuity gate covers it?*
-   *Patterns N1--N20: checked.*

------------------------------------------------------------------------


# 47. Observability --- Metrics, Traces, Health

-   Prometheus metrics on the admin interface (never public): consensus
    (`dsp_round`, `dsp_qc_latency_ms`, `dsp_timeouts_total`,
    `dsp_finalized_height`, `dsp_votes_missed{validator}`), execution
    (`exec_block_ms`, `exec_eu_per_s`, `vm_traps_total{code}`), storage
    (`rocksdb_*`, `wal_fsync_ms`, `archive_bytes`), P2P
    (`peers{channel}`, `p2p_bytes_total{channel,dir}`,
    `peer_bans_total`), mempool, clock, queues (`queue_depth{name}`,
    `queue_rejected_total{name}`), monetary (`supply_outstanding{asset}`
    as gauge from finalized state, `invariant_checks_total`,
    `invariant_failures_total`), signer (`signer_refusals_total`).
-   OpenTelemetry traces: sampled spans for tx lifecycle (submit →
    mempool → include → finalize) and block lifecycle; exporters never
    on the consensus thread (spans buffered via the same lock-free ring
    approach).
-   Health endpoints: `/health/live` (process responsive),
    `/health/ready` (synced, clock ok, DB ok), `/health/consensus`
    (participating, last vote age).
-   Dashboards (Grafana JSON checked in under `deployments/grafana/`)
    and alert rules (`deployments/prometheus/alerts.yaml`): finality
    stall \> 10 s, missed votes \> 5 %, clock DEGRADED, invariant
    failure (page immediately), disk \> 85 %, log compression ratio \<
    8×, signer refusals \> 0 (page).

Never logged or exported: private keys, seeds, mnemonics, HSM PINs, auth
tokens, raw PII.

------------------------------------------------------------------------

# 48. Security Engineering and Threat Model

`docs/security/threat-model.md` uses **STRIDE per trust boundary** plus
attack trees for monetary and consensus attacks. Minimum coverage:

  -----------------------------------------------------------------------
  Threat              Primary controls
  ------------------- ---------------------------------------------------
  Byzantine           DSP safety rules, QC verification, evidence +
  validators (≤ F)    suspension

  \> F Byzantine      Out of model; detection (conflicting QCs), halt,
                      social/governance recovery runbook

  Malicious clients   Stateless validation first, size limits, rate
                      limits, fee floors

  Malicious contracts Bytecode verifier, EU metering, sandboxed executor,
                      reentrancy guard, memory caps

  Network attackers   TLS 1.3 mTLS, identity binding, peer scoring,
                      sentry topology, DoS limits

  Storage corruption  CRC32C/XXH3 checksums, hash re-verification on
                      read, paranoid checks, fail-stop

  Supply/monetary     Native-only issuance, M-of-N mint auth, caps,
  attacks             per-block invariant checker, reserve attestation
                      quorum

  Replay              Domain separation incl. chain_id/network, nonces,
                      expiry slots

  Double spend        Nonce model + BFT finality

  Tx malleability     ID over body only; strict Ed25519 verification

  Signature attacks   Canonical S, small-order point rejection, BLS PoP,
                      subgroup checks (blst Rust bindings)

  VM escape           Interpreter only, seccomp/namespaces/Landlock, no
                      FS/network, fuzzing

  DoS                 Bounded queues, load shedding, EU pricing,
                      per-channel budgets

  Validator key theft HSM, remote signer, management-key rotation

  HSM compromise      Suspension/revocation procedure, key rotation,
                      signer anomaly alerts

  Insider threats     Separation of duties, M-of-N for
                      monetary/governance, audit trails, no backdoors

  Dependency          Pinned Cargo baseline, hash-verified sources, SBOM,
  compromise          OSV/Grype, update review

  Build-system        Hermetic reproducible builds, independent
  compromise          rebuilders, cosign signing, SLSA provenance

  Supply-chain        Signed artifacts, verification in install scripts,
  attacks on releases transparency log (Rekor)

  Bridge: forged      Light-client proofs or ≥ ⌈2N/3⌉ guardian BLS quorum
  remote events       (+ issuer attestation on B+ routes); exactly-once
                      message IDs

  Bridge: guardian    Per-route caps, large-transfer delay with flag,
  collusion / key     auto-pause on conflicting attestations, HSM keys,
  theft               independent operators

  Bridge: remote      Route-specific finality depth, auto-pause, blast
  chain reorg or halt radius limited to route exposure cap

  Bridge: replay      Domain-separated message IDs including chain IDs,
  across              route ID and sequence
  routes/networks     

  APN: fraudulent     On-chain directory, KYB credentials, signed
  participant /       messaging keys, Confirmation of Payee
  impersonation       

  APN: external-leg   Mint only on confirmed inbound credits, prefunded
  fraud or partner    nostro limits, reconciliation R1--R3 with automatic
  failure             mint freeze

  APN: proxy          Salted hashes, authorized resolvers only, rate
  enumeration         limits, audit
  (harvesting phone   
  numbers)            

  APN: unauthorized   Debtor-signed mandates with max amount and
  direct debit        frequency; debtor cancel at any time

  JSON-RPC abuse      Batch ≤ 50, per-call rate limits, size/depth limits
  (batch              
  amplification)      
  -----------------------------------------------------------------------

External security audits are required before private validation
(consensus, crypto, VM) and before mainnet (full system).

------------------------------------------------------------------------

# 48A. Threat Model Additions for v4.0

Each row is a required entry in `docs/security/threat-model.md` with
an owner, a test and a monitoring signal.

  ------------------------------------------------------------------------------------------------
  Surface       Threat                                Control                              Test /
                                                                                           signal
  ------------- ------------------------------------- ------------------------------------ ---------
  Upgrades      Malicious or tampered binary          Reproducible builds by two           Repro
                presented as the approved release     independent builders; cosign +       gate;
                                                      SLSA provenance; binary hash must    steward
                                                      appear in on-chain `ProtocolSchedule` refusal
                                                      before the steward runs it           test

  Upgrades      Governance capture schedules a        Timelock ≥ 8 epochs; council +       Gov
                harmful version                       Monetary Authority thresholds;       sim
                                                      readiness signal from validators     tests
                                                      (who can refuse to install);
                                                      Explorer shows pending plans

  Upgrades      Migration bug corrupts state          Checkpoint before migration; root    Migration
                silently                              recomputation after; refuse-newer    crash
                                                      rule; replay gate                    gate

  Upgrades      Frozen rule set edited in a refactor  Fingerprint CI + replay label set    CI
                                                      only by release pipeline

  Rails         XML attacks (XXE, billion laughs,     Hardened reader, no DTD, size caps,  Fuzz
                deep nesting, oversized)              depth caps, pinned XSDs              24 h

  Rails         Message injection / spoofed status    mTLS with pinned partner certs;      Neg
                report releases or settles an escrow  message signature where offered;    tests
                                                      status must match an outbox
                                                      message by UETR + MsgId + amount

  Rails         Replay of an inbound credit           Inbox uniqueness; namespace 108      Chaos
                                                      key; R8                              dup

  Rails         Sanctions evasion through truncation  Truncation forbidden; screening on   Unit
                or transliteration                    original and emitted values          +audit

  Rails         Timeout exploited for double spend    I15: escrow never released by time   Railsim
                (instant schemes)                     alone                                late-ACSC

  Rails         Business email compromise /           Confirmation/Verification of Payee   E2E
                payee substitution                    shown before signing; name from
                                                      directory, never from the request

  PayNet        Settlement key compromise             HSM policy limits per key and per    HSM
                                                      hour; dual control above threshold;  policy
                                                      governance suspension; R4/R5 break   tests
                                                      halts submissions

  PayNet        Event stream spoofing or omission     PayNet verifies finality and event   Proof
                                                      inclusion proofs; gap detection;     tests
                                                      talks only to its own full nodes

  PayNet        Re-signed duplicate payment           Namespace 107 de-dup in consensus    Dup
                                                                                           tests

  Explorer      Script injection via on-chain         All on-chain strings rendered as     XSS
                strings (memos, names)                text; strict CSP; no `{@html}`       suite
                                                      outside reviewed components

  Explorer      Supply-chain attack through npm       Allow-list, `--ignore-scripts`,      CI
                                                      provenance, bundle inventory check

  Explorer      Phishing clone with lookalike         Checksummed grouped addresses;       Manual
                addresses                             published canonical domain; HSTS     review
                                                      preload; seal visible on genuine
                                                      folio pages links to verification

  Node          Resource exhaustion via event         Bounded per-subscriber buffers;      Load
                stream subscribers                    disconnect slow consumers;           tests
                                                      subscriber caps per key
  ------------------------------------------------------------------------------------------------

Security review is a gate for every class 3, 4 and 5 change and for
every new rail profile: the security lead signs the release manifest
entry for it.

------------------------------------------------------------------------

# 49. Key Management Operations

`docs/security/key-management.md` must define: key inventory (Section
19.2 table + monetary authority + governance council + gateway
operator), generation ceremonies (air-gapped, witnessed, scripted,
hashes published), HSM configuration (Rust PKCS#11 bindings through an
isolated signer crate slots, non-exportable keys, M-of-N admin cards),
rotation schedules, revocation, backup (HSM-native encrypted backup,
geographically split), and incident procedures. Development keys are
generated by `aletheia-keygen --dev` only, which refuses to run for
mainnet genesis IDs.

------------------------------------------------------------------------

# 50. DevSecOps --- CI/CD

Every merge request runs the following gates:

``` text
format:          cargo fmt --check
lint:            cargo clippy --workspace --all-targets --all-features -- -D warnings
tests:           cargo test --workspace --locked
security:        cargo deny check + cargo audit + gitleaks + Semgrep + CodeQL
fuzz-smoke:      build every fuzz target and execute each against its checked-in corpus
determinism:     run deterministic corpus on x86-64 and aarch64; compare block/state/receipt/event roots
repro-build:     two clean hardened-release builds; binary hashes must match
coverage:        cargo llvm-cov + coverage gates + requirement traceability
encoding:        check_no_0x.sh + canonical text-vector tests
explorer:        npm ci + typecheck + vitest + Playwright + axe + Lighthouse + font/prose gates
e2e:             local multi-validator network + signer + Arno executor + gateway + indexer + bridge simulator
continuity:      clean-halt (C5) + mixed-version + migration-crash on every PR touching rules/ or storage/
frozen-rules:    check_frozen_rules.sh — frozen rule-set fingerprints unchanged or replay-verified label present
rails:           conformance packs + railsim smoke for every active profile; profile metadata check
paynet:          reference PayNet e2e against the local network
ui-tells:        check_ui_tells.sh + design-token contrast check
```

Nightly: long fuzzing, cargo-mutants, Byzantine simulator suite,
power-loss suite, historical replay of the private validation network
and mainnet archives (Section 44.10), upgrade matrix, railsim chaos,
multi-hour soak, dependency vulnerability scan and
performance regression tests.

Release pipeline: reproducible `hardened-release` build → independent
rebuild → hash match → Sigstore/cosign signing → SLSA provenance →
CycloneDX SBOM → signed release manifest containing Git revision, Rust
toolchain, Cargo.lock hash, binary hashes and supported protocol
versions.

Container images are digest-pinned, non-root, read-only-root-filesystem
where possible, signed and produced only from the reviewed release
pipeline.

# 51. Build Profiles and No Backdoors

  ---------------------------------------------------------------------------
  Profile           Purpose               Development       Assertions
                                          mutation          
                                          facilities        
  ----------------- --------------------- ----------------- -----------------
  Debug             Local development     Available only on All
                                          devnet/regtest    

  Test              CI                    Test-only hooks   All

  Fuzz              Fuzzing               Test-only         All

  Release           Pre-mainnet/private   Compiled out      Consensus safety
                    validation                              checks

  HardenedRelease   Mainnet               Compiled out      Consensus safety
                                                            checks
  ---------------------------------------------------------------------------

Development facilities (faucets, time warp, state injection) MUST be
compile-time excluded from production binaries and additionally guarded
by genesis network kind in development binaries. Release CI inspects
symbols and behavior to prove that no developer mint, balance override,
validator bypass or hidden administrative route exists.

Absolutely no hidden mint functions, developer override balances,
undocumented validator bypasses, master keys in source, secret RPC
endpoints or debug state mutation in production builds. Every privileged
operation is enumerated in `docs/security/privileged-operations.md` and
has an authorization test.

# 52. Testing Strategy

  -----------------------------------------------------------------------
  Level                   Scope                   Tools
  ----------------------- ----------------------- -----------------------
  Unit                    Crypto KATs, ACE,       Rust unit tests
                          arithmetic, address/ID  
                          codecs, VM opcodes,     
                          state transitions and   
                          modules                 

  Property                ACE round trips,        proptest
                          determinism, JMT        
                          equivalence, ordering   
                          invariance, monetary    
                          invariants, exact cash  
                          conversion, bridge      
                          limits                  

  Fuzz                    Transactions, blocks,   cargo-fuzz / libFuzzer
                          P2P frames, RPC JSON,   
                          ISO 20022 XML, Arno     
                          source/bytecode, WAL    
                          recovery, snapshots     

  Integration             Multi-validator and     Rust integration
                          multi-process networks  tests + orchestration
                                                  scripts

  Consensus simulation    Deterministic           Rust simulator
                          virtual-time network    
                          with drops, delay,      
                          reorder, partitions and 
                          Byzantine actors        

  Chaos                   Process kill,           dedicated chaos harness
                          partition, disk full,   
                          storage interruption,   
                          clock failure           

  Power-loss              Every relevant finalize dm-log-writes / crash
                          write-prefix replay     harness

  Performance             Throughput, finality,   Criterion + load
                          execution, state I/O,   generator
                          propagation, recovery   

  Stability               Soak, overload,         soak harness
                          memory/queue bounds     
  -----------------------------------------------------------------------

## 52.1 Code Coverage Gates **\[DECISION ADR-023\]**

Rust coverage is collected with `cargo llvm-cov` / LLVM instrumentation.
Consensus-critical modules have hard line, branch and function gates.
MC/DC is required for the small set of safety predicates listed below
through dedicated decision-coverage tests; the project MUST NOT claim
that generic Rust coverage tooling provides MC/DC unless the selected
toolchain actually supports it.

  -----------------------------------------------------------------------------------
  Module group                      Line         Branch       Function       Decision
                                                                             coverage
  ----------------------- -------------- -------------- -------------- --------------
  `core`, `crypto`,                 ≥95%           ≥90%           100%  100% of named
  `state`, `consensus`,                                                        safety
  `monetary`,                                                              predicates
  `execution`, `vm`                                                    
  verifier/interpreter,                                                
  `bridge`                                                             

  `storage`, `p2p`,                 ≥90%           ≥80%           ≥95%            ---
  `mempool`, `rpc`,                                                    
  signer, guardian                                                     

  `arno` compiler                   ≥90%           ≥80%           ≥95%            ---

  gateway, indexer,                 ≥85%           ≥70%           ≥90%            ---
  observability, tools                                                 

  Explorer TypeScript               ≥85%           ≥75%           ≥90%            ---
  -----------------------------------------------------------------------------------

No pull request may lower a module's ratcheted coverage. Exclusions
require an ADR and are capped at 1% of module lines. Generated and
third-party code is excluded by path, not by convenience annotations.

The named decision-coverage set includes DSP vote/timeout rules, 2-chain
commit, QC/TC verification, monetary invariants, Arno bytecode safety
checks, bridge proof/limit checks and APN payment lifecycle transitions.

## 52.2 Mutation Testing

Coverage shows code was executed, not that tests would catch a bug.
**cargo-mutants** mutation testing runs nightly on consensus-critical
modules. Required mutation score: ≥ 80 % for `consensus`, `monetary`,
`bridge`, VM verifier and ACE codec. Surviving mutants are triaged
weekly: either a test is added or the mutant is documented as
equivalent.

## 52.3 Requirement Traceability

-   Every normative **MUST** in an APS document gets an ID,
    e.g. `APS-0003-R12`.
-   Tests declare what they cover: `// covers: APS-0003-R12`.
-   `tools/trace_check.py` fails CI if any MUST in an APS with status
    `Review` or `Final` has no covering test, and generates
    `docs/testing/traceability.md` (requirement → tests → last result).

## 52.4 Arno Contract and VM Coverage

-   `arno-test --coverage` reports statement and branch coverage per
    contract; all `examples/arno/` contracts and the Arno standard
    library require ≥ 95 % statement and ≥ 90 % branch coverage.
-   **100 % opcode coverage**: every bytecode opcode is executed by the
    VM conformance vectors, and every trap code is triggered at least
    once.
-   Every compiler diagnostic in Section 25.7 has a test that triggers
    it.

## 52.5 End-to-End Functional Verification

`tests/e2e/` proves the whole system works together on a local
4-validator development network with signer, executor, gateway, indexer,
REST, JSON-RPC and a bridge route to a local devnet of a remote chain.
Scenario (runs on every merge to `main` and nightly):

``` text
genesis → transfers (AEY, ALnT) → mint with MintAuthorization → burn / lock / redeem → digital AEY ↔ physical-cash conversion and reconciliation
→ deploy + call Escrow and Payroll (Arno) → identity / residence / land registry operations
→ validator key rotation at epoch boundary → protocol upgrade activation
→ bridge out AEY → bridge back → inbound bridged stablecoin
→ APN: instant payment by phone alias, bulk salary run, request-to-pay, direct debit, return and recall
→ APN: inbound pacs.008 from a simulated partner bank → mint → pay → outbound pacs.008 → reconciliation R1–R3
→ kill -9 a validator mid-finalize → recovery → rejoin
→ verify every result through REST and JSON-RPC (parity), with state and finality proofs
→ check supply invariants I1–I12 and the determinism golden hashes
```

A subsystem is not "in good function" until its unit, property, fuzz,
integration and e2e tests pass **and** its coverage gates are met.

------------------------------------------------------------------------

# 53. Mandatory Determinism Test

``` text
Same Genesis + Same Transactions + Same Protocol Version + Same Contract Bytecode
  ⇒ Identical block hashes, state roots, receipt roots, event roots, and full state dumps
```

`tests/determinism/`:

1.  A corpus generator produces fixed seeded workloads (transfers, batch
    transfers, mints with authorizations, contract deploys/calls
    exercising every opcode, registry ops, failures and traps, EU
    exhaustion, boundary amounts).
2.  `aletheia-replay --genesis g.toml --blocks corpus.bin --dump out.json`
    runs single-node execution.
3.  CI runs it on x86-64 and aarch64, pinned Rust release builds and
    hardened builds, 3 repeated runs, and with different allowed
    allocator/thread-pool configurations. Cross-architecture
    byte-for-byte equality is mandatory.
4.  All outputs compared byte-for-byte; any difference fails CI and
    prints the first differing key.
5.  Golden hashes for the corpus are checked in; changing them requires
    a protocol-version bump or an ADR.

------------------------------------------------------------------------

# 54. APS Conformance Suite

`tests/conformance/` --- language-neutral JSON vectors + a runner. A
node is conformant only if it passes: Serialization (ACE), Address,
Transaction, Block, State Root (JMT proofs), Merkle, DSP (safety-rule
vectors: given SafetyData + proposal → vote/no-vote), BLS (KATs,
aggregation, PoP), Ordering, Arno (compiler outputs for reference
sources), VM (bytecode → receipts), EU (cost vectors), Monetary (ledger
transitions + invariants), P2P (frame codec, handshake), RPC (OpenAPI
contract tests + JSON-RPC 2.0 method/error vectors + REST/JSON-RPC
parity), Text encoding (`0x` rejection, `AL:B` vectors), APN (scheme
conformance, ISO 20022 golden mappings, AAN checksum vectors, lifecycle
transitions), Bridge (message encoding, proof verification, replay
rejection, limits), Recovery (WAL scenarios), Upgrade (activation
vectors). Vectors are versioned with the protocol version they apply to.

------------------------------------------------------------------------

# 55. Repository Structure and Module Dependency Graph

``` text
aletheia-stablechain/
├── CLAUDE.md
├── Cargo.toml                    # workspace + dependency policy
├── Cargo.lock                    # committed, reviewed lockfile
├── rust-toolchain.toml           # pinned Rust toolchain
├── .cargo/config.toml
├── rustfmt.toml
├── clippy.toml
├── deny.toml
├── docs/
│   ├── spec/MASTER.md
│   ├── STATUS.md
│   ├── adr/
│   ├── aps/
│   ├── dsp/
│   ├── arno/
│   ├── apn/
│   ├── architecture/
│   ├── security/
│   ├── operations/
│   └── perf/
├── crates/
│   ├── core/              # strong types, errors, ACE, network identity
│   ├── crypto/            # BLAKE3, Ed25519, BLS, Merkle, KDF, secrets
│   ├── storage/           # RocksDB, archive, WAL, snapshots
│   ├── state/             # JMT, StateView/Overlay, proofs
│   ├── monetary/          # AEY, ALnT, cash ledger, mint/burn/redeem, reserves
│   ├── execution/         # block executor, tx dispatch, fees, receipts, events
│   ├── vm/                # verifier, interpreter, host bridge
│   ├── arno/              # compiler, parser, type/effect checker, codegen
│   ├── identity/
│   ├── residence/
│   ├── land/
│   ├── governance/
│   ├── validator/
│   ├── consensus/         # DSP
│   ├── mempool/
│   ├── p2p/
│   ├── rpc/
│   ├── wallet/
│   ├── gateway/           # ISO 20022 boundary
│   ├── apn/               # Aletheia Payment Network
│   ├── bridge/
│   ├── indexer/
│   ├── observability/
│   └── node/
├── apps/
│   ├── aletheiad/
│   ├── aletheia-cli/
│   ├── aletheia-validator/
│   ├── aletheia-signer/
│   ├── aletheia-keygen/
│   ├── aletheia-genesis/
│   ├── aletheia-admin/
│   ├── aletheia-replay/
│   ├── aletheia-loadgen/
│   ├── aletheia-bridge-relayer/
│   ├── aletheia-guardian/
│   ├── arno/
│   ├── arno-compile/
│   └── arno-test/
├── tests/
│   ├── unit/ property/ fuzz/ integration/ sim/ consensus/ arno/ recovery/ chaos/
│   ├── soak/ determinism/ conformance/ vectors/
├── examples/arno/
├── bridges/
├── explorer/
├── genesis/ configs/ scripts/ deployments/
└── security/
```

v4.0 adds to the workspace:

``` text
crates/
├── verify/          # no_std proof verifiers: finality, JMT, receipt, event (node, PayNet, browser WASM)
├── rails-model/     # Aletheia Canonical Payment (ACP) — off-chain model, serde allowed
├── rails/           # rail profiles, validation layers 1–3, renderers/parsers, adapters, reasons
├── event-stream/    # Finalized Event Stream server (APS-0058)
└── explorer-api/    # Rust read API for the Explorer over the indexer DB
apps/
├── aletheia-steward/      # binary switchover supervisor (Section 44.6)
├── aletheia-explorer-api/
└── aletheia-railsim/      # test-only rail simulators (Section 40C.12); never in a release image
tests/
├── continuity/      # upgrade matrix, mixed-version, migration-crash, clean-halt (Section 44.10)
├── rails/           # conformance packs per rail
└── paynet-reference/
```

Dependency direction is enforced at the Cargo workspace level. Core
protocol crates MUST NOT depend on RPC, UI, gateways or external APIs.
`consensus` may depend on execution/state/crypto/core interfaces but
never on RPC. `arno` compiler code is separate from the consensus node;
the deterministic bytecode verifier is shared as a carefully versioned
protocol component.

# 56. CLI

Binaries (names normalized to `aletheia`):

``` text
aletheiad            node daemon
aletheia-cli         user/operator client
aletheia-validator   validator lifecycle (register, keys, readiness, exit)
aletheia-signer      remote signer daemon (HSM)
aletheia-keygen      key generation (HSM or --dev)
aletheia-genesis     genesis build/verify
aletheia-admin       node admin (snapshots, pruning, peers, diagnostics)
aletheia-replay      deterministic replay / state dump
aletheia-loadgen     load generator (non-production networks)
aletheia-bridge-relayer  bridge proof relayer (untrusted, anyone can run)
aletheia-guardian    bridge guardian daemon (Tier B routes)
arno                 language driver (build, fmt, check, abi)
arno-compile         compiler
arno-test            contract test runner
```

Example output:

``` text
$ aletheia-cli tx show AL:Tq9x…k3
Transaction      AL:Tq9x…k3
Status           FINALIZED  (2-chain, finality proof ✓)
Block            #1,048,576   AL:Bqk7r…m2x
Slot             2,097,153   (epoch 4,096)
Sender           AL:qz7m…l0e
Recipient        AL:qv3r…8ha
Amount           125.000000000000000000 AEY
Fee              0.002100000000000000 AEY
Execution Units  2,100 / 5,000
State Result     SUCCESS   write-set 19b4…c07d
```

All commands support `--output json` (stable schema), `--network`, and
never print secrets; key material prompts use no-echo input.

------------------------------------------------------------------------

# 57. Error Handling

-   Protocol error codes are enumerated in `APS-0038` appendix and
    `crates/core/src/error_codes.rs` (single source generating Rust
    enum, docs table and RPC error catalog).
-   Errors are deterministic, machine-readable (numeric + stable
    symbolic name), human-readable (docs message), and versioned (codes
    are never reused; deprecated codes stay reserved).
-   RPC errors:
    `{ "error": { "code": 2003, "name": "TX_NONCE_TOO_LOW", "message": "...", "details": {...} } }`.
-   Internal exceptions never become protocol semantics.

------------------------------------------------------------------------

# 58. Performance Engineering

Measure first (perf, `bpftrace`, Criterion, flame graphs). Critical
paths: tx stateless validation (batch Ed25519 verify), canonical
ordering, VM dispatch, executor IPC, state reads (block cache hit rate),
JMT updates, hashing (BLAKE3 SIMD), BLS aggregate verify (cache
aggregated pubkeys per bitmap), block propagation.

Allowed optimizations: batch signature verification; parallel
**stateless** validation; prefetching declared keys; zero-copy framing;
bounded Rust allocation arenas/pools for per-block allocations; RocksDB
tuning. Parallelism never changes consensus semantics.

Initial targets to **measure against** (not claims): p50 finality \< 1.5
s, sustained ≥ 5,000 simple transfers/s on reference hardware with 7
validators across 3 regions. Report actuals in `docs/perf/results.md`.

------------------------------------------------------------------------

# 59. Deployment and Operations

Validator reference host (to be benchmarked): 16+ physical cores, 64 GB
ECC RAM, 2× NVMe (enterprise, power-loss-protected) in RAID1 or separate
WAL/DB devices, PTP-capable NIC, dual network, HSM (network or PCIe),
UPS.

systemd unit:

``` ini
# deployments/systemd/aletheiad.service
[Unit]
Description=Aletheia StableChain node
After=network-online.target ptp4l.service
Wants=network-online.target

[Service]
Type=notify
User=aletheia
ExecStart=/usr/bin/aletheiad --config /etc/aletheia/node.toml
Restart=on-failure
RestartSec=5
RestartPreventExitStatus=75         # clean stop at an unsupported protocol version (Section 44.4)
StartLimitIntervalSec=600
StartLimitBurst=3
WatchdogSec=30
LimitNOFILE=65536
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
PrivateTmp=yes
ReadWritePaths=/var/lib/aletheia /var/log/aletheia
CapabilityBoundingSet=
SystemCallFilter=@system-service
MemoryMax=48G

[Install]
WantedBy=multi-user.target
```

Node config:

``` toml
# /etc/aletheia/node.toml
[node]
mode = "validator"                 # validator | full | archive
data_dir = "/var/lib/aletheia"
genesis = "/etc/aletheia/genesis.bin"

[signer]
endpoint = "unix:///run/aletheia-signer/signer.sock"

[storage]
block_cache_mb = 16384
memtable_budget_mb = 4096
compaction_rate_mb_s = 200
retain_state_versions = 100000

[p2p]
listen = "0.0.0.0:26700"
sentry_only = true
max_inbound = 64
max_outbound = 16

[rpc]
enabled = false                    # validators do not expose public RPC (sentry/full nodes do)
rest_listen = "0.0.0.0:26780"      # /api/v1
jsonrpc_listen = "0.0.0.0:26781"   # /rpc/v1 and /rpc/v1/ws
jsonrpc_max_batch = 50

[logging]
level = "info"
ring_dir = "/var/log/aletheia/ring"
ring_max_bytes = 2147483648
zstd_level = 3
dictionary = "/usr/share/aletheia/log-dict-v1.zdict"

[clock]
source = "ptp"                     # ptp | chrony
max_offset_ms = 5
```

Container (non-validator services):

``` dockerfile
FROM a pinned Rust-compatible distroless runtime image
COPY --chown=nonroot:nonroot build/hardened-release/apps/aletheiad /usr/bin/aletheiad
USER nonroot
ENTRYPOINT ["/usr/bin/aletheiad", "--config", "/etc/aletheia/node.toml"]
```

Runbooks required: validator onboarding, key rotation, HSM failover,
node recovery, snapshot restore, disk-full, clock failure, network halt
(\< Q live), conflicting-certificate incident, upgrade execution,
emergency suspension.

------------------------------------------------------------------------

# 59A. Fleet Operations, Release Engineering and Upgrade Execution **\[DECISION ADR-035\]**

## 59A.1 Environments

  ---------------------------------------------------------------------------------------
  Environment          Purpose                                   Data
  -------------------- ----------------------------------------- ------------------------
  local / regtest      Developer machines, single or 4-node      Throwaway
                       networks, virtual time

  devnet               Continuous deployment of `main`           Reset allowed (it is
                                                                 the only network where
                                                                 re-genesis is permitted)

  private validation   Multi-operator, multi-region,             Never reset; upgraded
                       production-like (Section 62 phase 14)     exactly like mainnet

  shadow fork          Short-lived copy of mainnet or private    Copy of real state;
                       validation state with test validator      destroyed after use
                       keys (network kind `shadow`, refused by
                       production binaries' key policy)

  mainnet              Production                                Never reset
  ---------------------------------------------------------------------------------------

The private validation network is upgraded through the same
`UpgradePlan` path as mainnet, at least one release train ahead. It is
the long-running proof of Section 44.

## 59A.2 Release Trains and Versioning

-   Node releases use semantic versioning: `MAJOR` for a new protocol
    version or storage schema, `MINOR` for class 0 features and class 2
    changes, `PATCH` for fixes that change no hash and no layout.
-   A release train every 6 weeks; hot fixes outside the train follow
    the same gates.
-   The signed release manifest lists: Git revision, Rust toolchain,
    `Cargo.lock` hash, binary hashes (both builders), supported protocol
    versions, storage schema and `min_reader_schema`, P2P version range,
    change classes included, rail profile hashes, WASM verifier hash,
    SBOM digest, and the continuity gate results.

## 59A.3 Pipeline

``` text
merge to main → CI gates (Section 50) → nightly: replay, fuzz, soak, power-loss
release branch → reproducible hardened-release ×2 → hash match → sign (cosign) → SLSA → SBOM
             → upgrade matrix + mixed-version + migration-crash gates
             → deploy to devnet → private validation network (UpgradePlan if class 3)
             → shadow-fork rehearsal (class 3) → security + monetary + ops sign-off
             → mainnet: sentries/full nodes → PayNet nodes → validators (59A.4)
```

## 59A.4 Quorum-Safe Rollout

With `n = 3f + 1` validators, consensus survives `f` unavailable. A
rollout must never spend that margin by itself.

-   **Never restart more than `max(1, f − 1)` validators at a time**,
    keeping one fault of headroom for an unrelated failure during the
    rollout. For `n = 7` (`f = 2`): one at a time.
-   Each restarted validator must be following, voting and at the tip
    for one full epoch before the next is touched.
-   Order: sentries and public full nodes → PayNet and gateway full
    nodes → explorer/indexer nodes → validators.
-   For class 3 releases, binaries are installed (and readiness signed)
    on every validator **before** the activation epoch; the switchover
    at the activation height is then a simultaneous clean stop and
    restart that the protocol, not a human, schedules (Section 44.4).
-   Abort criteria (any one stops the rollout and pages): finality p99
    above 2× baseline for 5 minutes; any validator not rejoining within
    10 minutes; any invariant alarm; any reconciliation break.

Validators are bare-metal and configured by Ansible from a signed
inventory; non-validator services run on Kubernetes and are deployed by
GitOps (Argo CD) from digest-pinned images. No one deploys from a
laptop.

## 59A.5 Shadow-Fork Rehearsal (before every mainnet activation)

1.  Take a verified snapshot of mainnet at a recent epoch boundary.
2.  Start a shadow network: same validator count and topology, test
    keys, the candidate binaries, the real state.
3.  Schedule the upgrade through governance on the shadow network with
    a short timelock; attach PayNet staging, the gateway with railsim,
    the indexer and the Explorer.
4.  Drive production-shaped load (`aletheia-loadgen` replaying the
    last week's transaction mix, anonymised).
5.  Pass criteria: activation at the scheduled height; migration
    completes within the budget; finality p99 within 10 % of baseline;
    all invariants and reconciliations hold; every off-chain consumer
    continues from its cursor; the Explorer Chronicle shows the new
    chapter.
6.  Archive the evidence with the release manifest.

## 59A.6 Backups and Disaster Recovery

-   **Chain data**: verified snapshots every epoch to two regions;
    archive segments replicated continuously (append-only, immutable
    object storage with object lock); any full node can be rebuilt from
    snapshot + archive.
-   **Validator safety state**: signer state is backed up, but a
    restored signer refuses to sign below its HSM monotonic counter
    (Section 19.2); restoring a validator from backup never risks
    equivocation.
-   **PostgreSQL** (indexer, explorer API, gateway, rail ledgers):
    continuous WAL archiving with point-in-time recovery; the gateway
    and rail ledgers are additionally hash-chained (Section 40) and
    verified after restore.
-   **DR drills** quarterly: lose a region; lose a validator's disks;
    restore the gateway ledger to a point in time and reconcile;
    rebuild the indexer from the event stream. Targets: RPO 0 for
    finalized data; RTO ≤ 15 min for APN services, ≤ 4 h for a
    validator from bare metal.

## 59A.7 Service Levels and Alerting

  -------------------------------------------------------------------------------
  Signal                                         Page when
  ---------------------------------------------- --------------------------------
  Finality stalled                               no finalized block for 10 slots

  Finality latency                               p99 > 2 × baseline for 5 min

  Invariant checker                              any failure (node is fail-stopped)

  Validator missed votes                         > 5 % over an epoch

  Clock offset                                   > 5 ms (PTP) for 1 min

  Disk                                           < 15 % free or compaction stalls

  Upgrade readiness                              < threshold 2 epochs before
                                                 activation

  Reconciliation break                           any R1--R9 break above threshold

  Escrow in investigation                        any escrow past expiry > 1 h

  Event stream lag (PayNet, indexer)             > 5 s

  Explorer API error rate                        > 1 % for 5 min
  -------------------------------------------------------------------------------

Every alert links a runbook. Additional runbooks in v4.0: upgrade
switchover, migration failure and checkpoint rollback, shadow-fork
rehearsal, rail partner outage, escrow investigation, PayNet stream
lag, emergency halt and resume (Section 44.8).

------------------------------------------------------------------------

# 60. Documentation

Required: Architecture, APS (all), DSP, Arno reference + contract
developer guide, Arno VM, node operations, validator operations, wallet,
RPC (OpenAPI), P2P, monetary system, identity, residence, land registry,
gateway, security + threat model, deployment, recovery, backup, incident
response, developer guide, logging/observability guide.

Documentation describes actual implementation behavior. Planned behavior
is labeled **Planned (vX.Y)** and tracked in `docs/STATUS.md`. A CI job
checks that every APS listed as `Final` has test vectors and a
referenced implementation path.

------------------------------------------------------------------------

# 61. Trust Boundaries and No Hidden Dependencies

Trust boundaries (each validates all input, with fuzz targets):

``` text
External Client → RPC            RPC → Mempool             Mempool → Consensus
Consensus → Execution            Execution → State         Arno Executor ↔ Node (host bridge)
Node → P2P peers                 Node → Storage (read-back verification)
Node ↔ Signer                    Signer → HSM              Gateway → External Financial Systems
Gateway → Chain                  Indexer ← Node            Logship → ClickHouse
Remote chains → Bridge (via untrusted relayers)            Bridge Guardians → Chain
```

The consensus core never depends on: internet access, external APIs,
cloud services, DNS (peers via configured IPs/validator registry; DNS
only for optional bootstrap of non-validators), external price feeds,
filesystem timestamps, wall clocks, or centralized databases. External
data enters only via signed transactions (Section 18.8).

------------------------------------------------------------------------

# 62. Implementation Phases (with exit criteria)

  -------------------------------------------------------------------------------------
  Phase            Deliverables                Exit criteria
  ---------------- --------------------------- ----------------------------------------
  0 Specifications Deliverables in Section 65; Reviewed APS 0001--0012, 0017--0021,
                   ADR-001...035               0034, 0041; DSP v0.1 doc incl. safety
                                               argument

  1 Crypto &       ACE, BLAKE3/Ed25519/BLS     KATs pass; round-trip property tests;
  encoding         wrappers, addresses,        fuzzers 24 h clean; vectors published
                   tx/block IDs, Merkle        

  2 Storage &      KvStore+RocksDB, JMT +      KvStore conformance; JMT root == naive
  state            proofs, block archive,      root (property); power-loss suite green
                   consensus WAL, snapshots    

  3 Single-node    Accounts, transfers, fees,  Determinism test green cross-arch;
  state machine    receipts, events, ordering, recovery tests green
                   recovery                    

  4 Multi-node P2P Transport, channels,        7-node private validation network syncs;
                   gossip, block/state sync    fuzzed framing; DoS limits tested

  5 DSP            Validator registry,         Simulator Byzantine suite green (10k
                   schedule, safety rules,     seeds); chaos 24 h no safety violation
                   pacemaker, QC/TC, finality, 
                   evidence, remote signer     

  6 Native assets  Asset framework, ALnT       Supply invariants property-tested

  7 AEY            Monetary module, mint auth, Monetary attack tests; invariant
                   caps, attestations,         fail-stop tested
                   invariant checker           

  8 Arno compiler  Lexer→package, diagnostics, Reference contracts compile
                   reproducible output         byte-identically across machines;
                                               compiler fuzzed

  9 Arno VM        Verifier, interpreter, EU,  VM conformance vectors; 7-day fuzz
                   sandboxed executor          clean; sandbox escape tests

  10 Native        Identity, residence, land,  Permission tests; history proofs
  registries       governance                  

  11 Gateway + APN ISO 20022 boundary, audit   XSD/XXE fuzz; golden mappings;
                   ledger                      idempotency tests; APN directory,
                                               schemes, messaging, rail adapters and
                                               reconciliation; sandbox live; reference
                                               participant passes certification

  12               REST/WS + JSON-RPC 2.0,     Contract tests vs OpenAPI/OpenRPC;
  RPC/SDK/Wallet   OpenAPI + OpenRPC, CLI,     REST/JSON-RPC parity; wallet vectors
                   wallet, TS SDK              

  12C Explorer     Aletheia Explorer per       Designer sign-off; visual regression,
                   Section 41A, WASM           axe, Lighthouse budgets and coverage
                   verifiers, docs site in the gates green
                   same design                 

  12B Bridge       Bridge module, first        Route test suite (40A.11) green;
                   route(s), relayer, guardian I10--I12 property tests; external audit
                   daemon, remote endpoints    of both sides; bug bounty live before
                                               production route activation

  13 Hardening     Fuzzing campaign, pentest,  Critical/High findings closed
                   fault injection, dependency 
                   & key-mgmt review, external 
                   audit                       

  14 Private       Multi-operator,             30+ days, no safety violation,
  Validation       multi-region private        soak/overload/fault-injection/recovery
  Network          network with                gates met; not publicly exposed
                   production-like topology    

  15 Mainnet       Conformance, recovery       Signed readiness checklist by
  Readiness        drills, audits,             engineering, security, monetary and
                   monetary/cash ceremonies,   operations leads
                   external-rail simulations,  
                   runbooks                    

  16 Mainnet       Production genesis,         Genesis reproducibility, validator
  Genesis & Launch validator ceremony,         quorum, reserve controls and launch
                   reserve/custody controls,   checklist signed
                   APN participant             
                   certification               
  -------------------------------------------------------------------------------------

Every phase additionally requires, for the modules it delivers: coverage
gates met (Section 52.1), requirement traceability complete (Section
52.3), and the e2e suite (Section 52.5) green for the features that
exist so far.

## 62.1 v4.0 Phase Amendments

  ----------------------------------------------------------------------------------------------
  Phase                       Added deliverables                     Added exit criteria
  --------------------------- -------------------------------------- ---------------------------
  0 Specifications            APS-0054...0058; ADR-029...035;        Reviewed by all four seats
                              Appendix R interfaces written

  2 Storage & state           `DATADIR` manifest, storage schema 1,  Migration-crash test green
                              migration framework with a dummy       on the dummy step;
                              1→2 step, checkpoint/rollback          refuse-newer test green

  3 Single-node state         `Rules` enum with V1 and a test-only   Mixed-version and clean-
  machine                     V2 that adds one tx type; protocol     halt (C5) tests green on a
                              schedule namespace 66; clean halt      single node; replay of a
                              exit 75                                1M-block devnet history
                                                                     reproduces every root

  5 DSP                       Activation at epoch boundary under     Simulator: activation with
                              DSP; readiness signalling              readiness just above and
                                                                     just below threshold

  11 Gateway + APN            Canonical payment model; rail          Conformance packs green;
                              profiles for SCT, SCT Inst, SDD,       railsim chaos green with
                              CBPR+, Fedwire, FedNow; railsim;       I13--I15, R8--R9;
                              escrow tx types 144--147; namespaces   profile verification
                              107/108                                record for each profile

  11B PayNet integration      Finalized Event Stream (APS-0058);     Reference PayNet e2e green;
                              settlement submission rules;           stream resume at random
                              R4--R7 reconciliation; reference       cursors; duplicate re-
                              PayNet                                 signed payment rejected by
                                                                     namespace 107

  12C Explorer                Full Section 41A incl. seal, Chronicle,Design rubric ≥ 4 on every
                              Payments, Directory, explorer API,     page; UI-tell gate green;
                              version-aware rendering                budgets met; unknown-type
                                                                     rendering test green

  14 Private validation       At least two real protocol upgrades    C1--C6 demonstrated on the
                              (class 3) and one storage migration    long-running network
                              (class 1) executed in place

  15 Mainnet readiness        Shadow-fork rehearsal procedure        Rehearsal evidence archived;
                              proven; steward signed; DR drills      DR targets met
  ----------------------------------------------------------------------------------------------

------------------------------------------------------------------------

# 63. Definition of Done (per subsystem)

A subsystem is done only when: implementation exists; public interfaces
documented; deterministic behavior tested (unit + property); invalid
inputs tested and fuzzed where it parses input; security boundaries
defined; failure behavior defined and tested; recovery tested where
relevant; metrics and log events defined; resource limits enforced;
documentation matches implementation; `docs/STATUS.md` updated; coverage
gates and ratchet met (Section 52.1); every APS MUST traced to a test
(Section 52.3); e2e suite green; CI green on all presets including
sanitizers.

------------------------------------------------------------------------

# 64. Final Engineering Invariants

  -----------------------------------------------------------------------
  Domain                      Invariant
  --------------------------- -------------------------------------------
  Monetary                    No unauthorized supply creation; I1--I9
                              hold after every finalized block

  State                       No divergent state among honest validators
                              under the fault model

  Consensus                   No two conflicting finalized blocks;
                              finality is irreversible

  Transactions                Canonical ACE serialization; canonical
                              `AL:T` IDs over body

  Addresses                   Canonical 62-character `AL:` addresses with
                              network-bound checksums

  Contracts                   Deterministic Arno execution; linear assets
                              cannot be duplicated or lost

  Recovery                    Crash recovery never alters finalized
                              history; never proceeds from unverified
                              state

  Stability                   Bounded memory/queues; fail-stop instead of
                              divergence

  Logging                     Logs compressed before persistence; secrets
                              unloggable by construction

  Security                    No production backdoors; every privileged
                              path documented and authorized

  Upgrades                    Activation is explicit, deterministic,
                              epoch-aligned

  Storage                     Corruption is detectable; compression never
                              touches commitments

  Operations                  Validator health, consensus state and
                              supply are observable

  Cryptography                Established primitives only, behind
                              versioned agility layer

  Bridge                      Exactly-once messages; I10--I12 hold; a
                              remote-chain failure is capped by route
                              limits

  Encoding                    No `0x` anywhere; `AL:`, `AL:T`, `AL:B` and
                              unprefixed lowercase base16 only

  Interfaces                  REST and JSON-RPC return identical data for
                              identical queries

  Quality                     Coverage gates, mutation score and
                              traceability enforced on every merge

  Craft                       Code, docs and UI read as hand-written;
                              Manrope is the only typeface in every UI

  Payments                    Every payment has one lifecycle, one UETR
                              and one final settlement; reconciliation
                              R1--R3 hold; no personal data on-chain

  Physical cash               Digital AEY and physical AEY banknotes are
                              one monetary unit; cash conversion is
                              value-neutral; aggregate cash outstanding
                              reconciles exactly
  -----------------------------------------------------------------------

## 64.1 Invariants Added in v4.0

  -----------------------------------------------------------------------
  Domain                      Invariant
  --------------------------- -------------------------------------------
  Continuity                  The chain has one genesis. Every release
                              continues from the last finalized block;
                              every historical block replays to its
                              recorded roots under its own protocol
                              version

  Evolution                   Frozen rule sets never change behaviour;
                              new behaviour arrives only as a new
                              protocol version at an epoch boundary

  Storage evolution           Migrations are forward-only, journaled,
                              checkpointed and verified against the
                              state root; a newer data directory is
                              never opened by a reader that cannot read
                              it

  External legs               Escrowed AEY is in exactly one state;
                              never released by time alone (I13--I15)

  Rail interop                Every emitted message passes its rail
                              profile's layers 1--3; nothing is
                              truncated or transliterated silently;
                              every inbound credit is applied exactly
                              once (R8--R9)

  PayNet                      Nothing is reported final without a
                              verified finality proof; ledgers reconcile
                              (R4--R7); duplicates are rejected in
                              consensus (namespace 107)

  Explorer                    Every page verifies what it shows; renders
                              every historical and unknown type without
                              error; Manrope only; passes the UI-tell
                              gate

  Fleet                       No rollout ever removes more than
                              `max(1, f − 1)` validators at once

  Logs and disk               Every log (node and RPC) is compressed
                              before persistence and bounded by a byte
                              budget; no node ever fills its disk
                              without forecast, shedding and a clean
                              stop; chain data is never deleted by the
                              guard
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 65. Immediate Deliverables (Phase 0)

Produce these before broad feature development:

``` text
CLAUDE.md
docs/spec/MASTER.md                         (this document)
docs/STATUS.md
docs/adr/ADR-000-template.md … ADR-018-*.md
docs/architecture/master-architecture.md
docs/architecture/threading-and-stability.md
docs/architecture/storage-and-databases.md
docs/architecture/logging-and-compression.md
docs/aps/REGISTRY.md
docs/aps/APS-0001-network-identity.md
docs/aps/APS-0002-addresses.md
docs/aps/APS-0003-transactions.md
docs/aps/APS-0004-blocks.md
docs/aps/APS-0005-state-root.md
docs/aps/APS-0006-merkle.md
docs/aps/APS-0007-dsp.md
docs/aps/APS-0008-validator-identity.md
docs/aps/APS-0009-bls.md
docs/aps/APS-0010-chrono-slots.md
docs/aps/APS-0011-ordering.md
docs/aps/APS-0012-execution.md
docs/aps/APS-0013-arno.md
docs/aps/APS-0014-arno-bytecode.md
docs/aps/APS-0015-arno-vm.md
docs/aps/APS-0016-execution-units.md
docs/aps/APS-0017-native-assets.md
docs/aps/APS-0018-aey.md
docs/aps/APS-0019-alnt.md
docs/aps/APS-0020-monetary-issuance.md
docs/aps/APS-0021-mint-burn-lock-redemption.md
docs/aps/APS-0034-wal-recovery.md
docs/aps/APS-0041-canonical-encoding.md
docs/aps/APS-0042-fees.md
docs/aps/APS-0043-remote-signer.md
docs/aps/APS-0044-observability-log-format.md
docs/aps/APS-0046-bridge.md
docs/aps/APS-0047-json-rpc.md
docs/aps/APS-0048-text-encoding.md
docs/aps/APS-0049-apn-directory.md … APS-0053-apn-rails-fx-reconciliation.md
docs/apn/rulebook.md
docs/apn/mappings/ (pacs.008, pacs.002, pacs.004, pacs.003, pain.001, pain.013, camt.053, camt.054, camt.056)
docs/apn/certification-test-cases.md
docs/arno/grammar.ebnf
docs/arno/language-reference.md
docs/rpc/openrpc.json
docs/testing/traceability.md
docs/design/explorer-design-system.md      (Section 41A, with Figma link)
docs/engineering/craft-standard.md         (Section 3.4)
.github/pull_request_template.md
scripts/check_prose.sh, scripts/check_fonts.sh
docs/dsp/dsp-v0.1.md
docs/security/threat-model.md
docs/security/key-management.md
docs/security/privileged-operations.md
docs/operations/recovery.md
tests/vectors/README.md
Cargo.toml, Cargo.lock, rust-toolchain.toml, `.cargo/config.toml`, rustfmt.toml, clippy.toml, deny.toml
scripts/check_banned.sh, scripts/check_no_0x.sh, scripts/lint.sh, scripts/coverage.sh
coverage-gates.toml, tools/coverage_gate.py, tools/trace_check.py
.github/workflows/ci.yml
docs/adr/ADR-029-versioned-rules-registry.md
docs/adr/ADR-030-storage-schema-and-migrations.md
docs/adr/ADR-031-canonical-payment-model-and-rail-profiles.md
docs/adr/ADR-032-paynet-integration-boundary.md
docs/adr/ADR-033-explorer-design-system-and-seal.md
docs/adr/ADR-034-node-supervision-and-task-model.md
docs/adr/ADR-035-quorum-safe-rollout.md
docs/adr/ADR-036-rpc-log-compression-and-disk-guard.md
docs/operations/capacity.md
docs/aps/APS-0054-chain-continuity.md
docs/aps/APS-0055-data-directory-and-storage-schema.md
docs/aps/APS-0056-canonical-payment-and-rail-profiles.md
docs/aps/APS-0057-paynet-interface.md
docs/aps/APS-0058-finalized-event-stream.md
docs/apn/mappings/status-reasons.md
docs/apn/profile-verification/README.md
docs/operations/upgrade-switchover.md
docs/operations/shadow-fork-rehearsal.md
docs/operations/exit-codes.md
docs/engineering/node-standard.md          (Section 46A)
crates/rails/profiles/                      (SCT, SCT Inst, SDD Core, SDD B2B, CBPR+, Fedwire, FedNow)
crates/execution/src/rules/frozen.toml
scripts/check_ui_tells.sh, scripts/check_frozen_rules.sh
```

Then implement the Rust workspace from the protocol foundation upward,
Phase 1 first, using the private validation network only after the
single-node and deterministic foundations pass.

------------------------------------------------------------------------

# 66. Engineering Standard

Build this as infrastructure another senior engineering team could
inherit and operate for decades.

Favor **correctness over shortcuts, determinism over convenience,
explicit protocol rules over assumptions, established primitives over
custom cryptography, recoverability over fragile performance tricks,
stability over peak throughput, and measured performance over
theoretical claims.**

The final result must be a genuine native Aletheia StableChain
implemented in Rust, with Arno as its native contract language, the
Aletheian Guilder (AEY) as the national currency of the Sovereign
Covenant State of Aletheia in both digital and physical form, APN as its integrated payment/settlement layer operated through
Aletheian PayNet, external rails reached correctly through versioned
rail profiles, and a history that runs unbroken from genesis through
every upgrade it will ever receive. It must be
infrastructure another senior engineering team can inherit and operate
for decades---not a demonstration disguised as a blockchain.

------------------------------------------------------------------------

# Appendix R. Normative Rust Interfaces --- Status After v4.0

v3.0 left 27 `rust` blocks empty. v4.0 fills ten of them in place
(Sections 3.2, 3.3, 9, 15, 40B.3.1, 40B.7, 40B.8, 42.1, 42.2, 46.1). The
remaining seventeen are **Phase 0 obligations**: Claude Code writes each
interface from the normative text around it, in the style of the filled
blocks, records it in the named APS document, and gets sign-off from the
seat listed before any implementation depends on it.

  ---------------------------------------------------------------------------------------------
  R      Section   Interface to write                              APS        Sign-off seat
  ------ --------- ----------------------------------------------- ---------- -----------------
  R.1    10        `NetworkIdentity`, `NetworkKind`, `ChainId` and APS-0001   Protocol
                   digest binding

  R.2    11        `Address` (Bech32m `AL:`), HRP/checksum         APS-0002   Protocol,
                   network binding, parse/display                             Security

  R.3    12.2      Base16 text codec rejecting `0x`, uppercase,    APS-0048   Protocol
                   odd length

  R.4    13        `StatelessValidator` with the ordered checks    APS-0003   Protocol,
                   and first-failure error codes                              Security

  R.5    16.3      `StateProof`, `ReceiptProof`, `EventProof`      APS-0006   Protocol,
                   types and verify functions (in `crates/verify`)            Full-stack

  R.6    17        `CryptoProfile` agility layer: hash, sign,      APS-0037   Security
                   verify, aggregate by profile id

  R.7    18.2      Monetary arithmetic: `mul_div` with explicit    APS-0020   Protocol
                   `Rounding { Floor, Ceil, HalfEven }`

  R.8    18.4      `SupplyLedger` and the invariant checker        APS-0018   Protocol
                   I1--I15

  R.9    18.5      `MintAuthorization` verification (M-of-N,       APS-0021   Security
                   expiry, single use)

  R.10   19.2      Remote signer high-water marks and refusal      APS-0043   Security,
                   rules                                                      DevOps

  R.11   19.5      `SafetyRules` timeout handling and TC           APS-0007   Protocol
                   formation

  R.12   22        Deterministic ordering function                 APS-0011   Protocol

  R.13   28        VM dispatch loop with metering and trap         APS-0015   Protocol,
                   semantics                                                  Security

  R.14   28.1      Executor sandbox setup (seccomp, namespaces,    APS-0015   Security
                   rlimits) and host-call bridge

  R.15   37.2      JSON-RPC method registry and dispatcher         APS-0047   Full-stack

  R.16   40A.7     Bridge inbound execution                        APS-0046   Protocol,
                                                                              Security

  R.17   45.3      Binary log API (`log_event!` shape, ring        APS-0044   DevOps
                   writer)
  ---------------------------------------------------------------------------------------------

------------------------------------------------------------------------
