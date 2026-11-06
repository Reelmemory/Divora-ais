export type QuoteState = "AVAILABLE" | "UNAVAILABLE" | "STALE" | "FAILED";

export interface SwapQuote {
  state: QuoteState;
  provider: "rialto" | "uniswap" | null;
  chainId: number;
  sellToken: string;
  buyToken: string;
  amountIn: string | null;
  amountOut: string | null;
  minReceived: string | null;
  priceImpactBps: number | null;
  expiresAt: string | null;
  executable: false;
  reason: string;
}

export function unavailableSwapQuote(input: {
  provider?: "rialto" | "uniswap" | null;
  chainId?: number;
  sellToken?: string;
  buyToken?: string;
  reason: string;
  state?: QuoteState;
}): SwapQuote {
  return {
    state: input.state ?? "UNAVAILABLE",
    provider: input.provider ?? null,
    chainId: input.chainId ?? 4663,
    sellToken: input.sellToken ?? "",
    buyToken: input.buyToken ?? "",
    amountIn: null,
    amountOut: null,
    minReceived: null,
    priceImpactBps: null,
    expiresAt: null,
    executable: false,
    reason: input.reason,
  };
}

export function quoteFromEnvironment(): SwapQuote {
  if (!process.env.RIALTO_API_KEY && !process.env.UNISWAP_API_KEY) {
    return unavailableSwapQuote({ reason: "No verified swap provider key is configured. Rialto and Uniswap quotes were not requested." });
  }
  return unavailableSwapQuote({ reason: "A provider key is present, but no live quote was verified in this phase." });
}
