mod utils;

use celestia_rpc::prelude::*;
use celestia_types::AppVersion;
use utils::{make_blob, make_namespace, setup_process, submit_blob};

#[tokio::test]
async fn process_server_supports_all_methods() {
    let ctx = setup_process().await;
    let namespace = make_namespace(30);
    let blob = make_blob(namespace, b"process report".to_vec());
    let height = submit_blob(&ctx.client, &blob).await;

    let header = ctx
        .client
        .header_get_by_height(height)
        .await
        .expect("header_get_by_height failed");
    let square_width = header.square_width();

    ctx.client
        .header_get_by_hash(header.hash())
        .await
        .expect("header_get_by_hash failed");
    ctx.client
        .header_get_range_by_height(header.clone(), height)
        .await
        .expect("header_get_range_by_height failed");
    ctx.client
        .header_wait_for_height(height)
        .await
        .expect("header_wait_for_height failed");
    ctx.client
        .header_local_head()
        .await
        .expect("header_local_head failed");
    ctx.client
        .header_network_head()
        .await
        .expect("header_network_head failed");
    ctx.client
        .header_sync_state()
        .await
        .expect("header_sync_state failed");
    ctx.client
        .header_sync_wait()
        .await
        .expect("header_sync_wait failed");

    ctx.client
        .blob_get(height, namespace, blob.commitment)
        .await
        .expect("blob_get failed");
    ctx.client
        .blob_submit(
            std::slice::from_ref(&blob),
            celestia_rpc::TxConfig::default(),
        )
        .await
        .expect("blob_submit failed");
    ctx.client
        .blob_get_all(height, &[namespace])
        .await
        .expect("blob_get_all failed")
        .expect("expected blobs from blob_get_all");

    let proofs = ctx
        .client
        .blob_get_proof(height, namespace, blob.commitment)
        .await
        .expect("blob_get_proof failed");
    let proof = proofs.first().expect("expected namespace proofs");
    let included = ctx
        .client
        .blob_included(height, namespace, proof, blob.commitment)
        .await
        .expect("blob_included failed");
    assert!(included, "blob_included reported false for stored blob");

    ctx.client
        .blobstream_get_data_root_tuple_root(height, height + 1)
        .await
        .expect("blobstream_get_data_root_tuple_root failed");
    ctx.client
        .blobstream_get_data_root_tuple_inclusion_proof(height, height, height + 1)
        .await
        .expect("blobstream_get_data_root_tuple_inclusion_proof failed");

    ctx.client
        .share_get_eds(height, AppVersion::V3)
        .await
        .expect("share_get_eds failed");
    ctx.client
        .share_get_range(height, AppVersion::V3, 0, 1)
        .await
        .expect("share_get_range failed");
    ctx.client
        .share_get_samples(height, AppVersion::V3, [(0u16, 0u16)])
        .await
        .expect("share_get_samples failed");
    ctx.client
        .share_get_row(height, AppVersion::V3, square_width, 0)
        .await
        .expect("share_get_row failed");
    ctx.client
        .share_get_share(height, AppVersion::V3, square_width, 0, 0)
        .await
        .expect("share_get_share failed");
    ctx.client
        .share_get_namespace_data(height, AppVersion::V3, namespace)
        .await
        .expect("share_get_namespace_data failed");
    ctx.client
        .share_shares_available(height)
        .await
        .expect("share_shares_available failed");
}
