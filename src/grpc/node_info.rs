use std::sync::Arc;

use celestia_proto::cosmos::base::tendermint::v1beta1::service_server::{
    Service as TendermintService, ServiceServer as TendermintServiceServer,
};
use celestia_proto::cosmos::base::tendermint::v1beta1::{
    AbciQueryRequest, AbciQueryResponse, GetBlockByHeightRequest, GetBlockByHeightResponse,
    GetLatestBlockRequest, GetLatestBlockResponse, GetLatestValidatorSetRequest,
    GetLatestValidatorSetResponse, GetNodeInfoRequest, GetNodeInfoResponse, GetSyncingRequest,
    GetSyncingResponse, GetValidatorSetByHeightRequest, GetValidatorSetByHeightResponse,
    VersionInfo,
};
use tendermint_proto::v0_38::p2p::DefaultNodeInfo;
use tonic::{Request, Response, Status};

use crate::storage::RedisStorage;

/// gRPC service: cosmos.base.tendermint.v1beta1.Service
///
/// Only handles GetNodeInfo, which txclient calls during initialization.
#[derive(Clone)]
pub struct NodeInfoService {
    _storage: Arc<RedisStorage>,
}

impl NodeInfoService {
    pub fn new(storage: Arc<RedisStorage>) -> Self {
        Self { _storage: storage }
    }
}

#[tonic::async_trait]
impl TendermintService for NodeInfoService {
    async fn get_node_info(
        self: Arc<Self>,
        _request: Request<GetNodeInfoRequest>,
    ) -> Result<Response<GetNodeInfoResponse>, Status> {
        Ok(Response::new(GetNodeInfoResponse {
            default_node_info: Some(DefaultNodeInfo {
                network: "private".to_string(),
                moniker: "localestia".to_string(),
                ..Default::default()
            }),
            application_version: Some(VersionInfo {
                name: "localestia".to_string(),
                app_name: "localestia".to_string(),
                version: "0.1.0".to_string(),
                git_commit: String::new(),
                build_tags: String::new(),
                go_version: String::new(),
                build_deps: vec![],
                cosmos_sdk_version: String::new(),
            }),
        }))
    }

    async fn get_syncing(
        self: Arc<Self>,
        _request: Request<GetSyncingRequest>,
    ) -> Result<Response<GetSyncingResponse>, Status> {
        Err(Status::unimplemented("not supported by localestia"))
    }

    async fn get_latest_block(
        self: Arc<Self>,
        _request: Request<GetLatestBlockRequest>,
    ) -> Result<Response<GetLatestBlockResponse>, Status> {
        Err(Status::unimplemented("not supported by localestia"))
    }

    async fn get_block_by_height(
        self: Arc<Self>,
        _request: Request<GetBlockByHeightRequest>,
    ) -> Result<Response<GetBlockByHeightResponse>, Status> {
        Err(Status::unimplemented("not supported by localestia"))
    }

    async fn get_latest_validator_set(
        self: Arc<Self>,
        _request: Request<GetLatestValidatorSetRequest>,
    ) -> Result<Response<GetLatestValidatorSetResponse>, Status> {
        Err(Status::unimplemented("not supported by localestia"))
    }

    async fn get_validator_set_by_height(
        self: Arc<Self>,
        _request: Request<GetValidatorSetByHeightRequest>,
    ) -> Result<Response<GetValidatorSetByHeightResponse>, Status> {
        Err(Status::unimplemented("not supported by localestia"))
    }

    async fn abci_query(
        self: Arc<Self>,
        _request: Request<AbciQueryRequest>,
    ) -> Result<Response<AbciQueryResponse>, Status> {
        Err(Status::unimplemented("not supported by localestia"))
    }
}

pub fn service(storage: Arc<RedisStorage>) -> TendermintServiceServer<NodeInfoService> {
    TendermintServiceServer::new(NodeInfoService::new(storage))
}
