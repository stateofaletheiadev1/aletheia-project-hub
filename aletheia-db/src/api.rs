//! The HTTP + JSON API. See docs/API.md for the full reference.
//!
//! Every route under /v1 needs `Authorization: Bearer <keyId>.<secret>`. Storage work runs
//! on blocking threads with a deadline; a request that misses it returns `Timeout`, which
//! means "outcome unknown" (retry writes with the same Idempotency-Key).

use std::sync::Arc;
use std::time::{Duration, Instant};

use axum::body::Bytes;
use axum::extract::{DefaultBodyLimit, Path, Query as QueryParams, Request, State};
use axum::http::{HeaderMap, HeaderValue, Method, StatusCode, header};
use axum::middleware::{self, Next};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post, put};
use axum::{Extension, Json, Router};
use serde::Deserialize;
use serde_json::{Value, json};

use crate::auth::{self, KeyRecord, Principal, Role};
use crate::error::{DbError, Result};
use crate::query;
use crate::store::{self, Idempotency, MAX_LIMIT, MAX_SKIP, Query, Store};
use crate::time;

pub const VERSION: &str = env!("CARGO_PKG_VERSION");
const STORAGE_DEADLINE: Duration = Duration::from_secs(15);
const MAX_BODY_BYTES: usize = 1024 * 1024;

#[derive(Clone)]
pub struct AppState {
    pub store: Arc<Store>,
    /// SHA-256 (hex) of the root key's secret; `None` disables the root key.
    pub root_secret_sha256: Option<String>,
    pub started: Instant,
}

#[derive(Clone)]
struct RequestId(String);

pub fn router(state: AppState) -> Router {
    let v1 = Router::new()
        .route("/whoami", get(whoami))
        .route("/databases", get(list_databases))
        .route("/databases/{db}", put(put_database))
        .route("/databases/{db}/collections", get(list_collections))
        .route("/databases/{db}/collections/{coll}", put(put_collection))
        .route("/databases/{db}/collections/{coll}/indexes", get(list_indexes))
        .route("/databases/{db}/collections/{coll}/indexes/{field}", put(put_index))
        .route("/databases/{db}/collections/{coll}/documents", post(insert_document))
        .route(
            "/databases/{db}/collections/{coll}/documents/{id}",
            get(get_document).patch(patch_document).put(replace_document).delete(delete_document),
        )
        .route("/databases/{db}/collections/{coll}/query", post(find_documents))
        .route("/databases/{db}/collections/{coll}/count", post(count_documents))
        .route("/databases/{db}/commit", post(commit))
        .route("/keys", get(list_keys).post(create_key))
        .route("/keys/{id}", axum::routing::delete(delete_key));

    Router::new()
        .route("/health", get(health))
        .route("/health/ready", get(ready))
        .nest("/v1", v1)
        .fallback(not_found)
        .layer(DefaultBodyLimit::max(MAX_BODY_BYTES))
        .layer(middleware::from_fn(request_context))
        .with_state(state)
}

// ---------------------------------------------------------------- plumbing

/// Assigns a request id (keeping a well-formed one from the proxy), logs one line per
/// request without bodies, and echoes the id in `X-Request-Id`.
async fn request_context(mut req: Request, next: Next) -> Response {
    let rid = req
        .headers()
        .get("x-request-id")
        .and_then(|v| v.to_str().ok())
        .filter(|s| !s.is_empty() && s.len() <= 64 && s.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-'))
        .map(str::to_string)
        .unwrap_or_else(|| uuid::Uuid::now_v7().simple().to_string());
    req.extensions_mut().insert(RequestId(rid.clone()));
    let (method, path, start) = (req.method().clone(), req.uri().path().to_string(), Instant::now());
    let mut res = next.run(req).await;
    if let Ok(v) = HeaderValue::from_str(&rid) {
        res.headers_mut().insert("x-request-id", v);
    }
    res.headers_mut().insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    tracing::info!(request_id = %rid, method = %method, path = %path, status = res.status().as_u16(), ms = start.elapsed().as_millis() as u64, "request");
    res
}

async fn blocking<T: Send + 'static>(f: impl FnOnce() -> Result<T> + Send + 'static) -> Result<T> {
    match tokio::time::timeout(STORAGE_DEADLINE, tokio::task::spawn_blocking(f)).await {
        Err(_) => Err(DbError::Timeout),
        Ok(Err(join)) => Err(DbError::Internal(join.to_string())),
        Ok(Ok(result)) => result,
    }
}

fn reply(rid: &RequestId, result: Result<(StatusCode, Value)>) -> Response {
    match result {
        Ok((status, body)) => (status, Json(body)).into_response(),
        Err(e) => {
            if let DbError::Internal(detail) = &e {
                tracing::error!(request_id = %rid.0, detail = %detail, "internal error");
            }
            let status = StatusCode::from_u16(e.status()).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);
            (status, Json(e.body(&rid.0))).into_response()
        }
    }
}

fn parse_body(bytes: &Bytes) -> Result<Value> {
    if bytes.is_empty() {
        return Ok(json!({}));
    }
    let v: Value = serde_json::from_slice(bytes).map_err(|e| DbError::invalid(format!("request body is not valid JSON: {e}")))?;
    if !v.is_object() {
        return Err(DbError::invalid("request body must be a JSON object"));
    }
    Ok(v)
}

fn check_id(id: &str) -> Result<()> {
    if !id.is_empty() && id.len() <= 64 && id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_') {
        Ok(())
    } else {
        Err(DbError::invalid("invalid document id"))
    }
}

fn expected_rev(body: &Value) -> Result<u64> {
    body.get("expectedRev")
        .and_then(Value::as_u64)
        .filter(|r| *r >= 1)
        .ok_or_else(|| DbError::invalid("expectedRev (the revision you read) is required"))
}

async fn authenticate(state: &AppState, headers: &HeaderMap) -> Result<Principal> {
    let (id, secret) = auth::parse_bearer(headers.get(header::AUTHORIZATION).and_then(|v| v.to_str().ok()))?;
    let presented = auth::sha256_hex(secret.as_bytes());
    if id == "root" {
        return match &state.root_secret_sha256 {
            Some(expected) if auth::constant_time_eq(&presented, expected) => Ok(Principal::root()),
            _ => Err(DbError::Unauthorized),
        };
    }
    let store = state.store.clone();
    let record = blocking(move || store.get_key(&id)).await?;
    match record {
        Some(r) if auth::constant_time_eq(&presented, &r.secret_sha256) => Ok(Principal {
            key_id: r.id,
            scope: Some((r.database, r.role)),
        }),
        _ => Err(DbError::Unauthorized),
    }
}

fn idempotency(headers: &HeaderMap, principal: &Principal, method: &Method, path: &str, body: &Bytes) -> Result<Option<Idempotency>> {
    let Some(raw) = headers.get("idempotency-key") else { return Ok(None) };
    let key = raw
        .to_str()
        .ok()
        .filter(|k| !k.is_empty() && k.len() <= 128)
        .ok_or_else(|| DbError::invalid("Idempotency-Key must be 1-128 visible characters"))?;
    let mut material = format!("{method} {path}\n").into_bytes();
    material.extend_from_slice(body);
    Ok(Some(Idempotency {
        key_id: principal.key_id.clone(),
        key: key.to_string(),
        fingerprint: auth::sha256_hex(&material),
    }))
}

fn write_reply(rid: &RequestId, result: Result<store::WriteOutcome>) -> Response {
    match result {
        Ok(out) => {
            let status = StatusCode::from_u16(out.status).unwrap_or(StatusCode::OK);
            let mut res = (status, Json(out.body)).into_response();
            if out.replayed {
                res.headers_mut().insert("idempotent-replayed", HeaderValue::from_static("true"));
            }
            res
        }
        Err(e) => reply(rid, Err(e)),
    }
}

// ---------------------------------------------------------------- health

async fn health() -> Json<Value> {
    Json(json!({ "status": "ok", "service": "aletheiadb", "version": VERSION }))
}

async fn ready(State(s): State<AppState>, Extension(rid): Extension<RequestId>) -> Response {
    let store = s.store.clone();
    let storage = blocking(move || store.ping()).await;
    let ok = storage.is_ok();
    let body = json!({
        "status": if ok { "ready" } else { "unavailable" },
        "version": VERSION,
        "uptimeSeconds": s.started.elapsed().as_secs(),
        "checks": {
            "storage": if ok { "ok" } else { "failed" },
            // The Git history mirror is a later phase; reported honestly until it exists.
            "history": "not_configured",
            "rootKey": if s.root_secret_sha256.is_some() { "configured" } else { "disabled" },
        },
        "requestId": rid.0,
    });
    (if ok { StatusCode::OK } else { StatusCode::SERVICE_UNAVAILABLE }, Json(body)).into_response()
}

async fn not_found(Extension(rid): Extension<RequestId>) -> Response {
    reply(&rid, Err(DbError::not_found("no such endpoint; see /health or the API reference")))
}

// ---------------------------------------------------------------- catalog

async fn whoami(State(s): State<AppState>, Extension(rid): Extension<RequestId>, headers: HeaderMap) -> Response {
    let r = async {
        let p = authenticate(&s, &headers).await?;
        Ok((
            StatusCode::OK,
            match p.scope {
                None => json!({ "keyId": "root", "role": "root" }),
                Some((db, role)) => json!({ "keyId": p.key_id, "database": db, "role": role }),
            },
        ))
    };
    reply(&rid, r.await)
}

async fn put_database(State(s): State<AppState>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path(db): Path<String>) -> Response {
    let r = async {
        authenticate(&s, &headers).await?.require_root()?;
        let store = s.store.clone();
        let (created, info) = blocking(move || store.create_database(&db)).await?;
        Ok((
            if created { StatusCode::CREATED } else { StatusCode::OK },
            json!({ "database": info, "created": created }),
        ))
    };
    reply(&rid, r.await)
}

async fn list_databases(State(s): State<AppState>, Extension(rid): Extension<RequestId>, headers: HeaderMap) -> Response {
    let r = async {
        let p = authenticate(&s, &headers).await?;
        let store = s.store.clone();
        let all = blocking(move || store.list_databases()).await?;
        let visible: Vec<_> = all.into_iter().filter(|d| p.require(&d.name, Role::Read).is_ok()).collect();
        Ok((StatusCode::OK, json!({ "databases": visible })))
    };
    reply(&rid, r.await)
}

async fn put_collection(
    State(s): State<AppState>,
    Extension(rid): Extension<RequestId>,
    headers: HeaderMap,
    Path((db, coll)): Path<(String, String)>,
    body: Bytes,
) -> Response {
    let r = async {
        query::check_name("database", &db)?;
        authenticate(&s, &headers).await?.require(&db, Role::Admin)?;
        let body = parse_body(&body)?;
        let append_only = body
            .get("appendOnly")
            .map(|v| v.as_bool().ok_or_else(|| DbError::invalid("appendOnly must be true or false")))
            .transpose()?
            .unwrap_or(false);
        let store = s.store.clone();
        let (created, info) = blocking(move || store.ensure_collection(&db, &coll, append_only)).await?;
        Ok((
            if created { StatusCode::CREATED } else { StatusCode::OK },
            json!({ "collection": info, "created": created }),
        ))
    };
    reply(&rid, r.await)
}

async fn list_collections(State(s): State<AppState>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path(db): Path<String>) -> Response {
    let r = async {
        query::check_name("database", &db)?;
        authenticate(&s, &headers).await?.require(&db, Role::Read)?;
        let store = s.store.clone();
        let list = blocking(move || store.list_collections(&db)).await?;
        Ok((StatusCode::OK, json!({ "collections": list })))
    };
    reply(&rid, r.await)
}

async fn put_index(
    State(s): State<AppState>,
    Extension(rid): Extension<RequestId>,
    headers: HeaderMap,
    Path((db, coll, field)): Path<(String, String, String)>,
    body: Bytes,
) -> Response {
    let r = async {
        query::check_name("database", &db)?;
        authenticate(&s, &headers).await?.require(&db, Role::Admin)?;
        let body = parse_body(&body)?;
        let unique = body
            .get("unique")
            .map(|v| v.as_bool().ok_or_else(|| DbError::invalid("unique must be true or false")))
            .transpose()?
            .unwrap_or(false);
        let store = s.store.clone();
        let (created, info) = blocking(move || store.create_index(&db, &coll, &field, unique)).await?;
        Ok((
            if created { StatusCode::CREATED } else { StatusCode::OK },
            json!({ "index": info, "created": created }),
        ))
    };
    reply(&rid, r.await)
}

async fn list_indexes(
    State(s): State<AppState>,
    Extension(rid): Extension<RequestId>,
    headers: HeaderMap,
    Path((db, coll)): Path<(String, String)>,
) -> Response {
    let r = async {
        query::check_name("database", &db)?;
        authenticate(&s, &headers).await?.require(&db, Role::Read)?;
        let store = s.store.clone();
        let list = blocking(move || store.list_indexes(&db, &coll)).await?;
        Ok((StatusCode::OK, json!({ "indexes": list })))
    };
    reply(&rid, r.await)
}

// ---------------------------------------------------------------- documents

async fn insert_document(
    State(s): State<AppState>,
    Extension(rid): Extension<RequestId>,
    method: Method,
    headers: HeaderMap,
    Path((db, coll)): Path<(String, String)>,
    raw: Bytes,
) -> Response {
    let r = async {
        query::check_name("database", &db)?;
        let p = authenticate(&s, &headers).await?;
        p.require(&db, Role::ReadWrite)?;
        let body = parse_body(&raw)?;
        let document = body
            .get("document")
            .cloned()
            .ok_or_else(|| DbError::invalid("body must be { \"document\": { ... } }"))?;
        let idem = idempotency(&headers, &p, &method, &format!("/v1/databases/{db}/collections/{coll}/documents"), &raw)?;
        let store = s.store.clone();
        blocking(move || {
            store.write(idem.as_ref(), |tx| {
                Ok((201, json!({ "document": store::insert_document(tx, &db, &coll, document)? })))
            })
        })
        .await
    };
    write_reply(&rid, r.await)
}

async fn get_document(
    State(s): State<AppState>,
    Extension(rid): Extension<RequestId>,
    headers: HeaderMap,
    Path((db, coll, id)): Path<(String, String, String)>,
) -> Response {
    let r = async {
        query::check_name("database", &db)?;
        check_id(&id)?;
        authenticate(&s, &headers).await?.require(&db, Role::Read)?;
        let store = s.store.clone();
        let doc = blocking(move || store.get(&db, &coll, &id)).await?;
        Ok((StatusCode::OK, json!({ "document": doc })))
    };
    reply(&rid, r.await)
}

async fn patch_document(
    State(s): State<AppState>,
    Extension(rid): Extension<RequestId>,
    method: Method,
    headers: HeaderMap,
    Path((db, coll, id)): Path<(String, String, String)>,
    raw: Bytes,
) -> Response {
    let r = async {
        query::check_name("database", &db)?;
        check_id(&id)?;
        let p = authenticate(&s, &headers).await?;
        p.require(&db, Role::ReadWrite)?;
        let body = parse_body(&raw)?;
        let rev = expected_rev(&body)?;
        let update = body
            .get("update")
            .cloned()
            .ok_or_else(|| DbError::invalid("body must include \"update\": { \"$set\": { ... } }"))?;
        let idem = idempotency(&headers, &p, &method, &format!("/v1/databases/{db}/collections/{coll}/documents/{id}"), &raw)?;
        let store = s.store.clone();
        blocking(move || {
            store.write(idem.as_ref(), |tx| {
                Ok((200, json!({ "document": store::update_document(tx, &db, &coll, &id, rev, &update)? })))
            })
        })
        .await
    };
    write_reply(&rid, r.await)
}

async fn replace_document(
    State(s): State<AppState>,
    Extension(rid): Extension<RequestId>,
    method: Method,
    headers: HeaderMap,
    Path((db, coll, id)): Path<(String, String, String)>,
    raw: Bytes,
) -> Response {
    let r = async {
        query::check_name("database", &db)?;
        check_id(&id)?;
        let p = authenticate(&s, &headers).await?;
        p.require(&db, Role::ReadWrite)?;
        let body = parse_body(&raw)?;
        let rev = expected_rev(&body)?;
        let document = body
            .get("document")
            .cloned()
            .ok_or_else(|| DbError::invalid("body must include \"document\": { ... }"))?;
        let idem = idempotency(&headers, &p, &method, &format!("/v1/databases/{db}/collections/{coll}/documents/{id}"), &raw)?;
        let store = s.store.clone();
        blocking(move || {
            store.write(idem.as_ref(), |tx| {
                Ok((200, json!({ "document": store::replace_document(tx, &db, &coll, &id, rev, document)? })))
            })
        })
        .await
    };
    write_reply(&rid, r.await)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RevParam {
    expected_rev: Option<u64>,
}

async fn delete_document(
    State(s): State<AppState>,
    Extension(rid): Extension<RequestId>,
    method: Method,
    headers: HeaderMap,
    Path((db, coll, id)): Path<(String, String, String)>,
    QueryParams(q): QueryParams<RevParam>,
) -> Response {
    let r = async {
        query::check_name("database", &db)?;
        check_id(&id)?;
        let p = authenticate(&s, &headers).await?;
        p.require(&db, Role::ReadWrite)?;
        let rev = q
            .expected_rev
            .filter(|r| *r >= 1)
            .ok_or_else(|| DbError::invalid("?expectedRev= (the revision you read) is required"))?;
        let path = format!("/v1/databases/{db}/collections/{coll}/documents/{id}?expectedRev={rev}");
        let idem = idempotency(&headers, &p, &method, &path, &Bytes::new())?;
        let store = s.store.clone();
        blocking(move || store.write(idem.as_ref(), |tx| Ok((200, store::delete_document(tx, &db, &coll, &id, rev)?)))).await
    };
    write_reply(&rid, r.await)
}

async fn find_documents(
    State(s): State<AppState>,
    Extension(rid): Extension<RequestId>,
    headers: HeaderMap,
    Path((db, coll)): Path<(String, String)>,
    raw: Bytes,
) -> Response {
    let r = async {
        query::check_name("database", &db)?;
        authenticate(&s, &headers).await?.require(&db, Role::Read)?;
        let body = parse_body(&raw)?;
        let limit = match body.get("limit") {
            None => 100,
            Some(v) => v
                .as_u64()
                .filter(|n| (1..=MAX_LIMIT as u64).contains(n))
                .ok_or_else(|| DbError::invalid(format!("limit must be 1-{MAX_LIMIT}")))? as usize,
        };
        let skip = match body.get("skip") {
            None => 0,
            Some(v) => v
                .as_u64()
                .filter(|n| *n <= MAX_SKIP as u64)
                .ok_or_else(|| DbError::invalid(format!("skip must be 0-{MAX_SKIP}")))? as usize,
        };
        let q = Query {
            filter: body.get("filter").cloned().unwrap_or_else(|| json!({})),
            sort: query::parse_sort(body.get("sort"))?,
            limit,
            skip,
        };
        let store = s.store.clone();
        let (docs, has_more) = blocking(move || store.find(&db, &coll, &q)).await?;
        Ok((StatusCode::OK, json!({ "documents": docs, "hasMore": has_more })))
    };
    reply(&rid, r.await)
}

async fn count_documents(
    State(s): State<AppState>,
    Extension(rid): Extension<RequestId>,
    headers: HeaderMap,
    Path((db, coll)): Path<(String, String)>,
    raw: Bytes,
) -> Response {
    let r = async {
        query::check_name("database", &db)?;
        authenticate(&s, &headers).await?.require(&db, Role::Read)?;
        let body = parse_body(&raw)?;
        let filter = body.get("filter").cloned().unwrap_or_else(|| json!({}));
        let store = s.store.clone();
        let n = blocking(move || store.count(&db, &coll, &filter)).await?;
        Ok((StatusCode::OK, json!({ "count": n })))
    };
    reply(&rid, r.await)
}

// ---------------------------------------------------------------- atomic commit

fn op_string(op: &Value, i: usize, field: &str) -> Result<String> {
    op.get(field)
        .and_then(Value::as_str)
        .map(str::to_string)
        .ok_or_else(|| DbError::invalid(format!("operation {i}: \"{field}\" is required")))
}

fn op_rev(op: &Value, i: usize) -> Result<u64> {
    expected_rev(op).map_err(|e| e.at_operation(i))
}

fn parse_operation(op: &Value, i: usize) -> Result<store::Operation> {
    let collection = op_string(op, i, "collection")?;
    query::check_name("collection", &collection).map_err(|e| e.at_operation(i))?;
    let id = || -> Result<String> {
        let id = op_string(op, i, "id")?;
        check_id(&id).map_err(|e| e.at_operation(i))?;
        Ok(id)
    };
    let object = |field: &str| -> Result<Value> {
        op.get(field)
            .filter(|v| v.is_object())
            .cloned()
            .ok_or_else(|| DbError::invalid(format!("operation {i}: \"{field}\" must be an object")))
    };
    Ok(match op_string(op, i, "op")?.as_str() {
        "insert" => store::Operation::Insert {
            collection,
            document: object("document")?,
        },
        "update" => store::Operation::Update {
            collection,
            id: id()?,
            expected_rev: op_rev(op, i)?,
            update: object("update")?,
        },
        "replace" => store::Operation::Replace {
            collection,
            id: id()?,
            expected_rev: op_rev(op, i)?,
            document: object("document")?,
        },
        "delete" => store::Operation::Delete {
            collection,
            id: id()?,
            expected_rev: op_rev(op, i)?,
        },
        "check" => store::Operation::Check {
            collection,
            id: id()?,
            expected_rev: op_rev(op, i)?,
        },
        other => return Err(DbError::invalid(format!("operation {i}: unknown op '{other}'"))),
    })
}

/// Applies up to `MAX_COMMIT_OPERATIONS` writes in one transaction: all of them, or none.
async fn commit(
    State(s): State<AppState>,
    Extension(rid): Extension<RequestId>,
    method: Method,
    headers: HeaderMap,
    Path(db): Path<String>,
    raw: Bytes,
) -> Response {
    let r = async {
        query::check_name("database", &db)?;
        let p = authenticate(&s, &headers).await?;
        p.require(&db, Role::ReadWrite)?;
        let body = parse_body(&raw)?;
        let list = body
            .get("operations")
            .and_then(Value::as_array)
            .filter(|ops| !ops.is_empty())
            .ok_or_else(|| DbError::invalid("body must be { \"operations\": [ ... ] } with at least one operation"))?;
        if list.len() > store::MAX_COMMIT_OPERATIONS {
            return Err(DbError::invalid(format!(
                "a commit may hold at most {} operations",
                store::MAX_COMMIT_OPERATIONS
            )));
        }
        let ops = list.iter().enumerate().map(|(i, op)| parse_operation(op, i)).collect::<Result<Vec<_>>>()?;
        let idem = idempotency(&headers, &p, &method, &format!("/v1/databases/{db}/commit"), &raw)?;
        let store = s.store.clone();
        blocking(move || {
            store.write(idem.as_ref(), |tx| {
                let results = store::apply_operations(tx, &db, ops)?;
                Ok((200, json!({ "results": results })))
            })
        })
        .await
    };
    write_reply(&rid, r.await)
}

// ---------------------------------------------------------------- api keys (root only)

async fn create_key(State(s): State<AppState>, Extension(rid): Extension<RequestId>, headers: HeaderMap, raw: Bytes) -> Response {
    let r = async {
        authenticate(&s, &headers).await?.require_root()?;
        let body = parse_body(&raw)?;
        let name = body
            .get("name")
            .and_then(Value::as_str)
            .filter(|n| !n.is_empty() && n.len() <= 100)
            .ok_or_else(|| DbError::invalid("name (1-100 characters) is required"))?
            .to_string();
        let database = body
            .get("database")
            .and_then(Value::as_str)
            .ok_or_else(|| DbError::invalid("database is required"))?
            .to_string();
        query::check_name("database", &database)?;
        let role = Role::parse(body.get("role").and_then(Value::as_str).unwrap_or(""))?;
        let (id, secret) = (auth::new_key_id(), auth::new_secret());
        let record = KeyRecord {
            id: id.clone(),
            name,
            database,
            role,
            secret_sha256: auth::sha256_hex(secret.as_bytes()),
            created_at: time::now_rfc3339(),
        };
        let store = s.store.clone();
        let stored = record.clone();
        blocking(move || {
            if !store.list_databases()?.iter().any(|d| d.name == stored.database) {
                return Err(DbError::not_found(format!("database '{}' does not exist", stored.database)));
            }
            store.put_key(&stored)
        })
        .await?;
        Ok((
            StatusCode::CREATED,
            json!({
                "id": id,
                "key": format!("{id}.{secret}"),
                "name": record.name,
                "database": record.database,
                "role": record.role,
                "createdAt": record.created_at,
                "note": "Store this key now. It is not shown again; only its hash is kept.",
            }),
        ))
    };
    reply(&rid, r.await)
}

async fn list_keys(State(s): State<AppState>, Extension(rid): Extension<RequestId>, headers: HeaderMap) -> Response {
    let r = async {
        authenticate(&s, &headers).await?.require_root()?;
        let store = s.store.clone();
        let keys = blocking(move || store.list_keys()).await?;
        let visible: Vec<_> = keys
            .into_iter()
            .map(|k| json!({ "id": k.id, "name": k.name, "database": k.database, "role": k.role, "createdAt": k.created_at }))
            .collect();
        Ok((StatusCode::OK, json!({ "keys": visible })))
    };
    reply(&rid, r.await)
}

async fn delete_key(State(s): State<AppState>, Extension(rid): Extension<RequestId>, headers: HeaderMap, Path(id): Path<String>) -> Response {
    let r = async {
        authenticate(&s, &headers).await?.require_root()?;
        let store = s.store.clone();
        let key_id = id.clone();
        if !blocking(move || store.delete_key(&key_id)).await? {
            return Err(DbError::not_found(format!("no key '{id}'")));
        }
        Ok((StatusCode::OK, json!({ "id": id, "revoked": true })))
    };
    reply(&rid, r.await)
}
