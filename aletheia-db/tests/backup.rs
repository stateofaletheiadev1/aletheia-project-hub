//! Online backups (ADR 0004): a backup restores to the same data, stays consistent while writes
//! continue, rotates, detects tampering, and is reachable over the API by the root key only.

use std::sync::Arc;
use std::time::{Duration, Instant};

use aletheiadb::api::{AppState, router};
use aletheiadb::auth::sha256_hex;
use aletheiadb::backup::{self, Schedule};
use aletheiadb::store::{self, Store};
use axum::body::Body;
use axum::http::{Request, StatusCode};
use http_body_util::BodyExt;
use serde_json::{Value, json};
use tower::ServiceExt;

const ROOT_SECRET: &str = "test-root-secret-0123456789abcdef";

fn open(dir: &std::path::Path) -> Arc<Store> {
    Arc::new(Store::open(&dir.join("aletheia.redb"), 8 * 1024 * 1024).unwrap())
}

fn insert(store: &Store, n: usize) -> Vec<String> {
    let mut ids = Vec::new();
    for i in 0..n {
        let outcome = store
            .write(None, |tx| {
                let doc = store::insert_document(tx, "gov", "records", json!({ "n": i, "title": format!("record {i}") }))?;
                Ok((201, doc))
            })
            .unwrap();
        ids.push(outcome.body["_id"].as_str().unwrap().to_owned());
    }
    ids
}

fn seeded(dir: &std::path::Path) -> (Arc<Store>, Vec<String>) {
    let store = open(dir);
    store.create_database("gov").unwrap();
    store.ensure_collection("gov", "records", false).unwrap();
    let ids = insert(&store, 250);
    (store, ids)
}

#[test]
fn a_backup_restores_to_the_same_documents() {
    let data = tempfile::tempdir().unwrap();
    let out = tempfile::tempdir().unwrap();
    let (store, ids) = seeded(data.path());

    let manifest = backup::run(&store, out.path(), 7).unwrap();
    let docs = manifest.rows.iter().find(|(t, _)| t == "documents").unwrap().1;
    assert_eq!(docs, 250);
    assert_eq!(manifest.format, 1);
    let file = out.path().join(&manifest.file);
    assert_eq!(backup::verify(&file).unwrap(), manifest);

    // Restore: the backup file opens as a database and holds the same records.
    let restored = Store::open(&file, 8 * 1024 * 1024).unwrap();
    for id in [&ids[0], &ids[124], &ids[249]] {
        assert_eq!(restored.get("gov", "records", id).unwrap(), store.get("gov", "records", id).unwrap());
    }
    assert_eq!(backup::list(out.path()).unwrap(), vec![manifest]);
}

#[test]
fn a_backup_is_a_consistent_snapshot_while_writes_continue() {
    let data = tempfile::tempdir().unwrap();
    let out = tempfile::tempdir().unwrap();
    let (store, _) = seeded(data.path());

    let writer = {
        let store = store.clone();
        std::thread::spawn(move || insert(&store, 400))
    };
    let mut manifests = Vec::new();
    for _ in 0..3 {
        manifests.push(backup::run(&store, out.path(), 10).unwrap());
    }
    writer.join().unwrap();

    for m in &manifests {
        // Each verified (run checks the copy against the snapshot) and re-verifies offline.
        backup::verify(&out.path().join(&m.file)).unwrap();
        let docs = m.rows.iter().find(|(t, _)| t == "documents").unwrap().1;
        assert!((250..=650).contains(&docs), "{docs} documents");
        // A snapshot never holds a document without its catalog entry: the collection's
        // count in the restored file matches the documents table.
        let restored = Store::open(&out.path().join(&m.file), 8 * 1024 * 1024).unwrap();
        assert_eq!(restored.count("gov", "records", &json!({})).unwrap() as u64, docs);
    }
    let counts: Vec<u64> = manifests.iter().map(|m| m.rows.iter().find(|(t, _)| t == "documents").unwrap().1).collect();
    assert!(counts.windows(2).all(|w| w[0] <= w[1]), "later backups hold at least as much: {counts:?}");
}

#[test]
fn old_backups_rotate_out_and_foreign_files_are_left_alone() {
    let data = tempfile::tempdir().unwrap();
    let out = tempfile::tempdir().unwrap();
    let (store, _) = seeded(data.path());
    std::fs::write(out.path().join("notes.txt"), "operator's file").unwrap();

    let mut made = Vec::new();
    for _ in 0..4 {
        made.push(backup::run(&store, out.path(), 2).unwrap().file);
        std::thread::sleep(Duration::from_millis(5));
    }
    let left: Vec<String> = backup::list(out.path()).unwrap().into_iter().map(|m| m.file).collect();
    assert_eq!(left, made[2..].to_vec(), "the two newest remain");
    assert!(!out.path().join(&made[0]).exists());
    assert!(out.path().join("notes.txt").exists());
    // No partial files are left behind.
    let partials = std::fs::read_dir(out.path())
        .unwrap()
        .flatten()
        .filter(|e| e.file_name().to_string_lossy().ends_with(".partial"))
        .count();
    assert_eq!(partials, 0);
}

#[test]
fn a_changed_backup_or_manifest_fails_verification() {
    let data = tempfile::tempdir().unwrap();
    let out = tempfile::tempdir().unwrap();
    let (store, _) = seeded(data.path());
    let manifest = backup::run(&store, out.path(), 7).unwrap();
    let file = out.path().join(&manifest.file);
    let manifest_path = file.with_extension("json");

    // A manifest claiming different content.
    let mut forged = manifest.clone();
    forged.content_sha256 = "0".repeat(64);
    std::fs::write(&manifest_path, serde_json::to_vec(&forged).unwrap()).unwrap();
    assert!(backup::verify(&file).is_err());

    // The real manifest, but a database with one more document.
    std::fs::write(&manifest_path, serde_json::to_vec(&manifest).unwrap()).unwrap();
    {
        let changed = Store::open(&file, 8 * 1024 * 1024).unwrap();
        insert(&changed, 1);
    }
    assert!(backup::verify(&file).is_err());
}

async fn call(app: &axum::Router, method: &str, key: Option<&str>) -> (StatusCode, Value) {
    let mut req = Request::builder().method(method).uri("/v1/admin/backups");
    if let Some(k) = key {
        req = req.header("authorization", format!("Bearer {k}"));
    }
    let res = app.clone().oneshot(req.body(Body::empty()).unwrap()).await.unwrap();
    let status = res.status();
    let bytes = res.into_body().collect().await.unwrap().to_bytes();
    (status, serde_json::from_slice(&bytes).unwrap_or(Value::Null))
}

fn app(store: Arc<Store>, backups: Option<Arc<Schedule>>) -> axum::Router {
    router(AppState {
        store,
        root_secret_sha256: Some(sha256_hex(ROOT_SECRET.as_bytes())),
        started: Instant::now(),
        backups,
    })
}

#[tokio::test]
async fn backups_over_the_api_need_the_root_key() {
    let data = tempfile::tempdir().unwrap();
    let out = tempfile::tempdir().unwrap();
    let (store, _) = seeded(data.path());
    let schedule = Arc::new(Schedule {
        dir: out.path().to_path_buf(),
        every: Duration::from_secs(3600),
        keep: 3,
        running: tokio::sync::Mutex::new(()),
    });
    let root = format!("root.{ROOT_SECRET}");
    let api = app(store.clone(), Some(schedule.clone()));

    assert_eq!(call(&api, "POST", None).await.0, StatusCode::UNAUTHORIZED);
    let (status, made) = call(&api, "POST", Some(&root)).await;
    assert_eq!(status, StatusCode::CREATED, "{made}");
    assert!(made["file"].as_str().unwrap().starts_with("aletheia-"));
    let (status, listed) = call(&api, "GET", Some(&root)).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(listed["keep"], 3);
    assert_eq!(listed["backups"][0]["file"], made["file"]);

    // While one runs, a second request is refused rather than queued.
    let guard = schedule.running.lock().await;
    assert_eq!(call(&api, "POST", Some(&root)).await.0, StatusCode::CONFLICT);
    drop(guard);

    // Without a backup directory the endpoints say so.
    let none = app(store, None);
    assert_eq!(call(&none, "GET", Some(&root)).await.0, StatusCode::SERVICE_UNAVAILABLE);
}
