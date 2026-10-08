# ADR-054: Arno names are case-sensitive, as in Java
Status: Accepted (supersedes point 8 of ADR-049)
Date: 2026-10-08
Context: ADR-049 kept Arno's Pascal-era rule that names are case-insensitive and that two
names differing only by case are an error (A4007). Java and Solidity developers write
`Employee employee`, which that rule refused. The project owner chose Java's rule.
Decision:
  1. Keywords are lowercase and exact: `public` is a keyword, `Public` is a name.
  2. Names compare exactly. `Employee employee` declares a type and a variable;
     `total` and `Total` are two names. A4007 is retired; a name declared twice is still
     A4008.
  3. Built-ins have one spelling each, following Java conventions: types and standard units
     in PascalCase (`UInt128`, `Address`, `Coins`, `Chain`), functions and members in
     camelCase (`transfer`, `mulDiv`, `verifyEd25519`, `caller.address`, `safe.withdrawAll`,
     `Chain.protocolTime`), constants with capitals (`Nothing`, `RoundUp`, `Vault.Empty`).
  4. A name that matches a known one apart from case is reported with the right spelling:
     "There is no function named 'Transfer'. Names are case-sensitive: did you mean
     'transfer'?"
Consequences: the reference contracts already used these spellings, so their bytecode and
the VM vectors are unchanged.
