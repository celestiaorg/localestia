use std::sync::Arc;

use celestia_proto::celestia::core::v1::tx::tx_server::{Tx, TxServer};
use celestia_proto::celestia::core::v1::tx::{
    TxStatusBatchRequest, TxStatusBatchResponse, TxStatusRequest, TxStatusResponse,
};
use tonic::{Request, Response, Status};
use tracing::info;

use crate::storage::RedisStorage;

/// gRPC service: celestia.core.v1.tx.Tx
///
/// Handles TxStatus — looks up the stored height for the tx and returns COMMITTED.
#[derive(Clone)]
pub struct TxStatusService {
    storage: Arc<RedisStorage>,
}

impl TxStatusService {
    pub fn new(storage: Arc<RedisStorage>) -> Self {
        Self { storage }
    }
}

#[tonic::async_trait]
impl Tx for TxStatusService {
    async fn tx_status(
        self: Arc<Self>,
        request: Request<TxStatusRequest>,
    ) -> Result<Response<TxStatusResponse>, Status> {
        let tx_id = request.into_inner().tx_id;
        info!("TxStatus: tx_id={}", tx_id);

        let height = self
            .storage
            .get_tx_height(&tx_id)
            .await
            .unwrap_or(None)
            .unwrap_or(1);
        info!("TxStatus: resolved height={}", height);

        Ok(Response::new(TxStatusResponse {
            height: height as i64,
            index: 0,
            execution_code: 0,
            error: String::new(),
            status: "COMMITTED".to_string(),
            codespace: String::new(),
            gas_wanted: 0,
            gas_used: 0,
            signers: vec![],
        }))
    }

    async fn tx_status_batch(
        self: Arc<Self>,
        _request: Request<TxStatusBatchRequest>,
    ) -> Result<Response<TxStatusBatchResponse>, Status> {
        Err(Status::unimplemented("not supported by localestia"))
    }
}

pub fn service(storage: Arc<RedisStorage>) -> TxServer<TxStatusService> {
    TxServer::new(TxStatusService::new(storage))
}
