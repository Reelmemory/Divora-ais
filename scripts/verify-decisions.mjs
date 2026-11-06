import { evaluateObservation } from "../packages/opportunities/dist/index.js";
import { decide } from "../packages/policy/dist/index.js";
import { createHealthServer } from "../apps/terminal/dist/server.js";

const now = new Date("2026-10-08T12:00:00.000Z");
const contract = "0x1111111111111111111111111111111111111111";
const opportunity = evaluateObservation({
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
  source: "api-fixture",
}, {}, now);
const decision = decide(opportunity, {
  maxTradeValue: "100",
  maxDailySpend: "200",
  maxGas: "1",
  maxSlippageBps: 100,
  allowedChains: [4663],
  allowedCollections: [contract],
  allowedMarketplaces: ["fixture"],
  allowedStrategies: ["MISPRICED_NFT"],
  minOpportunityScore: 50,
  minConfidence: 50,
  buyMinScore: 50,
  buyMinConfidence: 50,
  watchMinScore: 25,
}, { tradeValue: "40", gas: "0.2", slippageBps: 50, marketplace: "fixture" }, now);
const server = createHealthServer({ decisions: [decision] });
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
const port = typeof address === "object" && address ? address.port : 0;
const filtered = await fetch(`http://127.0.0.1:${port}/decisions?action=BUY&riskLevel=LOW&strategy=MISPRICED_NFT&collection=${contract}&minConfidence=50&status=ANALYTICAL`).then((response) => response.json());
const one = await fetch(`http://127.0.0.1:${port}/decisions/${encodeURIComponent(decision.id)}`).then((response) => response.json());
server.close();
const ok = filtered.items.length === 1 && one.item.action === "BUY" && one.execution === "disabled" && one.analytical === true;
console.log(JSON.stringify({ ok, action: one.item?.action, execution: one.execution }, null, 2));
if (!ok) process.exit(1);
