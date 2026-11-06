import assert from "node:assert/strict";
import test from "node:test";
import { normalizeOpenSeaOrder, persistListings, runListingPipeline, snapshotFromListing } from "../dist/index.js";

const now = new Date("2026-10-08T12:00:00.000Z");
const listing = {
  id: "0xabc", chainId: 4663, marketplace: "opensea", collection: "fixture",
  contractAddress: "0x2222222222222222222222222222222222222222", tokenId: "29",
  seller: "0x1111111111111111111111111111111111111111", price: "10", currency: null,
  expiresAt: "2026-10-08T12:10:00.000Z", source: "fixture", observedAt: now.toISOString(), freshness: "AVAILABLE",
};
const config = {
  maxTradeValue: "100", maxDailySpend: "100", maxGas: "1", maxSlippageBps: 100,
  allowedChains: [4663], allowedCollections: ["*"], allowedMarketplaces: ["opensea"],
  allowedStrategies: ["MISPRICED_NFT"], minOpportunityScore: 1, minConfidence: 1,
  buyMinScore: 1, buyMinConfidence: 1, watchMinScore: 1,
};

test("persists snapshots once and reports store failures", async () => {
  const seen = new Map();
  const store = { async upsertSnapshots(rows) { for (const row of rows) seen.set(row.id, row); return { persisted: rows.length }; } };
  const first = await persistListings([listing], store);
  const second = await persistListings([listing], store);
  assert.equal(first.persisted, 1);
  assert.equal(second.persisted, 1);
  assert.equal(seen.size, 1);
  assert.equal(snapshotFromListing(listing)?.payload.currency, null);
  const failed = await persistListings([listing], { async upsertSnapshots() { throw new Error("db down"); } });
  assert.equal(failed.persisted, 0);
  assert.equal(failed.error, "db down");
});

test("pipeline stops on provider or persistence failure and does not fabricate opportunities", async () => {
  const unavailable = await runListingPipeline({ provider: { state: "UNAVAILABLE", data: null, error: "OPENSEA_API_KEY is not configured" }, config, now });
  assert.equal(unavailable.stage, "provider");
  assert.equal(unavailable.opportunities.length, 0);
  const stale = { ...listing, freshness: "STALE", expiresAt: "2026-10-08T11:00:00.000Z" };
  const stored = [];
  const result = await runListingPipeline({ provider: { state: "AVAILABLE", data: [stale], error: null }, store: { async upsertSnapshots(rows) { stored.push(...rows); return { persisted: rows.length }; } }, config, now });
  assert.equal(stored[0].freshness, "STALE");
  assert.equal(result.opportunities.length, 0);
  const broken = await runListingPipeline({ provider: { state: "AVAILABLE", data: [listing], error: null }, store: { async upsertSnapshots() { throw new Error("write failed"); } }, config, now });
  assert.equal(broken.stage, "persistence");
  assert.equal(broken.opportunities.length, 0);
});

test("pipeline reaches decision, ranks ETH ahead of USDG, and keeps simulation non-executable", async () => {
  const usdgOrder = normalizeOpenSeaOrder({
    chainId: 4663,
    observedAt: now.toISOString(),
    order: {
      order_hash: "0xusdg",
      protocol_address: "0x0000000000000068f116a894984e2db1123eb395",
      price: { current: { currency: "USDG", decimals: 6, value: "20000" } },
      protocol_data: {
        parameters: {
          offerer: "0x1111111111111111111111111111111111111111",
          endTime: "1799794098",
          offer: [{ token: listing.contractAddress, identifierOrCriteria: "30" }],
          consideration: [
            { itemType: 1, token: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168", startAmount: "19800", recipient: "0x1111111111111111111111111111111111111111" },
            { itemType: 1, token: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168", startAmount: "200", recipient: "0x0000a26b00c1f0df003000390027140000faa719" },
          ],
        },
      },
    },
  });
  assert.ok(usdgOrder);
  assert.equal(usdgOrder.paymentToken, "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168");
  assert.equal(usdgOrder.sellerConsideration, "19800");
  assert.equal(usdgOrder.feeBps, 100);

  const result = await runListingPipeline({
    provider: { state: "AVAILABLE", data: [usdgOrder, { ...listing, currency: "ETH" }], error: null },
    store: { async upsertSnapshots(rows) { return { persisted: rows.length }; } },
    config,
    buyer: "0x3333333333333333333333333333333333333333",
    maxPrice: "12",
    slippageBps: 10,
    estimatedGas: "0.1",
    now,
  });
  assert.equal(result.stage, "complete");
  assert.equal(result.persisted, 2);
  assert.equal(result.opportunities.length, 2);
  // Neither ETH nor USDG has a same-currency peer in this 2-item mixed-currency set, so both are honestly INSUFFICIENT_DATA
  assert.equal(result.opportunities[0].status, "INSUFFICIENT_DATA");
  assert.equal(result.opportunities[1].status, "INSUFFICIENT_DATA");
  assert.equal(result.rankedListings[0].id, "0xabc");
  assert.equal(result.rankedListings[1].id, "0xusdg");
  assert.equal(result.approvals[0].plan.required, true);
  assert.equal(result.approvals[0].plan.spender, null);
  assert.equal(result.readiness[0].status.feeBps, 100);
  assert.equal(result.swapQuote.executable, false);
  assert.equal(result.decisions[0].execution, "disabled");
  assert.equal(result.simulation.executable, false);
  assert.equal(result.simulation.onChain, false);
});

test("pipeline validates intents via validateIntent, prevents duplicate active intents, and fails closed on store errors", async () => {
  const discounted = {
    ...listing,
    id: "0x1111111111111111111111111111111111111111111111111111111111111111",
    tokenId: "1",
    seller: "0x1111111111111111111111111111111111111111",
    price: "10",
    currency: "ETH",
  };
  const floorPeer = {
    ...listing,
    id: "0x2222222222222222222222222222222222222222222222222222222222222222",
    tokenId: "2",
    seller: "0x4444444444444444444444444444444444444444",
    price: "20",
    currency: "ETH",
  };

  const activeDecisions = new Set();
  const activeOrders = new Set();
  const savedIntents = [];
  const savedSims = [];

  const txStore = {
    async hasActiveIntent(decisionId, _now, orderHash) {
      return activeDecisions.has(decisionId) || Boolean(orderHash && activeOrders.has(orderHash));
    },
    async saveIntent(id, data) {
      activeDecisions.add(data.decisionId);
      if (data.orderHash) activeOrders.add(data.orderHash);
      savedIntents.push({ id, ...data });
    },
    async saveSimulation(sim) {
      savedSims.push(sim);
    },
  };

  // First run: creates 1 validated intent and simulates it
  const firstRun = await runListingPipeline({
    provider: { state: "AVAILABLE", data: [discounted, floorPeer], error: null },
    txStore,
    simulator: { async simulate() { return { state: "SIMULATED_SUCCESS", gasEstimate: "145000" }; } },
    config,
    buyer: "0x3333333333333333333333333333333333333333",
    maxPrice: "15",
    slippageBps: 50,
    estimatedGas: "0.5",
    now,
  });

  assert.equal(firstRun.stage, "complete");
  assert.equal(firstRun.intents.length, 1);
  assert.equal(firstRun.intents[0].orderHash, discounted.id);
  assert.equal(savedIntents.length, 1);
  assert.equal(savedSims.length, 1);
  assert.equal(firstRun.simulation.state, "SIMULATED_SUCCESS");
  assert.equal(firstRun.simulation.executable, false);

  // Second run with same active decision/order: blocked by duplicate intent guard
  const secondRun = await runListingPipeline({
    provider: { state: "AVAILABLE", data: [discounted, floorPeer], error: null },
    txStore,
    simulator: { async simulate() { return { state: "SIMULATED_SUCCESS", gasEstimate: "145000" }; } },
    config,
    buyer: "0x3333333333333333333333333333333333333333",
    maxPrice: "15",
    slippageBps: 50,
    estimatedGas: "0.5",
    now,
  });

  assert.equal(secondRun.intents.length, 0);
  assert.equal(secondRun.intentValidations[0].validation.violations.includes("DUPLICATE_ACTIVE_INTENT"), true);

  // Validation failure behavior: when maxPrice is below listing observedPrice, validateIntent rejects with PRICE_EXCEEDED
  const rejectedValidationRun = await runListingPipeline({
    provider: { state: "AVAILABLE", data: [discounted, floorPeer], error: null },
    simulator: { async simulate() { return { state: "SIMULATED_SUCCESS", gasEstimate: "145000" }; } },
    config,
    buyer: "0x3333333333333333333333333333333333333333",
    maxPrice: "5", // below discounted listing price of "10"
    slippageBps: 50,
    estimatedGas: "0.5",
    now,
  });
  assert.equal(rejectedValidationRun.intents.length, 0);
  assert.equal(rejectedValidationRun.simulation.state, "VALIDATION_REJECTED");
  assert.equal(rejectedValidationRun.intentValidations[0].validation.violations.includes("PRICE_EXCEEDED"), true);

  // Fail-closed when opportunityStore fails
  const brokenOppStore = await runListingPipeline({
    provider: { state: "AVAILABLE", data: [discounted, floorPeer], error: null },
    opportunityStore: {
      async saveOpportunity() { throw new Error("opp write failed"); },
      async saveDecision() {},
    },
    config,
    now,
  });
  assert.equal(brokenOppStore.stage, "persistence");
  assert.equal(brokenOppStore.persistenceError, "opp write failed");
});

test("pipeline evaluates multi-collection listings globally and wires prepareBuyOrder + RPC simulation end-to-end", async () => {
  const colA = "0x536de17561c3dec4dba699bd13a40afdc77f4641";
  const colB = "0x819a21f4c76b331d0a88479e1043c19222ab9102";
  const seaport = "0x0000000000000068f116a894984e2db1123eb395";

  const listings = [
    // Collection A: 40% below floor
    {
      ...listing,
      id: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      collection: "onlyhoodpixel",
      contractAddress: colA,
      tokenId: "10",
      seller: "0x1111111111111111111111111111111111111111",
      price: "60",
      currency: "ETH",
      protocolAddress: seaport,
    },
    {
      ...listing,
      id: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      collection: "onlyhoodpixel",
      contractAddress: colA,
      tokenId: "11",
      seller: "0x2222222222222222222222222222222222222222",
      price: "100",
      currency: "ETH",
      protocolAddress: seaport,
    },
    // Collection B: 50% below floor (stronger opportunity across collections)
    {
      ...listing,
      id: "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      collection: "robinhood-voyagers",
      contractAddress: colB,
      tokenId: "77",
      seller: "0x3333333333333333333333333333333333333333",
      price: "40",
      currency: "ETH",
      protocolAddress: seaport,
    },
    {
      ...listing,
      id: "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
      collection: "robinhood-voyagers",
      contractAddress: colB,
      tokenId: "78",
      seller: "0x4444444444444444444444444444444444444444",
      price: "80",
      currency: "ETH",
      protocolAddress: seaport,
    },
  ];

  // Mock RPC client returning valid Seaport getOrderStatus response
  const encodedOrderStatus =
    "0x" + "1".padStart(64, "0") + "0".padStart(64, "0") + "0".padStart(64, "0") + "1".padStart(64, "0");
  const mockPublicClient = {
    async getChainId() { return 4663; },
    async call() { return { data: encodedOrderStatus }; },
    async estimateGas() { return 120000n; },
  };

  // Mock fetchImpl for prepareBuyOrder returning OpenSea fulfillment_data
  const mockFetch = async () =>
    new Response(
      JSON.stringify({
        protocol: "seaport",
        fulfillment_data: {
          transaction: {
            function: "fulfillBasicOrder_efficient_6GL6yc",
            chain: 4663,
            to: seaport,
            value: "40",
            input_data: {},
          },
        },
      }),
      { status: 200 },
    );

  const res = await runListingPipeline({
    provider: { state: "AVAILABLE", data: listings, error: null },
    publicClient: mockPublicClient,
    openSeaApiKey: "test-key",
    fetchImpl: mockFetch,
    config,
    buyer: "0x9999999999999999999999999999999999999999",
    maxPrice: "80",
    slippageBps: 50,
    estimatedGas: "0.5",
    now,
  });

  assert.equal(res.stage, "complete");
  assert.equal(res.cohorts.length, 2); // Both collections evaluated
  assert.equal(res.intents.length, 2); // One BUY intent per discounted NFT across both collections
  assert.equal(res.preparedFulfillments.length, 2);
  assert.equal(res.preparedFulfillments[0].source, "opensea-fulfillment_data");
  assert.equal(res.rpcSimulations.length, 2);
  assert.equal(res.rpcSimulations[0].state, "SIMULATED_SUCCESS");
  // Collection B's 50% discount ranks ahead of Collection A's 40% discount globally
  assert.equal(res.rankedListings[0].collection, "robinhood-voyagers");
  assert.equal(res.rankedListings[1].collection, "onlyhoodpixel");
});
