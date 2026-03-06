#!/usr/bin/env bash
set -euo pipefail

if ! command -v forge >/dev/null 2>&1; then
  echo "forge is required; install Foundry first"
  exit 1
fi

if ! command -v cast >/dev/null 2>&1; then
  echo "cast is required; install Foundry first"
  exit 1
fi

if [[ -z "${ETH_RPC_URL:-}" ]]; then
  echo "ETH_RPC_URL is required"
  exit 1
fi

if [[ -z "${ETH_PRIVATE_KEY:-}" ]]; then
  echo "ETH_PRIVATE_KEY is required"
  exit 1
fi

INITIAL_LATEST_BLOCK=${INITIAL_LATEST_BLOCK:-0}

forge build

OUTPUT=$(forge create --rpc-url "$ETH_RPC_URL" --private-key "$ETH_PRIVATE_KEY" --json src/MockBlobstream.sol:Mockstream)
echo "$OUTPUT"

if command -v jq >/dev/null 2>&1; then
  ADDRESS=$(echo "$OUTPUT" | jq -r '.deployedTo')
  if [[ -z "$ADDRESS" || "$ADDRESS" == "null" ]]; then
    echo "failed to read deployed address"
    exit 1
  fi
else
  echo "jq not found; install jq to auto-extract the deployed address"
  exit 0
fi

cast send --rpc-url "$ETH_RPC_URL" --private-key "$ETH_PRIVATE_KEY" "$ADDRESS" "initialize(uint64)" "$INITIAL_LATEST_BLOCK"

echo "Mockstream deployed at $ADDRESS"
echo "export BLOBSTREAM_CONTRACT_ADDRESS=$ADDRESS"
