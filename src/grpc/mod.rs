use std::sync::Arc;

use tonic::transport::Server;
use tracing::info;

use crate::storage::RedisStorage;

mod auth;
mod gas_estimator;
mod node_info;
mod tx_service;
mod tx_status;

pub async fn serve(
    storage: Arc<RedisStorage>,
    addr: std::net::SocketAddr,
) -> Result<(), tonic::transport::Error> {
    info!("Starting gRPC server on {}", addr);

    Server::builder()
        .add_service(node_info::service(storage.clone()))
        .add_service(auth::service(storage.clone()))
        .add_service(tx_service::service(storage.clone()))
        .add_service(tx_status::service(storage.clone()))
        .add_service(gas_estimator::service(storage.clone()))
        .serve(addr)
        .await
}
