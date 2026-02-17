use celestia_rpc::prelude::*;
use celestia_rpc::{Client, TxConfig};
use celestia_types::nmt::Namespace;
use celestia_types::{AppVersion, Blob};
use jsonrpsee::server::{ServerBuilder, ServerHandle};
use jsonrpsee_core::client::Error as RpcError;
use jsonrpsee_types::error::{INVALID_PARAMS_CODE, METHOD_NOT_FOUND_CODE};
use celestia_rpc::{BlobRpcServer, HeaderRpcServer, ShareRpcServer};
use localestia::rpc::LocalestiaServer;
use localestia::storage::RedisStorage;
use once_cell::sync::Lazy;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::{Mutex, MutexGuard};

static TEST_LOCK: Lazy<Mutex<()>> = Lazy::new(|| Mutex::new(()));

const DEFAULT_REDIS_URL: &str = "redis://127.0.0.1:6379";

pub struct TestContext {
    pub client: Client,
    pub storage: Arc<RedisStorage>,
    _server: ServerHandle,
    _lock: MutexGuard<'static, ()>,
}

impl Drop for TestContext {
    fn drop(&mut self) {
        let _ = self._server.stop();
    }
}

pub async fn setup() -> TestContext {
    let lock = TEST_LOCK.lock().await;
    let redis_url = std::env::var("REDIS_URL").unwrap_or_else(|_| DEFAULT_REDIS_URL.to_string());

    let storage = Arc::new(RedisStorage::new(&redis_url).expect("failed to create Redis storage"));
    storage.connect().await.expect("failed to connect to Redis");
    storage
        .clear_database()
        .await
        .expect("failed to clear Redis database");

    let addr: SocketAddr = "127.0.0.1:0".parse().expect("failed to parse bind address");
    let server = ServerBuilder::default()
        .build(addr)
        .await
        .expect("failed to build JSON-RPC server");
    let local_addr = server.local_addr().expect("failed to get local addr");

    let rpc_server = LocalestiaServer::new(storage.clone());
    let mut module = BlobRpcServer::into_rpc(rpc_server.clone());
    module
        .merge(HeaderRpcServer::into_rpc(rpc_server.clone()))
        .expect("failed to merge header RPC module");
    module
        .merge(ShareRpcServer::into_rpc(rpc_server))
        .expect("failed to merge share RPC module");
    let server_handle = server.start(module);

    let ws_url = format!("ws://{}", local_addr);
    let client = Client::new(&ws_url, None, None, None)
        .await
        .expect("failed to create RPC client");

    TestContext {
        client,
        storage,
        _server: server_handle,
        _lock: lock,
    }
}

pub fn make_namespace(seed: u8) -> Namespace {
    let id = [seed; 8];
    Namespace::new_v0(&id).expect("failed to create namespace")
}

pub fn make_blob(namespace: Namespace, data: Vec<u8>) -> Blob {
    Blob::new(namespace, data, None, AppVersion::V3).expect("failed to create blob")
}

pub async fn submit_blob(client: &Client, blob: &Blob) -> u64 {
    client
        .blob_submit(std::slice::from_ref(blob), TxConfig::default())
        .await
        .expect("blob submission failed")
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExpectedRpcError {
    MethodNotFound,
    InvalidParams,
    ParseError,
}

pub fn assert_rpc_error(err: RpcError, expected: ExpectedRpcError) {
    match expected {
        ExpectedRpcError::MethodNotFound => assert_call_error(err, METHOD_NOT_FOUND_CODE),
        ExpectedRpcError::InvalidParams => assert_call_error(err, INVALID_PARAMS_CODE),
        ExpectedRpcError::ParseError => match err {
            RpcError::ParseError(_) => {}
            other => panic!("expected parse error, got {other:?}"),
        },
    }
}

fn assert_call_error(err: RpcError, expected_code: i32) {
    match err {
        RpcError::Call(obj) => assert_eq!(obj.code(), expected_code, "unexpected error code"),
        other => panic!("expected call error code {expected_code}, got {other:?}"),
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RpcOutcome {
    Ok,
    MethodNotFound,
    InvalidParams,
    ParseError,
    Other(String),
    Skipped(&'static str),
}

impl std::fmt::Display for RpcOutcome {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            RpcOutcome::Ok => write!(f, "ok"),
            RpcOutcome::MethodNotFound => write!(f, "method not found"),
            RpcOutcome::InvalidParams => write!(f, "invalid params"),
            RpcOutcome::ParseError => write!(f, "response parse error"),
            RpcOutcome::Other(msg) => write!(f, "other error: {msg}"),
            RpcOutcome::Skipped(reason) => write!(f, "skipped: {reason}"),
        }
    }
}

pub fn classify_error(err: RpcError) -> RpcOutcome {
    match err {
        RpcError::Call(obj) => match obj.code() {
            METHOD_NOT_FOUND_CODE => RpcOutcome::MethodNotFound,
            INVALID_PARAMS_CODE => RpcOutcome::InvalidParams,
            code => RpcOutcome::Other(format!("call error code {code}")),
        },
        RpcError::ParseError(_) => RpcOutcome::ParseError,
        other => RpcOutcome::Other(other.to_string()),
    }
}
