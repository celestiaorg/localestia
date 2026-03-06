mod utils;

use celestia_proto::celestia::core::v1::gas_estimation::{
    gas_estimator_client::GasEstimatorClient, EstimateGasPriceAndUsageRequest,
    EstimateGasPriceRequest,
};
use celestia_proto::celestia::core::v1::tx::{tx_client::TxClient, TxStatusRequest};
use celestia_proto::cosmos::auth::v1beta1::{
    query_client::QueryClient as AuthQueryClient, QueryAccountRequest,
};
use celestia_proto::cosmos::base::tendermint::v1beta1::{
    service_client::ServiceClient as TendermintClient, GetNodeInfoRequest,
};
use celestia_proto::cosmos::tx::v1beta1::{
    service_client::ServiceClient as TxServiceClient, BroadcastTxRequest,
};
use prost::Message;
use tonic::transport::Channel;

async fn grpc_channel(grpc_addr: &str) -> Channel {
    tonic::transport::Endpoint::new(format!("http://{}", grpc_addr))
        .expect("invalid gRPC addr")
        .connect()
        .await
        .expect("failed to connect to gRPC server")
}

#[tokio::test]
async fn test_get_node_info() {
    let ctx = utils::setup_process_grpc().await;
    let mut client = TendermintClient::new(grpc_channel(&ctx.grpc_addr).await);

    let resp = client
        .get_node_info(GetNodeInfoRequest {})
        .await
        .expect("GetNodeInfo failed");
    let body = resp.into_inner();

    let node_info = body.default_node_info.expect("missing default_node_info");
    assert_eq!(node_info.moniker, "localestia");
    assert_eq!(node_info.network, "private");

    let version = body.application_version.expect("missing application_version");
    assert_eq!(version.app_name, "localestia");
}

#[tokio::test]
async fn test_account() {
    let ctx = utils::setup_process_grpc().await;
    let mut client = AuthQueryClient::new(grpc_channel(&ctx.grpc_addr).await);

    let resp = client
        .account(QueryAccountRequest {
            address: "cosmos1testaddress".to_string(),
        })
        .await
        .expect("Account failed");
    let body = resp.into_inner();

    let any = body.account.expect("missing account Any");
    assert_eq!(
        any.type_url,
        "/cosmos.auth.v1beta1.BaseAccount",
        "unexpected type_url"
    );

    use celestia_proto::cosmos::auth::v1beta1::BaseAccount;
    let base = BaseAccount::decode(any.value.as_slice()).expect("failed to decode BaseAccount");
    assert_eq!(base.account_number, 1);
    assert_eq!(base.sequence, 0);
}

#[tokio::test]
async fn test_broadcast_tx_empty() {
    let ctx = utils::setup_process_grpc().await;
    let mut client = TxServiceClient::new(grpc_channel(&ctx.grpc_addr).await);

    let resp = client
        .broadcast_tx(BroadcastTxRequest {
            tx_bytes: vec![],
            mode: 0,
        })
        .await
        .expect("BroadcastTx failed");
    let body = resp.into_inner();

    let tx_resp = body.tx_response.expect("missing tx_response");
    assert_eq!(tx_resp.code, 0);
    // Empty tx has no blobs → height 0
    assert_eq!(tx_resp.height, 0);
}

#[tokio::test]
async fn test_tx_status_unknown_returns_committed() {
    let ctx = utils::setup_process_grpc().await;
    let mut client = TxClient::new(grpc_channel(&ctx.grpc_addr).await);

    let resp = client
        .tx_status(TxStatusRequest {
            tx_id: "deadbeef1234".to_string(),
        })
        .await
        .expect("TxStatus failed");
    let body = resp.into_inner();

    // Unknown tx_id falls back to height 1, status always COMMITTED
    assert_eq!(body.status, "COMMITTED");
    assert_eq!(body.height, 1);
}

#[tokio::test]
async fn test_estimate_gas_price() {
    let ctx = utils::setup_process_grpc().await;
    let mut client = GasEstimatorClient::new(grpc_channel(&ctx.grpc_addr).await);

    let resp = client
        .estimate_gas_price(EstimateGasPriceRequest {
            tx_priority: 0,
        })
        .await
        .expect("EstimateGasPrice failed");
    let body = resp.into_inner();

    assert!(
        (body.estimated_gas_price - 0.002).abs() < 1e-9,
        "expected gas price 0.002, got {}",
        body.estimated_gas_price
    );
}

#[tokio::test]
async fn test_estimate_gas_price_and_usage() {
    let ctx = utils::setup_process_grpc().await;
    let mut client = GasEstimatorClient::new(grpc_channel(&ctx.grpc_addr).await);

    let resp = client
        .estimate_gas_price_and_usage(EstimateGasPriceAndUsageRequest {
            tx_bytes: vec![],
            tx_priority: 0,
        })
        .await
        .expect("EstimateGasPriceAndUsage failed");
    let body = resp.into_inner();

    assert!(
        (body.estimated_gas_price - 0.002).abs() < 1e-9,
        "expected gas price 0.002, got {}",
        body.estimated_gas_price
    );
    assert_eq!(body.estimated_gas_used, 500_000);
}
