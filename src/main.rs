use jsonrpsee::server::ServerBuilder;
use std::net::SocketAddr;
use std::sync::Arc;
use tracing::{error, info, warn};

mod error;
mod rpc;
mod storage;
mod types;
mod utils;

use error::LocalError;
use rpc::{BlobRpcServerImpl, CombinedRpcServer};
use storage::RedisStorage;

#[tokio::main]
async fn main() -> Result<(), Box<LocalError>> {
    tracing_subscriber::fmt::init();

    let redis_url =
        std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string());
    let listen_addr =
        std::env::var("LISTEN_ADDR").unwrap_or_else(|_| "127.0.0.1:26658".to_string());

    let addr: SocketAddr = listen_addr.parse().map_err(|e| {
        Box::new(LocalError::TransactionError(format!(
            "Failed to parse address: {}",
            e
        )))
    })?;

    info!("Starting local Celestia Blob RPC server...");
    info!("Redis URL: {}", redis_url);
    info!("Listening on: {}", listen_addr);

    // Initialize Redis storage
    let storage = match RedisStorage::new(&redis_url) {
        Ok(storage) => Arc::new(storage),
        Err(e) => {
            error!("Failed to initialize Redis storage: {}", e);
            return Err(Box::new(e));
        }
    };

    // Connect to Redis
    if let Err(e) = storage.connect().await {
        error!("Failed to connect to Redis: {}", e);
        return Err(Box::new(e));
    }

    // Clear DB if requested (default true)
    let do_clear = std::env::var("CLEAR_REDIS").ok().map_or(true, |v| v == "true");
    if do_clear {
        if let Err(e) = storage.clear_database().await {
            error!("Failed to clear Redis database: {}", e);
            return Err(Box::new(e));
        }
    }

    // Create our RPC services
    let rpc_server = BlobRpcServerImpl::new(storage.clone());

    // Build and start the JSON-RPC server
    let server = ServerBuilder::default().build(addr).await.map_err(|e| {
        Box::new(LocalError::TransactionError(format!(
            "Failed to build server: {}",
            e
        )))
    })?;

    let server_handle = server.start(rpc_server.into_rpc()).map_err(|e| {
        Box::new(LocalError::TransactionError(format!(
            "Failed to start server: {}",
            e
        )))
    })?;

    info!("Server started successfully");
    info!("The server is ready at [http|ws]://{}", listen_addr);

    // Wait for SIGINT/SIGTERM/SIGQUIT
    shutdown_signal().await;

    info!("Shutting down server...");

    // 🔑 Tell jsonrpsee to stop, then await the stop; no dropping tricks.
    if let Err(e) = server_handle.stop() {
        error!("Error requesting server stop: {}", e);
    }

    // Avoid hanging forever if a background task misbehaves.
    let stop_timeout = std::time::Duration::from_secs(2);
    match tokio::time::timeout(stop_timeout, server_handle.stopped()).await {
        Ok(_) => info!("Server reported stopped."),
        Err(_) => {
            warn!("Server didn't stop within {:?}; killing process...", stop_timeout);
        }
    }

    info!("Server shutdown complete");
    Ok(())
}

#[cfg(unix)]
async fn shutdown_signal() {
    use tokio::signal::unix::{signal, SignalKind};

    let mut sigint = signal(SignalKind::interrupt()).expect("listen to SIGINT");
    let mut sigterm = signal(SignalKind::terminate()).expect("listen to SIGTERM");
    let mut sigquit = signal(SignalKind::quit()).expect("listen to SIGQUIT");

    tokio::select! {
        _ = tokio::signal::ctrl_c() => {
            info!("Shutdown requested via Ctrl+C (SIGINT)");
        }
        _ = sigint.recv() => {
            info!("Shutdown requested via SIGINT");
        }
        _ = sigterm.recv() => {
            info!("Shutdown requested via SIGTERM");
        }
        _ = sigquit.recv() => {
            info!("Shutdown requested via SIGQUIT");
        }
    }
}

#[cfg(not(unix))]
async fn shutdown_signal() {
    let _ = tokio::signal::ctrl_c().await;
    info!("Shutdown requested via Ctrl+C");
}
