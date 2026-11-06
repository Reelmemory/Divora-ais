import type { MarketObservation, Signal } from "@divora/shared";

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function priceSignal(observation: MarketObservation): Signal {
  const base = { category: "price" as const, weight: 0.35, evidence: {} };
  if (!observation.observedPrice || !observation.referencePrice) {
    return {
      ...base,
      code: "PRICE_MISSING",
      applicable: false,
      score: 0,
      explanation: "No observed price and reference price were both collected.",
    };
  }
  const observed = Number(observation.observedPrice);
  const reference = Number(observation.referencePrice);
  if (!Number.isFinite(observed) || !Number.isFinite(reference) || reference <= 0) {
    return {
      ...base,
      code: "PRICE_UNUSABLE",
      applicable: false,
      score: 0,
      explanation: "Collected price fields were not usable numbers.",
      evidence: { observedPrice: observation.observedPrice, referencePrice: observation.referencePrice },
    };
  }
  const deviation = (reference - observed) / reference;
  return {
    ...base,
    code: deviation >= 0.15 ? "BELOW_REFERENCE" : "NEAR_REFERENCE",
    applicable: true,
    score: deviation > 0 ? clamp(deviation * 100, 0, 100) : 0,
    explanation: `Observed ${observed} against reference ${reference}. Deviation ${(deviation * 100).toFixed(2)}%.`,
    evidence: { observed, reference, deviation },
  };
}

export function activitySignal(observation: MarketObservation): Signal {
  const base = { category: "activity" as const, weight: 0.25 };
  const current = observation.transferCount;
  const prior = observation.priorTransferCount;
  if (current <= 0 && prior === undefined) {
    return {
      ...base,
      code: "ACTIVITY_MISSING",
      applicable: false,
      score: 0,
      explanation: "No transfer activity was collected for this window.",
      evidence: { transferCount: current },
    };
  }
  const increasing = prior !== undefined && current >= prior * 2 && current >= 4;
  const concentrated =
    observation.uniqueTokens !== undefined && observation.uniqueTokens > 0 && current / observation.uniqueTokens >= 3;
  const code = increasing ? "ACTIVITY_SPIKE" : concentrated ? "CONCENTRATED_ACTIVITY" : "RECENT_ACTIVITY";
  const score = increasing ? clamp(current * 8, 0, 100) : clamp(current * 4, 0, 60);
  return {
    ...base,
    code,
    applicable: current > 0,
    score: current > 0 ? score : 0,
    explanation: increasing
      ? `Transfers rose from ${prior} to ${current}.`
      : `Observed ${current} transfers in the current window.`,
    evidence: {
      transferCount: current,
      priorTransferCount: prior ?? null,
      uniqueTokens: observation.uniqueTokens ?? null,
    },
  };
}

export function smartMoneySignal(observation: MarketObservation, watchlist: readonly string[]): Signal {
  const base = { category: "smart_money" as const, weight: 0.25 };
  if (watchlist.length === 0) {
    return {
      ...base,
      code: "WATCHLIST_EMPTY",
      applicable: false,
      score: 0,
      explanation: "No smart-money watchlist is configured. Addresses are not inferred.",
      evidence: { watchlistSize: 0 },
    };
  }
  const listed = new Set(watchlist.map((item) => item.toLowerCase()));
  const hits = (observation.involvedWallets ?? []).filter((wallet) => listed.has(wallet.toLowerCase()));
  if (hits.length === 0) {
    return {
      ...base,
      code: "NO_WATCHLIST_HIT",
      applicable: false,
      score: 0,
      explanation: "None of the observed wallets are on the configured watchlist.",
      evidence: { observedWallets: observation.involvedWallets?.length ?? 0 },
    };
  }
  return {
    ...base,
    code: "WATCHLIST_HIT",
    applicable: true,
    score: 80,
    explanation: `Configured watchlist wallet involved: ${hits.join(", ")}.`,
    evidence: { hits: hits.length },
  };
}

export function liquiditySignal(observation: MarketObservation): Signal {
  const base = { category: "liquidity" as const, weight: 0.15 };
  if (observation.listingCount === undefined && observation.uniqueCounterparties === undefined) {
    return {
      ...base,
      code: "LIQUIDITY_MISSING",
      applicable: false,
      score: 0,
      explanation: "No listing count or counterparty count was collected.",
      evidence: {},
    };
  }
  const listings = observation.listingCount ?? 0;
  const parties = observation.uniqueCounterparties ?? 0;
  return {
    ...base,
    code: listings === 0 && parties < 2 ? "THIN_ACTIVITY" : "OBSERVED_ACTIVITY_DEPTH",
    applicable: true,
    score: clamp(listings * 20 + parties * 8, 0, 100),
    explanation: `Collected listings=${listings}, unique counterparties=${parties}. This is activity depth, not a venue quote.`,
    evidence: { listings, parties },
  };
}
