export const LIFECYCLE_STAGES = [
  "DISCOVER",
  "ANALYZE",
  "DECIDE",
  "VALIDATE",
  "SIMULATE",
  "EXECUTE",
  "VERIFY",
  "PORTFOLIO",
] as const;

export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number];

export type TradeSide = "buy" | "list" | "cancel";

/** AI output boundary. Not a transaction and not calldata. */
export interface StructuredAction {
  id: string;
  kind: TradeSide;
  chainKey: string;
  stage: LifecycleStage;
  collectionAddress?: `0x${string}`;
  tokenId?: string;
  reason: string;
}

export interface HealthReport {
  status: "ok" | "degraded";
  service: string;
  phase: "0";
  timestamp: string;
  dependencies: {
    database: "unconfigured" | "configured";
    redis: "unconfigured" | "configured";
    rpc: "unconfigured" | "configured";
  };
}

export type {
  DiscoveredAsset,
  DiscoveredCollection,
  DiscoveryState,
  DiscoveryTickResult,
  NormalizedNftMetadata,
} from "./discovery.js";
export type {
  MarketObservation,
  Opportunity,
  OpportunityQuery,
  OpportunityStatus,
  ScoreExplanation,
  Signal,
  SignalCategory,
  StrategyType,
  StructuredRecommendation,
} from "./opportunity.js";
export { OPPORTUNITY_STATUSES, SIGNAL_CATEGORIES, STRATEGY_TYPES } from "./opportunity.js";
export type {
  ConstitutionConfig,
  Decision,
  DecisionAction,
  PolicyEvaluation,
  PolicyInput,
  RiskAssessment,
  RiskFinding,
  RiskLevel,
} from "./decision.js";
export { DECISION_ACTIONS, RISK_LEVELS } from "./decision.js";
export type {
  IntentValidation,
  SimulationResult,
  SimulationState,
  Simulator,
  StructuredTransactionRequest,
  TransactionIntent,
} from "./intent.js";
export { SIMULATION_STATES } from "./intent.js";
export type {
  CollectionActivity,
  FreshnessState,
  NormalizedCollection,
  NormalizedListing,
  NormalizedNft,
  ProviderResult,
} from "./market.js";
export { FRESHNESS_STATES } from "./market.js";
export type { OrderValidation, PreparedFulfillment, SeaportBasicOrderParameters, ProposedOrder } from "./order.js";
export type { ApprovalPlan, PaymentAsset, PaymentKind, PaymentSymbol } from "./payment.js";
export { ROBINHOOD_PAYMENT_ASSETS, addBaseUnits, paymentAsset, paymentPreference, planApproval, toBaseUnits } from "./payment.js";
export { PrismaOpportunityStore } from "./prisma-opportunity-store.js";