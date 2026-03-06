# localestia

localestia is celestia at home, a simple mock for performing integration testing and for experimentation, built using redis as a backend for a celestia-node compatible jsonrpc server. To try it out locally:

```
cargo run
```

## Prerequisites

- Rust toolchain (cargo) installed via <https://rustup.rs>
- Redis running locally or reachable via `REDIS_URL` (install via your package manager or `docker run --rm -p 6379:6379 redis:7`)
- curl installed (required for CLI-based integration tests; install via your package manager)
- Docker (optional, only needed for `LOCALESTIA_REDIS_MODE=docker` test runs), see the [docker guide](./Dockerfile)

## Build

```bash
cargo build
```

```bash
cargo build --release
```

## Run

```bash
REDIS_URL=redis://127.0.0.1:6379 LISTEN_ADDR=127.0.0.1:26658 cargo run
```

Defaults if unset:

- `REDIS_URL=redis://127.0.0.1:6379`
- `LISTEN_ADDR=127.0.0.1:26658`
- `GRPC_ADDR=0.0.0.0:9090`

Localestia clears the Redis database on startup.

## Test

```bash
REDIS_URL=redis://127.0.0.1:6379 cargo test
```

Tests require a running Redis instance. CLI integration tests also require curl.

To have tests start Redis automatically via Docker:

```bash
LOCALESTIA_REDIS_MODE=docker cargo test
```

You can also use `LOCALESTIA_REDIS_MODE=auto` to prefer a local `REDIS_URL` if set and fall back to Docker when available.

### gRPC integration tests

The `grpc` test suite starts a real localestia process on ephemeral ports and exercises all five gRPC services via generated tonic client stubs:

```bash
# With a local Redis already running:
LOCALESTIA_REDIS_MODE=local cargo test --test grpc -- --test-threads=1

# Or let the test harness spin up a Redis container:
LOCALESTIA_REDIS_MODE=docker cargo test --test grpc -- --test-threads=1
```

`--test-threads=1` is required because each test acquires a global lock (one localestia process at a time). The tests cover:

| Test | gRPC service | What is verified |
|---|---|---|
| `test_get_node_info` | `cosmos.base.tendermint.v1beta1.Service` | moniker=`localestia`, network=`private` |
| `test_account` | `cosmos.auth.v1beta1.Query` | account_number=1, sequence=0 |
| `test_broadcast_tx_empty` | `cosmos.tx.v1beta1.Service` | code=0, height=0 for an empty tx |
| `test_tx_status_unknown_returns_committed` | `celestia.core.v1.tx.Tx` | status=`COMMITTED`, height=1 for unknown tx |
| `test_estimate_gas_price` | `celestia.core.v1.gas_estimation.GasEstimator` | price=0.002 |
| `test_estimate_gas_price_and_usage` | `celestia.core.v1.gas_estimation.GasEstimator` | price=0.002, gas_used=500 000 |

## Supported RPC Methods

Localestia implements the following JSON-RPC methods:

### Blob Methods

| Method | Description | Parameters |
| ------ | ----------- | ---------- |
| `blob.Get` | Retrieves a blob by height, namespace, and commitment | `height: u64`, `namespace: Namespace`, `commitment: Commitment` |
| `blob.Submit` | Submits one or more blobs and returns the height | `blobs: Vec<Blob>`, `opts: TxConfig` |
| `blob.Included` | Checks if a blob is included at a specified height | `height: u64`, `namespace: Namespace`, `proof: NamespaceProof`, `commitment: Commitment` |

### Header Methods

| Method | Description | Parameters |
| ------ | ----------- | ---------- |
| `header.GetByHash` | Gets a header by its hash | `hash: Hash` |
| `header.GetByHeight` | Gets a header at a specific height | `height: u64` |
| `header.GetRangeByHeight` | Gets a range of headers | `from: u64`, `to: u64` |
| `header.WaitForHeight` | Waits for a header at a specific height | `height: u64` |

### Share Methods

| Method | Description | Parameters |
| ------ | ----------- | ---------- |
| `share.GetEDS` | Gets the Extended Data Square at a height | `height: u64` |
| `share.GetRange` | Gets a range of shares | `height: u64`, `start: u64`, `end: u64` |

## Usage Examples

### Submit a Blob

```bash
curl -X POST "http://localhost:26658" \
  -H "Content-Type: application/json" \
  -d '{
    "id": 1,
    "jsonrpc": "2.0",
    "method": "blob.Submit",
    "params": [
      [
        {
          "namespace": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAMJ/xGlNMdE=",
          "data": "SGVsbG8gQ2VsZXN0aWEh",
          "share_version": 0,
          "commitment": "aHlbp+J9yub6hw/uhK6dP8hBLR2mFy78XNRRdLf2794=",
          "index": 0
        }
      ],
      {
        "gas_limit": 100000,
        "fee": 2000,
        "memo": "test submit"
      }
    ]
  }'
```

### Get a Header

```bash
curl -X POST "http://localhost:26658" \
  -H "Content-Type: application/json" \
  -d '{
    "id": 1,
    "jsonrpc": "2.0",
    "method": "header.GetByHeight",
    "params": [1]
  }'
```

### Get Extended Data Square

```bash
curl -X POST "http://localhost:26658" \
  -H "Content-Type: application/json" \
  -d '{
    "id": 1,
    "jsonrpc": "2.0",
    "method": "share.GetEDS",
    "params": [1]
  }'
```

## Docker Setup

See the [Docker Usage Guide](DOCKER.md) for instructions on running Localestia with Docker.
