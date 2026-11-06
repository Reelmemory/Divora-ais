import { createPublicClient, http } from "viem";
import { createOpenSeaProvider, orderFromListing, prepareBuyOrder, runListingPipeline } from "../packages/market/dist/index.js";
import { inspectErc20PaymentReadiness, simulateFulfillmentBuy, simulateOrderStatus } from "../packages/tx/dist/index.js";

const provider = createOpenSeaProvider({ apiKey: process.env.OPENSEA_API_KEY, chain: "robinhood" });
const collectionSlug = process.env.OPENSEA_COLLECTION ?? "onlyhoodpixel";
const listings = await provider.getListings({ chain: "robinhood", collectionSlug, limit: 5 });
const first = listings.data?.[0] ?? null;

const config = {
  maxTradeValue: "1000000000000000000",
  maxDailySpend: "1000000000000000000",
  maxGas: "500000",
  maxSlippageBps: 100,
  allowedChains: [4663],
  allowedCollections: first?.contractAddress ? [first.contractAddress] : [],
  allowedMarketplaces: ["opensea"],
  allowedStrategies: ["MISPRICED_NFT", "FLOOR_DISCOUNT", "LIQUIDITY_SPREAD"],
  minOpportunityScore: 1,
  minConfidence: 1,
  buyMinScore: 50,
  buyMinConfidence: 50,
  watchMinScore: 10,
};

const buyer = process.env.FULFILLER_ADDRESS ?? undefined;
const pipeline = await runListingPipeline({
  provider: listings,
  config,
  buyer,
  maxPrice: first?.price ?? "0",
  slippageBps: 50,
  estimatedGas: "150000",
});

let fulfillment = null;
if (first && buyer) {
  const order = orderFromListing(first, {
    buyer,
    maxPrice: first.price,
    slippageBps: 50,
    estimatedGas: "150000",
    feesBps: first.feeBps ?? null,
  });
  if (order) {
    fulfillment = await prepareBuyOrder({
      order,
      config,
      apiKey: process.env.OPENSEA_API_KEY,
      chain: "robinhood",
    });
  }
}

const rpcUrl = process.env.ROBINHOOD_RPC_URL ?? "https://rpc.mainnet.chain.robinhood.com";
const client = createPublicClient({ transport: http(rpcUrl) });
let chainId = null;
let orderStatusSim = null;
let buySimulation = null;
let erc20Inspection = null;

try {
  chainId = await client.getChainId();
  if (first?.id && /^0x[0-9a-fA-F]{64}$/.test(first.id)) {
    orderStatusSim = await simulateOrderStatus({ client, chainId, orderHash: first.id, expectedChainId: 4663 });
  }
  if (fulfillment && buyer) {
    buySimulation = await simulateFulfillmentBuy({ client, chainId, buyer, fulfillment });
  }
  const usdgListing = listings.data?.find((l) => l.currency === "USDG") ?? null;
  if (usdgListing?.paymentToken) {
    erc20Inspection = await inspectErc20PaymentReadiness({
      client,
      chainId,
      token: usdgListing.paymentToken,
      requiredAmount: usdgListing.price,
      buyer: buyer ?? null,
      spender: null,
    });
  }
} catch (error) {
  orderStatusSim = { state: "SIMULATION_ERROR", revertReason: error instanceof Error ? error.message : "rpc error", executable: false };
}

console.log(JSON.stringify({
  openSea: {
    state: listings.state,
    count: listings.data?.length ?? 0,
    topSample: first ? { id: first.id, currency: first.currency, price: first.price, feeBps: first.feeBps } : null,
  },
  pipeline: {
    stage: pipeline.stage,
    topRanked: pipeline.rankedListings[0] ?? null,
    topApprovalPlan: pipeline.approvals[0]?.plan ?? null,
    topReadiness: pipeline.readiness[0]?.status ?? null,
  },
  preparedFulfillment: fulfillment ? { ...fulfillment, basicOrderParameters: fulfillment.basicOrderParameters ? "present" : null } : null,
  rpc: {
    chainId,
    orderStatusSim,
    buySimulation,
    erc20Inspection,
  },
  executable: false,
  signed: false,
  broadcast: false,
}, null, 2));
