use celestia_rpc::BlobstreamRpcServer;
use celestia_types::hash::Hash;
use celestia_types::MerkleProof;
use jsonrpsee::core::{async_trait as jsonrpsee_async_trait, RpcResult};

use crate::rpc::{rpc_error, LocalestiaServer};

const DATA_ROOT_TUPLE_ROOT_BLOCKS_LIMIT: u64 = 10_000;

fn encode_data_root_tuple(height: u64, data_root: Hash) -> Result<Vec<u8>, String> {
    let data_root = match data_root {
        Hash::Sha256(bytes) => bytes,
        Hash::None => return Err("data root hash is empty".to_string()),
    };

    let mut encoded = vec![0u8; 32];
    encoded[24..].copy_from_slice(&height.to_be_bytes());
    encoded.extend_from_slice(&data_root);
    Ok(encoded)
}

async fn validate_data_root_tuple_root_range(
    server: &LocalestiaServer,
    start: u64,
    end: u64,
) -> Result<(), String> {
    if start == 0 {
        return Err("start height must be greater than zero".to_string());
    }
    if start >= end {
        return Err("end block is smaller or equal to the start block".to_string());
    }

    let heights_range = end - start;
    if heights_range > DATA_ROOT_TUPLE_ROOT_BLOCKS_LIMIT {
        return Err(format!(
            "the query exceeds the limit of allowed blocks {}",
            DATA_ROOT_TUPLE_ROOT_BLOCKS_LIMIT
        ));
    }

    let current_height = server.storage.get_current_height().await.map_err(|e| {
        format!("could not get local head to validate the data root tuple range: {e}")
    })?;

    if end > current_height.saturating_add(1) {
        return Err(format!(
            "end block {end} is higher than local chain height {current_height}. Wait for the node until it syncs up to {end}",
        ));
    }

    Ok(())
}

async fn fetch_encoded_data_root_tuples(
    server: &LocalestiaServer,
    start: u64,
    end: u64,
) -> Result<Vec<Vec<u8>>, String> {
    let mut encoded = Vec::with_capacity((end - start) as usize);
    for height in start..end {
        let header = server
            .storage
            .get_header_by_height(height)
            .await
            .map_err(|e| format!("failed to get header at height {height}: {e}"))?;
        let tuple = encode_data_root_tuple(height, header.dah.hash())?;
        encoded.push(tuple);
    }

    Ok(encoded)
}

#[jsonrpsee_async_trait]
impl BlobstreamRpcServer for LocalestiaServer {
    async fn blobstream_get_data_root_tuple_root(&self, start: u64, end: u64) -> RpcResult<String> {
        validate_data_root_tuple_root_range(self, start, end)
            .await
            .map_err(rpc_error)?;

        let encoded = fetch_encoded_data_root_tuples(self, start, end)
            .await
            .map_err(rpc_error)?;

        let (_, root) = MerkleProof::new(0, &encoded)
            .map_err(|e| rpc_error(format!("failed to compute data root tuple root: {e}")))?;

        Ok(hex::encode_upper(root))
    }

    async fn blobstream_get_data_root_tuple_inclusion_proof(
        &self,
        height: u64,
        start: u64,
        end: u64,
    ) -> RpcResult<MerkleProof> {
        validate_data_root_tuple_root_range(self, start, end)
            .await
            .map_err(rpc_error)?;

        if height < start || height >= end {
            return Err(rpc_error(format!(
                "height {height} should be in the end exclusive interval first_block {start} last_block {end}",
            )));
        }

        let encoded = fetch_encoded_data_root_tuples(self, start, end)
            .await
            .map_err(rpc_error)?;

        // test and double check this logic
        let index = usize::try_from(height - start)
            .map_err(|_| rpc_error("height offset is out of range"))?;

        let (proof, _) = MerkleProof::new(index, &encoded)
            .map_err(|e| rpc_error(format!("failed to compute data root tuple proof: {e}")))?;

        Ok(proof)
    }
}
