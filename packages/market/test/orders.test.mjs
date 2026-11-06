import assert from "node:assert/strict";
import test from "node:test";
import { orderFromListing, prepareBuyOrder, validateOrder } from "../dist/index.js";

const now = new Date("2026-10-08T12:00:00.000Z");
const contract = "0x2222222222222222222222222222222222222222";
const buyer = "0x3333333333333333333333333333333333333333";
const config = {
  maxTradeValue: "1000", maxDailySpend: "1000", maxGas: "1", maxSlippageBps: 100,
  allowedChains: [4663], allowedCollections: [contract], allowedMarketplaces: ["opensea"],
  allowedStrategies: ["MISPRICED_NFT"], minOpportunityScore: 1, minConfidence: 1,
  buyMinScore: 1, buyMinConfidence: 1, watchMinScore: 1,
};
const order = {
  chainId: 4663, marketplace: "opensea", orderHash: "0xabc",
  protocolAddress: "0x0000000000000068f116a894984e2db1123eb395",
  contract, tokenId: "29", seller: "0x1111111111111111111111111111111111111111",
  price: "10", currency: null, expiresAt: "2026-10-08T12:10:00.000Z", observedAt: now.toISOString(),
  freshness: "AVAILABLE", feesBps: 250, buyer, maxPrice: "12", slippageBps: 50, estimatedGas: "0.2",
};

test("validates structured orders and rejects unsafe inputs", () => {
  assert.equal(validateOrder(order, config, now).valid, true);
  assert.ok(validateOrder({ ...order, chainId: 1 }, config, now).violations.includes("CHAIN_NOT_ALLOWED"));
  assert.ok(validateOrder({ ...order, marketplace: "hood" }, config, now).violations.includes("MARKETPLACE_NOT_ALLOWED"));
  assert.ok(validateOrder({ ...order, freshness: "STALE" }, config, now).violations.includes("LISTING_STALE"));
  assert.ok(validateOrder({ ...order, price: "1.5" }, config, now).violations.includes("PRICE_UNITS_INVALID"));
  assert.ok(validateOrder({ ...order, price: "20" }, config, now).violations.includes("PRICE_CHANGED"));
  assert.ok(validateOrder({ ...order, currency: "USDC" }, config, now).violations.includes("CURRENCY_NOT_SUPPORTED"));
  assert.ok(validateOrder({ ...order, seller: null }, config, now).violations.includes("REQUIRED_FIELDS_MISSING"));
  assert.ok(validateOrder(order, { ...config, maxTradeValue: null }, now).violations.includes("TRADE_VALUE_EXCEEDED"));
  assert.equal(orderFromListing({ id: "0xabc", chainId: 4663, marketplace: "opensea", collection: null, contractAddress: null, tokenId: "1", seller: null, price: "1", currency: null, expiresAt: null, source: "opensea", observedAt: now.toISOString(), freshness: "AVAILABLE" }, { buyer, maxPrice: "1", slippageBps: 1, estimatedGas: "1" }), null);
});

test("fulfillment preparation never signs or broadcasts and rejects malformed provider data", async () => {
  const missing = await prepareBuyOrder({ order, config, now });
  assert.equal(missing.violations.includes("OPENSEA_API_KEY_MISSING"), true);
  assert.equal(missing.executable, false);
  assert.equal(missing.signed, false);
  assert.equal(missing.broadcast, false);
  const ok = await prepareBuyOrder({
    order, config, apiKey: "test", now,
    fetchImpl: async () => new Response(JSON.stringify({ protocol: "seaport", fulfillment_data: { transaction: { function: "fulfillBasicOrder", chain: 4663, to: order.protocolAddress, value: "10", input_data: { ignored: true } }, orders: [] } }), { status: 200 }),
  });
  assert.equal(ok.source, "opensea-fulfillment_data");
  assert.equal(ok.executable, false);
  assert.equal(ok.signed, false);
  assert.equal("calldata" in ok, false);
  const malformed = await prepareBuyOrder({ order, config, apiKey: "test", now, fetchImpl: async () => new Response(JSON.stringify({ nope: true }), { status: 200 }) });
  assert.ok(malformed.violations.includes("MALFORMED_FULFILLMENT"));
  const failed = await prepareBuyOrder({ order, config, apiKey: "test", now, fetchImpl: async () => new Response("no", { status: 500 }) });
  assert.ok(failed.violations.includes("PROVIDER_STATUS_500"));
});
