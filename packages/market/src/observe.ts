import type { MarketObservation, NormalizedListing } from "@divora/shared";
import { listingFreshness } from "./normalize.js";

export interface PeerFloorContext {
  peerFloorPrice?: string;
  collectionFloorPrice?: string;
  listingCount?: number;
  uniqueCounterparties?: number;
}

export interface CollectionCohortSummary {
  chainId: number;
  contractAddress: string;
  collectionSlug: string | null;
  currency: string;
  activeListings: number;
  uniqueSellers: number;
  floorPrice: string | null;
  medianPrice: string | null;
}

function isPositiveIntegerString(val: string | null | undefined): val is string {
  return typeof val === "string" && /^\d+$/.test(val) && BigInt(val) > 0n;
}

/**
 * Computes collection-level and same-currency peer floor statistics from active listings.
 * Never compares raw amounts across different currencies.
 */
export function computeCollectionFloorStats(
  listings: NormalizedListing[],
  now = new Date(),
  ttlMs = 15 * 60 * 1000
): {
  byListingId: Map<string, PeerFloorContext>;
  cohorts: CollectionCohortSummary[];
} {
  const active = listings.filter(
    (l) => Boolean(l.contractAddress) && listingFreshness(l, now, ttlMs) === "AVAILABLE"
  );

  // Group by (chainId, contract) for collection-wide listing/seller depth
  const collectionGroup = new Map<string, NormalizedListing[]>();
  // Group by (chainId, contract, currency) for same-currency comparable floor pricing
  const currencyGroup = new Map<string, NormalizedListing[]>();

  for (const item of active) {
    const contract = item.contractAddress!.toLowerCase();
    const colKey = `${item.chainId}:${contract}`;
    const curKey = `${item.chainId}:${contract}:${(item.currency ?? "ETH").toUpperCase()}`;

    const colList = collectionGroup.get(colKey) ?? [];
    colList.push(item);
    collectionGroup.set(colKey, colList);

    const curList = currencyGroup.get(curKey) ?? [];
    curList.push(item);
    currencyGroup.set(curKey, curList);
  }

  const cohorts: CollectionCohortSummary[] = [];
  for (const [curKey, items] of currencyGroup.entries()) {
    const [chainIdRaw, contractAddress, currency] = curKey.split(":");
    const sellers = new Set(
      items.map((i) => i.seller?.toLowerCase()).filter((s): s is string => Boolean(s))
    );
    const validPrices = items
      .map((i) => i.price)
      .filter(isPositiveIntegerString)
      .map((p) => BigInt(p))
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

    const floorPrice = validPrices.length > 0 ? validPrices[0]!.toString() : null;
    const medianPrice =
      validPrices.length > 0
        ? validPrices[Math.floor(validPrices.length / 2)]!.toString()
        : null;

    const collectionSlug = items.find((i) => typeof i.collection === "string" && i.collection.length > 0)?.collection ?? null;

    cohorts.push({
      chainId: Number(chainIdRaw),
      contractAddress: contractAddress!,
      collectionSlug,
      currency: currency!,
      activeListings: items.length,
      uniqueSellers: sellers.size,
      floorPrice,
      medianPrice,
    });
  }

  const byListingId = new Map<string, PeerFloorContext>();

  for (const item of active) {
    const contract = item.contractAddress!.toLowerCase();
    const colKey = `${item.chainId}:${contract}`;
    const curKey = `${item.chainId}:${contract}:${(item.currency ?? "ETH").toUpperCase()}`;

    const colItems = collectionGroup.get(colKey) ?? [item];
    const curItems = currencyGroup.get(curKey) ?? [item];

    const distinctSellers = new Set(
      colItems.map((i) => i.seller?.toLowerCase()).filter((s): s is string => Boolean(s))
    );

    // Peer floor: minimum valid price among OTHER active listings in the same collection & currency
    const peerPrices = curItems
      .filter((peer) => peer.id !== item.id && isPositiveIntegerString(peer.price))
      .map((peer) => BigInt(peer.price!))
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

    const allPrices = curItems
      .filter((peer) => isPositiveIntegerString(peer.price))
      .map((peer) => BigInt(peer.price!))
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

    const hasSameCurrencyPeers = peerPrices.length > 0;

    byListingId.set(item.id, {
      peerFloorPrice: hasSameCurrencyPeers ? peerPrices[0]!.toString() : undefined,
      collectionFloorPrice: hasSameCurrencyPeers && allPrices.length > 0 ? allPrices[0]!.toString() : undefined,
      listingCount: hasSameCurrencyPeers ? colItems.length : undefined,
      uniqueCounterparties: hasSameCurrencyPeers ? distinctSellers.size : undefined,
    });
  }

  return { byListingId, cohorts };
}

/**
 * Converts a single NormalizedListing to a MarketObservation.
 * Never falls back to sellerConsideration for referencePrice and never injects hardcoded activity counts.
 */
export function listingToObservation(
  listing: NormalizedListing,
  now = new Date(),
  ttlMs = 15 * 60 * 1000,
  context?: PeerFloorContext
): MarketObservation | null {
  if (!listing.contractAddress) return null;
  const freshness = listingFreshness(listing, now, ttlMs);
  if (freshness !== "AVAILABLE") return null;

  const ext = listing as NormalizedListing & {
    referencePrice?: string;
    fairValue?: string;
    transferCount?: number;
    priorTransferCount?: number;
    listingCount?: number;
    uniqueCounterparties?: number;
    metadataPresent?: boolean;
    involvedWallets?: string[];
  };

  return {
    chainId: listing.chainId,
    chainKey: listing.chainId === 4663 ? "robinhood" : `chain-${listing.chainId}`,
    contract: listing.contractAddress,
    tokenId: listing.tokenId ?? undefined,
    collectionName: listing.collection ?? undefined,
    metadataPresent: ext.metadataPresent ?? Boolean(listing.contractAddress && listing.tokenId),
    observedPrice: listing.price ?? undefined,
    referencePrice: ext.referencePrice ?? context?.peerFloorPrice ?? undefined,
    fairValue: ext.fairValue ?? context?.collectionFloorPrice ?? undefined,
    transferCount: ext.transferCount ?? 0,
    priorTransferCount: ext.priorTransferCount,
    listingCount: ext.listingCount ?? context?.listingCount,
    uniqueCounterparties: ext.uniqueCounterparties ?? context?.uniqueCounterparties,
    involvedWallets: ext.involvedWallets ?? (listing.seller ? [listing.seller] : undefined),
    observedAt: listing.observedAt,
    source: listing.source,
  };
}

/**
 * Converts a batch of NormalizedListings into MarketObservations using real peer floor prices
 * and actual observed collection listing & seller depth.
 */
export function listingsToObservations(
  listings: NormalizedListing[],
  now = new Date(),
  ttlMs = 15 * 60 * 1000
): MarketObservation[] {
  const { byListingId } = computeCollectionFloorStats(listings, now, ttlMs);
  return listings
    .map((listing) => listingToObservation(listing, now, ttlMs, byListingId.get(listing.id)))
    .filter((obs): obs is MarketObservation => obs !== null);
}