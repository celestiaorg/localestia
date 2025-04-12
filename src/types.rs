use celestia_types::Blob;
use serde::{Deserialize, Serialize};

pub const GENESIS_HEIGHT: u64 = 1;

// TxConfig matches the expected format from Celestia clients
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TxConfig {
    pub gas_limit: Option<u64>,
    pub fee: Option<u64>,
    pub memo: Option<String>,
}

impl Default for TxConfig {
    fn default() -> Self {
        Self {
            gas_limit: None,
            fee: None,
            memo: None,
        }
    }
}

// Response type for blob.Subscribe notifications
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct BlobsAtHeight {
    pub blobs: Option<Vec<Blob>>,
    pub height: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RawExtendedDataSquare {
    pub square_size: u64,
    pub shares: Vec<Vec<u8>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetRangeResponse {
    pub shares: Vec<Vec<u8>>,
}

// Structure to track blob indexes
#[derive(Debug)]
pub struct BlobIndexInfo {
    pub blob_key: String,
    pub namespace: Vec<u8>,
    pub commitment: Vec<u8>,
    pub start_idx: usize,
    pub end_idx: usize,
}
