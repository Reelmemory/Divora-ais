export interface CollectionRef {
  chainId: number;
  address: `0x${string}`;
  name?: string;
  slug?: string;
}

export interface AssetRef {
  collection: CollectionRef;
  tokenId: string;
}

/** Observed listing. Not an order to fill. */
export interface ListingQuote {
  asset: AssetRef;
  marketplace: string;
  priceWei: string;
  currency: string;
}

export { normalizeMetadata, runDiscoveryTick, type DiscoveryOptions } from "./discover.js";
export { loadDiscoveryState, saveDiscoveryState } from "./state.js";
