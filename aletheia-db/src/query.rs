//! Filters, sorting, update operators and document validation.
//!
//! Filter language (a deliberately small, MongoDB-shaped subset):
//!   { "field": value }                      equality (arrays match if any element equals)
//!   { "a.b": { "$gt": 1, "$lte": 9 } }      $eq $ne $gt $gte $lt $lte $in $nin $exists
//!   { "$and": [f, ...] }, { "$or": [f, ...] }
//! Comparisons only hold between two numbers or two strings.

use std::cmp::Ordering;

use serde_json::{Map, Value};

use crate::error::{DbError, Result};

pub const RESERVED: [&str; 4] = ["_id", "_rev", "_createdAt", "_updatedAt"];
pub const MAX_DOCUMENT_BYTES: usize = 256 * 1024;
const MAX_DEPTH: usize = 32;
const MAX_FILTER_NODES: usize = 256;

// ---------------------------------------------------------------- names

pub fn check_name(kind: &str, name: &str) -> Result<()> {
    let ok = !name.is_empty()
        && name.len() <= 64
        && name.as_bytes()[0].is_ascii_lowercase()
        && name.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'_' || b == b'-');
    if ok {
        Ok(())
    } else {
        Err(DbError::invalid(format!(
            "invalid {kind} name '{name}': use 1-64 characters, lowercase letters, digits, '_' or '-', starting with a letter"
        )))
    }
}

/// A dotted field path such as `address.city`.
pub fn check_path(path: &str) -> Result<()> {
    let ok = !path.is_empty()
        && path.len() <= 128
        && path
            .split('.')
            .all(|seg| !seg.is_empty() && seg.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_'));
    if ok {
        Ok(())
    } else {
        Err(DbError::invalid(format!("invalid field path '{path}'")))
    }
}

fn touches_reserved(path: &str) -> bool {
    let top = path.split('.').next().unwrap_or("");
    RESERVED.contains(&top)
}

// ---------------------------------------------------------------- documents

/// Validates a client-supplied document body: an object, no reserved or `$` fields,
/// no dots in field names, bounded depth and size.
pub fn validate_document(doc: &Value) -> Result<()> {
    let obj = doc.as_object().ok_or_else(|| DbError::invalid("a document must be a JSON object"))?;
    for k in obj.keys() {
        if RESERVED.contains(&k.as_str()) {
            return Err(DbError::invalid(format!("field '{k}' is set by the database and cannot be written")));
        }
    }
    check_fields(doc, 0)?;
    let size = serde_json::to_vec(doc)?.len();
    if size > MAX_DOCUMENT_BYTES {
        return Err(DbError::invalid(format!("document is {size} bytes; the limit is {MAX_DOCUMENT_BYTES}")));
    }
    Ok(())
}

fn check_fields(v: &Value, depth: usize) -> Result<()> {
    if depth > MAX_DEPTH {
        return Err(DbError::invalid(format!("document nesting is deeper than {MAX_DEPTH}")));
    }
    match v {
        Value::Object(m) => {
            for (k, child) in m {
                if k.is_empty() || k.starts_with('$') || k.contains('.') {
                    return Err(DbError::invalid(format!(
                        "invalid field name '{k}': must be non-empty, without '.' and not starting with '$'"
                    )));
                }
                check_fields(child, depth + 1)?;
            }
            Ok(())
        }
        Value::Array(a) => a.iter().try_for_each(|c| check_fields(c, depth + 1)),
        _ => Ok(()),
    }
}

pub fn get_path<'a>(doc: &'a Value, path: &str) -> Option<&'a Value> {
    let mut cur = doc;
    for seg in path.split('.') {
        cur = cur.as_object()?.get(seg)?;
    }
    Some(cur)
}

// ---------------------------------------------------------------- filters

pub fn validate_filter(filter: &Value) -> Result<()> {
    let mut nodes = 0;
    validate_node(filter, &mut nodes, 0)
}

fn validate_node(f: &Value, nodes: &mut usize, depth: usize) -> Result<()> {
    *nodes += 1;
    if *nodes > MAX_FILTER_NODES || depth > 16 {
        return Err(DbError::invalid("filter is too large or too deeply nested"));
    }
    let obj = f.as_object().ok_or_else(|| DbError::invalid("a filter must be a JSON object"))?;
    for (k, v) in obj {
        match k.as_str() {
            "$and" | "$or" => {
                let arr = v
                    .as_array()
                    .filter(|a| !a.is_empty())
                    .ok_or_else(|| DbError::invalid(format!("{k} takes a non-empty array of filters")))?;
                for sub in arr {
                    validate_node(sub, nodes, depth + 1)?;
                }
            }
            op if op.starts_with('$') => return Err(DbError::invalid(format!("unknown top-level operator '{op}'"))),
            path => {
                check_path(path)?;
                if let Some(ops) = operator_object(v) {
                    for (op, arg) in ops {
                        match op.as_str() {
                            "$eq" | "$ne" | "$gt" | "$gte" | "$lt" | "$lte" => {}
                            "$in" | "$nin" => {
                                if !arg.is_array() {
                                    return Err(DbError::invalid(format!("{op} takes an array")));
                                }
                            }
                            "$exists" => {
                                if !arg.is_boolean() {
                                    return Err(DbError::invalid("$exists takes true or false"));
                                }
                            }
                            other => return Err(DbError::invalid(format!("unknown operator '{other}'"))),
                        }
                    }
                }
            }
        }
    }
    Ok(())
}

/// `{ "$gt": 1 }` style condition objects: every key starts with `$`.
fn operator_object(v: &Value) -> Option<&Map<String, Value>> {
    v.as_object().filter(|m| !m.is_empty() && m.keys().all(|k| k.starts_with('$')))
}

pub fn matches(doc: &Value, filter: &Value) -> bool {
    let Some(obj) = filter.as_object() else { return false };
    obj.iter().all(|(k, v)| match k.as_str() {
        "$and" => v.as_array().is_some_and(|a| a.iter().all(|f| matches(doc, f))),
        "$or" => v.as_array().is_some_and(|a| a.iter().any(|f| matches(doc, f))),
        path => {
            let field = get_path(doc, path);
            match operator_object(v) {
                Some(ops) => ops.iter().all(|(op, arg)| apply_op(field, op, arg)),
                None => equals(field, v),
            }
        }
    })
}

fn equals(field: Option<&Value>, target: &Value) -> bool {
    match field {
        Some(Value::Array(items)) if !target.is_array() => items.iter().any(|i| values_equal(i, target)),
        Some(f) => values_equal(f, target),
        None => target.is_null(),
    }
}

fn values_equal(a: &Value, b: &Value) -> bool {
    match (a, b) {
        (Value::Number(x), Value::Number(y)) => x.as_f64() == y.as_f64(),
        _ => a == b,
    }
}

fn apply_op(field: Option<&Value>, op: &str, arg: &Value) -> bool {
    match op {
        "$eq" => equals(field, arg),
        "$ne" => !equals(field, arg),
        "$in" => arg.as_array().is_some_and(|a| a.iter().any(|t| equals(field, t))),
        "$nin" => arg.as_array().is_some_and(|a| !a.iter().any(|t| equals(field, t))),
        "$exists" => arg.as_bool() == Some(field.is_some()),
        "$gt" | "$gte" | "$lt" | "$lte" => {
            let Some(f) = field else { return false };
            let ord = match (f, arg) {
                (Value::Number(a), Value::Number(b)) => a.as_f64().zip(b.as_f64()).and_then(|(a, b)| a.partial_cmp(&b)),
                (Value::String(a), Value::String(b)) => Some(a.cmp(b)),
                _ => None,
            };
            match (op, ord) {
                ("$gt", Some(o)) => o == Ordering::Greater,
                ("$gte", Some(o)) => o != Ordering::Less,
                ("$lt", Some(o)) => o == Ordering::Less,
                ("$lte", Some(o)) => o != Ordering::Greater,
                _ => false,
            }
        }
        _ => false,
    }
}

/// If the filter pins `path` to specific values (equality or `$in`) at the top level,
/// returns those values so an index can supply the candidates.
pub fn index_candidates(filter: &Value, path: &str) -> Option<Vec<Value>> {
    let cond = filter.as_object()?.get(path)?;
    match operator_object(cond) {
        None if !cond.is_array() && !cond.is_object() => Some(vec![cond.clone()]),
        Some(ops) => {
            if let Some(v) = ops.get("$eq").filter(|v| !v.is_array() && !v.is_object()) {
                return Some(vec![v.clone()]);
            }
            ops.get("$in")?
                .as_array()
                .filter(|a| a.iter().all(|v| !v.is_array() && !v.is_object()))
                .cloned()
        }
        _ => None,
    }
}

// ---------------------------------------------------------------- sorting

#[derive(Debug, Clone)]
pub struct SortKey {
    pub path: String,
    pub descending: bool,
}

pub fn parse_sort(sort: Option<&Value>) -> Result<Vec<SortKey>> {
    let Some(sort) = sort else { return Ok(Vec::new()) };
    let obj = sort
        .as_object()
        .ok_or_else(|| DbError::invalid("sort must be an object such as {\"_createdAt\": -1}"))?;
    if obj.len() > 3 {
        return Err(DbError::invalid("sort takes at most 3 fields"));
    }
    obj.iter()
        .map(|(path, dir)| {
            check_path(path)?;
            match dir.as_i64() {
                Some(1) => Ok(SortKey {
                    path: path.clone(),
                    descending: false,
                }),
                Some(-1) => Ok(SortKey {
                    path: path.clone(),
                    descending: true,
                }),
                _ => Err(DbError::invalid(format!("sort direction for '{path}' must be 1 or -1"))),
            }
        })
        .collect()
}

fn type_rank(v: Option<&Value>) -> u8 {
    match v {
        None | Some(Value::Null) => 0,
        Some(Value::Bool(_)) => 1,
        Some(Value::Number(_)) => 2,
        Some(Value::String(_)) => 3,
        Some(Value::Array(_)) => 4,
        Some(Value::Object(_)) => 5,
    }
}

pub fn compare_values(a: Option<&Value>, b: Option<&Value>) -> Ordering {
    let (ra, rb) = (type_rank(a), type_rank(b));
    if ra != rb {
        return ra.cmp(&rb);
    }
    match (a, b) {
        (Some(Value::Bool(x)), Some(Value::Bool(y))) => x.cmp(y),
        (Some(Value::Number(x)), Some(Value::Number(y))) => x.as_f64().unwrap_or(0.0).partial_cmp(&y.as_f64().unwrap_or(0.0)).unwrap_or(Ordering::Equal),
        (Some(Value::String(x)), Some(Value::String(y))) => x.cmp(y),
        (Some(x), Some(y)) => x.to_string().cmp(&y.to_string()),
        _ => Ordering::Equal,
    }
}

pub fn compare_docs(a: &Value, b: &Value, keys: &[SortKey]) -> Ordering {
    for k in keys {
        let o = compare_values(get_path(a, &k.path), get_path(b, &k.path));
        let o = if k.descending { o.reverse() } else { o };
        if o != Ordering::Equal {
            return o;
        }
    }
    // Stable, deterministic tie-break: ids are time-ordered UUIDv7.
    compare_values(get_path(a, "_id"), get_path(b, "_id"))
}

// ---------------------------------------------------------------- updates

/// Applies `{ "$set": {...}, "$unset": [...], "$inc": {...} }` to a stored document.
pub fn apply_update(doc: &mut Value, update: &Value) -> Result<()> {
    let ops = update
        .as_object()
        .filter(|m| !m.is_empty())
        .ok_or_else(|| DbError::invalid("update must be an object with $set, $unset or $inc"))?;
    for (op, arg) in ops {
        match op.as_str() {
            "$set" => {
                let fields = arg
                    .as_object()
                    .ok_or_else(|| DbError::invalid("$set takes an object of field paths to values"))?;
                for (path, value) in fields {
                    guard_path(path)?;
                    check_fields(value, 1)?;
                    set_path(doc, path, value.clone())?;
                }
            }
            "$unset" => {
                let paths = arg.as_array().ok_or_else(|| DbError::invalid("$unset takes an array of field paths"))?;
                for p in paths {
                    let path = p.as_str().ok_or_else(|| DbError::invalid("$unset paths must be strings"))?;
                    guard_path(path)?;
                    unset_path(doc, path);
                }
            }
            "$inc" => {
                let fields = arg
                    .as_object()
                    .ok_or_else(|| DbError::invalid("$inc takes an object of field paths to numbers"))?;
                for (path, by) in fields {
                    guard_path(path)?;
                    let by = by.as_f64().ok_or_else(|| DbError::invalid(format!("$inc for '{path}' must be a number")))?;
                    let current = match get_path(doc, path) {
                        None => 0.0,
                        Some(Value::Number(n)) => n.as_f64().unwrap_or(0.0),
                        Some(_) => return Err(DbError::invalid(format!("cannot $inc '{path}': it is not a number"))),
                    };
                    let sum = current + by;
                    let value = if sum.fract() == 0.0 && sum.abs() < 9.0e15 {
                        Value::from(sum as i64)
                    } else {
                        Value::from(sum)
                    };
                    set_path(doc, path, value)?;
                }
            }
            other => return Err(DbError::invalid(format!("unknown update operator '{other}'"))),
        }
    }
    Ok(())
}

fn guard_path(path: &str) -> Result<()> {
    check_path(path)?;
    if touches_reserved(path) {
        return Err(DbError::invalid(format!("field '{path}' is set by the database and cannot be written")));
    }
    Ok(())
}

fn set_path(doc: &mut Value, path: &str, value: Value) -> Result<()> {
    let mut cur = doc;
    let segs: Vec<&str> = path.split('.').collect();
    for (i, seg) in segs.iter().enumerate() {
        let obj = cur
            .as_object_mut()
            .ok_or_else(|| DbError::invalid(format!("cannot set '{path}': '{}' is not an object", segs[..i].join("."))))?;
        if i == segs.len() - 1 {
            obj.insert((*seg).to_string(), value);
            return Ok(());
        }
        cur = obj.entry((*seg).to_string()).or_insert_with(|| Value::Object(Map::new()));
    }
    Ok(())
}

fn unset_path(doc: &mut Value, path: &str) {
    let segs: Vec<&str> = path.split('.').collect();
    let mut cur = doc;
    for seg in &segs[..segs.len() - 1] {
        match cur.get_mut(*seg) {
            Some(next) => cur = next,
            None => return,
        }
    }
    if let Some(obj) = cur.as_object_mut() {
        obj.remove(*segs.last().unwrap_or(&""));
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn filters_match_like_documented() {
        let doc = json!({"name": "Ada", "age": 36, "tags": ["a", "b"], "addr": {"city": "Antioch"}});
        assert!(matches(&doc, &json!({"name": "Ada"})));
        assert!(matches(&doc, &json!({"tags": "b"})));
        assert!(matches(&doc, &json!({"addr.city": {"$in": ["Antioch", "Rome"]}})));
        assert!(matches(&doc, &json!({"age": {"$gte": 36, "$lt": 40}})));
        assert!(!matches(&doc, &json!({"age": {"$gt": "36"}})));
        assert!(matches(&doc, &json!({"missing": {"$exists": false}})));
        assert!(matches(&doc, &json!({"$or": [{"name": "Bob"}, {"age": 36}]})));
        assert!(!matches(&doc, &json!({"$and": [{"name": "Ada"}, {"age": 1}]})));
        assert!(matches(&doc, &json!({"missing": null})));
    }

    #[test]
    fn invalid_filters_are_rejected() {
        assert!(validate_filter(&json!({"a": {"$regex": "x"}})).is_err());
        assert!(validate_filter(&json!({"$where": "1"})).is_err());
        assert!(validate_filter(&json!({"a..b": 1})).is_err());
        assert!(validate_filter(&json!({"$or": []})).is_err());
        assert!(validate_filter(&json!({"a": {"$in": 3}})).is_err());
        assert!(validate_filter(&json!({"a": 1, "$and": [{"b": {"$exists": true}}]})).is_ok());
    }

    #[test]
    fn updates_apply_and_protect_reserved_fields() {
        let mut doc = json!({"_id": "x", "_rev": 1, "n": 1, "a": {"b": 1}});
        apply_update(&mut doc, &json!({"$set": {"a.c": 2, "new.deep": true}, "$inc": {"n": 2}, "$unset": ["a.b"]})).unwrap();
        assert_eq!(doc, json!({"_id": "x", "_rev": 1, "n": 3, "a": {"c": 2}, "new": {"deep": true}}));
        assert!(apply_update(&mut doc, &json!({"$set": {"_rev": 9}})).is_err());
        assert!(apply_update(&mut doc, &json!({"$set": {"_id.x": 9}})).is_err());
        assert!(apply_update(&mut doc, &json!({"$rename": {}})).is_err());
        assert!(apply_update(&mut doc, &json!({"$inc": {"a": 1}})).is_err());
    }

    #[test]
    fn documents_are_validated() {
        assert!(validate_document(&json!({"ok": 1})).is_ok());
        assert!(validate_document(&json!([1])).is_err());
        assert!(validate_document(&json!({"_id": "mine"})).is_err());
        assert!(validate_document(&json!({"a": {"$x": 1}})).is_err());
        assert!(validate_document(&json!({"a.b": 1})).is_err());
        assert!(check_name("database", "gov-records_1").is_ok());
        assert!(check_name("database", "Gov").is_err());
    }

    #[test]
    fn sorting_orders_types_then_values() {
        let keys = parse_sort(Some(&json!({"n": -1}))).unwrap();
        let mut docs = [json!({"_id": "1", "n": 1}), json!({"_id": "2", "n": 3}), json!({"_id": "3"})];
        docs.sort_by(|a, b| compare_docs(a, b, &keys));
        let ids: Vec<_> = docs.iter().map(|d| d["_id"].as_str().unwrap()).collect();
        assert_eq!(ids, ["2", "1", "3"]);
    }

    #[test]
    fn index_candidates_only_for_pinned_scalars() {
        assert_eq!(index_candidates(&json!({"e": "x"}), "e"), Some(vec![json!("x")]));
        assert_eq!(index_candidates(&json!({"e": {"$in": [1, 2]}}), "e"), Some(vec![json!(1), json!(2)]));
        assert_eq!(index_candidates(&json!({"e": {"$gt": 1}}), "e"), None);
        assert_eq!(index_candidates(&json!({"e": [1]}), "e"), None);
    }
}
