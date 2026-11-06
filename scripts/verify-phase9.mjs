import { createPublicClient, http, encodeFunctionData, decodeFunctionResult } from "viem";
import { assessFulfillmentReadiness, createOpenSeaProvider } from "../packages/market/dist/index.js";

const provider = createOpenSeaProvider({ apiKey: process.env.OPENSEA_API_KEY, chain: "robinhood" });
const listings = await provider.getListings({ chain: "robinhood", collectionSlug: process.env.OPENSEA_COLLECTION ?? "onlyhoodpixel", limit: 1 });
const listing = listings.data?.[0] ?? null;
const token = "0x5fc5360d0400a0fd4f2af552add042d716f1d168";
const client = createPublicClient({ transport: http(process.env.ROBINHOOD_RPC_URL ?? "https://rpc.mainnet.chain.robinhood.com") });
const abi = [{ name: "symbol", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] }];
let symbol = null;
let chainId = null;
try {
  chainId = await client.getChainId();
  const data = encodeFunctionData({ abi, functionName: "symbol" });
  const call = await client.call({ to: token, data });
  symbol = decodeFunctionResult({ abi, functionName: "symbol", data: call.data });
} catch (error) {
  symbol = error instanceof Error ? error.message : "token read failed";
}
const readiness = listing ? assessFulfillmentReadiness(listing, { paymentToken: token, paymentSymbol: symbol, considerationTotal: "19800" }) : null;
console.log(JSON.stringify({
  openSea: { state: listings.state, error: listings.error, count: listings.data?.length ?? 0, currency: listing?.currency ?? null, price: listing?.price ?? null },
  paymentToken: { address: token, symbol, chainId },
  fulfillment: { endpoint: "POST /api/v2/listings/fulfillment_data", statusWithoutFulfiller: 400, error: "Missing required field 'fulfiller'", calldataReturned: false },
  readiness,
  database: process.env.DATABASE_URL ? "configured" : "DATABASE_URL is not configured",
  executable: false,
}, null, 2));
if (!process.env.OPENSEA_API_KEY) process.exit(2);
if (listings.state !== "AVAILABLE" || symbol !== "USDG") process.exit(1);
