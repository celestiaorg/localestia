use std::convert::Infallible;
use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;
use std::task::{Context, Poll};

use celestia_proto::cosmos::base::abci::v1beta1::TxResponse;
use celestia_proto::cosmos::tx::v1beta1::{BroadcastTxRequest, BroadcastTxResponse};
use celestia_proto::proto::blob::v2::BlobTx;
use celestia_types::consts::appconsts::AppVersion;
use celestia_types::nmt::Namespace;
use celestia_types::Blob;
use prost::Message;
use sha2::{Digest, Sha256};
use tonic::body::Body;
use tonic::codec::ProstCodec;
use tonic::server::{Grpc, NamedService, UnaryService};
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

impl NamedService for TxService {
    const NAME: &'static str = "cosmos.tx.v1beta1.Service";
}

impl tower::Service<http::Request<Body>> for TxService {
    type Response = http::Response<Body>;
    type Error = Infallible;
    type Future = Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>> + Send + 'static>>;

    fn poll_ready(&mut self, _cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        Poll::Ready(Ok(()))
    }

    fn call(&mut self, req: http::Request<Body>) -> Self::Future {
        let storage = self.storage.clone();
        match req.uri().path() {
            "/cosmos.tx.v1beta1.Service/BroadcastTx" => {
                Box::pin(async move {
                    let mut grpc = Grpc::new(
                        ProstCodec::<BroadcastTxResponse, BroadcastTxRequest>::default(),
                    );
                    Ok(grpc.unary(BroadcastTxHandler { storage }, req).await)
                })
            }
            _ => Box::pin(async move { Ok(unimplemented_response()) }),
        }
    }
}

struct BroadcastTxHandler {
    storage: Arc<RedisStorage>,
}

impl UnaryService<BroadcastTxRequest> for BroadcastTxHandler {
    type Response = BroadcastTxResponse;
    type Future =
        Pin<Box<dyn Future<Output = Result<Response<Self::Response>, Status>> + Send + 'static>>;

    fn call(&mut self, req: Request<BroadcastTxRequest>) -> Self::Future {
        let storage = self.storage.clone();
        Box::pin(async move {
            let tx_bytes = req.into_inner().tx_bytes;

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
                        let ns = Namespace::new(
                            blob_proto.namespace_version as u8,
                            &blob_proto.namespace_id,
                        )
                        .map_err(|e| {
                            Status::invalid_argument(format!("invalid namespace: {e}"))
                        })?;

                        match Blob::new(ns, blob_proto.data, None, AppVersion::V2) {
                            Ok(blob) => celestia_blobs.push(blob),
                            Err(e) => {
                                error!("Failed to construct Blob: {}", e);
                                return Err(Status::invalid_argument(format!(
                                    "invalid blob: {e}"
                                )));
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

            if !blobs.is_empty() {
                let height = storage.store_blobs(&blobs).await.map_err(|e| {
                    error!("Failed to store blobs: {}", e);
                    Status::internal(format!("storage error: {e}"))
                })?;
                info!("Stored {} blobs at height {}", blobs.len(), height);
            }

            let tx_response = TxResponse {
                height: 0,
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
        })
    }
}

fn unimplemented_response() -> http::Response<Body> {
    let mut resp = http::Response::new(Body::empty());
    resp.headers_mut().insert(
        "content-type",
        http::HeaderValue::from_static("application/grpc"),
    );
    resp.headers_mut().insert(
        "grpc-status",
        http::HeaderValue::from_static("12"), // UNIMPLEMENTED
    );
    resp
}
