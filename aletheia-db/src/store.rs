//! The storage engine: databases, collections, documents and secondary indexes on top
//! of redb (a crash-safe, copy-on-write B-tree store). One write transaction runs at a
//! time; every commit is durable (fsync) before it returns.

use std::collections::BTreeSet;
use std::path::Path;

use redb::{Database, ReadableDatabase, ReadableTable, TableDefinition, WriteTransaction};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value, json};

use crate::auth::KeyRecord;
use crate::encoding::{index_value, key, last_segment, prefix_end, push_segment};
use crate::error::{DbError, Result};
use crate::query::{self, SortKey};
use crate::time;

type Bytes = &'static [u8];
const DOCS: TableDefinition<Bytes, Bytes> = TableDefinition::new("documents");
const INDEX: TableDefinition<Bytes, Bytes> = TableDefinition::new("index_entries");
const CATALOG: TableDefinition<Bytes, Bytes> = TableDefinition::new("catalog");
const KEYS: TableDefinition<Bytes, Bytes> = TableDefinition::new("api_keys");
const IDEM: TableDefinition<Bytes, Bytes> = TableDefinition::new("idempotency");

/// A query may examine at most this many documents without an index.
pub const MAX_SCAN: usize = 50_000;
pub const MAX_LIMIT: usize = 1_000;
pub const MAX_SKIP: usize = 10_000;
const IDEMPOTENCY_TTL_MS: u64 = 24 * 3600 * 1000;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseInfo {
    pub name: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectionInfo {
    pub database: String,
    pub name: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexInfo {
    pub database: String,
    pub collection: String,
    pub field: String,
    pub unique: bool,
    pub created_at: String,
}

#[derive(Debug, Clone)]
pub struct Query {
    pub filter: Value,
    pub sort: Vec<SortKey>,
    pub limit: usize,
    pub skip: usize,
}

/// Identifies a retried write: the same key + Idempotency-Key + request returns the
/// stored outcome instead of writing twice.
#[derive(Debug, Clone)]
pub struct Idempotency {
    pub key_id: String,
    pub key: String,
    pub fingerprint: String,
}

#[derive(Debug)]
pub struct WriteOutcome {
    pub status: u16,
    pub body: Value,
    pub replayed: bool,
}

#[derive(Serialize, Deserialize)]
struct IdemRecord {
    fingerprint: String,
    status: u16,
    body: Value,
    expires_at_ms: u64,
}

pub struct Store {
    db: Database,
}

// ---------------------------------------------------------------- keys

fn db_key(db: &str) -> Vec<u8> {
    key(&[b"db", db.as_bytes()])
}
fn coll_key(db: &str, coll: &str) -> Vec<u8> {
    key(&[b"coll", db.as_bytes(), coll.as_bytes()])
}
fn coll_prefix(db: &str) -> Vec<u8> {
    key(&[b"coll", db.as_bytes()])
}
fn idx_key(db: &str, coll: &str, field: &str) -> Vec<u8> {
    key(&[b"idx", db.as_bytes(), coll.as_bytes(), field.as_bytes()])
}
fn idx_prefix(db: &str, coll: &str) -> Vec<u8> {
    key(&[b"idx", db.as_bytes(), coll.as_bytes()])
}
fn doc_key(db: &str, coll: &str, id: &str) -> Vec<u8> {
    key(&[db.as_bytes(), coll.as_bytes(), id.as_bytes()])
}
fn docs_prefix(db: &str, coll: &str) -> Vec<u8> {
    key(&[db.as_bytes(), coll.as_bytes()])
}
fn entry_prefix(db: &str, coll: &str, field: &str, value: &[u8]) -> Vec<u8> {
    let mut k = key(&[db.as_bytes(), coll.as_bytes(), field.as_bytes()]);
    push_segment(&mut k, value);
    k
}
fn entry_key(db: &str, coll: &str, field: &str, value: &[u8], id: &str) -> Vec<u8> {
    let mut k = entry_prefix(db, coll, field, value);
    push_segment(&mut k, id.as_bytes());
    k
}

/// Every index value a document contributes for `field` (arrays index each element).
fn indexed_values(doc: &Value, field: &str) -> BTreeSet<Vec<u8>> {
    match query::get_path(doc, field) {
        None => BTreeSet::new(),
        Some(Value::Array(items)) => items.iter().filter_map(index_value).collect(),
        Some(v) => index_value(v).into_iter().collect(),
    }
}

fn decode<T: for<'de> Deserialize<'de>>(bytes: &[u8]) -> Result<T> {
    Ok(serde_json::from_slice(bytes)?)
}

fn scan_prefix<T: ReadableTable<Bytes, Bytes>>(table: &T, prefix: &[u8]) -> Result<Vec<(Vec<u8>, Vec<u8>)>> {
    let end = prefix_end(prefix);
    let mut out = Vec::new();
    for row in table.range(prefix..end.as_slice())? {
        let (k, v) = row?;
        out.push((k.value().to_vec(), v.value().to_vec()));
    }
    Ok(out)
}

impl Store {
    pub fn open(path: &Path, cache_bytes: usize) -> Result<Store> {
        let db = Database::builder().set_cache_size(cache_bytes).create(path)?;
        let tx = db.begin_write()?;
        for t in [DOCS, INDEX, CATALOG, KEYS, IDEM] {
            tx.open_table(t)?;
        }
        tx.commit()?;
        Ok(Store { db })
    }

    /// Readiness probe: the file can be read.
    pub fn ping(&self) -> Result<()> {
        let tx = self.db.begin_read()?;
        tx.open_table(CATALOG)?;
        Ok(())
    }

    // ------------------------------------------------------------ catalog

    pub fn create_database(&self, name: &str) -> Result<(bool, DatabaseInfo)> {
        query::check_name("database", name)?;
        let tx = self.db.begin_write()?;
        let result = {
            let mut cat = tx.open_table(CATALOG)?;
            let k = db_key(name);
            if let Some(existing) = cat.get(k.as_slice())? {
                (false, decode(existing.value())?)
            } else {
                let info = DatabaseInfo {
                    name: name.into(),
                    created_at: time::now_rfc3339(),
                };
                cat.insert(k.as_slice(), serde_json::to_vec(&info)?.as_slice())?;
                (true, info)
            }
        };
        tx.commit()?;
        Ok(result)
    }

    pub fn list_databases(&self) -> Result<Vec<DatabaseInfo>> {
        let tx = self.db.begin_read()?;
        let cat = tx.open_table(CATALOG)?;
        scan_prefix(&cat, &key(&[b"db"]))?.iter().map(|(_, v)| decode(v)).collect()
    }

    pub fn ensure_collection(&self, db: &str, coll: &str) -> Result<(bool, CollectionInfo)> {
        query::check_name("collection", coll)?;
        let tx = self.db.begin_write()?;
        let result = {
            let mut cat = tx.open_table(CATALOG)?;
            if cat.get(db_key(db).as_slice())?.is_none() {
                return Err(DbError::not_found(format!("database '{db}' does not exist")));
            }
            let k = coll_key(db, coll);
            if let Some(existing) = cat.get(k.as_slice())? {
                (false, decode(existing.value())?)
            } else {
                let info = CollectionInfo {
                    database: db.into(),
                    name: coll.into(),
                    created_at: time::now_rfc3339(),
                };
                cat.insert(k.as_slice(), serde_json::to_vec(&info)?.as_slice())?;
                (true, info)
            }
        };
        tx.commit()?;
        Ok(result)
    }

    pub fn list_collections(&self, db: &str) -> Result<Vec<CollectionInfo>> {
        let tx = self.db.begin_read()?;
        let cat = tx.open_table(CATALOG)?;
        if cat.get(db_key(db).as_slice())?.is_none() {
            return Err(DbError::not_found(format!("database '{db}' does not exist")));
        }
        scan_prefix(&cat, &coll_prefix(db))?.iter().map(|(_, v)| decode(v)).collect()
    }

    pub fn create_index(&self, db: &str, coll: &str, field: &str, unique: bool) -> Result<(bool, IndexInfo)> {
        query::check_path(field)?;
        if field == "_id" || field.starts_with("_rev") {
            return Err(DbError::invalid(format!("'{field}' cannot be indexed")));
        }
        let tx = self.db.begin_write()?;
        let result = {
            let mut cat = tx.open_table(CATALOG)?;
            require_collection(&cat, db, coll)?;
            let k = idx_key(db, coll, field);
            if let Some(existing) = cat.get(k.as_slice())? {
                let info: IndexInfo = decode(existing.value())?;
                if info.unique != unique {
                    return Err(DbError::conflict(format!("index on '{field}' already exists with unique={}", info.unique)));
                }
                (false, info)
            } else {
                // Build entries for existing documents, enforcing uniqueness as we go.
                let docs = tx.open_table(DOCS)?;
                let mut entries = tx.open_table(INDEX)?;
                let mut seen = BTreeSet::new();
                for (_, raw) in scan_prefix(&docs, &docs_prefix(db, coll))? {
                    let doc: Value = decode(&raw)?;
                    let id = doc["_id"].as_str().unwrap_or_default().to_string();
                    for v in indexed_values(&doc, field) {
                        if unique && !seen.insert(v.clone()) {
                            return Err(DbError::conflict(format!(
                                "cannot create unique index on '{field}': existing documents share a value"
                            )));
                        }
                        entries.insert(entry_key(db, coll, field, &v, &id).as_slice(), &[][..])?;
                    }
                }
                let info = IndexInfo {
                    database: db.into(),
                    collection: coll.into(),
                    field: field.into(),
                    unique,
                    created_at: time::now_rfc3339(),
                };
                cat.insert(k.as_slice(), serde_json::to_vec(&info)?.as_slice())?;
                (true, info)
            }
        };
        tx.commit()?;
        Ok(result)
    }

    pub fn list_indexes(&self, db: &str, coll: &str) -> Result<Vec<IndexInfo>> {
        let tx = self.db.begin_read()?;
        let cat = tx.open_table(CATALOG)?;
        require_collection(&cat, db, coll)?;
        indexes_of(&cat, db, coll)
    }

    // ------------------------------------------------------------ reads

    pub fn get(&self, db: &str, coll: &str, id: &str) -> Result<Value> {
        let tx = self.db.begin_read()?;
        require_collection(&tx.open_table(CATALOG)?, db, coll)?;
        let docs = tx.open_table(DOCS)?;
        let doc = docs
            .get(doc_key(db, coll, id).as_slice())?
            .ok_or_else(|| DbError::not_found(format!("no document '{id}' in {db}.{coll}")))?;
        decode(doc.value())
    }

    /// Returns the page of matching documents and whether more exist after it.
    pub fn find(&self, db: &str, coll: &str, q: &Query) -> Result<(Vec<Value>, bool)> {
        let mut matches = self.matching(db, coll, &q.filter, if q.sort.is_empty() { Some(q.skip + q.limit + 1) } else { None })?;
        if !q.sort.is_empty() {
            matches.sort_by(|a, b| query::compare_docs(a, b, &q.sort));
        }
        let has_more = matches.len() > q.skip + q.limit;
        Ok((matches.into_iter().skip(q.skip).take(q.limit).collect(), has_more))
    }

    pub fn count(&self, db: &str, coll: &str, filter: &Value) -> Result<usize> {
        Ok(self.matching(db, coll, filter, None)?.len())
    }

    /// Candidate documents come from an index when the filter pins an indexed field to
    /// scalar values; otherwise the collection is scanned (bounded by [`MAX_SCAN`]).
    fn matching(&self, db: &str, coll: &str, filter: &Value, stop_after: Option<usize>) -> Result<Vec<Value>> {
        query::validate_filter(filter)?;
        let tx = self.db.begin_read()?;
        let cat = tx.open_table(CATALOG)?;
        require_collection(&cat, db, coll)?;
        let docs = tx.open_table(DOCS)?;

        let plan = indexes_of(&cat, db, coll)?.into_iter().find_map(|idx| {
            let values = query::index_candidates(filter, &idx.field)?;
            // Documents missing the field are not indexed, so `null` cannot use the index.
            (!values.iter().any(Value::is_null)).then_some((idx.field, values))
        });

        let mut out = Vec::new();
        let mut examined = 0usize;
        let mut consider = |raw: &[u8], out: &mut Vec<Value>| -> Result<bool> {
            examined += 1;
            if examined > MAX_SCAN {
                return Err(DbError::invalid(format!(
                    "query examined more than {MAX_SCAN} documents; add an index or narrow the filter"
                )));
            }
            let doc: Value = decode(raw)?;
            if query::matches(&doc, filter) {
                out.push(doc);
            }
            Ok(stop_after.is_some_and(|n| out.len() >= n))
        };

        match plan {
            Some((field, values)) => {
                let entries = tx.open_table(INDEX)?;
                let mut ids = BTreeSet::new();
                for v in &values {
                    if let Some(enc) = index_value(v) {
                        for (k, _) in scan_prefix(&entries, &entry_prefix(db, coll, &field, &enc))? {
                            ids.insert(String::from_utf8_lossy(&last_segment(&k)).into_owned());
                        }
                    }
                }
                for id in ids {
                    if let Some(raw) = docs.get(doc_key(db, coll, &id).as_slice())?
                        && consider(raw.value(), &mut out)?
                    {
                        break;
                    }
                }
            }
            None => {
                let prefix = docs_prefix(db, coll);
                let end = prefix_end(&prefix);
                for row in docs.range(prefix.as_slice()..end.as_slice())? {
                    let (_, raw) = row?;
                    if consider(raw.value(), &mut out)? {
                        break;
                    }
                }
            }
        }
        Ok(out)
    }

    // ------------------------------------------------------------ writes

    /// Runs a write in one transaction, with optional idempotency: a retried request with
    /// the same key returns the first outcome; a different request with the key is refused.
    pub fn write(&self, idem: Option<&Idempotency>, f: impl FnOnce(&WriteTransaction) -> Result<(u16, Value)>) -> Result<WriteOutcome> {
        let tx = self.db.begin_write()?;
        let idem_key = idem.map(|i| key(&[i.key_id.as_bytes(), i.key.as_bytes()]));
        if let (Some(i), Some(k)) = (idem, &idem_key) {
            let table = tx.open_table(IDEM)?;
            if let Some(raw) = table.get(k.as_slice())? {
                let rec: IdemRecord = decode(raw.value())?;
                if rec.expires_at_ms > time::now_millis() {
                    if rec.fingerprint != i.fingerprint {
                        return Err(DbError::conflict("this Idempotency-Key was already used for a different request"));
                    }
                    return Ok(WriteOutcome {
                        status: rec.status,
                        body: rec.body,
                        replayed: true,
                    });
                }
            }
        }
        let (status, body) = f(&tx)?;
        if let (Some(i), Some(k)) = (idem, &idem_key) {
            let rec = IdemRecord {
                fingerprint: i.fingerprint.clone(),
                status,
                body: body.clone(),
                expires_at_ms: time::now_millis() + IDEMPOTENCY_TTL_MS,
            };
            tx.open_table(IDEM)?.insert(k.as_slice(), serde_json::to_vec(&rec)?.as_slice())?;
        }
        tx.commit()?;
        Ok(WriteOutcome { status, body, replayed: false })
    }

    /// Removes expired idempotency records. Returns how many remain.
    pub fn purge_idempotency(&self) -> Result<u64> {
        let now = time::now_millis();
        let tx = self.db.begin_write()?;
        {
            let mut t = tx.open_table(IDEM)?;
            t.retain(|_, v| serde_json::from_slice::<IdemRecord>(v).map(|r| r.expires_at_ms > now).unwrap_or(false))?;
        }
        tx.commit()?;
        let tx = self.db.begin_read()?;
        Ok(redb::ReadableTableMetadata::len(&tx.open_table(IDEM)?)?)
    }

    // ------------------------------------------------------------ api keys

    pub fn put_key(&self, rec: &KeyRecord) -> Result<()> {
        let tx = self.db.begin_write()?;
        tx.open_table(KEYS)?.insert(rec.id.as_bytes(), serde_json::to_vec(rec)?.as_slice())?;
        tx.commit()?;
        Ok(())
    }

    pub fn get_key(&self, id: &str) -> Result<Option<KeyRecord>> {
        let tx = self.db.begin_read()?;
        let t = tx.open_table(KEYS)?;
        t.get(id.as_bytes())?.map(|g| decode(g.value())).transpose()
    }

    pub fn list_keys(&self) -> Result<Vec<KeyRecord>> {
        let tx = self.db.begin_read()?;
        let t = tx.open_table(KEYS)?;
        let mut out = Vec::new();
        for row in t.iter()? {
            let (_, v) = row?;
            out.push(decode(v.value())?);
        }
        Ok(out)
    }

    pub fn delete_key(&self, id: &str) -> Result<bool> {
        let tx = self.db.begin_write()?;
        let removed = tx.open_table(KEYS)?.remove(id.as_bytes())?.is_some();
        tx.commit()?;
        Ok(removed)
    }
}

// ---------------------------------------------------------------- write operations
// Free functions over an open write transaction, so `Store::write` can wrap them with
// idempotency in a single atomic commit.

pub fn insert_document(tx: &WriteTransaction, db: &str, coll: &str, body: Value) -> Result<Value> {
    query::validate_document(&body)?;
    let cat = tx.open_table(CATALOG)?;
    require_collection(&cat, db, coll)?;
    let indexes = indexes_of(&cat, db, coll)?;
    drop(cat);

    let id = uuid::Uuid::now_v7().simple().to_string();
    let now = time::now_rfc3339();
    let mut doc = Map::new();
    doc.insert("_id".into(), json!(id));
    doc.insert("_rev".into(), json!(1));
    doc.insert("_createdAt".into(), json!(now));
    doc.insert("_updatedAt".into(), json!(now));
    doc.extend(body.as_object().cloned().unwrap_or_default());
    let doc = Value::Object(doc);

    reindex(tx, db, coll, &id, &indexes, None, Some(&doc))?;
    tx.open_table(DOCS)?
        .insert(doc_key(db, coll, &id).as_slice(), serde_json::to_vec(&doc)?.as_slice())?;
    Ok(doc)
}

/// Applies `change` to the current document if its revision is `expected_rev`.
pub fn modify_document(
    tx: &WriteTransaction,
    db: &str,
    coll: &str,
    id: &str,
    expected_rev: u64,
    change: impl FnOnce(&mut Value) -> Result<()>,
) -> Result<Value> {
    let cat = tx.open_table(CATALOG)?;
    require_collection(&cat, db, coll)?;
    let indexes = indexes_of(&cat, db, coll)?;
    drop(cat);

    let k = doc_key(db, coll, id);
    let old: Value = {
        let docs = tx.open_table(DOCS)?;
        let raw = docs
            .get(k.as_slice())?
            .ok_or_else(|| DbError::not_found(format!("no document '{id}' in {db}.{coll}")))?;
        decode(raw.value())?
    };
    let current = old["_rev"].as_u64().unwrap_or(0);
    if current != expected_rev {
        return Err(DbError::conflict(format!(
            "this document changed since you read it (expected revision {expected_rev}, current {current})"
        )));
    }

    let mut new = old.clone();
    change(&mut new)?;
    if let Some(m) = new.as_object_mut() {
        m.insert("_id".into(), json!(id));
        m.insert("_rev".into(), json!(current + 1));
        m.insert("_createdAt".into(), old["_createdAt"].clone());
        m.insert("_updatedAt".into(), json!(time::now_rfc3339()));
    }
    let size = serde_json::to_vec(&new)?.len();
    if size > query::MAX_DOCUMENT_BYTES {
        return Err(DbError::invalid(format!(
            "document would be {size} bytes; the limit is {}",
            query::MAX_DOCUMENT_BYTES
        )));
    }

    reindex(tx, db, coll, id, &indexes, Some(&old), Some(&new))?;
    tx.open_table(DOCS)?.insert(k.as_slice(), serde_json::to_vec(&new)?.as_slice())?;
    Ok(new)
}

pub fn replace_document(tx: &WriteTransaction, db: &str, coll: &str, id: &str, expected_rev: u64, body: Value) -> Result<Value> {
    query::validate_document(&body)?;
    modify_document(tx, db, coll, id, expected_rev, |doc| {
        *doc = body;
        Ok(())
    })
}

pub fn update_document(tx: &WriteTransaction, db: &str, coll: &str, id: &str, expected_rev: u64, update: &Value) -> Result<Value> {
    modify_document(tx, db, coll, id, expected_rev, |doc| query::apply_update(doc, update))
}

pub fn delete_document(tx: &WriteTransaction, db: &str, coll: &str, id: &str, expected_rev: u64) -> Result<Value> {
    let cat = tx.open_table(CATALOG)?;
    require_collection(&cat, db, coll)?;
    let indexes = indexes_of(&cat, db, coll)?;
    drop(cat);

    let k = doc_key(db, coll, id);
    let old: Value = {
        let docs = tx.open_table(DOCS)?;
        let raw = docs
            .get(k.as_slice())?
            .ok_or_else(|| DbError::not_found(format!("no document '{id}' in {db}.{coll}")))?;
        decode(raw.value())?
    };
    let current = old["_rev"].as_u64().unwrap_or(0);
    if current != expected_rev {
        return Err(DbError::conflict(format!(
            "this document changed since you read it (expected revision {expected_rev}, current {current})"
        )));
    }
    reindex(tx, db, coll, id, &indexes, Some(&old), None)?;
    tx.open_table(DOCS)?.remove(k.as_slice())?;
    Ok(json!({ "_id": id, "deleted": true }))
}

// ---------------------------------------------------------------- helpers

fn require_collection<T: ReadableTable<Bytes, Bytes>>(cat: &T, db: &str, coll: &str) -> Result<()> {
    if cat.get(coll_key(db, coll).as_slice())?.is_some() {
        return Ok(());
    }
    if cat.get(db_key(db).as_slice())?.is_none() {
        return Err(DbError::not_found(format!("database '{db}' does not exist")));
    }
    Err(DbError::not_found(format!("collection '{coll}' does not exist in '{db}'; create it first")))
}

fn indexes_of<T: ReadableTable<Bytes, Bytes>>(cat: &T, db: &str, coll: &str) -> Result<Vec<IndexInfo>> {
    scan_prefix(cat, &idx_prefix(db, coll))?.iter().map(|(_, v)| decode(v)).collect()
}

/// Moves a document's index entries from `old` to `new`, enforcing unique indexes.
fn reindex(tx: &WriteTransaction, db: &str, coll: &str, id: &str, indexes: &[IndexInfo], old: Option<&Value>, new: Option<&Value>) -> Result<()> {
    if indexes.is_empty() {
        return Ok(());
    }
    let mut entries = tx.open_table(INDEX)?;
    for idx in indexes {
        let before = old.map(|d| indexed_values(d, &idx.field)).unwrap_or_default();
        let after = new.map(|d| indexed_values(d, &idx.field)).unwrap_or_default();
        for v in before.difference(&after) {
            entries.remove(entry_key(db, coll, &idx.field, v, id).as_slice())?;
        }
        for v in after.difference(&before) {
            if idx.unique {
                let taken = scan_prefix(&entries, &entry_prefix(db, coll, &idx.field, v))?
                    .iter()
                    .any(|(k, _)| last_segment(k) != id.as_bytes());
                if taken {
                    return Err(DbError::conflict(format!(
                        "another document already has this value for unique field '{}'",
                        idx.field
                    )));
                }
            }
            entries.insert(entry_key(db, coll, &idx.field, v, id).as_slice(), &[][..])?;
        }
    }
    Ok(())
}
