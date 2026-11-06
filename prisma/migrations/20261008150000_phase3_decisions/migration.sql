CREATE TABLE "DecisionRecord" (
  "id" TEXT NOT NULL,
  "opportunityId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL,
  "riskLevel" TEXT NOT NULL,
  "reasoning" TEXT NOT NULL,
  "supportingSignals" JSONB NOT NULL,
  "rejectionReasons" JSONB NOT NULL,
  "opportunityScore" DOUBLE PRECISION,
  "strategy" TEXT,
  "collection" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "execution" TEXT NOT NULL DEFAULT 'disabled',
  CONSTRAINT "DecisionRecord_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DecisionRecord_action_riskLevel_idx" ON "DecisionRecord"("action", "riskLevel");
CREATE INDEX "DecisionRecord_strategy_collection_idx" ON "DecisionRecord"("strategy", "collection");
CREATE INDEX "DecisionRecord_opportunityId_idx" ON "DecisionRecord"("opportunityId");

CREATE TABLE "RiskAssessmentRecord" (
  "id" TEXT NOT NULL,
  "decisionId" TEXT NOT NULL,
  "level" TEXT NOT NULL,
  "findings" JSONB NOT NULL,
  CONSTRAINT "RiskAssessmentRecord_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RiskAssessmentRecord_decisionId_key" ON "RiskAssessmentRecord"("decisionId");
ALTER TABLE "RiskAssessmentRecord" ADD CONSTRAINT "RiskAssessmentRecord_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "DecisionRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PolicyEvaluationRecord" (
  "id" TEXT NOT NULL,
  "decisionId" TEXT NOT NULL,
  "allowed" BOOLEAN NOT NULL,
  "violations" JSONB NOT NULL,
  "warnings" JSONB NOT NULL,
  "evaluatedRules" JSONB NOT NULL,
  CONSTRAINT "PolicyEvaluationRecord_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PolicyEvaluationRecord_decisionId_key" ON "PolicyEvaluationRecord"("decisionId");
ALTER TABLE "PolicyEvaluationRecord" ADD CONSTRAINT "PolicyEvaluationRecord_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "DecisionRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
