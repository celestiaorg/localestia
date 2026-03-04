# localestia

localestia is celestia at home, a simple mock for performing integration testing and for experimentation, built using redis as a backend for a celestia-node compatible jsonrpc server. To try it out locally:

```
cargo run
```

## Prerequisites

- Rust toolchain (cargo) installed via <https://rustup.rs>
- Redis running locally or reachable via `REDIS_URL` (install via your package manager or `docker run --rm -p 6379:6379 redis:7`)
- curl installed (required for CLI-based integration tests; install via your package manager)
- Docker (optional, only needed for `LOCALESTIA_REDIS_MODE=docker` test runs)
- Foundry (`forge`, `anvil`) for mock contract deployment and demo
- Bun (for the demo UI)

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

## CLI Commands

### Deploy the Mock Blobstream Contract

```bash
localestia blobstream deploy \
  --eth-rpc-url http://127.0.0.1:8545 \
  --private-key 0x...
```

Optional:

```bash
  --chain-id 31337
```

### Run the Full Demo Stack

```bash
localestia demo --relayer-interval-ms 1000 --ui-port 3030
```

This command starts Redis, Anvil, Localestia, deploys the mock contract, starts the relayer,
and serves the UI.

It also auto-submits blobs (and generates headers) every 1500ms by default. To tune or disable:

```bash
localestia demo --auto-blob-interval-ms 2000
# set to 0 to disable auto-submission
localestia demo --auto-blob-interval-ms 0
```

If `REDIS_URL` is not set, the demo command starts Redis via Docker. If `anvil` is not installed,
it attempts to run Anvil via Docker.

### Demo Walkthrough

1) Start the demo:

```bash
localestia demo --relayer-interval-ms 1000 --ui-port 3030
```

1) Open the UI:

```bash
http://127.0.0.1:3030
```

1) Optional flags:

```bash
# Change relayer interval (ms)
localestia demo --relayer-interval-ms 2000

# Disable auto-submitted blobs
localestia demo --auto-blob-interval-ms 0

# Move the UI port
localestia demo --ui-port 4040
```

### Troubleshooting

- `bun: command not found`: install Bun and ensure it is on PATH (`curl -fsSL https://bun.sh/install | bash`).
- `anvil: command not found`: install Foundry or make sure Docker is running so Anvil can run in a container.
- `Failed to run bun install`: delete `ui/node_modules` and retry, or run `bun install` manually.
- `Redis is not reachable`: set `REDIS_URL` or ensure Docker is available so the demo can start Redis.
- UI is empty: wait a few seconds for auto-submitted blobs to generate headers, or submit a blob manually.

Defaults if unset:

- `REDIS_URL=redis://127.0.0.1:6379`
- `LISTEN_ADDR=127.0.0.1:26658`

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

### Anvil + Foundry (required for blobstream contract test)

The blobstream contract compatibility test deploys the mock Blobstream contract to Anvil and
verifies proofs on-chain. It requires `anvil` and `forge` to be available.

Preferred (Docker Anvil + local Foundry install):

```bash
./scripts/setup_anvil.sh
# then export the values printed by the script
export ANVIL_RPC_URL=http://127.0.0.1:8545
export ANVIL_PRIVATE_KEY=0x...
```

If Docker is not available, the script installs Foundry locally. Tests will spawn a local `anvil`
binary automatically.

### Demo UI

The demo command runs the UI using Bun + ElysiaJS. You can run it manually:

```bash
cd ui
bun install
CELESTIA_HTTP_URL=http://127.0.0.1:26658 \
ETH_RPC_URL=http://127.0.0.1:8545 \
BLOBSTREAM_CONTRACT_ADDRESS=0x... \
bun src/index.ts
```

The explorer shows an interactive map with Celestia and Ethereum nodes, a live fiber stream
between them, and three paginated columns (Celestia blocks, Ethereum blocks, relayed batches).
Click any item to inspect details with raw JSON.

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

### Blobstream Methods

| Method | Description | Parameters |
| ------ | ----------- | ---------- |
| `blobstream.GetDataRootTupleRoot` | Computes a merkle root of data root tuples over a block range | `start: u64`, `end: u64` |
| `blobstream.GetDataRootTupleInclusionProof` | Creates an inclusion proof for a data root tuple within a range | `height: u64`, `start: u64`, `end: u64` |

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

## Blobstream Mock Contract + Relayer

Localestia ships a mock Blobstream contract and a relayer that submits data root tuple roots
to an EVM chain for local testing.

### Deploy the Mock Contract (Foundry)

Prerequisites:

- Foundry installed (`forge`, `cast`)

From the repo root:

```bash
cd contracts
ETH_RPC_URL=http://127.0.0.1:8545 \
ETH_PRIVATE_KEY=... \
./scripts/deploy_mock_blobstream.sh
```

This script deploys and initializes the contract. It prints the deployed address; export it as:

```bash
export BLOBSTREAM_CONTRACT_ADDRESS=0x...
```

### Run the Relayer

The relayer submits one header at a time (no batching) as headers appear in Localestia.

```bash
ETH_RPC_URL=http://127.0.0.1:8545 \
ETH_PRIVATE_KEY=... \
BLOBSTREAM_CONTRACT_ADDRESS=0x... \
CELESTIA_RPC_URL=ws://127.0.0.1:26658 \
cargo run --bin blobstream_relayer
```

Optional environment variables:

- `RELAYER_POLL_MS` (default: 1000)
