//! Stable-toolchain smoke run of every fuzz target. This is not a substitute for the
//! coverage-guided campaign in `fuzz/` (Phase 1 exit: 24 h clean); it keeps the target bodies
//! compiling and catches shallow failures on every CI run.

use aletheia_conformance::fuzz;
use proptest::prelude::*;

fn seeds() -> Vec<Vec<u8>> {
    // Valid encodings to mutate from, so random edits reach deep decoder states.
    let vectors = aletheia_conformance::vectors::all();
    let mut seeds = Vec::new();
    for (_, contents) in &vectors {
        for field in ["signed", "header", "bytes"] {
            collect(contents, field, &mut seeds);
        }
    }
    seeds
}

fn collect(value: &serde_json::Value, field: &str, out: &mut Vec<Vec<u8>>) {
    match value {
        serde_json::Value::Object(map) => {
            for (key, inner) in map {
                if key == field
                    && let Some(text) = inner.as_str()
                    && let Ok(bytes) = aletheia_core::base16::decode(text)
                {
                    out.push(bytes);
                }
                collect(inner, field, out);
            }
        }
        serde_json::Value::Array(items) => items.iter().for_each(|item| collect(item, field, out)),
        _ => {}
    }
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(2_000))]

    #[test]
    fn random_bytes(data in proptest::collection::vec(any::<u8>(), 0..512)) {
        fuzz::ace_signed_transaction(&data);
        fuzz::ace_block_header(&data);
        fuzz::text_identifiers(&data);
        fuzz::base16_text(&data);
        fuzz::stateless_validation(&data);
        fuzz::p2p_frames(&data);
        fuzz::arnobc_verify(&data);
        fuzz::consensus_message(&data);
        fuzz::finality_proof(&data);
        fuzz::p2p_hello(&data);
        fuzz::rails_xml(&data);
        fuzz::rails_camt(&data);
    }

    /// The reference Escrow contract with a few bytes changed: mostly near-valid programs,
    /// which reach the checker and code generator rather than stopping in the lexer.
    #[test]
    fn mutated_arno_sources(edits in proptest::collection::vec((any::<prop::sample::Index>(), any::<u8>()), 1..4)) {
        let path = format!("{}/../../examples/arno/escrow.arno", env!("CARGO_MANIFEST_DIR"));
        let mut data = std::fs::read(path).unwrap();
        for (position, value) in edits {
            let index = position.index(data.len());
            data[index] = value;
        }
        fuzz::arno_compile(&data);
        fuzz::vm_run(&data);
    }

    #[test]
    fn mutated_valid_encodings(pick: prop::sample::Index, edits in proptest::collection::vec((any::<prop::sample::Index>(), any::<u8>()), 1..4)) {
        let seeds = seeds();
        let mut data = seeds[pick.index(seeds.len())].clone();
        for (position, value) in edits {
            let index = position.index(data.len());
            data[index] = value;
        }
        fuzz::ace_signed_transaction(&data);
        fuzz::ace_block_header(&data);
        fuzz::stateless_validation(&data);
    }

    #[test]
    fn identifier_like_text(text in "(alt|ALT):[TB]?(0x)?[0-9a-fA-Fg ]{38,66}") {
        fuzz::text_identifiers(text.as_bytes());
    }
}
