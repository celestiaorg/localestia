mod utils;

use celestia_rpc::prelude::*;
use celestia_rpc::TxConfig;

use celestia_types::DataAvailabilityHeader;
use utils::{make_blob, make_namespace, setup, submit_blob};

#[tokio::test]
async fn blob_submit_and_get_roundtrip() {
    let ctx = setup().await;
    let namespace = make_namespace(1);
    let blob = make_blob(namespace, b"hello localestia".to_vec());

    let height = submit_blob(&ctx.client, &blob).await;

    let fetched = ctx
        .client
        .blob_get(height, namespace, blob.commitment)
        .await
        .expect("blob_get failed");

    assert_eq!(fetched.namespace, blob.namespace);
    assert_eq!(fetched.data, blob.data);
    assert_eq!(fetched.commitment, blob.commitment);
    assert_eq!(fetched.share_version, blob.share_version);
    assert_eq!(fetched.signer, blob.signer);
    assert!(fetched.index.is_some());
}

#[tokio::test]
async fn blob_submit_multiple_namespaces_same_height() {
    let ctx = setup().await;
    let namespace_a = make_namespace(10);
    let namespace_b = make_namespace(11);
    let blob_a = make_blob(namespace_a, b"multi namespace a".to_vec());
    let blob_b = make_blob(namespace_b, b"multi namespace b".to_vec());
    let commitment_a = blob_a.commitment.clone();
    let commitment_b = blob_b.commitment.clone();
    let data_a = blob_a.data.clone();
    let data_b = blob_b.data.clone();

    let blobs = vec![blob_a, blob_b];
    let height = ctx
        .client
        .blob_submit(&blobs, TxConfig::default())
        .await
        .expect("blob submission failed");

    let fetched_a = ctx
        .client
        .blob_get(height, namespace_a, commitment_a)
        .await
        .expect("blob_get failed for namespace_a");
    let fetched_b = ctx
        .client
        .blob_get(height, namespace_b, commitment_b)
        .await
        .expect("blob_get failed for namespace_b");

    assert_eq!(fetched_a.namespace, namespace_a);
    assert_eq!(fetched_b.namespace, namespace_b);
    assert_eq!(fetched_a.data, data_a);
    assert_eq!(fetched_b.data, data_b);
    assert!(fetched_a.index.is_some());
    assert!(fetched_b.index.is_some());
}

#[tokio::test]
async fn blob_get_all_roundtrip() {
    let ctx = setup().await;
    let namespace = make_namespace(2);
    let blob = make_blob(namespace, b"get all".to_vec());

    let height = submit_blob(&ctx.client, &blob).await;

    let blobs = ctx
        .client
        .blob_get_all(height, &[namespace])
        .await
        .expect("blob_get_all failed")
        .expect("expected blobs");

    assert_eq!(blobs.len(), 1);

    let mut expected = blob.clone();
    expected.index = blobs[0].index;
    assert_eq!(blobs[0], expected);
}

#[tokio::test]
async fn blob_get_proof_and_included_roundtrip() {
    let ctx = setup().await;
    let namespace = make_namespace(3);
    let blob = make_blob(namespace, b"proof test".to_vec());

    let height = submit_blob(&ctx.client, &blob).await;

    let proofs = ctx
        .client
        .blob_get_proof(height, namespace, blob.commitment)
        .await
        .expect("blob_get_proof failed");

    assert!(!proofs.is_empty());

    let included = ctx
        .client
        .blob_included(height, namespace, &proofs[0], blob.commitment)
        .await
        .expect("blob_included failed");

    assert!(included);

    let stored_blob = ctx
        .storage
        .get_blob(height, &namespace, &blob.commitment)
        .await
        .expect("storage blob_get failed");
    let eds = ctx
        .storage
        .get_eds_at_height(height)
        .await
        .expect("failed to fetch EDS");
    let dah = DataAvailabilityHeader::from_eds(&eds);

    let start_idx = stored_blob.index.expect("missing blob index") as usize;
    let width = eds.square_width() as usize;
    let row = (start_idx / width) as u16;
    let row_root = dah.row_root(row).expect("missing row root");

    let mut row_shares = Vec::new();
    for col in 0..eds.square_width() {
        let share = eds
            .share(row, col)
            .expect("failed to fetch share for row proof");
        if share.namespace() == namespace {
            row_shares.push(share.clone());
        }
    }

    proofs[0]
        .verify_complete_namespace(&row_root, &row_shares, namespace.into())
        .expect("proof verification failed");
}
