use jsonrpsee::server::ServerBuilder;
use std::net::SocketAddr;
use std::sync::Arc;
use tracing::{error, info};

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
    // Initialize logging
    tracing_subscriber::fmt::init();

    // Parse command line arguments
    let redis_url =
        std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string());
    let listen_addr =
        std::env::var("LISTEN_ADDR").unwrap_or_else(|_| "127.0.0.1:26658".to_string());

    // Create a new error variant for AddrParseError
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

    if let Err(e) = storage.clear_database().await {
        error!("Failed to clear Redis database: {}", e);
        return Err(Box::new(e));
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

    // Register our RPC methods (both Blob and Header)
    let server_handle = server.start(rpc_server.into_rpc()).map_err(|e| {
        Box::new(LocalError::TransactionError(format!(
            "Failed to start server: {}",
            e
        )))
    })?;

    info!("Server started successfully");
    info!(
        "The server is ready to accept RPC calls at ws://{}",
        listen_addr
    );
    info!(
        "Connect using: celestia-rpc::Client::new(\"ws://{}\", None)",
        listen_addr
    );

    // Keep the server running until Ctrl+C
    match tokio::signal::ctrl_c().await {
        Ok(_) => info!("Received shutdown signal"),
        Err(e) => error!("Failed to listen for ctrl-c: {}", e),
    }

    info!("Shutting down server...");

    // Stop the server
    if let Err(e) = server_handle.stop() {
        error!("Error stopping server: {}", e);
    }

    info!("Server shutdown complete");

    Ok(())
}
