import type { ConstitutionConfig, PolicyEvaluation, PolicyInput } from "@divora/shared";

export function evaluatePolicy(config: ConstitutionConfig, input: PolicyInput): PolicyEvaluation {
  const violations: string[] = [];
  const warnings: string[] = [];
  const evaluatedRules = [
    "allowedChains",
    "allowedCollections",
    "allowedStrategies",
    "allowedMarketplaces",
    "minOpportunityScore",
    "minConfidence",
    "maxTradeValue",
    "maxDailySpend",
    "maxGas",
    "maxSlippage",
  ];
  if (config.allowedChains.length === 0 || !config.allowedChains.includes(input.chainId)) violations.push("CHAIN_NOT_ALLOWED");
  const collection = input.collection.toLowerCase();
  if (config.blockedCollections && config.blockedCollections.some((item) => item.toLowerCase() === collection)) {
    violations.push("COLLECTION_BLOCKED");
  }
  const allowsAllCollections = config.allowedCollections.includes("*");
  if (
    !allowsAllCollections &&
    (config.allowedCollections.length === 0 || !config.allowedCollections.some((item) => item.toLowerCase() === collection))
  ) {
    violations.push("COLLECTION_NOT_ALLOWED");
  }
  if (!input.strategy || config.allowedStrategies.length === 0 || !config.allowedStrategies.includes(input.strategy)) violations.push("STRATEGY_NOT_ALLOWED");
  if (config.allowedMarketplaces.length === 0 || !input.marketplace || !config.allowedMarketplaces.includes(input.marketplace)) violations.push("MARKETPLACE_NOT_ALLOWED");
  if (input.score === null || input.score < config.minOpportunityScore) violations.push("OPPORTUNITY_SCORE_TOO_LOW");
  if (input.confidence < config.minConfidence) violations.push("CONFIDENCE_TOO_LOW");
  if (config.maxTradeValue === null || input.tradeValue === null || Number(input.tradeValue) > Number(config.maxTradeValue)) violations.push("TRADE_VALUE_EXCEEDED");
  if (config.maxGas === null || input.gas === null || Number(input.gas) > Number(config.maxGas)) violations.push("GAS_LIMIT_EXCEEDED");
  if (config.maxSlippageBps === null || input.slippageBps === null || input.slippageBps > config.maxSlippageBps) violations.push("SLIPPAGE_EXCEEDED");
  if (config.maxDailySpend === null) {
    warnings.push("MAX_DAILY_SPEND_UNCONFIGURED");
  } else if (
    input.dailySpendUsed != null &&
    input.tradeValue !== null &&
    Number(input.dailySpendUsed) + Number(input.tradeValue) > Number(config.maxDailySpend)
  ) {
    violations.push("DAILY_SPEND_EXCEEDED");
  }
  return { allowed: violations.length === 0, violations, warnings, evaluatedRules };
}

