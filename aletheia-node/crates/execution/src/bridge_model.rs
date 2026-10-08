//! Bridge state (spec Sections 15, 40A.10):
//!
//! ```text
//! 96 BridgeRoutes    (0, route) RouteState      (1, set) GuardianSet      (2) Σ AEY escrowed (all routes)
//!                    (3) the list of route ids
//! 97 BridgeMessages  (0, id) outbound message   (1, route, sequence) consumed inbound id
//!                    (2, id) PendingInbound (large transfers in their delay, or flagged)
//! 98 BridgedAssets   (0, asset) Flows {locks, releases}   (1) the list of bridged assets
//! ```

use aletheia_core::bridge::{BridgeMessage, BridgeRoute, GuardianSet};
use aletheia_core::{
    AceDecode, AceEncode, AceReader, AceWriter, AletheiaError, AssetId, ErrorCode, Hash32,
};
use aletheia_state::{Namespace, StateKey, StateOverlay, StateView};

use crate::model::Records;

/// A route and what it has done.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RouteState {
    pub route: BridgeRoute,
    pub paused: bool,
    /// The governance epoch a guardian pause ends (`u64::MAX`: until resumed).
    pub paused_until_epoch: u64,
    /// Pauses so far; part of the pause and resume digests.
    pub pauses: u64,
    /// Last outbound sequence used.
    pub out_sequence: u64,
    /// Last inbound sequence consumed.
    pub in_sequence: u64,
    /// The governance epoch `epoch_flow` counts.
    pub flow_epoch: u64,
    pub epoch_flow: u128,
    /// AEY this route holds in escrow (I10).
    pub escrowed: u128,
    /// Bridged assets this route has minted and not seen burned (exposure for I12).
    pub minted: u128,
}

impl AceEncode for RouteState {
    fn encode(&self, out: &mut AceWriter) {
        self.route.encode(out);
        out.bool(self.paused);
        out.u64(self.paused_until_epoch);
        out.u64(self.pauses);
        out.u64(self.out_sequence);
        out.u64(self.in_sequence);
        out.u64(self.flow_epoch);
        out.u128(self.epoch_flow);
        out.u128(self.escrowed);
        out.u128(self.minted);
    }
}

impl AceDecode for RouteState {
    fn decode(input: &mut AceReader<'_>) -> Result<RouteState, AletheiaError> {
        Ok(RouteState {
            route: BridgeRoute::decode(input)?,
            paused: input.bool()?,
            paused_until_epoch: input.u64()?,
            pauses: input.u64()?,
            out_sequence: input.u64()?,
            in_sequence: input.u64()?,
            flow_epoch: input.u64()?,
            epoch_flow: input.u128()?,
            escrowed: input.u128()?,
            minted: input.u128()?,
        })
    }
}

impl RouteState {
    /// Paused now: a governance pause, or a guardian pause that has not expired.
    pub fn is_paused(&self, epoch: u64) -> bool {
        self.paused && epoch < self.paused_until_epoch
    }
}

/// A large inbound transfer waiting for its delay, or held by a flag.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PendingInbound {
    pub message: BridgeMessage,
    pub ready_epoch: u64,
    pub flagged: bool,
}

impl AceEncode for PendingInbound {
    fn encode(&self, out: &mut AceWriter) {
        self.message.encode(out);
        out.u64(self.ready_epoch);
        out.bool(self.flagged);
    }
}

impl AceDecode for PendingInbound {
    fn decode(input: &mut AceReader<'_>) -> Result<PendingInbound, AletheiaError> {
        Ok(PendingInbound {
            message: BridgeMessage::decode(input)?,
            ready_epoch: input.u64()?,
            flagged: input.bool()?,
        })
    }
}

/// Verified remote locks and releases of one bridged asset, across routes (I11).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct Flows {
    pub locks: u128,
    pub releases: u128,
}

impl AceEncode for Flows {
    fn encode(&self, out: &mut AceWriter) {
        out.u128(self.locks);
        out.u128(self.releases);
    }
}

impl AceDecode for Flows {
    fn decode(input: &mut AceReader<'_>) -> Result<Flows, AletheiaError> {
        Ok(Flows {
            locks: input.u128()?,
            releases: input.u128()?,
        })
    }
}

/// Bridged assets at most (the list is read every block for I11).
pub const MAX_BRIDGED_ASSETS: u32 = 64;
/// Routes at most (every route is read every block for I10 and I12).
pub const MAX_ROUTES: u32 = 64;

#[derive(Debug, Clone, Copy)]
pub struct Bridge<'a> {
    pub records: &'a Records,
}

impl Bridge<'_> {
    fn key(&self, namespace: Namespace, parts: &[&[u8]]) -> StateKey {
        StateKey::derive_raw(self.records.network(), namespace, &parts.concat())
    }

    fn get<T: AceDecode>(
        &self,
        view: &dyn StateView,
        key: &StateKey,
        what: &str,
    ) -> Result<Option<T>, AletheiaError> {
        view.get(key)?
            .map(|bytes| {
                T::from_ace_bytes(&bytes).map_err(|e| {
                    AletheiaError::new(
                        ErrorCode::StoCorrupt,
                        format!("stored {what} does not decode: {}", e.detail()),
                    )
                })
            })
            .transpose()
    }

    pub fn route_key(&self, route: u32) -> StateKey {
        self.key(Namespace::BridgeRoutes, &[&[0], &route.to_le_bytes()])
    }
    pub fn route(
        &self,
        view: &dyn StateView,
        route: u32,
    ) -> Result<Option<RouteState>, AletheiaError> {
        self.get(view, &self.route_key(route), "bridge route")
    }
    pub fn put_route(&self, overlay: &mut StateOverlay<'_>, state: &RouteState) {
        overlay.put(self.route_key(state.route.route_id), state.to_ace_bytes());
    }

    pub fn guardians_key(&self, set: u32) -> StateKey {
        self.key(Namespace::BridgeRoutes, &[&[1], &set.to_le_bytes()])
    }
    pub fn guardians(
        &self,
        view: &dyn StateView,
        set: u32,
    ) -> Result<Option<GuardianSet>, AletheiaError> {
        self.get(view, &self.guardians_key(set), "guardian set")
    }

    pub fn escrow_total_key(&self) -> StateKey {
        self.key(Namespace::BridgeRoutes, &[&[2]])
    }
    pub fn escrow_total(&self, view: &dyn StateView) -> Result<u128, AletheiaError> {
        Ok(self
            .get(view, &self.escrow_total_key(), "bridge escrow total")?
            .unwrap_or(0))
    }

    pub fn outbound_key(&self, id: &Hash32) -> StateKey {
        self.key(Namespace::BridgeMessages, &[&[0], id.as_bytes()])
    }
    pub fn outbound(
        &self,
        view: &dyn StateView,
        id: &Hash32,
    ) -> Result<Option<BridgeMessage>, AletheiaError> {
        self.get(view, &self.outbound_key(id), "outbound bridge message")
    }

    pub fn consumed_key(&self, route: u32, sequence: u64) -> StateKey {
        self.key(
            Namespace::BridgeMessages,
            &[&[1], &route.to_le_bytes(), &sequence.to_le_bytes()],
        )
    }
    pub fn consumed(
        &self,
        view: &dyn StateView,
        route: u32,
        sequence: u64,
    ) -> Result<Option<Hash32>, AletheiaError> {
        self.get(
            view,
            &self.consumed_key(route, sequence),
            "consumed bridge message",
        )
    }

    pub fn pending_key(&self, id: &Hash32) -> StateKey {
        self.key(Namespace::BridgeMessages, &[&[2], id.as_bytes()])
    }
    pub fn pending(
        &self,
        view: &dyn StateView,
        id: &Hash32,
    ) -> Result<Option<PendingInbound>, AletheiaError> {
        self.get(view, &self.pending_key(id), "pending bridge message")
    }

    pub fn flows_key(&self, asset: AssetId) -> StateKey {
        self.key(Namespace::BridgedAssets, &[&[0], &asset.to_ace_bytes()])
    }
    pub fn flows(&self, view: &dyn StateView, asset: AssetId) -> Result<Flows, AletheiaError> {
        Ok(self
            .get(view, &self.flows_key(asset), "bridged asset flows")?
            .unwrap_or_default())
    }

    pub fn bridged_list_key(&self) -> StateKey {
        self.key(Namespace::BridgedAssets, &[&[1]])
    }
    pub fn bridged_assets(&self, view: &dyn StateView) -> Result<Vec<AssetId>, AletheiaError> {
        match view.get(&self.bridged_list_key())? {
            None => Ok(Vec::new()),
            Some(bytes) => {
                let mut input = AceReader::new(&bytes);
                let list = input.list(MAX_BRIDGED_ASSETS)?;
                input.finish()?;
                Ok(list)
            }
        }
    }
    pub fn put_bridged_assets(&self, overlay: &mut StateOverlay<'_>, assets: &[AssetId]) {
        let mut out = AceWriter::new();
        out.list(assets);
        overlay.put(self.bridged_list_key(), out.as_bytes().to_vec());
    }

    pub fn route_list_key(&self) -> StateKey {
        self.key(Namespace::BridgeRoutes, &[&[3]])
    }
    pub fn route_ids(&self, view: &dyn StateView) -> Result<Vec<u32>, AletheiaError> {
        match view.get(&self.route_list_key())? {
            None => Ok(Vec::new()),
            Some(bytes) => {
                let mut input = AceReader::new(&bytes);
                let list = input.list(MAX_ROUTES)?;
                input.finish()?;
                Ok(list)
            }
        }
    }
    pub fn put_route_ids(&self, overlay: &mut StateOverlay<'_>, routes: &[u32]) {
        let mut out = AceWriter::new();
        out.list(routes);
        overlay.put(self.route_list_key(), out.as_bytes().to_vec());
    }
}
