export const OPPORTUNITY_STATUSES = ["VALID", "STALE", "INSUFFICIENT_DATA", "INVALIDATED"] as const;
export type OpportunityStatus = (typeof OPPORTUNITY_STATUSES)[number];

export const STRATEGY_TYPES = [
  "MISPRICED_NFT",
  "ACTIVITY_SPIKE",
  "SMART_MONEY_ACTIVITY",
  "COLLECTION_MOMENTUM",
] as const;
export type StrategyType = (typeof STRATEGY_TYPES)[number];

export const SIGNAL_CATEGORIES = ["price", "activity", "smart_money", "liquidity"] as const;
export type SignalCategory = (typeof SIGNAL_CATEGORIES)[number];

export interface Signal {
  category: SignalCategory;
  code: string;
  applicable: boolean;
  score: number;
  weight: number;
  explanation: string;
  evidence: Record<string, string | number | boolean | null>;
}

export interface ScoreExplanation {
  formula: string;
  contributions: Array<{ code: string; score: number; weight: number }>;
  penalties: string[];
}

export interface StructuredRecommendation {
  recommendation: "review" | "watch" | "ignore";
  confidence: number;
  reasoning: string;
  supportingSignals: string[];
  invalidationConditions: string[];
}

/** Observations already collected. Missing fields stay absent; they are not inferred. */
export interface MarketObservation {
  chainId: number;
  chainKey: string;
  contract: `0x${string}`;
  tokenId?: string;
  collectionName?: string;
  metadataPresent: boolean;
  observedPrice?: string;
  referencePrice?: string;
  fairValue?: string;
  conflictingPrices?: string[];
  transferCount: number;
  priorTransferCount?: number;
  uniqueTokens?: number;
  uniqueCounterparties?: number;
  listingCount?: number;
  involvedWallets?: string[];
  observedAt: string;
  source: string;
}

export interface Opportunity {
  id: string;
  chainId: number;
  chainKey: string;
  contract: `0x${string}`;
  tokenId?: string;
  collectionName?: string;
  status: OpportunityStatus;
  strategy: StrategyType | null;
  score: number | null;
  confidence: number;
  observedPrice?: string;
  referencePrice?: string;
  fairValue?: string;
  priceDeviation?: number;
  signals: Signal[];
  scoreExplanation: ScoreExplanation;
  evidence: Record<string, string | number | boolean | null>;
  analysis: StructuredRecommendation;
  observedAt: string;
  expiresAt: string;
  updatedAt: string;
}

export interface OpportunityQuery {
  strategy?: StrategyType;
  chainId?: number;
  collection?: string;
  minScore?: number;
  status?: OpportunityStatus;
}
