use celestia_types::hash::Hash;
use celestia_types::nmt::{Namespace, NamespaceProof};
use celestia_types::{Blob, Commitment, ExtendedDataSquare, ExtendedHeader};
use jsonrpsee::proc_macros::rpc;

// Add these imports at the top
use crate::types::GetRangeResponse;

use crate::types::TxConfig;

// Define the RPC interface for all methods
#[rpc(server)]
pub trait CombinedRpc {
    // Blob methods
    #[method(name = "blob.Get")]
    async fn blob_get(
        &self,
        height: u64,
        namespace: Namespace,
        commitment: Commitment,
    ) -> jsonrpsee::core::RpcResult<Blob>;

    #[method(name = "blob.Submit")]
    async fn blob_submit(
        &self,
        blobs: Vec<Blob>,
        opts: TxConfig,
    ) -> jsonrpsee::core::RpcResult<u64>;

    #[method(name = "blob.Included")]
    async fn blob_included(
        &self,
        height: u64,
        namespace: Namespace,
        proof: NamespaceProof,
        commitment: Commitment,
    ) -> jsonrpsee::core::RpcResult<bool>;

    // Header methods
    #[method(name = "header.GetByHash")]
    async fn header_get_by_hash(&self, hash: Hash) -> jsonrpsee::core::RpcResult<ExtendedHeader>;

    #[method(name = "header.GetByHeight")]
    async fn header_get_by_height(&self, height: u64)
        -> jsonrpsee::core::RpcResult<ExtendedHeader>;

    #[method(name = "header.GetRangeByHeight")]
    async fn header_get_range_by_height(
        &self,
        from: u64,
        to: u64,
    ) -> jsonrpsee::core::RpcResult<Vec<ExtendedHeader>>;

    #[method(name = "header.WaitForHeight")]
    async fn header_wait_for_height(
        &self,
        height: u64,
    ) -> jsonrpsee::core::RpcResult<ExtendedHeader>;

    #[method(name = "share.GetEDS")]
    async fn share_get_eds(&self, height: u64) -> jsonrpsee::core::RpcResult<ExtendedDataSquare>;

    #[method(name = "share.GetRange")]
    async fn share_get_range(
        &self,
        height: u64,
        start: u64,
        end: u64,
    ) -> jsonrpsee::core::RpcResult<GetRangeResponse>;
}
