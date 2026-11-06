import type { PublicClient } from "viem";
import {
  planApproval,
  type ConstitutionConfig,
  type Decision,
  type IntentValidation,
  type NormalizedListing,
  type Opportunity,
  type PreparedFulfillment,
  type ProviderResult,
  type SimulationResult,
  type Simulator,
  type StructuredTransactionRequest,
  type TransactionIntent,
} from "@divora/shared";
import { evaluateObservation, type EngineConfig } from "@divora/opportunities";
import { decide } from "@divora/policy";
import {
  buildTransactionRequest,
  createIntent,
  simulateFulfillmentBuy,
  simulateOrderStatus,
  simulateRequest,
  validateIntent,
  type RpcSimulation,
} from "@divora/tx";
import { computeCollectionFloorStats, listingsToObservations } from "./observe.js";
import { orderFromListing, prepareBuyOrder, validateOrder } from "./orders.js";
import { persistListings, type ListingStore } from "./persist.js";
import { rankListings } from "./rank.js";
import { assessFulfillmentReadiness } from "./readiness.js";
import { quoteFromEnvironment } from "./swap.js";

export interface OpportunityStore {
  saveOpportunity(opp: Opportunity): Promise<unknown>;
  saveDecision(decision: Decision): Promise<unknown>;
}

export interface PersistIntentInput {
  orderHash?: string;
  decisionId: string;
  opportunityId: string;
  chainId: number;
  contract: string;
  tokenId: string;
  marketplace: string;
  expectedPrice: string;
  maxPrice: string;
  estimatedGas: string;
  slippageBps: number;
  payload: StructuredTransactionRequest;
  validation?: IntentValidation;
  expiresAt: Date;
}

export interface TransactionStore {
  hasActiveIntent?(decisionId: string, now?: Date, orderHash?: string): Promise<boolean>;
  saveIntent(intentId: string, data: PersistIntentInput): Promise<unknown>;
  saveSimulation(result: SimulationResult): Promise<unknown>;
}

export type PipelineSimulationState =
  | {
      state: "NOT_RUN" | "SIMULATION_UNAVAILABLE" | "VALIDATION_REJECTED";
      violations?: string[];
      executable: false;
      onChain: boolean;
    }
  | (SimulationResult & { onChain: boolean });

export async function runListingPipeline(input: {
  provider: ProviderResult<NormalizedListing[]>;
  store?: ListingStore;
  opportunityStore?: OpportunityStore;
  txStore?: TransactionStore;
  simulator?: Simulator;
  publicClient?: PublicClient;
  openSeaApiKey?: string;
  fetchImpl?: typeof fetch;
  chainSlug?: string;
  engineConfig?: EngineConfig;
  config: ConstitutionConfig;
  buyer?: `0x${string}`;
  spender?: `0x${string}` | null;
  maxPrice?: string;
  dailySpendUsed?: string | null;
  slippageBps?: number;
  estimatedGas?: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const swapQuote = quoteFromEnvironment();

  if (input.provider.state !== "AVAILABLE" || !input.provider.data) {
    return {
      stage: "provider" as const,
      providerState: input.provider.state,
      error: input.provider.error,
      persisted: 0,
      persistenceError: null,
      cohorts: [],
      opportunities: [],
      rankedListings: [],
      decisions: [],
      orders: [],
      approvals: [],
      readiness: [],
      intents: [],
      intentValidations: [],
      preparedFulfillments: [],
      rpcSimulations: [],
      swapQuote,
      simulation: { state: "NOT_RUN" as const, executable: false as const, onChain: false },
    };
  }

  const persistence = input.store
    ? await persistListings(input.provider.data, input.store)
    : { persisted: 0, error: "ListingStore not provided" };

  if (persistence.error && input.store) {
    return {
      stage: "persistence" as const,
      providerState: input.provider.state,
      error: persistence.error,
      persisted: 0,
      persistenceError: persistence.error,
      cohorts: [],
      opportunities: [],
      rankedListings: [],
      decisions: [],
      orders: [],
      approvals: [],
      readiness: [],
      intents: [],
      intentValidations: [],
      preparedFulfillments: [],
      rpcSimulations: [],
      swapQuote,
      simulation: { state: "NOT_RUN" as const, executable: false as const, onChain: false },
    };
  }

  const { cohorts } = computeCollectionFloorStats(input.provider.data, now);
  const observations = listingsToObservations(input.provider.data, now);
  const opportunities = observations.map((observation) =>
    evaluateObservation(observation, input.engineConfig ?? {}, now)
  );

  const scoreByContractToken = new Map<string, number | null>();
  for (const opp of opportunities) {
    scoreByContractToken.set(`${(opp.contract ?? "").toLowerCase()}:${opp.tokenId ?? ""}`, opp.score);
  }

  if (input.opportunityStore) {
    for (const opp of opportunities) {
      try {
        await input.opportunityStore.saveOpportunity(opp);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to persist opportunity";
        return {
          stage: "persistence" as const,
          providerState: input.provider.state,
          error: message,
          persisted: persistence.persisted,
          persistenceError: message,
          cohorts,
          opportunities: [],
          rankedListings: [],
          decisions: [],
          orders: [],
          approvals: [],
          readiness: [],
          intents: [],
          intentValidations: [],
          preparedFulfillments: [],
          rpcSimulations: [],
          swapQuote,
          simulation: { state: "NOT_RUN" as const, executable: false as const, onChain: false },
        };
      }
    }
  }

  let cumulativeDailySpend =
    input.dailySpendUsed && /^\d+$/.test(input.dailySpendUsed) ? BigInt(input.dailySpendUsed) : 0n;

  const decisions = opportunities.map((opportunity) => {
    const tradeVal = opportunity.observedPrice ?? "0";
    const dec = decide(
      opportunity,
      input.config,
      {
        tradeValue: tradeVal,
        gas: input.estimatedGas ?? "0",
        slippageBps: input.slippageBps ?? 0,
        marketplace: "opensea",
        dailySpendUsed: cumulativeDailySpend.toString(),
      },
      now
    );
    if (dec.action === "BUY" && /^\d+$/.test(tradeVal)) {
      cumulativeDailySpend += BigInt(tradeVal);
    }
    return dec;
  });

  const decisionActionByKey = new Map<string, "BUY" | "WATCH" | "IGNORE" | "REJECT">();
  for (const dec of decisions) {
    const opp = opportunities.find((o) => o.id === dec.opportunityId);
    if (opp) {
      decisionActionByKey.set(`${(opp.contract ?? "").toLowerCase()}:${opp.tokenId ?? ""}`, dec.action);
    }
  }

  const rankedListings = rankListings(
    input.provider.data.map((listing) => {
      const key = `${(listing.contractAddress ?? "").toLowerCase()}:${listing.tokenId ?? ""}`;
      const feeBaseUnits =
        listing.price &&
        listing.sellerConsideration &&
        /^\d+$/.test(listing.price) &&
        /^\d+$/.test(listing.sellerConsideration)
          ? (BigInt(listing.price) - BigInt(listing.sellerConsideration)).toString()
          : "0";
      return {
        id: listing.id,
        collection: listing.collection ?? null,
        contractAddress: listing.contractAddress ?? null,
        tokenId: listing.tokenId ?? null,
        decisionAction: decisionActionByKey.get(key) ?? null,
        score: scoreByContractToken.get(key) ?? null,
        currency: listing.currency ?? "ETH",
        priceBaseUnits: listing.price,
        feeBaseUnits,
        quoteState: swapQuote.state === "AVAILABLE" ? "AVAILABLE" : "UNAVAILABLE",
      };
    })
  );

  if (input.opportunityStore) {
    for (const decision of decisions) {
      try {
        await input.opportunityStore.saveDecision(decision);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to persist decision";
        return {
          stage: "persistence" as const,
          providerState: input.provider.state,
          error: message,
          persisted: persistence.persisted,
          persistenceError: message,
          cohorts,
          opportunities,
          rankedListings,
          decisions: [],
          orders: [],
          approvals: [],
          readiness: [],
          intents: [],
          intentValidations: [],
          preparedFulfillments: [],
          rpcSimulations: [],
          swapQuote,
          simulation: { state: "NOT_RUN" as const, executable: false as const, onChain: false },
        };
      }
    }
  }

  const orders = input.provider.data.map((listing) => {
    if (!input.buyer || !input.maxPrice) {
      return { id: listing.id, validation: null, reason: "BUYER_OR_MAX_PRICE_MISSING" };
    }
    const order = orderFromListing(listing, {
      buyer: input.buyer,
      maxPrice: input.maxPrice,
      slippageBps: input.slippageBps ?? 0,
      estimatedGas: input.estimatedGas ?? "0",
      feesBps: listing.feeBps ?? null,
    });
    if (!order) return { id: listing.id, validation: null, reason: "ORDER_FIELDS_MISSING" };
    return { id: listing.id, validation: validateOrder(order, input.config, now), reason: null };
  });

  const approvals = input.provider.data.map((listing) => ({
    id: listing.id,
    plan: planApproval({
      currency: listing.currency ?? "ETH",
      spender: input.spender ?? null,
      amount: listing.price,
    }),
  }));

  const readiness = input.provider.data.map((listing) => ({
    id: listing.id,
    status: assessFulfillmentReadiness(listing, {
      buyer: input.buyer ?? null,
      paymentToken: listing.paymentToken ?? null,
      paymentSymbol: listing.currency,
      considerationTotal: listing.sellerConsideration ?? null,
    }),
  }));

  const intents: TransactionIntent[] = [];
  const intentValidations: Array<{ decisionId: string; validation: IntentValidation }> = [];
  const preparedFulfillments: PreparedFulfillment[] = [];
  const rpcSimulations: RpcSimulation[] = [];
  const seenDecisionIds = new Set<string>();
  const seenOrderHashes = new Set<string>();
  let finalSimulationState: PipelineSimulationState = {
    state: "NOT_RUN",
    executable: false,
    onChain: false,
  };

  const canSimulate = Boolean(input.simulator || input.publicClient);

  if (canSimulate && input.buyer) {
    for (const decision of decisions) {
      if (decision.action !== "BUY") continue;

      const linkedOpp = opportunities.find((o) => o.id === decision.opportunityId);
      if (!linkedOpp) continue;

      const matchingListing = input.provider.data.find(
        (l) =>
          l.contractAddress?.toLowerCase() === linkedOpp.contract.toLowerCase() &&
          (l.tokenId ?? "") === (linkedOpp.tokenId ?? "")
      );
      const orderHash = matchingListing?.id;

      if (seenDecisionIds.has(decision.id) || (orderHash && seenOrderHashes.has(orderHash.toLowerCase()))) {
        intentValidations.push({
          decisionId: decision.id,
          validation: {
            valid: false,
            violations: ["DUPLICATE_INTENT_IN_BATCH"],
            warnings: [],
            evaluatedRules: ["idempotency"],
          },
        });
        continue;
      }

      if (input.txStore?.hasActiveIntent) {
        const alreadyActive = await input.txStore.hasActiveIntent(decision.id, now, orderHash);
        if (alreadyActive) {
          intentValidations.push({
            decisionId: decision.id,
            validation: {
              valid: false,
              violations: ["DUPLICATE_ACTIVE_INTENT"],
              warnings: ["An active transaction intent already exists for this order/decision."],
              evaluatedRules: ["idempotency"],
            },
          });
          continue;
        }
      }

      const draft = {
        orderHash,
        expectedPrice: linkedOpp.observedPrice ?? "0",
        maxPrice: input.maxPrice ?? linkedOpp.observedPrice ?? "0",
        estimatedGas: input.estimatedGas ?? "150000",
        slippageBps: input.slippageBps ?? 0,
        marketplace: "opensea",
        currency: matchingListing?.currency ?? "ETH",
      };

      const validation = validateIntent({
        decision,
        opportunity: linkedOpp,
        config: input.config,
        draft,
        now,
      });
      intentValidations.push({ decisionId: decision.id, validation });

      if (!validation.valid) {
        finalSimulationState = {
          state: "VALIDATION_REJECTED",
          violations: validation.violations,
          executable: false,
          onChain: false,
        };
        continue;
      }

      seenDecisionIds.add(decision.id);
      if (orderHash) {
        seenOrderHashes.add(orderHash.toLowerCase());
      }
      const intent = createIntent({ decision, opportunity: linkedOpp, draft, now });
      intents.push(intent);

      const payload = buildTransactionRequest(intent, validation);
      const expiresAt = new Date(intent.expiresAt);

      if (input.txStore) {
        try {
          await input.txStore.saveIntent(intent.id, {
            orderHash,
            decisionId: decision.id,
            opportunityId: decision.opportunityId,
            chainId: intent.chainId,
            contract: intent.contract,
            tokenId: intent.tokenId,
            marketplace: intent.marketplace,
            expectedPrice: intent.expectedPrice,
            maxPrice: intent.maxPrice,
            estimatedGas: intent.estimatedGas,
            slippageBps: intent.slippageBps,
            payload,
            validation,
            expiresAt,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to persist transaction intent";
          return {
            stage: "persistence" as const,
            providerState: input.provider.state,
            error: message,
            persisted: persistence.persisted,
            persistenceError: message,
            cohorts,
            opportunities,
            rankedListings,
            decisions,
            orders,
            approvals,
            readiness,
            intents,
            intentValidations,
            preparedFulfillments,
            rpcSimulations,
            swapQuote,
            simulation: { state: "NOT_RUN" as const, executable: false as const, onChain: false },
          };
        }
      }

      // Real marketplace fulfillment retrieval when listing + OpenSea API key (or fetchImpl) are provided
      let fulfillment: PreparedFulfillment | null = null;
      if (matchingListing && (input.openSeaApiKey || input.fetchImpl)) {
        const proposedOrder = orderFromListing(matchingListing, {
          buyer: input.buyer,
          maxPrice: draft.maxPrice,
          slippageBps: draft.slippageBps,
          estimatedGas: draft.estimatedGas,
          feesBps: matchingListing.feeBps ?? null,
        });
        if (proposedOrder) {
          fulfillment = await prepareBuyOrder({
            order: proposedOrder,
            config: input.config,
            apiKey: input.openSeaApiKey,
            chain: input.chainSlug ?? "robinhood",
            fetchImpl: input.fetchImpl,
            now,
          });
          preparedFulfillments.push(fulfillment);
        }
      }

      // Build effective simulator: use real RPC Seaport simulation if publicClient is provided, else input.simulator
      const effectiveSimulator: Simulator = input.publicClient
        ? {
            async simulate() {
              const chainId = await input.publicClient!.getChainId();
              if (
                fulfillment &&
                fulfillment.source === "opensea-fulfillment_data" &&
                fulfillment.basicOrderParameters
              ) {
                const rpcBuy = await simulateFulfillmentBuy({
                  client: input.publicClient!,
                  chainId,
                  buyer: input.buyer!,
                  fulfillment,
                });
                rpcSimulations.push(rpcBuy);
                return {
                  state: rpcBuy.state,
                  gasEstimate: rpcBuy.gasEstimate ?? undefined,
                  revertReason: rpcBuy.revertReason ?? undefined,
                  warnings: rpcBuy.warnings,
                };
              }
              if (matchingListing?.id && /^0x[0-9a-fA-F]{64}$/.test(matchingListing.id)) {
                const rpcOrder = await simulateOrderStatus({
                  client: input.publicClient!,
                  chainId,
                  orderHash: matchingListing.id as `0x${string}`,
                  expectedChainId: linkedOpp.chainId,
                });
                rpcSimulations.push(rpcOrder);
                return {
                  state: rpcOrder.state,
                  gasEstimate: rpcOrder.gasEstimate ?? undefined,
                  revertReason: rpcOrder.revertReason ?? undefined,
                  warnings: rpcOrder.warnings,
                };
              }
              if (input.simulator) {
                return input.simulator.simulate(payload);
              }
              return {
                state: "SIMULATION_UNAVAILABLE",
                warnings: [
                  "Live RPC client connected, but listing lacks a 32-byte Seaport orderHash or verified fulfillment parameters.",
                ],
              };
            },
          }
        : input.simulator!;

      const simResult = await simulateRequest({
        intentId: intent.id,
        request: payload,
        simulator: effectiveSimulator,
        now,
      });

      if (input.txStore) {
        try {
          await input.txStore.saveSimulation(simResult);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to persist simulation result";
          return {
            stage: "persistence" as const,
            providerState: input.provider.state,
            error: message,
            persisted: persistence.persisted,
            persistenceError: message,
            cohorts,
            opportunities,
            rankedListings,
            decisions,
            orders,
            approvals,
            readiness,
            intents,
            intentValidations,
            preparedFulfillments,
            rpcSimulations,
            swapQuote,
            simulation: { state: "NOT_RUN" as const, executable: false as const, onChain: false },
          };
        }
      }

      finalSimulationState = { ...simResult, onChain: Boolean(input.publicClient) };
    }
  } else if (!canSimulate) {
    finalSimulationState = { state: "SIMULATION_UNAVAILABLE", executable: false, onChain: false };
  }

  return {
    stage: "complete" as const,
    providerState: input.provider.state,
    error: null,
    persisted: persistence.persisted,
    persistenceError: persistence.error,
    cohorts,
    opportunities,
    rankedListings,
    decisions,
    orders,
    approvals,
    readiness,
    intents,
    intentValidations,
    preparedFulfillments,
    rpcSimulations,
    swapQuote,
    simulation: finalSimulationState,
  };
}