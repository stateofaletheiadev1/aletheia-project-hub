# ADR-051: Canonical payment model, rail profiles and validation layers 2-3
Status: Accepted
Date: 2026-10-08
Context: Section 40C defines the Aletheia Canonical Payment (ACP), rail profiles as reviewed
data, four validation layers and the reason-code table. It leaves open how profile review is
represented before anyone has reviewed a profile, which values a profile must carry for the
validators, and what the layers do with identifiers, addresses and calendars.
Options considered:
  A. Ship profiles marked reviewed with placeholder reviewers.
  B. Ship drafts that say they are drafts, and make the loader enforce the difference.
Decision: B (crates `rails-model`, `rails`):
  1. ACP types check themselves when built: bounded texts count characters and refuse
     over-long values; IBAN and LEI check MOD 97-10; BIC has the ISO 9362 shape; UETR is a
     lowercase version 4 UUID; `AEY` is refused as a currency code. One euro cent is exactly
     10^16 AEY base units, and AEY that is not a whole number of cents does not leave.
  2. Profiles are TOML with unknown fields refused. A profile is `draft` or `active`; an
     active profile needs two different reviewers and a review date; `on_violation` must be
     `reject`. A production gateway loads active profiles only. The profile in force is the
     one with the latest `effective_from` on the acceptance date; its content hash
     (`ALETHEIA/RAIL-PROFILE/v1`) goes into every audit record it touched.
  3. Layer 2 (usage rules): character set (first offending character named), end-to-end id
     and remittance lengths and line counts, IBAN-only accounts and BIC-only agents where the
     profile says so, structured or hybrid addresses. Layer 3 (scheme rules): currency, zero
     amount, scheme cap, charge bearer, settlement on a weekday for business-day rails,
     duplicates by the profile's key (UETR, or end-to-end id, debtor account, amount and
     date). Each failure names layer, ISO reason and field.
  4. The reason table lives in code and generates `docs/apn/mappings/status-reasons.md`; a
     time-out (`AB05`, `AB06`) maps to INVESTIGATING, never to a failure.
  5. Seven draft profiles: SCT, SCT Inst, SDD Core, SDD B2B, CBPR+, Fedwire, FedNow. Values
     uncertain when drafted are left empty or drafted narrow; the verification record says
     which.
Consequences: holiday calendars, cut-off times and partner-specific limits are data still to
come with verification; layer 1 (XML parsing and schemas), layer 4 (chain-state rules), the
gateway pipeline and the rail simulator follow.
