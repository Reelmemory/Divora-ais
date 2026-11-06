import assert from "node:assert/strict";
import test from "node:test";
import { evaluateObservation } from "../../opportunities/dist/index.js";
import { decide } from "../../policy/dist/index.js";
import {
  computeCollectionFloorStats,
  createOpenSeaMarketplace,
  createOpenSeaProvider,
  listingFreshness,
  listingsToObservations,
  listingToObservation,
  normalizeOpenSeaOrder,
} from "../dist/index.js";

const now = new Date("2026-10-08T12:00:00.000Z");

test("normalizes a listing and keeps missing fields null", () => {
  const listing = normalizeOpenSeaOrder({
    chainId: 4663,
    observedAt: now.toISOString(),
    order: { order_hash: "0xabc", current_price: "100", maker: { address: "0x1111111111111111111111111111111111111111" }, expiration_time: 1790000000, protocol_data: { parameters: { offer: [{ token: "0x2222222222222222222222222222222222222222", identifierOrCriteria: "29" }] } } },
  });
  assert.equal(listing?.tokenId, "29");
  assert.equal(listing?.price, "100");
  const missing = normalizeOpenSeaOrder({ chainId: 4663, observedAt: now.toISOString(), order: { order_hash: "0xdef" } });
  assert.equal(missing?.price, null);
  assert.equal(missing?.seller, null);
  assert.equal(missing?.protocolAddress, null);
  const liveShape = normalizeOpenSeaOrder({ chainId: 4663, observedAt: now.toISOString(), order: { order_hash: "0xlive", protocol_address: "0x0000000000000068f116a894984e2db1123eb395", price: { current: { currency: "USDG", decimals: 6, value: "250000" } }, protocol_data: { parameters: { offerer: "0xseller", endTime: "1799794098", offer: [{ token: "0x2222222222222222222222222222222222222222", identifierOrCriteria: "54" }] } } } });
  assert.equal(liveShape?.price, "250000");
  assert.equal(liveShape?.currency, "USDG");
  assert.equal(liveShape?.seller, "0xseller");
  assert.equal(normalizeOpenSeaOrder({ chainId: 4663, observedAt: now.toISOString(), order: {} }), null);
});

test("provider maps success, empty, timeout, rate limit, and error without inventing listings", async () => {
  const provider = createOpenSeaProvider({ apiKey: "test", minIntervalMs: 0 }, async () => new Response(JSON.stringify({ orders: [] }), { status: 200 }));
  const empty = await provider.getListings({ chain: "robinhood" });
  assert.deepEqual(empty.data, []);
  const limited = createOpenSeaProvider({ apiKey: "test", minIntervalMs: 0 }, async () => new Response("no", { status: 429 }));
  assert.equal((await limited.getListings({ chain: "robinhood" })).state, "RATE_LIMITED");
  const errored = createOpenSeaProvider({ apiKey: "test", minIntervalMs: 0 }, async () => new Response("no", { status: 500 }));
  assert.equal((await errored.getListings({ chain: "robinhood" })).state, "PROVIDER_ERROR");
  const missing = createOpenSeaProvider({}, async () => new Response("{}", { status: 200 }));
  assert.equal((await missing.getListings({ chain: "robinhood" })).state, "UNAVAILABLE");
  const timedOut = createOpenSeaProvider({ apiKey: "test", timeoutMs: 20, minIntervalMs: 0 }, (_url, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new Error("abort")));
  }));
  assert.equal((await timedOut.getListings({ chain: "robinhood" })).state, "PROVIDER_ERROR");
  assert.equal((await provider.getCollectionActivity({ chain: "robinhood" })).state, "UNSUPPORTED");
  const malformed = createOpenSeaProvider({ apiKey: "test", minIntervalMs: 0 }, async () => new Response("not-json", { status: 200 }));
  assert.equal((await malformed.getListings({ chain: "robinhood" })).state, "PROVIDER_ERROR");
  const shape = createOpenSeaProvider({ apiKey: "test", minIntervalMs: 0 }, async () => new Response(JSON.stringify({ nope: true }), { status: 200 }));
  assert.equal((await shape.getListings({ chain: "robinhood" })).error, "malformed listings response");
  const collection = await provider.getCollection({ chain: "robinhood", collectionSlug: "echoed" });
  assert.equal(collection.state, "UNSUPPORTED");
  assert.equal(collection.data, null);
  const nft = await provider.getNFT({ chain: "robinhood", contract: "0x2222222222222222222222222222222222222222", tokenId: "1" });
  assert.equal(nft.state, "UNSUPPORTED");
  assert.equal(nft.data, null);
  assert.equal(empty.cached, false);
  const second = await provider.getListings({ chain: "robinhood" });
  assert.equal(second.cached, true);
});

test("freshness and marketplace refuse calldata and fulfillment", () => {
  const listing = normalizeOpenSeaOrder({ chainId: 4663, observedAt: now.toISOString(), order: { order_hash: "0xabc", current_price: "10", expiration_time: 1, protocol_data: { parameters: { offer: [{ token: "0x2222222222222222222222222222222222222222", identifierOrCriteria: "1" }] } } } });
  assert.ok(listing);
  assert.equal(listingFreshness(listing, now, 1000), "STALE");
  assert.equal(listingToObservation(listing, now), null);
  assert.equal(listingFreshness({ ...listing, expiresAt: null, observedAt: now.toISOString() }, now, 1000), "AVAILABLE");
  const adapter = createOpenSeaMarketplace({ name: "mock", getListings: async () => ({ state: "AVAILABLE", data: [], error: null }), getListing: async () => ({ state: "UNAVAILABLE", data: null, error: null }), getCollection: async () => ({ state: "UNAVAILABLE", data: null, error: null }), getNFT: async () => ({ state: "UNAVAILABLE", data: null, error: null }), getCollectionActivity: async () => ({ state: "UNSUPPORTED", data: null, error: null }) });
  assert.equal(adapter.buildBuyTransaction(listing).supported, false);
  assert.equal(adapter.buildBuyTransaction({ ...listing, calldata: "0x1234" }).supported, false);
});

test("a fixture listing is labeled and feeds the existing opportunity and decision path", () => {
  const listing = normalizeOpenSeaOrder({ chainId: 4663, observedAt: now.toISOString(), order: { order_hash: "0xabc", current_price: "10", maker: { address: "0xseller" }, protocol_data: { parameters: { offer: [{ token: "0x2222222222222222222222222222222222222222", identifierOrCriteria: "29" }] } }, collection_slug: "fixture" } });
  assert.ok(listing);
  const observation = listingToObservation(listing, now);
  assert.ok(observation);
  assert.equal(observation.source, "opensea");
  assert.equal(observation.observedPrice, "10");
  // Phase 12: no hardcoded fallback activity/liquidity numbers and no sellerConsideration referencePrice fallback
  assert.equal(observation.referencePrice, undefined);
  assert.equal(observation.transferCount, 0);
  assert.equal(observation.priorTransferCount, undefined);
  assert.equal(observation.listingCount, undefined);
  assert.equal(observation.uniqueCounterparties, undefined);

  // Without peer floor or transfer activity, an isolated listing evaluates honestly to INSUFFICIENT_DATA with score null and confidence 0
  const unenrichedOpp = evaluateObservation(observation, {}, now);
  assert.equal(unenrichedOpp.status, "INSUFFICIENT_DATA");
  assert.equal(unenrichedOpp.score, null);
  assert.equal(unenrichedOpp.confidence, 0);

  const opportunity = evaluateObservation({ ...observation, referencePrice: "100", transferCount: 6, priorTransferCount: 5, listingCount: 1, uniqueCounterparties: 2, metadataPresent: true }, {}, now);
  const decision = decide(opportunity, { maxTradeValue: "100", maxDailySpend: "100", maxGas: "1", maxSlippageBps: 100, allowedChains: [4663], allowedCollections: [observation.contract], allowedMarketplaces: ["fixture"], allowedStrategies: ["MISPRICED_NFT"], minOpportunityScore: 10, minConfidence: 10, buyMinScore: 10, buyMinConfidence: 10, watchMinScore: 1 }, { tradeValue: "10", gas: "0.1", slippageBps: 10, marketplace: "fixture" }, now);
  assert.equal(decision.execution, "disabled");
  assert.equal(opportunity.evidence.source, "opensea");
  assert.ok(decision.action === "BUY" || decision.action === "WATCH" || decision.action === "REJECT");
});

test("listingsToObservations computes same-currency peer floor, never compares across currencies, and detects genuine mispricing without sellerConsideration", () => {
  const contract = "0x536de17561c3dec4dba699bd13a40afdc77f4641";
  const discounted = {
    id: "0xdiscount",
    chainId: 4663,
    marketplace: "opensea",
    collection: "onlyhoodpixel",
    contractAddress: contract,
    tokenId: "101",
    seller: "0x1111111111111111111111111111111111111111",
    price: "600000000000000", // 0.0006 ETH
    currency: "ETH",
    paymentToken: null,
    sellerConsideration: "585000000000000",
    feeBps: 250,
    expiresAt: "2026-10-08T13:00:00.000Z",
    protocolAddress: "0x0000000000000068f116a894984e2db1123eb395",
    source: "opensea",
    observedAt: now.toISOString(),
    freshness: "AVAILABLE",
  };
  const floorPeer = {
    ...discounted,
    id: "0xfloor",
    tokenId: "102",
    seller: "0x2222222222222222222222222222222222222222",
    price: "1000000000000000", // 0.001 ETH
    sellerConsideration: "975000000000000",
  };
  const aboveFloor = {
    ...discounted,
    id: "0xabove",
    tokenId: "103",
    seller: "0x3333333333333333333333333333333333333333",
    price: "1200000000000000", // 0.0012 ETH
    sellerConsideration: "1170000000000000",
  };
  // Isolated USDG listing in the same collection: must NOT compare against ETH peer prices
  const isolatedUsdg = {
    ...discounted,
    id: "0xusdg-single",
    tokenId: "104",
    seller: "0x4444444444444444444444444444444444444444",
    price: "20000", // 0.02 USDG (6 decimals)
    currency: "USDG",
    paymentToken: "0x5fc5360d0400a0fd4f2af552add042d716f1d168",
    sellerConsideration: "19800",
  };

  const { cohorts } = computeCollectionFloorStats([discounted, floorPeer, aboveFloor, isolatedUsdg], now);
  assert.equal(cohorts.length, 2); // 1 ETH cohort + 1 USDG cohort

  const observations = listingsToObservations([discounted, floorPeer, aboveFloor, isolatedUsdg], now);
  assert.equal(observations.length, 4);
  // Discounted ETH listing compares against ETH peer floor (0.001 ETH), NOT its own sellerConsideration (0.000585 ETH)
  assert.equal(observations[0].referencePrice, "1000000000000000");
  assert.equal(observations[0].listingCount, 4);
  assert.equal(observations[0].uniqueCounterparties, 4);
  const oppDiscount = evaluateObservation(observations[0], {}, now);
  assert.equal(oppDiscount.strategy, "MISPRICED_NFT");
  // Floor peer compares against discounted listing (0.0006 ETH) and is ABOVE_REFERENCE, not MISPRICED_NFT
  const oppPeer = evaluateObservation(observations[1], {}, now);
  assert.notEqual(oppPeer.strategy, "MISPRICED_NFT");

  // Isolated USDG listing has NO same-currency peer, so referencePrice and cohort liquidity are undefined -> INSUFFICIENT_DATA (score: null, confidence: 0)
  assert.equal(observations[3].referencePrice, undefined);
  assert.equal(observations[3].fairValue, undefined);
  const oppUsdg = evaluateObservation(observations[3], {}, now);
  assert.equal(oppUsdg.status, "INSUFFICIENT_DATA");
  assert.equal(oppUsdg.score, null);
  assert.equal(oppUsdg.confidence, 0);
});

test("provider discovers and aggregates listings across multiple collections rather than stopping at the first collection", async () => {
  const provider = createOpenSeaProvider({ apiKey: "test", minIntervalMs: 0 }, async (input) => {
    const url = String(input);
    if (url.includes("/api/v2/collections")) {
      return new Response(
        JSON.stringify({
          collections: [{ collection: "collection-alpha" }, { collection: "collection-beta" }, { collection: "collection-gamma" }],
        }),
        { status: 200 }
      );
    }
    if (url.includes("/collection-alpha/all")) {
      return new Response(
        JSON.stringify({
          listings: [
            {
              order_hash: "0xalpha1",
              current_price: "500000000000000",
              protocol_data: { parameters: { offer: [{ token: "0x1111111111111111111111111111111111111111", identifierOrCriteria: "1" }] } },
            },
          ],
        }),
        { status: 200 }
      );
    }
    if (url.includes("/collection-beta/all")) {
      return new Response(
        JSON.stringify({
          listings: [
            {
              order_hash: "0xbeta1",
              current_price: "700000000000000",
              protocol_data: { parameters: { offer: [{ token: "0x2222222222222222222222222222222222222222", identifierOrCriteria: "9" }] } },
            },
          ],
        }),
        { status: 200 }
      );
    }
    if (url.includes("/collection-gamma/all")) {
      return new Response(
        JSON.stringify({
          listings: [
            {
              order_hash: "0xgamma1",
              current_price: "300000000000000",
              protocol_data: { parameters: { offer: [{ token: "0x3333333333333333333333333333333333333333", identifierOrCriteria: "42" }] } },
            },
          ],
        }),
        { status: 200 }
      );
    }
    return new Response(JSON.stringify({ listings: [] }), { status: 200 });
  });

  const res = await provider.getListings({ chain: "robinhood", maxCollections: 3 });
  assert.equal(res.state, "AVAILABLE");
  assert.equal(res.data?.length, 3);
  assert.deepEqual(
    res.data?.map((l) => l.collection),
    ["collection-alpha", "collection-beta", "collection-gamma"]
  );
});
