import { createOpenSeaProvider } from "../packages/market/dist/index.js";

const provider = createOpenSeaProvider({ apiKey: process.env.OPENSEA_API_KEY, baseUrl: process.env.OPENSEA_API_BASE, chain: process.env.OPENSEA_CHAIN ?? "robinhood" });
const result = await provider.getListings({ chain: process.env.OPENSEA_CHAIN ?? "robinhood", collectionSlug: process.env.OPENSEA_COLLECTION ?? "hood-survivors-nft", limit: 1 });
console.log(JSON.stringify({ state: result.state, error: result.error, count: result.data?.length ?? 0, samplePrice: result.data?.[0]?.price ?? null, fulfillmentVerified: false }, null, 2));
if (!process.env.OPENSEA_API_KEY) process.exit(2);
if (result.state !== "AVAILABLE") process.exit(1);
