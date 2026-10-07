//! Which rule set governs a height, and the clean halt at the edge of a binary's knowledge
//! (spec Section 44.4, condition C5).
//!
//! The protocol schedule lives in state (namespace 66), so every node, light client and the
//! Explorer reads the same activation history. Versions are scheduled consecutively from 1;
//! the governing version of a height is the highest one whose activation height is at or
//! below it.

use aletheia_core::{AletheiaError, ErrorCode, Height, ProtocolVersion};
use aletheia_state::StateView;

use crate::model::{ProtocolScheduleEntry, Records};
use crate::rules::{MAX_SUPPORTED_VERSION, Rules};

/// The version the schedule assigns to `height`, and its entry.
pub fn scheduled_version(
    records: &Records,
    view: &dyn StateView,
    height: Height,
) -> Result<ProtocolScheduleEntry, AletheiaError> {
    let mut governing: Option<ProtocolScheduleEntry> = None;
    let mut version: u16 = 1;
    while let Some(entry) = records.schedule_entry(view, version)? {
        if entry.activation_height > height.get() {
            break;
        }
        governing = Some(entry);
        version = match version.checked_add(1) {
            Some(next) => next,
            None => break,
        };
    }
    governing.ok_or_else(|| {
        AletheiaError::new(
            ErrorCode::StoCorrupt,
            "protocol schedule has no entry for version 1".to_owned(),
        )
    })
}

/// The rules for `height`, or a clean-halt error if the schedule assigns a version this binary
/// does not implement. `ProtocolUpgradeRequired` is fail-stop: the node writes a checkpoint,
/// prints the halt message and exits with status 75 (Section 44.4).
pub fn rules_for_height(
    records: &Records,
    view: &dyn StateView,
    height: Height,
) -> Result<(Rules, ProtocolScheduleEntry), AletheiaError> {
    let entry = scheduled_version(records, view, height)?;
    match Rules::for_version(ProtocolVersion::new(entry.protocol_version)) {
        Ok(rules) => Ok((rules, entry)),
        Err(_) => Err(AletheiaError::new(
            ErrorCode::ProtocolUpgradeRequired,
            format!(
                "Protocol version {} activates at height {} (epoch {}). This binary supports protocol versions 1-{MAX_SUPPORTED_VERSION}.",
                entry.protocol_version, entry.activation_height, entry.activation_epoch
            ),
        )),
    }
}
