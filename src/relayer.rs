use std::sync::Arc;
use std::time::Duration;

use anyhow::{Context, Result};
use celestia_rpc::blobstream::BlobstreamClient;
use celestia_rpc::{Client, HeaderClient};
use celestia_types::hash::Hash as CelestiaHash;
use ethers::prelude::*;
use tokio::sync::watch;
use tokio::time::sleep;
use tracing::{info, warn};

abigen!(
    MockBlobstream,
    r#"[
        function latestBlock() view returns (uint64)
        function submitDataCommitment(bytes32,uint64,uint64)
    ]"#
);

pub struct RelayerConfig {
    pub celestia_ws_url: String,
    pub eth_rpc_url: String,
    pub eth_private_key: String,
    pub contract_address: String,
    pub poll_ms: u64,
}

pub async fn run_from_env() -> Result<()> {
    let celestia_ws_url =
        std::env::var("CELESTIA_RPC_URL").unwrap_or_else(|_| "ws://127.0.0.1:26658".to_string());
    let eth_rpc_url = std::env::var("ETH_RPC_URL").context("ETH_RPC_URL is required")?;
    let eth_private_key =
        std::env::var("ETH_PRIVATE_KEY").context("ETH_PRIVATE_KEY is required")?;
    let contract_address = std::env::var("BLOBSTREAM_CONTRACT_ADDRESS")
        .context("BLOBSTREAM_CONTRACT_ADDRESS is required")?;
    let poll_ms: u64 = std::env::var("RELAYER_POLL_MS")
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(1000);

    run(RelayerConfig {
        celestia_ws_url,
        eth_rpc_url,
        eth_private_key,
        contract_address,
        poll_ms,
    })
    .await
}

pub async fn run(config: RelayerConfig) -> Result<()> {
    let (shutdown_tx, shutdown_rx) = watch::channel(false);
    let run = run_with_shutdown(config, shutdown_rx);
    tokio::pin!(run);
    tokio::select! {
        result = &mut run => result,
        _ = tokio::signal::ctrl_c() => {
            let _ = shutdown_tx.send(true);
            Ok(())
        }
    }
}

pub async fn run_with_shutdown(
    config: RelayerConfig,
    mut shutdown: watch::Receiver<bool>,
) -> Result<()> {
    let _ = tracing_subscriber::fmt::try_init();

    let local_client = Client::new(&config.celestia_ws_url, None, None, None)
        .await
        .context("failed to connect to Localestia RPC")?;

    let provider = Provider::<Http>::try_from(config.eth_rpc_url)
        .context("failed to create ETH RPC provider")?;
    let chain_id = provider
        .get_chainid()
        .await
        .context("failed to fetch chain id")?;
    let wallet: LocalWallet = config
        .eth_private_key
        .parse::<LocalWallet>()
        .context("failed to parse ETH_PRIVATE_KEY")?
        .with_chain_id(chain_id.as_u64());
    let address: Address = config
        .contract_address
        .parse()
        .context("failed to parse BLOBSTREAM_CONTRACT_ADDRESS")?;

    let provider = Arc::new(provider);
    let signer = Arc::new(SignerMiddleware::new(provider, wallet));
    let contract = MockBlobstream::new(address, signer);

    info!("starting blobstream relayer");

    loop {
        if *shutdown.borrow() {
            break;
        }

        if let Err(err) = relay_once(&local_client, &contract).await {
            warn!("relayer error: {err}");
        }

        tokio::select! {
            _ = shutdown.changed() => {},
            _ = sleep(Duration::from_millis(config.poll_ms)) => {},
        }
    }

    Ok(())
}

async fn relay_once<M: Middleware + 'static>(
    local_client: &Client,
    contract: &MockBlobstream<M>,
) -> Result<()> {
    let local_head = match local_client.header_local_head().await {
        Ok(header) => header.height(),
        Err(err) => {
            let msg = err.to_string();
            if msg.contains("Header not found") {
                return Ok(());
            }
            warn!("failed to read local head: {err}");
            return Ok(());
        }
    };

    let contract_latest = match contract.latest_block().call().await {
        Ok(value) => value,
        Err(err) => {
            warn!("failed to read contract latestBlock: {err}");
            return Ok(());
        }
    };

    let mut next_height = if contract_latest == 0 {
        1
    } else {
        contract_latest
    };

    if next_height > local_head {
        return Ok(());
    }

    while next_height <= local_head {
        let end = next_height + 1;
        let tuple_root = local_client
            .blobstream_get_data_root_tuple_root(next_height, end)
            .await
            .with_context(|| format!("failed to fetch data root tuple root for {next_height}"))?;
        let tuple_root = hash_to_bytes32(tuple_root)?;

        let call = contract.submit_data_commitment(tuple_root, next_height, end);
        let pending = call
            .send()
            .await
            .with_context(|| format!("failed to submit data commitment for {next_height}"))?;

        let receipt = pending
            .await
            .context("failed to fetch transaction receipt")?;
        if let Some(receipt) = receipt {
            info!(
                "relayed height {next_height} in tx {:#x}",
                receipt.transaction_hash
            );
        } else {
            warn!("relayed height {next_height} but receipt missing");
        }

        next_height = end;
    }

    Ok(())
}

fn hash_to_bytes32(hash: CelestiaHash) -> Result<[u8; 32]> {
    match hash {
        CelestiaHash::Sha256(bytes) => Ok(bytes),
        CelestiaHash::None => Err(anyhow::anyhow!("empty tuple root hash")),
    }
}
