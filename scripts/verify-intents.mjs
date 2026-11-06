import { evaluateObservation } from "../packages/opportunities/dist/index.js";
import { decide } from "../packages/policy/dist/index.js";
import { createHealthServer } from "../apps/terminal/dist/server.js";

const now = new Date();
const contract = "0x1111111111111111111111111111111111111111";
const constitution = {
  maxTradeValue: "100", maxDailySpend: "200", maxGas: "1", maxSlippageBps: 100,
  allowedChains: [4663], allowedCollections: [contract], allowedMarketplaces: ["fixture"],
  allowedStrategies: ["MISPRICED_NFT"], minOpportunityScore: 10, minConfidence: 10,
  buyMinScore: 10, buyMinConfidence: 10, watchMinScore: 1,
};
const opportunity = evaluateObservation({
  chainId: 4663, chainKey: "robinhood", contract, tokenId: "29", collectionName: "Fixture", metadataPresent: true,
  observedPrice: "10", referencePrice: "100", transferCount: 6, priorTransferCount: 5, listingCount: 1, uniqueCounterparties: 2,
  observedAt: now.toISOString(), source: "api-fixture",
}, {}, now);
const decision = decide(opportunity, constitution, { tradeValue: "12", gas: "0.2", slippageBps: 50, marketplace: "fixture" }, now);
const server = createHealthServer({
  opportunities: [opportunity],
  decisions: [decision],
  constitution,
  simulator: { async simulate() { return { state: "SIMULATED_REVERT", revertReason: "price moved" }; } },
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
const port = typeof address === "object" && address ? address.port : 0;
const base = `http://127.0.0.1:${port}`;
const created = await fetch(`${base}/transaction-intents`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ decisionId: decision.id, expectedPrice: "10", maxPrice: "12", estimatedGas: "0.2", slippageBps: 50, marketplace: "fixture" }) }).then((response) => response.json());
const denied = await fetch(`${base}/transaction-intents`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ decisionId: "missing", expectedPrice: "10", maxPrice: "12", estimatedGas: "0.2", slippageBps: 50, marketplace: "fixture" }) }).then((response) => response.json());
const simulated = await fetch(`${base}/transaction-intents/${created.intent.id}/simulate`, { method: "POST" }).then((response) => response.json());
const listed = await fetch(`${base}/transaction-intents`).then((response) => response.json());
const loaded = await fetch(`${base}/simulations/${simulated.result.id}`).then((response) => response.json());
server.close();
const ok = created.intent.executable === false && denied.created === false && simulated.result.state === "SIMULATED_REVERT" && simulated.result.executable === false && listed.items.length === 1 && loaded.item.state === "SIMULATED_REVERT";
console.log(JSON.stringify({ ok, state: simulated.result?.state, executable: simulated.result?.executable }, null, 2));
if (!ok) process.exit(1);
