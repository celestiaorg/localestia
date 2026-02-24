import { Elysia } from "elysia";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { createClient, RedisClientType } from "redis";

const celestiaUrl = process.env.CELESTIA_HTTP_URL ?? "http://127.0.0.1:26658";
const ethRpcUrl = process.env.ETH_RPC_URL ?? "http://127.0.0.1:8545";
const contractAddress = process.env.BLOBSTREAM_CONTRACT_ADDRESS;
const port = Number(process.env.UI_PORT ?? 3030);
const celestiaLimit = Number(process.env.CELESTIA_BLOCKS_LIMIT ?? 20);
const ethereumLimit = Number(process.env.ETH_BLOCKS_LIMIT ?? 20);
const ethLogBlocks = Number(process.env.ETH_LOG_BLOCKS ?? 200);
const pageSize = 10;
const assetsDir = resolve(import.meta.dir, "../../assets");
const rollupDir = process.env.ROLLUP_METADATA_DIR;
const rollupRedisUrl = process.env.ROLLUP_REDIS_URL;
const rollupRedisKey = process.env.ROLLUP_REDIS_KEY ?? "localestia:rollups";

if (!contractAddress) {
  console.error("BLOBSTREAM_CONTRACT_ADDRESS is required");
  process.exit(1);
}

type CelestiaBlock = {
  height: number;
  hash: string;
  time: string;
};

type CelestiaBlockDetail = CelestiaBlock & {
  squareWidth: number;
  appVersion: string;
  lastBlockHash: string;
  dahHash: string;
  raw: unknown;
};

type EthereumBlock = {
  height: number;
  hash: string;
  time: string;
};

type EthereumBlockDetail = EthereumBlock & {
  txCount: number;
  gasUsed: string;
  baseFeePerGas: string;
  parentHash: string;
  raw: unknown;
};

type RelayedBatch = {
  proofNonce: string;
  startBlock: number;
  endBlock: number;
  dataCommitment: string;
  txHash: string;
  blockNumber: number;
};

type RelayedBatchDetail = RelayedBatch & {
  blockTime: string;
  raw: unknown;
};

type Rollup = {
  id: string;
  name: string;
  status: string;
  chainId?: string | number;
  rpcUrl?: string;
  description?: string;
  source: string;
  raw: unknown;
};

type Paginated<T> = {
  items: T[];
  nextCursor: string | number | null;
};

const cache = new Map<string, { ts: number; value: unknown }>();
let redisClient: RedisClientType | null = null;
let redisReady = false;
let redisUnavailable = false;

async function withCache<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const entry = cache.get(key);
  if (entry && now - entry.ts < ttlMs) {
    return entry.value as T;
  }
  const value = await fn();
  cache.set(key, { ts: now, value });
  return value;
}

async function rpc(url: string, method: string, params: unknown[]) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!response.ok) {
    throw new Error("RPC request failed: " + response.status);
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

function parseCelestiaDetail(header: any): CelestiaBlockDetail {
  const summary = parseCelestiaBlock(header);
  const squareWidth = Number(header?.dah?.row_roots?.length ?? 0);
  const appVersion = String(header?.header?.version?.app ?? "");
  const lastBlockHash = header?.header?.last_block_id?.hash ?? "";
  const dahHash = computeDahHash(header?.dah ?? null);
  return {
    ...summary,
    squareWidth,
    appVersion,
    lastBlockHash,
    dahHash,
    raw: header,
  };
}

function parseEthereumBlock(block: any): EthereumBlock {
  const height = Number.parseInt(block?.number ?? "0", 16);
  const time = block?.timestamp
    ? new Date(Number.parseInt(block.timestamp, 16) * 1000).toISOString()
    : "";
  return { height, hash: block?.hash ?? "", time };
}

function parseEthereumDetail(block: any): EthereumBlockDetail {
  const summary = parseEthereumBlock(block);
  const txCount = Array.isArray(block?.transactions) ? block.transactions.length : 0;
  const gasUsed = block?.gasUsed ?? "";
  const baseFeePerGas = block?.baseFeePerGas ?? "";
  const parentHash = block?.parentHash ?? "";
  return {
    ...summary,
    txCount,
    gasUsed,
    baseFeePerGas,
    parentHash,
    raw: block,
  };
}

function decodeRoot(value: string): Uint8Array {
  if (!value) {
    return new Uint8Array();
  }
  if (/^[0-9a-fA-F]+$/.test(value) && value.length % 2 === 0) {
    return Uint8Array.from(Buffer.from(value, "hex"));
  }
  return Uint8Array.from(Buffer.from(value, "base64"));
}

function sha256(bytes: Uint8Array): Uint8Array {
  return Uint8Array.from(createHash("sha256").update(bytes).digest());
}

function leafHash(bytes: Uint8Array): Uint8Array {
  const prefixed = Buffer.concat([Buffer.from([0x00]), Buffer.from(bytes)]);
  return sha256(prefixed);
}

function innerHash(left: Uint8Array, right: Uint8Array): Uint8Array {
  const prefixed = Buffer.concat([Buffer.from([0x01]), Buffer.from(left), Buffer.from(right)]);
  return sha256(prefixed);
}

function nextPowerOfTwo(value: number): number {
  if (value <= 1) return 1;
  let power = 1;
  while (power < value) {
    power *= 2;
  }
  return power;
}

function simpleHashFromByteVectors(leaves: Uint8Array[]): Uint8Array {
  const length = leaves.length;
  if (length === 0) {
    return sha256(new Uint8Array());
  }
  if (length === 1) {
    return leafHash(leaves[0]);
  }
  const split = nextPowerOfTwo(length) / 2;
  const left = simpleHashFromByteVectors(leaves.slice(0, split));
  const right = simpleHashFromByteVectors(leaves.slice(split));
  return innerHash(left, right);
}

function toHexUpper(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex").toUpperCase();
}

function computeDahHash(dah: any): string {
  if (!dah) return "";
  const rowRoots = Array.isArray(dah.row_roots) ? dah.row_roots : [];
  const colRoots = Array.isArray(dah.column_roots) ? dah.column_roots : [];
  const leaves = rowRoots.concat(colRoots).map((root: string) => decodeRoot(root));
  if (leaves.length === 0) {
    return "";
  }
  const root = simpleHashFromByteVectors(leaves);
  return toHexUpper(root);
}

function hexToNumber(hex: string | undefined): number {
  if (!hex) return 0;
  return Number(BigInt(hex));
}

function toBigInt(value: string): bigint {
  try {
    return BigInt(value);
  } catch {
    return BigInt(0);
  }
}

async function listCelestiaBlocks(limit: number, before?: number): Promise<Paginated<CelestiaBlock>> {
  const key = "celestia:" + limit + ":" + (before ?? "latest");
  return withCache(key, 750, async () => {
    const head = await rpc(celestiaUrl, "header.LocalHead", []);
    const headHeight = Number(head?.header?.height ?? 0);
    if (!headHeight) {
      return { items: [], nextCursor: null };
    }
    let start = headHeight;
    if (before && before > 0) {
      start = Math.min(before - 1, headHeight);
    }
    if (start < 1) {
      return { items: [], nextCursor: null };
    }
    const end = Math.max(1, start - limit + 1);
    const items: CelestiaBlock[] = [];
    for (let height = start; height >= end; height--) {
      const header = await rpc(celestiaUrl, "header.GetByHeight", [height]);
      items.push(parseCelestiaBlock(header));
    }
    const nextCursor = end > 1 ? end : null;
    return { items, nextCursor };
  });
}

async function getCelestiaBlockDetail(height: number): Promise<CelestiaBlockDetail | null> {
  if (!height) return null;
  const header = await rpc(celestiaUrl, "header.GetByHeight", [height]);
  return parseCelestiaDetail(header);
}

async function listEthereumBlocks(limit: number, before?: number): Promise<Paginated<EthereumBlock>> {
  const key = "ethereum:" + limit + ":" + (before ?? "latest");
  return withCache(key, 750, async () => {
    const latestHex = await rpc(ethRpcUrl, "eth_blockNumber", []);
    const latest = Number.parseInt(latestHex ?? "0", 16);
    if (!latest && latest !== 0) {
      return { items: [], nextCursor: null };
    }
    let start = latest;
    if (before !== undefined && before !== null) {
      start = Math.min(before - 1, latest);
    }
    if (start < 0) {
      return { items: [], nextCursor: null };
    }
    const end = Math.max(0, start - limit + 1);
    const items: EthereumBlock[] = [];
    for (let height = start; height >= end; height--) {
      const hex = "0x" + height.toString(16);
      const block = await rpc(ethRpcUrl, "eth_getBlockByNumber", [hex, false]);
      items.push(parseEthereumBlock(block));
    }
    const nextCursor = end > 0 ? end : null;
    return { items, nextCursor };
  });
}

async function getEthereumBlockDetail(height: number): Promise<EthereumBlockDetail | null> {
  if (height === null || height === undefined) return null;
  const hex = "0x" + height.toString(16);
  const block = await rpc(ethRpcUrl, "eth_getBlockByNumber", [hex, true]);
  return parseEthereumDetail(block);
}

async function fetchBatchLogs(): Promise<any[]> {
  const latestHex = await rpc(ethRpcUrl, "eth_blockNumber", []);
  const latest = Number.parseInt(latestHex ?? "0", 16);
  const from = Math.max(0, latest - ethLogBlocks + 1);
  return rpc(ethRpcUrl, "eth_getLogs", [
    {
      address: contractAddress,
      fromBlock: "0x" + from.toString(16),
      toBlock: "latest",
    },
  ]);
}

function parseBatch(log: any): RelayedBatch {
  const topics = log.topics ?? [];
  const startBlock = hexToNumber(topics[1]);
  const endBlock = hexToNumber(topics[2]);
  const dataCommitment = topics[3] ?? "";
  const proofNonce = log.data ? BigInt(log.data).toString() : "0";
  const blockNumber = hexToNumber(log.blockNumber);
  return {
    proofNonce,
    startBlock,
    endBlock,
    dataCommitment,
    txHash: log.transactionHash ?? "",
    blockNumber,
  };
}

async function listBatches(limit: number, before?: string): Promise<Paginated<RelayedBatch>> {
  const key = "batches:" + limit + ":" + (before ?? "latest");
  return withCache(key, 750, async () => {
    const logs = await fetchBatchLogs();
    const parsed = (logs ?? []).map(parseBatch);
    parsed.sort((a, b) => {
      const left = toBigInt(a.proofNonce);
      const right = toBigInt(b.proofNonce);
      if (left === right) return 0;
      return left < right ? 1 : -1;
    });
    const filtered = before
      ? parsed.filter((item) => toBigInt(item.proofNonce) < toBigInt(before))
      : parsed;
    const items = filtered.slice(0, limit);
    const nextCursor = items.length === limit ? items[items.length - 1].proofNonce : null;
    return { items, nextCursor };
  });
}

async function getBatchDetail(proofNonce: string): Promise<RelayedBatchDetail | null> {
  const logs = await fetchBatchLogs();
  const match = (logs ?? []).find((log: any) => {
    const nonce = log.data ? BigInt(log.data).toString() : "0";
    return nonce === proofNonce;
  });
  if (!match) return null;
  const parsed = parseBatch(match);
  const block = await rpc(ethRpcUrl, "eth_getBlockByNumber", [match.blockNumber, false]);
  const time = block?.timestamp
    ? new Date(Number.parseInt(block.timestamp, 16) * 1000).toISOString()
    : "";
  return {
    ...parsed,
    blockTime: time,
    raw: match,
  };
}

function normalizeRollup(raw: any, fallbackId: string, source: string): Rollup | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const id = String(raw.id ?? fallbackId);
  const name = String(raw.name ?? raw.title ?? id);
  const status = String(raw.status ?? "unknown");
  const chainId = raw.chainId ?? raw.chain_id;
  const rpcUrl = raw.rpcUrl ?? raw.rpc_url;
  const description = raw.description ?? raw.summary;
  return {
    id,
    name,
    status,
    chainId,
    rpcUrl,
    description,
    source,
    raw,
  };
}

async function loadRollupsFromDir(): Promise<Rollup[]> {
  if (!rollupDir) return [];
  try {
    const files = await readdir(rollupDir);
    const rollups: Rollup[] = [];
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const path = resolve(rollupDir, file);
      try {
        const data = await readFile(path, "utf-8");
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          for (const entry of parsed) {
            const rollup = normalizeRollup(entry, file, "folder");
            if (rollup) rollups.push(rollup);
          }
        } else {
          const rollup = normalizeRollup(parsed, file, "folder");
          if (rollup) rollups.push(rollup);
        }
      } catch {
        continue;
      }
    }
    return rollups;
  } catch {
    return [];
  }
}

async function getRedisClient(): Promise<RedisClientType | null> {
  if (!rollupRedisUrl || redisUnavailable) {
    return null;
  }
  if (redisClient && redisReady) {
    return redisClient;
  }
  try {
    redisClient = createClient({ url: rollupRedisUrl });
    redisClient.on("error", () => {
      redisUnavailable = true;
    });
    await redisClient.connect();
    redisReady = true;
    return redisClient;
  } catch {
    redisUnavailable = true;
    return null;
  }
}

async function loadRollupsFromRedis(): Promise<Rollup[]> {
  const client = await getRedisClient();
  if (!client) return [];
  try {
    const entries = await client.lRange(rollupRedisKey, 0, -1);
    const rollups: Rollup[] = [];
    for (const entry of entries) {
      try {
        const parsed = JSON.parse(entry);
        const rollup = normalizeRollup(parsed, parsed.id ?? entry, "redis");
        if (rollup) rollups.push(rollup);
      } catch {
        continue;
      }
    }
    return rollups;
  } catch {
    return [];
  }
}

async function listRollups(): Promise<Rollup[]> {
  return withCache("rollups", 1000, async () => {
    const [folderRollups, redisRollups] = await Promise.all([
      loadRollupsFromDir(),
      loadRollupsFromRedis(),
    ]);
    const merged = new Map<string, Rollup>();
    for (const rollup of folderRollups) {
      merged.set(rollup.id, rollup);
    }
    for (const rollup of redisRollups) {
      if (!merged.has(rollup.id)) {
        merged.set(rollup.id, rollup);
      }
    }
    return Array.from(merged.values());
  });
}

function contentTypeFor(path: string): string {
  const ext = extname(path).toLowerCase();
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".webm") return "video/webm";
  return "application/octet-stream";
}

function parseNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return undefined;
  }
  return parsed;
}

const app = new Elysia()
  .get("/assets/:file", async ({ params, set }) => {
    const filePath = resolve(assetsDir, params.file);
    if (!filePath.startsWith(assetsDir)) {
      set.status = 400;
      return "invalid asset path";
    }
    try {
      const data = await readFile(filePath);
      set.headers["content-type"] = contentTypeFor(filePath);
      return data;
    } catch {
      set.status = 404;
      return "asset not found";
    }
  })
  .get("/", ({ set }) => {
    set.headers["content-type"] = "text/html; charset=utf-8";
    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Localestia Explorer</title>
    <style>
      @import url("https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&family=IBM+Plex+Mono:wght@400;600&display=swap");
      :root {
        color-scheme: dark;
        --bg: #0b0a12;
        --ink: #f4f1ff;
        --muted: #b6aec9;
        --card: rgba(12, 9, 22, 0.78);
        --card-strong: rgba(18, 13, 30, 0.88);
        --celestia: #2bc6c8;
        --ethereum: #7a86ff;
        --amber: #ffb166;
        --violet: #cbb4ff;
        --shadow: 0 22px 44px rgba(8, 5, 18, 0.45);
      }
      body {
        margin: 0;
        padding: 24px;
        background: radial-gradient(1200px 500px at 16% -10%, rgba(152, 120, 255, 0.32), transparent 60%),
          radial-gradient(1200px 500px at 84% -10%, rgba(203, 180, 255, 0.24), transparent 60%),
          radial-gradient(1000px 420px at 50% 18%, rgba(120, 90, 210, 0.2), transparent 65%),
          var(--bg);
        color: var(--ink);
        font-family: "Space Grotesk", "IBM Plex Sans", "Segoe UI", sans-serif;
        position: relative;
        min-height: 100vh;
        overflow-x: hidden;
      }
      .aurora-veil {
        position: fixed;
        inset: -20% -10% 0 -10%;
        background: radial-gradient(700px 320px at 18% 18%, rgba(120, 78, 210, 0.38), transparent 70%),
          radial-gradient(700px 320px at 70% 12%, rgba(203, 180, 255, 0.32), transparent 70%),
          radial-gradient(700px 320px at 50% 60%, rgba(86, 60, 160, 0.3), transparent 70%);
        filter: blur(44px) saturate(1.2);
        opacity: 0.8;
        mix-blend-mode: screen;
        animation: auroraDrift 18s ease-in-out infinite;
        pointer-events: none;
        z-index: 0;
      }
      @keyframes auroraDrift {
        0% {
          transform: translate3d(-4%, -2%, 0) scale(1);
        }
        50% {
          transform: translate3d(4%, 2%, 0) scale(1.04);
        }
        100% {
          transform: translate3d(-4%, -2%, 0) scale(1);
        }
      }
      .page {
        position: relative;
        z-index: 1;
      }
      h1 {
        margin: 0 0 12px;
        font-size: 32px;
        letter-spacing: -0.02em;
        background: linear-gradient(110deg, var(--violet), var(--celestia));
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
      }
      .map {
        display: grid;
        grid-template-columns: minmax(220px, 1fr) minmax(280px, 2fr) minmax(220px, 1fr);
        align-items: center;
        gap: 0px;
        padding: 16px 0 8px;
      }
      .node {
        background: linear-gradient(135deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0.03)), var(--card);
        border-radius: 20px;
        padding: 18px;
        display: grid;
        gap: 8px;
        justify-items: center;
        text-align: center;
        box-shadow: var(--shadow);
        border: 1px solid rgba(255, 255, 255, 0.14);
        box-shadow: var(--shadow), inset 0 1px 0 rgba(255, 255, 255, 0.14);
        backdrop-filter: blur(20px) saturate(1.35);
        cursor: pointer;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
      }
      .node--celestia {
        border-color: rgba(43, 198, 200, 0.4);
      }
      .node--ethereum {
        border-color: rgba(111, 123, 242, 0.4);
      }
      .node:hover {
        transform: translateY(-3px);
        box-shadow: 0 22px 34px rgba(18, 12, 9, 0.16);
      }
      .node__logo {
        width: 70px;
        height: 70px;
        object-fit: contain;
        filter: drop-shadow(0 14px 24px rgba(30, 20, 60, 0.4));
      }
      .node__label {
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.14em;
        color: var(--muted);
      }
      .node__meta {
        font-size: 12px;
        color: var(--ink);
        font-family: "IBM Plex Mono", "SFMono-Regular", monospace;
      }
      .fiber {
        position: relative;
        height: 110px;
        border-radius: 20px;
        overflow: hidden;
        border: 1px solid transparent;
        box-shadow: none;
        background: transparent;
      }
      .fiber__video {
        width: 100%;
        height: 100%;
        object-fit: cover;
        opacity: 0.9;
        filter: saturate(1.2) contrast(1.05);
      }
      .columns {
        margin-top: 24px;
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 16px;
      }
      .list-card {
        background: linear-gradient(135deg, rgba(255, 255, 255, 0.24), rgba(255, 255, 255, 0.04)), var(--card);
        border-radius: 18px;
        padding: 16px;
        box-shadow: var(--shadow);
        border: 1px solid rgba(255, 255, 255, 0.14);
        display: flex;
        flex-direction: column;
        gap: 12px;
        position: relative;
        overflow: hidden;
        box-shadow: var(--shadow), inset 0 1px 0 rgba(255, 255, 255, 0.16);
        backdrop-filter: blur(22px) saturate(1.35);
      }
      .list-card::before {
        content: "";
        position: absolute;
        inset: 0;
        background: linear-gradient(135deg, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0) 55%);
        opacity: 0.6;
        pointer-events: none;
      }
      .list-card::after {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 1px;
        background: linear-gradient(90deg, rgba(255, 255, 255, 0.6), rgba(255, 255, 255, 0));
        opacity: 0.5;
        pointer-events: none;
      }
      .list-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
      }
      .list-title {
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.14em;
        color: var(--muted);
      }
      .pager {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        color: var(--muted);
        font-family: "IBM Plex Mono", "SFMono-Regular", monospace;
      }
      .actions {
        display: flex;
        gap: 6px;
      }
      .action-button {
        border: 1px solid rgba(120, 120, 160, 0.28);
        background: linear-gradient(120deg, rgba(43, 198, 200, 0.22), rgba(122, 134, 255, 0.18));
        color: var(--ink);
        border-radius: 999px;
        font-size: 11px;
        padding: 4px 10px;
        cursor: pointer;
        font-family: "IBM Plex Mono", "SFMono-Regular", monospace;
      }
      .action-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: grid;
        gap: 8px;
      }
      .list-item {
        background: linear-gradient(135deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0.05)), var(--card-strong);
        border-radius: 12px;
        padding: 10px 12px;
        border: 1px solid rgba(255, 255, 255, 0.18);
        cursor: pointer;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
        display: grid;
        gap: 6px;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12);
      }
      .list-item:hover {
        transform: translateY(-2px);
        box-shadow: 0 12px 20px rgba(0, 0, 0, 0.08);
      }
      .list-item--active {
        border-color: rgba(203, 180, 255, 0.6);
        background: rgba(203, 180, 255, 0.16);
      }
      .list-meta {
        display: flex;
        justify-content: space-between;
        font-size: 11px;
        color: var(--muted);
        font-family: "IBM Plex Mono", "SFMono-Regular", monospace;
      }
      code {
        font-size: 11px;
        word-break: break-all;
        font-family: "IBM Plex Mono", "SFMono-Regular", monospace;
      }
      .modal {
        position: fixed;
        inset: 0;
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 10;
      }
      .modal.is-open {
        display: flex;
      }
      .modal__backdrop {
        position: absolute;
        inset: 0;
        background: rgba(18, 16, 14, 0.45);
        backdrop-filter: blur(4px);
      }
      .modal__content {
        position: relative;
        background: linear-gradient(150deg, rgba(255, 255, 255, 0.24), rgba(255, 255, 255, 0.03)), rgba(14, 10, 24, 0.96);
        border-radius: 16px;
        width: min(620px, 92vw);
        max-height: 80vh;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        box-shadow: 0 28px 70px rgba(6, 4, 14, 0.6);
        border: 1px solid rgba(255, 255, 255, 0.14);
        backdrop-filter: blur(22px) saturate(1.35);
      }
      .modal__content::before {
        content: "";
        position: absolute;
        inset: 0;
        background: linear-gradient(140deg, rgba(255, 255, 255, 0.32) 0%, rgba(255, 255, 255, 0) 45%);
        opacity: 0.35;
        pointer-events: none;
      }
      .modal__header {
        padding: 16px 20px 8px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid rgba(120, 120, 160, 0.2);
      }
      .modal__title {
        font-size: 16px;
        font-weight: 600;
      }
      .modal__body {
        padding: 16px 20px;
        overflow: auto;
        display: grid;
        gap: 10px;
      }
      .detail-row {
        display: grid;
        grid-template-columns: 140px 1fr;
        gap: 10px;
        font-size: 12px;
      }
      .detail-label {
        color: var(--muted);
      }
      .detail-value {
        word-break: break-all;
      }
      .modal__footer {
        padding: 12px 20px 16px;
        border-top: 1px solid rgba(120, 120, 160, 0.2);
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
      }
      .raw-json {
        display: none;
        background: #0b0912;
        color: #e6e0f2;
        padding: 12px;
        border-radius: 12px;
        font-size: 11px;
        max-height: 200px;
        overflow: auto;
      }
      .raw-json.is-open {
        display: block;
      }
    </style>
  </head>
  <body>
    <div class="aurora-veil"></div>
    <div class="page">
    <h1>Localestia Explorer</h1>
    <div class="map">
      <div class="node node--celestia" id="celestia-node">
        <img class="node__logo" src="/assets/celestia_logo.png" alt="Celestia logo" />
        <div class="node__label">Celestia (local)</div>
        <div class="node__meta" id="celestia-meta">Waiting for blocks...</div>
      </div>
      <div class="fiber">
        <video class="fiber__video" src="/assets/fiber_hero_premium.webm" autoplay loop muted playsinline></video>
      </div>
      <div class="node node--ethereum" id="ethereum-node">
        <img class="node__logo" src="/assets/ethereum_logo.png" alt="Ethereum logo" />
        <div class="node__label">Ethereum (Anvil)</div>
        <div class="node__meta" id="ethereum-meta">Waiting for blocks...</div>
      </div>
    </div>
    <!-- Rollups section temporarily disabled -->
    <div class="columns">
      <div class="list-card">
        <div class="list-header">
          <div class="list-title">Celestia Blocks</div>
          <div class="pager">
            <button class="action-button" id="celestia-prev" type="button">◀</button>
            <span id="celestia-page">1</span>
            <button class="action-button" id="celestia-next" type="button">▶</button>
          </div>
        </div>
        <ul class="list" id="celestia-list"></ul>
      </div>
      <div class="list-card">
        <div class="list-header">
          <div class="list-title">Ethereum Blocks</div>
          <div class="pager">
            <button class="action-button" id="ethereum-prev" type="button">◀</button>
            <span id="ethereum-page">1</span>
            <button class="action-button" id="ethereum-next" type="button">▶</button>
          </div>
        </div>
        <ul class="list" id="ethereum-list"></ul>
      </div>
      <div class="list-card">
        <div class="list-header">
          <div class="list-title">Relayed Batches</div>
          <div class="pager">
            <button class="action-button" id="batches-prev" type="button">◀</button>
            <span id="batches-page">1</span>
            <button class="action-button" id="batches-next" type="button">▶</button>
          </div>
        </div>
        <ul class="list" id="batches-list"></ul>
      </div>
    </div>
    <div class="modal" id="modal">
      <div class="modal__backdrop" id="modal-backdrop"></div>
      <div class="modal__content">
        <div class="modal__header">
          <div class="modal__title" id="modal-title"></div>
          <button class="action-button" id="modal-close" type="button">Close</button>
        </div>
        <div class="modal__body" id="modal-body"></div>
        <div class="modal__body">
          <pre class="raw-json" id="modal-raw"></pre>
        </div>
        <div class="modal__footer">
          <button class="action-button" id="modal-raw-toggle" type="button">Toggle raw JSON</button>
        </div>
      </div>
    </div>
    </div>
    <script>
      const pageSize = 10;
      const state = {
        latestCelestia: null,
        latestEthereum: null,
        celestia: [],
        ethereum: [],
        batches: [],
        pagination: {
          celestia: { pages: [], index: 0 },
          ethereum: { pages: [], index: 0 },
          batches: { pages: [], index: 0 },
        },
        selected: null,
        modal: { detail: null, title: '' },
        rawOpen: false,
      };

      function pageState(type) {
        return state.pagination[type];
      }

      function setLatestPage(type, items) {
        const pager = pageState(type);
        const nextCursor = items.length ? items[items.length - 1][type === 'batches' ? 'proofNonce' : 'height'] : null;
        if (pager.pages.length === 0 || pager.index === 0) {
          pager.pages[0] = { items: items.slice(0, pageSize), nextCursor };
          if (pager.index === 0) {
            pager.pages = pager.pages.slice(0, 1);
          }
        }
      }

      async function refresh() {
        try {
          const stateResponse = await fetch('/api/state');
          const data = await stateResponse.json();
          state.celestia = data.celestia || [];
          state.ethereum = data.ethereum || [];
          state.batches = data.batches || [];
          state.latestCelestia = state.celestia[0] || null;
          state.latestEthereum = state.ethereum[0] || null;
          setLatestPage('celestia', state.celestia);
          setLatestPage('ethereum', state.ethereum);
          setLatestPage('batches', state.batches);
          render();
        } catch (err) {
          console.error(err);
        }
      }

      function render() {
        renderNode('celestia', state.latestCelestia);
        renderNode('ethereum', state.latestEthereum);
        renderLists();
      }

      function renderNode(type, block) {
        const meta = document.getElementById(type + '-meta');
        const node = document.getElementById(type + '-node');
        if (!block) {
          meta.textContent = 'Waiting for blocks...';
          node.onclick = null;
          return;
        }
        meta.textContent = '#' + block.height + ' · ' + block.time;
        node.onclick = () => openModal(type, block.height);
      }

      function renderLists() {
        renderBlockList('celestia-list', pageState('celestia').pages[pageState('celestia').index]?.items ?? [], 'celestia');
        renderBlockList('ethereum-list', pageState('ethereum').pages[pageState('ethereum').index]?.items ?? [], 'ethereum');
        renderBatchList('batches-list', pageState('batches').pages[pageState('batches').index]?.items ?? []);
        document.getElementById('celestia-prev').disabled = pageState('celestia').index === 0;
        document.getElementById('ethereum-prev').disabled = pageState('ethereum').index === 0;
        document.getElementById('batches-prev').disabled = pageState('batches').index === 0;
        document.getElementById('celestia-next').disabled = !pageHasNext('celestia');
        document.getElementById('ethereum-next').disabled = !pageHasNext('ethereum');
        document.getElementById('batches-next').disabled = !pageHasNext('batches');
        document.getElementById('celestia-page').textContent = String(pageState('celestia').index + 1);
        document.getElementById('ethereum-page').textContent = String(pageState('ethereum').index + 1);
        document.getElementById('batches-page').textContent = String(pageState('batches').index + 1);
      }

      function renderBlockList(id, items, type) {
        const root = document.getElementById(id);
        root.innerHTML = '';
        for (const item of items) {
          const li = document.createElement('li');
          li.className = 'list-item';
          if (state.selected && state.selected.type === type && state.selected.id === item.height) {
            li.classList.add('list-item--active');
          }
          li.addEventListener('click', () => openModal(type, item.height));
          const meta = document.createElement('div');
          meta.className = 'list-meta';
          meta.innerHTML = '<span>#' + item.height + '</span><span>' + item.time + '</span>';
          const code = document.createElement('code');
          code.textContent = item.hash;
          li.appendChild(meta);
          li.appendChild(code);
          root.appendChild(li);
        }
      }

      function renderBatchList(id, items) {
        const root = document.getElementById(id);
        root.innerHTML = '';
        for (const item of items) {
          const li = document.createElement('li');
          li.className = 'list-item';
          if (state.selected && state.selected.type === 'batch' && state.selected.id === item.proofNonce) {
            li.classList.add('list-item--active');
          }
          li.addEventListener('click', () => openModal('batch', item.proofNonce));
          const meta = document.createElement('div');
          meta.className = 'list-meta';
          meta.innerHTML = '<span>Nonce ' + item.proofNonce + '</span><span>' + item.startBlock + ' -> ' + item.endBlock + '</span>';
          const code = document.createElement('code');
          code.textContent = item.dataCommitment;
          li.appendChild(meta);
          li.appendChild(code);
          root.appendChild(li);
        }
      }


      function pageHasNext(type) {
        const pager = pageState(type);
        if (pager.pages[pager.index + 1]) {
          return true;
        }
        const current = pager.pages[pager.index];
        return current && current.nextCursor;
      }

      async function goOlder(type) {
        const pager = pageState(type);
        const current = pager.pages[pager.index];
        if (!current || !current.nextCursor) return;
        if (pager.pages[pager.index + 1]) {
          pager.index += 1;
          renderLists();
          return;
        }
        const cursor = current.nextCursor;
        let url = '';
        if (type === 'celestia') {
          url = '/api/celestia/blocks?limit=' + pageSize + '&before=' + cursor;
        } else if (type === 'ethereum') {
          url = '/api/ethereum/blocks?limit=' + pageSize + '&before=' + cursor;
        } else {
          url = '/api/batches?limit=' + pageSize + '&before=' + cursor;
        }
        const response = await fetch(url);
        const data = await response.json();
        pager.pages.push({ items: data.items || [], nextCursor: data.nextCursor || null });
        pager.index += 1;
        renderLists();
      }

      function goNewer(type) {
        const pager = pageState(type);
        if (pager.index === 0) return;
        pager.index -= 1;
        renderLists();
      }

      async function openModal(type, id) {
        state.selected = { type: type, id: id };
        let detail = null;
        if (type === 'celestia') {
          detail = await fetch('/api/celestia/blocks/' + id).then(res => res.json());
          state.modal.title = 'Celestia Block #' + id;
        } else if (type === 'ethereum') {
          detail = await fetch('/api/ethereum/blocks/' + id).then(res => res.json());
          state.modal.title = 'Ethereum Block #' + id;
        } else if (type === 'batch') {
          detail = await fetch('/api/batches/' + id).then(res => res.json());
          state.modal.title = 'Blobstream Batch ' + id;
        }
        state.modal.detail = detail;
        state.rawOpen = false;
        renderModal();
      }

      function renderModal() {
        const modal = document.getElementById('modal');
        const body = document.getElementById('modal-body');
        const title = document.getElementById('modal-title');
        const raw = document.getElementById('modal-raw');
        if (!state.modal.detail) {
          modal.classList.remove('is-open');
          return;
        }
        modal.classList.add('is-open');
        title.textContent = state.modal.title;
        body.innerHTML = '';
        const detail = state.modal.detail;
        const rows = [];
        if (state.selected.type === 'celestia') {
          rows.push(['Height', detail.height]);
          rows.push(['Hash', detail.hash]);
          rows.push(['Time', detail.time]);
          rows.push(['Square width', detail.squareWidth]);
          rows.push(['App version', detail.appVersion]);
          rows.push(['Last block', detail.lastBlockHash]);
          rows.push(['DAH hash', detail.dahHash]);
        } else if (state.selected.type === 'ethereum') {
          rows.push(['Height', detail.height]);
          rows.push(['Hash', detail.hash]);
          rows.push(['Time', detail.time]);
          rows.push(['Tx count', detail.txCount]);
          rows.push(['Gas used', detail.gasUsed]);
          rows.push(['Base fee', detail.baseFeePerGas]);
          rows.push(['Parent hash', detail.parentHash]);
        } else if (state.selected.type === 'batch') {
          rows.push(['Proof nonce', detail.proofNonce]);
          rows.push(['Start block', detail.startBlock]);
          rows.push(['End block', detail.endBlock]);
          rows.push(['Data commitment', detail.dataCommitment]);
          rows.push(['Tx hash', detail.txHash]);
          rows.push(['Block number', detail.blockNumber]);
          rows.push(['Block time', detail.blockTime]);
        }
        for (const row of rows) {
          const wrap = document.createElement('div');
          wrap.className = 'detail-row';
          const label = document.createElement('div');
          label.className = 'detail-label';
          label.textContent = row[0];
          const value = document.createElement('div');
          value.className = 'detail-value';
          value.textContent = row[1] === undefined || row[1] === null ? '' : String(row[1]);
          wrap.appendChild(label);
          wrap.appendChild(value);
          body.appendChild(wrap);
        }
        raw.textContent = JSON.stringify(detail.raw ?? detail, null, 2);
        raw.classList.toggle('is-open', state.rawOpen);
      }

      function closeModal() {
        state.modal.detail = null;
        state.modal.title = '';
        state.rawOpen = false;
        state.selected = null;
        renderModal();
      }

      document.getElementById('modal-close').addEventListener('click', closeModal);
      document.getElementById('modal-backdrop').addEventListener('click', closeModal);
      document.getElementById('modal-raw-toggle').addEventListener('click', () => {
        state.rawOpen = !state.rawOpen;
        renderModal();
      });
      document.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
          closeModal();
        }
      });
      document.getElementById('celestia-prev').addEventListener('click', () => goNewer('celestia'));
      document.getElementById('ethereum-prev').addEventListener('click', () => goNewer('ethereum'));
      document.getElementById('batches-prev').addEventListener('click', () => goNewer('batches'));
      document.getElementById('celestia-next').addEventListener('click', () => goOlder('celestia'));
      document.getElementById('ethereum-next').addEventListener('click', () => goOlder('ethereum'));
      document.getElementById('batches-next').addEventListener('click', () => goOlder('batches'));

      refresh();
      setInterval(refresh, 1000);
    </script>
  </body>
</html>`;
  })
  .get("/api/state", async () => {
    const [celestia, ethereum, batches] = await Promise.all([
      listCelestiaBlocks(pageSize),
      listEthereumBlocks(pageSize),
      listBatches(pageSize),
    ]);
    return { celestia: celestia.items, ethereum: ethereum.items, batches: batches.items };
  })
  .get("/api/celestia/blocks", async ({ query }) => {
    const parsedLimit = parseNumber(query.limit) ?? 20;
    const limit = Math.max(1, Math.min(100, parsedLimit));
    const before = parseNumber(query.before);
    return listCelestiaBlocks(limit, before);
  })
  .get("/api/celestia/blocks/:height", async ({ params, set }) => {
    const height = Number(params.height);
    if (!height) {
      set.status = 400;
      return { error: "invalid height" };
    }
    const detail = await getCelestiaBlockDetail(height);
    if (!detail) {
      set.status = 404;
      return { error: "not found" };
    }
    return detail;
  })
  .get("/api/ethereum/blocks", async ({ query }) => {
    const parsedLimit = parseNumber(query.limit) ?? 20;
    const limit = Math.max(1, Math.min(100, parsedLimit));
    const before = parseNumber(query.before);
    return listEthereumBlocks(limit, before);
  })
  .get("/api/ethereum/blocks/:height", async ({ params, set }) => {
    const height = Number(params.height);
    if (height === null || Number.isNaN(height)) {
      set.status = 400;
      return { error: "invalid height" };
    }
    const detail = await getEthereumBlockDetail(height);
    if (!detail) {
      set.status = 404;
      return { error: "not found" };
    }
    return detail;
  })
  .get("/api/batches", async ({ query }) => {
    const parsedLimit = parseNumber(query.limit) ?? 20;
    const limit = Math.max(1, Math.min(100, parsedLimit));
    const before = query.before ? String(query.before) : undefined;
    return listBatches(limit, before);
  })
  .get("/api/batches/:proofNonce", async ({ params, set }) => {
    const proofNonce = params.proofNonce;
    if (!proofNonce) {
      set.status = 400;
      return { error: "invalid proof nonce" };
    }
    const detail = await getBatchDetail(proofNonce);
    if (!detail) {
      set.status = 404;
      return { error: "not found" };
    }
    return detail;
  })
  .get("/api/rollups", async () => {
    const items = await listRollups();
    return { items, nextCursor: null };
  })
  .get("/api/rollups/:id", async ({ params, set }) => {
    const id = params.id;
    if (!id) {
      set.status = 400;
      return { error: "invalid rollup id" };
    }
    const rollups = await listRollups();
    const rollup = rollups.find((entry) => entry.id === id);
    if (!rollup) {
      set.status = 404;
      return { error: "not found" };
    }
    return rollup;
  })
  .listen(port);

console.log("UI listening on http://127.0.0.1:" + port);
console.log("Celestia RPC: " + celestiaUrl);
console.log("Ethereum RPC: " + ethRpcUrl);
