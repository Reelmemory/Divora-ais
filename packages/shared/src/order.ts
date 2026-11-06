export interface ProposedOrder {
  chainId: number;
  marketplace: "opensea";
  orderHash: string;
  protocolAddress: `0x${string}`;
  contract: `0x${string}`;
  tokenId: string;
  seller: string | null;
  price: string;
  currency: string | null;
  expiresAt: string | null;
  observedAt: string;
  freshness: "AVAILABLE" | "STALE";
  feesBps: number | null;
  buyer: `0x${string}`;
  maxPrice: string;
  slippageBps: number;
  estimatedGas: string;
}

export interface OrderValidation {
  valid: boolean;
  violations: string[];
  warnings: string[];
  evaluatedRules: string[];
}

export interface SeaportBasicOrderParameters {
  considerationToken: `0x${string}`;
  considerationIdentifier: string;
  considerationAmount: string;
  offerer: `0x${string}`;
  zone: `0x${string}`;
  offerToken: `0x${string}`;
  offerIdentifier: string;
  offerAmount: string;
  basicOrderType: number;
  startTime: string;
  endTime: string;
  zoneHash: `0x${string}`;
  salt: string;
  offererConduitKey: `0x${string}`;
  fulfillerConduitKey: `0x${string}`;
  totalOriginalAdditionalRecipients: string;
  additionalRecipients: Array<{ amount: string; recipient: `0x${string}` }>;
  signature: `0x${string}`;
}

export interface PreparedFulfillment {
  id: string;
  orderHash: string;
  chainId: number;
  to: `0x${string}` | null;
  value: string | null;
  functionName: string | null;
  protocol: string | null;
  basicOrderParameters?: SeaportBasicOrderParameters | null;
  source: "opensea-fulfillment_data" | "unsupported";
  executable: false;
  signed: false;
  broadcast: false;
  violations: string[];
  warnings: string[];
}
