//! Order-preserving key encoding.
//!
//! Composite keys are byte strings built from segments. Each segment escapes 0x00 as
//! 0x00 0xFF and ends with 0x00 0x01, so byte order equals tuple order and a complete
//! prefix can be range-scanned. Index values carry a type tag and a sortable body so
//! that `null < false < true < numbers < strings`, numbers in numeric order.

use serde_json::Value;

const ESCAPE: [u8; 2] = [0x00, 0xFF];
const END: [u8; 2] = [0x00, 0x01];

pub fn push_segment(out: &mut Vec<u8>, segment: &[u8]) {
    for &b in segment {
        if b == 0 {
            out.extend_from_slice(&ESCAPE);
        } else {
            out.push(b);
        }
    }
    out.extend_from_slice(&END);
}

pub fn key(segments: &[&[u8]]) -> Vec<u8> {
    let mut out = Vec::with_capacity(segments.iter().map(|s| s.len() + 2).sum());
    for s in segments {
        push_segment(&mut out, s);
    }
    out
}

/// The smallest key greater than every key that starts with `prefix`.
/// Prefixes produced by [`key`] always end in 0x01, so incrementing it is enough.
pub fn prefix_end(prefix: &[u8]) -> Vec<u8> {
    let mut end = prefix.to_vec();
    if let Some(last) = end.last_mut() {
        *last += 1;
    }
    end
}

/// Reads the last segment of a composite key (used to recover document ids from index keys).
pub fn last_segment(k: &[u8]) -> Vec<u8> {
    // Walk segments from the start; return the final decoded one.
    let mut segments = Vec::new();
    let mut current = Vec::new();
    let mut i = 0;
    while i < k.len() {
        if k[i] == 0 && i + 1 < k.len() {
            match k[i + 1] {
                0xFF => current.push(0),
                0x01 => segments.push(std::mem::take(&mut current)),
                _ => {}
            }
            i += 2;
        } else {
            current.push(k[i]);
            i += 1;
        }
    }
    segments.pop().unwrap_or_default()
}

/// Sortable encoding of an indexable JSON value. Arrays and objects are not indexable.
pub fn index_value(v: &Value) -> Option<Vec<u8>> {
    match v {
        Value::Null => Some(vec![0x10]),
        Value::Bool(b) => Some(vec![0x20, u8::from(*b)]),
        Value::Number(n) => {
            let f = n.as_f64()?;
            let bits = f.to_bits();
            // Flip so that negative numbers sort before positive ones, in numeric order.
            let ordered = if bits >> 63 == 1 { !bits } else { bits ^ (1 << 63) };
            let mut out = vec![0x30];
            out.extend_from_slice(&ordered.to_be_bytes());
            Some(out)
        }
        Value::String(s) => {
            let mut out = vec![0x40];
            out.extend_from_slice(s.as_bytes());
            Some(out)
        }
        Value::Array(_) | Value::Object(_) => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn tuple_order_is_byte_order() {
        let a = key(&[b"db", b"a"]);
        let b = key(&[b"db", b"ab"]);
        let c = key(&[b"dc", b""]);
        assert!(a < b && b < c);
        let with_nul = key(&[b"a\0b"]);
        assert_eq!(last_segment(&with_nul), b"a\0b");
    }

    #[test]
    fn prefix_range_contains_extensions_only() {
        let p = key(&[b"db", b"coll"]);
        let inside = key(&[b"db", b"coll", b"\xff\xff"]);
        let outside = key(&[b"db", b"colm"]);
        let end = prefix_end(&p);
        assert!(inside >= p && inside < end);
        assert!(outside >= end);
    }

    #[test]
    fn values_sort_by_type_then_value() {
        let enc = |v| index_value(&v).unwrap();
        let ordered = [
            json!(null),
            json!(false),
            json!(true),
            json!(-10.5),
            json!(-1),
            json!(0),
            json!(2),
            json!(1e9),
            json!(""),
            json!("a"),
            json!("b"),
        ];
        for w in ordered.windows(2) {
            assert!(enc(w[0].clone()) < enc(w[1].clone()), "{} < {}", w[0], w[1]);
        }
        assert_eq!(enc(json!(1)), enc(json!(1.0)));
        assert!(index_value(&json!([1])).is_none());
    }
}
