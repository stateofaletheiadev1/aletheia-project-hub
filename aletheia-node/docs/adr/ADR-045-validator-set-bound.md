# ADR-045: At most 1,024 validators per epoch
Status: Accepted
Date: 2026-10-07
Context: Signer bitmaps (Section 19.3) and the consensus inbox (`4 * MAX_VALIDATORS`,
Section 46.1) need a bound. The spec names `MAX_VALIDATORS` but gives no value. The type
`ValidatorIndex(u16)` allows up to 65,536.
Options considered:
  A. 65,536, the full `u16` range. Bitmaps of 8 KiB per certificate and an unbounded vote
     fan-in, far outside the scale a 2-chain BFT protocol runs well at.
  B. 1,024. A 128-byte bitmap, and well above the 7 to 100 validators the private validation
     network and early mainnet will run.
Decision: B. `aletheia_core::block::MAX_VALIDATORS = 1024`. Decoders refuse larger bitmaps.
Consequences: Raising the bound later is a protocol-version change (class 3), because it
changes which certificates decode.
Protocol impact: APS-0009 and APS-0025 record the bound.
