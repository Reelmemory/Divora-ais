import { createPublicClient, http } from "viem";
import { createOpenSeaProvider } from "../packages/market/dist/index.js";
import { simulateOrderStatus } from "../packages/tx/dist/index.js";

const provider = createOpenSeaProvider({ apiKey: process.env.OPENSEA_API_KEY, chain: "robinhood" });
const listings = await provider.getListings({ chain: "robinhood", collectionSlug: process.env.OPENSEA_COLLECTION ?? "hood-survivors-nft", limit: 1 });
const listing = listings.data?.[0] ?? null;
const rpcUrl = process.env.ROBINHOOD_RPC_URL ?? "https://rpc.mainnet.chain.robinhood.com";
const client = createPublicClient({ transport: http(rpcUrl) });
let chainId = null;
let simulation = null;
try {
  chainId = await client.getChainId();
  if (listing?.id) {
    simulation = await simulateOrderStatus({ client, chainId, orderHash: listing.id, expectedChainId: 4663 });
  }
} catch (error) {
  simulation = { state: "SIMULATION_ERROR", revertReason: error instanceof Error ? error.message : "rpc error", executable: false, broadcast: false };
}
console.log(JSON.stringify({
  openSea: { state: listings.state, error: listings.error, count: listings.data?.length ?? 0, currency: listing?.currency ?? null, price: listing?.price ?? null, protocol: listing?.protocolAddress ?? null },
  rpc: { url: rpcUrl, chainId, simulation },
  fulfillment: "not-called",
  executable: false,
}, null, 2));
if (!process.env.OPENSEA_API_KEY) process.exit(2);
if (listings.state !== "AVAILABLE" || chainId !== 4663 || simulation?.state !== "SIMULATED_SUCCESS") process.exit(1);
