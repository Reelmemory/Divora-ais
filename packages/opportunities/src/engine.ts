import type { MarketObservation, Opportunity, ScoreExplanation, Signal, StrategyType, StructuredRecommendation } from "@divora/shared";
import { activitySignal, clamp, liquiditySignal, priceSignal, smartMoneySignal } from "./signals.js";

export interface EngineConfig {
  watchlist?: readonly string[];
  staleAfterMs?: number;
}

export function scoreSignals(signals: Signal[]): { total: number | null; explanation: ScoreExplanation } {
  const applicable = signals.filter((signal) => signal.applicable);
  const explanation: ScoreExplanation = {
    formula: "weighted average of applicable signal scores, clamped to 0..100",
    contributions: applicable.map((signal) => ({ code: signal.code, score: signal.score, weight: signal.weight })),
    penalties: signals.filter((signal) => !signal.applicable).map((signal) => signal.code),
  };
  if (applicable.length === 0) return { total: null, explanation };
  const weight = applicable.reduce((sum, signal) => sum + signal.weight, 0);
  const raw = applicable.reduce((sum, signal) => sum + clamp(signal.score, 0, 100) * signal.weight, 0) / weight;
  return { total: Math.round(clamp(raw, 0, 100) * 100) / 100, explanation };
}

export function detectStrategy(signals: Signal[]): StrategyType | null {
  const applicable = signals.filter((signal) => signal.applicable);
  if (applicable.length === 0) return null;

  const primarySignals = applicable
    .filter(
      (signal) =>
        (signal.category === "price" && signal.code === "BELOW_REFERENCE") ||
        signal.category === "smart_money" ||
        signal.code === "ACTIVITY_SPIKE"
    )
    .sort((a, b) => b.score * b.weight - a.score * a.weight || b.score - a.score);

  const strongest = primarySignals[0] ?? applicable.sort((a, b) => b.score - a.score)[0];
  if (!strongest) return null;
  if (strongest.category === "price" && strongest.code === "BELOW_REFERENCE") return "MISPRICED_NFT";
  if (strongest.category === "smart_money") return "SMART_MONEY_ACTIVITY";
  if (strongest.code === "ACTIVITY_SPIKE") return "ACTIVITY_SPIKE";
  if (strongest.category === "activity" || strongest.category === "liquidity") return "COLLECTION_MOMENTUM";
  return null;
}

export function recommendationFor(opportunity: Pick<Opportunity, "status" | "score" | "confidence" | "signals" | "strategy">): StructuredRecommendation {
  const supportingSignals = opportunity.signals.filter((signal) => signal.applicable).map((signal) => signal.code);
  if (opportunity.status !== "VALID" || opportunity.score === null) {
    return {
      recommendation: "ignore",
      confidence: opportunity.confidence,
      reasoning: `Status ${opportunity.status}. No executable action is produced.`,
      supportingSignals,
      invalidationConditions: ["status is not VALID", "required observations are missing or expired"],
    };
  }
  return {
    recommendation: opportunity.score >= 60 ? "review" : "watch",
    confidence: opportunity.confidence,
    reasoning: `Strongest strategy ${opportunity.strategy ?? "none"} scored ${opportunity.score}. Review only; policy still blocks execution.`,
    supportingSignals,
    invalidationConditions: ["observation expires", "a conflicting price is collected", "watchlist membership changes"],
  };
}

export function opportunityId(observation: MarketObservation): string {
  return `${observation.chainId}:${observation.contract.toLowerCase()}:${observation.tokenId ?? "collection"}`;
}

export function evaluateObservation(observation: MarketObservation, config: EngineConfig = {}, now = new Date()): Opportunity {
  const signals = [
    priceSignal(observation),
    activitySignal(observation),
    smartMoneySignal(observation, config.watchlist ?? []),
    liquiditySignal(observation),
  ];
  const scored = scoreSignals(signals);
  const observedAt = new Date(observation.observedAt);
  const staleAfterMs = config.staleAfterMs ?? 15 * 60 * 1000;
  const expiresAt = new Date(observedAt.getTime() + staleAfterMs);
  const prices = [observation.observedPrice, ...(observation.conflictingPrices ?? [])].filter(Boolean).map(Number);
  const conflicting = prices.length >= 2 && Math.max(...prices) > 0 && (Math.max(...prices) - Math.min(...prices)) / Math.max(...prices) > 0.5;
  let status: Opportunity["status"] = "VALID";
  if (conflicting) status = "INVALIDATED";
  else if (now.getTime() > expiresAt.getTime()) status = "STALE";
  else if (scored.total === null) status = "INSUFFICIENT_DATA";

  const applicable = signals.filter((signal) => signal.applicable).length;
  let confidence = Math.round((applicable / signals.length) * 100);
  if (!observation.metadataPresent) confidence = Math.max(0, confidence - 15);
  const deviation = signals.find((signal) => signal.code === "BELOW_REFERENCE" || signal.code === "NEAR_REFERENCE")?.evidence.deviation;

  const draft: Opportunity = {
    id: opportunityId(observation),
    chainId: observation.chainId,
    chainKey: observation.chainKey,
    contract: observation.contract,
    tokenId: observation.tokenId,
    collectionName: observation.collectionName,
    status,
    strategy: status === "VALID" ? detectStrategy(signals) : detectStrategy(signals),
    score: status === "INSUFFICIENT_DATA" || status === "INVALIDATED" ? null : scored.total,
    confidence,
    observedPrice: observation.observedPrice,
    referencePrice: observation.referencePrice,
    fairValue: observation.fairValue,
    priceDeviation: typeof deviation === "number" ? deviation : undefined,
    signals,
    scoreExplanation: scored.explanation,
    evidence: {
      source: observation.source,
      transferCount: observation.transferCount,
      metadataPresent: observation.metadataPresent,
    },
    analysis: { recommendation: "ignore", confidence: 0, reasoning: "", supportingSignals: [], invalidationConditions: [] },
    observedAt: observation.observedAt,
    expiresAt: expiresAt.toISOString(),
    updatedAt: now.toISOString(),
  };
  draft.analysis = recommendationFor(draft);
  return draft;
}

export function upsertOpportunity(existing: Opportunity | undefined, next: Opportunity): Opportunity {
  if (!existing) return next;
  return { ...next, id: existing.id };
}

export function filterOpportunities(items: Opportunity[], query: {
  strategy?: string;
  chainId?: number;
  collection?: string;
  minScore?: number;
  status?: string;
}): Opportunity[] {
  return items.filter((item) => {
    if (query.strategy && item.strategy !== query.strategy) return false;
    if (query.chainId !== undefined && item.chainId !== query.chainId) return false;
    if (query.collection && item.contract.toLowerCase() !== query.collection.toLowerCase() && item.collectionName !== query.collection) return false;
    if (query.status && item.status !== query.status) return false;
    if (query.minScore !== undefined && (item.score === null || item.score < query.minScore)) return false;
    return true;
  });
}
