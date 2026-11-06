import { PrismaClient } from "@prisma/client";
import type { ConstitutionConfig, NormalizedListing, Simulator } from "@divora/shared";
import { PrismaOpportunityStore } from "../packages/shared/src/prisma-opportunity-store.js";
import { PrismaListingStore } from "../packages/market/src/prisma-store.js";
import { normalizeOpenSeaOrder } from "../packages/market/src/normalize.js";
import { runListingPipeline } from "../packages/market/src/pipeline.js";
import { PrismaTransactionStore } from "../packages/tx/src/prisma-store.js";

const SEAPORT_16 = "0x0000000000000068f116a894984e2db1123eb395" as const;

const testConstitution: ConstitutionConfig = {
  maxTradeValue: "2000000000000000000", // 2 ETH
  maxDailySpend: "5000000000000000000", // 5 ETH
  maxGas: "300000",
  maxSlippageBps: 200,
  allowedChains: [4663],
  allowedCollections: ["*"], // Multi-collection market-wide discovery by default
  blockedCollections: [],
  allowedMarketplaces: ["opensea"],
  allowedStrategies: ["MISPRICED_NFT", "SMART_MONEY_ACTIVITY", "ACTIVITY_SPIKE", "COLLECTION_MOMENTUM"],
  minOpportunityScore: 20,
  minConfidence: 20,
  buyMinScore: 30,
  buyMinConfidence: 25,
  watchMinScore: 15,
};

async function main() {
  console.log("Running Phase 12 Multi-Collection E2E Pipeline Verification...");

  const now = new Date();
  const endTimeSec = String(Math.floor(now.getTime() / 1000) + 3600);
  const colAlpha = "0x536de17561c3dec4dba699bd13a40afdc77f4641";
  const colBeta = "0x819a21f4c76b331d0a88479e1043c19222ab9102";

  // Multi-collection listings using real Seaport order structures (no synthetic referencePrice or transferCount overrides)
  const rawOrders = [
    {
      order_hash: "0xea9fe2e0d2fec1724e36e833d963218d40cbf7ec10af8418c765fd820ed898bd",
      collection_slug: "onlyhoodpixel",
      protocol_address: SEAPORT_16,
      price: { current: { currency: "ETH", decimals: 18, value: "550000000000000" } },
      protocol_data: {
        parameters: {
          offerer: "0x722ffa423cce95953d97c9c4a2ac0049e70f0ee7",
          endTime: endTimeSec,
          offer: [{ token: colAlpha, identifierOrCriteria: "412" }],
          consideration: [
            { itemType: 0, token: "0x0000000000000000000000000000000000000000", startAmount: "536250000000000", recipient: "0x722ffa423cce95953d97c9c4a2ac0049e70f0ee7" },
            { itemType: 0, token: "0x0000000000000000000000000000000000000000", startAmount: "13750000000000", recipient: "0x0000a26b00c1f0df003000390027140000faa719" },
          ],
        },
      },
    },
    {
      order_hash: "0x8b4c91f0a12c47119d3e8f44c0156a92b81f33e9001247ab8219c41f009e12a4",
      collection_slug: "onlyhoodpixel",
      protocol_address: SEAPORT_16,
      price: { current: { currency: "ETH", decimals: 18, value: "950000000000000" } },
      protocol_data: {
        parameters: {
          offerer: "0x9134a8b21094821a77e12994021abc9938172611",
          endTime: endTimeSec,
          offer: [{ token: colAlpha, identifierOrCriteria: "889" }],
          consideration: [
            { itemType: 0, token: "0x0000000000000000000000000000000000000000", startAmount: "926250000000000", recipient: "0x9134a8b21094821a77e12994021abc9938172611" },
            { itemType: 0, token: "0x0000000000000000000000000000000000000000", startAmount: "23750000000000", recipient: "0x0000a26b00c1f0df003000390027140000faa719" },
          ],
        },
      },
    },
    {
      order_hash: "0x11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff",
      collection_slug: "robinhood-voyagers",
      protocol_address: SEAPORT_16,
      price: { current: { currency: "ETH", decimals: 18, value: "400000000000000" } },
      protocol_data: {
        parameters: {
          offerer: "0x5511223344556677889900aabbccddeeff001122",
          endTime: endTimeSec,
          offer: [{ token: colBeta, identifierOrCriteria: "77" }],
          consideration: [
            { itemType: 0, token: "0x0000000000000000000000000000000000000000", startAmount: "390000000000000", recipient: "0x5511223344556677889900aabbccddeeff001122" },
            { itemType: 0, token: "0x0000000000000000000000000000000000000000", startAmount: "10000000000000", recipient: "0x0000a26b00c1f0df003000390027140000faa719" },
          ],
        },
      },
    },
    {
      order_hash: "0x223344556677889900aabbccddeeff0011223344556677889900aabbccddeeff",
      collection_slug: "robinhood-voyagers",
      protocol_address: SEAPORT_16,
      price: { current: { currency: "ETH", decimals: 18, value: "800000000000000" } },
      protocol_data: {
        parameters: {
          offerer: "0x6611223344556677889900aabbccddeeff001133",
          endTime: endTimeSec,
          offer: [{ token: colBeta, identifierOrCriteria: "145" }],
          consideration: [
            { itemType: 0, token: "0x0000000000000000000000000000000000000000", startAmount: "780000000000000", recipient: "0x6611223344556677889900aabbccddeeff001133" },
            { itemType: 0, token: "0x0000000000000000000000000000000000000000", startAmount: "20000000000000", recipient: "0x0000a26b00c1f0df003000390027140000faa719" },
          ],
        },
      },
    },
  ];

  const listings = rawOrders
    .map((order) => normalizeOpenSeaOrder({ chainId: 4663, observedAt: now.toISOString(), order }))
    .filter((item): item is NormalizedListing => item !== null);

  const mockSimulator: Simulator = {
    async simulate() {
      return {
        state: "SIMULATED_SUCCESS",
        gasEstimate: "135000",
        effectiveGasCost: "1800000000000",
        warnings: [],
      };
    },
  };

  const hasDatabaseUrl = Boolean(
    process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("localhost:5432/divora"),
  );

  if (!hasDatabaseUrl) {
    console.log(
      "[Notice] DATABASE_URL is not configured or points to unprovisioned localhost:5432/divora. Running pipeline with in-memory read-back verification store.",
    );
    const activeDecisions = new Set<string>();
    const activeOrders = new Set<string>();
    const result = await runListingPipeline({
      provider: { state: "AVAILABLE", data: listings, error: null },
      store: { async upsertSnapshots(rows) { return { persisted: rows.length }; } },
      opportunityStore: {
        async saveOpportunity(o) { return o; },
        async saveDecision(d) { return d; },
      },
      txStore: {
        async hasActiveIntent(decisionId, _now, orderHash) {
          return activeDecisions.has(decisionId) || Boolean(orderHash && activeOrders.has(orderHash));
        },
        async saveIntent(id, data) {
          activeDecisions.add(data.decisionId);
          if (data.orderHash) activeOrders.add(data.orderHash);
          return { id, ...data };
        },
        async saveSimulation(s) { return s; },
      },
      simulator: mockSimulator,
      config: testConstitution,
      buyer: "0x2222222222222222222222222222222222222222",
      spender: SEAPORT_16,
      maxPrice: "1000000000000000",
      slippageBps: 100,
      estimatedGas: "150000",
      now,
    });
    console.log("Pipeline Stage:", result.stage);
    console.log("Collections Evaluated:", result.cohorts.length);
    console.log("Snapshots Persisted:", result.persisted);
    console.log("Opportunities Evaluated:", result.opportunities.length);
    console.log("Decisions Made:", result.decisions.map((d) => `${d.action} (${d.status}) - score: ${d.opportunityScore}`));
    console.log("Intents Created:", result.intents.length);
    console.log("Simulation State:", result.simulation.state);
    return;
  }

  const prisma = new PrismaClient();
  try {
    const listingStore = new PrismaListingStore(prisma);
    const opportunityStore = new PrismaOpportunityStore(prisma);
    const txStore = new PrismaTransactionStore(prisma);

    const result = await runListingPipeline({
      provider: { state: "AVAILABLE", data: listings, error: null },
      store: listingStore,
      opportunityStore,
      txStore,
      simulator: mockSimulator,
      config: testConstitution,
      buyer: "0x2222222222222222222222222222222222222222",
      spender: SEAPORT_16,
      maxPrice: "1000000000000000",
      slippageBps: 100,
      estimatedGas: "150000",
      now,
    });

    console.log("Pipeline Stage:", result.stage);
    console.log("Persistence Error:", result.persistenceError);
    console.log("Snapshots Persisted:", result.persisted);
    console.log("Opportunities Evaluated:", result.opportunities.length);
    console.log("Decisions Made:", result.decisions.map((d) => `${d.action} (${d.status}) - score: ${d.opportunityScore}`));
    console.log("Simulation State:", result.simulation.state);

    const [snapshots, opps, decisions, intents, sims] = await Promise.all([
      prisma.marketListingSnapshot.count(),
      prisma.opportunityRecord.count(),
      prisma.decisionRecord.count(),
      prisma.transactionIntentRecord.count(),
      prisma.simulationResultRecord.count(),
    ]);

    console.log("\n--- PostgreSQL Database Totals ---");
    console.log(`Snapshots: ${snapshots}`);
    console.log(`Opportunities: ${opps}`);
    console.log(`Decisions: ${decisions}`);
    console.log(`Intents: ${intents}`);
    console.log(`Simulations: ${sims}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("E2E Pipeline failed:", e);
  (globalThis as unknown as { process?: { exit(code: number): void } }).process?.exit(1);
});