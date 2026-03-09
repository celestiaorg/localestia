use std::sync::Arc;

use celestia_proto::celestia::core::v1::gas_estimation::gas_estimator_server::{
    GasEstimator, GasEstimatorServer,
};
use celestia_proto::celestia::core::v1::gas_estimation::{
    EstimateGasPriceAndUsageRequest, EstimateGasPriceAndUsageResponse, EstimateGasPriceRequest,
    EstimateGasPriceResponse,
};
use tonic::{Request, Response, Status};
use tracing::info;

use crate::storage::RedisStorage;

// Fixed gas price returned to txclient (utia per gas unit)
const FIXED_GAS_PRICE: f64 = 0.002;
// Fixed gas estimate for blob transactions
const FIXED_GAS_USED: u64 = 500_000;

/// gRPC service: celestia.core.v1.gas_estimation.GasEstimator
///
/// Returns fixed gas price and usage estimates so the txclient can
/// construct a signed transaction without hitting a real Celestia node.
#[derive(Clone)]
pub struct GasEstimatorService {
    _storage: Arc<RedisStorage>,
}

impl GasEstimatorService {
    pub fn new(storage: Arc<RedisStorage>) -> Self {
        Self { _storage: storage }
    }
}

#[tonic::async_trait]
impl GasEstimator for GasEstimatorService {
    async fn estimate_gas_price(
        self: Arc<Self>,
        _request: Request<EstimateGasPriceRequest>,
    ) -> Result<Response<EstimateGasPriceResponse>, Status> {
        info!("EstimateGasPrice: returning fixed price {}", FIXED_GAS_PRICE);
        Ok(Response::new(EstimateGasPriceResponse {
            estimated_gas_price: FIXED_GAS_PRICE,
        }))
    }

    async fn estimate_gas_price_and_usage(
        self: Arc<Self>,
        _request: Request<EstimateGasPriceAndUsageRequest>,
    ) -> Result<Response<EstimateGasPriceAndUsageResponse>, Status> {
        info!(
            "EstimateGasPriceAndUsage: returning price={} gas={}",
            FIXED_GAS_PRICE, FIXED_GAS_USED
        );
        Ok(Response::new(EstimateGasPriceAndUsageResponse {
            estimated_gas_price: FIXED_GAS_PRICE,
            estimated_gas_used: FIXED_GAS_USED,
        }))
    }
}

pub fn service(storage: Arc<RedisStorage>) -> GasEstimatorServer<GasEstimatorService> {
    GasEstimatorServer::new(GasEstimatorService::new(storage))
}
