# ADR-047: Arno VM v1 run-time semantics and costs
Status: Accepted
Date: 2026-10-07
Context: Sections 28 and 29 fix the interpreter-only design, the limits (registers, call
depth 16, 4 MiB per call, 32 MiB per transaction), trap-and-revert, and an EU cost table.
They leave open several details every validator must agree on bit for bit: how contract
storage and vaults are laid out, how memory is counted, the cost of operations the table
does not list, and the rounding of signed division.
Options considered:
  A. Leave these to the implementation and document later.
  B. Fix them now, in one place, as part of protocol version 1.
Decision: B (crates/vm, `interp.rs`, `value.rs`, `cost.rs`):
  1. Storage. Each storage slot is addressed by `(slot index, key)`; plain slots and vaults
     use an empty key, map entries the canonical encoding of the map key. Values are the
     canonical ACE encoding of their declared type; an absent slot reads as its type's zero
     value. A vault slot stores its balance as a 16-byte little-endian `u128`. The coins in
     a contract's vaults are held in the contract account's native balance; the vault
     records only how much of that balance each vault holds.
  2. Metering. Every charge is checked before its action, so execution stops at exactly
     `eu_used == eu_limit`. Costs not in the Section 29 table: `MHAS` costs a storage read
     without the per-byte part; `TRANSFER` costs 2,000 EU, like a native transfer; host
     reads of chain facts cost only the base instruction.
  3. Memory. Each register write of a value larger than 16 bytes, and each list append,
     adds the value's size to a running per-call and per-transaction total that never
     decreases, charged at 3 EU per started 32 bytes. Passing 4 MiB in a call or 32 MiB in a
     transaction traps (`VM_MEMORY_LIMIT`). The count is conservative and deterministic.
  4. Arithmetic. Integer operations are checked and trap on overflow or division by zero.
     Int64 division rounds toward zero and the remainder takes the dividend's sign.
     `MULDIV` uses a 256-bit intermediate, rounding down or up as the opcode says.
  5. Control. `LOOP` traps (`VM_LOOP_BOUND_EXCEEDED`) when its counter is already zero, and
     otherwise decrements it and jumps back. Compiled loops are tested at the bottom with
     the counter starting at `bound - 1`, so a loop runs at most `bound` times.
  6. Traps. Each trap has a code in APS-0038 (131xx). A contract `require` / `fail` is
     `VM_CONTRACT_ABORTED` with the contract's error index; the receipt carries both. A
     state the verifier rules out is `VM_INTERNAL`, a fail-stop, never a divergent result.
Consequences: Contract behaviour is fully determined by the package, its arguments and
state. Changing any rule here is a protocol-version change.
Protocol impact: APS-0015 (VM) and APS-0016 (EU) record these rules; error codes 13100 to
13112 are registered.
