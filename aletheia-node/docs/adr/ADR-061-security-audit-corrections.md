# ADR-061: Rule corrections from the 2026-10-13 security audit
Status: Accepted
Date: 2026-10-13
Context: The node audit (docs/audit/2026-10-13-node-security-audit.md) found that some work
the protocol makes a node do was not bounded or not paid for by the transaction that caused
it. A contract could declare a register type whose zero value is gigabytes (a huge or nested
array), which the interpreter built before charging anything or checking memory. Values copied
into record fields, array elements and call arguments, and comparisons of large values, cost a
flat amount whatever their size. A bridge attestation made the node re-verify a proof of
possession for every guardian its bitmap named, a pairing check each, for one flat price. The
consensus engine held votes, timeouts and proposals for any future round. Each of these lets
one transaction, or one Byzantine validator, make every node do unbounded work, and because
the contract worker's wall-clock watchdog fail-stops on a second failure, a slow or
memory-heavy call can stop validators.

Protocol version 1 is not frozen: no production network has activated it and
`crates/execution/src/rules/frozen.toml` does not exist (rules/mod.rs, rule 1). Changing it
now needs no new protocol version and no migration; once frozen, any of these would.
Decision:
  1. Verifier (deploy time): every type's zero-value size is computed from the type table in
     one linear pass (`value::zero_sizes`); a type whose zero value exceeds `MAX_CALL_MEMORY`
     (4 MiB) is refused, as is a function whose registers together start larger than that.
  2. Interpreter: a call frame is sized before it is built; above `FREE_FRAME_BYTES` (1 KiB)
     it costs `MEMORY_PER_32_BYTES` like any other memory, and a frame over `MAX_CALL_MEMORY`
     traps with `MemoryLimit` before allocation. `SETF` and `SETI` charge and count the copy
     they write, as a register write already did. `EQ` and `NE` on operands larger than
     `FREE_COMPARE_BYTES` (64) cost `COMPARE_PER_32_BYTES` per 32 bytes of the larger one.
     Scalars, addresses and hashes keep their old cost, so ordinary contracts see no change.
  3. Bridge: an attestation costs `BRIDGE_VERIFY_EU` plus `BRIDGE_SIGNER_EU` (40,000) for each
     guardian named in its bitmap, charged from the bitmap before any pairing runs. Proofs of
     possession are still re-verified (the defence against a mistakenly registered rogue key
     stays), now at their real price.
  4. Consensus engine (no rule change, node behaviour): votes, timeouts and proposals are held
     only for rounds up to `MAX_ROUNDS_AHEAD` (64) beyond the engine's own; certificates are
     taken from any round, including those carried by proposals beyond the window, so a node
     that fell behind still catches up. After the first equivocating twin of a leader's
     proposal (kept, and evidenced), further twins are dropped unless certified.
  5. The contract worker confines itself before its first request: a 1 GiB address space
     (`setrlimit`), so a fault that escapes metering ends in a failed allocation rather than
     in the host's memory or swap; no filesystem access (Landlock); and process, socket,
     tracing, namespace, module and identity system calls refused with `EPERM` (seccomp). The
     seccomp filter is a denylist on purpose: an allowlist that missed a call the runtime
     makes would crash the worker, and two crashes on one call fail-stop the node.
  6. Execution budgets follow measured speed. The interpreter ran about 58 million EU a
     second (release build, a shared 4-core machine, a tight loop). Version 1 let a single
     transaction set `eu_limit` up to the 2,000,000,000 EU block limit, about 35 seconds of
     execution: past the 10 s contract watchdog, whose second expiry is a fail-stop, so one
     transaction could stop validators, and an honest full block could take far longer than
     a round. `TxLimits::max_eu_limit` is now 30,000,000 (about 0.5 s; stateless validation
     refuses more) and `max_block_eu` 60,000,000 (a full block of 20,000 transfers needs 40
     million). Both are calibrated on reference hardware before version 1 is frozen; the
     rule to keep is that the largest transaction finishes well inside the watchdog on the
     slowest supported node, swap included.
Consequences: Contracts that copy, pass or compare large values pay for it; existing example
contracts and the golden-hash and determinism suites are unchanged by these rules. Bridge
relayers must set `eu_limit` for the guardian count they attest with (about 2.6 million EU for
a full set of 64). These values are devnet defaults like the rest of the cost table and are
calibrated on reference hardware before version 1 is frozen.
