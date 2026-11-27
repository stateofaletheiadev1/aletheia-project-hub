# ADR-075: Equivocation evidence on chain (protocol version 3)
Status: Accepted
Date: 2026-11-27
Context: Section 19.8 answers an equivocating proposer or voter with "record evidence (both
signatures); submit to Validator Registry → SUSPENDED", and Section 34 lists `SubmitEvidence`:
"verified on-chain (two conflicting signed messages for the same round) and results in automatic
SUSPENDED at the next epoch boundary", slashing disabled until audited. The engine already
detects vote and proposal equivocations with both signed messages (`aletheia_consensus::Evidence`)
but only counted them. Protocol version 3 (ADR-074) is not scheduled on any production network,
so its rules may still grow; evidence joins it rather than waiting for a version 4.

Decision:
  1. **Type 69 `SubmitEvidence`, from any account** (the submitter pays the fee), carries an
     `Equivocation`: two votes by one validator in one round of an epoch for different blocks
     (round, epoch, voter index, both hashes and signatures: a vote's signature covers round,
     block hash and epoch, so nothing else is needed), or two proposals by one leader for one
     slot (both headers and signatures: a proposal's signature covers only the block hash, so
     the headers show the shared epoch, slot and proposer).
  2. **Verified against the epoch's own set**, which state keeps for every epoch, so evidence
     from before a key rotation still proves out. Two conflicting messages and two valid
     signatures by the same member are required; anything less is `VAL_EVIDENCE_INVALID`
     (14020). Each equivocation (validator, epoch, round, kind) is recorded once; the same one
     again is `VAL_EVIDENCE_KNOWN` (14021).
  3. **Suspension as the Council's `SuspendValidator`.** The validator leaves the set when the
     block closes the epoch (epochs are event-driven, ADR-069, so the "next epoch boundary" is
     the next block) and keeps its bond; reinstatement is the Council's. No slashing. The last
     member is never removed: the evidence is recorded with `suspended = false` in the
     `aletheia.validator.equivocation.v1` event and the chain runs on (liveness is a Section 19.8
     requirement too).
  4. **Nodes keep what they see.** Each equivocation the engine reports is written once to
     `<data_dir>/evidence/` (`ALEVID01 | ACE(Equivocation)`, at most 256 files) and logged with
     the command to submit it, `aletheia-cli validator submit-evidence --file`. A node holds no
     account to pay fees, so submission is the operator's or the Council's. Invalid proposals
     and conflicting certificates are logged only: the first is not provable from a signature,
     the second carries aggregates that do not single out the signers.
  5. Before version 3, type 69 is inactive like any new type (ADR-074 item 5).

Consequences: equivocation now has a consequence on chain that anyone can trigger with the
signed messages, and the suspended operator's bond stays locked until the Council decides.
Change class 3 (part of protocol version 3). Tests: encodings and the evidence file round trip;
the admission gate under versions 1 and 2; end to end over TLS, a forged second signature is
refused, real vote evidence suspends the validator at once, the same evidence again is refused,
and proposal evidence against the last validator is recorded while the set stays.
