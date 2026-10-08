# ADR-052: ISO 20022 parsing at the rail boundary (layer 1) with quick-xml
Status: Accepted
Date: 2026-10-08
Context: Sections 40 and 40C.4 require inbound messages to be refused before their content is
read when they are too large, carry a DTD or entities, or are not the message version the
profile names, and outbound messages to be rendered deterministically. The spec names a
hardened `quick-xml` reader. This adds a parsing dependency to the off-chain rails crate;
it is not used by consensus, crypto, storage or execution.
Options considered:
  A. A full DOM or XSD library with entity support switched off by configuration.
  B. `quick-xml` 0.38 (MIT, depends only on `memchr`), with the refusals written in our code,
     where they can be tested.
Decision: B (`crates/rails/src/iso/`):
  1. The reader refuses: more than 1 MiB (checked before parsing), non-UTF-8, any DTD, any
     processing instruction, entity references other than the five XML predefines and
     character references, more than one root, text outside the root, nesting deeper than
     32, more than 20,000 elements. Nothing is fetched or expanded. Every refusal is layer 1,
     ISO reason `FF01`.
  2. `pacs.008` maps to and from the canonical payment; `pacs.002` to and from transaction
     statuses. The `Document` namespace must name the version in the profile; a Business
     Application Header envelope is accepted around the `Document`. Required elements and
     the declared transaction count are checked; amounts must fit the currency's minor
     units exactly.
  3. A UETR is never replaced. On a rail where it is optional and a message has none, one is
     derived from rail, `MsgId`, `EndToEndId` and `InstrId` (`ALETHEIA/RAIL-UETR/v1`), so a
     redelivery derives the same one. Where it is required, its absence is a refusal.
  4. Rendering is pure: same payments, profile, creation time and settlement method give the
     same bytes. A property test checks `parse(render(p)) = p`.
  5. Status codes are classified; only `ACSC`/`ACCC` (settled) and `RJCT` are definitive.
     `PDNG` and the in-progress codes are not, so an escrow is not settled or released on
     them (I15).
Consequences: validation against the pinned XSD files (`crates/rails/xsd/`) is not
implemented yet; the mappings check the elements they read. The conformance packs of
operator-published samples, `pacs.004`, `camt.05x` and `pain.001` follow.
