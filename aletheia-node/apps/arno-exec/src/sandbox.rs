//! The worker's kernel sandbox on Linux (spec Section 28.1), applied once at start-up, before
//! the first request is read.
//!
//! - Landlock: no filesystem access at all. The worker reads and writes only the pipes it was
//!   started with, which are already open.
//! - seccomp: system calls a contract worker never makes fail with `EPERM`: starting programs
//!   or processes, sockets, tracing other processes, namespaces, mounts, kernel modules,
//!   identity changes. A denylist that answers `EPERM`, not an allowlist that kills: a call the
//!   runtime makes that an allowlist forgot would crash the worker, and two crashes on one
//!   call are a fail-stop of the node. These calls are ones the worker has no reason to make,
//!   so refusing them changes nothing for a correct worker and stops a compromised one.
//!
//! `RLIMIT_AS` (in `main`) bounds its memory.

use std::collections::BTreeMap;

use landlock::{ABI, Access, AccessFs, Ruleset, RulesetAttr, RulesetStatus};
use seccompiler::{BpfProgram, SeccompAction, SeccompFilter, SeccompRule, TargetArch};

/// How much of the sandbox the kernel enforces.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct Applied {
    /// Landlock is enforced in full. Kernels before 5.13 (or with Landlock disabled) cannot;
    /// the worker still runs, with seccomp and its empty working directory.
    pub(crate) filesystem_denied: bool,
}

/// System calls refused with `EPERM`. Validators run 64-bit Linux (x86_64, aarch64), where a
/// syscall number is an `i64`.
const DENIED: &[libc::c_long] = &[
    // New programs and processes.
    libc::SYS_execve,
    libc::SYS_execveat,
    libc::SYS_fork,
    libc::SYS_vfork,
    // Networking.
    libc::SYS_socket,
    libc::SYS_socketpair,
    libc::SYS_connect,
    libc::SYS_bind,
    libc::SYS_listen,
    libc::SYS_accept,
    libc::SYS_accept4,
    libc::SYS_sendto,
    libc::SYS_sendmsg,
    libc::SYS_sendmmsg,
    libc::SYS_recvfrom,
    libc::SYS_recvmsg,
    libc::SYS_recvmmsg,
    // Other processes' memory and tracing.
    libc::SYS_ptrace,
    libc::SYS_process_vm_readv,
    libc::SYS_process_vm_writev,
    libc::SYS_pidfd_open,
    libc::SYS_pidfd_getfd,
    // Namespaces, mounts and the root.
    libc::SYS_unshare,
    libc::SYS_setns,
    libc::SYS_mount,
    libc::SYS_umount2,
    libc::SYS_pivot_root,
    libc::SYS_chroot,
    // The kernel itself.
    libc::SYS_init_module,
    libc::SYS_finit_module,
    libc::SYS_delete_module,
    libc::SYS_kexec_load,
    libc::SYS_reboot,
    libc::SYS_bpf,
    libc::SYS_perf_event_open,
    libc::SYS_keyctl,
    libc::SYS_add_key,
    libc::SYS_request_key,
    // Identity.
    libc::SYS_setuid,
    libc::SYS_setgid,
    libc::SYS_setreuid,
    libc::SYS_setregid,
    libc::SYS_setresuid,
    libc::SYS_setresgid,
    libc::SYS_setgroups,
];

/// Applies Landlock (best effort, reported) and seccomp (required: an error means the worker
/// must not run).
pub(crate) fn apply() -> Result<Applied, String> {
    let filesystem_denied = Ruleset::default()
        .handle_access(AccessFs::from_all(ABI::V3))
        .and_then(|ruleset| ruleset.create())
        .and_then(|ruleset| ruleset.restrict_self())
        .is_ok_and(|status| status.ruleset == RulesetStatus::FullyEnforced);

    let rules: BTreeMap<i64, Vec<SeccompRule>> =
        DENIED.iter().map(|call| (*call, Vec::new())).collect();
    let arch = TargetArch::try_from(std::env::consts::ARCH)
        .map_err(|e| format!("seccomp: unsupported architecture: {e}"))?;
    let filter = SeccompFilter::new(
        rules,
        SeccompAction::Allow,
        SeccompAction::Errno(u32::try_from(libc::EPERM).unwrap_or(1)),
        arch,
    )
    .map_err(|e| format!("seccomp filter: {e}"))?;
    let program: BpfProgram = filter
        .try_into()
        .map_err(|e: seccompiler::BackendError| format!("seccomp program: {e}"))?;
    seccompiler::apply_filter(&program).map_err(|e| format!("seccomp: {e}"))?;
    Ok(Applied { filesystem_denied })
}
