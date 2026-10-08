# ADR-050: APN on-chain payments, protocol version 1
Status: Accepted
Date: 2026-10-08
Context: Section 40B defines the participant directory, the payment types and their ISO 20022
mapping, and Section 40D.5 the payment de-duplication key. It leaves open who may send each
transaction, how an agent is tied to the accounts it serves, how limits are counted, how
returns and recalls change state, how a non-atomic batch reports skipped legs, and the
transactions that maintain account numbers and proxies.
Options considered:
  A. Trust participants' gateways: any account may name any agent; checks happen off chain.
  B. Enforce on chain what the chain can know: agent status, the agent-to-account link,
     limits and de-duplication, with explicit sender rules for every transaction.
Decision: B (crates/core `apn.rs`, crates/execution `apn_model.rs`, `rules/v1/apn.rs`):
  1. Participants are written only by governance: `UpsertParticipant` admits as ACTIVE (or
     replaces a record, keeping status and certification epoch) and `SetParticipantStatus`
     changes status; suspension has no timelock, other changes one governance epoch.
     TERMINATED is final. One settlement account belongs to one participant; an indirect
     participant names an existing sponsor, and acts only while the sponsor is ACTIVE.
  2. A participant serves an account when it is its settlement account or the participant
     assigned it an account number (`AanAssign`, type 141, only in its routing range). A
     payment's debtor agent must serve the sender and the creditor agent the creditor.
  3. Limits: the debtor agent's `per_payment_max` and `daily_out_max`, the creditor agent's
     `daily_in_max`, per UTC day of protocol time (`protocol_time_ms / 86,400,000`). A
     single payment also needs the debtor agent certified for its scheme (bit `scheme`).
  4. De-duplication: each settled leg stores `(tx_id, height, expires_day, debtor, creditor,
     amount, returned, recall)` under `H_domain("ALETHEIA/PAYDEDUP/v1", debtor_agent ‖
     uetr_hash ‖ leg)` for 400 days; a live entry refuses the payment (PAY_DUPLICATE). Batch
     legs carry their own UETR and use leg 0 (ISO 20022 gives each credit its own UETR; the
     one-byte leg number is for splitting one UETR).
  5. Returns (137) come from the original creditor, at most what is left. A recall (138)
     comes from the original debtor while nothing was recalled before; the creditor's answer
     (139) either returns everything left or declines. Finality is never undone.
  6. A non-atomic batch runs each leg on its own checkpoint; a leg's failure reverts only
     that leg and is reported in one `aletheia.apn.batch.skipped.v1` event as (index, error
     code) pairs. An atomic batch fails as a whole.
  7. Types 141-143 (account number assignment, proxy register and remove) are added to the
     APN range; proxies and anchors are written by an ACTIVE participant's settlement
     account, and a proxy is removed only by the participant that registered it.
  8. Costs (devnet defaults, benchmarked before version 1 freezes): 4,000 EU per payment
     leg, return or accepted recall; 3,000 EU for other operations and a batch's overhead.
  9. Request-to-pay (130-131): the payee creates a request (id `H_domain("ALETHEIA/APN-
     REQUEST/v1", payee ‖ nonce)`, namespace 104) naming the payer, amount, its own agent,
     UETR and last valid day; only the payer answers, once, before it expires. Accepting
     pays it as an ordinary credit transfer through the payer's agent, with every payment
     check and de-duplication.
 10. Mandates (132-135): the debtor creates a mandate (id `H_domain("ALETHEIA/APN-MANDATE/
     v1", debtor ‖ nonce)`, namespace 103); the debtor's signature on that transaction is the
     mandate signature. Frequencies once, weekly, monthly, quarterly, yearly, on demand; a
     debit is allowed at most once per ISO week, calendar month, quarter or year of the UTC
     day of protocol time. The debtor amends (maximum, final day, suspend or resume) and
     either party cancels for good. A direct debit comes from the creditor, inside the
     window and maximum, and settles as a payment from the debtor.
Consequences: scheduled payments (136) need the protocol to act at block boundaries and
follow in their own step, as does external-leg escrow (144-147). KYC-tier
amount limits per customer need the identity tiers and are not enforced yet.
