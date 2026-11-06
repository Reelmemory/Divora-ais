import assert from "node:assert/strict";
import test from "node:test";
import {
  activitySignal,
  evaluateObservation,
  filterOpportunities,
  liquiditySignal,
  priceSignal,
  scoreSignals,
  smartMoneySignal,
  upsertOpportunity,
} from "../dist/index.js";

const contract = "0x1111111111111111111111111111111111111111";
const now = new Date("2026-10-08T12:00:00.000Z");

function observation(overrides = {}) {
  return {
    chainId: 4663,
    chainKey: "robinhood",
    contract,
    tokenId: "29",
    collectionName: "Sample",
    metadataPresent: true,
    transferCount: 1,
    observedAt: "2026-10-08T11:55:00.000Z",
    source: "fixture",
    ...overrides,
  };
}

test("price signal uses only collected prices", () => {
  const missing = priceSignal(observation());
  assert.equal(missing.applicable, false);
  assert.equal(missing.code, "PRICE_MISSING");
  const below = priceSignal(observation({ observedPrice: "70", referencePrice: "100" }));
  assert.equal(below.code, "BELOW_REFERENCE");
  assert.equal(below.score, 30);
});

test("activity signal detects a spike from prior observations", () => {
  const quiet = activitySignal(observation({ transferCount: 0 }));
  assert.equal(quiet.applicable, false);
  const spike = activitySignal(observation({ transferCount: 8, priorTransferCount: 2 }));
  assert.equal(spike.code, "ACTIVITY_SPIKE");
  assert.ok(spike.score > 0 && spike.score <= 100);
});

test("smart-money signal ignores addresses that are not on the watchlist", () => {
  const empty = smartMoneySignal(observation({ involvedWallets: ["0xabc"] }), []);
  assert.equal(empty.code, "WATCHLIST_EMPTY");
  const miss = smartMoneySignal(observation({ involvedWallets: ["0xabc"] }), ["0xdef"]);
  assert.equal(miss.applicable, false);
  const hit = smartMoneySignal(observation({ involvedWallets: ["0xAbC"] }), ["0xabc"]);
  assert.equal(hit.code, "WATCHLIST_HIT");
});

test("liquidity signal does not invent listings", () => {
  const missing = liquiditySignal(observation());
  assert.equal(missing.applicable, false);
  const thin = liquiditySignal(observation({ listingCount: 0, uniqueCounterparties: 1 }));
  assert.equal(thin.code, "THIN_ACTIVITY");
});

test("score is bounded and explained", () => {
  const signals = [
    priceSignal(observation({ observedPrice: "50", referencePrice: "100" })),
    activitySignal(observation({ transferCount: 10, priorTransferCount: 2 })),
    smartMoneySignal(observation({ involvedWallets: ["0xabc"] }), ["0xabc"]),
    liquiditySignal(observation({ listingCount: 2, uniqueCounterparties: 4 })),
  ];
  const scored = scoreSignals(signals);
  assert.ok(scored.total !== null && scored.total >= 0 && scored.total <= 100);
  assert.ok(scored.explanation.contributions.length >= 3);
});

test("insufficient data is not given a fake score", () => {
  const result = evaluateObservation(observation({ transferCount: 0 }), {}, now);
  assert.equal(result.status, "INSUFFICIENT_DATA");
  assert.equal(result.score, null);
  assert.equal(result.analysis.recommendation, "ignore");
});

test("stale and conflicting observations are marked", () => {
  const stale = evaluateObservation(observation({ transferCount: 6 }), {}, new Date("2026-10-08T13:00:00.000Z"));
  assert.equal(stale.status, "STALE");
  const conflict = evaluateObservation(
    observation({ observedPrice: "10", referencePrice: "100", conflictingPrices: ["90"], transferCount: 2 }),
    {},
    now,
  );
  assert.equal(conflict.status, "INVALIDATED");
  assert.equal(conflict.score, null);
});

test("strategy follows the strongest applicable signal", () => {
  const mispriced = evaluateObservation(
    observation({ observedPrice: "40", referencePrice: "100", transferCount: 1 }),
    {},
    now,
  );
  assert.equal(mispriced.strategy, "MISPRICED_NFT");
  const spike = evaluateObservation(observation({ transferCount: 9, priorTransferCount: 1 }), {}, now);
  assert.equal(spike.strategy, "ACTIVITY_SPIKE");
  const smart = evaluateObservation(
    observation({ transferCount: 1, involvedWallets: ["0xabc"] }),
    { watchlist: ["0xabc"] },
    now,
  );
  assert.equal(smart.strategy, "SMART_MONEY_ACTIVITY");
});

test("upsert keeps the identity and filtering works", () => {
  const created = evaluateObservation(observation({ transferCount: 8, priorTransferCount: 1 }), {}, now);
  const updated = upsertOpportunity(created, evaluateObservation(observation({ transferCount: 9, priorTransferCount: 1, tokenId: "29" }), {}, now));
  assert.equal(updated.id, created.id);
  const filtered = filterOpportunities([created, updated], { strategy: "ACTIVITY_SPIKE", chainId: 4663, minScore: 10, status: "VALID", collection: contract });
  assert.equal(filtered.length, 2);
  assert.equal(filterOpportunities([created], { minScore: 100 }).length, 0);
});
