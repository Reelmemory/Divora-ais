export type PaymentKind = "native" | "erc20";
export type PaymentSymbol = "ETH" | "WETH" | "USDG";

export interface PaymentAsset {
  chainId: number;
  symbol: PaymentSymbol;
  kind: PaymentKind;
  address: `0x${string}` | null;
  decimals: number;
  verified: boolean;
  source: string;
}

/** Official Robinhood Chain assets verified against docs and RPC. */
export const ROBINHOOD_PAYMENT_ASSETS: readonly PaymentAsset[] = [
  { chainId: 4663, symbol: "ETH", kind: "native", address: null, decimals: 18, verified: true, source: "docs.robinhood.com/chain" },
  { chainId: 4663, symbol: "WETH", kind: "erc20", address: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73", decimals: 18, verified: true, source: "docs.robinhood.com/chain/contracts" },
  { chainId: 4663, symbol: "USDG", kind: "erc20", address: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168", decimals: 6, verified: true, source: "docs.robinhood.com/chain/contracts" },
];

export function paymentAsset(symbol: string, chainId = 4663): PaymentAsset | null {
  return ROBINHOOD_PAYMENT_ASSETS.find((asset) => asset.chainId === chainId && asset.symbol === symbol) ?? null;
}

export function paymentPreference(symbol: string | null): number {
  if (symbol === "ETH") return 0;
  if (symbol === "WETH") return 1;
  if (symbol === "USDG") return 2;
  if (symbol) return 3;
  return 4;
}

export function toBaseUnits(amount: string, decimals: number): bigint | null {
  if (!/^\d+(\.\d+)?$/.test(amount) || decimals < 0 || decimals > 36) return null;
  const [whole, fraction = ""] = amount.split(".");
  if (fraction.length > decimals) return null;
  return BigInt(whole + fraction.padEnd(decimals, "0"));
}

export function addBaseUnits(values: Array<string | null>): string | null {
  if (values.some((value) => value === null || !/^\d+$/.test(value ?? ""))) return null;
  return values.reduce((sum, value) => sum + BigInt(value ?? "0"), 0n).toString();
}

export interface ApprovalPlan {
  required: boolean;
  spender: `0x${string}` | null;
  amount: string | null;
  reason: string;
  executable: false;
}

export function planApproval(input: {
  currency: string | null;
  spender?: `0x${string}` | null;
  amount?: string | null;
}): ApprovalPlan {
  if (input.currency === "ETH") {
    return { required: false, spender: null, amount: null, reason: "Native ETH does not require an ERC-20 approval.", executable: false };
  }
  if (!input.currency) {
    return { required: false, spender: null, amount: null, reason: "Payment currency is missing.", executable: false };
  }
  if (!input.spender) {
    return { required: true, spender: null, amount: input.amount ?? null, reason: "ERC-20 approval is required, but no verified spender was supplied.", executable: false };
  }
  return { required: true, spender: input.spender, amount: input.amount ?? null, reason: "Approval is derived only from the supplied verified spender.", executable: false };
}
