//! Who runs contract code (spec Section 28.1).
//!
//! Execution asks a [`ContractRunner`]; it never cares where the interpreter runs. The default
//! runs it in this process. A node installs the sandboxed runner (worker processes) once at
//! start-up. Both must give identical results: the interpreter is deterministic and every
//! host interaction goes back to the same overlay.

use std::sync::OnceLock;

use aletheia_vm::{Failure, Host, Outcome, Package, Value};

pub trait ContractRunner: Send + Sync {
    /// Runs `function` of a verified package. `package_bytes` are the package's encoding,
    /// for runners that hand it to another process.
    fn run(
        &self,
        package: &Package,
        package_bytes: &[u8],
        function: u8,
        args: Vec<Value>,
        host: &mut dyn Host,
        eu_limit: u64,
    ) -> Result<Outcome, Failure>;
}

/// The interpreter in this process.
#[derive(Debug, Clone, Copy, Default)]
pub struct InProcess;

impl ContractRunner for InProcess {
    fn run(
        &self,
        package: &Package,
        _package_bytes: &[u8],
        function: u8,
        args: Vec<Value>,
        host: &mut dyn Host,
        eu_limit: u64,
    ) -> Result<Outcome, Failure> {
        host.begin_attempt();
        let result = aletheia_vm::run(package, function, args, host, eu_limit);
        host.commit_attempt();
        result
    }
}

static RUNNER: OnceLock<Box<dyn ContractRunner>> = OnceLock::new();

/// Installs the runner for this process. Only the first call takes effect; returns whether
/// this one did.
pub fn install(runner: Box<dyn ContractRunner>) -> bool {
    RUNNER.set(runner).is_ok()
}

pub(crate) fn current() -> &'static dyn ContractRunner {
    match RUNNER.get() {
        Some(runner) => runner.as_ref(),
        None => &InProcess,
    }
}
