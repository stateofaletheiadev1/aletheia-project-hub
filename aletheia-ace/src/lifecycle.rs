//! The node lifecycle as ACE tracks it. Every change goes through [`Lifecycle::advance`],
//! which refuses transitions the table does not allow, so a status report can never claim a
//! state the engine did not reach by a legitimate path (READY only after an application-level
//! RPC check, never straight from STARTING_NODE).

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum State {
    Uninitialized,
    Preflight,
    FetchingSource,
    Building,
    BuildVerification,
    RestoringState,
    StartingNode,
    WaitingForRpc,
    Syncing,
    Ready,
    Degraded,
    Stopping,
    Stopped,
    Recovering,
    Failed,
    /// Running, with every check passed, on storage that does not outlive the host. Reported
    /// instead of READY so nobody mistakes the deployment for a durable one.
    EphemeralMode,
}

impl State {
    pub fn name(self) -> &'static str {
        match self {
            State::Uninitialized => "UNINITIALIZED",
            State::Preflight => "PREFLIGHT",
            State::FetchingSource => "FETCHING_SOURCE",
            State::Building => "BUILDING",
            State::BuildVerification => "BUILD_VERIFICATION",
            State::RestoringState => "RESTORING_STATE",
            State::StartingNode => "STARTING_NODE",
            State::WaitingForRpc => "WAITING_FOR_RPC",
            State::Syncing => "SYNCING",
            State::Ready => "READY",
            State::Degraded => "DEGRADED",
            State::Stopping => "STOPPING",
            State::Stopped => "STOPPED",
            State::Recovering => "RECOVERING",
            State::Failed => "FAILED",
            State::EphemeralMode => "EPHEMERAL_MODE",
        }
    }

    /// Whether the node is serving with every check passed.
    pub fn is_serving(self) -> bool {
        matches!(self, State::Ready | State::EphemeralMode)
    }
}

/// The allowed transitions. Any state may go to FAILED; STOPPING is reachable from every
/// state in which a node process may exist.
pub fn allowed(from: State, to: State) -> bool {
    use State::*;
    if to == Failed {
        return from != Failed;
    }
    match from {
        Uninitialized => matches!(to, Preflight),
        Preflight => matches!(
            to,
            FetchingSource | Building | RestoringState | StartingNode
        ),
        FetchingSource => matches!(to, Building),
        Building => matches!(to, BuildVerification),
        BuildVerification => matches!(to, RestoringState | StartingNode | Stopped),
        RestoringState => matches!(to, StartingNode | Stopped),
        StartingNode => matches!(to, WaitingForRpc | Syncing | Stopping | Recovering),
        // With RPC disabled there is no application-level check, so the node can never be
        // READY: it stays in WAITING_FOR_RPC (reported as such) or degrades.
        WaitingForRpc => matches!(
            to,
            Syncing | Ready | EphemeralMode | Degraded | Stopping | Recovering
        ),
        Syncing => matches!(to, Ready | EphemeralMode | Degraded | Stopping | Recovering),
        Ready | EphemeralMode => matches!(to, Degraded | Syncing | Stopping | Recovering),
        Degraded => matches!(to, Ready | EphemeralMode | Syncing | Stopping | Recovering),
        Recovering => matches!(to, StartingNode | Stopped),
        Stopping => matches!(to, Stopped),
        Stopped => matches!(to, Preflight | StartingNode),
        Failed => matches!(to, Preflight),
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Lifecycle {
    state: State,
    history: Vec<(State, State)>,
}

impl Default for Lifecycle {
    fn default() -> Lifecycle {
        Lifecycle {
            state: State::Uninitialized,
            history: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
#[error("lifecycle transition {} -> {} is not allowed", from.name(), to.name())]
pub struct BadTransition {
    pub from: State,
    pub to: State,
}

impl Lifecycle {
    pub fn starting_at(state: State) -> Lifecycle {
        Lifecycle {
            state,
            history: Vec::new(),
        }
    }

    pub fn state(&self) -> State {
        self.state
    }

    pub fn advance(&mut self, to: State) -> Result<(), BadTransition> {
        if self.state == to {
            return Ok(());
        }
        if !allowed(self.state, to) {
            return Err(BadTransition {
                from: self.state,
                to,
            });
        }
        // Bounded: a long-running supervisor must not grow this without limit.
        if self.history.len() >= 256 {
            self.history.remove(0);
        }
        self.history.push((self.state, to));
        self.state = to;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use State::*;

    #[test]
    fn the_normal_path_is_allowed() {
        let mut l = Lifecycle::default();
        for to in [
            Preflight,
            FetchingSource,
            Building,
            BuildVerification,
            StartingNode,
            WaitingForRpc,
            Syncing,
            Ready,
            Stopping,
            Stopped,
        ] {
            l.advance(to).unwrap();
        }
    }

    #[test]
    fn ready_is_unreachable_without_an_rpc_check() {
        assert!(!allowed(StartingNode, Ready));
        assert!(!allowed(StartingNode, EphemeralMode));
        assert!(!allowed(BuildVerification, Ready));
        assert!(!allowed(Preflight, Ready));
    }

    #[test]
    fn failed_needs_a_new_preflight() {
        assert!(!allowed(Failed, StartingNode));
        assert!(allowed(Failed, Preflight));
        assert!(!allowed(Failed, Failed));
    }

    #[test]
    fn recovery_restarts_through_starting_node() {
        let mut l = Lifecycle::starting_at(Ready);
        l.advance(Recovering).unwrap();
        assert!(l.advance(Ready).is_err());
        l.advance(StartingNode).unwrap();
    }

    #[test]
    fn every_state_can_fail() {
        let all = [
            Uninitialized,
            Preflight,
            FetchingSource,
            Building,
            BuildVerification,
            RestoringState,
            StartingNode,
            WaitingForRpc,
            Syncing,
            Ready,
            Degraded,
            Stopping,
            Stopped,
            Recovering,
            EphemeralMode,
        ];
        for s in all {
            assert!(allowed(s, Failed), "{s:?}");
        }
    }

    #[test]
    fn history_is_bounded() {
        let mut l = Lifecycle::starting_at(Ready);
        for _ in 0..400 {
            l.advance(Degraded).unwrap();
            l.advance(Ready).unwrap();
        }
        assert!(l.history.len() <= 256);
    }
}
