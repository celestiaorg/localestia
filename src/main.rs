mod cli;
mod error;
mod rpc;
mod storage;
mod types;
mod utils;

use crate::rpc::ShareRpcServer;
use celestia_rpc::BlobRpcServer;
use celestia_rpc::HeaderRpcServer;
use error::LocalError;
use rpc::LocalestiaServer;
use storage::RedisStorage;

#[tokio::main]
async fn main() -> Result<(), Box<error::LocalError>> {
    cli::run().await
}
