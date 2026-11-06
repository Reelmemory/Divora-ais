import type { IntentValidation, StructuredTransactionRequest, TransactionIntent } from "@divora/shared";

export function buildTransactionRequest(intent: TransactionIntent, validation: IntentValidation): StructuredTransactionRequest {
  if (!validation.valid) throw new Error("Refusing to build from an invalid intent");
  if ("calldata" in intent || "data" in intent) throw new Error("Arbitrary calldata cannot enter the builder");
  return {
    chainId: intent.chainId,
    to: intent.contract,
    value: intent.maxPrice,
    marketplace: intent.marketplace,
    tokenId: intent.tokenId,
    kind: "structured-buy-intent",
  };
}
