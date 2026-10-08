# ADR-049: Arno surface syntax shaped like Java and Solidity, with English operators
Status: Accepted (supersedes the syntax part of ADR-019)
Date: 2026-10-08
Context: ADR-019 placed Arno in the Pascal family (`begin ... end`, `:=`, `procedure`,
`var` sections, `{ }` comments, `end.`). The project owner asked for a syntax that most
developers already read fluently, the object-oriented shape of Java and Solidity, while
staying as close to plain English as possible and keeping `public` and `private`. Only the
surface changes: the type system, linear Coins, declared effects, bounded loops, the
bytecode and the VM are untouched.
Options considered:
  A. Keep the Pascal syntax.
  B. Solidity look: `==`, `&&`, `uint128`, `Vault<AEY>`, `require(cond, Error)`.
  C. Plain sentences: `set x to y`, `let x be y`, no braces.
  D. Java/Solidity shape with English operators and checks.
Decision: D (crates/arno `lexer.rs`, `parser.rs`; grammar in `docs/arno/grammar.ebnf`):
  1. A file is one `contract Name { version 0.1; uses Coins, Auth; ... }`. `uses Coins` is
     short for `uses Std.Coins`.
  2. Members: `constant N = 5;`, `type Amount = UInt128;`, `enum Phase { A, B }`,
     `record Employee { Address wallet; UInt128 salary; }`, `error Name "message";`,
     `event Name(Type a, Type b);`, contract variables `private Type name;`, the
     `constructor(...)`, and functions.
  3. Functions: `[public|private] [view] [reentrant] function name(Type a, ...) [returns T]
     [effects] { ... }`. A public function without a result is an entry the outside world
     calls (its first parameter is the caller's `Signer`). A view function returns a value,
     changes nothing and can be read by anyone, so `private view` is refused (A1112). A
     public function that returns a value must be a view (A3004). A private function is a
     helper only the contract calls. Effects keep their English phrases (`changes storage`,
     `receives coins`, `sends coins`, `emits events`, `calls contracts`).
  4. Contract variables are always private (A1110 for `public`): chain state is public to
     readers of the chain anyway, and a `public view function` states what the contract
     promises to share.
  5. Statements end with `;` and blocks use braces. Local variables are declared where they
     are needed, Java style (`UInt128 total = 0;`); each name is declared once per function.
     `if c { } else if d { } else { }`, `for each x in list { }`, `for i from 1 to 10 { }`
     (loop variables may be typed or take the items' type, or UInt64 when counting),
     `while c at most N times { }`, `switch x { case A, B -> ...; default -> ...; }`,
     `require c otherwise Error;`, `fail Error;`, `emit Event(...);`, `return x;`,
     `move x`.
  6. Operators are words where Java uses symbols: `is`, `is not`, `and`, `or`, `not`, `xor`,
     `div`, `mod`; `=` assigns. `==` and `!=` are recognised only to say "write 'is'"
     (A1113). There is still no `/` (A1008).
  7. Comments are `//` and `/* */`; text is in double quotes with `\"` and `\\` escapes.
  8. Names stay case-insensitive and names differing only by case are still an error
     (A4007), so `Employee employee` is refused; write `Employee person`. Keywords are
     lowercase by convention; the examples use camelCase for members and PascalCase for
     types, errors, events and enum values.
  9. `return x;` stores the result and leaves; at the end of a function (also in a final
     `if`/`else`/`switch` arm) it compiles exactly like the old `Result := x;`.
Verification: the three reference contracts, written in the new syntax with the old names,
compiled to identical bytecode, function tables, storage, errors and events (the only
difference: the constructor's recorded name is `constructor`). The nine APS-0015 VM vectors
give the same results, traps, EU and storage; only their source and package bytes changed.
Consequences: every `.arno` file, test and vector source was rewritten; golden package hashes
were regenerated (source hashes differ). Section 25 of the master specification now shows the
new syntax (ERRATA E-27). New diagnostics: A1110-A1113.
