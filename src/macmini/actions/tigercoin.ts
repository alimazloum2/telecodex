import type { MacminiAction } from "../types.js";

const BASE_RPC_URLS = ["https://mainnet.base.org", "https://base-rpc.publicnode.com"] as const;
const GECKOTERMINAL_POOL_URL =
  "https://api.geckoterminal.com/api/v2/networks/base/pools/0x51d79c0af0af6ce1af8a0c9520cf6836bd7995b2";

const TGR_ADDRESS = "0xa79d3083a7e303Db38e013C54135F178834Ccb1B";
const POOL_ADDRESS = "0x51D79c0AF0AF6cE1af8a0c9520cF6836bd7995b2";
const DEPLOYER_WALLET = "0x22951613206814dD2E8523e53384277774B94D98";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const ERC20_BALANCE_OF_SELECTOR = "0x70a08231";
const BLOCK_CHUNK_SIZE = 10_000;

export interface TigerCoinStatusSnapshot {
  priceUsd: string;
  liquidityUsd: string;
  volume24hUsd: string;
  holders: number;
  deployerTgrBalance: string;
  deployerEthBalance: string;
  latestBlock: number;
}

interface GeckoTerminalPoolResponse {
  data?: {
    attributes?: {
      base_token_price_usd?: string;
      quote_token_price_usd?: string;
      reserve_in_usd?: string;
      volume_usd?: {
        h24?: string;
      };
    };
    relationships?: {
      base_token?: {
        data?: {
          id?: string;
        };
      };
      quote_token?: {
        data?: {
          id?: string;
        };
      };
    };
  };
}

interface TransferLog {
  topics: string[];
}

export const tigercoinAction: MacminiAction = {
  id: "tigercoin",
  emoji: "🐯",
  label: "TigerCoin",
  runningText: "🐯 Checking TigerCoin live status…",
  doneText: "✅ TigerCoin status sent.",
  async handler(ctx) {
    try {
      await ctx.replyText(buildTigerCoinStatusText(await collectTigerCoinStatus()));
    } catch (error) {
      await ctx.replyText(`❌ TigerCoin status failed: ${formatTigerCoinError(error)}`);
      throw error;
    }
  },
};

export async function collectTigerCoinStatus(): Promise<TigerCoinStatusSnapshot> {
  const [gecko, latestBlockHex, deployerEthBalanceHex, deployerTgrBalance] = await Promise.all([
    fetchGeckoTerminalPool(),
    rpcString("eth_blockNumber", []),
    rpcString("eth_getBalance", [DEPLOYER_WALLET, "latest"]),
    readErc20Balance(TGR_ADDRESS, DEPLOYER_WALLET),
  ]);
  const latestBlock = Number.parseInt(latestBlockHex, 16);
  const holders = await countCurrentTgrHolders(latestBlock);

  return {
    priceUsd: tigerPriceUsd(gecko),
    liquidityUsd: gecko.data?.attributes?.reserve_in_usd ?? "unknown",
    volume24hUsd: gecko.data?.attributes?.volume_usd?.h24 ?? "unknown",
    holders,
    deployerTgrBalance: formatUnits(deployerTgrBalance, 18, 6),
    deployerEthBalance: formatUnits(BigInt(deployerEthBalanceHex), 18, 6),
    latestBlock,
  };
}

export function buildTigerCoinStatusText(snapshot: TigerCoinStatusSnapshot): string {
  return [
    "🐯 TigerCoin live status",
    `Price: ${formatUsd(snapshot.priceUsd)} / TGR`,
    `Pool liquidity: ${formatUsd(snapshot.liquidityUsd)}`,
    `24h volume: ${formatUsd(snapshot.volume24hUsd)}`,
    `Holders: ${snapshot.holders}`,
    `Deployer TGR: ${snapshot.deployerTgrBalance}`,
    `Deployer Base ETH: ${snapshot.deployerEthBalance}`,
    `Block: ${snapshot.latestBlock}`,
    "",
    `Pool: ${POOL_ADDRESS}`,
  ].join("\n");
}

export function formatTigerCoinError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function formatUsd(value: string): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return value;
  }
  if (numeric > 0 && numeric < 0.01) {
    return `$${numeric.toFixed(6)}`;
  }
  return `$${numeric.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })}`;
}

export function formatUnits(value: bigint, decimals: number, precision: number): string {
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const fraction = value % base;
  if (fraction === 0n) {
    return whole.toString();
  }
  const scaled = (fraction * 10n ** BigInt(precision)) / base;
  const fractionText = scaled.toString().padStart(precision, "0");
  return `${whole}.${fractionText}`;
}

async function fetchGeckoTerminalPool(): Promise<GeckoTerminalPoolResponse> {
  const response = await fetch(GECKOTERMINAL_POOL_URL, {
    headers: {
      accept: "application/json",
      "user-agent": "TeleCodex TigerCoin read-only status",
    },
  });
  if (!response.ok) {
    throw new Error(`GeckoTerminal returned HTTP ${response.status}`);
  }
  return (await response.json()) as GeckoTerminalPoolResponse;
}

function tigerPriceUsd(gecko: GeckoTerminalPoolResponse): string {
  const baseTokenId = gecko.data?.relationships?.base_token?.data?.id?.toLowerCase() ?? "";
  const quoteTokenId = gecko.data?.relationships?.quote_token?.data?.id?.toLowerCase() ?? "";
  const lowerTgr = TGR_ADDRESS.toLowerCase();
  if (baseTokenId.endsWith(lowerTgr)) {
    return gecko.data?.attributes?.base_token_price_usd ?? "unknown";
  }
  if (quoteTokenId.endsWith(lowerTgr)) {
    return gecko.data?.attributes?.quote_token_price_usd ?? "unknown";
  }
  return gecko.data?.attributes?.base_token_price_usd ?? "unknown";
}

async function countCurrentTgrHolders(latestBlock: number): Promise<number> {
  const deploymentBlock = await findContractCreationBlock(TGR_ADDRESS, latestBlock);
  const addresses = new Set<string>();

  for (let from = deploymentBlock; from <= latestBlock; from += BLOCK_CHUNK_SIZE) {
    const to = Math.min(latestBlock, from + BLOCK_CHUNK_SIZE - 1);
    const logs = await rpcArray<TransferLog>("eth_getLogs", [
      {
        address: TGR_ADDRESS,
        fromBlock: toHex(from),
        toBlock: toHex(to),
        topics: [TRANSFER_TOPIC],
      },
    ]);

    for (const log of logs) {
      const fromAddress = topicToAddress(log.topics[1]);
      const toAddress = topicToAddress(log.topics[2]);
      if (fromAddress !== ZERO_ADDRESS) {
        addresses.add(fromAddress);
      }
      if (toAddress !== ZERO_ADDRESS) {
        addresses.add(toAddress);
      }
    }
  }

  let holders = 0;
  for (const address of addresses) {
    if ((await readErc20Balance(TGR_ADDRESS, address)) > 0n) {
      holders += 1;
    }
  }
  return holders;
}

async function findContractCreationBlock(address: string, latestBlock: number): Promise<number> {
  let low = 1;
  let high = latestBlock;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const code = await rpcString("eth_getCode", [address, toHex(mid)]);
    if (code && code !== "0x") {
      high = mid;
    } else {
      low = mid + 1;
    }
  }
  return low;
}

async function readErc20Balance(tokenAddress: string, holderAddress: string): Promise<bigint> {
  const data = `${ERC20_BALANCE_OF_SELECTOR}${addressToAbiWord(holderAddress)}`;
  return BigInt(await rpcString("eth_call", [{ to: tokenAddress, data }, "latest"]));
}

async function rpcArray<T>(method: string, params: unknown[]): Promise<T[]> {
  return (await rpc(method, params)) as T[];
}

async function rpcString(method: string, params: unknown[]): Promise<string> {
  return (await rpc(method, params)) as string;
}

async function rpc(method: string, params: unknown[]): Promise<unknown> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    for (const url of BASE_RPC_URLS) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "user-agent": "TeleCodex TigerCoin read-only status",
          },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        });
        if (!response.ok) {
          throw new Error(`Base RPC ${url} returned HTTP ${response.status} for ${method}`);
        }
        const payload = (await response.json()) as { result?: unknown; error?: { message?: string } };
        if (payload.error) {
          throw new Error(payload.error.message ?? `Base RPC error for ${method}`);
        }
        return payload.result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }
    await sleep(500 * (attempt + 1));
  }
  throw lastError ?? new Error(`Base RPC failed for ${method}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function addressToAbiWord(address: string): string {
  return address.toLowerCase().replace(/^0x/, "").padStart(64, "0");
}

function topicToAddress(topic: string | undefined): string {
  if (!topic) {
    return ZERO_ADDRESS;
  }
  return `0x${topic.slice(-40)}`.toLowerCase();
}

function toHex(value: number): string {
  return `0x${value.toString(16)}`;
}
