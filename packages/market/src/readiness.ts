import type { NormalizedListing } from "@divora/shared";

export interface FulfillmentReadiness {
  endpoint: "POST /api/v2/listings/fulfillment_data";
  protocol: "seaport-1.6";
  ready: false;
  executable: false;
  calldataReturned: false;
  simulated: false;
  blockers: string[];
  paymentToken: `0x${string}` | null;
  paymentSymbol: string | null;
  approvalRequired: boolean;
  feeBps: number | null;
}

export function assessFulfillmentReadiness(listing: NormalizedListing, input: {
  buyer?: `0x${string}` | null;
  paymentToken?: `0x${string}` | null;
  paymentSymbol?: string | null;
  considerationTotal?: string | null;
} = {}): FulfillmentReadiness {
  const blockers: string[] = [];
  if (!input.buyer) blockers.push("FULFILLER_ADDRESS_MISSING");
  if (listing.currency !== "ETH") blockers.push("CURRENCY_NOT_SUPPORTED");
  if (listing.currency && listing.currency !== "ETH") blockers.push("ERC20_APPROVAL_REQUIRED");
  if (!listing.protocolAddress) blockers.push("PROTOCOL_ADDRESS_MISSING");
  if (!listing.price) blockers.push("PRICE_MISSING");
  return {
    endpoint: "POST /api/v2/listings/fulfillment_data",
    protocol: "seaport-1.6",
    ready: false,
    executable: false,
    calldataReturned: false,
    simulated: false,
    blockers,
    paymentToken: input.paymentToken ?? null,
    paymentSymbol: input.paymentSymbol ?? listing.currency,
    approvalRequired: listing.currency !== "ETH",
    feeBps: input.considerationTotal && listing.price && /^\d+$/.test(input.considerationTotal) && /^\d+$/.test(listing.price) && BigInt(listing.price) > 0n
      ? Number((BigInt(listing.price) - BigInt(input.considerationTotal)) * 10000n / BigInt(listing.price))
      : null,
  };
}
