use celestia_types::eds::RawExtendedDataSquare;
use celestia_types::hash::Hash;
use celestia_types::nmt::{Namespace, NamespaceProof};
use celestia_types::{Blob, Commitment, ExtendedDataSquare, ExtendedHeader};
use jsonrpsee::core::{async_trait as jsonrpsee_async_trait, RpcResult};
use std::sync::Arc;

use crate::error::LocalError;
use crate::rpc::api::CombinedRpcServer;
use crate::storage::RedisStorage;
use crate::types::{GetRangeResponse, TxConfig};

// Implementation of our RPC service
pub struct BlobRpcServerImpl {
    pub storage: Arc<RedisStorage>,
}

impl BlobRpcServerImpl {
    pub fn new(storage: Arc<RedisStorage>) -> Self {
        Self { storage }
    }
}

// Implementation of the combined RPC service
#[jsonrpsee_async_trait]
impl CombinedRpcServer for BlobRpcServerImpl {
    // Blob methods implementation
    async fn blob_get(
        &self,
        height: u64,
        namespace: Namespace,
        commitment: Commitment,
    ) -> RpcResult<Blob> {
        self.storage
            .get_blob(height, &namespace, &commitment)
            .await
            .map_err(|e| jsonrpsee::core::Error::Custom(format!("Failed to get blob: {}", e)))
    }

    async fn blob_submit(&self, blobs: Vec<Blob>, _opts: TxConfig) -> RpcResult<u64> {
        let mut height = 0;

        for blob in &blobs {
            height = self.storage.store_blob(blob).await.map_err(|e| {
                jsonrpsee::core::Error::Custom(format!("Failed to store blob: {}", e))
            })?;
        }

        Ok(height)
    }

    async fn blob_included(
        &self,
        height: u64,
        namespace: Namespace,
        _proof: NamespaceProof,
        commitment: Commitment,
    ) -> RpcResult<bool> {
        match self.storage.get_blob(height, &namespace, &commitment).await {
            Ok(_) => Ok(true),
            Err(LocalError::BlobNotFound) => Ok(false), // Return false instead of error
            Err(e) => Err(jsonrpsee::core::Error::Custom(format!(
                "Failed to check blob inclusion: {}",
                e
            ))),
        }
    }

    // Header methods implementation
    async fn header_get_by_hash(&self, hash: Hash) -> RpcResult<ExtendedHeader> {
        self.storage
            .get_header_by_hash(&hash)
            .await
            .map_err(|e| jsonrpsee::core::Error::Custom(format!("Failed to get header: {}", e)))
    }

    async fn header_get_by_height(&self, height: u64) -> RpcResult<ExtendedHeader> {
        self.storage
            .get_header_by_height(height)
            .await
            .map_err(|e| jsonrpsee::core::Error::Custom(format!("Failed to get header: {}", e)))
    }

    async fn header_get_range_by_height(
        &self,
        from: u64,
        to: u64,
    ) -> RpcResult<Vec<ExtendedHeader>> {
        self.storage
            .get_headers_by_range(from, to)
            .await
            .map_err(|e| jsonrpsee::core::Error::Custom(format!("Failed to get headers: {}", e)))
    }

    async fn header_wait_for_height(&self, height: u64) -> RpcResult<ExtendedHeader> {
        self.storage.wait_for_header(height).await.map_err(|e| {
            jsonrpsee::core::Error::Custom(format!("Failed to wait for header: {}", e))
        })
    }

    async fn share_get_eds(&self, height: u64) -> RpcResult<ExtendedDataSquare> {
        self.storage
            .get_eds_at_height(height)
            .await
            .map_err(|e| jsonrpsee::core::Error::Custom(format!("Failed to get EDS: {}", e)))
    }

    async fn share_get_range(
        &self,
        height: u64,
        start: u64,
        end: u64,
    ) -> RpcResult<GetRangeResponse> {
        self.storage
            .get_share_range(height, start, end)
            .await
            .map_err(|e| {
                jsonrpsee::core::Error::Custom(format!("Failed to get share range: {}", e))
            })
    }
}
