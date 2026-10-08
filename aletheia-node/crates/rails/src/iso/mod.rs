//! ISO 20022 messages at the rail boundary (validation layer 1, Sections 40 and 40C.4):
//! the hardened reader, and `pacs.008` / `pacs.002` mapped to and from the canonical model.
//!
//! The reader enforces the syntax rules and each mapping checks the elements it reads and
//! the message version the profile names. Full validation against the pinned XSD files is
//! not done here yet.

pub mod pacs002;
pub mod pacs008;
pub mod xml;

pub use pacs002::{Outcome, TransactionStatus, parse_pacs002, render_pacs002};
pub use pacs008::{derived_uetr, parse_pacs008, render_pacs008};
