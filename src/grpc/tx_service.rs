use std::sync::Arc;

use celestia_proto::cosmos::base::abci::v1beta1::TxResponse;
use celestia_proto::cosmos::tx::v1beta1::service_server::{Service, ServiceServer};
use celestia_proto::cosmos::tx::v1beta1::{
    BroadcastTxRequest, BroadcastTxResponse, GetBlockWithTxsRequest, GetBlockWithTxsResponse,
    GetTxRequest, GetTxResponse, GetTxsEventRequest, GetTxsEventResponse, SimulateRequest,
    SimulateResponse, TxDecodeAminoRequest, TxDecodeAminoResponse, TxDecodeRequest,
    TxDecodeResponse, TxEncodeAminoRequest, TxEncodeAminoResponse, TxEncodeRequest,
    TxEncodeResponse,
};
use celestia_proto::proto::blob::v2::BlobTx;
use celestia_types::consts::appconsts::AppVersion;
use celestia_types::nmt::Namespace;
use celestia_types::Blob;
use prost::Message;
use sha2::{Digest, Sha256};
use tonic::{Request, Response, Status};
use tracing::{error, info};

use crate::storage::RedisStorage;

/// gRPC service: cosmos.tx.v1beta1.Service
///
/// Handles BroadcastTx — decodes BlobTx, stores blobs in Redis, returns tx hash.
#[derive(Clone)]
pub struct TxService {
    storage: Arc<RedisStorage>,
}

impl TxService {
    pub fn new(storage: Arc<RedisStorage>) -> Self {
        Self { storage }
    }
}

#[tonic::async_trait]
impl Service for TxService {
    async fn broadcast_tx(
        self: Arc<Self>,
        request: Request<BroadcastTxRequest>,
    ) -> Result<Response<BroadcastTxResponse>, Status> {
        let tx_bytes = request.into_inner().tx_bytes;

        // Compute tx hash (SHA-256 of raw tx bytes)
        let tx_hash = {
            let mut hasher = Sha256::new();
            hasher.update(&tx_bytes);
            hex::encode(hasher.finalize()).to_uppercase()
        };

        info!("BroadcastTx: tx_hash={}", tx_hash);

        // Try to decode as BlobTx (go-square proto.blob.v2.BlobTx)
        let blobs = match BlobTx::decode(tx_bytes.as_ref()) {
            Ok(blob_tx) if !blob_tx.blobs.is_empty() => {
                info!("Decoded BlobTx with {} blobs", blob_tx.blobs.len());
                let mut celestia_blobs = Vec::new();
                for blob_proto in blob_tx.blobs {
                    let ns_version =
                        u8::try_from(blob_proto.namespace_version).map_err(|_| {
                            Status::invalid_argument(format!(
                                "invalid namespace version: {}",
                                blob_proto.namespace_version
                            ))
                        })?;
                    let ns = Namespace::new(ns_version, &blob_proto.namespace_id)
                        .map_err(|e| Status::invalid_argument(format!("invalid namespace: {e}")))?;

                    match Blob::new(ns, blob_proto.data, None, AppVersion::V2) {
                        Ok(blob) => celestia_blobs.push(blob),
                        Err(e) => {
                            error!("Failed to construct Blob: {}", e);
                            return Err(Status::invalid_argument(format!("invalid blob: {e}")));
                        }
                    }
                }
                celestia_blobs
            }
            _ => {
                // No blobs (or not a BlobTx) — treat as plain cosmos tx, nothing to store
                info!("BroadcastTx: no blobs to store");
                vec![]
            }
        };

        let tx_height = if !blobs.is_empty() {
            let height = self.storage.store_blobs(&blobs).await.map_err(|e| {
                error!("Failed to store blobs: {}", e);
                Status::internal(format!("storage error: {e}"))
            })?;
            info!("Stored {} blobs at height {}", blobs.len(), height);
            self.storage
                .store_tx_height(&tx_hash, height)
                .await
                .map_err(|e| {
                    error!("Failed to store tx height mapping: {}", e);
                    Status::internal(format!("storage error: {e}"))
                })?;
            height
        } else {
            0
        };

        let tx_response = TxResponse {
            height: tx_height as i64,
            txhash: tx_hash,
            codespace: String::new(),
            code: 0,
            data: String::new(),
            raw_log: String::new(),
            logs: vec![],
            info: String::new(),
            gas_wanted: 0,
            gas_used: 0,
            tx: None,
            timestamp: String::new(),
            events: vec![],
        };

        Ok(Response::new(BroadcastTxResponse {
            tx_response: Some(tx_response),
        }))
    }

    async fn simulate(
        self: Arc<Self>,
        _request: Request<SimulateRequest>,
    ) -> Result<Response<SimulateResponse>, Status> {
        Err(Status::unimplemented("not supported by localestia"))
    }

    async fn get_tx(
        self: Arc<Self>,
        _request: Request<GetTxRequest>,
    ) -> Result<Response<GetTxResponse>, Status> {
        Err(Status::unimplemented("not supported by localestia"))
    }

    async fn get_txs_event(
        self: Arc<Self>,
        _request: Request<GetTxsEventRequest>,
    ) -> Result<Response<GetTxsEventResponse>, Status> {
        Err(Status::unimplemented("not supported by localestia"))
    }

    async fn get_block_with_txs(
        self: Arc<Self>,
        _request: Request<GetBlockWithTxsRequest>,
    ) -> Result<Response<GetBlockWithTxsResponse>, Status> {
        Err(Status::unimplemented("not supported by localestia"))
    }

    async fn tx_decode(
        self: Arc<Self>,
        _request: Request<TxDecodeRequest>,
    ) -> Result<Response<TxDecodeResponse>, Status> {
        Err(Status::unimplemented("not supported by localestia"))
    }

    async fn tx_encode(
        self: Arc<Self>,
        _request: Request<TxEncodeRequest>,
    ) -> Result<Response<TxEncodeResponse>, Status> {
        Err(Status::unimplemented("not supported by localestia"))
    }

    async fn tx_encode_amino(
        self: Arc<Self>,
        _request: Request<TxEncodeAminoRequest>,
    ) -> Result<Response<TxEncodeAminoResponse>, Status> {
        Err(Status::unimplemented("not supported by localestia"))
    }

    async fn tx_decode_amino(
        self: Arc<Self>,
        _request: Request<TxDecodeAminoRequest>,
    ) -> Result<Response<TxDecodeAminoResponse>, Status> {
        Err(Status::unimplemented("not supported by localestia"))
    }
}

pub fn service(storage: Arc<RedisStorage>) -> ServiceServer<TxService> {
    ServiceServer::new(TxService::new(storage))
}
