mod utils;

use celestia_rpc::prelude::*;
use celestia_types::AppVersion;

use jsonrpsee_core::client::Error as RpcError;
use utils::{RpcOutcome, classify_error, make_blob, make_namespace, setup, submit_blob};

fn record<T>(name: &str, result: Result<T, RpcError>) -> (String, RpcOutcome) {
    let outcome = match result {
        Ok(_) => RpcOutcome::Ok,
        Err(err) => classify_error(err),
    };
    (name.to_string(), outcome)
}

#[tokio::test]
async fn compatibility_report() {
    let ctx = setup().await;
    let namespace = make_namespace(30);
    let blob = make_blob(namespace, b"compat report".to_vec());
    let height = submit_blob(&ctx.client, &blob).await;

    let header = ctx
        .client
        .header_get_by_height(height)
        .await
        .expect("failed to fetch header for report");
    let square_width = header.square_width();

    let mut results = Vec::new();

    results.push(record(
        "header.GetByHeight",
        ctx.client.header_get_by_height(height).await,
    ));
    results.push(record(
        "header.GetByHash",
        ctx.client.header_get_by_hash(header.hash()).await,
    ));
    results.push(record(
        "header.GetRangeByHeight",
        ctx.client
            .header_get_range_by_height(header.clone(), height)
            .await,
    ));
    results.push(record(
        "header.WaitForHeight",
        ctx.client.header_wait_for_height(height).await,
    ));
    results.push(record("header.LocalHead", ctx.client.header_local_head().await));
    results.push(record(
        "header.NetworkHead",
        ctx.client.header_network_head().await,
    ));
    results.push(record(
        "header.SyncState",
        ctx.client.header_sync_state().await,
    ));
    results.push(record("header.SyncWait", ctx.client.header_sync_wait().await));

    results.push(record(
        "blob.Get",
        ctx.client
            .blob_get(height, namespace, blob.commitment)
            .await,
    ));
    results.push(record(
        "blob.Submit",
        ctx.client
            .blob_submit(std::slice::from_ref(&blob), celestia_rpc::TxConfig::default())
            .await,
    ));
    results.push(record(
        "blob.GetAll",
        ctx.client.blob_get_all(height, &[namespace]).await,
    ));
    let proofs = ctx
        .client
        .blob_get_proof(height, namespace, blob.commitment)
        .await;
    match proofs {
        Ok(proofs) => {
            results.push(("blob.GetProof".to_string(), RpcOutcome::Ok));
            if let Some(proof) = proofs.first() {
                results.push(record(
                    "blob.Included",
                    ctx.client
                        .blob_included(height, namespace, proof, blob.commitment)
                        .await,
                ));
            } else {
                results.push((
                    "blob.Included".to_string(),
                    RpcOutcome::Other("no proofs returned".to_string()),
                ));
            }
        }
        Err(err) => {
            results.push((
                "blob.GetProof".to_string(),
                classify_error(err),
            ));
            results.push((
                "blob.Included".to_string(),
                RpcOutcome::Skipped("proof unavailable"),
            ));
        }
    }

    results.push(record(
        "share.GetEDS",
        ctx.client.share_get_eds(height, AppVersion::V3).await,
    ));
    results.push(record(
        "share.GetRange",
        ctx.client.share_get_range(height, AppVersion::V3, 0, 1).await,
    ));
    results.push(record(
        "share.GetSamples",
        ctx.client
            .share_get_samples(height, AppVersion::V3, [(0u16, 0u16)])
            .await,
    ));
    results.push(record(
        "share.GetRow",
        ctx.client
            .share_get_row(height, AppVersion::V3, square_width, 0)
            .await,
    ));
    results.push(record(
        "share.GetShare",
        ctx.client
            .share_get_share(height, AppVersion::V3, square_width, 0, 0)
            .await,
    ));
    results.push(record(
        "share.GetNamespaceData",
        ctx.client
            .share_get_namespace_data(height, AppVersion::V3, namespace)
            .await,
    ));
    results.push(record(
        "share.SharesAvailable",
        ctx.client.share_shares_available(height).await,
    ));

    println!("compatibility report:");
    for (name, outcome) in &results {
        println!("  {name}: {outcome}");
    }

    let missing = results
        .iter()
        .filter(|(_, outcome)| matches!(outcome, RpcOutcome::MethodNotFound))
        .collect::<Vec<_>>();

    if !missing.is_empty() {
        println!("missing methods:");
        for (name, _) in missing {
            println!("  {name}");
        }
    }
}
