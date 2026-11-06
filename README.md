# Divora — Multi-Collection Autonomous NFT Trading Agent

Divora is a deterministic, policy-governed autonomous NFT trading agent built for **Robinhood Chain (Chain ID `4663`)** and EVM-compatible marketplaces (Seaport 1.6 / OpenSea v2).

It operates across the full 8-stage trading lifecycle:

```text
DISCOVER → ANALYZE → DECIDE → VALIDATE → SIMULATE → EXECUTE → VERIFY → PORTFOLIO
```

---

## 1. Core Capabilities

1. **Market-Wide Multi-Collection Discovery (`@divora/market`, `@divora/nft`)**
   - Dynamically discovers and ingests listings across multiple NFT collections on OpenSea v2 (`createOpenSeaProvider`) and on-chain ERC-721 `Transfer` logs (`runDiscoveryTick`).
   - Defaults to market-wide scanning (`allowedCollections: ["*"]`), with optional collection allowlist or blocklist filters.
2. **Per-Collection Same-Currency Floor Analysis (`@divora/market`, `@divora/opportunities`)**
   - Groups active listings by `(chainId, contractAddress, currency)` via `computeCollectionFloorStats()` and `listingsToObservations()` to compute real same-currency peer floors, median asks, active listing depth, and unique seller counts.
   - Evaluates mispricing (`BELOW_REFERENCE` / `MISPRICED_NFT`), activity velocity (`ACTIVITY_SPIKE`), liquidity depth, and smart-money wallet signals without ever comparing raw amounts across different currencies (`ETH`, `WETH`, `USDG`).
3. **Global Cross-Collection Ranking & Deterministic Policy Engine (`@divora/policy`, `@divora/market`)**
   - Globally ranks opportunities across all discovered collections by decision eligibility (`BUY > WATCH > IGNORE > REJECT`), opportunity score, payment currency preference (`ETH` / `WETH` ahead of `USDG`), and same-currency total cost.
   - Enforces fail-closed `ConstitutionConfig` rules (`maxTradeValue`, `maxDailySpend` with cumulative daily spend tracking, `maxGas`, `maxSlippageBps`, `minOpportunityScore`, `minConfidence`, `allowedChains`, `allowedCollections`, and `blockedCollections`).
4. **Intent Validation & Live Seaport 1.6 RPC Simulation (`@divora/tx`)**
   - Validates every `BUY` decision through `validateIntent()` with duplicate-intent prevention (`hasActiveIntent` idempotency guard) and rejects arbitrary calldata (`ARBITRARY_CALLDATA_REJECTED`).
   - Performs read-only `eth_call` and `estimateGas` simulations against Seaport 1.6 (`0x0000000000000068F116a894984e2DB1123eB395`) and ERC-20 payment tokens (`USDG`, `WETH`) on Robinhood Chain (`4663`).
5. **Dual-Wallet Connection & Execution Architecture (`@divora/wallets`)**
   - **Method 1 — Agent Execution Wallet (`AgentWalletProvider`, role: `agent`)**: Isolated server-side execution wallet boundary (`server_enclave_isolated`). Supports `disabled` (simulation-only), `approval_gated` (requires operator click per trade), and `autonomous_policy_bounded` (autonomously executes validated + `SIMULATED_SUCCESS` intents within policy limits).
   - **Method 2 — User Connection Wallet (`ConnectedWalletProvider`, role: `user`)**: Connects to the operator's browser EIP-1193 wallet (`window.ethereum` — MetaMask, Rabby, Robinhood Wallet) or paired EVM address (`browser_eip1193`).
6. **On-Chain Verification & Multi-Collection Portfolio (`EXECUTE → VERIFY → PORTFOLIO`)**
   - Verifies execution receipts, block numbers, and ERC-721 `ownerOf(tokenId)` on Robinhood Chain (`4663`).
   - Tracks held NFTs across collections, acquisition price + marketplace fees (`totalCostBasis`), live same-currency collection floor valuation, unrealized/realized P&L, and exit listings (`LISTED_FOR_SALE` / `SOLD`).

---

## 2. Project Structure

```text
.
├── packages/
│   ├── shared/          # Domain types, payment assets, PrismaOpportunityStore
│   ├── chains/          # Robinhood Chain (4663 / 46630) Viem adapter & RPC probes
│   ├── wallets/         # DualWalletManager: ConnectedWalletProvider (user) & AgentWalletProvider (agent)
│   ├── nft/             # On-chain ERC-721 Transfer log discovery & metadata normalization
│   ├── opportunities/   # Signal evaluators (price, activity, liquidity, smart-money) & scoring
│   ├── policy/          # Risk assessor, Constitution evaluator (wildcard "*" & blocklists), decision engine
│   ├── tx/              # Intent validator, Seaport 1.6 RPC simulator, ERC-20 readiness inspector
│   ├── market/          # OpenSea v2 multi-collection provider, peer floor engine, global ranking, pipeline
│   └── agent/           # Background autonomous worker loop (fail-closed)
├── prisma/
│   └── schema.prisma    # PostgreSQL persistence schema for snapshots, opportunities, decisions, intents, trades
├── scripts/
│   ├── link-packages.mjs
│   ├── smoke-chain.mjs
│   └── smoke-discovery.mjs
├── server.ts            # Unified Express API + multi-collection trading runtime on port 3000
└── src/
    └── App.tsx          # Operator console (Discovery, Dual Wallets, Global Ranking, Policy, Intents, Portfolio)
```

---

## 3. Environment Setup (`.env`)

Copy `.env.example` to `.env` and configure as needed:

```bash
cp .env.example .env
```

| Variable | Default / Example | Purpose |
| :--- | :--- | :--- |
| `ROBINHOOD_RPC_URL` | `https://rpc.mainnet.chain.robinhood.com` | Robinhood Chain Mainnet (4663) JSON-RPC endpoint |
| `ROBINHOOD_CHAIN_ID` | `4663` | Target chain ID |
| `OPENSEA_API_KEY` | *(Optional in local cohort mode; required for live OpenSea API)* | OpenSea API v2 key for live multi-collection order & fulfillment calls |
| `OPENSEA_COLLECTION_SLUG` | *(Empty by default for market-wide scan)* | Optional single-collection filter override |
| `FULFILLER_ADDRESS` | *(Optional)* | Override address for Agent Execution Wallet |
| `AGENT_WALLET_SEED` | *(Optional secret seed)* | Server-isolated seed for deterministic Agent Execution Wallet |
| `DATABASE_URL` | `postgresql://...` | Optional PostgreSQL / Supabase connection string (falls back to `VerifiedJournalStore` with strict read-back checks when unconfigured) |

---

## 4. Quick Start & Commands

### Install Dependencies & Link Packages
```bash
npm install
npm run link:packages
```

### Build All Workspace Packages & Frontend
```bash
npm run build
```

### Start the Unified Agent Server & Operator Console (Port 3000)
```bash
npm run dev
```
Open `http://localhost:3000` in your browser.

### Run Type Checks & Unit Test Suites (35 Tests)
```bash
npm run typecheck
npm run test:all
```

### Run Live Robinhood Chain (4663) Smoke Checks
```bash
npm run smoke:chain
npm run smoke:discovery
```

---

## 5. API Endpoints (`server.ts`)

- `GET /api/state` — Full agent state: live Robinhood Chain `4663` RPC telemetry, Dual Wallet descriptors & balances, discovered collection floor cohorts, global ranked listings, opportunities, policy decisions, validated intents, RPC simulations, executed trades, and portfolio holdings.
- `POST /api/pipeline/tick` — Trigger a market-wide multi-collection scan (`mode: "market_wide_multi_collection"` or `"live_opensea"`, optional `collectionSlug` filter).
- `POST /api/wallets/connect-user` — Connect or disconnect the Operator Browser EIP-1193 Wallet (`role: "user"`).
- `POST /api/wallets/configure` — Switch active fulfiller role (`"agent"` vs `"user"`) or update Agent Execution Wallet policy (`"disabled"` | `"approval_gated"` | `"autonomous_policy_bounded"`).
- `POST /api/intents/execute` — Execute a validated & simulated `TransactionIntent` via `"agent"` or `"user"` wallet, run on-chain verification (`VERIFY`), and record the holding in `PORTFOLIO`.
- `POST /api/portfolio/list` — List a held NFT for sale (`LISTED_FOR_SALE`) or execute an exit (`SOLD`) and compute realized P&L.
- `POST /api/policy/update` — Update `ConstitutionConfig` spending caps, score thresholds, wildcard collection mode (`["*"]`), and blocked contracts.
- `POST /api/orders/prepare` — Validate proposed orders and reject arbitrary calldata (`ARBITRARY_CALLDATA_REJECTED`).
- `POST /api/rpc/inspect` — Probe live Robinhood Chain (`4663`) `Seaport.getOrderStatus`, `USDG`/`WETH` ERC-20 readiness, and on-chain ERC-721 `Transfer` log discovery.
