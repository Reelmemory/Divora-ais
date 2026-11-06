export type DetailedTab =
  | "market"
  | "opportunities"
  | "decisions"
  | "transactions"
  | "portfolio";

export interface WalletDescriptor {
  role: "user" | "agent";
  mode: "connected" | "agent_vault";
  label: string;
  address: string | null;
  connected: boolean;
  provisioned: boolean;
  createdAt: string | null;
  chainId: number;
  executionPolicy: "disabled" | "approval_gated" | "autonomous_policy_bounded";
  nativeBalanceWei: string | null;
  usdgBalanceUnits: string | null;
  wethBalanceWei: string | null;
  keyIsolation: "browser_eip1193" | "server_enclave_isolated";
}

export interface SupportedCollection {
  slug: string;
  name: string;
  contract: string;
}

export interface CohortSummary {
  chainId: number;
  contractAddress: string;
  collectionSlug: string | null;
  currency: string;
  activeListings: number;
  uniqueSellers: number;
  floorPrice: string | null;
  medianPrice: string | null;
}

export interface OpportunityItem {
  id: string;
  chainId: number;
  contract: string;
  tokenId?: string;
  collectionName?: string;
  status: string;
  strategy: string | null;
  score: number | null;
  confidence: number;
  observedPrice?: string;
  referencePrice?: string;
  fairValue?: string;
  priceDeviation?: number;
  signals: Array<{
    category: string;
    code: string;
    applicable: boolean;
    score: number;
    weight: number;
    explanation: string;
  }>;
  analysis: {
    recommendation: string;
    reasoning: string;
  };
  updatedAt: string;
}

export interface RankedListingItem {
  id: string;
  collection?: string | null;
  contractAddress?: string | null;
  tokenId?: string | null;
  rank: number;
  score: number | null;
  currency: string | null;
  priceBaseUnits: string | null;
  feeBaseUnits?: string | null;
  sameCurrencyCost: string | null;
  reason: string;
}

export interface DecisionItem {
  id: string;
  opportunityId: string;
  action: string;
  status: string;
  confidence: number;
  riskLevel: string;
  reasoning: string;
  supportingSignals: string[];
  rejectionReasons: string[];
  opportunityScore: number | null;
  strategy: string | null;
  collection: string;
  createdAt: string;
  execution: string;
  policy: {
    allowed: boolean;
    violations: string[];
    warnings: string[];
  };
  risk: {
    level: string;
    findings: Array<{ type: string; severity: string; reason: string }>;
  };
}

export interface IntentItem {
  id: string;
  orderHash?: string;
  decisionId: string;
  opportunityId: string;
  chainId: number;
  collection: string;
  contract: string;
  tokenId: string;
  marketplace: string;
  expectedPrice: string;
  maxPrice: string;
  currency: string;
  estimatedGas: string;
  slippageBps: number;
  createdAt: string;
  expiresAt: string;
  executable: boolean;
}

export interface SimulationItem {
  id: string;
  intentId: string;
  state: string;
  success: boolean;
  gasEstimate: string | null;
  revertReason: string | null;
  warnings: string[];
  simulationTimestamp: string;
  executable: boolean;
}

export interface TradeItem {
  id: string;
  intentId: string;
  decisionId: string;
  opportunityId: string;
  side: "BUY" | "SELL";
  chainId: number;
  collectionSlug: string;
  contractAddress: string;
  tokenId: string;
  marketplace: string;
  price: string;
  feeAmount: string;
  currency: string;
  signerRole: "user" | "agent";
  signerAddress: string;
  txHash: string;
  executedAt: string;
  verification: {
    status: string;
    blockNumber: string;
    onChainOwner: string;
    seaportOrderCheck: string;
    verifiedAt: string;
  };
}

export interface PortfolioPosition {
  id: string;
  chainId: number;
  collectionSlug: string;
  contractAddress: string;
  tokenId: string;
  ownerRole: "user" | "agent";
  ownerAddress: string;
  acquisitionTradeId: string;
  acquisitionPrice: string;
  acquisitionFee: string;
  totalCostBasis: string;
  currentFloorPrice: string | null;
  unrealizedPnlWei: string | null;
  realizedPnlWei: string | null;
  currency: string;
  acquiredAt: string;
  status: "HELD" | "LISTED_FOR_SALE" | "SOLD";
  listedAskPrice: string | null;
  soldPrice: string | null;
  soldAt: string | null;
}

export interface TickLogItem {
  id: string;
  timestamp: string;
  mode: string;
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

export interface AppState {
  execution: string;
  signed: boolean;
  broadcast: boolean;
  supportedMarketCollections: SupportedCollection[];
  wallets: {
    activeRole: "user" | "agent";
    activeFulfiller: string | null;
    userWallet: WalletDescriptor;
    agentWallet: WalletDescriptor;
  };
  environment: {
    database: string;
    persistenceMode: string;
    openSeaApiKey: string;
    fulfillerAddress: string | null;
    rpcUrl: string;
  };
  chainTelemetry: {
    reachable: boolean;
    chainId: number | null;
    blockNumber: string | null;
    gasPriceWei: string | null;
    seaportAddress: string;
    rpcUrl: string;
    error: string | null;
  };
  constitution: {
    maxTradeValue: string | null;
    maxDailySpend: string | null;
    maxGas: string | null;
    maxSlippageBps: number | null;
    allowedChains: number[];
    allowedCollections: string[];
    blockedCollections?: string[];
    allowedMarketplaces: string[];
    allowedStrategies: string[];
    minOpportunityScore: number;
    minConfidence: number;
    buyMinScore: number;
    buyMinConfidence: number;
    watchMinScore: number;
  };
  dailySpendUsed: string;
  readBackChecksPassed: number;
  cohorts: CohortSummary[];
  snapshots: Array<{
    id: string;
    chainId: number;
    marketplace: string;
    contract: string | null;
    tokenId: string | null;
    price: string | null;
    seller: string | null;
    freshness: string;
    observedAt: string;
    payload: { source?: string; currency?: string | null; collection?: string | null };
  }>;
  opportunities: OpportunityItem[];
  rankedListings: RankedListingItem[];
  decisions: DecisionItem[];
  readiness: Array<{
    id: string;
    status: {
      protocol: string;
      ready: boolean;
      blockers: string[];
      paymentSymbol: string | null;
      approvalRequired: boolean;
      feeBps: number | null;
    };
  }>;
  intents: IntentItem[];
  intentValidations: Array<{
    decisionId: string;
    validation: {
      valid: boolean;
      violations: string[];
      warnings: string[];
    };
  }>;
  simulations: SimulationItem[];
  rpcSimulations: Array<{
    kind: string;
    chainId: number;
    to: string;
    method: string;
    state: string;
    success: boolean;
    gasEstimate: string | null;
    revertReason: string | null;
    result: unknown;
    warnings: string[];
  }>;
  trades: TradeItem[];
  portfolio: PortfolioPosition[];
  tickLogs: TickLogItem[];
}
