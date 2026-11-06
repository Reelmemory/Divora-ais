import type { DiscoveredAsset, DiscoveredCollection } from "@divora/shared";
import type { MarketObservation } from "@divora/shared";

/** Maps Phase 1 discovery output to observations. Prices are omitted unless supplied. */
export function observationsFromDiscovery(
  assets: DiscoveredAsset[],
  collections: DiscoveredCollection[],
  observedAt: string,
): MarketObservation[] {
  const counts = new Map<string, number>();
  for (const asset of assets) {
    const key = asset.contract.toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return assets.map((asset) => {
    const collection = collections.find((item) => item.address.toLowerCase() === asset.contract.toLowerCase());
    return {
      chainId: asset.chainId,
      chainKey: asset.chainKey,
      contract: asset.contract,
      tokenId: asset.tokenId,
      collectionName: collection?.name,
      metadataPresent: asset.metadata.source !== "none",
      transferCount: counts.get(asset.contract.toLowerCase()) ?? 1,
      observedAt,
      source: "phase1-discovery",
    };
  });
}
