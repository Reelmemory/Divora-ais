import { PrismaClient } from "@prisma/client";
import { PrismaListingStore } from "../packages/market/src/prisma-store.js";

const prisma = new PrismaClient();

async function main() {
  const store = new PrismaListingStore(prisma);
  console.log("Testing connection and upserting test listing snapshot...");
  
  const result = await store.upsertSnapshots([
    {
      id: "test-snapshot-1",
      chainId: 1,
      marketplace: "opensea",
      contract: "0x1234567890abcdef1234567890abcdef12345678",
      tokenId: "1",
      price: "1000000000000000000",
      seller: "0xabcdef1234567890abcdef1234567890abcdef12",
      freshness: "live",
      observedAt: new Date(),
      payload: { source: "test", currency: "ETH" },
    },
  ]);

  console.log("Success! Persisted rows:", result.persisted);
  const count = await prisma.marketListingSnapshot.count();
  console.log("Total snapshots in Supabase MarketListingSnapshot table:", count);
}

main()
  .catch((e) => {
    console.error("Verification failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });