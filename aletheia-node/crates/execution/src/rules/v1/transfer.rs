//! `Transfer` (type 1) and `BatchTransfer` (type 2), protocol version 1.

use aletheia_core::{AceEncode, Address, AletheiaError, ErrorCode, Hash32, TransferLeg};
use aletheia_state::StateOverlay;

use crate::context::{Meter, OutOfEu};
use crate::model::Records;
use crate::receipt::{Event, event_type};
use crate::rules::v1::balances::{credit, debit};
use crate::rules::v1::limits::TRANSFER_EU;

pub(crate) const TRANSFER_EVENT_SCHEMA: &str = "aletheia.asset.transfer.v1";

/// Applies legs in order. All-or-nothing is the caller's checkpoint: any error here reverts
/// every leg of the transaction.
pub(crate) fn apply_legs(
    records: &Records,
    overlay: &mut StateOverlay<'_>,
    sender: &Address,
    legs: &[TransferLeg],
    meter: &mut Meter,
    events: &mut Vec<Event>,
) -> Result<Result<(), OutOfEu>, AletheiaError> {
    for leg in legs {
        if meter.charge(TRANSFER_EU).is_err() {
            return Ok(Err(OutOfEu));
        }
        let asset = records.asset(overlay, leg.asset)?;
        if !asset.is_some_and(|config| config.transferable) {
            return Err(AletheiaError::new(
                ErrorCode::TxAssetUnknown,
                format!("asset {} does not exist or is not transferable", leg.asset),
            ));
        }
        debit(records, overlay, sender, leg.asset, leg.amount)?;
        credit(records, overlay, &leg.recipient, leg.asset, leg.amount)?;

        let mut data = sender.to_ace_bytes();
        data.extend_from_slice(&leg.recipient.to_ace_bytes());
        data.extend_from_slice(&leg.asset.to_ace_bytes());
        data.extend_from_slice(&leg.amount.to_le_bytes());
        events.push(Event {
            emitter: crate::model::module_address(2),
            event_type: event_type(TRANSFER_EVENT_SCHEMA),
            topics: vec![sender.to_word(), leg.recipient.to_word(), asset_topic(leg)],
            data,
        });
    }
    Ok(Ok(()))
}

fn asset_topic(leg: &TransferLeg) -> Hash32 {
    let mut bytes = [0u8; 32];
    bytes[28..].copy_from_slice(&leg.asset.get().to_be_bytes());
    Hash32::from_bytes(bytes)
}
