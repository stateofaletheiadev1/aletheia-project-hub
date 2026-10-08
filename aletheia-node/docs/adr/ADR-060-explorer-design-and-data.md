# ADR-060: Explorer design and data path
Status: Accepted
Date: 2026-10-08
Context: Section 41A describes the Explorer as "The Public Ledger": warm paper, ink, a
brass seal, a single typeface, and a PostgreSQL indexer behind an explorer API. The owner of
the State set a different direction for the Explorer's look, supplied the national arms and
flags, and ruled out PostgreSQL and MongoDB: the State is building its own database engine,
and until it exists nothing else stands in for it.
Decision:
  1. Look: a royal-blue dashboard (header with the arms' shield, the national flag and the
     network; title and search; four figure tiles; live block and transaction streams as
     cards; a footer naming the Sovereign Covenant State of Aletheia with the full arms, the
     motto VERITAS IN FOEDERE and both flags). The flag's navy, gold and cream and the arms'
     laurel green carry the State's marks; the flag's eight-pointed star marks finality.
     Manrope is the typeface; JetBrains Mono is used for hashes only. This replaces the
     visual rules of 41A.1 to 41A.6 and 41A.19's banned-pattern checks.
  2. List and detail pages (blocks, transactions, a block, a transaction) follow the column
     tables, Overview and Logs tabs and paging of a PolygonScan-style explorer, styled in the
     same blue and gold.
  3. The correctness rules of 41A stay: amounts are exact (BigInt, never rounded; the full
     value on hover), identifiers keep their checksums and are never altered, the 0x prefix
     is refused with an explanation, every text colour passes WCAG 2.2 AA (checked from
     `src/app.css` by `scripts/check-contrast.mjs`), the CSP allows only the page's own
     origin, and fonts and images are served by the Explorer itself.
  4. Data: the Explorer's server reads a full node's REST interface (`ALETHEIA_RPC`), never a
     validator. One in-process follower keeps the latest 150 blocks, their transactions and
     the network figures, counts transactions back to genesis in the background, and pushes
     each finalized block to browsers as server-sent events. Pages load their data from the
     node on the server. Transaction lists walk finalized blocks downwards until the State's
     database engine provides an index; address activity is what the follower has seen.
  5. Development data comes from `configs/devnet-explorer.toml` (a devnet with funded
     development accounts, RPC on, budget raised for the Explorer) and `apps/devnet-traffic`
     (signed transfers between those published accounts; refuses any network but devnet).
Consequences: Section 41A's indexer, explorer API and PostgreSQL are not built; the
database engine will replace the walking lists. In-browser proof verification, treasury,
validator, payment, bridge and registry pages, and translations follow.
