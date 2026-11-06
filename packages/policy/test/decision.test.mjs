import assert from "node:assert/strict";
import test from "node:test";
import { evaluateObservation } from "../../opportunities/dist/index.js";
import { assessRisk, decide, evaluatePolicy, FailClosedConstitution } from "../dist/index.js";

const contract = "0x1111111111111111111111111111111111111111";
const now = new Date("2026-10-08T12:00:00.000Z");

function config(overrides = {}) {
  return {
    maxTradeValue: "100",
    maxDailySpend: "200",
    maxGas: "1",
    maxSlippageBps: 100,
    allowedChains: [4663],
    allowedCollections: [contract],
    allowedMarketplaces: ["fixture"],
    allowedStrategies: ["MISPRICED_NFT", "ACTIVITY_SPIKE"],
    minOpportunityScore: 50,
    minConfidence: 50,
    buyMinScore: 50,
    buyMinConfidence: 60,
    watchMinScore: 25,
    ...overrides,
  };
}

function context() {
  return { tradeValue: "40", gas: "0.2", slippageBps: 50, marketplace: "fixture" };
}

function strong() {
  return evaluateObservation({
    chainId: 4663,
    chainKey: "robinhood",
    contract,
    tokenId: "29",
    collectionName: "Fixture",
    metadataPresent: true,
    observedPrice: "10",
    referencePrice: "100",
    transferCount: 6,
    priorTransferCount: 5,
    listingCount: 1,
    uniqueCounterparties: 2,
    observedAt: "2026-10-08T11:55:00.000Z",
    source: "fixture",
  }, {}, now);
}

test("risk levels follow collected evidence", () => {
  const low = assessRisk(strong(), now);
  assert.equal(low.level, "LOW");
  const missing = assessRisk(evaluateObservation({
    chainId: 4663, chainKey: "robinhood", contract, tokenId: "1", metadataPresent: false, transferCount: 2,
    observedAt: "2026-10-08T11:55:00.000Z", source: "fixture",
  }, {}, now), now);
  assert.equal(missing.level, "HIGH");
  const stale = assessRisk(strong(), new Date("2026-10-08T13:00:00.000Z"));
  assert.equal(stale.level, "CRITICAL");
  const conflict = assessRisk(evaluateObservation({
    chainId: 4663, chainKey: "robinhood", contract, tokenId: "2", collectionName: "Fixture", metadataPresent: true,
    observedPrice: "10", referencePrice: "100", conflictingPrices: ["90"], listingCount: 2, uniqueCounterparties: 3,
    transferCount: 2, observedAt: "2026-10-08T11:55:00.000Z", source: "fixture",
  }, {}, now), now);
  assert.equal(conflict.level, "CRITICAL");
  const medium = assessRisk(evaluateObservation({
    chainId: 4663, chainKey: "robinhood", contract, tokenId: "5", collectionName: "Fixture", metadataPresent: true,
    observedPrice: "80", referencePrice: "100", transferCount: 2, listingCount: 0, uniqueCounterparties: 1,
    observedAt: "2026-10-08T11:55:00.000Z", source: "fixture",
  }, {}, now), now);
  assert.equal(medium.level, "MEDIUM");
  assert.ok(missing.findings.some((finding) => finding.type === "price" && finding.severity === "HIGH"));
});

test("policy is fail-closed and checks each restriction", () => {
  const opportunity = strong();
  const input = { chainId: 4663, collection: contract, strategy: opportunity.strategy, score: opportunity.score, confidence: opportunity.confidence, tradeValue: "40", gas: "0.2", slippageBps: 50, marketplace: "fixture" };
  assert.equal(evaluatePolicy(config(), input).allowed, true);
  assert.ok(evaluatePolicy(config(), { ...input, chainId: 1 }).violations.includes("CHAIN_NOT_ALLOWED"));
  assert.ok(evaluatePolicy(config(), { ...input, collection: "0x2222222222222222222222222222222222222222" }).violations.includes("COLLECTION_NOT_ALLOWED"));
  assert.ok(evaluatePolicy(config({ allowedStrategies: ["ACTIVITY_SPIKE"] }), input).violations.includes("STRATEGY_NOT_ALLOWED"));
  assert.ok(evaluatePolicy(config({ minOpportunityScore: 99 }), input).violations.includes("OPPORTUNITY_SCORE_TOO_LOW"));
  assert.ok(evaluatePolicy(config({ minConfidence: 99 }), input).violations.includes("CONFIDENCE_TOO_LOW"));
  assert.ok(evaluatePolicy(config(), { ...input, tradeValue: "500" }).violations.includes("TRADE_VALUE_EXCEEDED"));
  assert.ok(evaluatePolicy(config(), { ...input, gas: "5" }).violations.includes("GAS_LIMIT_EXCEEDED"));
  assert.ok(evaluatePolicy(config(), { ...input, slippageBps: 500 }).violations.includes("SLIPPAGE_EXCEEDED"));
  assert.ok(evaluatePolicy(config({ maxDailySpend: "200" }), { ...input, tradeValue: "40", dailySpendUsed: "170" }).violations.includes("DAILY_SPEND_EXCEEDED"));
  assert.equal(evaluatePolicy(config({ maxDailySpend: "200" }), { ...input, tradeValue: "40", dailySpendUsed: "150" }).allowed, true);
  assert.equal(evaluatePolicy(config({ allowedCollections: ["*"] }), { ...input, collection: "0x9999999999999999999999999999999999999999" }).allowed, true);
  assert.ok(
    evaluatePolicy(config({ allowedCollections: ["*"], blockedCollections: ["0x9999999999999999999999999999999999999999"] }), {
      ...input,
      collection: "0x9999999999999999999999999999999999999999",
    }).violations.includes("COLLECTION_BLOCKED")
  );
  assert.equal(evaluatePolicy(config({ maxTradeValue: null, maxGas: null, maxSlippageBps: null, allowedChains: [] }), input).allowed, false);
});

test("decisions stay analytical and policy overrides a buy-shaped analysis", () => {
  const buy = decide(strong(), config(), context(), now);
  assert.equal(buy.action, "BUY");
  assert.equal(buy.execution, "disabled");
  const weak = decide(evaluateObservation({
    chainId: 4663, chainKey: "robinhood", contract, tokenId: "3", collectionName: "Fixture", metadataPresent: true,
    observedPrice: "60", referencePrice: "100", transferCount: 2, listingCount: 1, uniqueCounterparties: 2,
    observedAt: "2026-10-08T11:55:00.000Z", source: "fixture",
  }, {}, now), config({ minOpportunityScore: 10, minConfidence: 10, buyMinScore: 80 }), context(), now);
  assert.equal(weak.action, "WATCH");
  const unsafe = decide(strong(), config(), context(), new Date("2026-10-08T13:00:00.000Z"));
  assert.equal(unsafe.action, "REJECT");
  assert.ok(unsafe.rejectionReasons.includes("CRITICAL_RISK"));
  const insufficient = decide(evaluateObservation({
    chainId: 4663, chainKey: "robinhood", contract, tokenId: "4", metadataPresent: false, transferCount: 0,
    observedAt: "2026-10-08T11:55:00.000Z", source: "fixture",
  }, {}, now), config(), context(), now);
  assert.notEqual(insufficient.action, "BUY");
  const blocked = decide(strong(), config({ allowedChains: [1] }), { ...context(), analysis: { recommendation: "review", confidence: 99, reasoning: "buy it", supportingSignals: ["BELOW_REFERENCE"], invalidationConditions: [] } }, now);
  assert.equal(blocked.action, "REJECT");
  assert.equal(new FailClosedConstitution().validate({ id: "1", kind: "buy", chainKey: "robinhood", stage: "DECIDE", reason: "test" }).allowed, false);
});
