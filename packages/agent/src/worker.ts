import { PrismaClient } from "@prisma/client";
import { createPublicClient, http } from "viem";
import {
  PrismaOpportunityStore,
  type ConstitutionConfig,
  type NormalizedListing,
  type ProviderResult,
} from "@divora/shared";
import {
  createOpenSeaProvider,
  PrismaListingStore,
  runListingPipeline,
} from "@divora/market";
import { PrismaTransactionStore } from "@divora/tx";

export interface AgentWorkerOptions {
  intervalMs?: number;
  maxTicks?: number;
  /** Optional single-collection filter; omit for market-wide multi-collection discovery */
  collectionSlug?: string;
  /** Optional list of collection slugs to scan */
  collectionSlugs?: string[];
  /** Number of collections to scan per market-wide tick */
  maxCollections?: number;
  chain?: string;
  chainId?: number;
  apiKey?: string;
  rpcUrl?: string;
  buyer?: `0x${string}`;
  allowSyntheticFallback?: boolean;
}

export const defaultAgentConstitution: ConstitutionConfig = {
  maxTradeValue: "2000000000000000000", // 2 ETH
  maxDailySpend: "5000000000000000000", // 5 ETH
  maxGas: "300000",
  maxSlippageBps: 250,
  allowedChains: [4663],
  allowedCollections: ["*"], // Market-wide multi-collection discovery by default
  blockedCollections: [],
  allowedMarketplaces: ["opensea"],
  allowedStrategies: [
    "MISPRICED_NFT",
    "SMART_MONEY_ACTIVITY",
    "ACTIVITY_SPIKE",
    "COLLECTION_MOMENTUM",
  ],
  minOpportunityScore: 20,
  minConfidence: 20,
  buyMinScore: 30,
  buyMinConfidence: 25,
  watchMinScore: 15,
};

export async function runAgentWorker(options: AgentWorkerOptions = {}) {
  const prisma = new PrismaClient();
  const listingStore = new PrismaListingStore(prisma);
  const opportunityStore = new PrismaOpportunityStore(prisma);
  const txStore = new PrismaTransactionStore(prisma);

  const env = (globalThis as any).process?.env ?? {};
  const apiKey = options.apiKey ?? env.OPENSEA_API_KEY;
  const chain = options.chain ?? env.DIVORA_CHAIN ?? "robinhood";
  const chainId = options.chainId ?? Number(env.DIVORA_CHAIN_ID ?? 4663);
  const rpcUrl = options.rpcUrl ?? env.ROBINHOOD_RPC_URL ?? "https://rpc.mainnet.chain.robinhood.com";
  const buyer = (options.buyer ?? env.FULFILLER_ADDRESS) as `0x${string}` | undefined;
  const intervalMs = options.intervalMs ?? Number(env.AGENT_POLL_INTERVAL_MS ?? 10_000);
  const maxTicks = options.maxTicks ?? (env.AGENT_MAX_TICKS ? Number(env.AGENT_MAX_TICKS) : undefined);

  // Strictly disable synthetic fallback in production; fail closed when provider is unavailable or empty.
  const allowSynthetic = options.allowSyntheticFallback ?? false;

  const provider = createOpenSeaProvider({
    apiKey,
    chain,
    chainId,
  });

  const publicClient = createPublicClient({
    transport: http(rpcUrl),
  });

  let tick = 0;

  try {
    while (maxTicks === undefined || tick < maxTicks) {
      tick++;
      const now = new Date();
      console.log(`\n[Agent Worker] Tick #${tick} at ${now.toISOString()}`);

      const optionalSlugFilter = options.collectionSlug || env.OPENSEA_COLLECTION_SLUG || undefined;
      const providerResult: ProviderResult<NormalizedListing[]> = await provider.getListings({
        chain,
        collectionSlug: optionalSlugFilter,
        collectionSlugs: options.collectionSlugs,
        maxCollections: options.maxCollections ?? 6,
        limit: 20,
      });

      if (providerResult.state !== "AVAILABLE" || !providerResult.data || providerResult.data.length === 0) {
        console.log(
          `[Agent Worker] Provider state=${providerResult.state} (listings=${providerResult.data?.length ?? 0}). Failing closed (allowSyntheticFallback=${allowSynthetic}).`
        );
      }

      const result = await runListingPipeline({
        provider: providerResult,
        store: listingStore,
        opportunityStore,
        txStore,
        publicClient,
        openSeaApiKey: apiKey,
        chainSlug: chain,
        config: defaultAgentConstitution,
        buyer,
        spender: "0x0000000000000068f116a894984e2db1123eb395",
        maxPrice: "1500000000000000000",
        slippageBps: 100,
        estimatedGas: "200000",
        now,
      });

      console.log(
        `[Agent Worker] Stage=${result.stage} | Collections=${result.cohorts.length} | Snapshots=${result.persisted} | Opps=${result.opportunities.length} | Decisions=${result.decisions.map((d) => d.action).join(",") || "none"} | Sim=${result.simulation.state}`
      );

      if (maxTicks !== undefined && tick >= maxTicks) break;
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  } finally {
    await prisma.$disconnect();
  }
}

const isDirectRun = Boolean(
  (globalThis as any).process?.argv?.[1]?.replace(/\\/g, "/").endsWith("worker.ts") ||
  (globalThis as any).process?.argv?.[1]?.replace(/\\/g, "/").endsWith("worker.js")
);

if (isDirectRun) {
  const maxTicksArg = (globalThis as any).process?.argv?.find((a: string) => a.startsWith("--ticks="));
  const maxTicks = maxTicksArg ? Number(maxTicksArg.split("=")[1]) : undefined;
  runAgentWorker({ maxTicks }).catch((err) => {
    console.error("[Agent Worker] Fatal error:", err);
    (globalThis as any).process?.exit(1);
  });
}
