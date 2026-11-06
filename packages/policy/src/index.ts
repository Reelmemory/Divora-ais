import type { StructuredAction } from "@divora/shared";

export interface PolicyDecision {
  allowed: boolean;
  reasons: string[];
}

export interface TradingConstitution {
  validate(action: StructuredAction): PolicyDecision;
}

/** Execution remains fail-closed. Analytical policy lives in evaluatePolicy. */
export class FailClosedConstitution implements TradingConstitution {
  validate(action: StructuredAction): PolicyDecision {
    return {
      allowed: false,
      reasons: [`execution disabled: ${action.kind} ${action.id} cannot be signed or broadcast`],
    };
  }
}

export { decide, filterDecisions } from "./decide.js";
export { evaluatePolicy } from "./evaluate.js";
export { assessRisk } from "./risk.js";
