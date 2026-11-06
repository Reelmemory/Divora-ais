CREATE TABLE "TransactionIntentRecord" (
  "id" TEXT NOT NULL,
  "decisionId" TEXT NOT NULL,
  "opportunityId" TEXT NOT NULL,
  "chainId" INTEGER NOT NULL,
  "contract" TEXT NOT NULL,
  "tokenId" TEXT NOT NULL,
  "marketplace" TEXT NOT NULL,
  "expectedPrice" TEXT NOT NULL,
  "maxPrice" TEXT NOT NULL,
  "estimatedGas" TEXT NOT NULL,
  "slippageBps" INTEGER NOT NULL,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "executable" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "TransactionIntentRecord_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TransactionIntentRecord_decisionId_opportunityId_idx" ON "TransactionIntentRecord"("decisionId", "opportunityId");
CREATE INDEX "TransactionIntentRecord_chainId_contract_idx" ON "TransactionIntentRecord"("chainId", "contract");

CREATE TABLE "IntentValidationRecord" (
  "id" TEXT NOT NULL,
  "intentId" TEXT NOT NULL,
  "valid" BOOLEAN NOT NULL,
  "violations" JSONB NOT NULL,
  "warnings" JSONB NOT NULL,
  "evaluatedRules" JSONB NOT NULL,
  CONSTRAINT "IntentValidationRecord_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "IntentValidationRecord_intentId_key" ON "IntentValidationRecord"("intentId");
ALTER TABLE "IntentValidationRecord" ADD CONSTRAINT "IntentValidationRecord_intentId_fkey" FOREIGN KEY ("intentId") REFERENCES "TransactionIntentRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SimulationResultRecord" (
  "id" TEXT NOT NULL,
  "intentId" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "success" BOOLEAN NOT NULL,
  "revertReason" TEXT,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "executable" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "SimulationResultRecord_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SimulationResultRecord_intentId_state_idx" ON "SimulationResultRecord"("intentId", "state");
ALTER TABLE "SimulationResultRecord" ADD CONSTRAINT "SimulationResultRecord_intentId_fkey" FOREIGN KEY ("intentId") REFERENCES "TransactionIntentRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
