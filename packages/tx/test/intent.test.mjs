import assert from "node:assert/strict";
import test from "node:test";
import { evaluateObservation } from "../../opportunities/dist/index.js";
import { decide } from "../../policy/dist/index.js";
import { buildTransactionRequest, createIntent, markStale, simulateRequest, unavailableSimulator, validateIntent } from "../dist/index.js";

const contract = "0x1111111111111111111111111111111111111111";
const now = new Date("2026-10-08T12:00:00.000Z");
const config = {
  maxTradeValue: "100", maxDailySpend: "200", maxGas: "1", maxSlippageBps: 100,
  allowedChains: [4663], allowedCollections: [contract], allowedMarketplaces: ["fixture"],
  allowedStrategies: ["MISPRICED_NFT"], minOpportunityScore: 10, minConfidence: 10,
  buyMinScore: 10, buyMinConfidence: 10, watchMinScore: 1,
};
const draft = { expectedPrice: "10", maxPrice: "12", estimatedGas: "0.2", slippageBps: 50, marketplace: "fixture" };

function opportunity() {
  return evaluateObservation({
    chainId: 4663, chainKey: "robinhood", contract, tokenId: "29", collectionName: "Fixture", metadataPresent: true,
    observedPrice: "10", referencePrice: "100", transferCount: 6, priorTransferCount: 5, listingCount: 1, uniqueCounterparties: 2,
    observedAt: "2026-10-08T11:55:00.000Z", source: "fixture",
  }, {}, now);
}
function decisionFor(actionOpportunity = opportunity(), at = now) {
  return decide(actionOpportunity, config, { tradeValue: "12", gas: "0.2", slippageBps: 50, marketplace: "fixture" }, at);
}

test("only a fresh BUY decision can become an intent", () => {
  const buy = decisionFor();
  const valid = validateIntent({ decision: buy, opportunity: opportunity(), config, draft, now });
  assert.equal(valid.valid, true);
  const intent = createIntent({ decision: buy, opportunity: opportunity(), draft, now });
  assert.equal(intent.executable, false);
  assert.equal(intent.type, "BUY_NFT");
  const watch = { ...buy, action: "WATCH" };
  assert.equal(validateIntent({ decision: watch, opportunity: opportunity(), config, draft, now }).valid, false);
  const rejected = { ...buy, action: "REJECT" };
  assert.ok(validateIntent({ decision: rejected, opportunity: opportunity(), config, draft, now }).violations.includes("DECISION_NOT_BUY"));
  assert.ok(validateIntent({ decision: buy, opportunity: opportunity(), config, draft, now: new Date("2026-10-08T13:00:00.000Z") }).violations.includes("DECISION_EXPIRED"));
});

test("validator fails closed on policy, price, gas, slippage, and risk", () => {
  const buy = decisionFor();
  const opp = opportunity();
  assert.ok(validateIntent({ decision: buy, opportunity: opp, config: { ...config, allowedChains: [1] }, draft, now }).violations.includes("CHAIN_NOT_ALLOWED"));
  assert.ok(validateIntent({ decision: buy, opportunity: opp, config: { ...config, allowedCollections: [] }, draft, now }).violations.includes("COLLECTION_NOT_ALLOWED"));
  assert.ok(validateIntent({ decision: buy, opportunity: opp, config, draft: { ...draft, maxPrice: "9" }, now }).violations.includes("PRICE_EXCEEDED"));
  assert.ok(validateIntent({ decision: buy, opportunity: opp, config, draft: { ...draft, estimatedGas: "5" }, now }).violations.includes("GAS_LIMIT_EXCEEDED"));
  assert.ok(validateIntent({ decision: buy, opportunity: opp, config, draft: { ...draft, slippageBps: 500 }, now }).violations.includes("SLIPPAGE_EXCEEDED"));
  assert.ok(validateIntent({ decision: buy, opportunity: opp, config: { ...config, maxTradeValue: null }, draft, now }).violations.includes("TRADE_VALUE_EXCEEDED"));
  const critical = { ...buy, riskLevel: "CRITICAL" };
  assert.ok(validateIntent({ decision: critical, opportunity: opp, config, draft, now }).violations.includes("CRITICAL_RISK"));
});

test("builder rejects invalid intents and arbitrary calldata", () => {
  const buy = decisionFor();
  const validation = validateIntent({ decision: buy, opportunity: opportunity(), config, draft, now });
  const intent = createIntent({ decision: buy, opportunity: opportunity(), draft, now });
  const request = buildTransactionRequest(intent, validation);
  assert.equal(request.kind, "structured-buy-intent");
  assert.equal("data" in request, false);
  assert.throws(() => buildTransactionRequest(intent, { ...validation, valid: false }));
  assert.throws(() => buildTransactionRequest({ ...intent, data: "0x1234" }, validation));
});

test("simulation cannot turn failure or unavailability into an executable success", async () => {
  const request = { chainId: 4663, to: contract, value: "12", marketplace: "fixture", tokenId: "29", kind: "structured-buy-intent" };
  const ok = await simulateRequest({ intentId: "i", request, simulator: { async simulate() { return { state: "SIMULATED_SUCCESS", gasEstimate: "21000" }; } }, now });
  assert.equal(ok.success, true);
  assert.equal(ok.executable, false);
  const reverted = await simulateRequest({ intentId: "i", request, simulator: { async simulate() { return { state: "SIMULATED_REVERT", revertReason: "price moved" }; } }, now });
  assert.equal(reverted.success, false);
  assert.equal(reverted.executable, false);
  const unavailable = await simulateRequest({ intentId: "i", request, simulator: unavailableSimulator, now });
  assert.equal(unavailable.state, "SIMULATION_UNAVAILABLE");
  const errored = await simulateRequest({ intentId: "i", request, simulator: { async simulate() { throw new Error("rpc down"); } }, now });
  assert.equal(errored.state, "SIMULATION_ERROR");
  assert.equal(markStale(ok, new Date("2026-10-08T12:10:00.000Z")).state, "STALE");
});
