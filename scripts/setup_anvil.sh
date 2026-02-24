#!/usr/bin/env bash
set -euo pipefail

ANVIL_PORT=${ANVIL_PORT:-8545}
ANVIL_CONTAINER_NAME=${ANVIL_CONTAINER_NAME:-localestia-anvil}
ANVIL_IMAGE=${ANVIL_IMAGE:-ghcr.io/foundry-rs/foundry:latest}
ANVIL_MNEMONIC=${ANVIL_MNEMONIC:-"test test test test test test test test test test test junk"}

install_foundry() {
  if ! command -v foundryup >/dev/null 2>&1; then
    curl -L https://foundry.paradigm.xyz | bash
  fi

  export PATH="$HOME/.foundry/bin:$PATH"
  foundryup
}

ensure_foundry() {
  if ! command -v forge >/dev/null 2>&1; then
    install_foundry
  fi
}

if command -v docker >/dev/null 2>&1; then
  ensure_foundry

  docker rm -f "$ANVIL_CONTAINER_NAME" >/dev/null 2>&1 || true
  docker run -d --name "$ANVIL_CONTAINER_NAME" -p "$ANVIL_PORT:8545" "$ANVIL_IMAGE" \
    anvil --host 0.0.0.0 --port 8545 -m "$ANVIL_MNEMONIC" >/dev/null

  for _ in {1..50}; do
    if docker logs "$ANVIL_CONTAINER_NAME" 2>&1 | grep -q "Listening on"; then
      break
    fi
    sleep 0.1
  done

  PRIVATE_KEY=$(docker logs "$ANVIL_CONTAINER_NAME" 2>&1 | awk '/Private Keys/{found=1;next} found && $1 ~ /^\(0\)/ {print $2; exit}')
  if [[ -z "$PRIVATE_KEY" ]]; then
    echo "failed to read the first Anvil private key from docker logs"
    exit 1
  fi

  echo "Anvil is running in docker as $ANVIL_CONTAINER_NAME"
  echo "export ANVIL_RPC_URL=http://127.0.0.1:${ANVIL_PORT}"
  echo "export ANVIL_PRIVATE_KEY=$PRIVATE_KEY"
  exit 0
fi

ensure_foundry
echo "Foundry installed. Run tests and local Anvil will be spawned automatically."
