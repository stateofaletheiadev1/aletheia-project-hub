# ADR-0006: Pricing a transfer in two simulations

Status: Accepted

**Update (node ADR-064).** Both passes now simulate an *unsigned preview* (body + public key, no
signature); the first signature is made at approval. Against an older node the wallet detects
`TX_THRESHOLD_NOT_MET` and prices from a signed copy as described below, saying so on the screen.

**Context.** Admission requires `available(fee asset) ≥ max_fee ≥ eu_limit × eu_price`, and the node does
not publish `eu_price`. Simulation requires a valid signature (D-3).

**Decision.** Pass 1 signs the draft with `eu_limit` 10,000 and `max_fee` = the available fee balance and
simulates it; `price = fee ÷ eu_used` exactly (anything else is refused). Pass 2 builds the final body with
`eu_limit = eu_used + 25 %` and `max_fee = eu_limit × price`, signs and simulates it; the review is decoded
from those bytes. On approval the worker re-signs the same body and the wallet checks the bytes are
identical (Ed25519 is deterministic) before submitting. A price over a minute old is re-taken.
