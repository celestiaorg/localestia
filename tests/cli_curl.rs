mod utils;

use celestia_rpc::prelude::*;
use celestia_types::{Blob, ExtendedHeader};
use serde_json::{json, Value};
use std::process::Command;
use utils::{make_blob, make_namespace, setup_process};

fn curl_rpc(url: &str, payload: &Value) -> Value {
    let payload_str = serde_json::to_string(payload).expect("failed to serialize JSON-RPC payload");
    let output = Command::new("curl")
        .arg("-sS")
        .arg("-X")
        .arg("POST")
        .arg(url)
        .arg("-H")
        .arg("Content-Type: application/json")
        .arg("-d")
        .arg(payload_str)
        .output()
        .unwrap_or_else(|err| {
            if err.kind() == std::io::ErrorKind::NotFound {
                panic!("curl is required for CLI tests; install curl to run this test");
            }
            panic!("failed to run curl: {err}");
        });

    if !output.status.success() {
        panic!("curl failed: {}", String::from_utf8_lossy(&output.stderr));
    }

    let value: Value =
        serde_json::from_slice(&output.stdout).expect("curl returned invalid JSON-RPC response");

    if let Some(error) = value.get("error") {
        panic!("JSON-RPC error response: {error}");
    }

    value
}

#[tokio::test]
async fn curl_json_rpc_roundtrip() {
    let ctx = setup_process().await;
    let namespace = make_namespace(40);
    let blob = make_blob(namespace, b"curl blob".to_vec());

    let blob_value = serde_json::to_value(&blob).expect("failed to serialize blob");
    let tx_value = serde_json::to_value(&celestia_rpc::TxConfig::default())
        .expect("failed to serialize tx config");

    let submit_payload = json!({
        "id": 1,
        "jsonrpc": "2.0",
        "method": "blob.Submit",
        "params": [[blob_value], tx_value]
    });
    let submit_response = curl_rpc(&ctx.http_url, &submit_payload);
    let height = submit_response
        .get("result")
        .and_then(|value| value.as_u64())
        .expect("blob.Submit did not return a height");
    assert!(height > 0, "expected non-zero height from blob.Submit");

    let get_payload = json!({
        "id": 2,
        "jsonrpc": "2.0",
        "method": "blob.Get",
        "params": [height, namespace, blob.commitment]
    });
    let get_response = curl_rpc(&ctx.http_url, &get_payload);
    let curl_blob: Blob = serde_json::from_value(
        get_response
            .get("result")
            .cloned()
            .expect("blob.Get missing result"),
    )
    .expect("failed to parse blob.Get result");

    let ws_blob = ctx
        .client
        .blob_get(height, namespace, blob.commitment)
        .await
        .expect("ws blob_get failed");
    assert_eq!(curl_blob, ws_blob);

    let header_payload = json!({
        "id": 3,
        "jsonrpc": "2.0",
        "method": "header.GetByHeight",
        "params": [height]
    });
    let header_response = curl_rpc(&ctx.http_url, &header_payload);
    let curl_header: ExtendedHeader = serde_json::from_value(
        header_response
            .get("result")
            .cloned()
            .expect("header.GetByHeight missing result"),
    )
    .expect("failed to parse header.GetByHeight result");

    let ws_header = ctx
        .client
        .header_get_by_height(height)
        .await
        .expect("ws header_get_by_height failed");
    assert_eq!(curl_header, ws_header);
}
