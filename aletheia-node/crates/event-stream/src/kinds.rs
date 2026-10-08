//! Event kinds: a stable decimal code per event schema, so consumers filter and dispatch
//! without string matching. Codes are never reused. A schema not in this table (a contract's
//! own events, or one added after the consumer was built) has kind 0 and is skipped by
//! consumers that do not know it, never treated as an error.

use aletheia_core::Hash32;
use aletheia_execution::receipt::event_type;

/// The envelope layout version.
pub const EVENT_SCHEMA: u16 = 1;

/// `(code, schema)`, by code.
pub const KINDS: &[(u16, &str)] = &[
    (1, "aletheia.asset.transfer.v1"),
    (10, "aletheia.monetary.mint.v1"),
    (11, "aletheia.monetary.burn.v1"),
    (12, "aletheia.monetary.lock.v1"),
    (13, "aletheia.monetary.unlock.v1"),
    (14, "aletheia.monetary.redemption_requested.v1"),
    (15, "aletheia.oracle.reserve_attestation.v1"),
    (20, "aletheia.contract.deployed.v1"),
    (30, "aletheia.identity.created.v1"),
    (31, "aletheia.identity.updated.v1"),
    (32, "aletheia.identity.status.v1"),
    (33, "aletheia.identity.rotated.v1"),
    (34, "aletheia.credential.issued.v1"),
    (35, "aletheia.credential.status.v1"),
    (36, "aletheia.residence.issued.v1"),
    (37, "aletheia.residence.status.v1"),
    (40, "aletheia.land.registered.v1"),
    (41, "aletheia.land.transferred.v1"),
    (42, "aletheia.land.encumbered.v1"),
    (43, "aletheia.land.released.v1"),
    (44, "aletheia.land.status.v1"),
    (50, "aletheia.governance.proposed.v1"),
    (51, "aletheia.governance.voted.v1"),
    (52, "aletheia.governance.executed.v1"),
    (100, "aletheia.apn.payment.settled.v1"),
    (101, "aletheia.apn.batch.skipped.v1"),
    (102, "aletheia.apn.payment.returned.v1"),
    (103, "aletheia.apn.recall.requested.v1"),
    (104, "aletheia.apn.recall.answered.v1"),
    (105, "aletheia.apn.messages.anchored.v1"),
    (106, "aletheia.apn.aan.assigned.v1"),
    (107, "aletheia.apn.proxy.registered.v1"),
    (108, "aletheia.apn.proxy.removed.v1"),
    (109, "aletheia.apn.request.created.v1"),
    (110, "aletheia.apn.request.answered.v1"),
    (111, "aletheia.apn.mandate.created.v1"),
    (112, "aletheia.apn.mandate.amended.v1"),
    (113, "aletheia.apn.mandate.cancelled.v1"),
    (114, "aletheia.apn.payment.scheduled.v1"),
    (120, "aletheia.apn.external.locked.v1"),
    (121, "aletheia.apn.external.settled.v1"),
    (122, "aletheia.apn.external.released.v1"),
    (123, "aletheia.apn.external.inbound.v1"),
];

/// The kind code of an event type, or 0 when the schema is not in the table.
pub fn kind_of(emitted: &Hash32) -> u16 {
    KINDS
        .iter()
        .find(|(_, schema)| event_type(schema) == *emitted)
        .map_or(0, |(code, _)| *code)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn codes_are_unique_ascending_and_nonzero() {
        for pair in KINDS.windows(2) {
            assert!(pair[0].0 < pair[1].0);
        }
        assert!(KINDS.iter().all(|(code, _)| *code != 0));
        let mut schemas: Vec<_> = KINDS.iter().map(|(_, s)| *s).collect();
        schemas.sort_unstable();
        schemas.dedup();
        assert_eq!(schemas.len(), KINDS.len());
    }

    #[test]
    fn unknown_schemas_are_kind_zero() {
        assert_eq!(kind_of(&event_type("aletheia.apn.payment.settled.v1")), 100);
        assert_eq!(kind_of(&event_type("arno.SomethingHappened")), 0);
    }
}
