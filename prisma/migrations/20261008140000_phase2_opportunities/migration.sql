-- Phase 2 analytical records. No execution tables.

CREATE TABLE "OpportunityRecord" (
  "id" TEXT NOT NULL,
  "chainId" INTEGER NOT NULL,
  "chainKey" TEXT NOT NULL,
  "contract" TEXT NOT NULL,
  "tokenId" TEXT,
  "collectionName" TEXT,
  "status" TEXT NOT NULL,
  "strategy" TEXT,
  "score" DOUBLE PRECISION,
  "confidence" DOUBLE PRECISION NOT NULL,
  "observedPrice" TEXT,
  "referencePrice" TEXT,
  "fairValue" TEXT,
  "priceDeviation" DOUBLE PRECISION,
  "evidence" JSONB NOT NULL,
  "analysis" JSONB NOT NULL,
  "observedAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OpportunityRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OpportunityRecord_chainId_contract_tokenId_key" ON "OpportunityRecord"("chainId", "contract", "tokenId");
CREATE INDEX "OpportunityRecord_strategy_status_idx" ON "OpportunityRecord"("strategy", "status");
CREATE INDEX "OpportunityRecord_status_score_idx" ON "OpportunityRecord"("status", "score");
CREATE INDEX "OpportunityRecord_chainId_contract_idx" ON "OpportunityRecord"("chainId", "contract");

CREATE TABLE "OpportunitySignal" (
  "id" TEXT NOT NULL,
  "opportunityId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "applicable" BOOLEAN NOT NULL,
  "score" DOUBLE PRECISION NOT NULL,
  "weight" DOUBLE PRECISION NOT NULL,
  "explanation" TEXT NOT NULL,
  "evidence" JSONB NOT NULL,
  CONSTRAINT "OpportunitySignal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OpportunitySignal_opportunityId_category_idx" ON "OpportunitySignal"("opportunityId", "category");
ALTER TABLE "OpportunitySignal" ADD CONSTRAINT "OpportunitySignal_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "OpportunityRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "OpportunityScore" (
  "id" TEXT NOT NULL,
  "opportunityId" TEXT NOT NULL,
  "total" DOUBLE PRECISION,
  "explanation" JSONB NOT NULL,
  "bounded" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "OpportunityScore_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OpportunityScore_opportunityId_key" ON "OpportunityScore"("opportunityId");
ALTER TABLE "OpportunityScore" ADD CONSTRAINT "OpportunityScore_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "OpportunityRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
