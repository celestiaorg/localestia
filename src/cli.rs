use std::env;
use std::fs;
use std::io::{BufRead, BufReader};
use std::net::SocketAddr;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Arc;
use std::time::{Duration, Instant};

use clap::{Args, Parser, Subcommand};
use ethers::abi::Abi;
use ethers::contract::ContractFactory;
use ethers::middleware::SignerMiddleware;
use ethers::providers::{Http, Middleware, Provider};
use ethers::signers::{LocalWallet, Signer};
use ethers::types::Bytes;
use jsonrpsee::server::{ServerBuilder, ServerHandle};
use rand::RngCore;
use serde::Deserialize;
use tokio::sync::watch;
use tokio::time::sleep;
use tracing::{error, info, warn};
use uuid::Uuid;

use crate::error::LocalError;
use crate::rpc::LocalestiaServer;
use crate::storage::RedisStorage;
use celestia_rpc::{
    BlobClient, BlobRpcServer, BlobstreamRpcServer, Client, HeaderRpcServer, TxConfig,
};
use celestia_types::nmt::Namespace;
use celestia_types::{AppVersion, Blob};
use localestia::relayer::{self, RelayerConfig};

use crate::rpc::ShareRpcServer;

const DEFAULT_LISTEN_ADDR: &str = "127.0.0.1:26658";
const DEFAULT_REDIS_URL: &str = "redis://127.0.0.1:6379";
const DEFAULT_ANVIL_PORT: u16 = 8545;
const DEFAULT_UI_PORT: u16 = 3030;
const DEFAULT_REDIS_IMAGE: &str = "redis:7";
const DEFAULT_ANVIL_IMAGE: &str = "ghcr.io/foundry-rs/foundry:latest";
const DEFAULT_ANVIL_MNEMONIC: &str = "test test test test test test test test test test test junk";

#[derive(Parser)]
#[command(
    name = "localestia",
    version,
    about = "Local Celestia JSON-RPC emulator"
)]
struct Cli {
    #[command(subcommand)]
    command: Option<Commands>,
}

#[derive(Subcommand)]
enum Commands {
    Blobstream {
        #[command(subcommand)]
        command: BlobstreamCommands,
    },
    Demo(DemoArgs),
}

#[derive(Subcommand)]
enum BlobstreamCommands {
    Deploy(DeployArgs),
}

#[derive(Args)]
struct DeployArgs {
    #[arg(long)]
    eth_rpc_url: String,
    #[arg(long)]
    private_key: String,
    #[arg(long)]
    chain_id: Option<u64>,
}

#[derive(Args)]
struct DemoArgs {
    #[arg(long, default_value = DEFAULT_LISTEN_ADDR)]
    listen_addr: String,
    #[arg(long)]
    redis_url: Option<String>,
    #[arg(long, default_value_t = DEFAULT_ANVIL_PORT)]
    anvil_port: u16,
    #[arg(long, default_value = DEFAULT_ANVIL_MNEMONIC)]
    anvil_mnemonic: String,
    #[arg(long, default_value_t = DEFAULT_UI_PORT)]
    ui_port: u16,
    #[arg(long, default_value_t = 1000)]
    relayer_interval_ms: u64,
    #[arg(long, default_value_t = 1500)]
    auto_blob_interval_ms: u64,
}

#[derive(Deserialize)]
struct ForgeArtifact {
    abi: serde_json::Value,
    bytecode: ForgeBytecode,
}

#[derive(Deserialize)]
struct ForgeBytecode {
    object: String,
}

pub async fn run() -> Result<(), Box<LocalError>> {
    tracing_subscriber::fmt::init();

    let cli = Cli::parse();
    match cli.command {
        None => run_server_from_env().await,
        Some(Commands::Blobstream {
            command: BlobstreamCommands::Deploy(args),
        }) => deploy_command(args).await,
        Some(Commands::Demo(args)) => run_demo(args).await,
    }
}

async fn run_server_from_env() -> Result<(), Box<LocalError>> {
    let redis_url = env::var("REDIS_URL").unwrap_or_else(|_| DEFAULT_REDIS_URL.to_string());
    let listen_addr = env::var("LISTEN_ADDR").unwrap_or_else(|_| DEFAULT_LISTEN_ADDR.to_string());
    let server_handle = start_rpc_server(&redis_url, &listen_addr).await?;

    info!("Server started successfully");
    info!("The server is ready to accept RPC calls at ws://{listen_addr}");
    info!("Connect using: celestia-rpc::Client::new(\"ws://{listen_addr}\", None)");

    match tokio::signal::ctrl_c().await {
        Ok(_) => info!("Received shutdown signal"),
        Err(e) => error!("Failed to listen for ctrl-c: {e}"),
    }

    info!("Shutting down server...");
    if let Err(e) = server_handle.stop() {
        error!("Error stopping server: {e}");
    }

    info!("Server shutdown complete");
    Ok(())
}

async fn deploy_command(args: DeployArgs) -> Result<(), Box<LocalError>> {
    let address = deploy_mockstream(&args.eth_rpc_url, &args.private_key, args.chain_id).await?;
    println!("{address}");
    Ok(())
}

async fn run_demo(args: DemoArgs) -> Result<(), Box<LocalError>> {
    let redis_env = env::var("REDIS_URL").ok();
    let redis_url = args.redis_url.or(redis_env).unwrap_or_default();
    let mut redis_guard = None;
    let redis_url = if redis_url.is_empty() {
        let guard = start_redis_docker()?;
        let url = guard.url.clone();
        redis_guard = Some(guard);
        url
    } else {
        redis_url
    };
    wait_for_redis(&redis_url).await?;

    let anvil_guard = start_anvil(args.anvil_port, &args.anvil_mnemonic)?;
    let anvil_rpc_url = anvil_guard.endpoint.clone();
    let anvil_private_key = anvil_guard.private_key.clone();

    let server_handle = start_rpc_server(&redis_url, &args.listen_addr).await?;

    let contract_address = deploy_mockstream(
        &anvil_rpc_url,
        &anvil_private_key,
        Some(anvil_guard.chain_id),
    )
    .await?;

    let (shutdown_tx, shutdown_rx) = watch::channel(false);
    let relayer_handle = tokio::spawn(relayer::run_with_shutdown(
        RelayerConfig {
            celestia_ws_url: format!("ws://{}", args.listen_addr),
            eth_rpc_url: anvil_rpc_url.clone(),
            eth_private_key: anvil_private_key.clone(),
            contract_address: contract_address.clone(),
            poll_ms: args.relayer_interval_ms,
        },
        shutdown_rx,
    ));

    let auto_blob_handle = if args.auto_blob_interval_ms > 0 {
        Some(tokio::spawn(auto_blob_loop(
            format!("ws://{}", args.listen_addr),
            args.auto_blob_interval_ms,
            shutdown_tx.subscribe(),
        )))
    } else {
        None
    };

    let mut ui_child = start_ui_server(
        &args.listen_addr,
        &anvil_rpc_url,
        &contract_address,
        args.ui_port,
        &redis_url,
    )?;

    info!("Demo ready:");
    info!("Localestia WS: ws://{}", args.listen_addr);
    info!("Localestia HTTP: http://{}", args.listen_addr);
    info!("Anvil RPC: {anvil_rpc_url}");
    info!("Mock contract: {contract_address}");
    info!("UI: http://127.0.0.1:{}", args.ui_port);

    match tokio::signal::ctrl_c().await {
        Ok(_) => info!("Received shutdown signal"),
        Err(e) => error!("Failed to listen for ctrl-c: {e}"),
    }

    let _ = shutdown_tx.send(true);
    relayer_handle.abort();
    if let Some(handle) = auto_blob_handle {
        handle.abort();
    }

    if let Err(e) = server_handle.stop() {
        error!("Error stopping server: {e}");
    }

    if let Err(err) = ui_child.kill() {
        warn!("Failed to stop UI server: {err}");
    }

    drop(redis_guard);
    drop(anvil_guard);

    Ok(())
}

async fn auto_blob_loop(ws_url: String, interval_ms: u64, mut shutdown: watch::Receiver<bool>) {
    let mut client: Option<Client> = None;
    let mut counter = 0u64;

    loop {
        if *shutdown.borrow() {
            break;
        }

        if client.is_none() {
            match Client::new(&ws_url, None, None, None).await {
                Ok(new_client) => client = Some(new_client),
                Err(err) => {
                    warn!("auto-blob: failed to connect to Localestia: {err}");
                    sleep(Duration::from_millis(interval_ms)).await;
                    continue;
                }
            }
        }

        if let Some(client) = &client {
            let mut namespace_bytes = [0u8; 8];
            rand::thread_rng().fill_bytes(&mut namespace_bytes);
            let namespace = match Namespace::new_v0(&namespace_bytes) {
                Ok(namespace) => namespace,
                Err(err) => {
                    warn!("auto-blob: failed to create namespace: {err}");
                    continue;
                }
            };

            counter += 1;
            let data = format!("demo blob {counter}").into_bytes();
            let blob = match Blob::new(namespace, data, None, AppVersion::V3) {
                Ok(blob) => blob,
                Err(err) => {
                    warn!("auto-blob: failed to build blob: {err}");
                    continue;
                }
            };

            if let Err(err) = client
                .blob_submit(std::slice::from_ref(&blob), TxConfig::default())
                .await
            {
                warn!("auto-blob: submit failed: {err}");
            }
        }

        tokio::select! {
            _ = shutdown.changed() => {},
            _ = sleep(Duration::from_millis(interval_ms)) => {},
        }
    }
}

async fn start_rpc_server(
    redis_url: &str,
    listen_addr: &str,
) -> Result<ServerHandle, Box<LocalError>> {
    let addr: SocketAddr = listen_addr.parse().map_err(|e| {
        Box::new(LocalError::TransactionError(format!(
            "Failed to parse address: {e}"
        )))
    })?;

    info!("Starting local Celestia Blob RPC server...");
    info!("Redis URL: {redis_url}");
    info!("Listening on: {listen_addr}");

    let storage = match RedisStorage::new(redis_url) {
        Ok(storage) => Arc::new(storage),
        Err(e) => {
            error!("Failed to initialize Redis storage: {e}");
            return Err(Box::new(e));
        }
    };

    if let Err(e) = storage.connect().await {
        error!("Failed to connect to Redis: {e}");
        return Err(Box::new(e));
    }

    if let Err(e) = storage.clear_database().await {
        error!("Failed to clear Redis database: {e}");
        return Err(Box::new(e));
    }

    let rpc_server = LocalestiaServer::new(storage.clone());
    let mut module = BlobRpcServer::into_rpc(rpc_server.clone());
    module
        .merge(HeaderRpcServer::into_rpc(rpc_server.clone()))
        .map_err(|e| {
            Box::new(LocalError::TransactionError(format!(
                "Failed to merge header RPC: {e}"
            )))
        })?;
    module
        .merge(ShareRpcServer::into_rpc(rpc_server.clone()))
        .map_err(|e| {
            Box::new(LocalError::TransactionError(format!(
                "Failed to merge share RPC: {e}"
            )))
        })?;
    module
        .merge(BlobstreamRpcServer::into_rpc(rpc_server))
        .map_err(|e| {
            Box::new(LocalError::TransactionError(format!(
                "Failed to merge blobstream RPC: {e}"
            )))
        })?;

    let server = ServerBuilder::default().build(addr).await.map_err(|e| {
        Box::new(LocalError::TransactionError(format!(
            "Failed to build server: {e}"
        )))
    })?;

    Ok(server.start(module))
}

async fn deploy_mockstream(
    eth_rpc_url: &str,
    private_key: &str,
    chain_id: Option<u64>,
) -> Result<String, Box<LocalError>> {
    ensure_forge_artifact()?;
    let (abi, bytecode) = load_mockstream_artifact()?;

    let provider = Provider::<Http>::try_from(eth_rpc_url).map_err(|e| {
        Box::new(LocalError::TransactionError(format!(
            "Failed to connect to ETH RPC: {e}"
        )))
    })?;
    let chain_id = match chain_id {
        Some(chain_id) => chain_id,
        None => provider
            .get_chainid()
            .await
            .map_err(|e| {
                Box::new(LocalError::TransactionError(format!(
                    "Failed to fetch chain id: {e}"
                )))
            })?
            .as_u64(),
    };

    let wallet: LocalWallet = private_key
        .parse::<LocalWallet>()
        .map_err(|e| {
            Box::new(LocalError::TransactionError(format!(
                "Failed to parse private key: {e}"
            )))
        })?
        .with_chain_id(chain_id);
    let client = Arc::new(SignerMiddleware::new(provider, wallet));
    let factory = ContractFactory::new(abi, bytecode, client);

    let contract = factory
        .deploy(())
        .map_err(|e| {
            Box::new(LocalError::TransactionError(format!(
                "Failed to deploy contract: {e}"
            )))
        })?
        .send()
        .await
        .map_err(|e| {
            Box::new(LocalError::TransactionError(format!(
                "Failed to send deploy tx: {e}"
            )))
        })?;

    let init_call = contract.method::<_, ()>("initialize", 0u64).map_err(|e| {
        Box::new(LocalError::TransactionError(format!(
            "Failed to build initialize call: {e}"
        )))
    })?;
    let init = init_call.send().await.map_err(|e| {
        Box::new(LocalError::TransactionError(format!(
            "Failed to initialize contract: {e}"
        )))
    })?;
    init.await.map_err(|e| {
        Box::new(LocalError::TransactionError(format!(
            "Failed to confirm initialize: {e}"
        )))
    })?;

    Ok(format!("0x{}", hex::encode(contract.address().as_bytes())))
}

fn ensure_forge_artifact() -> Result<(), Box<LocalError>> {
    let artifact_path = contracts_dir()
        .join("out")
        .join("MockBlobstream.sol")
        .join("Mockstream.json");
    if artifact_path.exists() {
        return Ok(());
    }

    let status = Command::new("forge")
        .arg("build")
        .current_dir(contracts_dir())
        .status()
        .map_err(|e| {
            Box::new(LocalError::TransactionError(format!(
                "Failed to run forge build: {e}"
            )))
        })?;

    if !status.success() {
        return Err(Box::new(LocalError::TransactionError(format!(
            "forge build failed with status {status}"
        ))));
    }

    Ok(())
}

fn load_mockstream_artifact() -> Result<(Abi, Bytes), Box<LocalError>> {
    let artifact_path = contracts_dir()
        .join("out")
        .join("MockBlobstream.sol")
        .join("Mockstream.json");
    let bytes = fs::read(&artifact_path).map_err(|e| {
        Box::new(LocalError::TransactionError(format!(
            "Failed to read {artifact_path:?}: {e}"
        )))
    })?;
    let artifact: ForgeArtifact =
        serde_json::from_slice(&bytes).map_err(|e| Box::new(LocalError::SerializationError(e)))?;
    let abi: Abi = serde_json::from_value(artifact.abi)
        .map_err(|e| Box::new(LocalError::SerializationError(e)))?;

    let object = artifact.bytecode.object;
    if object.is_empty() {
        return Err(Box::new(LocalError::TransactionError(
            "Forge artifact bytecode is empty".to_string(),
        )));
    }
    let object = object.strip_prefix("0x").unwrap_or(&object);
    let bytes = hex::decode(object).map_err(|e| {
        Box::new(LocalError::TransactionError(format!(
            "Invalid bytecode hex: {e}"
        )))
    })?;

    Ok((abi, Bytes::from(bytes)))
}

fn contracts_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("contracts")
}

fn start_ui_server(
    listen_addr: &str,
    eth_rpc_url: &str,
    contract_address: &str,
    ui_port: u16,
    rollup_redis_url: &str,
) -> Result<Child, Box<LocalError>> {
    let ui_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("ui");
    if !ui_dir.exists() {
        return Err(Box::new(LocalError::TransactionError(
            "UI directory not found; expected ./ui".to_string(),
        )));
    }

    let node_modules = ui_dir.join("node_modules");
    let redis_module = node_modules.join("redis");
    if !node_modules.exists() || !redis_module.exists() {
        let status = Command::new("bun")
            .arg("install")
            .current_dir(&ui_dir)
            .status()
            .map_err(|e| {
                Box::new(LocalError::TransactionError(format!(
                    "Failed to run bun install: {e}"
                )))
            })?;
        if !status.success() {
            return Err(Box::new(LocalError::TransactionError(format!(
                "bun install failed with status {status}"
            ))));
        }
    }

    let mut command = Command::new("bun");
    command
        .arg("src/index.ts")
        .current_dir(ui_dir)
        .env("CELESTIA_HTTP_URL", format!("http://{listen_addr}"))
        .env("ETH_RPC_URL", eth_rpc_url)
        .env("BLOBSTREAM_CONTRACT_ADDRESS", contract_address)
        .env("UI_PORT", ui_port.to_string())
        .env("ROLLUP_REDIS_URL", rollup_redis_url)
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit());

    if let Ok(value) = env::var("ROLLUP_REDIS_KEY") {
        command.env("ROLLUP_REDIS_KEY", value);
    }
    if let Ok(value) = env::var("ROLLUP_METADATA_DIR") {
        command.env("ROLLUP_METADATA_DIR", value);
    }

    let child = command.spawn().map_err(|e| {
        Box::new(LocalError::TransactionError(format!(
            "Failed to start UI server: {e}"
        )))
    })?;

    Ok(child)
}

struct RedisGuard {
    url: String,
    container_name: String,
}

impl Drop for RedisGuard {
    fn drop(&mut self) {
        let _ = Command::new("docker")
            .arg("rm")
            .arg("-f")
            .arg(&self.container_name)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
    }
}

fn start_redis_docker() -> Result<RedisGuard, Box<LocalError>> {
    if !docker_available() {
        return Err(Box::new(LocalError::TransactionError(
            "Docker is required to start Redis automatically".to_string(),
        )));
    }

    let name = format!("localestia-demo-redis-{}", Uuid::new_v4());
    let output = Command::new("docker")
        .arg("run")
        .arg("-d")
        .arg("-P")
        .arg("--name")
        .arg(&name)
        .arg(DEFAULT_REDIS_IMAGE)
        .output()
        .map_err(|e| {
            Box::new(LocalError::TransactionError(format!(
                "Failed to start Redis docker: {e}"
            )))
        })?;

    if !output.status.success() {
        return Err(Box::new(LocalError::TransactionError(format!(
            "Docker run failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ))));
    }

    let port = docker_host_port(&name, "6379/tcp")?;
    Ok(RedisGuard {
        url: format!("redis://127.0.0.1:{port}"),
        container_name: name,
    })
}

struct AnvilGuard {
    endpoint: String,
    private_key: String,
    chain_id: u64,
    container_name: Option<String>,
    child: Option<Child>,
}

impl Drop for AnvilGuard {
    fn drop(&mut self) {
        if let Some(mut child) = self.child.take() {
            let _ = child.kill();
            let _ = child.wait();
        }

        if let Some(name) = self.container_name.take() {
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

fn start_anvil(port: u16, mnemonic: &str) -> Result<AnvilGuard, Box<LocalError>> {
    if Command::new("anvil").arg("--version").output().is_ok() {
        return start_anvil_local(port, mnemonic);
    }

    if docker_available() {
        return start_anvil_docker(port, mnemonic);
    }

    Err(Box::new(LocalError::TransactionError(
        "Anvil not found; install Foundry or enable Docker".to_string(),
    )))
}

fn start_anvil_local(port: u16, mnemonic: &str) -> Result<AnvilGuard, Box<LocalError>> {
    let mut child = Command::new("anvil")
        .arg("--port")
        .arg(port.to_string())
        .arg("--mnemonic")
        .arg(mnemonic)
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .spawn()
        .map_err(|e| {
            Box::new(LocalError::TransactionError(format!(
                "Failed to start anvil: {e}"
            )))
        })?;

    let stdout = child.stdout.take().ok_or_else(|| {
        Box::new(LocalError::TransactionError(
            "Failed to capture anvil stdout".to_string(),
        ))
    })?;
    let reader = BufReader::new(stdout);
    let mut private_key = None;
    let mut chain_id = None;
    let mut in_keys = false;

    let start = Instant::now();
    for line in reader.lines() {
        let line = line.map_err(|e| {
            Box::new(LocalError::TransactionError(format!(
                "Failed to read anvil output: {e}"
            )))
        })?;
        if line.contains("Listening on") {
            break;
        }
        if line.starts_with("Private Keys") {
            in_keys = true;
            continue;
        }
        if in_keys && line.trim_start().starts_with("(0)") {
            if let Some(key) = line.split("0x").last() {
                private_key = Some(format!("0x{}", key.trim()));
            }
        }
        if let Some(idx) = line.find("Chain ID:") {
            let rest = &line[idx + "Chain ID:".len()..];
            if let Ok(value) = rest
                .split_whitespace()
                .next()
                .unwrap_or("")
                .parse::<u64>()
            {
                chain_id = Some(value);
            }
        }

        if start.elapsed() > Duration::from_secs(10) {
            return Err(Box::new(LocalError::TransactionError(
                "Timed out waiting for anvil to start".to_string(),
            )));
        }
    }

    let private_key = private_key.ok_or_else(|| {
        Box::new(LocalError::TransactionError(
            "Failed to parse anvil private key".to_string(),
        ))
    })?;
    let chain_id = chain_id.unwrap_or(31337);

    Ok(AnvilGuard {
        endpoint: format!("http://127.0.0.1:{port}"),
        private_key,
        chain_id,
        container_name: None,
        child: Some(child),
    })
}

fn start_anvil_docker(port: u16, mnemonic: &str) -> Result<AnvilGuard, Box<LocalError>> {
    let name = format!("localestia-demo-anvil-{}", Uuid::new_v4());
    let output = Command::new("docker")
        .arg("run")
        .arg("-d")
        .arg("--name")
        .arg(&name)
        .arg("-p")
        .arg(format!("{port}:8545"))
        .arg(DEFAULT_ANVIL_IMAGE)
        .arg("anvil")
        .arg("--host")
        .arg("0.0.0.0")
        .arg("--port")
        .arg("8545")
        .arg("--mnemonic")
        .arg(mnemonic)
        .output()
        .map_err(|e| {
            Box::new(LocalError::TransactionError(format!(
                "Failed to start anvil docker: {e}"
            )))
        })?;

    if !output.status.success() {
        return Err(Box::new(LocalError::TransactionError(format!(
            "Docker run failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ))));
    }

    let mut private_key = None;
    let start = Instant::now();
    loop {
        let logs = Command::new("docker")
            .arg("logs")
            .arg(&name)
            .output()
            .map_err(|e| {
                Box::new(LocalError::TransactionError(format!(
                    "Failed to read anvil logs: {e}"
                )))
            })?;
        let logs = String::from_utf8_lossy(&logs.stdout);
        if logs.contains("Listening on") {
            for line in logs.lines() {
                if line.trim_start().starts_with("(0)") {
                    if let Some(key) = line.split("0x").last() {
                        private_key = Some(format!("0x{}", key.trim()));
                        break;
                    }
                }
            }
            if private_key.is_some() {
                break;
            }
        }

        if start.elapsed() > Duration::from_secs(10) {
            return Err(Box::new(LocalError::TransactionError(
                "Timed out waiting for anvil docker".to_string(),
            )));
        }
        std::thread::sleep(Duration::from_millis(200));
    }

    let private_key = private_key.ok_or_else(|| {
        Box::new(LocalError::TransactionError(
            "Failed to parse anvil docker private key".to_string(),
        ))
    })?;

    Ok(AnvilGuard {
        endpoint: format!("http://127.0.0.1:{port}"),
        private_key,
        chain_id: 31337,
        container_name: Some(name),
        child: None,
    })
}

fn docker_available() -> bool {
    Command::new("docker")
        .arg("info")
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

fn docker_host_port(name: &str, port: &str) -> Result<String, Box<LocalError>> {
    let output = Command::new("docker")
        .arg("inspect")
        .arg("-f")
        .arg(format!(
            "{{{{(index (index .NetworkSettings.Ports \"{}\") 0).HostPort}}}}",
            port
        ))
        .arg(name)
        .output()
        .map_err(|e| {
            Box::new(LocalError::TransactionError(format!(
                "Failed to inspect docker port: {e}"
            )))
        })?;

    if !output.status.success() {
        return Err(Box::new(LocalError::TransactionError(
            String::from_utf8_lossy(&output.stderr).to_string(),
        )));
    }

    let port = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if port.is_empty() {
        return Err(Box::new(LocalError::TransactionError(
            "Docker inspect returned empty port".to_string(),
        )));
    }

    Ok(port)
}

async fn wait_for_redis(redis_url: &str) -> Result<(), Box<LocalError>> {
    let start = Instant::now();
    let timeout = Duration::from_secs(10);

    loop {
        if let Ok(client) = redis::Client::open(redis_url) { if let Ok(mut conn) = client.get_multiplexed_async_connection().await {
            let pong: redis::RedisResult<String> =
                redis::cmd("PING").query_async(&mut conn).await;
            if let Ok(pong) = pong {
                if pong == "PONG" {
                    return Ok(());
                }
            }
        } }

        if start.elapsed() > timeout {
            return Err(Box::new(LocalError::TransactionError(format!(
                "Redis is not reachable at {redis_url}"
            ))));
        }

        sleep(Duration::from_millis(200)).await;
    }
}
