import { PrismaClient } from "@prisma/client";
import { PrismaTransactionStore } from "../packages/tx/src/prisma-store.js";

const prisma = new PrismaClient();

async function main() {
  const store = new PrismaTransactionStore(prisma);
  console.log("Testing transaction and simulation persistence...");

  const intentId = "intent-test-1";
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);

  // 1. Save a mock transaction intent
  await store.saveIntent(intentId, {
    decisionId: "decision-test-1",
    opportunityId: "opp-test-1",
    chainId: 1,
    contract: "0x1234567890abcdef1234567890abcdef12345678",
    tokenId: "1",
    marketplace: "opensea",
    expectedPrice: "1000000000000000000",
    maxPrice: "1050000000000000000",
    estimatedGas: "150000",
    slippageBps: 50,
    payload: { to: "0x...", value: "1000000000000000000" } as any,
    expiresAt,
  });
  console.log("Successfully saved transaction intent.");

  // 2. Save a mock simulation result linked to that intent
  await store.saveSimulation({
    id: "sim:intent-test-1",
    intentId,
    state: "SIMULATED_SUCCESS",
    success: true,
    gasEstimate: "142000",
    effectiveGasCost: "2000000000000",
    revertReason: null,
    warnings: [],
    simulationTimestamp: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    executable: false as any,
  });
  console.log("Successfully saved simulation result.");

  const intentCount = await prisma.transactionIntentRecord.count();
  const simCount = await prisma.simulationResultRecord.count();
  console.log(`Total intents in DB: ${intentCount}`);
  console.log(`Total simulations in DB: ${simCount}`);
}

main()
  .catch((e) => {
    console.error("Verification failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });