import {
  createPublicClient,
  defineChain,
  http,
  type Chain,
  type PublicClient,
} from "viem";

export interface ChainConfig {
  key: string;
  chainId: number;
  name: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  defaultRpcUrl: string;
  explorerUrl: string;
  seaportAddress: `0x${string}`;
  openseaSlug: string;
}

export interface ChainAdapter {
  config: ChainConfig;
  chain: Chain;
  getPublicClient(rpcUrl?: string): PublicClient;
  getChainId(rpcUrl?: string): Promise<number>;
  getBlockNumber(rpcUrl?: string): Promise<bigint>;
  getGasPrice(rpcUrl?: string): Promise<bigint>;
  getNativeBalance(address: `0x${string}`, rpcUrl?: string): Promise<bigint>;
  getBlock(rpcUrl?: string): Promise<{ number: bigint; timestamp: bigint }>;
  getReceipt(hash: `0x${string}`, rpcUrl?: string): Promise<{ status: "success" | "reverted" } | null>;
  /**
   * Marketplace fulfillment is not implemented. This does not report a successful simulation.
   */
  simulateFulfillment(): Promise<{ supported: false; reason: string }>;
}

export function createChainAdapter(config: ChainConfig): ChainAdapter {
  const chain = defineChain({
    id: config.chainId,
    name: config.name,
    nativeCurrency: config.nativeCurrency,
    rpcUrls: { default: { http: [config.defaultRpcUrl] } },
    blockExplorers: {
      default: { name: "Explorer", url: config.explorerUrl },
    },
  });

  const clientFor = (rpcUrl?: string): PublicClient =>
    createPublicClient({
      chain,
      transport: http(rpcUrl ?? config.defaultRpcUrl),
    });

  return {
    config,
    chain,
    getPublicClient: clientFor,
    async getChainId(rpcUrl) {
      return clientFor(rpcUrl).getChainId();
    },
    async getBlockNumber(rpcUrl) {
      return clientFor(rpcUrl).getBlockNumber();
    },
    async getGasPrice(rpcUrl) {
      return clientFor(rpcUrl).getGasPrice();
    },
    async getNativeBalance(address, rpcUrl) {
      return clientFor(rpcUrl).getBalance({ address });
    },
    async getBlock(rpcUrl) {
      const block = await clientFor(rpcUrl).getBlock();
      return { number: block.number ?? 0n, timestamp: block.timestamp };
    },
    async getReceipt(hash, rpcUrl) {
      const receipt = await clientFor(rpcUrl).getTransactionReceipt({ hash });
      return { status: receipt.status };
    },
    async simulateFulfillment() {
      return { supported: false, reason: "No marketplace fulfillment adapter is configured." };
    },
  };
}
