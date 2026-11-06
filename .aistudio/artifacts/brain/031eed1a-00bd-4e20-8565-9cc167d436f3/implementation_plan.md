# Divora — Phase 12: Real Comparable Floor Pricing & End-to-End Pipeline Integrity

Divora is a deterministic, policy-governed NFT trading agent designed around the full `DISCOVER → ANALYZE → DECIDE → VALIDATE → SIMULATE → EXECUTE → VERIFY → PORTFOLIO` lifecycle on Robinhood Chain (4663). Phase 12 eliminates synthetic fallbacks, repairs comparable floor pricing on live marketplace listings, wires real intent validation, OpenSea fulfillment preparation, and Seaport 1.6 RPC simulation directly into the core pipeline, and unifies the workspace into a single deployable runtime and operator console.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural and product choices have been confirmed from your audit review and govern Phase 12 execution:

- **Confirmed Decision 1 — Phase 12 Scope Priority**: Prioritize fixing comparable floor pricing and end-to-end pipeline wiring (`DISCOVER → ANALYZE → DECIDE → VALIDATE → SIMULATE`) first before enabling live execution signing or building post-trade portfolio accounting.
- **Confirmed Decision 2 — Reference Floor Pricing**: Compute collection reference prices directly from active same-currency listings (collection floor and median / next-lowest ask) and verified on-chain/marketplace observations rather than falling back to `sellerConsideration` (`price - fee`).
- **Confirmed Decision 3 — Fail-Closed Agent Worker**: Strictly disable synthetic listing fallbacks (`allowSyntheticFallback = false`) and mock simulators in production ticks. When OpenSea or RPC dependencies are unavailable or return zero listings, the agent records the degraded/unavailable state and halts the tick cleanly without fabricating opportunities.
- **Confirmed Decision 4 — Unified Workspace Architecture**: Port and unify the Divora packages and operator console into this AI Studio environment so all domain packages, automated verification suites, API endpoints, and the live operator dashboard run cohesively on port 3000.

> [!WARNING]
> **Security & Execution Boundary**: In accordance with security requirements, private keys never enter the AI boundary, arbitrary calldata is rejected (`ARBITRARY_CALLDATA_REJECTED`), and transaction signing and broadcasting remain disabled (`executable: false`, `signed: false`, `broadcast: false`) throughout Phase 12.

---

## 1. Overview & Core Concept

- **What It Does**: Discovers live NFT listings on Robinhood Chain (4663) via OpenSea v2 and on-chain ERC-721 transfer logs, computes true same-currency collection floor reference prices, scores mispricing and liquidity using only verified evidence, evaluates deterministic trading policy and daily spend limits, constructs validated transaction intents, retrieves verified Seaport 1.6 fulfillment parameters, and executes read-only RPC buy simulations (`eth_call` + `estimateGas`).
- **Target Audience / Persona**: Quantitative NFT traders and protocol operators who require auditable, fail-closed policy enforcement, transparent signal scoring, and real on-chain Seaport simulation before authorizing capital deployment.
- **Key Value**: Bridges the gap between standalone verification scripts and the core agent pipeline—ensuring that every `BUY` decision and `SIMULATED_SUCCESS` state in the pipeline and operator console reflects real collection floor discounts, strict policy validation, and genuine Seaport 1.6 RPC simulation.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Lifecycle Pipeline Inspection & Trigger Flow**: The operator opens the unified console, inspects the live status of each stage (`DISCOVER → ANALYZE → DECIDE → VALIDATE → SIMULATE → EXECUTE → VERIFY → PORTFOLIO`), triggers an on-demand pipeline tick (for a target collection slug such as `onlyhoodpixel` or `hood-survivors-nft` and optional buyer address), and inspects step-by-step execution results and read-back verification counts.
  2. **Market Discovery & Comparable Floor Analysis Flow**: The operator filters normalized listings by collection and currency (`ETH`, `WETH`, `USDG`), comparing each listing's ask price against the computed same-currency collection floor, seller net consideration, fee basis points, and ERC-20 payment readiness (`balanceOf` and `allowance` checks).
  3. **Opportunity & Deterministic Decision Audit Flow**: The operator inspects scored opportunities (`VALID`, `INSUFFICIENT_DATA`, `STALE`, `INVALIDATED`), drills into individual signal weights (`BELOW_REFERENCE`, `ACTIVITY_SPIKE`, `WATCHLIST_HIT`, `OBSERVED_ACTIVITY_DEPTH`), and audits policy evaluations (`allowed` vs. specific violation codes like `TRADE_VALUE_EXCEEDED`, `DAILY_SPEND_EXCEEDED`, `COLLECTION_NOT_ALLOWED`).
  4. **Transaction Intent & Seaport RPC Simulation Flow**: For `BUY` decisions, the operator inspects the validated `TransactionIntent`, the prepared Seaport 1.6 `fulfillBasicOrder_efficient_6GL6yc` parameters (verified against `0x0000000000000068f116a894984e2db1123eb395`), and the live Robinhood Chain RPC simulation outcome (`SIMULATED_SUCCESS` with gas estimate or `SIMULATED_REVERT` with decoded revert reason).

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: High-density, institutional quantitative trading console with single-elevation surfaces, crisp 1px structural borders, and zero decorative clutter.
  - *Color Palette & Mood*:
    - `--background`: Deep slate canvas (`#0B0F17` / `slate-950`, 60% allocation)
    - `--surface`: Elevated structural panels (`#111827` / `slate-900`, 30% allocation) with hairline borders (`#1E293B` / `slate-800`)
    - `--primary`: High-intent emerald accent (`#10B981` / `emerald-500`, 10% allocation) reserved for primary actions and verified pass states
    - Semantic states always paired with explicit text labels: Nominal/Allowed (`#16A34A` + `VALID` / `SIMULATED_SUCCESS`), Warning/Stale (`#D97706` + `STALE` / `WATCH`), Violation/Revert (`#DC2626` + `REJECT` / `SIMULATED_REVERT`)
  - *Typography & Hierarchy*:
    - Display & Navigation: `Plus Jakarta Sans` (SemiBold 600, tight tracking)
    - Body & Policy Reasoning: `DM Sans` (Regular 400 / Medium 500, 14px–15px)
    - Financial Metrics, Wei/ETH Amounts, Hashes & Gas: `JetBrains Mono` with mandatory `tabular-nums` for vertical decimal and integer alignment.
  - *Component Styling & Layout*:
    - Full-viewport 1440px desktop layout with a 3-zone top bar contract (Brand wordmark on left, 5 single-line view navigation links in center, primary `"Run Pipeline Tick"` action button on right).
    - Unboxed metadata separated by `·` dividers (zero static pill badges).
    - Compact 40px-row data tables with client-side filtering by lifecycle status, strategy, risk level, and currency.

- **Interactive Feedback & Motion**:
  - Immediate ($\le 150\text{ms}$) filter and tab switches using compositor-only opacity transitions.
  - Skeleton table rows during live RPC and OpenSea API calls, clear empty states when `OPENSEA_API_KEY` or `DATABASE_URL` is unconfigured, and explicit error banners surfacing exact provider or policy failure reasons.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1 — Batch-Derived Same-Currency Collection Floor Reference Pricing**
  - *Chosen Approach*: Group active (`AVAILABLE`), non-expired listings by `(chainId, contractAddress, currency)` before converting listings into `MarketObservation` objects. When a collection has multiple active listings in the same currency, compute the reference price for a given listing from the comparative peer floor (the lowest ask among other active listings in the same collection/currency, or the collection median ask), and populate `listingCount` and `uniqueCounterparties` (distinct seller addresses) from the actual observed batch. If only a single listing exists and no external floor price is supplied, `referencePrice` remains `undefined` so the price signal honestly reports `PRICE_MISSING` rather than inventing a discount.
  - *Why*: Previously, `listingToObservation` fell back to `listing.sellerConsideration` (`price - fee`), which is mathematically always $\le \text{price}$ and prevented any real listing from ever scoring as `BELOW_REFERENCE`, while hardcoded fallback numbers (`transferCount: 6`, `listingCount: 3`, `uniqueCounterparties: 4`) fabricated activity and liquidity scores.
  - *Alternatives Considered*: Comparing prices across different currencies (`ETH` vs `USDG`) without a verified swap quote was rejected because raw cross-currency comparison is unsafe when swap quotes are `UNAVAILABLE`.

- **Decision 2 — Strict Pipeline Wiring for Intent Validation, OpenSea Fulfillment & Seaport RPC Simulation**
  - *Chosen Approach*: Inside `runListingPipeline`, replace the bypassed `{ valid: true } as any` call with real `validateIntent()` and `createIntent()`. Enforce idempotency by checking whether an active intent already exists for the same `decisionId` or `orderHash`. When a `BUY` intent is valid and a `buyer` address is provided, invoke `prepareBuyOrder()` (`POST /api/v2/listings/fulfillment_data`) followed by `simulateFulfillmentBuy()` (`eth_call` + `estimateGas` on Seaport 1.6 `fulfillBasicOrder_efficient_6GL6yc`) or `simulateOrderStatus()` when fulfillment data is unavailable.
  - *Why*: Ensures the main pipeline and background worker execute the exact same security validations and real RPC simulations that were previously isolated in standalone verification scripts.
  - *Alternatives Considered*: Keeping `prepareBuyOrder` outside `runListingPipeline` was rejected because it left the agent worker unable to verify whether a `BUY` decision could actually be fulfilled on-chain.

- **Decision 3 — Fail-Closed Persistence with Read-Back Verification & Graceful Dual Storage**
  - *Chosen Approach*: When a persistence store is supplied to `runListingPipeline`, any failure in persisting snapshots, opportunities, decisions, intents, or simulations halts the pipeline and returns `stage: "persistence"` with the exact error—never swallowing database errors via `console.error`. Furthermore, persist write operations verify read-back counts, and `PrismaOpportunityStore.saveOpportunity` properly refreshes nested `signals` and `scoreResult` records on `upsert`. When `DATABASE_URL` is not configured in the local sandbox, the runtime clearly reports `database: "unconfigured"` and provides an explicit read-back verified journal store so pipeline ticks and tests can still be inspected without fabricating live external database claims.
  - *Why*: Satisfies the audit requirement that database errors must fail closed and persistence must be verified through read-back, while allowing the unified app to boot and run all unit/integration tests cleanly in AI Studio.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:

```text
┌───────────────────────────────────────────────────────────────────────────────────┐
│                        DIVORA UNIFIED OPERATOR CONSOLE (UI)                       │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌───────────┐ ┌────────────┐  │
│  │ Pipeline Bar │ │ Market &     │ │ Opportunity  │ │ Policy &  │ │ Intents &  │  │
│  │ & Tick Runner│ │ Floor Table  │ │ Signal Audit │ │ Decisions │ │ Seaport RPC│  │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └─────┬─────┘ └─────┬──────┘  │
└─────────┼────────────────┼────────────────┼───────────────┼─────────────┼─────────┘
          │ POST /api/pipeline/tick         │ GET /api/state, /api/opportunities, etc.
          ▼                                 ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                     EXPRESS API & AGENT RUNTIME SERVER (PORT 3000)                │
│                                                                                   │
│  ┌──────────────────┐   ┌───────────────────────┐   ┌──────────────────────────┐  │
│  │ DISCOVER         │   │ ANALYZE               │   │ DECIDE                   │  │
│  │ • OpenSea v2 API ├──►│ • Batch Peer Floor    ├──►│ • evaluatePolicy()       │  │
│  │ • Seaport Parser │   │ • Real Seller/Listing │   │ • Daily Spend Enforcement│  │
│  │ • ERC721 Logs    │   │   Counts (No Fake #s) │   │ • assessRisk() & decide()│  │
│  └──────────────────┘   └───────────────────────┘   └────────────┬─────────────┘  │
│                                                                  │                │
│  ┌──────────────────┐   ┌───────────────────────┐   ┌────────────▼─────────────┐  │
│  │ PERSIST & VERIFY │   │ SIMULATE (Read-Only)  │   │ VALIDATE & PREPARE       │  │
│  │ • Read-Back      │◄──┤ • Seaport 1.6 Viem RPC│◄──┤ • validateIntent()       │  │
│  │   Verified Store │   │   fulfillBasicOrder   │   │ • Duplicate Intent Guard │  │
│  │ • Fail-Closed DB │   │ • ERC20 Readiness RPC │   │ • prepareBuyOrder()      │  │
│  └──────────────────┘   └───────────────────────┘   └──────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────────────┘
```

- **Data Model & State**:
  - **NormalizedListing**: Includes `orderHash`, `contractAddress`, `tokenId`, `price`, `currency`, `paymentToken`, `sellerConsideration`, `feeBps`, `protocolAddress`, `expiresAt`, and `freshness`.
  - **BatchObservationContext**: Computes per-collection, per-currency active listing count, distinct seller count (`uniqueCounterparties`), collection floor price, and peer reference price (lowest ask excluding the target token, or median ask across active same-currency listings) so discounted listings accurately compute `priceDeviation` without using `sellerConsideration` or synthetic constants.
  - **ConstitutionConfig & Daily Spend Ledger**: Enforces `allowedChains`, `allowedCollections`, `allowedMarketplaces`, `allowedStrategies`, `maxTradeValue`, `maxGas`, `maxSlippageBps`, and `maxDailySpend` (comparing cumulative `expectedPrice` of active/approved intents within the last 24 hours against `maxDailySpend`).
  - **TransactionIntent & PreparedFulfillment**: Validated intent paired with verified Seaport 1.6 `basicOrderParameters` (`considerationToken`, `offerer`, `offerToken`, `offerIdentifier`, `additionalRecipients`, `signature`) and `SimulationResult` (`SIMULATED_SUCCESS`, `SIMULATED_REVERT`, `SIMULATION_ERROR`, `SIMULATION_UNAVAILABLE`).

- **Interactive Component & State Mapping**:
  - **Pipeline Tick Controls**: Clicking `"Run Pipeline Tick"` posts collection slug, chain (`robinhood` / `4663`), and optional buyer address (`0x...`) to `/api/pipeline/tick`, executing `runListingPipeline` with real validation and Robinhood Chain RPC simulation, verifying persistence via read-back, and refreshing all UI tables.
  - **Interactive Filter Bars**: Each view (`Market`, `Opportunities`, `Decisions`, `Transactions & Simulations`, `Verification Suite`) provides working segmented filters (by status, strategy, risk level, and currency) and search inputs that filter persisted records client-side.
  - **Live Diagnostic & Unit Test Runner**: Operator can trigger read-only Robinhood Chain RPC smoke checks (`getChainId`, `getBlockNumber`, `getGasPrice`, `simulateOrderStatus`, `inspectErc20PaymentReadiness`) and view real-time verification evidence directly from the console.

- **Acceptance Criteria for Phase 12**:
  1. `listingToObservation` and `listingsToObservations` contain **zero hardcoded activity/liquidity numbers** (`6, 2, 3, 4` removed) and **never use `sellerConsideration` as `referencePrice`**.
  2. Multi-listing collection batches in the same currency deterministically compute peer reference prices so a listing priced $\ge 15\%$ below peer floor triggers `BELOW_REFERENCE` (`MISPRICED_NFT`), while floor or above-floor listings do not.
  3. `runListingPipeline` calls `validateIntent()` and `createIntent()` (removing `{ valid: true } as any`), blocks duplicate intents for the same order/decision, fails closed on any store persistence error, and verifies persisted records via read-back.
  4. `runListingPipeline` and `runAgentWorker` wire `prepareBuyOrder()` and `simulateFulfillmentBuy()` / `simulateOrderStatus()` via real Viem RPC client (`https://rpc.mainnet.chain.robinhood.com`) and default `allowSyntheticFallback` to `false`.
  5. All unit tests (`opportunities`, `policy`, `tx`, `market`) and TypeScript builds pass with zero errors, and `PROJECT_STATE.md` is updated with verified Phase 12 evidence.
