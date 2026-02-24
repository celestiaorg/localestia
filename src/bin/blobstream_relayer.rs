use anyhow::Result;
use localestia::relayer;

#[tokio::main]
async fn main() -> Result<()> {
    relayer::run_from_env().await
}
