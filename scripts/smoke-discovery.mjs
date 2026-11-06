import { robinhood } from "../packages/chains/dist/index.js";
import { loadDiscoveryState, runDiscoveryTick, saveDiscoveryState } from "../packages/nft/dist/index.js";

const rpcUrl = process.env.ROBINHOOD_RPC_URL;
const statePath = process.env.DISCOVERY_STATE_PATH ?? "data/discovery-state.json";
const maxBlockSpan = Number(process.env.DISCOVERY_MAX_BLOCK_SPAN ?? 50);

if (!rpcUrl) {
  console.error("SMOKE_SKIPPED: set ROBINHOOD_RPC_URL");
  process.exit(2);
}

const previous = await loadDiscoveryState(statePath);
const result = await runDiscoveryTick(robinhood, {
  rpcUrl,
  maxBlockSpan,
  chunkSize: 25,
  maxContracts: 5,
  maxMetadataReads: 2,
  state: previous,
});
await saveDiscoveryState(statePath, result.state);
const reloaded = await loadDiscoveryState(statePath);

const span = BigInt(result.toBlock) - BigInt(result.fromBlock);
const ok =
  result.chainId === 4663 &&
  result.bounded === true &&
  span <= BigInt(maxBlockSpan) &&
  reloaded?.lastScannedBlock === result.state.lastScannedBlock &&
  Array.isArray(result.assets);

if (!ok) {
  console.error(JSON.stringify({ ok: false, result }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  chainId: result.chainId,
  fromBlock: result.fromBlock,
  toBlock: result.toBlock,
  logsSeen: result.logsSeen,
  collections: result.collections.length,
  assets: result.assets.length,
  erc721: result.collections.filter((item) => item.erc721).length,
  sampleTokenId: result.assets[0]?.tokenId ?? null,
  statePath,
  privateKeyUsed: false,
}, null, 2));
