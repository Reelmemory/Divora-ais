import { evaluateObservation } from "../packages/opportunities/dist/index.js";
import { createHealthServer } from "../apps/terminal/dist/server.js";

const now = new Date("2026-10-08T12:00:00.000Z");
const contract = "0x1111111111111111111111111111111111111111";
const items = [
  evaluateObservation({
    chainId: 4663,
    chainKey: "robinhood",
    contract,
    tokenId: "1",
    collectionName: "Fixture",
    metadataPresent: true,
    observedPrice: "40",
    referencePrice: "100",
    transferCount: 1,
    observedAt: "2026-10-08T11:55:00.000Z",
    source: "api-fixture",
  }, {}, now),
  evaluateObservation({
    chainId: 4663,
    chainKey: "robinhood",
    contract,
    tokenId: "2",
    collectionName: "Fixture",
    metadataPresent: true,
    transferCount: 8,
    priorTransferCount: 1,
    observedAt: "2026-10-08T11:55:00.000Z",
    source: "api-fixture",
  }, {}, now),
];

const server = createHealthServer({ opportunities: items });
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
const port = typeof address === "object" && address ? address.port : 0;
const base = `http://127.0.0.1:${port}`;
const all = await fetch(`${base}/opportunities`).then((response) => response.json());
const filtered = await fetch(`${base}/opportunities?strategy=ACTIVITY_SPIKE&chain=4663&collection=${contract}&minScore=10&status=VALID`).then((response) => response.json());
const one = await fetch(`${base}/opportunities/${encodeURIComponent(items[0].id)}`).then((response) => response.json());
server.close();

const ok = all.items.length === 2 && filtered.items.length === 1 && one.item.id === items[0].id && one.execution === "disabled";
console.log(JSON.stringify({ ok, all: all.items.length, filtered: filtered.items.length, id: one.item?.id, execution: one.execution }, null, 2));
if (!ok) process.exit(1);
