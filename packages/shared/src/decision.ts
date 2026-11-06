export const DECISION_ACTIONS = ["BUY", "WATCH", "IGNORE", "REJECT"] as const;
export type DecisionAction = (typeof DECISION_ACTIONS)[number];

export const RISK_LEVELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export interface RiskFinding {
  type: "price" | "liquidity" | "collection" | "contract_data" | "staleness";
  severity: RiskLevel;
  reason: string;
  evidence: Record<string, string | number | boolean | null>;
}

export interface RiskAssessment {
  level: RiskLevel;
  findings: RiskFinding[];
}

export interface PolicyEvaluation {
  allowed: boolean;
  violations: string[];
  warnings: string[];
  evaluatedRules: string[];
}

export interface Decision {
  id: string;
  opportunityId: string;
  action: DecisionAction;
  status: "ANALYTICAL" | "EXPIRED";
  confidence: number;
  riskLevel: RiskLevel;
  reasoning: string;
  supportingSignals: string[];
  rejectionReasons: string[];
  policy: PolicyEvaluation;
  risk: RiskAssessment;
  opportunityScore: number | null;
  strategy: string | null;
  collection: string;
  createdAt: string;
  expiresAt: string;
  execution: "disabled";
}

export interface ConstitutionConfig {
  maxTradeValue: string | null;
  maxDailySpend: string | null;
  maxGas: string | null;
  maxSlippageBps: number | null;
  allowedChains: number[];
  /** Use ["*"] for market-wide multi-collection discovery, or specific contract addresses as an optional filter */
  allowedCollections: string[];
  /** Optional contract addresses explicitly excluded from market-wide trading */
  blockedCollections?: string[];
  allowedMarketplaces: string[];
  allowedStrategies: string[];
  minOpportunityScore: number;
  minConfidence: number;
  buyMinScore: number;
  buyMinConfidence: number;
  watchMinScore: number;
}

export interface PolicyInput {
  chainId: number;
  collection: string;
  strategy: string | null;
  score: number | null;
  confidence: number;
  tradeValue: string | null;
  gas: string | null;
  slippageBps: number | null;
  marketplace: string | null;
  dailySpendUsed?: string | null;
}

