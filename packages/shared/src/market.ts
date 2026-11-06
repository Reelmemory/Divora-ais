export const FRESHNESS_STATES = ["AVAILABLE", "STALE", "UNAVAILABLE"] as const;
export type FreshnessState = (typeof FRESHNESS_STATES)[number];

export interface ProviderResult<T> {
  state: "AVAILABLE" | "UNAVAILABLE" | "RATE_LIMITED" | "ERROR" | "PROVIDER_ERROR" | "UNSUPPORTED";
  data: T | null;
  error: string | null;
  cached?: boolean;
  source?: string;
  observedAt?: string;
}

export interface NormalizedListing {
  id: string;
  chainId: number;
  marketplace: string;
  collection: string | null;
  contractAddress: `0x${string}` | null;
  tokenId: string | null;
  seller: string | null;
  price: string | null;
  currency: string | null;
  paymentToken: `0x${string}` | null;
  sellerConsideration: string | null;
  feeBps: number | null;
  expiresAt: string | null;
  protocolAddress: `0x${string}` | null;
  source: string;
  observedAt: string;
  freshness: FreshnessState;
}

export interface NormalizedCollection {
  chainId: number;
  contractAddress: `0x${string}` | null;
  slug: string | null;
  name: string | null;
  floorPrice: string | null;
  currency: string | null;
  observedAt: string;
  freshness: FreshnessState;
}

export interface NormalizedNft {
  chainId: number;
  contractAddress: `0x${string}` | null;
  tokenId: string | null;
  name: string | null;
  imageUrl?: string | null;
  owner?: string | null;
  observedAt?: string;
  freshness?: FreshnessState;
}

export interface CollectionActivity {
  chainId?: number;
  contractAddress?: `0x${string}` | null;
  transferCount: number | null;
  listingCount?: number;
  uniqueCounterparties?: number;
  observedAt?: string;
  freshness?: FreshnessState;
}