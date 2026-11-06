import type { SimulationResult, Simulator, StructuredTransactionRequest } from "@divora/shared";

const ttlMs = 5 * 60 * 1000;

export async function simulateRequest(input: {
  intentId: string;
  request: StructuredTransactionRequest;
  simulator: Simulator;
  now?: Date;
}): Promise<SimulationResult> {
  const now = input.now ?? new Date();
  try {
    const result = await input.simulator.simulate(input.request);
    const success = result.state === "SIMULATED_SUCCESS";
    return {
      id: `sim:${input.intentId}`,
      intentId: input.intentId,
      state: result.state,
      success,
      gasEstimate: result.gasEstimate ?? null,
      effectiveGasCost: result.effectiveGasCost ?? null,
      revertReason: result.revertReason ?? null,
      warnings: result.warnings ?? [],
      simulationTimestamp: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
      executable: false,
    };
  } catch (error) {
    return {
      id: `sim:${input.intentId}`,
      intentId: input.intentId,
      state: "SIMULATION_ERROR",
      success: false,
      gasEstimate: null,
      effectiveGasCost: null,
      revertReason: error instanceof Error ? error.message : "simulation error",
      warnings: [],
      simulationTimestamp: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
      executable: false,
    };
  }
}

export function markStale(result: SimulationResult, now: Date): SimulationResult {
  if (new Date(result.expiresAt).getTime() >= now.getTime()) return result;
  return { ...result, state: "STALE", success: false, executable: false };
}

export const unavailableSimulator: Simulator = {
  async simulate() {
    return { state: "SIMULATION_UNAVAILABLE", warnings: ["Marketplace fulfillment simulation is not configured."] };
  },
};
