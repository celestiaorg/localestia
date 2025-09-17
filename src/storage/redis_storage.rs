use std::collections::HashMap;

use celestia_types::consts::appconsts::SHARE_SIZE;
use celestia_types::consts::data_availability_header::MIN_EXTENDED_SQUARE_WIDTH;
use celestia_types::eds::RawExtendedDataSquare;
use celestia_types::hash::Hash;
use celestia_types::nmt::NS_SIZE;
use celestia_types::{nmt::Namespace, Blob, Commitment};
use celestia_types::{
    AppVersion, DataAvailabilityHeader, ExtendedDataSquare, ExtendedHeader, InfoByte,
};
use hex::ToHex;
use redis::AsyncCommands;
use tokio::sync::Mutex;
use tracing::{error, info};

use crate::error::LocalError;
use crate::types::BlobIndexInfo;
use crate::utils::header_utils::generate_new;

// Redis-backed storage for blobs
pub struct RedisStorage {
    client: redis::Client,
    conn: Mutex<Option<redis::aio::Connection>>,
    current_height: Mutex<u64>,
}

impl RedisStorage {
    pub fn new(redis_url: &str) -> Result<Self, LocalError> {
        let client = redis::Client::open(redis_url).map_err(LocalError::RedisError)?;

        Ok(Self {
            client,
            conn: Mutex::new(None),
            current_height: Mutex::new(0),
        })
    }

    pub async fn connect(&self) -> Result<(), LocalError> {
        let mut conn_guard = self.conn.lock().await;
        if conn_guard.is_none() {
            let conn = self
                .client
                .get_async_connection()
                .await
                .map_err(LocalError::RedisError)?;
            *conn_guard = Some(conn);
        }
        Ok(())
    }

    async fn increment_height(&self) -> Result<u64, LocalError> {
        let mut height_guard = self.current_height.lock().await;
        *height_guard += 1;
        Ok(*height_guard)
    }

    async fn get_current_height(&self) -> Result<u64, LocalError> {
        let height_guard = self.current_height.lock().await;
        Ok(*height_guard)
    }

    /// TODO: currently only 1 namespace and blob per height, support multiple
    async fn get_namespace_at_height(&self, height: u64) -> Result<Namespace, LocalError> {
        info!("Getting namespaces at height {}", height);

        // Get a fresh connection
        let mut conn = self.client.get_async_connection().await.map_err(|e| {
            error!("Failed to get Redis connection: {}", e);
            LocalError::RedisError(e)
        })?;

        let height_namespaces_key = format!("height_namespaces:{}", height);

        // Get all namespace hex strings for this height with timeout
        let ns_hex_value: String = match tokio::time::timeout(
            std::time::Duration::from_secs(5),
            conn.get(&height_namespaces_key),
        )
        .await
        {
            Ok(result) => result.map_err(|e| {
                error!("Failed to get namespace members: {}", e);
                LocalError::RedisError(e)
            })?,
            Err(_) => {
                error!("Timeout getting namespace members");
                return Err(LocalError::RedisError(redis::RedisError::from(
                    std::io::Error::new(
                        std::io::ErrorKind::TimedOut,
                        "Redis operation timed out when getting namespace members",
                    ),
                )));
            }
        };

        info!("Got Namespace: {:?}", ns_hex_value);

        // Convert hex strings back to Namespace objects
        let ns_bytes = hex::decode(ns_hex_value).unwrap();
        let namespace = Namespace::from_raw(&ns_bytes).unwrap();

        Ok(namespace)
    }

    pub async fn store_blob(&self, blob: &Blob) -> Result<u64, LocalError> {
        info!("Starting to store blob...");

        // Get the current height or increment for a new submission
        let height = self.increment_height().await?;
        info!("Assigned height: {}", height);

        // Generate keys for storage
        let ns_hex: String = blob.namespace.encode_hex();

        // Use a stable commitment method
        let commitment = if blob.commitment.hash().is_empty() {
            use std::collections::hash_map::DefaultHasher;
            use std::hash::{Hash, Hasher};

            let mut hasher = DefaultHasher::new();
            blob.data.hash(&mut hasher);
            hasher.finish().to_be_bytes().to_vec()
        } else {
            blob.commitment.hash().to_vec().clone()
        };

        let commitment_hex = hex::encode(&commitment);
        let blob_key = format!("blob:{}:{}:{}", height, ns_hex, commitment_hex);
        let ns_key = format!("namespace:{}:{}", height, ns_hex);
        let commitment_key = format!("commitment:{}:{}:{}", height, ns_hex, commitment_hex);
        let height_namespaces_key = format!("height_namespaces:{}", height);

        // Serialize the blob
        let serialized = serde_json::to_string(blob).map_err(LocalError::SerializationError)?;

        // Get a fresh Redis connection for all operations
        let mut conn = self.client.get_async_connection().await.map_err(|e| {
            error!("Failed to get Redis connection: {}", e);
            LocalError::RedisError(e)
        })?;

        // Store the blob with timeout
        match tokio::time::timeout(
            std::time::Duration::from_secs(5),
            conn.set::<_, _, ()>(&blob_key, &serialized),
        )
        .await
        {
            Ok(result) => result.map_err(|e| {
                error!("Failed to store blob data: {}", e);
                LocalError::RedisError(e)
            })?,
            Err(_) => {
                error!("Timeout storing blob data");
                return Err(LocalError::RedisError(redis::RedisError::from(
                    std::io::Error::new(
                        std::io::ErrorKind::TimedOut,
                        "Redis operation timed out when storing blob data",
                    ),
                )));
            }
        }
        info!("Stored blob data");

        // Store reference in namespace index with timeout
        match tokio::time::timeout(
            std::time::Duration::from_secs(5),
            conn.sadd::<_, _, ()>(&ns_key, &blob_key),
        )
        .await
        {
            Ok(result) => result.map_err(|e| {
                error!("Failed to store namespace reference: {}", e);
                LocalError::RedisError(e)
            })?,
            Err(_) => {
                error!("Timeout storing namespace reference");
                return Err(LocalError::RedisError(redis::RedisError::from(
                    std::io::Error::new(
                        std::io::ErrorKind::TimedOut,
                        "Redis operation timed out when storing namespace reference",
                    ),
                )));
            }
        }
        info!("Stored namespace reference");

        // Store reference by commitment with timeout
        match tokio::time::timeout(
            std::time::Duration::from_secs(5),
            conn.set::<_, _, ()>(&commitment_key, &blob_key),
        )
        .await
        {
            Ok(result) => result.map_err(|e| {
                error!("Failed to store commitment reference: {}", e);
                LocalError::RedisError(e)
            })?,
            Err(_) => {
                error!("Timeout storing commitment reference");
                return Err(LocalError::RedisError(redis::RedisError::from(
                    std::io::Error::new(
                        std::io::ErrorKind::TimedOut,
                        "Redis operation timed out when storing commitment reference",
                    ),
                )));
            }
        }
        info!("Stored commitment reference");

        // Track this namespace at this height with timeout
        match tokio::time::timeout(
            std::time::Duration::from_secs(5),
            conn.set::<_, _, ()>(&height_namespaces_key, &ns_hex),
        )
        .await
        {
            Ok(result) => result.map_err(|e| {
                error!("Failed to track namespace: {}", e);
                LocalError::RedisError(e)
            })?,
            Err(_) => {
                error!("Timeout tracking namespace");
                return Err(LocalError::RedisError(redis::RedisError::from(
                    std::io::Error::new(
                        std::io::ErrorKind::TimedOut,
                        "Redis operation timed out when tracking namespace",
                    ),
                )));
            }
        }
        info!("Tracked namespace");

        info!("Successfully stored blob at height {}", height);
        Ok(height)
    }

    pub async fn get_blob(
        &self,
        height: u64,
        namespace: &Namespace,
        commitment: &Commitment,
    ) -> Result<Blob, LocalError> {
        info!(
            "Getting blob at height {} for namespace {}",
            height,
            hex::encode(namespace.as_bytes())
        );

        // fetch eds so that blobs are assigned an index
        self.get_eds_at_height(height).await?;

        // Get a fresh connection
        let mut conn = self.client.get_async_connection().await.map_err(|e| {
            error!("Failed to get Redis connection: {}", e);
            LocalError::RedisError(e)
        })?;

        let ns_hex = hex::encode(namespace.as_bytes());
        let commitment_hex = hex::encode(commitment.hash());

        // Get the blob key using the commitment index with timeout
        let commitment_key = format!("commitment:{}:{}:{}", height, ns_hex, commitment_hex);
        let blob_key: Option<String> = match tokio::time::timeout(
            std::time::Duration::from_secs(5),
            conn.get(&commitment_key),
        )
        .await
        {
            Ok(result) => result.map_err(|e| {
                error!("Failed to get blob key: {}", e);
                LocalError::RedisError(e)
            })?,
            Err(_) => {
                error!("Timeout getting blob key");
                return Err(LocalError::RedisError(redis::RedisError::from(
                    std::io::Error::new(
                        std::io::ErrorKind::TimedOut,
                        "Redis operation timed out when getting blob key",
                    ),
                )));
            }
        };

        let blob_key = blob_key.ok_or(LocalError::BlobNotFound)?;

        // Get the blob data with timeout
        let blob_data: Option<String> = match tokio::time::timeout(
            std::time::Duration::from_secs(5),
            conn.get(&blob_key),
        )
        .await
        {
            Ok(result) => result.map_err(|e| {
                error!("Failed to get blob data: {}", e);
                LocalError::RedisError(e)
            })?,
            Err(_) => {
                error!("Timeout getting blob data");
                return Err(LocalError::RedisError(redis::RedisError::from(
                    std::io::Error::new(
                        std::io::ErrorKind::TimedOut,
                        "Redis operation timed out when getting blob data",
                    ),
                )));
            }
        };

        let blob_data = blob_data.ok_or(LocalError::BlobNotFound)?;

        // Deserialize the blob
        let blob: Blob =
            serde_json::from_str(&blob_data).map_err(LocalError::SerializationError)?;

        // Verify the blob has an index
        if blob.index.is_none() {
            error!("Blob found but has no index, which should have been set by EDS generation");
            // Force a regeneration of the EDS to try again
            self.get_eds_at_height(height).await?;

            // Re-fetch the blob to get the updated version
            let blob_data: Option<String> =
                conn.get(&blob_key).await.map_err(LocalError::RedisError)?;
            let blob_data = blob_data.ok_or(LocalError::BlobNotFound)?;
            let blob: Blob =
                serde_json::from_str(&blob_data).map_err(LocalError::SerializationError)?;

            if blob.index.is_none() {
                return Err(LocalError::TransactionError(
                    "Failed to set blob index".to_string(),
                ));
            }
        }

        Ok(blob)
    }

    pub async fn get_all_blobs(
        &self,
        height: u64,
        namespace: Namespace,
    ) -> Result<Vec<Blob>, LocalError> {
        info!("Getting all blobs at height {} ", height);

        // Get a fresh connection
        let mut conn = self.client.get_async_connection().await.map_err(|e| {
            error!("Failed to get Redis connection: {}", e);
            LocalError::RedisError(e)
        })?;

        let mut all_blobs = Vec::new();

        let ns_hex = hex::encode(namespace.as_bytes());
        let ns_key = format!("namespace:{}:{}", height, ns_hex);

        // Get all blob keys for this namespace with timeout
        let blob_keys: Vec<String> =
            match tokio::time::timeout(std::time::Duration::from_secs(5), conn.smembers(&ns_key))
                .await
            {
                Ok(result) => result.map_err(|e| {
                    error!("Failed to get blob keys: {}", e);
                    LocalError::RedisError(e)
                })?,
                Err(_) => {
                    error!("Timeout getting blob keys");
                    return Err(LocalError::RedisError(redis::RedisError::from(
                        std::io::Error::new(
                            std::io::ErrorKind::TimedOut,
                            "Redis operation timed out when getting blob keys",
                        ),
                    )));
                }
            };

        for blob_key in &blob_keys {
            // Get blob data with timeout
            let blob_data: Option<String> =
                match tokio::time::timeout(std::time::Duration::from_secs(5), conn.get(blob_key))
                    .await
                {
                    Ok(result) => result.map_err(|e| {
                        error!("Failed to get blob data: {}", e);
                        LocalError::RedisError(e)
                    })?,
                    Err(_) => {
                        error!("Timeout getting blob data");
                        return Err(LocalError::RedisError(redis::RedisError::from(
                            std::io::Error::new(
                                std::io::ErrorKind::TimedOut,
                                "Redis operation timed out when getting blob data",
                            ),
                        )));
                    }
                };

            for blob_key in &blob_keys {
                info!("Processing blob key: {}", blob_key);
            }

            if let Some(blob_data) = blob_data {
                match serde_json::from_str::<Blob>(&blob_data) {
                    Ok(blob) => {
                        info!(
                            "Deserialized blob from key {}: index={:?}, namespace={}",
                            blob_key,
                            blob.index,
                            hex::encode(blob.namespace.as_bytes())
                        );
                        all_blobs.push(blob);
                    }
                    Err(e) => {
                        error!("Failed to deserialize blob: {}", e);
                        return Err(LocalError::SerializationError(e));
                    }
                }
            }
        }

        Ok(all_blobs)
    }

    pub async fn store_header(&self, header: &ExtendedHeader) -> Result<u64, LocalError> {
        let height = header.height();
        info!("Storing header at height {}", height.value());

        // Get a fresh connection
        let mut conn = self.client.get_async_connection().await.map_err(|e| {
            error!("Failed to get Redis connection: {}", e);
            LocalError::RedisError(e)
        })?;

        let hash = header.hash();
        let hash_hex = hex::encode(hash.as_bytes());

        // Keys for storage
        let header_key = format!("header:{}", height);
        let hash_key = format!("header_hash:{}", hash_hex);

        // Serialize the header
        let serialized = serde_json::to_string(header).map_err(LocalError::SerializationError)?;

        // Store the header by height with timeout
        match tokio::time::timeout(
            std::time::Duration::from_secs(5),
            conn.set::<_, _, ()>(&header_key, &serialized),
        )
        .await
        {
            Ok(result) => result.map_err(|e| {
                error!("Failed to store header: {}", e);
                LocalError::RedisError(e)
            })?,
            Err(_) => {
                error!("Timeout storing header");
                return Err(LocalError::RedisError(redis::RedisError::from(
                    std::io::Error::new(
                        std::io::ErrorKind::TimedOut,
                        "Redis operation timed out when storing header",
                    ),
                )));
            }
        };

        // Store reference by hash with timeout
        match tokio::time::timeout(
            std::time::Duration::from_secs(5),
            conn.set::<_, _, ()>(&hash_key, &header_key),
        )
        .await
        {
            Ok(result) => result.map_err(|e| {
                error!("Failed to store header hash reference: {}", e);
                LocalError::RedisError(e)
            })?,
            Err(_) => {
                error!("Timeout storing header hash reference");
                return Err(LocalError::RedisError(redis::RedisError::from(
                    std::io::Error::new(
                        std::io::ErrorKind::TimedOut,
                        "Redis operation timed out when storing header hash reference",
                    ),
                )));
            }
        };

        // Update current height if this is higher
        let mut height_guard = self.current_height.lock().await;
        if height.value() > *height_guard {
            *height_guard = height.value();
        }

        Ok(height.value())
    }

    pub async fn get_header_by_height(&self, height: u64) -> Result<ExtendedHeader, LocalError> {
        info!("Getting header at height {}", height);

        if height == 0 {
            return Err(LocalError::HeaderNotFound);
        }

        // Header not found, check if this height is valid
        let current_height = self.get_current_height().await?;
        if height > current_height {
            return Err(LocalError::HeaderNotFound);
        }

        // Get a fresh connection
        let mut conn = self.client.get_async_connection().await.map_err(|e| {
            error!("Failed to get Redis connection: {}", e);
            LocalError::RedisError(e)
        })?;

        let header_key = format!("header:{}", height);
        let header_data: Option<String> = conn
            .get(&header_key)
            .await
            .map_err(LocalError::RedisError)?;

        // If we found a stored header, return it
        if let Some(header_data) = header_data {
            let header: ExtendedHeader =
                serde_json::from_str(&header_data).map_err(LocalError::SerializationError)?;
            return Ok(header);
        }

        let eds = self.get_eds_at_height(height).await.unwrap();

        let dah = DataAvailabilityHeader::from_eds(&eds);

        // Create the header
        let extended_header = generate_new(height, tendermint::Time::now(), Some(dah));

        // Store the header for future requests
        self.store_header(&extended_header).await?;

        info!("Succesfully stored header for height: {:?}", height);

        Ok(extended_header)
    }

    pub async fn get_header_by_hash(&self, hash: &Hash) -> Result<ExtendedHeader, LocalError> {
        info!("Getting header by hash {}", hex::encode(hash.as_bytes()));

        // Get a fresh connection
        let mut conn = self.client.get_async_connection().await.map_err(|e| {
            error!("Failed to get Redis connection: {}", e);
            LocalError::RedisError(e)
        })?;

        let hash_hex = hex::encode(hash.as_bytes());
        let hash_key = format!("header_hash:{}", hash_hex);

        // Get the header key using the hash index
        let header_key: Option<String> =
            conn.get(&hash_key).await.map_err(LocalError::RedisError)?;

        if let Some(header_key) = header_key {
            // Get the header data
            let header_data: Option<String> = conn
                .get(&header_key)
                .await
                .map_err(LocalError::RedisError)?;

            if let Some(header_data) = header_data {
                // Deserialize the header
                let header: ExtendedHeader =
                    serde_json::from_str(&header_data).map_err(LocalError::SerializationError)?;
                return Ok(header);
            }
        }

        // If we get here, we couldn't find the header by hash
        Err(LocalError::HeaderNotFound)
    }

    pub async fn wait_for_header(&self, height: u64) -> Result<ExtendedHeader, LocalError> {
        // Check if height is already available
        let current_height = self.get_current_height().await?;
        if height <= current_height {
            // Height exists, generate/retrieve the header
            return self.get_header_by_height(height).await;
        }

        // If height doesn't exist yet, we need to wait for it
        const MAX_ATTEMPTS: u32 = 30; // Wait for up to 30 seconds
        for _ in 0..MAX_ATTEMPTS {
            tokio::time::sleep(std::time::Duration::from_secs(1)).await;

            let current_height = self.get_current_height().await?;
            if height <= current_height {
                return self.get_header_by_height(height).await;
            }
        }

        Err(LocalError::HeaderTimeoutError)
    }

    pub async fn get_headers_by_range(
        &self,
        from: u64,
        to: u64,
    ) -> Result<Vec<ExtendedHeader>, LocalError> {
        if from > to {
            return Err(LocalError::InvalidHeaderRange);
        }

        let mut headers = Vec::new();

        for height in from..=to {
            match self.get_header_by_height(height).await {
                Ok(header) => headers.push(header),
                Err(LocalError::HeaderNotFound) => continue, // Skip missing heights
                Err(e) => return Err(e),
            }
        }

        // Verify headers are adjacent to each other
        for i in 1..headers.len() {
            if headers[i].height().value() != headers[i - 1].height().value() + 1 {
                return Err(LocalError::InvalidHeaderRange);
            }
        }

        Ok(headers)
    }

    // Method to get the full Extended Data Square for a height
    pub async fn get_eds_at_height(&self, height: u64) -> Result<ExtendedDataSquare, LocalError> {
        info!("Getting EDS at height {}", height);

        if height == 0 {
            return Err(LocalError::HeaderNotFound);
        }

        // Check if height is valid
        let current_height = self.get_current_height().await?;
        if height > current_height {
            return Err(LocalError::HeaderNotFound);
        }

        // Get a fresh connection
        let mut conn = self.client.get_async_connection().await.map_err(|e| {
            error!("Failed to get Redis connection: {}", e);
            LocalError::RedisError(e)
        })?;

        let eds_key = format!("eds:{}", height);
        let eds_data: Option<String> = conn.get(&eds_key).await.map_err(LocalError::RedisError)?;

        // If we found a stored EDS, return it
        if let Some(eds_data) = eds_data {
            let raw_eds: RawExtendedDataSquare =
                serde_json::from_str(&eds_data).map_err(LocalError::SerializationError)?;
            let eds = ExtendedDataSquare::from_raw(raw_eds, AppVersion::V3).unwrap();
            return Ok(eds);
        }

        // Get all namespaces used at this height
        let namespace = self.get_namespace_at_height(height).await?;

        // Get all blobs for these namespaces
        let all_blobs = self.get_all_blobs(height, namespace).await?;

        // Collect all shares from all blobs and track indexes
        let mut all_shares: Vec<Vec<u8>> = Vec::new();
        let mut blob_indexes: Vec<BlobIndexInfo> = Vec::new();

        // Create a padding share
        let padding_share = [
            Namespace::PRIMARY_RESERVED_PADDING.as_bytes(),
            &[InfoByte::new(0, true).unwrap().as_u8()],
            &[0; SHARE_SIZE - NS_SIZE - 1],
        ]
        .concat();
        // Add one padding share at the beginning
        all_shares.push(padding_share.clone());

        // Process all blobs and their shares
        for (blob_idx, blob) in all_blobs.iter().enumerate() {
            let ns_hex = hex::encode(blob.namespace.as_bytes());
            let commitment_hex = hex::encode(blob.commitment.hash());
            let blob_key = format!("blob:{}:{}:{}", height, ns_hex, commitment_hex);

            // Record starting index before adding this blob's shares
            let start_idx = all_shares.len();

            // Add the shares for this blob
            match blob.to_shares() {
                Ok(shares) => {
                    info!(
                        "Blob {}/{} has {} shares",
                        blob_idx + 1,
                        all_blobs.len(),
                        shares.len()
                    );

                    for share in shares {
                        all_shares.push(share.to_vec());
                    }

                    // Record ending index after adding all shares
                    let end_idx = all_shares.len() - 1;

                    info!(
                        "Blob {}/{} added with index range: {}..{} (total: {} shares)",
                        blob_idx + 1,
                        all_blobs.len(),
                        start_idx,
                        end_idx,
                        end_idx - start_idx + 1
                    );

                    // Store the index info for this blob
                    blob_indexes.push(BlobIndexInfo {
                        blob_key,
                        namespace: blob.namespace.as_bytes().to_vec(),
                        commitment: blob.commitment.hash().to_vec(),
                        start_idx,
                        end_idx,
                    });
                }
                Err(e) => {
                    error!("Failed to convert blob to shares: {}", e);
                    continue;
                }
            }
        }

        info!("All blobs length: {:?}", all_blobs.len());

        let mut eds = ExtendedDataSquare::empty();

        if !all_shares.is_empty() {
            // Now we need to update blob indexes based on the sorted shares
            // We need to find where each blob's shares ended up

            // Map to store the index of each share
            let mut share_map: HashMap<Vec<u8>, usize> = HashMap::new();

            // Build the map of shares to their positions in the sorted array
            for (idx, share) in all_shares.iter().enumerate() {
                share_map.insert(share.clone(), idx);
            }

            // Calculate what the square width would be
            let total_shares = all_shares.len();
            let mut square_width = (total_shares as f64).sqrt().ceil() as usize;

            // Ensure width constraints are met
            if square_width < MIN_EXTENDED_SQUARE_WIDTH {
                square_width = MIN_EXTENDED_SQUARE_WIDTH;
            }

            // Ensure width is a power of 2
            square_width = square_width.next_power_of_two();

            // Pad with empty shares if necessary to make it a square
            let square_size = square_width * square_width;
            while all_shares.len() < square_size {
                // Create a padding share
                let padding_share = [
                    Namespace::TAIL_PADDING.as_bytes(),
                    &[InfoByte::new(0, true).unwrap().as_u8()],
                    &[0; SHARE_SIZE - NS_SIZE - 1],
                ]
                .concat();
                all_shares.push(padding_share);
            }

            // Create the EDS
            eds = ExtendedDataSquare::from_ods(all_shares.clone(), AppVersion::V3).unwrap();

            // Serialize and store the EDS
            let serialized_eds =
                serde_json::to_string(&eds).map_err(LocalError::SerializationError)?;
            match tokio::time::timeout(
                std::time::Duration::from_secs(5),
                conn.set::<_, _, ()>(&eds_key, &serialized_eds),
            )
            .await
            {
                Ok(result) => result.map_err(|e| {
                    error!("Failed to store EDS: {}", e);
                    LocalError::RedisError(e)
                })?,
                Err(_) => {
                    error!("Timeout storing EDS");
                    return Err(LocalError::RedisError(redis::RedisError::from(
                        std::io::Error::new(
                            std::io::ErrorKind::TimedOut,
                            "Redis operation timed out when storing EDS",
                        ),
                    )));
                }
            };

            // Now update each blob's index
            info!("Blob indexes length: {:?}", blob_indexes.len());

            for blob_info in blob_indexes {
                // Get the blob
                let blob_data: Option<String> = conn
                    .get(&blob_info.blob_key)
                    .await
                    .map_err(LocalError::RedisError)?;

                if let Some(blob_data) = blob_data {
                    // Deserialize, update, and store again
                    let mut blob: Blob =
                        serde_json::from_str(&blob_data).map_err(LocalError::SerializationError)?;

                    // Use blob_info.start_idx, not i
                    info!(
                        "Setting blob index, current {:?}, new {:?}",
                        blob.index, blob_info.start_idx
                    );

                    // IMPORTANT: Make sure we're using the start_idx from the blob_info
                    blob.index = Some(blob_info.start_idx as u64);

                    // Make sure the indexes were calculated correctly
                    // by printing out the shares for debugging
                    info!(
                        "Blob has {} shares starting at index {}",
                        blob_info.end_idx - blob_info.start_idx + 1,
                        blob_info.start_idx
                    );

                    // Serialize the updated blob
                    let updated_blob =
                        serde_json::to_string(&blob).map_err(LocalError::SerializationError)?;

                    // Store the updated blob
                    match tokio::time::timeout(
                        std::time::Duration::from_secs(5),
                        conn.set::<_, _, ()>(&blob_info.blob_key, &updated_blob),
                    )
                    .await
                    {
                        Ok(result) => result.map_err(|e| {
                            error!("Failed to update blob index: {}", e);
                            LocalError::RedisError(e)
                        })?,
                        Err(_) => {
                            error!("Timeout updating blob index");
                            return Err(LocalError::RedisError(redis::RedisError::from(
                                std::io::Error::new(
                                    std::io::ErrorKind::TimedOut,
                                    "Redis operation timed out when updating blob index",
                                ),
                            )));
                        }
                    };

                    // Store the index mapping
                    let ns_hex = hex::encode(&blob_info.namespace);
                    let commitment_hex = hex::encode(&blob_info.commitment);
                    let index_key = format!("blob_index:{}:{}:{}", height, ns_hex, commitment_hex);
                    let index_value = format!("{}:{}", blob_info.start_idx, blob_info.end_idx);

                    match tokio::time::timeout(
                        std::time::Duration::from_secs(5),
                        conn.set::<_, _, ()>(&index_key, &index_value),
                    )
                    .await
                    {
                        Ok(result) => result.map_err(|e| {
                            error!("Failed to store index mapping: {}", e);
                            LocalError::RedisError(e)
                        })?,
                        Err(_) => {
                            error!("Timeout storing index mapping");
                            return Err(LocalError::RedisError(redis::RedisError::from(
                                std::io::Error::new(
                                    std::io::ErrorKind::TimedOut,
                                    "Redis operation timed out when storing index mapping",
                                ),
                            )));
                        }
                    };
                }
            }
        }

        Ok(eds)
    }

    pub async fn get_share_range(
        &self,
        height: u64,
        start: u64,
        end: u64,
    ) -> Result<crate::types::GetRangeResponse, LocalError> {
        if start > end {
            return Err(LocalError::TransactionError(
                "Invalid range: start > end".to_string(),
            ));
        }

        // Get the full EDS first
        let eds = self.get_eds_at_height(height).await?;

        let eds_data = eds.data_square();

        // Extract the requested range
        let shares = if start as usize >= eds_data.len() {
            Vec::new() // Return empty if start is out of range
        } else {
            let end_idx = std::cmp::min(end as usize + 1, eds_data.len());
            // Map each Share to Vec<u8>
            eds_data[start as usize..end_idx]
                .iter()
                .map(|share| share.to_vec())
                .collect()
        };

        Ok(crate::types::GetRangeResponse { shares })
    }

    pub async fn clear_database(&self) -> Result<(), LocalError> {
        info!("Clearing Redis database");

        let mut conn = self.client.get_async_connection().await.map_err(|e| {
            error!("Failed to get Redis connection: {}", e);
            LocalError::RedisError(e)
        })?;

        // Explicitly specify the return type as String for the FLUSHDB command
        let _: String = redis::cmd("FLUSHDB")
            .query_async(&mut conn)
            .await
            .map_err(|e| {
                error!("Failed to clear Redis database: {}", e);
                LocalError::RedisError(e)
            })?;

        info!("Redis database cleared successfully");
        Ok(())
    }
}
