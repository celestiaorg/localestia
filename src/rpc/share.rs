use celestia_rpc::share::{GetRangeResponse, RawGetRowResponse, RowSide, SampleCoordinates};
use celestia_rpc::ShareRpcServer;
use celestia_types::eds::RawExtendedDataSquare;
use celestia_types::namespace_data::NamespaceData;
use celestia_types::nmt::Namespace;
use celestia_types::sample::{RawSample, Sample};
use celestia_types::{AxisType, RawShare};
use jsonrpsee::core::{async_trait as jsonrpsee_async_trait, RpcResult};

use crate::rpc::{rpc_error, LocalestiaServer};

// Implementation of the ShareRPCServer for LocalestiaServer
#[jsonrpsee_async_trait]
impl ShareRpcServer for LocalestiaServer {
    async fn share_get_eds(&self, height: u64) -> RpcResult<RawExtendedDataSquare> {
        self.storage
            .get_eds_at_height(height)
            .await
            .map(RawExtendedDataSquare::from)
            .map_err(|e| rpc_error(format!("Failed to get EDS: {}", e)))
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
            .map_err(|e| rpc_error(format!("Failed to get share range: {}", e)))
    }

    async fn share_get_samples(
        &self,
        height: u64,
        indices: Vec<SampleCoordinates>,
    ) -> RpcResult<Vec<RawSample>> {
        let eds = self
            .storage
            .get_eds_at_height(height)
            .await
            .map_err(|e| rpc_error(format!("Failed to get samples: {}", e)))?;

        let mut samples = Vec::with_capacity(indices.len());
        for coords in indices {
            let sample = Sample::new(coords.row, coords.column, AxisType::Row, &eds)
                .map_err(|e| rpc_error(format!("Failed to get samples: {}", e)))?;
            samples.push(sample.into());
        }

        Ok(samples)
    }

    async fn share_get_row(&self, height: u64, row: u16) -> RpcResult<RawGetRowResponse> {
        let eds = self
            .storage
            .get_eds_at_height(height)
            .await
            .map_err(|e| rpc_error(format!("Failed to get row: {}", e)))?;

        let mut shares = Vec::with_capacity(eds.square_width().into());
        for col in 0..eds.square_width() {
            let share = eds
                .share(row, col)
                .map_err(|e| rpc_error(format!("Failed to get row: {}", e)))?
                .clone();
            let raw: RawShare = share.into();
            shares.push(raw);
        }

        Ok(RawGetRowResponse::new(shares, RowSide::Both))
    }

    async fn share_get_share(&self, height: u64, row: u16, col: u16) -> RpcResult<RawShare> {
        let eds = self
            .storage
            .get_eds_at_height(height)
            .await
            .map_err(|e| rpc_error(format!("Failed to get share: {}", e)))?;
        let share = eds
            .share(row, col)
            .map_err(|e| rpc_error(format!("Failed to get share: {}", e)))?
            .clone();
        Ok(share.into())
    }

    async fn share_get_namespace_data(
        &self,
        height: u64,
        namespace: Namespace,
    ) -> RpcResult<NamespaceData> {
        let eds = self
            .storage
            .get_eds_at_height(height)
            .await
            .map_err(|e| rpc_error(format!("Failed to get namespace data: {}", e)))?;
        let dah = celestia_types::DataAvailabilityHeader::from_eds(&eds);
        let rows = eds
            .get_namespace_data(namespace, &dah, height)
            .map_err(|e| rpc_error(format!("Failed to get namespace data: {}", e)))?
            .into_iter()
            .map(|(_, row)| row)
            .collect();

        Ok(NamespaceData::new(rows))
    }

    async fn share_shares_available(&self, height: u64) -> RpcResult<()> {
        self.storage
            .get_eds_at_height(height)
            .await
            .map(|_| ())
            .map_err(|e| rpc_error(format!("Failed to check shares availability: {}", e)))
    }
}
