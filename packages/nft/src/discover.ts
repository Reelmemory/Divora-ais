import type { ChainAdapter } from "@divora/chains";
import type {
  DiscoveredAsset,
  DiscoveredCollection,
  DiscoveryState,
  DiscoveryTickResult,
  NormalizedNftMetadata,
} from "@divora/shared";
import {
  decodeEventLog,
  getAddress,
  parseAbiItem,
  type PublicClient,
} from "viem";

const transferEvent = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
);

const erc721Abi = [
  {
    type: "function",
    name: "supportsInterface",
    stateMutability: "view",
    inputs: [{ name: "interfaceId", type: "bytes4" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "tokenURI",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "string" }],
  },
] as const;

const ERC721_INTERFACE_ID = "0x80ac58cd";

export interface DiscoveryOptions {
  rpcUrl?: string;
  maxBlockSpan?: number;
  chunkSize?: number;
  maxContracts?: number;
  maxMetadataReads?: number;
  state?: DiscoveryState | null;
}

function emptyMetadata(): NormalizedNftMetadata {
  return { source: "none" };
}

export function normalizeMetadata(tokenUri: string | undefined): NormalizedNftMetadata {
  if (!tokenUri) return emptyMetadata();
  if (tokenUri.startsWith("data:application/json")) {
    const encoded = tokenUri.split(",", 2)[1] ?? "";
    try {
      const json = JSON.parse(
        tokenUri.includes(";base64") ? Buffer.from(encoded, "base64").toString("utf8") : decodeURIComponent(encoded),
      ) as { name?: string; description?: string; image?: string };
      return {
        source: "data-uri",
        tokenUri,
        name: json.name,
        description: json.description,
        image: json.image,
      };
    } catch {
      return { source: "token-uri", tokenUri };
    }
  }
  return { source: "token-uri", tokenUri };
}

export async function runDiscoveryTick(
  adapter: ChainAdapter,
  options: DiscoveryOptions = {},
): Promise<DiscoveryTickResult> {
  const maxBlockSpan = BigInt(options.maxBlockSpan ?? 100);
  const chunkSize = BigInt(options.chunkSize ?? 25);
  const maxContracts = options.maxContracts ?? 10;
  const maxMetadataReads = options.maxMetadataReads ?? 3;
  const client = adapter.getPublicClient(options.rpcUrl);
  const head = await client.getBlockNumber();

  const previous = options.state?.lastScannedBlock;
  let from = previous === undefined || previous === null ? head - maxBlockSpan : BigInt(previous) + 1n;
  if (from < 0n) from = 0n;
  if (head - from + 1n > maxBlockSpan) from = head > maxBlockSpan ? head - maxBlockSpan : 0n;
  if (from > head) from = head;

  const contracts = new Map<string, DiscoveredCollection>();
  const assets: DiscoveredAsset[] = [];
  let logsSeen = 0;
  let metadataReads = 0;

  for (let cursor = from; cursor <= head; cursor += chunkSize) {
    const to = cursor + chunkSize - 1n > head ? head : cursor + chunkSize - 1n;
    const logs = await client.getLogs({
      event: transferEvent,
      fromBlock: cursor,
      toBlock: to,
    });
    logsSeen += logs.length;
    for (const log of logs) {
      if (log.topics.length < 4) continue;
      if (contracts.size >= maxContracts && !contracts.has(log.address.toLowerCase())) continue;
      let tokenId: bigint;
      try {
        const decoded = decodeEventLog({ abi: [transferEvent], data: log.data, topics: log.topics });
        if (decoded.args.tokenId === undefined) continue;
        tokenId = decoded.args.tokenId;
      } catch {
        continue;
      }
      const address = getAddress(log.address);
      if (!contracts.has(address.toLowerCase())) {
        contracts.set(address.toLowerCase(), await inspectContract(client, adapter, address));
      }
      const collection = contracts.get(address.toLowerCase());
      if (!collection?.erc721) continue;
      let metadata = emptyMetadata();
      if (metadataReads < maxMetadataReads) {
        metadataReads += 1;
        metadata = normalizeMetadata(await readTokenUri(client, address, tokenId));
      }
      assets.push({
        chainId: adapter.config.chainId,
        chainKey: adapter.config.key,
        contract: address,
        tokenId: tokenId.toString(),
        metadata,
      });
    }
  }

  const state: DiscoveryState = {
    chainId: adapter.config.chainId,
    chainKey: adapter.config.key,
    lastScannedBlock: head.toString(),
    collections: [...contracts.values()],
    assets,
    updatedAt: new Date().toISOString(),
  };

  return {
    chainId: adapter.config.chainId,
    chainKey: adapter.config.key,
    fromBlock: from.toString(),
    toBlock: head.toString(),
    bounded: true,
    logsSeen,
    collections: state.collections,
    assets,
    state,
  };
}

async function inspectContract(
  client: PublicClient,
  adapter: ChainAdapter,
  address: `0x${string}`,
): Promise<DiscoveredCollection> {
  const code = await client.getCode({ address });
  const hasCode = Boolean(code && code !== "0x");
  let erc721: boolean | null = null;
  let name: string | undefined;
  let symbol: string | undefined;
  if (hasCode) {
    try {
      erc721 = await client.readContract({
        address,
        abi: erc721Abi,
        functionName: "supportsInterface",
        args: [ERC721_INTERFACE_ID],
      });
    } catch {
      erc721 = null;
    }
    if (erc721) {
      name = await readString(client, address, "name");
      symbol = await readString(client, address, "symbol");
    }
  }
  return {
    chainId: adapter.config.chainId,
    chainKey: adapter.config.key,
    address,
    hasCode,
    erc721,
    name,
    symbol,
  };
}

async function readString(
  client: PublicClient,
  address: `0x${string}`,
  functionName: "name" | "symbol",
): Promise<string | undefined> {
  try {
    return await client.readContract({ address, abi: erc721Abi, functionName });
  } catch {
    return undefined;
  }
}

async function readTokenUri(
  client: PublicClient,
  address: `0x${string}`,
  tokenId: bigint,
): Promise<string | undefined> {
  try {
    return await client.readContract({
      address,
      abi: erc721Abi,
      functionName: "tokenURI",
      args: [tokenId],
    });
  } catch {
    return undefined;
  }
}
