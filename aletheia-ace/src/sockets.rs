//! Which TCP sockets a process is listening on, from `/proc/net/tcp{,6}` and the process's
//! file descriptors. Used to prove that the node itself (not some other program) holds the
//! address its configuration names. Linux only; elsewhere the check reports "unsupported"
//! and the protocol-level probe stands alone.

use std::collections::BTreeSet;
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr};

const TCP_LISTEN: &str = "0A";

/// A listening socket and the kernel inode that identifies it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Listener {
    pub address: SocketAddr,
    pub inode: u64,
}

fn parse_v4(hex: &str) -> Option<Ipv4Addr> {
    let raw = u32::from_str_radix(hex, 16).ok()?;
    // The kernel prints the address in host byte order (little-endian on x86 and arm64).
    Some(Ipv4Addr::from(raw.swap_bytes()))
}

fn parse_v6(hex: &str) -> Option<Ipv6Addr> {
    if hex.len() != 32 {
        return None;
    }
    let mut bytes = [0u8; 16];
    // Four 32-bit words, each in host byte order.
    for word in 0..4 {
        let chunk = hex.get(word * 8..word * 8 + 8)?;
        let value = u32::from_str_radix(chunk, 16).ok()?.swap_bytes();
        bytes
            .get_mut(word * 4..word * 4 + 4)?
            .copy_from_slice(&value.to_be_bytes());
    }
    Some(Ipv6Addr::from(bytes))
}

/// Parses `/proc/net/tcp` or `/proc/net/tcp6` and returns the sockets in LISTEN state.
pub fn parse_proc_net_tcp(text: &str, v6: bool) -> Vec<Listener> {
    let mut out = Vec::new();
    for line in text.lines().skip(1) {
        let fields: Vec<&str> = line.split_whitespace().collect();
        let (Some(local), Some(state), Some(inode)) = (fields.get(1), fields.get(3), fields.get(9))
        else {
            continue;
        };
        if *state != TCP_LISTEN {
            continue;
        }
        let Some((ip_hex, port_hex)) = local.split_once(':') else {
            continue;
        };
        let Ok(port) = u16::from_str_radix(port_hex, 16) else {
            continue;
        };
        let ip = if v6 {
            parse_v6(ip_hex).map(IpAddr::V6)
        } else {
            parse_v4(ip_hex).map(IpAddr::V4)
        };
        let (Some(ip), Ok(inode)) = (ip, inode.parse::<u64>()) else {
            continue;
        };
        out.push(Listener {
            address: SocketAddr::new(ip, port),
            inode,
        });
    }
    out
}

/// Every listening TCP socket on the host.
pub fn listeners() -> Option<Vec<Listener>> {
    let v4 = std::fs::read_to_string("/proc/net/tcp").ok()?;
    let mut all = parse_proc_net_tcp(&v4, false);
    if let Ok(v6) = std::fs::read_to_string("/proc/net/tcp6") {
        all.extend(parse_proc_net_tcp(&v6, true));
    }
    Some(all)
}

/// The socket inodes a process holds open.
pub fn socket_inodes(pid: u32) -> Option<BTreeSet<u64>> {
    let dir = std::fs::read_dir(format!("/proc/{pid}/fd")).ok()?;
    let mut out = BTreeSet::new();
    for entry in dir.flatten() {
        if let Ok(target) = std::fs::read_link(entry.path()) {
            let text = target.to_string_lossy();
            if let Some(inode) = text
                .strip_prefix("socket:[")
                .and_then(|t| t.strip_suffix(']'))
                .and_then(|t| t.parse().ok())
            {
                out.insert(inode);
            }
        }
    }
    Some(out)
}

/// Who holds a listening address, as far as the host shows.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum Holder {
    /// The given process listens on it.
    Process,
    /// Something listens on it, but not the given process.
    Other,
    /// Nothing listens on it.
    Nobody,
    /// The host does not expose socket tables (not Linux, or /proc unreadable).
    Unsupported,
}

/// Whether `pid` listens on `address`. A wildcard bind (0.0.0.0 or ::) counts for every
/// address with the same port.
pub fn holder(pid: Option<u32>, address: SocketAddr) -> Holder {
    let Some(all) = listeners() else {
        return Holder::Unsupported;
    };
    let matching: Vec<&Listener> = all
        .iter()
        .filter(|l| {
            l.address.port() == address.port()
                && (l.address.ip() == address.ip() || l.address.ip().is_unspecified())
        })
        .collect();
    if matching.is_empty() {
        return Holder::Nobody;
    }
    let Some(pid) = pid else {
        return Holder::Other;
    };
    match socket_inodes(pid) {
        Some(inodes) if matching.iter().any(|l| inodes.contains(&l.inode)) => Holder::Process,
        Some(_) => Holder::Other,
        None => Holder::Unsupported,
    }
}

/// The listening addresses a process holds.
pub fn listening_addresses(pid: u32) -> Option<Vec<SocketAddr>> {
    let all = listeners()?;
    let inodes = socket_inodes(pid)?;
    Some(
        all.into_iter()
            .filter(|l| inodes.contains(&l.inode))
            .map(|l| l.address)
            .collect(),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    const TCP: &str = "  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode\n   0: 0100007F:6CA5 00000000:0000 0A 00000000:00000000 00:00000000 00000000     0        0 3133 1 0000000000000000 100 0 0 10 0\n   1: 00000000:07E8 00000000:0000 0A 00000000:00000000 00:00000000 00000000     0        0 2926 1 0000000000000000 100 0 0 10 0\n   2: 0100007F:6CA5 0100007F:A000 01 00000000:00000000 00:00000000 00000000     0        0 4000 1 0000000000000000 100 0 0 10 0\n";

    #[test]
    fn listening_sockets_are_parsed_and_others_skipped() {
        let l = parse_proc_net_tcp(TCP, false);
        assert_eq!(l.len(), 2);
        assert_eq!(l[0].address, "127.0.0.1:27813".parse().unwrap());
        assert_eq!(l[0].inode, 3133);
        assert_eq!(l[1].address, "0.0.0.0:2024".parse().unwrap());
    }

    #[test]
    fn ipv6_loopback_is_decoded() {
        let line = "  sl  local_address remote st\n   0: 00000000000000000000000001000000:1E61 00000000000000000000000000000000:0000 0A 00000000:00000000 00:00000000 00000000     0        0 77 1\n";
        let l = parse_proc_net_tcp(line, true);
        assert_eq!(l[0].address, "[::1]:7777".parse().unwrap());
    }

    #[test]
    fn this_process_is_seen_listening() {
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        if listeners().is_none() {
            return; // not Linux
        }
        assert_eq!(holder(Some(std::process::id()), address), Holder::Process);
        drop(listener);
        assert_eq!(holder(Some(std::process::id()), address), Holder::Nobody);
    }
}
