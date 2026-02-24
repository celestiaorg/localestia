mod cli;
mod error;
mod rpc;
mod storage;
mod types;
mod utils;

#[tokio::main]
async fn main() -> Result<(), Box<error::LocalError>> {
    cli::run().await
}
