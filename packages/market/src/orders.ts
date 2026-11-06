import type { ConstitutionConfig, NormalizedListing, OrderValidation, PreparedFulfillment, ProposedOrder, SeaportBasicOrderParameters } from "@divora/shared";

const SEAPORT_16 = "0x0000000000000068f116a894984e2db1123eb395";

export function orderFromListing(listing: NormalizedListing, input: {
  buyer: `0x${string}`;
  maxPrice: string;
  slippageBps: number;
  estimatedGas: string;
  protocolAddress?: `0x${string}`;
  feesBps?: number | null;
}): ProposedOrder | null {
  if (!listing.contractAddress || !listing.tokenId || !listing.price) return null;
  return {
    chainId: listing.chainId,
    marketplace: "opensea",
    orderHash: listing.id,
    protocolAddress: input.protocolAddress ?? listing.protocolAddress ?? SEAPORT_16,
    contract: listing.contractAddress,
    tokenId: listing.tokenId,
    seller: listing.seller,
    price: listing.price,
    currency: listing.currency,
    expiresAt: listing.expiresAt,
    observedAt: listing.observedAt,
    freshness: listing.freshness === "AVAILABLE" ? "AVAILABLE" : "STALE",
    feesBps: input.feesBps ?? listing.feeBps ?? null,
    buyer: input.buyer,
    maxPrice: input.maxPrice,
    slippageBps: input.slippageBps,
    estimatedGas: input.estimatedGas,
  };
}

export function validateOrder(order: ProposedOrder, config: ConstitutionConfig, now = new Date()): OrderValidation {
  const violations: string[] = [];
  const warnings: string[] = [];
  const evaluatedRules = ["chain", "marketplace", "identity", "freshness", "price", "currency", "policy", "approvals"];
  if (order.chainId !== 4663 || !config.allowedChains.includes(order.chainId)) violations.push("CHAIN_NOT_ALLOWED");
  if (order.marketplace !== "opensea" || !config.allowedMarketplaces.includes(order.marketplace)) violations.push("MARKETPLACE_NOT_ALLOWED");
  if (!order.orderHash || !order.contract || !order.tokenId || !order.seller || !order.buyer) violations.push("REQUIRED_FIELDS_MISSING");
  if (order.protocolAddress.toLowerCase() !== SEAPORT_16) violations.push("PROTOCOL_NOT_SUPPORTED");
  if (order.freshness !== "AVAILABLE" || (order.expiresAt && new Date(order.expiresAt).getTime() <= now.getTime())) violations.push("LISTING_STALE");
  if (!/^\d+$/.test(order.price) || !/^\d+$/.test(order.maxPrice)) violations.push("PRICE_UNITS_INVALID");
  else if (BigInt(order.price) > BigInt(order.maxPrice)) violations.push("PRICE_CHANGED");
  if (order.currency !== null && order.currency !== "ETH") violations.push("CURRENCY_NOT_SUPPORTED");
  if (config.maxTradeValue === null || Number(order.maxPrice) > Number(config.maxTradeValue)) violations.push("TRADE_VALUE_EXCEEDED");
  if (config.maxGas === null || Number(order.estimatedGas) > Number(config.maxGas)) violations.push("GAS_LIMIT_EXCEEDED");
  if (config.maxSlippageBps === null || order.slippageBps > config.maxSlippageBps) violations.push("SLIPPAGE_EXCEEDED");
  if (
    config.blockedCollections &&
    config.blockedCollections.some((item) => item.toLowerCase() === order.contract.toLowerCase())
  ) {
    violations.push("COLLECTION_BLOCKED");
  }
  const allowsAllCollections = config.allowedCollections.includes("*");
  if (
    !allowsAllCollections &&
    (config.allowedCollections.length === 0 ||
      !config.allowedCollections.some((item) => item.toLowerCase() === order.contract.toLowerCase()))
  ) {
    violations.push("COLLECTION_NOT_ALLOWED");
  }
  if (order.feesBps === null) warnings.push("FEES_UNAVAILABLE");
  if (order.currency !== null && order.currency !== "ETH") violations.push("APPROVAL_REQUIRED");
  return { valid: violations.length === 0, violations: [...new Set(violations)], warnings, evaluatedRules };
}

function parseBasicOrderParameters(raw: unknown): SeaportBasicOrderParameters | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.considerationToken !== "string" || typeof p.offerer !== "string" || typeof p.offerToken !== "string" || typeof p.signature !== "string") return null;
  const recipients = Array.isArray(p.additionalRecipients)
    ? p.additionalRecipients.map((r: unknown) => {
        const rec = r as Record<string, unknown>;
        return { amount: String(rec.amount ?? "0"), recipient: String(rec.recipient ?? "0x0000000000000000000000000000000000000000") as `0x${string}` };
      })
    : [];
  return {
    considerationToken: p.considerationToken as `0x${string}`,
    considerationIdentifier: String(p.considerationIdentifier ?? "0"),
    considerationAmount: String(p.considerationAmount ?? "0"),
    offerer: p.offerer as `0x${string}`,
    zone: String(p.zone ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
    offerToken: p.offerToken as `0x${string}`,
    offerIdentifier: String(p.offerIdentifier ?? "0"),
    offerAmount: String(p.offerAmount ?? "1"),
    basicOrderType: Number(p.basicOrderType ?? 0),
    startTime: String(p.startTime ?? "0"),
    endTime: String(p.endTime ?? "0"),
    zoneHash: String(p.zoneHash ?? "0x0000000000000000000000000000000000000000000000000000000000000000") as `0x${string}`,
    salt: String(p.salt ?? "0"),
    offererConduitKey: String(p.offererConduitKey ?? "0x0000000000000000000000000000000000000000000000000000000000000000") as `0x${string}`,
    fulfillerConduitKey: String(p.fulfillerConduitKey ?? "0x0000000000000000000000000000000000000000000000000000000000000000") as `0x${string}`,
    totalOriginalAdditionalRecipients: String(p.totalOriginalAdditionalRecipients ?? recipients.length),
    additionalRecipients: recipients,
    signature: p.signature as `0x${string}`,
  };
}

export function parseFulfillment(body: unknown, order: ProposedOrder): PreparedFulfillment | null {
  if (!body || typeof body !== "object") return null;
  const record = body as { protocol?: unknown; fulfillment_data?: { transaction?: { to?: unknown; value?: unknown; function?: unknown; chain?: unknown; input_data?: { parameters?: unknown } } } };
  const tx = record.fulfillment_data?.transaction;
  if (typeof record.protocol !== "string" || !tx || typeof tx.to !== "string" || typeof tx.value !== "string" || typeof tx.function !== "string" || typeof tx.chain !== "number") return null;
  if (tx.chain !== order.chainId || tx.to.toLowerCase() !== order.protocolAddress.toLowerCase()) return null;
  const basicOrderParameters = parseBasicOrderParameters(tx.input_data?.parameters);
  return {
    id: `fulfillment:${order.orderHash}`,
    orderHash: order.orderHash,
    chainId: order.chainId,
    to: tx.to as `0x${string}`,
    value: tx.value,
    functionName: tx.function,
    protocol: record.protocol,
    basicOrderParameters,
    source: "opensea-fulfillment_data",
    executable: false,
    signed: false,
    broadcast: false,
    violations: [],
    warnings: ["Provider calldata is not retained and was not sent."],
  };
}

export async function prepareBuyOrder(input: {
  order: ProposedOrder;
  config: ConstitutionConfig;
  apiKey?: string;
  chain?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  now?: Date;
}): Promise<PreparedFulfillment> {
  const validation = validateOrder(input.order, input.config, input.now);
  if (!validation.valid) {
    return unsupported(input.order, validation.violations, validation.warnings);
  }
  if (!input.apiKey) return unsupported(input.order, ["OPENSEA_API_KEY_MISSING"], validation.warnings);
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(`${input.baseUrl ?? "https://api.opensea.io"}/api/v2/listings/fulfillment_data`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": input.apiKey },
    body: JSON.stringify({
      listing: { hash: input.order.orderHash, chain: input.chain ?? "robinhood", protocol_address: input.order.protocolAddress },
      fulfiller: { address: input.order.buyer },
    }),
  });
  if (!response.ok) return unsupported(input.order, [`PROVIDER_STATUS_${response.status}`], validation.warnings);
  const parsed = parseFulfillment(await response.json(), input.order);
  if (!parsed) return unsupported(input.order, ["MALFORMED_FULFILLMENT"], validation.warnings);
  return { ...parsed, warnings: [...validation.warnings, ...parsed.warnings] };
}

function unsupported(order: ProposedOrder, violations: string[], warnings: string[]): PreparedFulfillment {
  return {
    id: `fulfillment:${order.orderHash}`,
    orderHash: order.orderHash,
    chainId: order.chainId,
    to: null,
    value: null,
    functionName: null,
    protocol: null,
    basicOrderParameters: null,
    source: "unsupported",
    executable: false,
    signed: false,
    broadcast: false,
    violations,
    warnings,
  };
}
