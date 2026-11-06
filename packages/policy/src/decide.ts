import type { ConstitutionConfig, Decision, Opportunity, PolicyInput, StructuredRecommendation } from "@divora/shared";
import { evaluatePolicy } from "./evaluate.js";
import { assessRisk } from "./risk.js";

export interface DecisionContext {
  tradeValue?: string | null;
  gas?: string | null;
  slippageBps?: number | null;
  marketplace?: string | null;
  dailySpendUsed?: string | null;
  analysis?: StructuredRecommendation | null;
}

export function decide(opportunity: Opportunity, config: ConstitutionConfig, context: DecisionContext = {}, now = new Date()): Decision {
  const risk = assessRisk(opportunity, now);
  if (risk.level === "CRITICAL") {
    /* recorded as a policy override below */
  }
  const policy = evaluatePolicy(config, {
    chainId: opportunity.chainId,
    collection: opportunity.contract,
    strategy: opportunity.strategy,
    score: opportunity.score,
    confidence: opportunity.confidence,
    tradeValue: context.tradeValue ?? null,
    gas: context.gas ?? null,
    slippageBps: context.slippageBps ?? null,
    marketplace: context.marketplace ?? null,
    dailySpendUsed: context.dailySpendUsed ?? null,
  } satisfies PolicyInput);
  if (risk.level === "HIGH") policy.violations.push("HIGH_RISK");
  if (risk.level === "CRITICAL") policy.violations.push("CRITICAL_RISK");
  policy.allowed = policy.violations.length === 0;

  const analysis = sanitizeAnalysis(context.analysis);
  const supportingSignals = analysis?.supportingSignals ?? opportunity.signals.filter((signal) => signal.applicable).map((signal) => signal.code);
  let action: Decision["action"] = "IGNORE";
  const rejectionReasons = [...policy.violations];
  if (!policy.allowed || risk.level === "CRITICAL") action = "REJECT";
  else if (opportunity.status === "INSUFFICIENT_DATA" || opportunity.score === null) action = "IGNORE";
  else if (
    risk.level === "LOW" &&
    opportunity.score >= config.buyMinScore &&
    opportunity.confidence >= config.buyMinConfidence
  ) action = "BUY";
  else if (opportunity.score >= config.watchMinScore) action = "WATCH";

  const reasoning = [
    analysis?.reasoning,
    `Risk ${risk.level}. Policy ${policy.allowed ? "allowed" : "denied"}.`,
    action === "BUY" ? "BUY is analytical only and was not executed." : "No execution path was used.",
  ].filter(Boolean).join(" ");

  return {
    id: `decision:${opportunity.id}`,
    opportunityId: opportunity.id,
    action,
    status: new Date(opportunity.expiresAt).getTime() < now.getTime() ? "EXPIRED" : "ANALYTICAL",
    confidence: opportunity.confidence,
    riskLevel: risk.level,
    reasoning,
    supportingSignals,
    rejectionReasons,
    policy,
    risk,
    opportunityScore: opportunity.score,
    strategy: opportunity.strategy,
    collection: opportunity.contract,
    createdAt: now.toISOString(),
    expiresAt: opportunity.expiresAt,
    execution: "disabled",
  };
}

function sanitizeAnalysis(analysis: StructuredRecommendation | null | undefined): StructuredRecommendation | null {
  if (!analysis || typeof analysis.reasoning !== "string" || !Array.isArray(analysis.supportingSignals)) return null;
  return analysis;
}

export function filterDecisions(items: Decision[], query: {
  action?: string;
  riskLevel?: string;
  strategy?: string;
  collection?: string;
  minConfidence?: number;
  status?: string;
}): Decision[] {
  return items.filter((item) => {
    if (query.action && item.action !== query.action) return false;
    if (query.riskLevel && item.riskLevel !== query.riskLevel) return false;
    if (query.strategy && item.strategy !== query.strategy) return false;
    if (query.collection && item.collection.toLowerCase() !== query.collection.toLowerCase()) return false;
    if (query.minConfidence !== undefined && item.confidence < query.minConfidence) return false;
    if (query.status && item.status !== query.status) return false;
    return true;
  });
}
