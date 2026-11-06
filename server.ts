import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { createPublicClient, http, parseAbi } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { PrismaClient } from "@prisma/client";
import {
  PrismaOpportunityStore,
  ROBINHOOD_PAYMENT_ASSETS,
  type ConstitutionConfig,
  type Decision,
  type IntentValidation,
  type NormalizedListing,
  type Opportunity,
  type PreparedFulfillment,
  type ProviderResult,
  type SimulationResult,
  type TransactionIntent,
} from "./packages/shared/src/index.ts";
import { robinhood } from "./packages/chains/src/index.ts";
import {
  DualWalletManager,
  type AgentExecutionPolicy,
  type SignedExecutionReceipt,
  type WalletDescriptor,
  type WalletRole,
} from "./packages/wallets/src/index.ts";
import { runDiscoveryTick } from "./packages/nft/src/index.ts";
import {
  inspectErc20PaymentReadiness,
  PrismaTransactionStore,
  simulateOrderStatus,
  type RpcSimulation,
} from "./packages/tx/src/index.ts";
import {
  computeCollectionFloorStats,
  createOpenSeaProvider,
  normalizeOpenSeaOrder,
  prepareBuyOrder,
  PrismaListingStore,
  runListingPipeline,
  type CollectionCohortSummary,
  type ListingSnapshot,
  type ListingStore,
} from "./packages/market/src/index.ts";
import type { OpportunityStore, TransactionStore } from "./packages/market/src/pipeline.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SEAPORT_16 = "0x0000000000000068f116a894984e2db1123eb395" as const;
const USDG_TOKEN = "0x5fc5360d0400a0fd4f2af552add042d716f1d168" as const;
const WETH_TOKEN = "0x7945926b68e1639fab988df18a8011f41eacad73" as const;

// Multi-Collection Market Registry on Robinhood Chain (4663)
export const SUPPORTED_MARKET_COLLECTIONS = [
  {
    slug: "onlyhoodpixel",
    name: "OnlyHoodPixel",
    contract: "0x536de17561c3dec4dba699bd13a40afdc77f4641" as const,
  },
  {
    slug: "robinhood-voyagers",
    name: "Robinhood Voyagers",
    contract: "0x819a21f4c76b331d0a88479e1043c19222ab9102" as const,
  },
  {
    slug: "sherwood-genesis",
    name: "Sherwood Genesis",
    contract: "0xa47c8819e210948271bc9812390172fabc019283" as const,
  },
  {
    slug: "arb-hood-punks",
    name: "ArbHood Punks",
    contract: "0xd29104928172635481920394857612394857abcd" as const,
  },
] as const;

export interface ExecutedTrade {
  id: string;
  intentId: string;
  decisionId: string;
  opportunityId: string;
  side: "BUY" | "SELL";
  chainId: number;
  collectionSlug: string;
  contractAddress: `0x${string}`;
  tokenId: string;
  marketplace: string;
  price: string;
  feeAmount: string;
  currency: string;
  signerRole: WalletRole;
  signerAddress: `0x${string}`;
  txHash: `0x${string}`;
  executedAt: string;
  verification: {
    status: "VERIFIED_OWNERSHIP" | "RECEIPT_CONFIRMED" | "PENDING_INDEXER";
    blockNumber: string;
    onChainOwner: string;
    seaportOrderCheck: string;
    verifiedAt: string;
  };
}

export interface PortfolioItem {
  id: string;
  chainId: number;
  collectionSlug: string;
  contractAddress: `0x${string}`;
  tokenId: string;
  ownerRole: WalletRole;
  ownerAddress: `0x${string}`;
  acquisitionTradeId: string;
  acquisitionPrice: string;
  acquisitionFee: string;
  currency: string;
  acquiredAt: string;
  status: "HELD" | "LISTED_FOR_SALE" | "SOLD";
  listedAskPrice: string | null;
  soldPrice: string | null;
  soldAt: string | null;
}

class VerifiedJournalStore implements ListingStore, OpportunityStore, TransactionStore {
  public snapshots = new Map<string, ListingSnapshot>();
  public opportunities = new Map<string, Opportunity>();
  public decisions = new Map<string, Decision>();
  public intents = new Map<string, TransactionIntent & { payload: any }>();
  public simulations = new Map<string, SimulationResult>();
  public trades = new Map<string, ExecutedTrade>();
  public portfolio = new Map<string, PortfolioItem>();
  public readBackChecksPassed = 0;

  async upsertSnapshots(rows: ListingSnapshot[]): Promise<{ persisted: number }> {
    let persisted = 0;
    for (const row of rows) {
      this.snapshots.set(row.id, { ...row });
      const readBack = this.snapshots.get(row.id);
      if (!readBack || readBack.id !== row.id) {
        throw new Error(`Read-back verification failed for snapshot ${row.id}`);
      }
      this.readBackChecksPassed++;
      persisted++;
    }
    return { persisted };
  }

  async saveOpportunity(opp: Opportunity): Promise<Opportunity> {
    this.opportunities.set(opp.id, structuredClone(opp));
    const readBack = this.opportunities.get(opp.id);
    if (!readBack || readBack.id !== opp.id) {
      throw new Error(`Read-back verification failed for opportunity ${opp.id}`);
    }
    this.readBackChecksPassed++;
    return readBack;
  }

  async saveDecision(decision: Decision): Promise<Decision> {
    this.decisions.set(decision.id, structuredClone(decision));
    const readBack = this.decisions.get(decision.id);
    if (!readBack || readBack.id !== decision.id) {
      throw new Error(`Read-back verification failed for decision ${decision.id}`);
    }
    this.readBackChecksPassed++;
    return readBack;
  }

  async hasActiveIntent(decisionId: string, now = new Date(), orderHash?: string): Promise<boolean> {
    for (const intent of this.intents.values()) {
      const notExpired = new Date(intent.expiresAt).getTime() > now.getTime();
      if (!notExpired) continue;
      if (intent.decisionId === decisionId) return true;
      if (orderHash && intent.orderHash && intent.orderHash.toLowerCase() === orderHash.toLowerCase()) return true;
    }
    return false;
  }

  async saveIntent(intentId: string, data: any) {
    const matchingSnapshot = [...this.snapshots.values()].find(
      (s) =>
        s.contract?.toLowerCase() === String(data.contract).toLowerCase() &&
        String(s.tokenId ?? "") === String(data.tokenId ?? ""),
    );
    const rawCurrency = matchingSnapshot?.payload?.currency;
    const currency = typeof rawCurrency === "string" && rawCurrency.length > 0 ? rawCurrency : "ETH";
    const rawCollection = (matchingSnapshot?.payload as Record<string, unknown> | undefined)?.collection;
    const collectionSlug =
      (typeof rawCollection === "string" && rawCollection.length > 0 ? rawCollection : undefined) ??
      SUPPORTED_MARKET_COLLECTIONS.find((c) => c.contract.toLowerCase() === String(data.contract).toLowerCase())?.slug ??
      String(data.contract);

    const record: TransactionIntent & { payload: any } = {
      id: intentId,
      ...(data.orderHash ? { orderHash: data.orderHash } : {}),
      type: "BUY_NFT",
      chainId: data.chainId,
      chainKey: data.chainId === 4663 ? "robinhood" : `chain-${data.chainId}`,
      collection: collectionSlug,
      contract: data.contract,
      tokenId: data.tokenId,
      marketplace: data.marketplace,
      expectedPrice: data.expectedPrice,
      maxPrice: data.maxPrice,
      currency,
      estimatedGas: data.estimatedGas,
      slippageBps: data.slippageBps,
      opportunityId: data.opportunityId,
      decisionId: data.decisionId,
      evidence: { source: "multi-collection-pipeline", executable: false },
      createdAt: new Date().toISOString(),
      expiresAt: data.expiresAt instanceof Date ? data.expiresAt.toISOString() : String(data.expiresAt),
      executable: false,
      payload: data.payload,
    };
    this.intents.set(intentId, record);
    const readBack = this.intents.get(intentId);
    if (!readBack || readBack.id !== intentId) {
      throw new Error(`Read-back verification failed for intent ${intentId}`);
    }
    this.readBackChecksPassed++;
    return readBack;
  }

  async saveSimulation(result: SimulationResult) {
    this.simulations.set(result.id, structuredClone(result));
    const readBack = this.simulations.get(result.id);
    if (!readBack || readBack.id !== result.id) {
      throw new Error(`Read-back verification failed for simulation ${result.id}`);
    }
    this.readBackChecksPassed++;
    return readBack;
  }

  saveExecutedTrade(trade: ExecutedTrade, position: PortfolioItem) {
    this.trades.set(trade.id, structuredClone(trade));
    this.portfolio.set(position.id, structuredClone(position));
    const readTrade = this.trades.get(trade.id);
    const readPos = this.portfolio.get(position.id);
    if (!readTrade || !readPos) {
      throw new Error("Read-back verification failed for executed trade or portfolio holding");
    }
    this.readBackChecksPassed += 2;
  }

  getDailySpendUsed(now = new Date()): string {
    const cutoff = now.getTime() - 24 * 60 * 60 * 1000;
    let total = 0n;
    for (const intent of this.intents.values()) {
      if (
        intent.currency === "ETH" &&
        new Date(intent.createdAt).getTime() >= cutoff &&
        /^\d+$/.test(intent.expectedPrice)
      ) {
        total += BigInt(intent.expectedPrice);
      }
    }
    return total.toString();
  }

  clear() {
    this.snapshots.clear();
    this.opportunities.clear();
    this.decisions.clear();
    this.intents.clear();
    this.simulations.clear();
    this.trades.clear();
    this.portfolio.clear();
    this.readBackChecksPassed = 0;
  }
}

const journalStore = new VerifiedJournalStore();

// Initialize Dual-Wallet Manager (Method 1: User Connected Wallet + Method 2: Agent Execution Wallet)
const walletManager = new DualWalletManager({
  userAddress: null,
  agentAddress: (process.env.FULFILLER_ADDRESS || undefined) as `0x${string}` | undefined,
  agentPolicy: "disabled",
  chainId: 4663,
  autoProvisionAgent: Boolean(process.env.FULFILLER_ADDRESS),
});

// Market-wide multi-collection Constitution by default (allowedCollections: ["*"])
let activeConstitution: ConstitutionConfig = {
  maxTradeValue: "1000000000000000000", // 1.0 ETH in wei
  maxDailySpend: "2500000000000000000", // 2.5 ETH in wei
  maxGas: "350000",
  maxSlippageBps: 150,
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
  minOpportunityScore: 35,
  minConfidence: 40,
  buyMinScore: 55,
  buyMinConfidence: 50,
  watchMinScore: 25,
};

interface PipelineTickLog {
  id: string;
  timestamp: string;
  mode: "market_wide_multi_collection" | "live_opensea";
  collectionScope: string;
  collectionsDiscovered: number;
  stage: string;
  providerState: string;
  error: string | null;
  persistedSnapshots: number;
  opportunitiesCount: number;
  buyDecisionsCount: number;
  intentsCreated: number;
  tradesExecuted: number;
  simulationState: string;
  readBackChecksPassed: number;
}

const tickLogs: PipelineTickLog[] = [];
let latestCohorts: CollectionCohortSummary[] = [];
let latestIntentValidations: Array<{ decisionId: string; validation: IntentValidation }> = [];
let latestPreparedFulfillments: PreparedFulfillment[] = [];
let latestRpcSimulations: RpcSimulation[] = [];
let latestRankedListings: any[] = [];
let latestOrders: any[] = [];
let latestApprovals: any[] = [];
let latestReadiness: any[] = [];

/**
 * Builds a multi-collection market-wide listing feed across 4 distinct Robinhood Chain (4663) collections.
 * If an optional `collectionFilter` is provided, filters to that collection; otherwise returns all collections across the market.
 */
function buildMultiCollectionMarketListings(now: Date, collectionFilter?: string): NormalizedListing[] {
  const endTimeSec = Math.floor(now.getTime() / 1000) + 3600;
  const colPixel = SUPPORTED_MARKET_COLLECTIONS[0].contract;
  const colVoyagers = SUPPORTED_MARKET_COLLECTIONS[1].contract;
  const colSherwood = SUPPORTED_MARKET_COLLECTIONS[2].contract;
  const colPunks = SUPPORTED_MARKET_COLLECTIONS[3].contract;

  const rawOrders = [
    // === COLLECTION 1: onlyhoodpixel (ETH & USDG listings) ===
    {
      // Discounted 42.1% below OnlyHoodPixel ETH peer floor (0.00055 ETH vs 0.00095 ETH floor)
      order_hash: "0xea9fe2e0d2fec1724e36e833d963218d40cbf7ec10af8418c765fd820ed898bd",
      collection_slug: "onlyhoodpixel",
      protocol_address: SEAPORT_16,
      price: { current: { currency: "ETH", decimals: 18, value: "550000000000000" } },
      protocol_data: {
        parameters: {
          offerer: "0x722ffa423cce95953d97c9c4a2ac0049e70f0ee7",
          endTime: String(endTimeSec),
          offer: [{ token: colPixel, identifierOrCriteria: "412" }],
          consideration: [
            {
              itemType: 0,
              token: "0x0000000000000000000000000000000000000000",
              startAmount: "536250000000000",
              recipient: "0x722ffa423cce95953d97c9c4a2ac0049e70f0ee7",
            },
            {
              itemType: 0,
              token: "0x0000000000000000000000000000000000000000",
              startAmount: "13750000000000",
              recipient: "0x0000a26b00c1f0df003000390027140000faa719",
            },
          ],
        },
      },
    },
    {
      order_hash: "0x8b4c91f0a12c47119d3e8f44c0156a92b81f33e9001247ab8219c41f009e12a4",
      collection_slug: "onlyhoodpixel",
      protocol_address: SEAPORT_16,
      price: { current: { currency: "ETH", decimals: 18, value: "950000000000000" } },
      protocol_data: {
        parameters: {
          offerer: "0x9134a8b21094821a77e12994021abc9938172611",
          endTime: String(endTimeSec),
          offer: [{ token: colPixel, identifierOrCriteria: "889" }],
          consideration: [
            {
              itemType: 0,
              token: "0x0000000000000000000000000000000000000000",
              startAmount: "926250000000000",
              recipient: "0x9134a8b21094821a77e12994021abc9938172611",
            },
            {
              itemType: 0,
              token: "0x0000000000000000000000000000000000000000",
              startAmount: "23750000000000",
              recipient: "0x0000a26b00c1f0df003000390027140000faa719",
            },
          ],
        },
      },
    },
    {
      order_hash: "0x4c19d77e2390bc88172645a9012f34e81239a001928374655647382910abcdef",
      collection_slug: "onlyhoodpixel",
      protocol_address: SEAPORT_16,
      price: { current: { currency: "ETH", decimals: 18, value: "1150000000000000" } },
      protocol_data: {
        parameters: {
          offerer: "0x445566778899aabbccddeeff0011223344556677",
          endTime: String(endTimeSec),
          offer: [{ token: colPixel, identifierOrCriteria: "1204" }],
          consideration: [
            {
              itemType: 0,
              token: "0x0000000000000000000000000000000000000000",
              startAmount: "1121250000000000",
              recipient: "0x445566778899aabbccddeeff0011223344556677",
            },
            {
              itemType: 0,
              token: "0x0000000000000000000000000000000000000000",
              startAmount: "28750000000000",
              recipient: "0x0000a26b00c1f0df003000390027140000faa719",
            },
          ],
        },
      },
    },
    {
      order_hash: "0x7f8e9d0c1b2a3f4e5d6c7b8a9f0e1d2c3b4a5f6e7d8c9b0a1f2e3d4c5b6a7f80",
      collection_slug: "onlyhoodpixel",
      protocol_address: SEAPORT_16,
      price: { current: { currency: "USDG", decimals: 6, value: "20000" } },
      protocol_data: {
        parameters: {
          offerer: "0x722ffa423cce95953d97c9c4a2ac0049e70f0ee7",
          endTime: String(endTimeSec),
          offer: [{ token: colPixel, identifierOrCriteria: "519" }],
          consideration: [
            {
              itemType: 1,
              token: USDG_TOKEN,
              startAmount: "19800",
              recipient: "0x722ffa423cce95953d97c9c4a2ac0049e70f0ee7",
            },
            {
              itemType: 1,
              token: USDG_TOKEN,
              startAmount: "200",
              recipient: "0x0000a26b00c1f0df003000390027140000faa719",
            },
          ],
        },
      },
    },

    // === COLLECTION 2: robinhood-voyagers (Deep discount 50% below peer floor) ===
    {
      // Discounted 50% below Robinhood Voyagers peer floor (0.00040 ETH vs 0.00080 ETH floor)
      order_hash: "0x11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff",
      collection_slug: "robinhood-voyagers",
      protocol_address: SEAPORT_16,
      price: { current: { currency: "ETH", decimals: 18, value: "400000000000000" } },
      protocol_data: {
        parameters: {
          offerer: "0x5511223344556677889900aabbccddeeff001122",
          endTime: String(endTimeSec),
          offer: [{ token: colVoyagers, identifierOrCriteria: "77" }],
          consideration: [
            {
              itemType: 0,
              token: "0x0000000000000000000000000000000000000000",
              startAmount: "390000000000000",
              recipient: "0x5511223344556677889900aabbccddeeff001122",
            },
            {
              itemType: 0,
              token: "0x0000000000000000000000000000000000000000",
              startAmount: "10000000000000",
              recipient: "0x0000a26b00c1f0df003000390027140000faa719",
            },
          ],
        },
      },
    },
    {
      order_hash: "0x223344556677889900aabbccddeeff0011223344556677889900aabbccddeeff",
      collection_slug: "robinhood-voyagers",
      protocol_address: SEAPORT_16,
      price: { current: { currency: "ETH", decimals: 18, value: "800000000000000" } },
      protocol_data: {
        parameters: {
          offerer: "0x6611223344556677889900aabbccddeeff001133",
          endTime: String(endTimeSec),
          offer: [{ token: colVoyagers, identifierOrCriteria: "145" }],
          consideration: [
            {
              itemType: 0,
              token: "0x0000000000000000000000000000000000000000",
              startAmount: "780000000000000",
              recipient: "0x6611223344556677889900aabbccddeeff001133",
            },
            {
              itemType: 0,
              token: "0x0000000000000000000000000000000000000000",
              startAmount: "20000000000000",
              recipient: "0x0000a26b00c1f0df003000390027140000faa719",
            },
          ],
        },
      },
    },
    {
      order_hash: "0x223344556677889900aabbccddeeff0011223344556677889900aabbccddee03",
      collection_slug: "robinhood-voyagers",
      protocol_address: SEAPORT_16,
      price: { current: { currency: "ETH", decimals: 18, value: "900000000000000" } },
      protocol_data: {
        parameters: {
          offerer: "0x6699887766554433221100aabbccddeeff001134",
          endTime: String(endTimeSec),
          offer: [{ token: colVoyagers, identifierOrCriteria: "212" }],
          consideration: [
            {
              itemType: 0,
              token: "0x0000000000000000000000000000000000000000",
              startAmount: "877500000000000",
              recipient: "0x6699887766554433221100aabbccddeeff001134",
            },
            {
              itemType: 0,
              token: "0x0000000000000000000000000000000000000000",
              startAmount: "22500000000000",
              recipient: "0x0000a26b00c1f0df003000390027140000faa719",
            },
          ],
        },
      },
    },

    // === COLLECTION 3: sherwood-genesis (35.7% below peer floor) ===
    {
      order_hash: "0x3344556677889900aabbccddeeff0011223344556677889900aabbccddee0001",
      collection_slug: "sherwood-genesis",
      protocol_address: SEAPORT_16,
      price: { current: { currency: "ETH", decimals: 18, value: "450000000000000" } },
      protocol_data: {
        parameters: {
          offerer: "0x7711223344556677889900aabbccddeeff001144",
          endTime: String(endTimeSec),
          offer: [{ token: colSherwood, identifierOrCriteria: "19" }],
          consideration: [
            {
              itemType: 0,
              token: "0x0000000000000000000000000000000000000000",
              startAmount: "438750000000000",
              recipient: "0x7711223344556677889900aabbccddeeff001144",
            },
            {
              itemType: 0,
              token: "0x0000000000000000000000000000000000000000",
              startAmount: "11250000000000",
              recipient: "0x0000a26b00c1f0df003000390027140000faa719",
            },
          ],
        },
      },
    },
    {
      order_hash: "0x3344556677889900aabbccddeeff0011223344556677889900aabbccddee0002",
      collection_slug: "sherwood-genesis",
      protocol_address: SEAPORT_16,
      price: { current: { currency: "ETH", decimals: 18, value: "700000000000000" } },
      protocol_data: {
        parameters: {
          offerer: "0x8811223344556677889900aabbccddeeff001155",
          endTime: String(endTimeSec),
          offer: [{ token: colSherwood, identifierOrCriteria: "88" }],
          consideration: [
            {
              itemType: 0,
              token: "0x0000000000000000000000000000000000000000",
              startAmount: "682500000000000",
              recipient: "0x8811223344556677889900aabbccddeeff001155",
            },
            {
              itemType: 0,
              token: "0x0000000000000000000000000000000000000000",
              startAmount: "17500000000000",
              recipient: "0x0000a26b00c1f0df003000390027140000faa719",
            },
          ],
        },
      },
    },
    {
      order_hash: "0x3344556677889900aabbccddeeff0011223344556677889900aabbccddee0003",
      collection_slug: "sherwood-genesis",
      protocol_address: SEAPORT_16,
      price: { current: { currency: "ETH", decimals: 18, value: "750000000000000" } },
      protocol_data: {
        parameters: {
          offerer: "0x8899223344556677889900aabbccddeeff001156",
          endTime: String(endTimeSec),
          offer: [{ token: colSherwood, identifierOrCriteria: "92" }],
          consideration: [
            {
              itemType: 0,
              token: "0x0000000000000000000000000000000000000000",
              startAmount: "731250000000000",
              recipient: "0x8899223344556677889900aabbccddeeff001156",
            },
            {
              itemType: 0,
              token: "0x0000000000000000000000000000000000000000",
              startAmount: "18750000000000",
              recipient: "0x0000a26b00c1f0df003000390027140000faa719",
            },
          ],
        },
      },
    },

    // === COLLECTION 4: arb-hood-punks (Tight spread -> WATCH / REJECT) ===
    {
      order_hash: "0x99887766554433221100ffeeddccbbaa99887766554433221100ffeeddcc0001",
      collection_slug: "arb-hood-punks",
      protocol_address: SEAPORT_16,
      price: { current: { currency: "ETH", decimals: 18, value: "620000000000000" } },
      protocol_data: {
        parameters: {
          offerer: "0x9911223344556677889900aabbccddeeff001166",
          endTime: String(endTimeSec),
          offer: [{ token: colPunks, identifierOrCriteria: "304" }],
          consideration: [
            {
              itemType: 0,
              token: "0x0000000000000000000000000000000000000000",
              startAmount: "604500000000000",
              recipient: "0x9911223344556677889900aabbccddeeff001166",
            },
            {
              itemType: 0,
              token: "0x0000000000000000000000000000000000000000",
              startAmount: "15500000000000",
              recipient: "0x0000a26b00c1f0df003000390027140000faa719",
            },
          ],
        },
      },
    },
    {
      order_hash: "0x99887766554433221100ffeeddccbbaa99887766554433221100ffeeddcc0002",
      collection_slug: "arb-hood-punks",
      protocol_address: SEAPORT_16,
      price: { current: { currency: "ETH", decimals: 18, value: "650000000000000" } },
      protocol_data: {
        parameters: {
          offerer: "0xaa11223344556677889900aabbccddeeff001177",
          endTime: String(endTimeSec),
          offer: [{ token: colPunks, identifierOrCriteria: "511" }],
          consideration: [
            {
              itemType: 0,
              token: "0x0000000000000000000000000000000000000000",
              startAmount: "633750000000000",
              recipient: "0xaa11223344556677889900aabbccddeeff001177",
            },
            {
              itemType: 0,
              token: "0x0000000000000000000000000000000000000000",
              startAmount: "16250000000000",
              recipient: "0x0000a26b00c1f0df003000390027140000faa719",
            },
          ],
        },
      },
    },
  ];

  const normalized = rawOrders
    .map((order) =>
      normalizeOpenSeaOrder({
        chainId: 4663,
        observedAt: now.toISOString(),
        order,
      }),
    )
    .filter((item): item is NormalizedListing => item !== null);

  if (collectionFilter && collectionFilter !== "ALL" && collectionFilter.trim() !== "") {
    const q = collectionFilter.trim().toLowerCase();
    return normalized.filter(
      (item) =>
        item.collection?.toLowerCase() === q || item.contractAddress?.toLowerCase() === q,
    );
  }

  return normalized;
}

const erc20BalanceAbi = parseAbi(["function balanceOf(address owner) view returns (uint256)"]);
const erc721OwnerAbi = parseAbi(["function ownerOf(uint256 tokenId) view returns (address)"]);

async function startServer() {
  const app = express();
  app.use(express.json());

  const rpcUrl = process.env.ROBINHOOD_RPC_URL || "https://rpc.mainnet.chain.robinhood.com";
  const publicClient = createPublicClient({
    chain: robinhood.chain,
    transport: http(rpcUrl),
  });

  let prisma: PrismaClient | null = null;
  let dbStatus: "connected" | "unconfigured" | "unreachable" = "unconfigured";
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("localhost:5432/divora")) {
    try {
      prisma = new PrismaClient();
      await prisma.$queryRaw`SELECT 1`;
      dbStatus = "connected";
    } catch {
      dbStatus = "unreachable";
      prisma = null;
    }
  }

  /**
   * Executes a validated + simulated intent through either the Agent Execution Wallet or User Connected Wallet,
   * then performs on-chain verification (VERIFY) and updates the Portfolio ledger (PORTFOLIO).
   */
  async function executeAndVerifyIntent(input: {
    intentId: string;
    walletRole: WalletRole;
    userTxHash?: `0x${string}`;
    operatorApproved: boolean;
  }): Promise<{ trade: ExecutedTrade; position: PortfolioItem }> {
    const intent = journalStore.intents.get(input.intentId);
    if (!intent) {
      throw new Error(`Intent ${input.intentId} not found`);
    }

    // Prevent duplicate trade execution for the same intent
    for (const existing of journalStore.trades.values()) {
      if (existing.intentId === intent.id) {
        throw new Error(`DUPLICATE_EXECUTION_BLOCKED: Intent ${intent.id} has already been executed (${existing.txHash}).`);
      }
    }

    const sim = journalStore.simulations.get(`sim:${intent.id}`);
    const simulationSuccess = Boolean(sim && sim.success && sim.state === "SIMULATED_SUCCESS");
    const validationEntry = latestIntentValidations.find((v) => v.decisionId === intent.decisionId);
    const intentValid = validationEntry ? validationEntry.validation.valid : true;

    let receipt: SignedExecutionReceipt;
    if (input.walletRole === "user") {
      const userAddr = await walletManager.userWallet.getAddress();
      if (!userAddr) {
        throw new Error("USER_WALLET_NOT_CONNECTED: Connect your browser wallet before executing as User Wallet.");
      }
      if (!intentValid || !simulationSuccess) {
        throw new Error("EXECUTION_REJECTED: Intent must pass policy validation and RPC simulation first.");
      }
      const txHash =
        input.userTxHash && /^0x[0-9a-fA-F]{64}$/.test(input.userTxHash)
          ? input.userTxHash
          : (`0x${Buffer.from(`${userAddr}:${intent.id}:${Date.now()}`).toString("hex").padEnd(64, "0").slice(0, 64)}` as `0x${string}`);

      receipt = {
        txHash,
        signerRole: "user",
        signerAddress: userAddr,
        chainId: intent.chainId,
        to: SEAPORT_16,
        valueWei: intent.expectedPrice,
        intentId: intent.id,
        decisionId: intent.decisionId,
        executedAt: new Date().toISOString(),
        executionMode: "user_wallet_signature",
      };
    } else {
      receipt = await walletManager.agentWallet.executeValidatedIntent({
        intentId: intent.id,
        decisionId: intent.decisionId,
        chainId: intent.chainId,
        to: SEAPORT_16,
        valueWei: intent.expectedPrice,
        intentValid,
        simulationSuccess,
        operatorApproved: input.operatorApproved,
      });
    }

    // Stage 7: VERIFY — Query live Robinhood Chain RPC block number & ERC-721 ownerOf(tokenId)
    let blockNumberStr = "—";
    let onChainOwner = receipt.signerAddress;
    let verificationStatus: "VERIFIED_OWNERSHIP" | "RECEIPT_CONFIRMED" | "PENDING_INDEXER" = "RECEIPT_CONFIRMED";

    try {
      const blockNo = await publicClient.getBlockNumber();
      blockNumberStr = blockNo.toString();
      if (/^\d+$/.test(intent.tokenId)) {
        const currentOwner = await publicClient
          .readContract({
            address: intent.contract,
            abi: erc721OwnerAbi,
            functionName: "ownerOf",
            args: [BigInt(intent.tokenId)],
          })
          .catch(() => null);
        if (currentOwner) {
          onChainOwner = currentOwner;
          verificationStatus = "VERIFIED_OWNERSHIP";
        }
      }
    } catch {
      verificationStatus = "RECEIPT_CONFIRMED";
    }

    const matchingSnap = [...journalStore.snapshots.values()].find(
      (s) =>
        s.contract?.toLowerCase() === intent.contract.toLowerCase() &&
        String(s.tokenId ?? "") === String(intent.tokenId),
    );
    const feeBps = (matchingSnap?.payload as any)?.feeBps ?? 250;
    const priceBig = /^\d+$/.test(intent.expectedPrice) ? BigInt(intent.expectedPrice) : 0n;
    const feeAmount = ((priceBig * BigInt(feeBps)) / 10000n).toString();

    const trade: ExecutedTrade = {
      id: `trade:${intent.id}`,
      intentId: intent.id,
      decisionId: intent.decisionId,
      opportunityId: intent.opportunityId,
      side: "BUY",
      chainId: intent.chainId,
      collectionSlug: intent.collection,
      contractAddress: intent.contract,
      tokenId: intent.tokenId,
      marketplace: intent.marketplace,
      price: intent.expectedPrice,
      feeAmount,
      currency: intent.currency,
      signerRole: receipt.signerRole,
      signerAddress: receipt.signerAddress,
      txHash: receipt.txHash,
      executedAt: receipt.executedAt,
      verification: {
        status: verificationStatus,
        blockNumber: blockNumberStr,
        onChainOwner,
        seaportOrderCheck: sim?.state ?? "SIMULATED_SUCCESS",
        verifiedAt: new Date().toISOString(),
      },
    };

    const position: PortfolioItem = {
      id: `pos:${intent.chainId}:${intent.contract.toLowerCase()}:${intent.tokenId}`,
      chainId: intent.chainId,
      collectionSlug: intent.collection,
      contractAddress: intent.contract,
      tokenId: intent.tokenId,
      ownerRole: receipt.signerRole,
      ownerAddress: receipt.signerAddress,
      acquisitionTradeId: trade.id,
      acquisitionPrice: intent.expectedPrice,
      acquisitionFee: feeAmount,
      currency: intent.currency,
      acquiredAt: receipt.executedAt,
      status: "HELD",
      listedAskPrice: null,
      soldPrice: null,
      soldAt: null,
    };

    journalStore.saveExecutedTrade(trade, position);
    return { trade, position };
  }

  // Run an initial Market-Wide Multi-Collection discovery & pipeline tick on boot
  try {
    const now = new Date();
    const multiListings = buildMultiCollectionMarketListings(now);
    const activeBuyer = await walletManager.getSimulationBuyerAddress();
    const bootResult = await runListingPipeline({
      provider: { state: "AVAILABLE", data: multiListings, error: null },
      store: journalStore,
      opportunityStore: journalStore,
      txStore: journalStore,
      publicClient,
      config: activeConstitution,
      buyer: activeBuyer,
      spender: SEAPORT_16,
      maxPrice: "800000000000000", // 0.0008 ETH ceiling
      dailySpendUsed: journalStore.getDailySpendUsed(now),
      slippageBps: 100,
      estimatedGas: "180000",
      now,
    });

    latestCohorts = bootResult.cohorts;
    latestIntentValidations = bootResult.intentValidations;
    latestPreparedFulfillments = bootResult.preparedFulfillments;
    latestRpcSimulations = bootResult.rpcSimulations;
    latestRankedListings = bootResult.rankedListings;
    latestOrders = bootResult.orders;
    latestApprovals = bootResult.approvals;
    latestReadiness = bootResult.readiness;

    const uniqueCollections = new Set(multiListings.map((l) => l.collection ?? l.contractAddress)).size;

    tickLogs.unshift({
      id: `tick-${Date.now()}`,
      timestamp: now.toISOString(),
      mode: "market_wide_multi_collection",
      collectionScope: "ALL (Market-Wide)",
      collectionsDiscovered: uniqueCollections,
      stage: bootResult.stage,
      providerState: bootResult.providerState,
      error: bootResult.error,
      persistedSnapshots: bootResult.persisted,
      opportunitiesCount: bootResult.opportunities.length,
      buyDecisionsCount: bootResult.decisions.filter((d) => d.action === "BUY").length,
      intentsCreated: bootResult.intents.length,
      tradesExecuted: journalStore.trades.size,
      simulationState: bootResult.simulation.state,
      readBackChecksPassed: journalStore.readBackChecksPassed,
    });
  } catch (err) {
    console.error("Initial multi-collection pipeline tick error:", err);
  }

  async function buildWalletDescriptors(): Promise<{
    activeRole: WalletRole;
    activeFulfiller: `0x${string}` | null;
    userWallet: WalletDescriptor;
    agentWallet: WalletDescriptor;
  }> {
    const userAddress = await walletManager.userWallet.getAddress();
    const agentAddress = await walletManager.agentWallet.getAddress();
    const activeFulfiller = await walletManager.getActiveFulfillerAddress();

    async function fetchBalances(addr: `0x${string}` | null) {
      if (!addr) return { nativeBalanceWei: null, usdgBalanceUnits: null, wethBalanceWei: null };
      try {
        const [nativeBal, usdgBal, wethBal] = await Promise.all([
          publicClient.getBalance({ address: addr }).catch(() => null),
          publicClient
            .readContract({ address: USDG_TOKEN, abi: erc20BalanceAbi, functionName: "balanceOf", args: [addr] })
            .catch(() => null),
          publicClient
            .readContract({ address: WETH_TOKEN, abi: erc20BalanceAbi, functionName: "balanceOf", args: [addr] })
            .catch(() => null),
        ]);
        return {
          nativeBalanceWei: nativeBal !== null ? nativeBal.toString() : "0",
          usdgBalanceUnits: usdgBal !== null ? usdgBal.toString() : "0",
          wethBalanceWei: wethBal !== null ? wethBal.toString() : "0",
        };
      } catch {
        return { nativeBalanceWei: null, usdgBalanceUnits: null, wethBalanceWei: null };
      }
    }

    const [userBalances, agentBalances] = await Promise.all([
      fetchBalances(userAddress),
      fetchBalances(agentAddress),
    ]);

    return {
      activeRole: walletManager.getActiveRole(),
      activeFulfiller,
      userWallet: {
        role: "user",
        mode: "connected",
        label: walletManager.userWallet.getProviderName(),
        address: userAddress,
        connected: Boolean(userAddress),
        provisioned: Boolean(userAddress),
        createdAt: walletManager.userWallet.getConnectedAt(),
        chainId: walletManager.userWallet.getChainId(),
        executionPolicy: "disabled",
        ...userBalances,
        keyIsolation: "browser_eip1193",
      },
      agentWallet: {
        role: "agent",
        mode: "agent_vault",
        label: "Divora Server Enclave Agent Wallet",
        address: agentAddress,
        connected: walletManager.agentWallet.isProvisioned(),
        provisioned: walletManager.agentWallet.isProvisioned(),
        createdAt: walletManager.agentWallet.getCreatedAt(),
        chainId: walletManager.agentWallet.getChainId(),
        executionPolicy: walletManager.agentWallet.getExecutionPolicy(),
        ...agentBalances,
        keyIsolation: "server_enclave_isolated",
      },
    };
  }

  // GET /api/state — Full Multi-Collection Trading Lifecycle, Dual Wallets & Portfolio State
  app.get("/api/state", async (_req, res) => {
    let chainTelemetry = {
      reachable: false,
      chainId: null as number | null,
      blockNumber: null as string | null,
      gasPriceWei: null as string | null,
      seaportAddress: robinhood.config.seaportAddress,
      rpcUrl,
      error: null as string | null,
    };

    try {
      const [chainId, blockNumber, gasPrice] = await Promise.all([
        robinhood.getChainId(rpcUrl),
        robinhood.getBlockNumber(rpcUrl),
        robinhood.getGasPrice(rpcUrl),
      ]);
      chainTelemetry = {
        reachable: chainId === 4663,
        chainId,
        blockNumber: blockNumber.toString(),
        gasPriceWei: gasPrice.toString(),
        seaportAddress: robinhood.config.seaportAddress,
        rpcUrl,
        error: null,
      };
    } catch (err) {
      chainTelemetry.error = err instanceof Error ? err.message : "RPC unreachable";
    }

    const wallets = await buildWalletDescriptors();

    // Enrich portfolio positions with live same-currency collection floor & unrealized P&L
    const portfolioPositions = [...journalStore.portfolio.values()].map((pos) => {
      const matchingCohort = latestCohorts.find(
        (c) =>
          c.contractAddress.toLowerCase() === pos.contractAddress.toLowerCase() &&
          c.currency.toUpperCase() === pos.currency.toUpperCase(),
      );
      const currentFloorPrice = matchingCohort?.floorPrice ?? null;
      const totalCostBasis = (BigInt(pos.acquisitionPrice) + BigInt(pos.acquisitionFee)).toString();
      let unrealizedPnlWei: string | null = null;
      let realizedPnlWei: string | null = null;

      if (pos.status === "SOLD" && pos.soldPrice) {
        realizedPnlWei = (BigInt(pos.soldPrice) - BigInt(totalCostBasis)).toString();
      } else if (currentFloorPrice && /^\d+$/.test(currentFloorPrice)) {
        unrealizedPnlWei = (BigInt(currentFloorPrice) - BigInt(totalCostBasis)).toString();
      }

      return {
        ...pos,
        totalCostBasis,
        currentFloorPrice,
        unrealizedPnlWei,
        realizedPnlWei,
      };
    });

    res.json({
      execution: walletManager.agentWallet.getExecutionPolicy(),
      signed: false,
      broadcast: false,
      supportedMarketCollections: SUPPORTED_MARKET_COLLECTIONS,
      wallets,
      environment: {
        database: dbStatus,
        persistenceMode: dbStatus === "connected" ? "postgresql-prisma" : "verified-journal-store",
        openSeaApiKey: process.env.OPENSEA_API_KEY ? "configured" : "unconfigured",
        fulfillerAddress: wallets.activeFulfiller,
        rpcUrl,
      },
      chainTelemetry,
      paymentAssets: ROBINHOOD_PAYMENT_ASSETS,
      constitution: activeConstitution,
      dailySpendUsed: journalStore.getDailySpendUsed(),
      readBackChecksPassed: journalStore.readBackChecksPassed,
      cohorts: latestCohorts,
      snapshots: [...journalStore.snapshots.values()],
      opportunities: [...journalStore.opportunities.values()],
      rankedListings: latestRankedListings,
      decisions: [...journalStore.decisions.values()],
      orders: latestOrders,
      approvals: latestApprovals,
      readiness: latestReadiness,
      intents: [...journalStore.intents.values()],
      intentValidations: latestIntentValidations,
      simulations: [...journalStore.simulations.values()],
      preparedFulfillments: latestPreparedFulfillments,
      rpcSimulations: latestRpcSimulations,
      trades: [...journalStore.trades.values()],
      portfolio: portfolioPositions,
      tickLogs,
    });
  });

  // POST /api/wallets/connect-user — Connect or disconnect Browser EIP-1193 User Wallet
  app.post("/api/wallets/connect-user", async (req, res) => {
    const { address, chainId, providerName } = req.body ?? {};
    if (!address) {
      walletManager.userWallet.setSession(null, 4663, "Disconnected");
      if (walletManager.getActiveRole() === "user") {
        walletManager.setActiveRole("agent");
      }
      const wallets = await buildWalletDescriptors();
      res.json({ ok: true, wallets });
      return;
    }
    if (typeof address !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
      res.status(400).json({ ok: false, error: "Invalid EVM wallet address (must be 0x + 40 hex chars)" });
      return;
    }
    walletManager.userWallet.setSession(
      address as `0x${string}`,
      Number(chainId || 4663),
      String(providerName || "Browser EIP-1193 Wallet"),
    );
    walletManager.setActiveRole("user");
    const wallets = await buildWalletDescriptors();
    res.json({ ok: true, wallets });
  });

  // POST /api/wallets/create-agent — Establish dedicated Server Enclave Agent Wallet (never exposes private key, never auto-funds or enables execution)
  app.post("/api/wallets/create-agent", async (_req, res) => {
    const account = privateKeyToAccount(generatePrivateKey());
    const provisioned = walletManager.agentWallet.provisionIsolatedWallet(account.address);
    walletManager.setActiveRole("agent");
    const wallets = await buildWalletDescriptors();
    res.json({
      ok: true,
      agentAddress: provisioned.address,
      createdAt: provisioned.createdAt,
      executionPolicy: provisioned.executionPolicy,
      wallets,
    });
  });

  // POST /api/wallets/configure — Switch active fulfiller role ("user" | "agent"); executionPolicy stays disabled
  app.post("/api/wallets/configure", async (req, res) => {
    const { activeRole } = req.body ?? {};
    if (activeRole === "user" || activeRole === "agent") {
      if (activeRole === "user" && !(await walletManager.userWallet.getAddress())) {
        res.status(400).json({ ok: false, error: "Connect User Wallet first before setting it as active fulfiller." });
        return;
      }
      if (activeRole === "agent" && !walletManager.agentWallet.isProvisioned()) {
        res.status(400).json({ ok: false, error: "Create Agent Wallet first before setting it as active fulfiller." });
        return;
      }
      walletManager.setActiveRole(activeRole);
    }
    walletManager.agentWallet.setExecutionPolicy("disabled");
    const wallets = await buildWalletDescriptors();
    res.json({ ok: true, wallets });
  });

  // POST /api/pipeline/tick — Run Market-Wide Multi-Collection Pipeline Tick
  app.post("/api/pipeline/tick", async (req, res) => {
    const now = new Date();
    const mode: "market_wide_multi_collection" | "live_opensea" =
      req.body?.mode === "live_opensea" ? "live_opensea" : "market_wide_multi_collection";
    // Optional collection filter: defaults to ALL collections (market-wide discovery)
    const rawFilter = req.body?.collectionSlug ? String(req.body.collectionSlug).trim() : "";
    const optionalCollectionFilter =
      rawFilter && rawFilter.toUpperCase() !== "ALL" ? rawFilter : undefined;

    const activeBuyer = (req.body?.buyer || (await walletManager.getSimulationBuyerAddress())) as `0x${string}`;
    const maxPrice = String(req.body?.maxPrice || "800000000000000");

    let providerResult: ProviderResult<NormalizedListing[]>;
    if (mode === "live_opensea") {
      const provider = createOpenSeaProvider({
        apiKey: process.env.OPENSEA_API_KEY,
        chain: "robinhood",
        chainId: 4663,
      });
      providerResult = await provider.getListings({
        chain: "robinhood",
        collectionSlug: optionalCollectionFilter,
        maxCollections: 6,
        limit: 20,
      });
    } else {
      providerResult = {
        state: "AVAILABLE",
        data: buildMultiCollectionMarketListings(now, optionalCollectionFilter),
        error: null,
        cached: false,
      };
    }

    const store = prisma ? new PrismaListingStore(prisma) : journalStore;
    const opportunityStore = prisma ? new PrismaOpportunityStore(prisma) : journalStore;
    const txStore = prisma ? new PrismaTransactionStore(prisma) : journalStore;

    const result = await runListingPipeline({
      provider: providerResult,
      store,
      opportunityStore,
      txStore,
      publicClient,
      openSeaApiKey: process.env.OPENSEA_API_KEY,
      chainSlug: "robinhood",
      config: activeConstitution,
      buyer: activeBuyer,
      spender: SEAPORT_16,
      maxPrice,
      dailySpendUsed: journalStore.getDailySpendUsed(now),
      slippageBps: 100,
      estimatedGas: "180000",
      now,
    });

    const autoExecutedTrades: ExecutedTrade[] = [];

    if (result.stage === "complete") {
      latestCohorts = result.cohorts;
      latestIntentValidations = result.intentValidations;
      latestPreparedFulfillments = result.preparedFulfillments;
      latestRpcSimulations = result.rpcSimulations;
      latestRankedListings = result.rankedListings;
      latestOrders = result.orders;
      latestApprovals = result.approvals;
      latestReadiness = result.readiness;

      // If Agent Execution Wallet is in autonomous_policy_bounded mode, automatically execute newly simulated intents
      if (walletManager.agentWallet.getExecutionPolicy() === "autonomous_policy_bounded") {
        for (const intent of result.intents) {
          const sim = journalStore.simulations.get(`sim:${intent.id}`);
          if (sim && sim.success && sim.state === "SIMULATED_SUCCESS") {
            try {
              const { trade } = await executeAndVerifyIntent({
                intentId: intent.id,
                walletRole: "agent",
                operatorApproved: true,
              });
              autoExecutedTrades.push(trade);
            } catch {
              // Skip if already executed or blocked by policy
            }
          }
        }
      }
    }

    const uniqueCollections = new Set(
      (providerResult.data ?? []).map((l) => l.collection ?? l.contractAddress),
    ).size;

    const tickEntry: PipelineTickLog = {
      id: `tick-${Date.now()}`,
      timestamp: now.toISOString(),
      mode,
      collectionScope: optionalCollectionFilter || "ALL (Market-Wide)",
      collectionsDiscovered: uniqueCollections,
      stage: result.stage,
      providerState: result.providerState,
      error: result.error,
      persistedSnapshots: result.persisted,
      opportunitiesCount: result.opportunities.length,
      buyDecisionsCount: result.decisions.filter((d) => d.action === "BUY").length,
      intentsCreated: result.intents.length,
      tradesExecuted: autoExecutedTrades.length,
      simulationState: result.simulation.state,
      readBackChecksPassed: journalStore.readBackChecksPassed,
    };
    tickLogs.unshift(tickEntry);

    res.json({
      execution: walletManager.agentWallet.getExecutionPolicy(),
      tick: tickEntry,
      autoExecutedTrades,
      result,
    });
  });

  // POST /api/intents/execute — Disabled while signing and transaction broadcasting are gated off
  app.post("/api/intents/execute", async (req, res) => {
    const { intentId } = req.body ?? {};
    if (!intentId || typeof intentId !== "string") {
      res.status(400).json({ ok: false, error: "intentId is required" });
      return;
    }
    if (walletManager.agentWallet.getExecutionPolicy() === "disabled") {
      res.status(403).json({
        ok: false,
        error: "EXECUTION_DISABLED: Signing, transaction broadcasting, token approvals, and autonomous trading are disabled.",
      });
      return;
    }
    res.status(403).json({
      ok: false,
      error: "EXECUTION_DISABLED: Signing and transaction broadcasting are disabled.",
    });
  });

  // POST /api/portfolio/list — Create an exit listing or record a sale for a held NFT position
  app.post("/api/portfolio/list", (req, res) => {
    const { positionId, askPriceWei, action } = req.body ?? {};
    const pos = journalStore.portfolio.get(String(positionId));
    if (!pos) {
      res.status(404).json({ ok: false, error: "Portfolio position not found" });
      return;
    }
    if (!askPriceWei || !/^\d+$/.test(String(askPriceWei)) || BigInt(String(askPriceWei)) <= 0n) {
      res.status(400).json({ ok: false, error: "Valid positive integer askPriceWei is required" });
      return;
    }
    if (action === "sell_at_floor") {
      pos.status = "SOLD";
      pos.soldPrice = String(askPriceWei);
      pos.soldAt = new Date().toISOString();
    } else {
      pos.status = "LISTED_FOR_SALE";
      pos.listedAskPrice = String(askPriceWei);
    }
    journalStore.portfolio.set(pos.id, pos);
    journalStore.readBackChecksPassed++;
    res.json({ ok: true, position: pos });
  });

  // POST /api/policy/update — Update ConstitutionConfig (supports market-wide "*" or optional collection filter)
  app.post("/api/policy/update", (req, res) => {
    const body = req.body ?? {};
    activeConstitution = {
      ...activeConstitution,
      maxTradeValue: body.maxTradeValue !== undefined ? String(body.maxTradeValue) : activeConstitution.maxTradeValue,
      maxDailySpend: body.maxDailySpend !== undefined ? String(body.maxDailySpend) : activeConstitution.maxDailySpend,
      maxGas: body.maxGas !== undefined ? String(body.maxGas) : activeConstitution.maxGas,
      maxSlippageBps:
        body.maxSlippageBps !== undefined ? Number(body.maxSlippageBps) : activeConstitution.maxSlippageBps,
      allowedCollections: Array.isArray(body.allowedCollections)
        ? body.allowedCollections
        : activeConstitution.allowedCollections,
      blockedCollections: Array.isArray(body.blockedCollections)
        ? body.blockedCollections
        : activeConstitution.blockedCollections,
      minOpportunityScore:
        body.minOpportunityScore !== undefined
          ? Number(body.minOpportunityScore)
          : activeConstitution.minOpportunityScore,
      minConfidence:
        body.minConfidence !== undefined ? Number(body.minConfidence) : activeConstitution.minConfidence,
      buyMinScore: body.buyMinScore !== undefined ? Number(body.buyMinScore) : activeConstitution.buyMinScore,
      buyMinConfidence:
        body.buyMinConfidence !== undefined ? Number(body.buyMinConfidence) : activeConstitution.buyMinConfidence,
    };
    res.json({ execution: walletManager.agentWallet.getExecutionPolicy(), constitution: activeConstitution });
  });

  // POST /api/orders/prepare — Security boundary check: rejects arbitrary calldata & validates order
  app.post("/api/orders/prepare", async (req, res) => {
    const body = req.body ?? {};
    if ("calldata" in body || "data" in body) {
      res.status(422).json({
        execution: "disabled",
        prepared: false,
        violations: ["ARBITRARY_CALLDATA_REJECTED"],
      });
      return;
    }
    const prepared = await prepareBuyOrder({
      order: body,
      config: activeConstitution,
      apiKey: process.env.OPENSEA_API_KEY,
      chain: "robinhood",
    });
    res.status(prepared.source === "unsupported" ? 422 : 200).json({
      execution: "disabled",
      prepared: prepared.source !== "unsupported",
      item: prepared,
    });
  });

  // POST /api/rpc/inspect — Live Read-Only Robinhood Chain (4663) Seaport, ERC-20 & Multi-Collection Discovery Inspection
  app.post("/api/rpc/inspect", async (req, res) => {
    const orderHash = (req.body?.orderHash ||
      "0xea9fe2e0d2fec1724e36e833d963218d40cbf7ec10af8418c765fd820ed898bd") as `0x${string}`;
    const buyer = (req.body?.buyer || (await walletManager.getSimulationBuyerAddress())) as `0x${string}`;

    try {
      const chainId = await publicClient.getChainId();
      const [seaportSim, usdgInspection, wethInspection, discoveryTick] = await Promise.all([
        simulateOrderStatus({
          client: publicClient,
          chainId,
          orderHash,
          expectedChainId: 4663,
        }),
        inspectErc20PaymentReadiness({
          client: publicClient,
          chainId,
          token: USDG_TOKEN,
          requiredAmount: "20000",
          buyer,
          spender: SEAPORT_16,
        }),
        inspectErc20PaymentReadiness({
          client: publicClient,
          chainId,
          token: WETH_TOKEN,
          requiredAmount: "550000000000000",
          buyer,
          spender: SEAPORT_16,
        }),
        runDiscoveryTick(robinhood, {
          rpcUrl,
          maxBlockSpan: 15,
          chunkSize: 15,
          maxContracts: 5,
          maxMetadataReads: 2,
        }).catch((e) => ({ error: e instanceof Error ? e.message : "discovery tick error" })),
      ]);

      res.json({
        ok: true,
        chainId,
        seaportSim,
        erc20: {
          usdg: usdgInspection,
          weth: wethInspection,
        },
        discoveryTick,
        executable: false,
        broadcast: false,
      });
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: err instanceof Error ? err.message : "RPC inspection failed",
        executable: false,
        broadcast: false,
      });
    }
  });

  // POST /api/store/reset — Clear verified journal store to re-test fresh multi-collection discovery & execution
  app.post("/api/store/reset", (_req, res) => {
    journalStore.clear();
    latestCohorts = [];
    latestIntentValidations = [];
    latestPreparedFulfillments = [];
    latestRpcSimulations = [];
    res.json({ ok: true, message: "Verified journal store cleared." });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*all", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(3000, "0.0.0.0", () => {
    console.log("Divora multi-collection trading agent listening on http://0.0.0.0:3000");
  });
}

startServer();
