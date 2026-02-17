mod utils;

use celestia_rpc::prelude::*;

use utils::{make_blob, make_namespace, setup, submit_blob};

#[tokio::test]
async fn header_get_by_height_and_hash() {
    let ctx = setup().await;
    let namespace = make_namespace(10);
    let blob = make_blob(namespace, b"header data".to_vec());

    let height = submit_blob(&ctx.client, &blob).await;

    let header = ctx
        .client
        .header_get_by_height(height)
        .await
        .expect("header_get_by_height failed");

    assert_eq!(header.height(), height);

    let header_by_hash = ctx
        .client
        .header_get_by_hash(header.hash())
        .await
        .expect("header_get_by_hash failed");

    assert_eq!(header_by_hash, header);
}

#[tokio::test]
async fn header_wait_for_height_returns_header() {
    let ctx = setup().await;
    let namespace = make_namespace(11);
    let blob = make_blob(namespace, b"wait for height".to_vec());

    let height = submit_blob(&ctx.client, &blob).await;

    let header = ctx
        .client
        .header_wait_for_height(height)
        .await
        .expect("header_wait_for_height failed");

    assert_eq!(header.height(), height);
}

#[tokio::test]
async fn header_get_range_by_height_roundtrip() {
    let ctx = setup().await;
    let namespace = make_namespace(12);
    let blob = make_blob(namespace, b"range mismatch".to_vec());

    let height = submit_blob(&ctx.client, &blob).await;

    let from_header = ctx
        .client
        .header_get_by_height(height)
        .await
        .expect("header_get_by_height failed");

    let headers = ctx
        .client
        .header_get_range_by_height(from_header.clone(), height)
        .await
        .expect("header_get_range_by_height failed");

    assert_eq!(headers.len(), 1);
    assert_eq!(headers[0], from_header);
}
