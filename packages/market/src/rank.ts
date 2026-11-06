import { addBaseUnits, paymentPreference } from "@divora/shared";

export interface RankableListing {
  id: string;
  collection?: string | null;
  contractAddress?: string | null;
  tokenId?: string | null;
  decisionAction?: "BUY" | "WATCH" | "IGNORE" | "REJECT" | null;
  score: number | null;
  currency: string | null;
  priceBaseUnits: string | null;
  feeBaseUnits?: string | null;
  gasWei?: string | null;
  approvalGasWei?: string | null;
  swapCostWei?: string | null;
  quoteEthWei?: string | null;
  quoteState?: "AVAILABLE" | "UNAVAILABLE" | "STALE" | "FAILED" | "NONE";
}

export interface RankedListing extends RankableListing {
  rank: number;
  sameCurrencyCost: string | null;
  comparableEthWei: string | null;
  reason: string;
}

function decisionPriority(action?: string | null): number {
  if (action === "BUY") return 0;
  if (action === "WATCH") return 1;
  if (action === "IGNORE") return 2;
  if (action === "REJECT") return 3;
  return 1;
}

export function sameCurrencyCost(item: RankableListing): string | null {
  if (!item.currency || !item.priceBaseUnits) return null;
  if (item.currency === "ETH" || item.currency === "WETH") {
    return addBaseUnits([item.priceBaseUnits, item.feeBaseUnits ?? "0", item.gasWei ?? "0", item.approvalGasWei ?? "0", item.swapCostWei ?? "0"]);
  }
  return addBaseUnits([item.priceBaseUnits, item.feeBaseUnits ?? "0"]);
}

export function rankListings(items: RankableListing[]): RankedListing[] {
  const ranked = items.map((item) => {
    const comparableEthWei = item.quoteState === "AVAILABLE" && item.quoteEthWei && /^\d+$/.test(item.quoteEthWei) ? item.quoteEthWei : null;
    return {
      ...item,
      rank: 0,
      sameCurrencyCost: sameCurrencyCost(item),
      comparableEthWei,
      reason: comparableEthWei
        ? "Ranked by decision eligibility, verified ETH quote, then payment preference."
        : "Ranked by decision eligibility, score, then ETH/WETH preference. Cross-currency amounts were not compared.",
    };
  });
  ranked.sort((a, b) => {
    if (a.decisionAction && b.decisionAction && a.decisionAction !== b.decisionAction) {
      return decisionPriority(a.decisionAction) - decisionPriority(b.decisionAction);
    }
    const scoreA = a.score ?? -1;
    const scoreB = b.score ?? -1;
    if (scoreA !== scoreB) return scoreB - scoreA;
    if (a.comparableEthWei && b.comparableEthWei && a.comparableEthWei !== b.comparableEthWei) {
      return BigInt(a.comparableEthWei) < BigInt(b.comparableEthWei) ? -1 : 1;
    }
    const pref = paymentPreference(a.currency) - paymentPreference(b.currency);
    if (pref !== 0) return pref;
    if (a.currency === b.currency && a.sameCurrencyCost && b.sameCurrencyCost) {
      return BigInt(a.sameCurrencyCost) < BigInt(b.sameCurrencyCost) ? -1 : BigInt(a.sameCurrencyCost) > BigInt(b.sameCurrencyCost) ? 1 : 0;
    }
    return 0;
  });
  return ranked.map((item, index) => ({ ...item, rank: index + 1 }));
}
