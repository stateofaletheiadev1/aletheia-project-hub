//! Golden-hash determinism check. Regenerate only with a protocol-version decision or an ADR:
//! `ALETHEIA_WRITE_GOLDEN=1 cargo test -p aletheia-determinism`.

#![allow(clippy::unwrap_used, clippy::panic)]

use aletheia_determinism::{CORPUS_BLOCKS, CORPUS_SEED, run_corpus};

const GOLDEN: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/golden/corpus-v1.txt");

#[test]
fn repeated_runs_are_identical() {
    let first = run_corpus(CORPUS_SEED, 40);
    for run in 1..3 {
        assert_eq!(run_corpus(CORPUS_SEED, 40), first, "run {run} differs");
    }
}

#[test]
fn the_corpus_matches_the_golden_hashes() {
    let produced = run_corpus(CORPUS_SEED, CORPUS_BLOCKS);
    if std::env::var_os("ALETHEIA_WRITE_GOLDEN").is_some() {
        std::fs::write(GOLDEN, &produced).unwrap();
        return;
    }
    let golden = std::fs::read_to_string(GOLDEN)
        .unwrap()
        .replace("\r\n", "\n");
    if let Some((line, (expected, actual))) = golden
        .lines()
        .zip(produced.lines())
        .enumerate()
        .find(|(_, (expected, actual))| expected != actual)
    {
        panic!(
            "first difference at line {}:\n  golden:   {expected}\n  produced: {actual}",
            line + 1
        );
    }
    assert_eq!(
        golden.lines().count(),
        produced.lines().count(),
        "line count differs"
    );
}

#[test]
fn the_corpus_exercises_every_receipt_status_it_can_reach() {
    let produced = run_corpus(CORPUS_SEED, CORPUS_BLOCKS);
    let statuses: String = produced
        .lines()
        .filter_map(|l| l.split("status=").nth(1))
        .collect();
    assert!(statuses.contains('1'), "successes");
    assert!(statuses.contains('2'), "failed executions");
    assert!(statuses.contains('4'), "out of EU");
}
