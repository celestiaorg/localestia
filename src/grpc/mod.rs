use std::sync::Arc;

use tonic::transport::Server;
use tracing::info;

use crate::storage::RedisStorage;

mod auth;
mod node_info;
mod tx_service;
mod tx_status;

pub async fn serve(
    storage: Arc<RedisStorage>,
    addr: std::net::SocketAddr,
) -> Result<(), tonic::transport::Error> {
    info!("Starting gRPC server on {}", addr);

    Server::builder()
        .add_service(node_info::NodeInfoService::new(storage.clone()))
        .add_service(auth::AuthQueryService::new(storage.clone()))
        .add_service(tx_service::TxService::new(storage.clone()))
        .add_service(tx_status::TxStatusService::new(storage.clone()))
        .serve(addr)
        .await
}
