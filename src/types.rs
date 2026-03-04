pub const GENESIS_HEIGHT: u64 = 1;

// Structure to track blob indexes
#[derive(Debug)]
pub struct BlobIndexInfo {
    pub blob_key: String,
    pub namespace: Vec<u8>,
    pub commitment: Vec<u8>,
    pub start_idx: usize,
    pub end_idx: usize,
}
