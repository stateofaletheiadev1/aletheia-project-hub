//! Operator log lines, one per event, on stderr: `ace <level> <category> <message>`.
//!
//! The category says which part of the lifecycle wrote the line, so a failed run can be read
//! by grepping one stage. Messages pass through [`redact`] before they are written: ACE never
//! prints a credential it was handed, even inside a child process's error text.

use std::io::Write;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Category {
    Preflight,
    Source,
    Build,
    Config,
    Snapshot,
    Startup,
    Rpc,
    Public,
    Persistence,
    Recovery,
    Health,
    Shutdown,
}

impl Category {
    pub fn name(self) -> &'static str {
        match self {
            Category::Preflight => "preflight",
            Category::Source => "source",
            Category::Build => "build",
            Category::Config => "config",
            Category::Snapshot => "snapshot",
            Category::Startup => "startup",
            Category::Rpc => "rpc",
            Category::Public => "public",
            Category::Persistence => "persistence",
            Category::Recovery => "recovery",
            Category::Health => "health",
            Category::Shutdown => "shutdown",
        }
    }
}

/// Environment variables whose values ACE treats as secrets wherever they appear.
pub const SECRET_ENV: &[&str] = &["ACE_GITLAB_TOKEN", "TUNNEL_TOKEN", "GITHUB_TOKEN"];

/// Replaces every occurrence of a secret value from [`SECRET_ENV`] with `[redacted]`, and
/// masks credentials embedded in URLs (`https://user:token@host`).
pub fn redact(message: &str) -> String {
    let secrets: Vec<String> = SECRET_ENV
        .iter()
        .filter_map(|name| std::env::var(name).ok())
        .collect();
    redact_with(message, &secrets)
}

/// [`redact`] with the secret values given explicitly.
pub fn redact_with(message: &str, secrets: &[String]) -> String {
    let mut out = message.to_owned();
    for value in secrets {
        // Short values would mask ordinary words; real tokens are long.
        if value.len() >= 8 {
            out = out.replace(value.as_str(), "[redacted]");
        }
    }
    redact_url_credentials(&out)
}

fn redact_url_credentials(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut rest = text;
    while let Some(scheme) = rest.find("://") {
        let (head, tail) = rest.split_at(scheme + 3);
        out.push_str(head);
        let authority_end = tail
            .find(|c: char| c == '/' || c.is_whitespace())
            .unwrap_or(tail.len());
        let authority = &tail[..authority_end];
        match authority.rfind('@') {
            Some(at) => {
                out.push_str("[redacted]@");
                out.push_str(&authority[at + 1..]);
            }
            None => out.push_str(authority),
        }
        rest = &tail[authority_end..];
    }
    out.push_str(rest);
    out
}

fn write(level: &str, category: Category, message: &str) {
    let line = format!("ace {level} {} {}\n", category.name(), redact(message));
    // stderr failing leaves nowhere better to report it.
    let _ = std::io::stderr().lock().write_all(line.as_bytes());
}

pub fn info(category: Category, message: &str) {
    write("info", category, message);
}

pub fn warn(category: Category, message: &str) {
    write("warn", category, message);
}

pub fn error(category: Category, message: &str) {
    write("error", category, message);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn secret_values_are_masked_but_short_values_are_not() {
        let secrets = vec!["glpat-0123456789".to_owned(), "abc".to_owned()];
        assert_eq!(
            redact_with("token glpat-0123456789 refused for abc", &secrets),
            "token [redacted] refused for abc"
        );
    }

    #[test]
    fn url_credentials_are_masked() {
        assert_eq!(
            redact_url_credentials("fetch https://deploy:glpat-abc123@gitlab.com/x.git failed"),
            "fetch https://[redacted]@gitlab.com/x.git failed"
        );
        assert_eq!(
            redact_url_credentials("https://gitlab.com/a/b.git"),
            "https://gitlab.com/a/b.git"
        );
        assert_eq!(redact_url_credentials("no url here"), "no url here");
    }
}
