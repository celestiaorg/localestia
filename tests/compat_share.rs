mod utils;

use celestia_rpc::prelude::*;
use celestia_types::AppVersion;

use utils::{make_blob, make_namespace, setup, submit_blob};

#[tokio::test]
async fn share_get_eds_roundtrip() {
    let ctx = setup().await;
    let namespace = make_namespace(20);
    let blob = make_blob(namespace, b"share eds".to_vec());

    let height = submit_blob(&ctx.client, &blob).await;

    let eds = ctx
        .client
        .share_get_eds(height, AppVersion::V3)
        .await
        .expect("share_get_eds failed");

    let data_square = eds.data_square();
    assert!(!data_square.is_empty());
}

#[tokio::test]
async fn share_get_range_roundtrip() {
    let ctx = setup().await;
    let namespace = make_namespace(21);
    let blob = make_blob(namespace, b"share range".to_vec());

    let height = submit_blob(&ctx.client, &blob).await;

    let response = ctx
        .client
        .share_get_range(height, AppVersion::V3, 0, 1)
        .await
        .expect("share_get_range failed");

    assert!(!response.shares.is_empty());
    assert_eq!(response.proof.shares().len(), response.shares.len());
}
