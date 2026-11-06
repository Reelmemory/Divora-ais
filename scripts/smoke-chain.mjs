import { robinhood, robinhoodTestnet } from "../packages/chains/dist/index.js";

const rpcUrl = process.env.ROBINHOOD_RPC_URL || process.env.ROBINHOOD_TESTNET_RPC_URL;
const expectedRaw = process.env.ROBINHOOD_CHAIN_ID;

if (!rpcUrl) {
  console.error("SMOKE_SKIPPED: set ROBINHOOD_RPC_URL or ROBINHOOD_TESTNET_RPC_URL");
  process.exit(2);
}

const expectedChainId = Number(expectedRaw ?? (rpcUrl.includes("testnet") ? 46630 : 4663));
const adapter = expectedChainId === 46630 ? robinhoodTestnet : robinhood;

if (adapter.config.chainId !== expectedChainId) {
  console.error(`SMOKE_FAIL: adapter chain id ${adapter.config.chainId} != expected ${expectedChainId}`);
  process.exit(1);
}

const [chainId, blockNumber, gasPrice] = await Promise.all([
  adapter.getChainId(rpcUrl),
  adapter.getBlockNumber(rpcUrl),
  adapter.getGasPrice(rpcUrl),
]);

if (chainId !== expectedChainId) {
  console.error(`SMOKE_FAIL: rpc chain id ${chainId} != expected ${expectedChainId}`);
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  chain: adapter.config.name,
  rpcUrl,
  chainId,
  blockNumber: blockNumber.toString(),
  gasPrice: gasPrice.toString(),
  seaport: adapter.config.seaportAddress,
  privateKeyUsed: false,
}, null, 2));
