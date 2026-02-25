use jsonrpsee::server::ServerBuilder;
use std::net::SocketAddr;
use std::sync::Arc;
use tracing::{error, info};

mod error;
mod grpc;
mod rpc;
mod storage;
mod types;
mod utils;

use celestia_rpc::BlobRpcServer;
use celestia_rpc::HeaderRpcServer;
use crate::rpc::ShareRpcServer;
use error::LocalError;
use rpc::LocalestiaServer;
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
    let grpc_addr =
        std::env::var("GRPC_ADDR").unwrap_or_else(|_| "0.0.0.0:9090".to_string());

    let addr: SocketAddr = listen_addr.parse().map_err(|e| {
        Box::new(LocalError::TransactionError(format!(
            "Failed to parse address: {}",
            e
        )))
    })?;

    let grpc_socket: SocketAddr = grpc_addr.parse().map_err(|e| {
        Box::new(LocalError::TransactionError(format!(
            "Failed to parse gRPC address: {}",
            e
        )))
    })?;

    info!("Starting local Celestia Blob RPC server...");
    info!("Redis URL: {}", redis_url);
    info!("JSON-RPC listening on: {}", listen_addr);
    info!("gRPC listening on: {}", grpc_addr);

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
    let rpc_server = LocalestiaServer::new(storage.clone());

    let mut module = BlobRpcServer::into_rpc(rpc_server.clone());
    module
        .merge(HeaderRpcServer::into_rpc(rpc_server.clone()))
        .map_err(|e| {
            Box::new(LocalError::TransactionError(format!(
                "Failed to merge header RPC: {}",
                e
            )))
        })?;
    module
        .merge(ShareRpcServer::into_rpc(rpc_server))
        .map_err(|e| {
            Box::new(LocalError::TransactionError(format!(
                "Failed to merge share RPC: {}",
                e
            )))
        })?;

    // Build and start the JSON-RPC server
    let server = ServerBuilder::default().build(addr).await.map_err(|e| {
        Box::new(LocalError::TransactionError(format!(
            "Failed to build server: {}",
            e
        )))
    })?;

    let server_handle = server.start(module);

    info!("JSON-RPC server started at ws://{}", listen_addr);

    // Start gRPC server concurrently
    let grpc_storage = storage.clone();
    let grpc_task = tokio::spawn(async move {
        if let Err(e) = grpc::serve(grpc_storage, grpc_socket).await {
            error!("gRPC server error: {}", e);
        }
    });

    // Keep both servers running until Ctrl+C
    tokio::select! {
        _ = tokio::signal::ctrl_c() => {
            info!("Received shutdown signal");
        }
        _ = grpc_task => {
            error!("gRPC server exited unexpectedly");
        }
    }

    info!("Shutting down...");

    if let Err(e) = server_handle.stop() {
        error!("Error stopping JSON-RPC server: {}", e);
    }

    info!("Shutdown complete");

    Ok(())
}
