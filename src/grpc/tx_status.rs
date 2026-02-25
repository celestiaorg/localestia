use std::convert::Infallible;
use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;
use std::task::{Context, Poll};

use celestia_proto::celestia::core::v1::tx::{TxStatusRequest, TxStatusResponse};
use tonic::body::Body;
use tonic::codec::ProstCodec;
use tonic::server::{Grpc, NamedService, UnaryService};
use tonic::{Request, Response, Status};
use tracing::info;

use crate::storage::RedisStorage;

/// gRPC service: celestia.core.v1.tx.Tx
///
/// Handles TxStatus — always returns COMMITTED immediately.
#[derive(Clone)]
pub struct TxStatusService {
    _storage: Arc<RedisStorage>,
}

impl TxStatusService {
    pub fn new(storage: Arc<RedisStorage>) -> Self {
        Self { _storage: storage }
    }
}

impl NamedService for TxStatusService {
    const NAME: &'static str = "celestia.core.v1.tx.Tx";
}

impl tower::Service<http::Request<Body>> for TxStatusService {
    type Response = http::Response<Body>;
    type Error = Infallible;
    type Future = Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>> + Send + 'static>>;

    fn poll_ready(&mut self, _cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        Poll::Ready(Ok(()))
    }

    fn call(&mut self, req: http::Request<Body>) -> Self::Future {
        match req.uri().path() {
            "/celestia.core.v1.tx.Tx/TxStatus" => {
                Box::pin(async move {
                    let mut grpc = Grpc::new(
                        ProstCodec::<TxStatusResponse, TxStatusRequest>::default(),
                    );
                    Ok(grpc.unary(TxStatusHandler, req).await)
                })
            }
            _ => Box::pin(async move { Ok(unimplemented_response()) }),
        }
    }
}

struct TxStatusHandler;

impl UnaryService<TxStatusRequest> for TxStatusHandler {
    type Response = TxStatusResponse;
    type Future =
        Pin<Box<dyn Future<Output = Result<Response<Self::Response>, Status>> + Send + 'static>>;

    fn call(&mut self, req: Request<TxStatusRequest>) -> Self::Future {
        let tx_id = req.into_inner().tx_id;
        Box::pin(async move {
            info!("TxStatus: tx_id={}", tx_id);
            Ok(Response::new(TxStatusResponse {
                height: 1,
                index: 0,
                execution_code: 0,
                error: String::new(),
                status: "COMMITTED".to_string(),
                codespace: String::new(),
                gas_wanted: 0,
                gas_used: 0,
                signers: vec![],
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
