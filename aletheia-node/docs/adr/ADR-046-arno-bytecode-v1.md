# ADR-046: Arno bytecode format v1 and its verifier
Status: Accepted
Date: 2026-10-07
Context: Section 27 fixes the package outline, the 32-bit ABC/ABx instruction words and the
opcode groups, and lists what the deploy-time verifier must reject. It leaves open how
operand widths are chosen, how loop bounds are made visible to the verifier, how register
types are known without dataflow inference, what the code hash is computed with, and how
errors and events (needed by `ABORT` and `EMIT`) appear in the package.
Options considered:
  A. One opcode per operand width (`ADD_U64`, `ADD_U128`, ...) and type inference over the
     control-flow graph in the verifier.
  B. Each function declares the type of every register; one opcode per operation; the
     verifier checks each instruction against the declared types locally.
Decision: B, with these rules (crates/vm, `opcode.rs`, `package.rs`, `verifier.rs`):
  1. `FunctionDef.registers` lists a type per register; parameters are the first ones. All
     operands of an arithmetic or comparison instruction must share one type, which fixes
     the width. Registers start at their type's zero value; coins registers start empty.
  2. Jumps (`JMP`, `JMPIF`, `JMPIFNOT`) go forward only. The only backward edge is
     `LOOP A Bx`, which traps when counter register A reaches 0 and otherwise decrements it
     and jumps back. A loop counter may be written only by `LOADI`, `LOADK` or `LOOP`, so its
     bound is a constant the verifier can see. Every function ends in `RET`, `RETV` or `ABORT`.
  3. Coins are linear in bytecode too: `MOV` refuses coins types, `MOVE` empties its source,
     and a dataflow pass requires every coins register to be full before it is consumed or
     read and empty before it is filled, the same state wherever paths meet, and nothing held
     at a return. An abort reverts the transaction, so aborting paths need not be empty.
  4. Effects come from instructions (`SSTORE`, `MPUT`, `MDEL`, vault deposits and
     withdrawals, `VEMPTY` change storage; `TRANSFER` sends coins; `EMIT` emits events) and
     from callees; all must be within the function's declared mask. A function taking coins
     declares "receives coins". View functions declare no effects.
  5. The call graph has no cycles and no chain deeper than 16 frames, checked statically.
  6. The package adds `errors` (name and message) and `events` (name and typed fields)
     tables to the outline, plus the compiler id and the source hash Section 26 requires.
     Names are text constants. Type references point to earlier types only, so the table
     cannot be cyclic; records and enumerations compare by definition, other types
     structurally.
  7. `code_hash` is BLAKE3 in key-derivation mode with context `ALETHEIA/ARNO-CODE/v1` over
     the body, so a package has the same hash on every network. Function code ranges must
     tile the code section in order with whole instructions.
  8. Host functions are a fixed, versioned table (`HOST A Bx`): chain height, slot, epoch,
     protocol time and transaction id (1-5), BLAKE3 (16) and Ed25519 verification (17).
Consequences: The verifier is linear in code size and needs no type inference. Packages
are larger by one type index per register. Adding an opcode, a host function or a table is
a format-version change. Interpreter semantics for each opcode (Phase 9) follow this record.
Protocol impact: APS-0014 records the format; error codes 13001 (malformed package) and
13002 (verification failed) are registered in APS-0038.
