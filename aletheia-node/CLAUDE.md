# CLAUDE.md — Aletheia StableChain

## Prime directives
1. The spec at docs/spec/MASTER.md is authoritative. Do not silently change protocol decisions.
2. Consensus-critical code (crates/core, crates/consensus, crates/execution, crates/state,
   crates/monetary, crates/vm, crates/crypto, crates/verify) MUST be deterministic: no floats, no unordered iteration feeding
   hashes/state, no wall-clock reads, no locale, no UB, no platform-dependent sizes.
3. Every subsystem ships with tests in the same change. No test = not done.
4. Never fake cryptography, consensus, persistence or monetary accounting. Mocks live only
   under tests/ or src/**/testing/, are marked NON-PRODUCTION, and are excluded from
   Release / HardenedRelease builds by Cargo.
5. Ambiguity → write an ADR in docs/adr/ (template in docs/adr/0000-template.md), choose the
   option that best preserves: Determinism > Safety > Security > Auditability >
   Upgradeability > Operational simplicity > Performance. Then implement.
6. Never disable warnings, sanitizers or tests to make CI pass.
7. Never log secrets. Secret-bearing values are wrapped in aletheia_crypto::Secret<T>, which has no Debug/Display.
8. Never emit or accept "0x"-prefixed text. Use AL:, AL:T, AL:B identifiers and unprefixed
   lowercase base16 (Section 12.2). Write protocol codes in decimal.
9. Arno is Pascal-style (Section 25). Do not introduce C/Rust/Solidity-like syntax.
10. Write like a careful human engineer (Section 3.4): domain names, comments that explain why,
    specific error messages, specific commit messages. No filler words, no emoji.
11. Explorer and every UI use Manrope only and follow Section 41A. No UI kits, no gradients,
    no generic card grids. A human designer signs off every page.
12. Payments follow Section 40B: one lifecycle, UETR everywhere, never put personal data on-chain,
    never use "AL" as an ISO country code. Account numbers use the ALX prefix (Section 40B.3.1).
13. Continuity (Section 44): never edit a frozen rule set; every behaviour that can change a
    hash belongs to a protocol version; no feature flags in consensus; never write code that
    needs re-genesis, a resync or a manual state edit to deploy. Label every PR with its
    change class (0–5).
14. Storage layout changes bump `storage_schema` and ship a journaled, resumable migration with
    a crash test (Section 44.5). Old archive segments are never rewritten.
15. Rails (Section 40C): all rails go through the canonical payment model; operator-changeable
    values live in rail profiles with effective dates; never truncate or transliterate silently;
    an instant-payment time-out is not a failure; external legs use the escrow-lock.
16. PayNet (Section 40D): off-chain consumers use the Finalized Event Stream and commit their
    cursor with their effects; nothing is reported final before a verified finality proof.
17. Node craft (Section 46A): one owner per piece of mutable state, every queue bounded and
    declared in crates/node/src/channels.rs, every spawned task supervised; patterns N1–N20
    are review failures.
18. Explorer (Section 41A): scripts/check_ui_tells.sh must pass; Svelte 5 runes; amounts via
    BigInt only; the seal is ornament, the Verify button is proof.
19. Logs and disk (Sections 45.6, 45.7): RPC/API request logs are binary, sampled, rolled up
    and zstd-compressed before they touch disk; never write access logs or bodies to PostgreSQL;
    every log store has a byte budget; the disk guard sheds logs long before chain data is at risk.

## Work loop (per task)
1. Read the relevant APS doc(s) in docs/aps/. If missing, write/extend them first.
2. Define/extend the public interface in the owning crate (crates/<crate>/src/lib.rs); keep it pub(crate) unless it is API.
3. Write failing tests (unit + property; fuzz target for any parser/decoder).
4. Implement.
5. Run: `cargo fmt --check && cargo clippy --workspace --all-targets --all-features -- -D warnings && cargo test --workspace --locked && ./scripts/lint.sh`
6. Run the applicable sanitizer/concurrency/fault-injection jobs for touched modules; do not substitute a passing debug build for sanitizer coverage.
7. Run: ./scripts/coverage.sh — LLVM coverage gates and ratchet (Section 52.1) must pass.
8. Update docs to match actual behavior. Update docs/STATUS.md (implemented vs planned).
9. Commit in small, reviewable units: "<module>: <imperative summary>" + APS/ADR references.
10. Write the four-seat answers (Section 1.4) and the change class (Section 44.2) in the PR.

## Build profiles
dev | test | coverage | fuzz | release | hardened-release (Cargo profiles), plus CI jobs: miri (unsafe
boundaries), nightly -Zsanitizer=address|thread (FFI and concurrency crates), loom (lock-free code).
These jobs are CI-only; building the node never requires nightly (Section 5.5).

## Forbidden in consensus-critical code
floating-point arithmetic, nondeterministic map/set iteration feeding protocol outputs, OS/random APIs in consensus semantics, wall-clock reads in consensus semantics, unchecked panics, unsafe pointer casts in consensus code, and unreviewed FFI.

## Repository layout (monorepo)
This workspace lives in `aletheia-node/` of the aletheia-project-hub repository. Paths in the
spec such as `crates/`, `docs/`, `scripts/` are relative to `aletheia-node/`. The spec's
`explorer/` directory is `../aletheia-explorer/`. The repository root holds the national web
platform (Next.js) and is not part of the node build. All work lands on the `main` branch.
