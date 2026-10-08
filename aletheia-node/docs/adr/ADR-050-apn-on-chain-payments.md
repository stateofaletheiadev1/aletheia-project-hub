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
 11. Scheduled payments (136): the debtor schedules a payment for a future UTC day (id
     `H_domain("ALETHEIA/APN-SCHEDULE/v1", debtor ‖ nonce)`, namespace 104); the fee for its
     execution is paid when it is scheduled. At most 1,000 per day, kept in a queue per day
     in scheduling order. After a block's transactions, the protocol's end-of-block step
     executes due payments in that order, at most 256 per block and over at most 32 days
     per block, from a cursor in state. Each runs on its own checkpoint with every payment
     check; a failure (unfunded, limit, duplicate, inactive agent) is recorded on the
     schedule as FAILED with its error code and moves nothing. Results are kept in state
     (status, error code, height): the step has no transaction, so it has no receipt or
     events. Balances it moves join the block's supply check.
 12. External legs (144-147, Section 40C.7). A lock comes from an ACTIVE participant's
     settlement account through an ACTIVE gateway operator (role 3), within the gateway's
     per-payment maximum, de-duplicated by `(participant, UETR, 0)` like a payment. The AEY
     sits as locked balance of one escrow account (module address 7); the supply ledger
     moves it from circulating to locked. Only the leg's gateway settles (the escrow is
     burned as a redemption: `burned_total`, `redeemed_total` and liabilities move) or
     releases (back to the sender). I13 holds by construction: only LOCKED moves, to
     SETTLED or RELEASED. I14 is checked after every block: the escrow total kept in state
     equals the escrow account's locked balance and the account holds nothing available;
     a mismatch makes the block invalid. I15: nothing releases by time; an expired leg stays
     LOCKED for the gateway's investigation.
 13. Inbound credits (147) mint through the same checks as Mint (capacity, epoch cap,
     reserve ratio) and are unique per `(rail, UETR hash, MsgId hash, amount)`. The R2 bound
     is the Monetary Authority's standing authorization: `(id, gateway, max_total,
     valid_until_epoch)` signed once by M of N authority keys under
     `ALETHEIA/APN-STANDING/v1`, carried by every inbound credit; the chain counts what was
     minted under each id and refuses more than `max_total`. A replay is reported as a
     duplicate before any other check.
Consequences: A way for the debtor to cancel a scheduled payment before its day is not in
the spec and is not provided. A governed resolution of a leg stuck in investigation (I15)
needs a governance action and is not provided yet; the gateway's definitive answer is the
only way out today. KYC-tier
amount limits per customer need the identity tiers and are not enforced yet.
