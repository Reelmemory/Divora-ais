import type { NFTMarketDataProvider, MarketQuery } from "./provider.js";
import { normalizeOpenSeaOrder } from "./normalize.js";
import type { NormalizedListing, ProviderResult } from "@divora/shared";

export interface OpenSeaConfig {
  apiKey?: string;
  baseUrl?: string;
  chain?: string;
  chainId?: number;
  timeoutMs?: number;
  minIntervalMs?: number;
}

export function createOpenSeaProvider(config: OpenSeaConfig, fetchImpl: typeof fetch = fetch): NFTMarketDataProvider {
  const baseUrl = config.baseUrl ?? "https://api.opensea.io";
  const chain = config.chain ?? "robinhood";
  const chainId = config.chainId ?? 4663;
  let lastCall = 0;
  const cache = new Map<string, { at: number; value: ProviderResult<NormalizedListing[]> }>();

  async function request(path: string, bypassThrottle = false): Promise<ProviderResult<unknown>> {
    if (!config.apiKey) return { state: "UNAVAILABLE", data: null, error: "OPENSEA_API_KEY is not configured" };
    const now = Date.now();
    if (!bypassThrottle && now - lastCall < (config.minIntervalMs ?? 250)) {
      return { state: "RATE_LIMITED", data: null, error: "local throttle" };
    }
    lastCall = now;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs ?? 8000);
    try {
      const response = await fetchImpl(`${baseUrl}${path}`, {
        headers: { "x-api-key": config.apiKey },
        signal: controller.signal,
      });
      if (response.status === 429) return { state: "RATE_LIMITED", data: null, error: "provider rate limit" };
      if (!response.ok) return { state: "PROVIDER_ERROR", data: null, error: `provider status ${response.status}` };
      return { state: "AVAILABLE", data: await response.json(), error: null };
    } catch (error) {
      const message = error instanceof Error ? error.message : "provider error";
      return { state: "PROVIDER_ERROR", data: null, error: message };
    } finally {
      clearTimeout(timer);
    }
  }

  async function fetchSingleCollectionListings(
    slug: string,
    limit: number,
    bypassThrottle: boolean,
  ): Promise<ProviderResult<NormalizedListing[]>> {
    const path = `/api/v2/listings/collection/${slug}/all?limit=${limit}`;
    const result = await request(path, bypassThrottle);
    if (result.state !== "AVAILABLE" || !result.data) {
      return { state: result.state, data: null, error: result.error, cached: false };
    }
    if (typeof result.data !== "object" || result.data === null) {
      return { state: "PROVIDER_ERROR", data: null, error: "malformed listings response", cached: false };
    }
    const body = result.data as { orders?: unknown; listings?: unknown };
    if (!Array.isArray(body.orders) && !Array.isArray(body.listings)) {
      return { state: "PROVIDER_ERROR", data: null, error: "malformed listings response", cached: false };
    }
    const orders = (body.orders ?? body.listings) as Record<string, unknown>[];
    const observedAt = new Date().toISOString();
    const listings = orders
      .map((order) =>
        normalizeOpenSeaOrder({
          chainId,
          order,
          observedAt,
          collectionSlug: slug,
        }),
      )
      .filter((item): item is NormalizedListing => item !== null);
    return { state: "AVAILABLE", data: listings, error: null, cached: false };
  }

  return {
    name: "opensea",
    async getListings(query: MarketQuery) {
      const slugsKey = query.collectionSlugs ? query.collectionSlugs.join(",") : "";
      const key = `${query.collectionSlug ?? ""}:${slugsKey}:${query.contract ?? ""}:${query.tokenId ?? ""}:${query.maxCollections ?? ""}`;
      const cached = cache.get(key);
      if (cached && Date.now() - cached.at < 30_000) return { ...cached.value, cached: true };

      // Case 1: Optional single-collection filter provided
      if (query.collectionSlug) {
        const single = await fetchSingleCollectionListings(query.collectionSlug, query.limit ?? 20, false);
        if (single.state === "AVAILABLE") {
          cache.set(key, { at: Date.now(), value: single });
        }
        return single;
      }

      // Case 2: Explicit list of collection slugs provided
      let targetSlugs: string[] = [];
      if (query.collectionSlugs && query.collectionSlugs.length > 0) {
        targetSlugs = query.collectionSlugs.filter((s) => typeof s === "string" && s.trim().length > 0);
      } else {
        // Case 3: Default Market-Wide Multi-Collection Discovery
        const maxCollections = query.maxCollections ?? 5;
        const result = await request(`/api/v2/collections?chain=${chain}&limit=${maxCollections}`, false);
        if (result.state !== "AVAILABLE" || !result.data) {
          return { state: result.state, data: null, error: result.error, cached: false };
        }
        if (typeof result.data !== "object" || result.data === null) {
          return { state: "PROVIDER_ERROR", data: null, error: "malformed listings response", cached: false };
        }
        const body = result.data as {
          orders?: unknown;
          listings?: unknown;
          collections?: Array<{ collection?: string; slug?: string }>;
        };
        if (Array.isArray(body.collections)) {
          targetSlugs = body.collections
            .map((item) => (typeof item.collection === "string" ? item.collection : typeof item.slug === "string" ? item.slug : null))
            .filter((s): s is string => Boolean(s))
            .slice(0, maxCollections);
          if (targetSlugs.length === 0) {
            return { state: "UNAVAILABLE", data: [], error: "no collections returned for chain", cached: false };
          }
        } else if (Array.isArray(body.orders) || Array.isArray(body.listings)) {
          const orders = (body.orders ?? body.listings) as Record<string, unknown>[];
          const listings = orders
            .map((order) => normalizeOpenSeaOrder({ chainId, order, observedAt: new Date().toISOString() }))
            .filter((item): item is NormalizedListing => item !== null);
          const value = { state: "AVAILABLE" as const, data: listings, error: null, cached: false };
          cache.set(key, { at: Date.now(), value });
          return value;
        } else {
          return { state: "PROVIDER_ERROR", data: null, error: "malformed listings response", cached: false };
        }
      }

      // Fan out across all discovered collections and deduplicate by listing ID
      const seenIds = new Set<string>();
      const aggregated: NormalizedListing[] = [];
      let lastError: string | null = null;
      let anyAvailable = false;

      for (let i = 0; i < targetSlugs.length; i++) {
        const slug = targetSlugs[i]!;
        const subResult = await fetchSingleCollectionListings(slug, query.limit ?? 20, true);
        if (subResult.state === "AVAILABLE" && subResult.data) {
          anyAvailable = true;
          for (const item of subResult.data) {
            if (!seenIds.has(item.id)) {
              seenIds.add(item.id);
              aggregated.push(item);
            }
          }
        } else if (subResult.error) {
          lastError = subResult.error;
        }
      }

      if (!anyAvailable) {
        return { state: "PROVIDER_ERROR", data: null, error: lastError ?? "failed to fetch collection listings", cached: false };
      }

      const filtered = query.contract
        ? aggregated.filter((item) => item.contractAddress?.toLowerCase() === query.contract!.toLowerCase())
        : aggregated;

      const value = { state: "AVAILABLE" as const, data: filtered, error: null, cached: false };
      cache.set(key, { at: Date.now(), value });
      return value;
    },
    async getListing(id: string) {
      const listings = await this.getListings({ chain });
      const found = listings.data?.find((item) => item.id === id) ?? null;
      return {
        state: found ? listings.state : "UNAVAILABLE",
        data: found,
        error: found ? null : listings.error ?? "listing was not in the latest provider response",
        cached: listings.cached,
      };
    },
    async getCollection() {
      return { state: "UNSUPPORTED", data: null, error: "Collection lookup is not verified against the provider in phase 5", cached: false };
    },
    async getNFT(query: MarketQuery) {
      if (!query.contract || !query.tokenId) {
        return { state: "UNAVAILABLE", data: null, error: "contract and tokenId are required", cached: false };
      }
      return { state: "UNSUPPORTED", data: null, error: "NFT lookup is not verified against the provider in phase 5", cached: false };
    },
    async getCollectionActivity() {
      return { state: "UNSUPPORTED", data: null, error: "OpenSea activity is not mapped in phase 5; use chain discovery transfers" };
    },
  };
}
