CREATE TABLE "MarketListingSnapshot" (
  "id" TEXT NOT NULL,
  "chainId" INTEGER NOT NULL,
  "marketplace" TEXT NOT NULL,
  "contract" TEXT,
  "tokenId" TEXT,
  "price" TEXT,
  "seller" TEXT,
  "freshness" TEXT NOT NULL,
  "observedAt" TIMESTAMP(3) NOT NULL,
  "payload" JSONB NOT NULL,
  CONSTRAINT "MarketListingSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MarketListingSnapshot_chainId_contract_idx" ON "MarketListingSnapshot"("chainId", "contract");
CREATE INDEX "MarketListingSnapshot_freshness_observedAt_idx" ON "MarketListingSnapshot"("freshness", "observedAt");
