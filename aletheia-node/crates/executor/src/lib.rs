//! The sandboxed contract runner (spec Section 28.1): contracts run in `aletheia-arno-exec`
//! worker processes; the node answers their host calls against the block's overlay, so state
//! authority stays in the node.
//!
//! - Workers start with an empty environment and an empty working directory, and only their
//!   pipes. A pool keeps idle workers warm.
//! - A per-call wall-clock watchdog kills a worker that does not finish, crashes, or says
//!   anything that does not decode or comes out of turn. EU metering is the protocol bound;
//!   the watchdog defends against interpreter bugs.
//! - After a worker failure the attempt's effects are undone and the call runs again in a
//!   fresh worker. A second failure on the same call is a critical bug: the call ends in
//!   `VM_INTERNAL`, a fail-stop, rather than produce a result other nodes might not.
//!
//! Not yet applied: OS-level syscall filtering of the worker (seccomp and landlock on
//! Linux). The worker contains no code that touches the OS beyond its pipes, and unsafe Rust
//! is forbidden across the workspace; the filter is tracked for the hardening phase.

use std::io::{BufReader, BufWriter};
use std::path::PathBuf;
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::Mutex;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc::{Receiver, RecvTimeoutError, channel};
use std::time::{Duration, Instant};

use aletheia_execution::runner::ContractRunner;
use aletheia_vm::wire::{Execute, HostReply, WorkerMessage, read_frame, write_frame};
use aletheia_vm::{Failure, Host, Outcome, Package, Trap, Value};

/// Numbers worker sandbox directories across all runners in the process.
static NEXT_SANDBOX: AtomicU64 = AtomicU64::new(0);

/// How the node starts workers.
#[derive(Debug, Clone)]
pub struct ExecutorConfig {
    pub program: PathBuf,
    /// Extra arguments (fault injection in tests; empty in production).
    pub args: Vec<String>,
    /// Wall-clock limit for one call.
    pub timeout: Duration,
    /// Idle workers kept ready.
    pub pool: usize,
}

struct Worker {
    child: Child,
    stdin: BufWriter<ChildStdin>,
    messages: Receiver<std::io::Result<Option<WorkerMessage>>>,
    sandbox: tempdir::Dir,
}

mod tempdir {
    /// An empty working directory for one worker, removed when the worker is dropped.
    #[derive(Debug)]
    pub(crate) struct Dir(pub(crate) std::path::PathBuf);

    impl Drop for Dir {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }
}

impl Drop for Worker {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
        let _ = &self.sandbox;
    }
}

/// Why a call could not be completed by a worker (never a contract result).
#[derive(Debug)]
struct WorkerFailed(&'static str);

#[derive(Debug)]
pub struct ProcessRunner {
    config: ExecutorConfig,
    idle: Mutex<Vec<Worker>>,
    spawned: Mutex<u64>,
}

impl core::fmt::Debug for Worker {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        f.debug_struct("Worker")
            .field("pid", &self.child.id())
            .finish_non_exhaustive()
    }
}

impl ProcessRunner {
    pub fn new(config: ExecutorConfig) -> ProcessRunner {
        ProcessRunner {
            config,
            idle: Mutex::new(Vec::new()),
            spawned: Mutex::new(0),
        }
    }

    /// Workers started so far (for tests and metrics).
    pub fn spawned(&self) -> u64 {
        self.spawned.lock().map_or(0, |n| *n)
    }

    fn spawn(&self) -> Result<Worker, WorkerFailed> {
        {
            let mut spawned = self
                .spawned
                .lock()
                .map_err(|_| WorkerFailed("lock poisoned"))?;
            *spawned = spawned.saturating_add(1);
        }
        // The directory name must be unique across every runner in this process, not just this
        // one: two runners counting from 1 would share a directory, and the first worker to be
        // dropped would delete it under the other, failing its spawn.
        let dir = std::env::temp_dir().join(format!(
            "aletheia-arno-exec-{}-{}",
            std::process::id(),
            NEXT_SANDBOX.fetch_add(1, Ordering::Relaxed)
        ));
        std::fs::create_dir_all(&dir)
            .map_err(|_| WorkerFailed("cannot create the worker directory"))?;
        let mut child = Command::new(&self.config.program)
            .args(&self.config.args)
            .env_clear()
            .current_dir(&dir)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|_| WorkerFailed("cannot start the executor"))?;
        let stdin = child.stdin.take().ok_or(WorkerFailed("no worker stdin"))?;
        let stdout = child
            .stdout
            .take()
            .ok_or(WorkerFailed("no worker stdout"))?;
        let (sender, messages) = channel();
        std::thread::Builder::new()
            .name("arno-exec-reader".to_owned())
            .spawn(move || {
                let mut reader = BufReader::new(stdout);
                loop {
                    let message = read_frame::<_, WorkerMessage>(&mut reader);
                    let end = !matches!(message, Ok(Some(_)));
                    if sender.send(message).is_err() || end {
                        return;
                    }
                }
            })
            .map_err(|_| WorkerFailed("cannot start the reader thread"))?;
        Ok(Worker {
            child,
            stdin: BufWriter::new(stdin),
            messages,
            sandbox: tempdir::Dir(dir),
        })
    }

    fn checkout(&self) -> Result<Worker, WorkerFailed> {
        let idle = self.idle.lock().ok().and_then(|mut idle| idle.pop());
        match idle {
            Some(worker) => Ok(worker),
            None => self.spawn(),
        }
    }

    fn checkin(&self, worker: Worker) {
        if let Ok(mut idle) = self.idle.lock()
            && idle.len() < self.config.pool
        {
            idle.push(worker);
        }
    }

    /// One attempt in one worker. Any protocol violation is a worker failure.
    fn attempt(
        &self,
        worker: &mut Worker,
        request: &Execute,
        host: &mut dyn Host,
    ) -> Result<Result<Outcome, Failure>, WorkerFailed> {
        let now = Instant::now();
        let deadline = now.checked_add(self.config.timeout).unwrap_or(now);
        write_frame(&mut worker.stdin, request)
            .map_err(|_| WorkerFailed("cannot send the call"))?;
        loop {
            let left = deadline.saturating_duration_since(Instant::now());
            let message = match worker.messages.recv_timeout(left) {
                Ok(Ok(Some(message))) => message,
                Ok(Ok(None)) | Ok(Err(_)) | Err(RecvTimeoutError::Disconnected) => {
                    return Err(WorkerFailed("the worker died or sent an undecodable frame"));
                }
                Err(RecvTimeoutError::Timeout) => return Err(WorkerFailed("the worker timed out")),
            };
            let reply = match message {
                WorkerMessage::Done(Ok((returned, eu_used))) => {
                    if eu_used > request.eu_limit {
                        return Err(WorkerFailed("the worker reported more EU than allowed"));
                    }
                    return Ok(Ok(Outcome { returned, eu_used }));
                }
                WorkerMessage::Done(Err((trap, eu_used))) => {
                    if eu_used > request.eu_limit || matches!(trap, Trap::Internal(_)) {
                        return Err(WorkerFailed("the worker failed internally"));
                    }
                    return Ok(Err(Failure { trap, eu_used }));
                }
                WorkerMessage::Contains { slot, key } => match host.storage_contains(slot, &key) {
                    Ok(v) => HostReply::Bool(v),
                    Err(trap) => HostReply::Refused(trap),
                },
                WorkerMessage::Read { slot, key } => match host.storage_read(slot, &key) {
                    Ok(v) => HostReply::Bytes(v),
                    Err(trap) => HostReply::Refused(trap),
                },
                WorkerMessage::Write { slot, key, value } => {
                    match host.storage_write(slot, &key, value.as_deref()) {
                        Ok(()) => HostReply::Unit,
                        Err(trap) => HostReply::Refused(trap),
                    }
                }
                WorkerMessage::Transfer { asset, amount, to } => {
                    match host.transfer(asset, amount, &to) {
                        Ok(()) => HostReply::Unit,
                        Err(trap) => HostReply::Refused(trap),
                    }
                }
                WorkerMessage::Emit { event, data } => match host.emit(event, data) {
                    Ok(()) => HostReply::Unit,
                    Err(trap) => HostReply::Refused(trap),
                },
            };
            write_frame(&mut worker.stdin, &reply)
                .map_err(|_| WorkerFailed("cannot answer the worker"))?;
        }
    }
}

impl ContractRunner for ProcessRunner {
    fn run(
        &self,
        _package: &Package,
        package_bytes: &[u8],
        function: u8,
        args: Vec<Value>,
        host: &mut dyn Host,
        eu_limit: u64,
    ) -> Result<Outcome, Failure> {
        let request = Execute {
            package: package_bytes.to_vec(),
            function,
            args,
            eu_limit,
            chain: host.chain(),
        };
        let mut reason = "the contract executor failed twice on the same call";
        for _ in 0..2 {
            host.begin_attempt();
            let result = self.checkout().and_then(|mut worker| {
                let result = self.attempt(&mut worker, &request, host);
                if result.is_ok() {
                    self.checkin(worker);
                }
                result
            });
            match result {
                Ok(result) => {
                    host.commit_attempt();
                    return result;
                }
                Err(WorkerFailed(why)) => {
                    host.abandon_attempt();
                    reason = why;
                }
            }
        }
        // Twice on the same call: a critical bug. VM_INTERNAL is a fail-stop.
        Err(Failure {
            trap: Trap::Internal(reason),
            eu_used: 0,
        })
    }
}
