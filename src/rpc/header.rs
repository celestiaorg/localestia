use celestia_rpc::HeaderRpcServer;
use celestia_types::hash::Hash;
use celestia_types::{ExtendedHeader, SyncState};
use jsonrpsee::core::{async_trait as jsonrpsee_async_trait, RpcResult};
use tendermint::Time;

use crate::rpc::{rpc_error, LocalestiaServer};

// Implementation of the combined RPC service
#[jsonrpsee_async_trait]
impl HeaderRpcServer for LocalestiaServer {
    // Header methods implementation
    async fn header_get_by_hash(&self, hash: Hash) -> RpcResult<ExtendedHeader> {
        self.storage
            .get_header_by_hash(&hash)
            .await
            .map_err(|e| rpc_error(format!("Failed to get header: {}", e)))
    }

    async fn header_get_by_height(&self, height: u64) -> RpcResult<ExtendedHeader> {
        self.storage
            .get_header_by_height(height)
            .await
            .map_err(|e| rpc_error(format!("Failed to get header: {}", e)))
    }

    async fn header_get_range_by_height(
        &self,
        from: ExtendedHeader,
        to: u64,
    ) -> RpcResult<Vec<ExtendedHeader>> {
        self.storage
            .get_headers_by_range(from.height(), to)
            .await
            .map_err(|e| rpc_error(format!("Failed to get headers: {}", e)))
    }

    async fn header_local_head(&self) -> RpcResult<ExtendedHeader> {
        self.get_latest_header().await
    }

    async fn header_network_head(&self) -> RpcResult<ExtendedHeader> {
        self.get_latest_header().await
    }

    async fn header_sync_state(&self) -> RpcResult<SyncState> {
        let height = self
            .storage
            .get_current_height()
            .await
            .map_err(|e| rpc_error(format!("Failed to get sync state: {}", e)))?;

        if height == 0 {
            let now = Time::now();
            return Ok(SyncState {
                id: 0,
                height: 0,
                from_height: 0,
                to_height: 0,
                from_hash: Hash::None,
                to_hash: Hash::None,
                start: now,
                end: now,
                error: None,
            });
        }

        let head = self
            .storage
            .get_header_by_height(height)
            .await
            .map_err(|e| rpc_error(format!("Failed to get sync state: {}", e)))?;

        let now = Time::now();
        Ok(SyncState {
            id: 0,
            height,
            from_height: height,
            to_height: height,
            from_hash: head.hash(),
            to_hash: head.hash(),
            start: now,
            end: now,
            error: None,
        })
    }

    async fn header_sync_wait(&self) -> RpcResult<()> {
        let height = self
            .storage
            .get_current_height()
            .await
            .map_err(|e| rpc_error(format!("Failed to sync headers: {}", e)))?;

        if height == 0 {
            return Ok(());
        }

        self.storage
            .wait_for_header(height)
            .await
            .map_err(|e| rpc_error(format!("Failed to sync headers: {}", e)))?;

        Ok(())
    }

    async fn header_wait_for_height(&self, height: u64) -> RpcResult<ExtendedHeader> {
        self.storage
            .wait_for_header(height)
            .await
            .map_err(|e| rpc_error(format!("Failed to wait for header: {}", e)))
    }
}
