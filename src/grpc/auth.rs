use std::sync::Arc;

use celestia_proto::cosmos::auth::v1beta1::query_server::{Query, QueryServer};
use celestia_proto::cosmos::auth::v1beta1::{
    AddressBytesToStringRequest, AddressBytesToStringResponse, AddressStringToBytesRequest,
    AddressStringToBytesResponse, BaseAccount, Bech32PrefixRequest, Bech32PrefixResponse,
    QueryAccountAddressByIdRequest, QueryAccountAddressByIdResponse, QueryAccountInfoRequest,
    QueryAccountInfoResponse, QueryAccountRequest, QueryAccountResponse, QueryAccountsRequest,
    QueryAccountsResponse, QueryModuleAccountByNameRequest, QueryModuleAccountByNameResponse,
    QueryModuleAccountsRequest, QueryModuleAccountsResponse, QueryParamsRequest,
    QueryParamsResponse,
};
use prost::Message;
use tendermint_proto::google::protobuf::Any;
use tonic::{Request, Response, Status};

use crate::storage::RedisStorage;

/// gRPC service: cosmos.auth.v1beta1.Query
///
/// Handles the Account query that txclient calls to get sequence/account_number.
#[derive(Clone)]
pub struct AuthQueryService {
    _storage: Arc<RedisStorage>,
}

impl AuthQueryService {
    pub fn new(storage: Arc<RedisStorage>) -> Self {
        Self { _storage: storage }
    }
}

#[tonic::async_trait]
impl Query for AuthQueryService {
    async fn account(
        self: Arc<Self>,
        request: Request<QueryAccountRequest>,
    ) -> Result<Response<QueryAccountResponse>, Status> {
        let address = request.into_inner().address;

        let account = BaseAccount {
            address,
            pub_key: None,
            account_number: 1,
            sequence: 0,
        };

        let any = Any {
            type_url: "/cosmos.auth.v1beta1.BaseAccount".to_string(),
            value: account.encode_to_vec(),
        };

        Ok(Response::new(QueryAccountResponse { account: Some(any) }))
    }

    async fn accounts(
        self: Arc<Self>,
        _request: Request<QueryAccountsRequest>,
    ) -> Result<Response<QueryAccountsResponse>, Status> {
        Err(Status::unimplemented("not supported by localestia"))
    }

    async fn account_address_by_id(
        self: Arc<Self>,
        _request: Request<QueryAccountAddressByIdRequest>,
    ) -> Result<Response<QueryAccountAddressByIdResponse>, Status> {
        Err(Status::unimplemented("not supported by localestia"))
    }

    async fn params(
        self: Arc<Self>,
        _request: Request<QueryParamsRequest>,
    ) -> Result<Response<QueryParamsResponse>, Status> {
        Err(Status::unimplemented("not supported by localestia"))
    }

    async fn module_accounts(
        self: Arc<Self>,
        _request: Request<QueryModuleAccountsRequest>,
    ) -> Result<Response<QueryModuleAccountsResponse>, Status> {
        Err(Status::unimplemented("not supported by localestia"))
    }

    async fn module_account_by_name(
        self: Arc<Self>,
        _request: Request<QueryModuleAccountByNameRequest>,
    ) -> Result<Response<QueryModuleAccountByNameResponse>, Status> {
        Err(Status::unimplemented("not supported by localestia"))
    }

    async fn bech32_prefix(
        self: Arc<Self>,
        _request: Request<Bech32PrefixRequest>,
    ) -> Result<Response<Bech32PrefixResponse>, Status> {
        Err(Status::unimplemented("not supported by localestia"))
    }

    async fn address_bytes_to_string(
        self: Arc<Self>,
        _request: Request<AddressBytesToStringRequest>,
    ) -> Result<Response<AddressBytesToStringResponse>, Status> {
        Err(Status::unimplemented("not supported by localestia"))
    }

    async fn address_string_to_bytes(
        self: Arc<Self>,
        _request: Request<AddressStringToBytesRequest>,
    ) -> Result<Response<AddressStringToBytesResponse>, Status> {
        Err(Status::unimplemented("not supported by localestia"))
    }

    async fn account_info(
        self: Arc<Self>,
        _request: Request<QueryAccountInfoRequest>,
    ) -> Result<Response<QueryAccountInfoResponse>, Status> {
        Err(Status::unimplemented("not supported by localestia"))
    }
}

pub fn service(storage: Arc<RedisStorage>) -> QueryServer<AuthQueryService> {
    QueryServer::new(AuthQueryService::new(storage))
}
