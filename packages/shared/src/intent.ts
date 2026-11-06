export const SIMULATION_STATES = [
  "NOT_SIMULATED",
  "SIMULATING",
  "SIMULATED_SUCCESS",
  "SIMULATED_REVERT",
  "SIMULATION_UNAVAILABLE",
  "SIMULATION_ERROR",
  "STALE",
] as const;
export type SimulationState = (typeof SIMULATION_STATES)[number];

export interface TransactionIntent {
  id: string;
  orderHash?: string;
  type: "BUY_NFT";
  chainId: number;
  chainKey: string;
  collection: string;
  contract: `0x${string}`;
  tokenId: string;
  marketplace: string;
  expectedPrice: string;
  maxPrice: string;
  currency: string;
  estimatedGas: string;
  slippageBps: number;
  opportunityId: string;
  decisionId: string;
  evidence: Record<string, string | number | boolean | null>;
  createdAt: string;
  expiresAt: string;
  executable: false;
}

export interface IntentValidation {
  valid: boolean;
  violations: string[];
  warnings: string[];
  evaluatedRules: string[];
}

/** Built only from a validated intent. There is no calldata field. */
export interface StructuredTransactionRequest {
  chainId: number;
  to: `0x${string}`;
  value: string;
  marketplace: string;
  tokenId: string;
  kind: "structured-buy-intent";
}

export interface SimulationResult {
  id: string;
  intentId: string;
  state: SimulationState;
  success: boolean;
  gasEstimate: string | null;
  effectiveGasCost: string | null;
  revertReason: string | null;
  warnings: string[];
  simulationTimestamp: string;
  expiresAt: string;
  executable: false;
}

export interface Simulator {
  simulate(request: StructuredTransactionRequest): Promise<{
    state: Exclude<SimulationState, "NOT_SIMULATED" | "SIMULATING" | "STALE">;
    gasEstimate?: string;
    effectiveGasCost?: string;
    revertReason?: string;
    warnings?: string[];
  }>;
}
