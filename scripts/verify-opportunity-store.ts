import { PrismaClient } from "@prisma/client";
import { PrismaOpportunityStore } from "../packages/shared/src/prisma-opportunity-store.js";

const prisma = new PrismaClient();

async function main() {
  const store = new PrismaOpportunityStore(prisma);
  console.log("Testing opportunity and decision persistence...");

  const oppId = "opp-test-1";
  const decisionId = "decision-test-1";
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);

  // 1. Save a mock opportunity with nested score and signals
  await store.saveOpportunity({
    id: oppId,
    chainId: 1,
    chainKey: "ethereum",
    contract: "0x1234567890abcdef1234567890abcdef12345678",
    tokenId: "1",
    collectionName: "Test Collection",
    status: "ACTIVE",
    strategy: "floor_discount",
    score: 85,
    confidence: 0.9,
    observedPrice: "1000000000000000000",
    referencePrice: "1200000000000000000",
    fairValue: "1150000000000000000",
    priceDeviation: -0.16,
    evidence: { listingId: "test-snapshot-1" },
    analysis: { summary: "Strong floor discount" },
    observedAt: now,
    expiresAt,
    scoreResult: {
      total: 85,
      explanation: { discountWeight: 0.6 },
      bounded: true,
    },
    signals: [
      {
        category: "pricing",
        code: "BELOW_FLOOR",
        applicable: true,
        score: 85,
        weight: 1.0,
        explanation: "Listed 16% below collection floor",
        evidence: { floor: "1.2 ETH", listed: "1.0 ETH" },
      },
    ],
  });
  console.log("Successfully saved opportunity record (with score & signals).");

  // 2. Save a mock decision linked to the opportunity (with risk & policy)
  await store.saveDecision({
    id: decisionId,
    opportunityId: oppId,
    action: "BUY",
    status: "APPROVED",
    confidence: 0.9,
    riskLevel: "LOW",
    reasoning: "High confidence floor discount within risk parameters",
    supportingSignals: ["BELOW_FLOOR"],
    rejectionReasons: [],
    opportunityScore: 85,
    strategy: "floor_discount",
    collection: "0x1234567890abcdef1234567890abcdef12345678",
    createdAt: now,
    expiresAt,
    execution: "simulation_only",
    risk: {
      level: "LOW",
      findings: [],
    },
    policy: {
      allowed: true,
      violations: [],
      warnings: [],
      evaluatedRules: ["MAX_EXPOSURE", "MIN_LIQUIDITY"],
    },
  });
  console.log("Successfully saved decision record (with risk & policy).");

  const oppCount = await prisma.opportunityRecord.count();
  const decisionCount = await prisma.decisionRecord.count();
  console.log(`Total opportunities in DB: ${oppCount}`);
  console.log(`Total decisions in DB: ${decisionCount}`);
}

main()
  .catch((e) => {
    console.error("Verification failed:", e);
    (globalThis as any).process?.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });