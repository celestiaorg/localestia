use thiserror::Error;

#[derive(Error, Debug)]
pub enum LocalError {
    #[error("Redis error: {0}")]
    RedisError(#[from] redis::RedisError),

    #[error("Serialization error: {0}")]
    SerializationError(#[from] serde_json::Error),

    #[error("Blob not found")]
    BlobNotFound,

    #[error("Invalid namespace: {0}")]
    InvalidNamespace(String),

    #[error("Transaction error: {0}")]
    TransactionError(String),

    #[error("Header not found")]
    HeaderNotFound,

    #[error("Invalid header range")]
    InvalidHeaderRange,

    #[error("Header timeout error")]
    HeaderTimeoutError,
}
