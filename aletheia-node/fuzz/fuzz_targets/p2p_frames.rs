#![no_main]

libfuzzer_sys::fuzz_target!(|data: &[u8]| aletheia_conformance::fuzz::p2p_frames(data));
