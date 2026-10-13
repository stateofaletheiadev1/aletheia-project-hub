//! `aletheia-arno-exec`: a contract executor worker (spec Section 28.1).
//!
//! It speaks the executor protocol on stdin and stdout and does nothing else: no files, no
//! network, no environment, no clock. The node starts it with an empty environment and an
//! empty working directory, supervises it with a watchdog, and treats everything it says as
//! untrusted.
//!
//! On Linux it sandboxes itself before reading its first request (`sandbox.rs`): no
//! filesystem, no new processes, no sockets, a bounded address space.
//!
//! Debug builds, and builds with the `fault-injection` feature (test builds only), accept
//! `--fault <crash-first MARKER | hang | garbage | probe-sandbox>` so the supervisor's recovery
//! and the sandbox can be tested; production builds ignore every argument.

#[cfg(target_os = "linux")]
mod sandbox;

use std::io::Write;
use std::process::ExitCode;

fn fault() -> Option<(String, Option<String>)> {
    if !cfg!(any(debug_assertions, feature = "fault-injection")) {
        return None;
    }
    let args: Vec<String> = std::env::args().skip(1).collect();
    match args.as_slice() {
        [flag, kind] if flag == "--fault" => Some((kind.clone(), None)),
        [flag, kind, marker] if flag == "--fault" => Some((kind.clone(), Some(marker.clone()))),
        _ => None,
    }
}

/// The worker's address-space ceiling. A call may use 4 MiB and a transaction 32 MiB of
/// metered memory (Section 28), with at most 16 frames; the interpreter itself needs little
/// more. A worker that somehow grows past this fails its allocation and exits, which the node
/// treats as a worker failure, instead of drawing on the host's memory (or swap) until the
/// kernel steps in.
#[cfg(unix)]
const ADDRESS_SPACE_BYTES: u64 = 1024 * 1024 * 1024;

fn main() -> ExitCode {
    #[cfg(unix)]
    if rlimit::setrlimit(
        rlimit::Resource::AS,
        ADDRESS_SPACE_BYTES,
        ADDRESS_SPACE_BYTES,
    )
    .is_err()
    {
        // Refusing to run unbounded is safer than running: the node retries in a fresh
        // worker and fail-stops if that cannot start either.
        return ExitCode::from(2);
    }
    let mut stdin = std::io::stdin().lock();
    let mut stdout = std::io::stdout().lock();
    match fault() {
        Some((kind, Some(marker))) if kind == "crash-first" => {
            if !std::path::Path::new(&marker).exists() {
                let _ = std::fs::write(&marker, b"crashed once");
                return ExitCode::from(101);
            }
        }
        _ => {}
    }
    // Everything above may touch the filesystem (the fault marker); nothing below may.
    #[cfg(target_os = "linux")]
    let applied = match sandbox::apply() {
        Ok(applied) => applied,
        // Refusing to run unconfined is safer than running: the node retries in a fresh
        // worker and fail-stops if that cannot start either.
        Err(_) => return ExitCode::from(2),
    };
    match fault() {
        #[cfg(target_os = "linux")]
        Some((kind, _)) if kind == "probe-sandbox" => return probe(applied),
        Some((kind, _)) if kind == "hang" => loop {
            std::thread::park();
        },
        Some((kind, _)) if kind == "garbage" => {
            let _ = stdout.write_all(&[3, 0, 0, 0, 0xEE, 0xEE, 0xEE]);
            let _ = stdout.flush();
            std::thread::park();
            return ExitCode::from(1);
        }
        _ => {}
    }
    match aletheia_vm::worker::serve(&mut stdin, &mut stdout) {
        Ok(()) => ExitCode::SUCCESS,
        Err(_) => ExitCode::from(1),
    }
}

/// Test builds only (`--fault probe-sandbox`): tries what the sandbox forbids and reports what
/// got through as exit-status bits: 1 a file was read, 2 a socket was made, 4 a process was
/// started, 8 the kernel does not enforce the filesystem rule (bit 1 is then expected).
#[cfg(target_os = "linux")]
fn probe(applied: sandbox::Applied) -> ExitCode {
    let mut escaped = 0u8;
    let exe = std::env::current_exe().unwrap_or_default();
    if std::fs::read(&exe).is_ok() || std::fs::read("/proc/self/status").is_ok() {
        escaped |= 1;
    }
    if std::net::TcpStream::connect("127.0.0.1:9").is_ok()
        || std::net::UdpSocket::bind("127.0.0.1:0").is_ok()
    {
        escaped |= 2;
    }
    if std::process::Command::new(&exe)
        .arg("--help")
        .spawn()
        .is_ok()
    {
        escaped |= 4;
    }
    if !applied.filesystem_denied {
        escaped |= 8;
    }
    ExitCode::from(escaped)
}
