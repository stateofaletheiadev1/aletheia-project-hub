//! End-to-end tests through the HTTP router, against a real database file.

use std::sync::Arc;
use std::time::Instant;

use aletheiadb::api::{AppState, router};
use aletheiadb::auth::sha256_hex;
use aletheiadb::store::Store;
use axum::Router;
use axum::body::Body;
use axum::http::{Request, StatusCode};
use http_body_util::BodyExt;
use serde_json::{Value, json};
use tower::ServiceExt;

const ROOT_SECRET: &str = "test-root-secret-0123456789abcdef";

struct Harness {
    app: Router,
    _dir: tempfile::TempDir,
    path: std::path::PathBuf,
}

fn harness() -> Harness {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("aletheia.redb");
    let store = Arc::new(Store::open(&path, 8 * 1024 * 1024).unwrap());
    let app = router(AppState {
        store,
        root_secret_sha256: Some(sha256_hex(ROOT_SECRET.as_bytes())),
        started: Instant::now(),
    });
    Harness { app, _dir: dir, path }
}

fn root() -> String {
    format!("root.{ROOT_SECRET}")
}

async fn call(
    app: &Router,
    method: &str,
    uri: &str,
    key: Option<&str>,
    body: Option<Value>,
    extra: &[(&str, &str)],
) -> (StatusCode, Value, axum::http::HeaderMap) {
    let mut req = Request::builder().method(method).uri(uri);
    if let Some(k) = key {
        req = req.header("authorization", format!("Bearer {k}"));
    }
    for (h, v) in extra {
        req = req.header(*h, *v);
    }
    let req = match body {
        Some(b) => req.header("content-type", "application/json").body(Body::from(b.to_string())).unwrap(),
        None => req.body(Body::empty()).unwrap(),
    };
    let res = app.clone().oneshot(req).await.unwrap();
    let (status, headers) = (res.status(), res.headers().clone());
    let bytes = res.into_body().collect().await.unwrap().to_bytes();
    let json = if bytes.is_empty() {
        Value::Null
    } else {
        serde_json::from_slice(&bytes).unwrap_or(Value::String(String::from_utf8_lossy(&bytes).into()))
    };
    (status, json, headers)
}

async fn setup_gov(app: &Router) {
    let r = root();
    assert_eq!(call(app, "PUT", "/v1/databases/gov", Some(&r), None, &[]).await.0, StatusCode::CREATED);
    assert_eq!(
        call(app, "PUT", "/v1/databases/gov/collections/people", Some(&r), None, &[]).await.0,
        StatusCode::CREATED
    );
}

async fn key_for(app: &Router, role: &str) -> String {
    let (s, body, _) = call(
        app,
        "POST",
        "/v1/keys",
        Some(&root()),
        Some(json!({"name": format!("{role} key"), "database": "gov", "role": role})),
        &[],
    )
    .await;
    assert_eq!(s, StatusCode::CREATED, "{body}");
    body["key"].as_str().unwrap().to_string()
}

#[tokio::test]
async fn health_is_public_and_honest() {
    let h = harness();
    let (s, body, headers) = call(&h.app, "GET", "/health", None, None, &[]).await;
    assert_eq!(s, StatusCode::OK);
    assert_eq!(body["status"], "ok");
    assert!(headers.contains_key("x-request-id"));
    let (s, body, _) = call(&h.app, "GET", "/health/ready", None, None, &[("x-request-id", "abc-123")]).await;
    assert_eq!(s, StatusCode::OK);
    assert_eq!(body["checks"]["history"], "not_configured");
    assert_eq!(body["requestId"], "abc-123");
}

#[tokio::test]
async fn authentication_and_scopes_are_enforced() {
    let h = harness();
    let (s, body, _) = call(&h.app, "GET", "/v1/databases", None, None, &[]).await;
    assert_eq!(s, StatusCode::UNAUTHORIZED);
    assert_eq!(body["error"]["code"], "Unauthorized");
    assert_eq!(
        call(&h.app, "GET", "/v1/databases", Some("root.wrong-secret-0123456789"), None, &[]).await.0,
        StatusCode::UNAUTHORIZED
    );

    setup_gov(&h.app).await;
    call(&h.app, "PUT", "/v1/databases/other", Some(&root()), None, &[]).await;
    let reader = key_for(&h.app, "read").await;
    let writer = key_for(&h.app, "readWrite").await;

    // A scoped key sees only its database, and cannot create databases or keys.
    let (_, body, _) = call(&h.app, "GET", "/v1/databases", Some(&reader), None, &[]).await;
    assert_eq!(body["databases"].as_array().unwrap().len(), 1);
    assert_eq!(call(&h.app, "PUT", "/v1/databases/x", Some(&writer), None, &[]).await.0, StatusCode::FORBIDDEN);
    assert_eq!(call(&h.app, "GET", "/v1/keys", Some(&writer), None, &[]).await.0, StatusCode::FORBIDDEN);
    assert_eq!(
        call(&h.app, "GET", "/v1/databases/other/collections", Some(&writer), None, &[]).await.0,
        StatusCode::FORBIDDEN
    );
    // Read keys cannot write; write keys cannot manage collections.
    let doc = json!({"document": {"name": "Ada"}});
    assert_eq!(
        call(
            &h.app,
            "POST",
            "/v1/databases/gov/collections/people/documents",
            Some(&reader),
            Some(doc.clone()),
            &[]
        )
        .await
        .0,
        StatusCode::FORBIDDEN
    );
    assert_eq!(
        call(&h.app, "PUT", "/v1/databases/gov/collections/new", Some(&writer), None, &[]).await.0,
        StatusCode::FORBIDDEN
    );
    assert_eq!(
        call(&h.app, "POST", "/v1/databases/gov/collections/people/documents", Some(&writer), Some(doc), &[])
            .await
            .0,
        StatusCode::CREATED
    );
    let (_, who, _) = call(&h.app, "GET", "/v1/whoami", Some(&writer), None, &[]).await;
    assert_eq!(who["role"], "readWrite");

    // Revoked keys stop working immediately.
    let id = writer.split('.').next().unwrap();
    assert_eq!(
        call(&h.app, "DELETE", &format!("/v1/keys/{id}"), Some(&root()), None, &[]).await.0,
        StatusCode::OK
    );
    assert_eq!(call(&h.app, "GET", "/v1/whoami", Some(&writer), None, &[]).await.0, StatusCode::UNAUTHORIZED);
    // The listing never exposes secrets or hashes.
    let (_, keys, _) = call(&h.app, "GET", "/v1/keys", Some(&root()), None, &[]).await;
    assert!(!keys.to_string().contains("secret"));
}

#[tokio::test]
async fn documents_have_revisions_and_crud_works() {
    let h = harness();
    setup_gov(&h.app).await;
    let w = key_for(&h.app, "readWrite").await;
    let base = "/v1/databases/gov/collections/people/documents";

    let (s, created, _) = call(&h.app, "POST", base, Some(&w), Some(json!({"document": {"name": "Ada", "age": 36}})), &[]).await;
    assert_eq!(s, StatusCode::CREATED);
    let doc = &created["document"];
    let id = doc["_id"].as_str().unwrap();
    assert_eq!(doc["_rev"], 1);
    assert!(doc["_createdAt"].as_str().unwrap().ends_with('Z'));

    let (s, got, _) = call(&h.app, "GET", &format!("{base}/{id}"), Some(&w), None, &[]).await;
    assert_eq!((s, &got["document"]["name"]), (StatusCode::OK, &json!("Ada")));

    let (s, patched, _) = call(
        &h.app,
        "PATCH",
        &format!("{base}/{id}"),
        Some(&w),
        Some(json!({"expectedRev": 1, "update": {"$set": {"city": "Antioch"}, "$inc": {"age": 1}}})),
        &[],
    )
    .await;
    assert_eq!(s, StatusCode::OK);
    assert_eq!(patched["document"]["_rev"], 2);
    assert_eq!(patched["document"]["age"], 37);
    assert_eq!(patched["document"]["_createdAt"], doc["_createdAt"]);

    // A stale revision is refused, never silently overwritten.
    let (s, err, _) = call(
        &h.app,
        "PATCH",
        &format!("{base}/{id}"),
        Some(&w),
        Some(json!({"expectedRev": 1, "update": {"$set": {"x": 1}}})),
        &[],
    )
    .await;
    assert_eq!(s, StatusCode::CONFLICT);
    assert_eq!(err["error"]["code"], "Conflict");

    let (s, replaced, _) = call(
        &h.app,
        "PUT",
        &format!("{base}/{id}"),
        Some(&w),
        Some(json!({"expectedRev": 2, "document": {"name": "Ada L."}})),
        &[],
    )
    .await;
    assert_eq!(s, StatusCode::OK);
    assert_eq!(replaced["document"]["_rev"], 3);
    assert!(replaced["document"].get("age").is_none());

    // Reserved fields cannot be written.
    let (s, _, _) = call(&h.app, "POST", base, Some(&w), Some(json!({"document": {"_rev": 99}})), &[]).await;
    assert_eq!(s, StatusCode::BAD_REQUEST);

    assert_eq!(
        call(&h.app, "DELETE", &format!("{base}/{id}?expectedRev=2"), Some(&w), None, &[]).await.0,
        StatusCode::CONFLICT
    );
    assert_eq!(
        call(&h.app, "DELETE", &format!("{base}/{id}?expectedRev=3"), Some(&w), None, &[]).await.0,
        StatusCode::OK
    );
    let (s, err, _) = call(&h.app, "GET", &format!("{base}/{id}"), Some(&w), None, &[]).await;
    assert_eq!((s, &err["error"]["code"]), (StatusCode::NOT_FOUND, &json!("NotFound")));
}

#[tokio::test]
async fn queries_filter_sort_page_and_count() {
    let h = harness();
    setup_gov(&h.app).await;
    let w = key_for(&h.app, "readWrite").await;
    for (name, age, city) in [
        ("Ada", 36, "Antioch"),
        ("Bob", 41, "Rome"),
        ("Cy", 29, "Antioch"),
        ("Di", 50, "Lagos"),
        ("Ed", 33, "Antioch"),
    ] {
        call(
            &h.app,
            "POST",
            "/v1/databases/gov/collections/people/documents",
            Some(&w),
            Some(json!({"document": {"name": name, "age": age, "city": city}})),
            &[],
        )
        .await;
    }
    let q = "/v1/databases/gov/collections/people/query";
    let (s, page, _) = call(
        &h.app,
        "POST",
        q,
        Some(&w),
        Some(json!({"filter": {"city": "Antioch"}, "sort": {"age": -1}, "limit": 2})),
        &[],
    )
    .await;
    assert_eq!(s, StatusCode::OK);
    let names: Vec<_> = page["documents"].as_array().unwrap().iter().map(|d| d["name"].as_str().unwrap()).collect();
    assert_eq!(names, ["Ada", "Ed"]);
    assert_eq!(page["hasMore"], true);

    let (_, page2, _) = call(
        &h.app,
        "POST",
        q,
        Some(&w),
        Some(json!({"filter": {"city": "Antioch"}, "sort": {"age": -1}, "limit": 2, "skip": 2})),
        &[],
    )
    .await;
    assert_eq!(page2["documents"][0]["name"], "Cy");
    assert_eq!(page2["hasMore"], false);

    let (_, c, _) = call(
        &h.app,
        "POST",
        "/v1/databases/gov/collections/people/count",
        Some(&w),
        Some(json!({"filter": {"age": {"$gte": 33, "$lt": 50}}})),
        &[],
    )
    .await;
    assert_eq!(c["count"], 3);

    let (s, err, _) = call(&h.app, "POST", q, Some(&w), Some(json!({"filter": {"$where": "1"}})), &[]).await;
    assert_eq!((s, &err["error"]["code"]), (StatusCode::BAD_REQUEST, &json!("Invalid")));
    assert_eq!(
        call(&h.app, "POST", q, Some(&w), Some(json!({"limit": 5000})), &[]).await.0,
        StatusCode::BAD_REQUEST
    );
}

#[tokio::test]
async fn indexes_answer_queries_and_enforce_uniqueness() {
    let h = harness();
    setup_gov(&h.app).await;
    let w = key_for(&h.app, "readWrite").await;
    let base = "/v1/databases/gov/collections/people";
    for (email, tags) in [("a@x.org", json!(["x", "y"])), ("b@x.org", json!(["y"])), ("c@x.org", json!([]))] {
        call(
            &h.app,
            "POST",
            &format!("{base}/documents"),
            Some(&w),
            Some(json!({"document": {"email": email, "tags": tags}})),
            &[],
        )
        .await;
    }
    // Indexes built over existing documents; arrays index each element.
    assert_eq!(
        call(
            &h.app,
            "PUT",
            &format!("{base}/indexes/email"),
            Some(&root()),
            Some(json!({"unique": true})),
            &[]
        )
        .await
        .0,
        StatusCode::CREATED
    );
    assert_eq!(
        call(&h.app, "PUT", &format!("{base}/indexes/tags"), Some(&root()), None, &[]).await.0,
        StatusCode::CREATED
    );
    assert_eq!(
        call(
            &h.app,
            "PUT",
            &format!("{base}/indexes/email"),
            Some(&root()),
            Some(json!({"unique": true})),
            &[]
        )
        .await
        .0,
        StatusCode::OK
    );
    assert_eq!(
        call(
            &h.app,
            "PUT",
            &format!("{base}/indexes/email"),
            Some(&root()),
            Some(json!({"unique": false})),
            &[]
        )
        .await
        .0,
        StatusCode::CONFLICT
    );

    let (_, r, _) = call(
        &h.app,
        "POST",
        &format!("{base}/query"),
        Some(&w),
        Some(json!({"filter": {"tags": "y"}, "sort": {"email": 1}})),
        &[],
    )
    .await;
    let emails: Vec<_> = r["documents"].as_array().unwrap().iter().map(|d| d["email"].as_str().unwrap()).collect();
    assert_eq!(emails, ["a@x.org", "b@x.org"]);
    let (_, r, _) = call(
        &h.app,
        "POST",
        &format!("{base}/query"),
        Some(&w),
        Some(json!({"filter": {"email": {"$in": ["c@x.org", "z@x.org"]}}})),
        &[],
    )
    .await;
    assert_eq!(r["documents"].as_array().unwrap().len(), 1);

    // Unique: duplicates refused on insert and on update.
    let (s, err, _) = call(
        &h.app,
        "POST",
        &format!("{base}/documents"),
        Some(&w),
        Some(json!({"document": {"email": "a@x.org"}})),
        &[],
    )
    .await;
    assert_eq!((s, &err["error"]["code"]), (StatusCode::CONFLICT, &json!("Conflict")));
    let (_, c, _) = call(
        &h.app,
        "POST",
        &format!("{base}/query"),
        Some(&w),
        Some(json!({"filter": {"email": "c@x.org"}})),
        &[],
    )
    .await;
    let c = &c["documents"][0];
    let (s, _, _) = call(
        &h.app,
        "PATCH",
        &format!("{base}/documents/{}", c["_id"].as_str().unwrap()),
        Some(&w),
        Some(json!({"expectedRev": 1, "update": {"$set": {"email": "b@x.org"}}})),
        &[],
    )
    .await;
    assert_eq!(s, StatusCode::CONFLICT);
    // Changing the value frees the old one.
    let (s, _, _) = call(
        &h.app,
        "PATCH",
        &format!("{base}/documents/{}", c["_id"].as_str().unwrap()),
        Some(&w),
        Some(json!({"expectedRev": 1, "update": {"$set": {"email": "c2@x.org"}}})),
        &[],
    )
    .await;
    assert_eq!(s, StatusCode::OK);
    assert_eq!(
        call(
            &h.app,
            "POST",
            &format!("{base}/documents"),
            Some(&w),
            Some(json!({"document": {"email": "c@x.org"}})),
            &[]
        )
        .await
        .0,
        StatusCode::CREATED
    );
}

#[tokio::test]
async fn idempotent_retries_write_once() {
    let h = harness();
    setup_gov(&h.app).await;
    let w = key_for(&h.app, "readWrite").await;
    let url = "/v1/databases/gov/collections/people/documents";
    let body = json!({"document": {"form": "interest", "name": "Ada"}});
    let (s1, first, _) = call(&h.app, "POST", url, Some(&w), Some(body.clone()), &[("idempotency-key", "form-123")]).await;
    let (s2, second, headers) = call(&h.app, "POST", url, Some(&w), Some(body), &[("idempotency-key", "form-123")]).await;
    assert_eq!((s1, s2), (StatusCode::CREATED, StatusCode::CREATED));
    assert_eq!(first["document"]["_id"], second["document"]["_id"]);
    assert_eq!(headers.get("idempotent-replayed").unwrap(), "true");
    let (_, c, _) = call(&h.app, "POST", "/v1/databases/gov/collections/people/count", Some(&w), None, &[]).await;
    assert_eq!(c["count"], 1);
    // Same key, different request: refused.
    let (s, _, _) = call(
        &h.app,
        "POST",
        url,
        Some(&w),
        Some(json!({"document": {"name": "Other"}})),
        &[("idempotency-key", "form-123")],
    )
    .await;
    assert_eq!(s, StatusCode::CONFLICT);
}

#[tokio::test]
async fn concurrent_writers_cannot_both_win() {
    let h = harness();
    setup_gov(&h.app).await;
    let w = key_for(&h.app, "readWrite").await;
    let (_, created, _) = call(
        &h.app,
        "POST",
        "/v1/databases/gov/collections/people/documents",
        Some(&w),
        Some(json!({"document": {"n": 0}})),
        &[],
    )
    .await;
    let url = format!(
        "/v1/databases/gov/collections/people/documents/{}",
        created["document"]["_id"].as_str().unwrap()
    );
    let tasks: Vec<_> = (0..8)
        .map(|i| {
            let (app, url, w) = (h.app.clone(), url.clone(), w.clone());
            tokio::spawn(async move {
                call(
                    &app,
                    "PATCH",
                    &url,
                    Some(&w),
                    Some(json!({"expectedRev": 1, "update": {"$set": {"winner": i}}})),
                    &[],
                )
                .await
                .0
            })
        })
        .collect();
    let mut ok = 0;
    for t in tasks {
        match t.await.unwrap() {
            StatusCode::OK => ok += 1,
            StatusCode::CONFLICT => {}
            other => panic!("unexpected {other}"),
        }
    }
    assert_eq!(ok, 1, "exactly one writer with revision 1 may succeed");
}

#[tokio::test]
async fn data_survives_a_restart() {
    let h = harness();
    setup_gov(&h.app).await;
    let w = key_for(&h.app, "readWrite").await;
    call(
        &h.app,
        "POST",
        "/v1/databases/gov/collections/people/documents",
        Some(&w),
        Some(json!({"document": {"kept": true}})),
        &[],
    )
    .await;
    let path = h.path.clone();
    drop(h.app);
    let store = Arc::new(Store::open(&path, 8 * 1024 * 1024).unwrap());
    let app = router(AppState {
        store,
        root_secret_sha256: Some(sha256_hex(ROOT_SECRET.as_bytes())),
        started: Instant::now(),
    });
    let (_, r, _) = call(
        &app,
        "POST",
        "/v1/databases/gov/collections/people/query",
        Some(&w),
        Some(json!({"filter": {"kept": true}})),
        &[],
    )
    .await;
    assert_eq!(r["documents"].as_array().unwrap().len(), 1, "documents and API keys persist");
}

#[tokio::test]
async fn unknown_things_are_reported_clearly() {
    let h = harness();
    setup_gov(&h.app).await;
    let (s, err, _) = call(&h.app, "GET", "/v1/databases/gov/collections/nope/documents/abc", Some(&root()), None, &[]).await;
    assert_eq!(s, StatusCode::NOT_FOUND);
    assert!(err["error"]["message"].as_str().unwrap().contains("create it first"));
    assert_eq!(call(&h.app, "GET", "/nothing", None, None, &[]).await.0, StatusCode::NOT_FOUND);
    assert_eq!(
        call(&h.app, "PUT", "/v1/databases/Bad%20Name", Some(&root()), None, &[]).await.0,
        StatusCode::BAD_REQUEST
    );
    let (s, _, _) = call(
        &h.app,
        "POST",
        "/v1/databases/gov/collections/people/documents",
        Some(&root()),
        Some(json!({"document": [1, 2]})),
        &[],
    )
    .await;
    assert_eq!(s, StatusCode::BAD_REQUEST);
}
