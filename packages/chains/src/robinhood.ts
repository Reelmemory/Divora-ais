import { createChainAdapter, type ChainAdapter, type ChainConfig } from "./adapter.js";

const SEAPORT_16 = "0x0000000000000068F116a894984e2DB1123eB395" as const;

const native = { name: "Ether", symbol: "ETH", decimals: 18 };

export const robinhoodConfig: ChainConfig = {
  key: "robinhood",
  chainId: 4663,
  name: "Robinhood Chain",
  nativeCurrency: native,
  defaultRpcUrl: "https://rpc.mainnet.chain.robinhood.com",
  explorerUrl: "https://robinhoodchain.blockscout.com",
  seaportAddress: SEAPORT_16,
  openseaSlug: "robinhood",
};

export const robinhoodTestnetConfig: ChainConfig = {
  key: "robinhood-testnet",
  chainId: 46630,
  name: "Robinhood Chain Testnet",
  nativeCurrency: native,
  defaultRpcUrl: "https://rpc.testnet.chain.robinhood.com",
  explorerUrl: "https://explorer.testnet.chain.robinhood.com",
  seaportAddress: SEAPORT_16,
  openseaSlug: "robinhood",
};

export const robinhood: ChainAdapter = createChainAdapter(robinhoodConfig);
export const robinhoodTestnet: ChainAdapter = createChainAdapter(robinhoodTestnetConfig);

export function getChainAdapter(chainId: number): ChainAdapter {
  if (chainId === robinhoodConfig.chainId) return robinhood;
  if (chainId === robinhoodTestnetConfig.chainId) return robinhoodTestnet;
  throw new Error(`Unsupported chain id ${chainId}`);
}
