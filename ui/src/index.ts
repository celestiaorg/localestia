import { Elysia } from "elysia";

const celestiaUrl = process.env.CELESTIA_HTTP_URL ?? "http://127.0.0.1:26658";
const ethRpcUrl = process.env.ETH_RPC_URL ?? "http://127.0.0.1:8545";
const contractAddress = process.env.BLOBSTREAM_CONTRACT_ADDRESS;
const port = Number(process.env.UI_PORT ?? 3030);
const celestiaLimit = Number(process.env.CELESTIA_BLOCKS_LIMIT ?? 20);
const ethereumLimit = Number(process.env.ETH_BLOCKS_LIMIT ?? 20);
const ethLogBlocks = Number(process.env.ETH_LOG_BLOCKS ?? 200);

if (!contractAddress) {
  console.error("BLOBSTREAM_CONTRACT_ADDRESS is required");
  process.exit(1);
}

type CelestiaBlock = {
  height: number;
  hash: string;
  time: string;
};

type EthereumBlock = {
  height: number;
  hash: string;
  time: string;
};

type RelayedBatch = {
  proofNonce: string;
  startBlock: number;
  endBlock: number;
  dataCommitment: string;
  txHash: string;
};

async function rpc(url: string, method: string, params: unknown[]) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!response.ok) {
    throw new Error(`RPC request failed: ${response.status}`);
  }
  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.message ?? "RPC error");
  }
  return data.result;
}

function parseCelestiaBlock(header: any): CelestiaBlock {
  const height = Number(header?.header?.height ?? 0);
  const hash = header?.commit?.block_id?.hash ?? "";
  const time = header?.header?.time ?? "";
  return { height, hash, time };
}

async function fetchCelestiaBlocks(): Promise<CelestiaBlock[]> {
  const head = await rpc(celestiaUrl, "header.LocalHead", []);
  const headHeight = Number(head?.header?.height ?? 0);
  if (!headHeight) {
    return [];
  }
  const start = Math.max(1, headHeight - celestiaLimit + 1);
  const blocks: CelestiaBlock[] = [];
  for (let height = start; height <= headHeight; height++) {
    const header = await rpc(celestiaUrl, "header.GetByHeight", [height]);
    blocks.push(parseCelestiaBlock(header));
  }
  return blocks;
}

function parseEthereumBlock(block: any): EthereumBlock {
  const height = Number.parseInt(block?.number ?? "0", 16);
  const time = block?.timestamp
    ? new Date(Number.parseInt(block.timestamp, 16) * 1000).toISOString()
    : "";
  return { height, hash: block?.hash ?? "", time };
}

async function fetchEthereumBlocks(): Promise<EthereumBlock[]> {
  const latestHex = await rpc(ethRpcUrl, "eth_blockNumber", []);
  const latest = Number.parseInt(latestHex ?? "0", 16);
  if (!latest) {
    return [];
  }
  const start = Math.max(0, latest - ethereumLimit + 1);
  const blocks: EthereumBlock[] = [];
  for (let height = start; height <= latest; height++) {
    const hex = `0x${height.toString(16)}`;
    const block = await rpc(ethRpcUrl, "eth_getBlockByNumber", [hex, false]);
    blocks.push(parseEthereumBlock(block));
  }
  return blocks;
}

function hexToNumber(hex: string | undefined): number {
  if (!hex) return 0;
  return Number(BigInt(hex));
}

async function fetchRelayedBatches(): Promise<RelayedBatch[]> {
  const latestHex = await rpc(ethRpcUrl, "eth_blockNumber", []);
  const latest = Number.parseInt(latestHex ?? "0", 16);
  const from = Math.max(0, latest - ethLogBlocks + 1);
  const logs = await rpc(ethRpcUrl, "eth_getLogs", [
    {
      address: contractAddress,
      fromBlock: `0x${from.toString(16)}`,
      toBlock: "latest",
    },
  ]);

  const batches: RelayedBatch[] = [];
  for (const log of logs ?? []) {
    const topics = log.topics ?? [];
    const startBlock = hexToNumber(topics[1]);
    const endBlock = hexToNumber(topics[2]);
    const dataCommitment = topics[3] ?? "";
    const proofNonce = log.data ? BigInt(log.data).toString() : "0";
    batches.push({
      proofNonce,
      startBlock,
      endBlock,
      dataCommitment,
      txHash: log.transactionHash ?? "",
    });
  }

  return batches;
}

const app = new Elysia()
  .get("/", ({ set }) => {
    set.headers["content-type"] = "text/html; charset=utf-8";
    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Localestia Demo</title>
    <style>
      :root {
        color-scheme: light;
        font-family: "IBM Plex Mono", "JetBrains Mono", "SFMono-Regular", monospace;
        background: radial-gradient(circle at top, #f4f1ed 0%, #e9e2d9 40%, #e3d8cb 100%);
        color: #1e1a16;
      }
      body {
        margin: 0;
        padding: 24px;
      }
      h1 {
        margin: 0 0 16px;
        font-size: 28px;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 16px;
      }
      .card {
        background: rgba(255, 255, 255, 0.8);
        border-radius: 14px;
        padding: 16px;
        box-shadow: 0 10px 24px rgba(0, 0, 0, 0.08);
      }
      .title {
        font-size: 14px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        margin-bottom: 10px;
        color: #6b5c4f;
      }
      ul {
        list-style: none;
        padding: 0;
        margin: 0;
        display: grid;
        gap: 8px;
      }
      li {
        padding: 8px 10px;
        border-radius: 10px;
        background: #f7f2ed;
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-size: 12px;
      }
      .meta {
        display: flex;
        justify-content: space-between;
        font-size: 11px;
        color: #6b5c4f;
      }
      code {
        font-size: 11px;
        word-break: break-all;
      }
    </style>
  </head>
  <body>
    <h1>Localestia Demo</h1>
    <div class="grid">
      <div class="card">
        <div class="title">Celestia Blocks</div>
        <ul id="celestia"></ul>
      </div>
      <div class="card">
        <div class="title">Ethereum Blocks</div>
        <ul id="ethereum"></ul>
      </div>
      <div class="card">
        <div class="title">Relayed Batches</div>
        <ul id="batches"></ul>
      </div>
    </div>
    <script>
      async function refresh() {
        try {
          const response = await fetch('/api/state');
          const data = await response.json();
          renderList('celestia', data.celestia, block => '#' + block.height, block => block.hash, block => block.time);
          renderList('ethereum', data.ethereum, block => '#' + block.height, block => block.hash, block => block.time);
          renderBatchList('batches', data.batches || []);
        } catch (err) {
          console.error(err);
        }
      }

      function renderList(id, items, title, hash, time) {
        const root = document.getElementById(id);
        root.innerHTML = '';
        for (const item of items) {
          const li = document.createElement('li');
          li.innerHTML =
            '<div class="meta"><span>' +
            title(item) +
            '</span><span>' +
            time(item) +
            '</span></div>' +
            '<code>' +
            hash(item) +
            '</code>';
          root.appendChild(li);
        }
      }

      function renderBatchList(id, items) {
        const root = document.getElementById(id);
        root.innerHTML = '';
        for (const item of items) {
          const li = document.createElement('li');
          li.innerHTML =
            '<div class="meta"><span>Nonce ' +
            item.proofNonce +
            '</span><span>' +
            item.startBlock +
            ' -> ' +
            item.endBlock +
            '</span></div>' +
            '<code>' +
            item.dataCommitment +
            '</code>';
          root.appendChild(li);
        }
      }

      refresh();
      setInterval(refresh, 1000);
    </script>
  </body>
</html>`;
  })
  .get("/api/state", async () => {
    const [celestia, ethereum, batches] = await Promise.all([
      fetchCelestiaBlocks(),
      fetchEthereumBlocks(),
      fetchRelayedBatches(),
    ]);
    return { celestia, ethereum, batches };
  })
  .listen(port);

console.log(`UI listening on http://127.0.0.1:${port}`);
console.log(`Celestia RPC: ${celestiaUrl}`);
console.log(`Ethereum RPC: ${ethRpcUrl}`);
