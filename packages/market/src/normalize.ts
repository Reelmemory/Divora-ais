import type { FreshnessState, NormalizedListing } from "@divora/shared";

export function listingFreshness(listing: Pick<NormalizedListing, "observedAt" | "expiresAt">, now: Date, ttlMs: number): FreshnessState {
  if (listing.expiresAt && new Date(listing.expiresAt).getTime() <= now.getTime()) return "STALE";
  if (now.getTime() - new Date(listing.observedAt).getTime() > ttlMs) return "STALE";
  return "AVAILABLE";
}

interface SeaportConsiderationItem {
  itemType?: number;
  token?: string;
  startAmount?: string;
  endAmount?: string;
  recipient?: string;
}

export function normalizeOpenSeaOrder(input: {
  chainId: number;
  order: Record<string, unknown>;
  observedAt: string;
  collectionSlug?: string;
}): NormalizedListing | null {
  const order = input.order;
  if (!order || typeof order.order_hash !== "string") return null;
  const maker = order.maker as { address?: string } | undefined;
  const parameters = (order.protocol_data as {
    parameters?: {
      offer?: Array<{ token?: string; identifierOrCriteria?: string }>;
      consideration?: SeaportConsiderationItem[];
      offerer?: string;
      endTime?: string | number;
    };
  } | undefined)?.parameters;
  const offer = (parameters?.offer ?? [])[0];
  const contract = typeof offer?.token === "string" ? offer.token as `0x${string}` : null;
  const tokenId = offer?.identifierOrCriteria != null ? String(offer.identifierOrCriteria) : null;
  const priceObject = order.price as { current?: { value?: string; currency?: string } } | undefined;
  const price = typeof order.current_price === "string" ? order.current_price : typeof priceObject?.current?.value === "string" ? priceObject.current.value : null;
  const currency = typeof priceObject?.current?.currency === "string" ? priceObject.current.currency : null;
  const endTime = parameters?.endTime ?? order.expiration_time;
  const expiration = typeof endTime === "number" && endTime > 0 ? new Date(endTime * 1000).toISOString() : typeof endTime === "string" && /^\d+$/.test(endTime) ? new Date(Number(endTime) * 1000).toISOString() : null;
  const seller = typeof maker?.address === "string" ? maker.address : typeof parameters?.offerer === "string" ? parameters.offerer : null;
  const protocol = typeof order.protocol_address === "string" ? order.protocol_address as `0x${string}` : null;
  const freshness = expiration && new Date(expiration).getTime() <= new Date(input.observedAt).getTime() ? "STALE" : "AVAILABLE";

  const consideration = Array.isArray(parameters?.consideration) ? parameters.consideration : [];
  const firstToken = consideration.find((item) => typeof item?.token === "string" && /^0x[0-9a-fA-F]{40}$/.test(item.token))?.token ?? null;
  const zeroAddress = "0x0000000000000000000000000000000000000000";
  const paymentToken = firstToken && firstToken.toLowerCase() !== zeroAddress ? (firstToken as `0x${string}`) : null;

  let sellerConsideration: string | null = null;
  let feeBps: number | null = null;
  if (seller && consideration.length > 0) {
    const sellerItems = consideration.filter(
      (item) => typeof item?.recipient === "string" && item.recipient.toLowerCase() === seller.toLowerCase() && typeof item?.startAmount === "string" && /^\d+$/.test(item.startAmount)
    );
    if (sellerItems.length > 0) {
      const sellerSum = sellerItems.reduce((acc, item) => acc + BigInt(item.startAmount!), 0n);
      sellerConsideration = sellerSum.toString();
      if (price && /^\d+$/.test(price) && BigInt(price) > 0n && BigInt(price) >= sellerSum) {
        feeBps = Number(((BigInt(price) - sellerSum) * 10000n) / BigInt(price));
      }
    }
  }

  return {
    id: order.order_hash,
    chainId: input.chainId,
    marketplace: "opensea",
    collection:
      typeof order.collection_slug === "string"
        ? order.collection_slug
        : typeof input.collectionSlug === "string"
        ? input.collectionSlug
        : null,
    contractAddress: contract,
    tokenId,
    seller,
    price,
    currency,
    paymentToken,
    sellerConsideration,
    feeBps,
    expiresAt: expiration,
    protocolAddress: protocol,
    source: "opensea",
    observedAt: input.observedAt,
    freshness,
  };
}
