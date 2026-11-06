export interface NormalizedNftMetadata {
  name?: string;
  description?: string;
  image?: string;
  tokenUri?: string;
  source: "data-uri" | "token-uri" | "none";
}

export interface DiscoveredCollection {
  chainId: number;
  chainKey: string;
  address: `0x${string}`;
  hasCode: boolean;
  erc721: boolean | null;
  name?: string;
  symbol?: string;
}

export interface DiscoveredAsset {
  chainId: number;
  chainKey: string;
  contract: `0x${string}`;
  tokenId: string;
  metadata: NormalizedNftMetadata;
}

export interface DiscoveryState {
  chainId: number;
  chainKey: string;
  lastScannedBlock: string | null;
  collections: DiscoveredCollection[];
  assets: DiscoveredAsset[];
  updatedAt: string;
}

export interface DiscoveryTickResult {
  chainId: number;
  chainKey: string;
  fromBlock: string;
  toBlock: string;
  bounded: true;
  logsSeen: number;
  collections: DiscoveredCollection[];
  assets: DiscoveredAsset[];
  state: DiscoveryState;
}
