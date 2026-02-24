mod utils;

use celestia_rpc::prelude::*;
use celestia_types::hash::Hash;
use ethers::abi::Abi;
use ethers::contract::{Contract, ContractFactory};
use ethers::core::utils::{Anvil, AnvilInstance};
use ethers::middleware::SignerMiddleware;
use ethers::providers::{Middleware, Provider};
use ethers::signers::{LocalWallet, Signer};
use ethers::types::{Bytes, H256, U256};
use serde::Deserialize;
use std::env;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::sync::{Arc, Once};

use utils::{make_blob, make_namespace, setup, submit_blob};

#[tokio::test]
async fn blobstream_get_root_and_proof_roundtrip() {
    let ctx = setup().await;
    let namespace = make_namespace(50);

    let height_a = submit_blob(&ctx.client, &make_blob(namespace, b"tuple a".to_vec())).await;
    let height_b = submit_blob(&ctx.client, &make_blob(namespace, b"tuple b".to_vec())).await;
    let height_c = submit_blob(&ctx.client, &make_blob(namespace, b"tuple c".to_vec())).await;

    let start = height_a;
    let end = height_c + 1;
    let target_height = height_b;

    let tuple_root = ctx
        .client
        .blobstream_get_data_root_tuple_root(start, end)
        .await
        .expect("blobstream_get_data_root_tuple_root failed");

    let proof = ctx
        .client
        .blobstream_get_data_root_tuple_inclusion_proof(target_height, start, end)
        .await
        .expect("blobstream_get_data_root_tuple_inclusion_proof failed");

    let data_root = ctx
        .client
        .header_get_by_height(target_height)
        .await
        .expect("header_get_by_height failed")
        .dah
        .hash();

    let leaf = encode_data_root_tuple(target_height, &data_root);
    let root = hash_to_bytes(tuple_root);

    proof
        .verify(leaf, root)
        .expect("failed to verify data root tuple proof");
}

#[tokio::test]
async fn blobstream_proof_verifies_on_mock_contract() {
    let ctx = setup().await;
    let namespace = make_namespace(51);

    let height = submit_blob(&ctx.client, &make_blob(namespace, b"contract proof".to_vec())).await;

    let (anvil, contract) = deploy_mockstream_contract().await;

    let tuple_root = ctx
        .client
        .blobstream_get_data_root_tuple_root(height, height + 1)
        .await
        .expect("blobstream_get_data_root_tuple_root failed");
    let tuple_root = hash_to_h256(tuple_root);

    let submit_call = contract
        .method::<_, ()>("submitDataCommitment", (tuple_root, height, height + 1))
        .expect("failed to build submitDataCommitment call");
    let pending_tx = submit_call
        .send()
        .await
        .expect("submitDataCommitment transaction failed");
    let _ = pending_tx
        .await
        .expect("failed to confirm submitDataCommitment");

    let proof = ctx
        .client
        .blobstream_get_data_root_tuple_inclusion_proof(height, height, height + 1)
        .await
        .expect("blobstream_get_data_root_tuple_inclusion_proof failed");
    let data_root = ctx
        .client
        .header_get_by_height(height)
        .await
        .expect("header_get_by_height failed")
        .dah
        .hash();

    let tuple = (U256::from(height), hash_to_h256(data_root));
    let side_nodes: Vec<H256> = proof.aunts.iter().map(|hash| H256::from_slice(hash)).collect();
    let proof_tuple = (
        side_nodes,
        U256::from(proof.index as u64),
        U256::from(proof.total as u64),
    );

    let verified: bool = contract
        .method("verifyAttestation", (U256::from(1u64), tuple, proof_tuple))
        .expect("failed to build verifyAttestation call")
        .call()
        .await
        .expect("verifyAttestation call failed");
    assert!(verified, "verifyAttestation returned false");

    drop(anvil);
}

#[derive(Deserialize)]
struct ForgeArtifact {
    abi: serde_json::Value,
    bytecode: ForgeBytecode,
}

#[derive(Deserialize)]
struct ForgeBytecode {
    object: String,
}

static FORGE_BUILD: Once = Once::new();

fn ensure_forge_build() {
    FORGE_BUILD.call_once(|| {
        let status = Command::new("forge")
            .arg("build")
            .current_dir(contracts_dir())
            .status()
            .unwrap_or_else(|err| {
                panic!("failed to execute forge build: {err}");
            });

        if !status.success() {
            panic!("forge build failed with status {status}");
        }
    });
}

async fn deploy_mockstream_contract(
) -> (Option<AnvilInstance>, Contract<SignerMiddleware<Provider<ethers::providers::Http>, LocalWallet>>) {
    ensure_forge_build();

    let (anvil, client) = anvil_client().await;

    let (abi, bytecode) = load_mockstream_artifact();
    let factory = ContractFactory::new(abi, bytecode, client.clone());
    let contract = factory
        .deploy(())
        .expect("failed to build mock contract deployment")
        .send()
        .await
        .expect("failed to deploy mock contract");

    let init_call = contract
        .method::<_, ()>("initialize", 0u64)
        .expect("failed to build initialize call");
    let pending_tx = init_call
        .send()
        .await
        .expect("initialize transaction failed");
    let _ = pending_tx.await.expect("failed to confirm initialize tx");

    (anvil, contract)
}

async fn anvil_client(
) -> (Option<AnvilInstance>, Arc<SignerMiddleware<Provider<ethers::providers::Http>, LocalWallet>>) {
    if let Ok(rpc_url) = env::var("ANVIL_RPC_URL") {
        let private_key = env::var("ANVIL_PRIVATE_KEY")
            .expect("ANVIL_PRIVATE_KEY is required when ANVIL_RPC_URL is set");
        let provider = Provider::try_from(rpc_url)
            .expect("failed to create provider from ANVIL_RPC_URL");
        let chain_id = provider
            .get_chainid()
            .await
            .expect("failed to fetch chain id from ANVIL_RPC_URL");
        let wallet: LocalWallet = private_key
            .parse::<LocalWallet>()
            .expect("failed to parse ANVIL_PRIVATE_KEY")
            .with_chain_id(chain_id.as_u64());
        let client = Arc::new(SignerMiddleware::new(provider, wallet));
        return (None, client);
    }

    let anvil = Anvil::new().spawn();
    let wallet: LocalWallet = anvil.keys()[0].clone().into();
    let wallet = wallet.with_chain_id(anvil.chain_id());
    let provider = Provider::try_from(anvil.endpoint()).expect("failed to create Anvil provider");
    let client = Arc::new(SignerMiddleware::new(provider, wallet));

    (Some(anvil), client)
}

fn load_mockstream_artifact() -> (Abi, Bytes) {
    let artifact_path = contracts_dir()
        .join("out")
        .join("MockBlobstream.sol")
        .join("Mockstream.json");
    let bytes = fs::read(&artifact_path)
        .unwrap_or_else(|err| panic!("failed to read {artifact_path:?}: {err}"));
    let artifact: ForgeArtifact = serde_json::from_slice(&bytes)
        .unwrap_or_else(|err| panic!("failed to parse forge artifact: {err}"));

    let abi: Abi = serde_json::from_value(artifact.abi)
        .unwrap_or_else(|err| panic!("failed to parse contract ABI: {err}"));
    let bytecode = artifact.bytecode.object;
    if bytecode.is_empty() {
        panic!("forge artifact bytecode is empty");
    }
    let bytecode = bytecode.strip_prefix("0x").unwrap_or(&bytecode);
    let bytecode = hex::decode(bytecode)
        .unwrap_or_else(|err| panic!("failed to decode bytecode hex: {err}"));

    (abi, Bytes::from(bytecode))
}

fn contracts_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("contracts")
}

fn encode_data_root_tuple(height: u64, data_root: &Hash) -> Vec<u8> {
    let mut result = vec![0u8; 32];
    result[24..].copy_from_slice(&height.to_be_bytes());

    match data_root {
        Hash::Sha256(bytes) => result.extend_from_slice(bytes),
        Hash::None => panic!("empty data root hash"),
    }

    result
}

fn hash_to_bytes(hash: Hash) -> [u8; 32] {
    match hash {
        Hash::Sha256(bytes) => bytes,
        Hash::None => panic!("empty tuple root hash"),
    }
}

fn hash_to_h256(hash: Hash) -> H256 {
    H256::from(hash_to_bytes(hash))
}
