# ADR-038: ProtocolVersion is u16 wherever it is encoded
Status: Accepted
Date: 2026-10-07
Context: Section 3.2 defines `ProtocolVersion(u16)`. Block and transaction `version` fields
are `u16`, and the protocol schedule (Section 44.4) keys on `protocol_version u16`. The
Section 10 table and the WAL segment header (Section 24.1) say `u32`. See ERRATA E-2.
Options considered:
  A. u16 everywhere. 65,535 versions is far more than decades of epoch-aligned upgrades need.
  B. u32 everywhere. That changes three normative structures for no practical gain.
  C. Mixed widths. That forces conversions with failure cases at every boundary.
Decision: A. The WAL header keeps its 4-byte slot as `u16 protocol_version || u16 reserved = 0`,
and a non-zero reserved value is a decode error.
Consequences: One type, `aletheia_core::ProtocolVersion`, with no fallible conversions between
widths.
Protocol impact: Section 10 and Section 24.1 are read as u16. No version bump: nothing has been
encoded yet.
