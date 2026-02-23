#![allow(dead_code)]

use celestia_rpc::prelude::*;
use celestia_rpc::{BlobRpcServer, HeaderRpcServer};
use celestia_rpc::{Client, TxConfig};
use celestia_types::nmt::Namespace;
use celestia_types::{AppVersion, Blob};
use jsonrpsee::server::{ServerBuilder, ServerHandle};
use jsonrpsee_core::client::Error as RpcError;
use jsonrpsee_types::error::{INVALID_PARAMS_CODE, METHOD_NOT_FOUND_CODE};
use localestia::rpc::{LocalestiaServer, ShareRpcServer as LocalShareRpcServer};
use localestia::storage::RedisStorage;
use once_cell::sync::Lazy;
use std::env;
use std::net::{SocketAddr, TcpListener};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::net::TcpStream;
use tokio::sync::{Mutex, MutexGuard};
use tokio::time::sleep;
use uuid::Uuid;

static TEST_LOCK: Lazy<Mutex<()>> = Lazy::new(|| Mutex::new(()));

const DEFAULT_REDIS_URL: &str = "redis://127.0.0.1:6379";
const DEFAULT_REDIS_IMAGE: &str = "redis:7";
const REDIS_MODE_ENV: &str = "LOCALESTIA_REDIS_MODE";

pub struct TestContext {
    pub client: Client,
    pub storage: Arc<RedisStorage>,
    _server: ServerHandle,
    _redis: RedisTestGuard,
    _lock: MutexGuard<'static, ()>,
}

impl Drop for TestContext {
    fn drop(&mut self) {
        let _ = self._server.stop();
    }
}

pub struct ProcessTestContext {
    pub client: Client,
    pub http_url: String,
    _child: Child,
    _redis: RedisTestGuard,
    _lock: MutexGuard<'static, ()>,
}

impl Drop for ProcessTestContext {
    fn drop(&mut self) {
        let _ = self._child.kill();
        let _ = self._child.wait();
    }
}

pub async fn setup() -> TestContext {
    let lock = TEST_LOCK.lock().await;
    let redis = setup_redis().await;
    let redis_url = redis.url.clone();

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
        .merge(LocalShareRpcServer::into_rpc(rpc_server))
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
        _redis: redis,
        _lock: lock,
    }
}

pub async fn setup_process() -> ProcessTestContext {
    let lock = TEST_LOCK.lock().await;
    let redis = setup_redis().await;
    let redis_url = redis.url.clone();
    let listen_addr = reserve_listen_addr();
    let bin_path = resolve_localestia_bin();

    let child = Command::new(&bin_path)
        .env("REDIS_URL", &redis_url)
        .env("LISTEN_ADDR", &listen_addr)
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .spawn()
        .expect("failed to start localestia process");

    wait_for_port(&listen_addr).await;
    let ws_url = format!("ws://{}", listen_addr);
    let client = wait_for_client(&ws_url).await;

    ProcessTestContext {
        client,
        http_url: format!("http://{}", listen_addr),
        _child: child,
        _redis: redis,
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

fn reserve_listen_addr() -> String {
    let listener = TcpListener::bind("127.0.0.1:0").expect("failed to bind to an ephemeral port");
    let addr = listener
        .local_addr()
        .expect("failed to read bound address")
        .to_string();
    drop(listener);
    addr
}

fn resolve_localestia_bin() -> PathBuf {
    if let Some(path) = option_env!("CARGO_BIN_EXE_localestia") {
        return PathBuf::from(path);
    }

    if let Ok(path) = env::var("CARGO_BIN_EXE_localestia") {
        return PathBuf::from(path);
    }

    let target_profile_dir = target_profile_dir();
    let exe_name = if cfg!(windows) {
        "localestia.exe"
    } else {
        "localestia"
    };
    let candidate = target_profile_dir.join(exe_name);

    if candidate.exists() {
        return candidate;
    }

    build_localestia(&target_profile_dir);

    if candidate.exists() {
        return candidate;
    }

    panic!(
        "localestia binary not found at {}; run `cargo build --bin localestia`",
        candidate.display()
    );
}

fn target_profile_dir() -> PathBuf {
    if let Ok(exe) = env::current_exe() {
        if let Some(profile_dir) = exe.parent().and_then(|parent| parent.parent()) {
            return profile_dir.to_path_buf();
        }
    }

    let target_dir = env::var("CARGO_TARGET_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("target"));
    let profile = env::var("PROFILE").unwrap_or_else(|_| "debug".to_string());
    let profile = if profile == "release" { "release" } else { "debug" };
    target_dir.join(profile)
}

fn build_localestia(target_profile_dir: &Path) {
    let cargo = env::var("CARGO").unwrap_or_else(|_| "cargo".to_string());
    let release = target_profile_dir
        .file_name()
        .and_then(|name| name.to_str())
        .map(|name| name == "release")
        .unwrap_or(false);

    let mut cmd = Command::new(cargo);
    cmd.arg("build").arg("--bin").arg("localestia");
    if release {
        cmd.arg("--release");
    }
    cmd.current_dir(env!("CARGO_MANIFEST_DIR"));
    let status = cmd.status().unwrap_or_else(|err| {
        if err.kind() == std::io::ErrorKind::NotFound {
            panic!("cargo is required to build the localestia binary");
        }
        panic!("failed to run cargo build: {err}");
    });

    if !status.success() {
        panic!("cargo build --bin localestia failed with status {status}");
    }
}

#[derive(Debug, Copy, Clone, PartialEq, Eq)]
enum RedisMode {
    Local,
    Docker,
    Auto,
}

struct RedisTestGuard {
    url: String,
    docker_name: Option<String>,
}

impl Drop for RedisTestGuard {
    fn drop(&mut self) {
        if let Some(name) = self.docker_name.take() {
            let _ = Command::new("docker")
                .arg("rm")
                .arg("-f")
                .arg(name)
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .status();
        }
    }
}

async fn setup_redis() -> RedisTestGuard {
    match resolve_redis_mode() {
        RedisMode::Local => {
            let url = env::var("REDIS_URL").unwrap_or_else(|_| DEFAULT_REDIS_URL.to_string());
            wait_for_redis(&url, RedisMode::Local).await;
            RedisTestGuard {
                url,
                docker_name: None,
            }
        }
        RedisMode::Docker => {
            let info = start_redis_docker();
            wait_for_redis(&info.url, RedisMode::Docker).await;
            RedisTestGuard {
                url: info.url,
                docker_name: Some(info.name),
            }
        }
        RedisMode::Auto => {
            if env::var("REDIS_URL").is_ok() {
                let url = env::var("REDIS_URL").unwrap_or_else(|_| DEFAULT_REDIS_URL.to_string());
                wait_for_redis(&url, RedisMode::Local).await;
                return RedisTestGuard {
                    url,
                    docker_name: None,
                };
            }

            if docker_available() {
                let info = start_redis_docker();
                wait_for_redis(&info.url, RedisMode::Docker).await;
                return RedisTestGuard {
                    url: info.url,
                    docker_name: Some(info.name),
                };
            }

            let url = DEFAULT_REDIS_URL.to_string();
            wait_for_redis(&url, RedisMode::Local).await;
            RedisTestGuard {
                url,
                docker_name: None,
            }
        }
    }
}

fn resolve_redis_mode() -> RedisMode {
    match env::var(REDIS_MODE_ENV)
        .unwrap_or_else(|_| "local".to_string())
        .to_lowercase()
        .as_str()
    {
        "local" => RedisMode::Local,
        "docker" => RedisMode::Docker,
        "auto" => RedisMode::Auto,
        other => panic!("invalid {REDIS_MODE_ENV} value: {other} (use local, docker, or auto)"),
    }
}

fn docker_available() -> bool {
    match Command::new("docker").arg("info").output() {
        Ok(output) => output.status.success(),
        Err(_) => false,
    }
}

struct DockerRedisInfo {
    name: String,
    url: String,
}

fn start_redis_docker() -> DockerRedisInfo {
    let name = format!("localestia-test-{}", Uuid::new_v4());
    let output = Command::new("docker")
        .arg("run")
        .arg("-d")
        .arg("-P")
        .arg("--name")
        .arg(&name)
        .arg(DEFAULT_REDIS_IMAGE)
        .output()
        .unwrap_or_else(|err| {
            if err.kind() == std::io::ErrorKind::NotFound {
                panic!("docker is required for LOCALESTIA_REDIS_MODE=docker");
            }
            panic!("failed to start docker redis: {err}");
        });

    if !output.status.success() {
        panic!(
            "docker run failed: {}",
            String::from_utf8_lossy(&output.stderr)
        );
    }

    let port = docker_host_port(&name).unwrap_or_else(|err| {
        let _ = Command::new("docker")
            .arg("rm")
            .arg("-f")
            .arg(&name)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
        panic!("failed to resolve redis port from docker: {err}");
    });

    let url = format!("redis://127.0.0.1:{port}");
    DockerRedisInfo { name, url }
}

fn docker_host_port(name: &str) -> Result<String, String> {
    let output = Command::new("docker")
        .arg("inspect")
        .arg("-f")
        .arg("{{(index (index .NetworkSettings.Ports \"6379/tcp\") 0).HostPort}}")
        .arg(name)
        .output()
        .map_err(|err| err.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let port = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if port.is_empty() {
        return Err("docker inspect returned an empty port".to_string());
    }

    Ok(port)
}

async fn wait_for_redis(redis_url: &str, mode: RedisMode) {
    let start = Instant::now();
    let timeout = Duration::from_secs(10);

    loop {
        match redis::Client::open(redis_url) {
            Ok(client) => match client.get_multiplexed_async_connection().await {
                Ok(mut conn) => {
                    let pong: redis::RedisResult<String> =
                        redis::cmd("PING").query_async(&mut conn).await;
                    if let Ok(pong) = pong {
                        if pong == "PONG" {
                            return;
                        }
                    }
                }
                Err(_) => {}
            },
            Err(_) => {}
        }

        if start.elapsed() > timeout {
            match mode {
                RedisMode::Docker => {
                    panic!("redis did not start within {timeout:?} using docker");
                }
                _ => {
                    panic!(
                        "redis is not reachable at {redis_url}; start Redis locally or set {REDIS_MODE_ENV}=docker"
                    );
                }
            }
        }

        sleep(Duration::from_millis(200)).await;
    }
}

async fn wait_for_port(listen_addr: &str) {
    let addr: SocketAddr = listen_addr.parse().expect("failed to parse listen address");
    let start = Instant::now();
    let timeout = Duration::from_secs(10);

    loop {
        match TcpStream::connect(addr).await {
            Ok(stream) => {
                drop(stream);
                return;
            }
            Err(_) => {
                if start.elapsed() > timeout {
                    panic!("localestia did not start listening within {timeout:?}");
                }
                sleep(Duration::from_millis(100)).await;
            }
        }
    }
}

async fn wait_for_client(ws_url: &str) -> Client {
    let start = Instant::now();
    let timeout = Duration::from_secs(10);

    loop {
        match Client::new(ws_url, None, None, None).await {
            Ok(client) => return client,
            Err(err) => {
                if start.elapsed() > timeout {
                    panic!("failed to connect to localestia at {ws_url}: {err}");
                }
                sleep(Duration::from_millis(200)).await;
            }
        }
    }
}
