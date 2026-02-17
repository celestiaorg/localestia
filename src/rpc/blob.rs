use celestia_rpc::BlobRpcServer;
use celestia_rpc::TxConfig;
use celestia_types::blob::Blob;
use celestia_types::blob::Commitment;
use celestia_types::nmt::Namespace;
use celestia_types::nmt::NamespaceProof;
use jsonrpsee::core::{async_trait as jsonrpsee_async_trait, RpcResult};

use crate::rpc::{rpc_error, LocalestiaServer};

// Implementation of the combined RPC service
#[jsonrpsee_async_trait]
impl BlobRpcServer for LocalestiaServer {
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
            .map_err(|e| rpc_error(format!("Failed to get blob: {}", e)))
    }

    async fn blob_submit(&self, blobs: Vec<Blob>, _opts: TxConfig) -> RpcResult<u64> {
        self.storage
            .store_blobs(&blobs)
            .await
            .map_err(|e| rpc_error(format!("Failed to store blob: {}", e)))
    }

    async fn blob_included(
        &self,
        height: u64,
        namespace: Namespace,
        proof: NamespaceProof,
        commitment: Commitment,
    ) -> RpcResult<bool> {
        self.storage
            .blob_included(height, &namespace, &proof, &commitment)
            .await
            .map_err(|e| rpc_error(format!("Failed to check blob inclusion: {}", e)))
    }

    async fn blob_get_all(
        &self,
        height: u64,
        namespaces: Vec<Namespace>,
    ) -> RpcResult<Option<Vec<Blob>>> {
        match self.storage.get_all_blobs(height, namespaces).await {
            Ok(blobs) => Ok(Some(blobs)),
            Err(err) => Err(rpc_error(format!("Failed to get blob: {}", err))),
        }
    }

    async fn blob_get_proof(
        &self,
        height: u64,
        namespace: Namespace,
        commitment: Commitment,
    ) -> RpcResult<Vec<NamespaceProof>> {
        self.storage
            .get_blob_proof(height, &namespace, &commitment)
            .await
            .map_err(|e| rpc_error(format!("Failed to get blob proof: {}", e)))
    }
}

// // Header methods implementation
// async fn header_get_by_hash(&self, hash: Hash) -> RpcResult<ExtendedHeader> {
//     self.storage
//         .get_header_by_hash(&hash)
//         .await
//         .map_err(|e| jsonrpsee::core::Error::Custom(format!("Failed to get header: {}", e)))
// }

// async fn header_get_by_height(&self, height: u64) -> RpcResult<ExtendedHeader> {
//     self.storage
//         .get_header_by_height(height)
//         .await
//         .map_err(|e| jsonrpsee::core::Error::Custom(format!("Failed to get header: {}", e)))
// }

// async fn header_get_range_by_height(
//     &self,
//     from: u64,
//     to: u64,
// ) -> RpcResult<Vec<ExtendedHeader>> {
//     self.storage
//         .get_headers_by_range(from, to)
//         .await
//         .map_err(|e| jsonrpsee::core::Error::Custom(format!("Failed to get headers: {}", e)))
// }

// async fn header_wait_for_height(&self, height: u64) -> RpcResult<ExtendedHeader> {
//     self.storage.wait_for_header(height).await.map_err(|e| {
//         jsonrpsee::core::Error::Custom(format!("Failed to wait for header: {}", e))
//     })
// }

// async fn share_get_eds(&self, height: u64) -> RpcResult<ExtendedDataSquare> {
//     self.storage
//         .get_eds_at_height(height)
//         .await
//         .map_err(|e| jsonrpsee::core::Error::Custom(format!("Failed to get EDS: {}", e)))
// }

// async fn share_get_range(
//     &self,
//     height: u64,
//     start: u64,
//     end: u64,
// ) -> RpcResult<GetRangeResponse> {
//     self.storage
//         .get_share_range(height, start, end)
//         .await
//         .map_err(|e| {
//             jsonrpsee::core::Error::Custom(format!("Failed to get share range: {}", e))
//         })
// }
