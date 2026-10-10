//! Configuration from the environment (systemd reads it from config/aletheiadb.env).

use std::net::SocketAddr;
use std::path::PathBuf;

#[derive(Debug, Clone)]
pub struct Config {
    /// Where to listen. Production: 127.0.0.1:7790, behind nginx (TLS, rate limits).
    pub listen: SocketAddr,
    /// Directory holding `aletheia.redb`.
    pub data_dir: PathBuf,
    /// SHA-256 hex of the root key's secret; unset disables the root key.
    pub root_secret_sha256: Option<String>,
    /// Page cache size. The production service is capped at 250 MB in total.
    pub cache_bytes: usize,
}

impl Config {
    pub fn from_env() -> Result<Config, String> {
        let get = |k: &str| std::env::var(k).ok().map(|v| v.trim().to_string()).filter(|v| !v.is_empty());
        let listen = get("ALETHEIADB_LISTEN").unwrap_or_else(|| "127.0.0.1:7790".into());
        let listen: SocketAddr = listen.parse().map_err(|_| format!("ALETHEIADB_LISTEN '{listen}' is not an address:port"))?;
        let data_dir = PathBuf::from(get("ALETHEIADB_DATA_DIR").unwrap_or_else(|| "./data".into()));
        let root_secret_sha256 = match get("ALETHEIADB_ROOT_KEY_SHA256") {
            None => None,
            Some(h) if h.len() == 64 && h.bytes().all(|b| b.is_ascii_hexdigit()) => Some(h.to_ascii_lowercase()),
            Some(_) => return Err("ALETHEIADB_ROOT_KEY_SHA256 must be 64 hex characters (run `aletheiadb keygen`)".into()),
        };
        let cache_mb: usize = get("ALETHEIADB_CACHE_MB")
            .map(|v| v.parse().map_err(|_| "ALETHEIADB_CACHE_MB must be a number".to_string()))
            .transpose()?
            .unwrap_or(64);
        if !(8..=4096).contains(&cache_mb) {
            return Err("ALETHEIADB_CACHE_MB must be between 8 and 4096".into());
        }
        Ok(Config {
            listen,
            data_dir,
            root_secret_sha256,
            cache_bytes: cache_mb * 1024 * 1024,
        })
    }
}
