import type { NormalizedListing } from "@divora/shared";
import type { NFTMarketDataProvider } from "./provider.js";

export interface MarketplaceCall {
  supported: false;
  reason: string;
}

export interface MarketplaceAdapter {
  readonly name: string;
  getListings: NFTMarketDataProvider["getListings"];
  getListing: NFTMarketDataProvider["getListing"];
  getCollection: NFTMarketDataProvider["getCollection"];
  getNFT: NFTMarketDataProvider["getNFT"];
  buildBuyTransaction(listing: NormalizedListing): MarketplaceCall;
  buildSellTransaction(listing: NormalizedListing): MarketplaceCall;
}

export function createOpenSeaMarketplace(provider: NFTMarketDataProvider): MarketplaceAdapter {
  return {
    name: "opensea-seaport",
    getListings: (query) => provider.getListings(query),
    getListing: (id) => provider.getListing(id),
    getCollection: (query) => provider.getCollection(query),
    getNFT: (query) => provider.getNFT(query),
    buildBuyTransaction(listing) {
      if ("calldata" in listing) return { supported: false, reason: "arbitrary calldata rejected" };
      return { supported: false, reason: "Use prepareBuyOrder with a verified OpenSea fulfillment response. This method does not construct calldata." };
    },
    buildSellTransaction() {
      return { supported: false, reason: "Sell construction requires a wallet signature and is unsupported in phase 6" };
    },
  };
}
