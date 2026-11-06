# Divora Project State

## Phase 12 — End-to-End Real Pipeline Integrity (Completed)

Divora operates as a multi-collection autonomous NFT trading agent across the lifecycle:
`DISCOVER → ANALYZE → DECIDE → VALIDATE → SIMULATE → (EXECUTE → VERIFY → PORTFOLIO)`

### 1. Changes Implemented in Phase 12

1. **Market-Wide Multi-Collection Discovery (`packages/market/src/opensea.ts`, `packages/nft/src/discover.ts`, `packages/policy/src/evaluate.ts`, `packages/agent/src/worker.ts`)**:
   - Global multi-collection discovery across supported collections (`allowedCollections: ["*"]`) is the default behavior; no hardcoded single-collection restriction remains.
   - `createOpenSeaProvider().getListings()` discovers multiple collections on the target chain, fetches and normalizes listings across all discovered collections, preserves each collection's slug/contract identity, and deduplicates orders by hash.
   - Optional collection filters (`collectionSlug`, `collectionSlugs`, `blockedCollections`) are supported as non-restrictive user preferences.

2. **Honest Missing-Data Representation & Removal of Synthetic Fallbacks (`packages/market/src/observe.ts`, `packages/opportunities/src/signals.ts`, `packages/opportunities/src/engine.ts`)**:
   - Removed the broken `referencePrice: ext.referencePrice ?? listing.sellerConsideration` fallback and hardcoded activity/liquidity constants (`transferCount ?? 6`, `priorTransferCount ?? 2`, `listingCount ?? 3`, `uniqueCounterparties ?? 2`).
   - Isolated listings without same-currency peer comparables or transfer history produce `referencePrice: undefined`, `fairValue: undefined`, `listingCount: undefined`, `uniqueCounterparties: undefined`, and evaluate honestly to `status: "INSUFFICIENT_DATA"`, `score: null`, `confidence: 0`.
   - `packages/agent/src/worker.ts` defaults to `allowSyntheticFallback: false` and fails closed when OpenSea market data is unavailable or empty.

3. **Collection-Specific, Currency-Aware Comparable Floor Pricing & Global Ranking (`packages/market/src/observe.ts`, `packages/market/src/rank.ts`)**:
   - `computeCollectionFloorStats()` and `listingsToObservations()` group active listings by `(chainId, contractAddress, currency)` to compute each collection's same-currency peer floor, median ask, active listing depth, and unique seller count.
   - Raw amounts are never compared across different payment currencies (`ETH` / `WETH` / `USDG`). `rankListings()` globally ranks candidates across collections by explainable opportunity score, currency preference, and same-currency integer cost.

4. **End-to-End Validation, Intent Creation, Fulfillment Retrieval & RPC Simulation Wiring (`packages/market/src/pipeline.ts`, `packages/tx/src/validate.ts`, `packages/market/src/orders.ts`, `packages/tx/src/rpc.ts`)**:
   - Removed all `as any` casts and fabricated validation objects from `runListingPipeline()`.
   - Connected `validateIntent()`, `createIntent()`, `buildTransactionRequest()`, `prepareBuyOrder()`, `simulateFulfillmentBuy()`, and `simulateOrderStatus()` directly into `runListingPipeline()`.
   - Added BigInt-safe limit checks (`exceedsLimit`) in `validateIntent()` for `maxTradeValue`, `maxGas`, and `PRICE_EXCEEDED`.

5. **Duplicate-Intent Prevention & Transactional Safeguards (`prisma/schema.prisma`, `packages/tx/src/prisma-store.ts`, `packages/market/src/pipeline.ts`)**:
   - Added `@unique` constraints on `TransactionIntentRecord.decisionId`, `TransactionIntentRecord.orderHash`, and `@@unique([chainId, contract, tokenId, marketplace])` in `prisma/schema.prisma`.
   - `runListingPipeline()` tracks both `seenDecisionIds` and `seenOrderHashes` in-batch (`DUPLICATE_INTENT_IN_BATCH`) and queries `txStore.hasActiveIntent(decision.id, now, orderHash)` (`DUPLICATE_ACTIVE_INTENT`).
   - `PrismaTransactionStore.saveIntent()` wraps active-intent verification, intent + `IntentValidationRecord` upsert, and read-back verification inside `prisma.$transaction`.

6. **Dual-Wallet Connection Boundary with Execution Disabled by Default (`packages/wallets/src/index.ts`, `server.ts`)**:
   - **Method 1 — User Connection Wallet (`ConnectedWalletProvider`, role: `user`)**: Browser EIP-1193 wallet connection (`window.ethereum`) with zero server-side key material.
   - **Method 2 — Agent Execution Wallet (`AgentWalletProvider`, role: `agent`)**: Isolated server-side vault boundary (`server_enclave_isolated`), defaulting to `executionPolicy: "disabled"`.
   - Signing, broadcasting, token approvals, and autonomous trade execution remain disabled (`execution: "disabled"`, `signed: false`, `broadcast: false`).

### 2. Verification & Test Results

- **Build & Typecheck**: `npm run prisma:generate`, `npm run build:packages`, `npm run typecheck`, and `npm run build` pass with zero errors.
- **Automated Test Suites (`npm run test:all`)**:
  - `packages/shared/test/*.mjs`: PASS
  - `packages/chains/test/*.mjs`: PASS
  - `packages/wallets/test/*.mjs`: PASS
  - `packages/nft/test/*.mjs`: PASS
  - `packages/opportunities/test/*.mjs`: PASS
  - `packages/policy/test/*.mjs`: PASS
  - `packages/tx/test/*.mjs`: PASS
  - `packages/market/test/*.mjs`: PASS (includes multi-collection discovery, missing-data `INSUFFICIENT_DATA` handling, currency-aware cohort isolation, `validateIntent` failure behavior, `prepareBuyOrder` + RPC simulation wiring, and `orderHash` duplicate-intent prevention)
- **Live Robinhood Chain (4663) RPC Verification**:
  - Verified live read-only RPC connectivity against `https://rpc.mainnet.chain.robinhood.com` (`eth_chainId = 4663`, `eth_blockNumber`, `eth_gasPrice`, `Seaport.getOrderStatus` `eth_call` + `eth_estimateGas`, and ERC-20 `USDG` / `WETH` inspection).

### 3. Remaining External Blockers

1. **`OPENSEA_API_KEY` Not Provisioned in Environment**:
   - Live OpenSea v2 API ingestion (`/api/v2/collections`, `/api/v2/listings/collection/{slug}/all`, `/api/v2/listings/fulfillment_data`) requires a valid `OPENSEA_API_KEY`. When unconfigured, `createOpenSeaProvider` and `prepareBuyOrder` fail closed with `UNAVAILABLE` / `OPENSEA_API_KEY_MISSING`.
2. **`DATABASE_URL` External PostgreSQL Instance**:
   - When `DATABASE_URL` is unconfigured or points to an unprovisioned local instance, the server reports `environment.database: "unconfigured"` honestly and uses `VerifiedJournalStore` with read-back verification (`readBackChecksPassed`), while `PrismaListingStore`, `PrismaOpportunityStore`, and `PrismaTransactionStore` perform verified writes and read-backs whenever a live PostgreSQL `DATABASE_URL` is provided.

### 4. Next Phase (Phase 13 — Controlled Execution & On-Chain Portfolio Sync)

1. Provision live `OPENSEA_API_KEY` and PostgreSQL `DATABASE_URL` secrets in runtime environment.
2. Verify live OpenSea `fulfillment_data` basic order parameters against `simulateFulfillmentBuy` (`Seaport.fulfillBasicOrder_efficient_6GL6yc`) on Robinhood Chain (`4663`).
3. Enable human-authorized execution (`EXECUTE`) with on-chain receipt + `ownerOf(tokenId)` verification (`VERIFY`) and persistent PostgreSQL `Trade` / `PortfolioPosition` ledger accounting (`PORTFOLIO`).
