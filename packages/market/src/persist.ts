import type { NormalizedListing } from "@divora/shared";

export interface ListingSnapshot {
  id: string;
  chainId: number;
  marketplace: string;
  contract: string | null;
  tokenId: string | null;
  price: string | null;
  seller: string | null;
  freshness: string;
  observedAt: Date;
  payload: Record<string, unknown>;
}

export interface ListingStore {
  upsertSnapshots(rows: ListingSnapshot[]): Promise<{ persisted: number }>;
}

export function snapshotFromListing(listing: NormalizedListing): ListingSnapshot | null {
  if (!listing.id) return null;
  return {
    id: listing.id,
    chainId: listing.chainId,
    marketplace: listing.marketplace,
    contract: listing.contractAddress,
    tokenId: listing.tokenId,
    price: listing.price,
    seller: listing.seller,
    freshness: listing.freshness,
    observedAt: new Date(listing.observedAt),
    payload: {
      source: listing.source,
      currency: listing.currency,
      collection: listing.collection,
      expiresAt: listing.expiresAt,
    },
  };
}

export async function persistListings(listings: NormalizedListing[], store: ListingStore): Promise<{ persisted: number; error: string | null }> {
  const rows = listings.map(snapshotFromListing).filter((row): row is ListingSnapshot => row !== null);
  try {
    const result = await store.upsertSnapshots(rows);
    return { persisted: result.persisted, error: null };
  } catch (error) {
    return { persisted: 0, error: error instanceof Error ? error.message : "persistence failed" };
  }
}
