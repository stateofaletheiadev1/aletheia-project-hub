//! Operator log lines (spec Section 46A.4) until the compressed binary log backend (Section 45)
//! replaces this writer. One line per event, written whole so lines from different tasks
//! never interleave.

use std::io::Write;

fn write(level: &str, message: &str) {
    let mut line = String::with_capacity(message.len().saturating_add(16));
    line.push_str("aletheiad ");
    line.push_str(level);
    line.push(' ');
    line.push_str(message);
    line.push('\n');
    // A failed write to stderr has nowhere better to be reported.
    let _ = std::io::stderr().lock().write_all(line.as_bytes());
}

pub(crate) fn line(message: &str) {
    write("info", message);
}

#[cfg(not(feature = "rocksdb"))]
pub(crate) fn warn(message: &str) {
    write("warn", message);
}

pub(crate) fn error(message: &str) {
    write("error", message);
}
