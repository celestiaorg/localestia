use celestia_types::ExtendedHeader;
use jsonrpsee::core::RpcResult;
use jsonrpsee::types::error::{ErrorObjectOwned, CALL_EXECUTION_FAILED_CODE};
use std::sync::Arc;

use crate::storage::RedisStorage;

// Implementation of our RPC service
#[derive(Clone)]
pub struct LocalestiaServer {
    pub storage: Arc<RedisStorage>,
}

impl LocalestiaServer {
    pub fn new(storage: Arc<RedisStorage>) -> Self {
        Self { storage }
    }

    pub async fn get_latest_header(&self) -> RpcResult<ExtendedHeader> {
        return self
            .storage
            .get_latest_head()
            .await
            .map_err(|e| rpc_error(format!("Failed to get header: {}", e)));
    }
}

pub fn rpc_error(message: impl Into<String>) -> ErrorObjectOwned {
    ErrorObjectOwned::owned(CALL_EXECUTION_FAILED_CODE, message.into(), None::<()>)
}
