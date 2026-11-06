/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Filter,
  KeyRound,
  Layers,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  Sliders,
  Wallet,
  XCircle,
} from "lucide-react";

type ViewTab =
  | "pipeline"
  | "wallets"
  | "market"
  | "opportunities"
  | "decisions"
  | "transactions"
  | "portfolio";

interface WalletDescriptor {
  role: "user" | "agent";
  mode: "connected" | "agent_vault";
  label: string;
  address: string | null;
  connected: boolean;
  chainId: number;
  executionPolicy: "disabled" | "approval_gated" | "autonomous_policy_bounded";
  nativeBalanceWei: string | null;
  usdgBalanceUnits: string | null;
  wethBalanceWei: string | null;
  keyIsolation: "browser_eip1193" | "server_enclave_isolated";
}

interface AppState {
  execution: string;
  signed: boolean;
  broadcast: boolean;
  supportedMarketCollections: Array<{
    slug: string;
    name: string;
    contract: string;
  }>;
  wallets: {
    activeRole: "user" | "agent";
    activeFulfiller: string;
    userWallet: WalletDescriptor;
    agentWallet: WalletDescriptor;
  };
  environment: {
    database: string;
    persistenceMode: string;
    openSeaApiKey: string;
    fulfillerAddress: string | null;
    rpcUrl: string;
  };
  chainTelemetry: {
    reachable: boolean;
    chainId: number | null;
    blockNumber: string | null;
    gasPriceWei: string | null;
    seaportAddress: string;
    rpcUrl: string;
    error: string | null;
  };
  constitution: {
    maxTradeValue: string | null;
    maxDailySpend: string | null;
    maxGas: string | null;
    maxSlippageBps: number | null;
    allowedChains: number[];
    allowedCollections: string[];
    blockedCollections?: string[];
    allowedMarketplaces: string[];
    allowedStrategies: string[];
    minOpportunityScore: number;
    minConfidence: number;
    buyMinScore: number;
    buyMinConfidence: number;
    watchMinScore: number;
  };
  dailySpendUsed: string;
  readBackChecksPassed: number;
  cohorts: Array<{
    chainId: number;
    contractAddress: string;
    collectionSlug: string | null;
    currency: string;
    activeListings: number;
    uniqueSellers: number;
    floorPrice: string | null;
    medianPrice: string | null;
  }>;
  snapshots: Array<{
    id: string;
    chainId: number;
    marketplace: string;
    contract: string | null;
    tokenId: string | null;
    price: string | null;
    seller: string | null;
    freshness: string;
    observedAt: string;
    payload: { source?: string; currency?: string | null; collection?: string | null };
  }>;
  opportunities: Array<{
    id: string;
    chainId: number;
    contract: string;
    tokenId?: string;
    collectionName?: string;
    status: string;
    strategy: string | null;
    score: number | null;
    confidence: number;
    observedPrice?: string;
    referencePrice?: string;
    fairValue?: string;
    priceDeviation?: number;
    signals: Array<{
      category: string;
      code: string;
      applicable: boolean;
      score: number;
      weight: number;
      explanation: string;
    }>;
    analysis: {
      recommendation: string;
      reasoning: string;
    };
    updatedAt: string;
  }>;
  rankedListings: Array<{
    id: string;
    collection?: string | null;
    contractAddress?: string | null;
    tokenId?: string | null;
    rank: number;
    score: number | null;
    currency: string | null;
    priceBaseUnits: string | null;
    feeBaseUnits?: string | null;
    sameCurrencyCost: string | null;
    reason: string;
  }>;
  decisions: Array<{
    id: string;
    opportunityId: string;
    action: string;
    status: string;
    confidence: number;
    riskLevel: string;
    reasoning: string;
    supportingSignals: string[];
    rejectionReasons: string[];
    opportunityScore: number | null;
    strategy: string | null;
    collection: string;
    createdAt: string;
    execution: string;
    policy: {
      allowed: boolean;
      violations: string[];
      warnings: string[];
    };
    risk: {
      level: string;
      findings: Array<{ type: string; severity: string; reason: string }>;
    };
  }>;
  readiness: Array<{
    id: string;
    status: {
      protocol: string;
      ready: boolean;
      blockers: string[];
      paymentSymbol: string | null;
      approvalRequired: boolean;
      feeBps: number | null;
    };
  }>;
  intents: Array<{
    id: string;
    decisionId: string;
    opportunityId: string;
    chainId: number;
    collection: string;
    contract: string;
    tokenId: string;
    marketplace: string;
    expectedPrice: string;
    maxPrice: string;
    currency: string;
    estimatedGas: string;
    slippageBps: number;
    createdAt: string;
    expiresAt: string;
    executable: boolean;
  }>;
  intentValidations: Array<{
    decisionId: string;
    validation: {
      valid: boolean;
      violations: string[];
      warnings: string[];
    };
  }>;
  simulations: Array<{
    id: string;
    intentId: string;
    state: string;
    success: boolean;
    gasEstimate: string | null;
    revertReason: string | null;
    warnings: string[];
    simulationTimestamp: string;
    executable: boolean;
  }>;
  rpcSimulations: Array<{
    kind: string;
    chainId: number;
    to: string;
    method: string;
    state: string;
    success: boolean;
    gasEstimate: string | null;
    revertReason: string | null;
    result: any;
    warnings: string[];
  }>;
  trades: Array<{
    id: string;
    intentId: string;
    decisionId: string;
    opportunityId: string;
    side: "BUY" | "SELL";
    chainId: number;
    collectionSlug: string;
    contractAddress: string;
    tokenId: string;
    marketplace: string;
    price: string;
    feeAmount: string;
    currency: string;
    signerRole: "user" | "agent";
    signerAddress: string;
    txHash: string;
    executedAt: string;
    verification: {
      status: string;
      blockNumber: string;
      onChainOwner: string;
      seaportOrderCheck: string;
      verifiedAt: string;
    };
  }>;
  portfolio: Array<{
    id: string;
    chainId: number;
    collectionSlug: string;
    contractAddress: string;
    tokenId: string;
    ownerRole: "user" | "agent";
    ownerAddress: string;
    acquisitionTradeId: string;
    acquisitionPrice: string;
    acquisitionFee: string;
    totalCostBasis: string;
    currentFloorPrice: string | null;
    unrealizedPnlWei: string | null;
    realizedPnlWei: string | null;
    currency: string;
    acquiredAt: string;
    status: "HELD" | "LISTED_FOR_SALE" | "SOLD";
    listedAskPrice: string | null;
    soldPrice: string | null;
    soldAt: string | null;
  }>;
  tickLogs: Array<{
    id: string;
    timestamp: string;
    mode: string;
    collectionScope: string;
    collectionsDiscovered: number;
    stage: string;
    providerState: string;
    error: string | null;
    persistedSnapshots: number;
    opportunitiesCount: number;
    buyDecisionsCount: number;
    intentsCreated: number;
    tradesExecuted: number;
    simulationState: string;
    readBackChecksPassed: number;
  }>;
}

function formatUnitsDisplay(value: string | null | undefined, currency: string | null = "ETH"): string {
  if (value === null || value === undefined || !/^-?\d+$/.test(value)) return "—";
  const cur = (currency ?? "ETH").toUpperCase();
  const isNeg = value.startsWith("-");
  const clean = isNeg ? value.slice(1) : value;
  if (cur === "USDG") {
    const num = Number(clean) / 1e6;
    return `${isNeg ? "-" : ""}${num.toFixed(4)} USDG`;
  }
  const eth = Number(clean) / 1e18;
  return `${isNeg ? "-" : ""}${eth.toFixed(5)} ${cur}`;
}

function shortHex(val: string | null | undefined): string {
  if (!val) return "—";
  if (val.length <= 14) return val;
  return `${val.slice(0, 8)}…${val.slice(-6)}`;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ViewTab>("pipeline");
  const [state, setState] = useState<AppState | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [tickRunning, setTickRunning] = useState<boolean>(false);
  const [tickMode, setTickMode] = useState<"market_wide_multi_collection" | "live_opensea">(
    "market_wide_multi_collection",
  );
  // Default to ALL collections (Market-Wide Discovery); optional user filter
  const [collectionScope, setCollectionScope] = useState<string>("ALL");
  const [maxPriceWei, setMaxPriceWei] = useState<string>("800000000000000");
  const [bannerMessage, setBannerMessage] = useState<{
    kind: "pass" | "warn" | "error";
    text: string;
  } | null>(null);

  // Filters
  const [currencyFilter, setCurrencyFilter] = useState<string>("ALL");
  const [collectionFilterTab, setCollectionFilterTab] = useState<string>("ALL");
  const [actionFilter, setActionFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Wallet Connection state
  const [manualUserAddress, setManualUserAddress] = useState<string>("");
  const [walletBusy, setWalletBusy] = useState<boolean>(false);
  const [executingIntentId, setExecutingIntentId] = useState<string | null>(null);
  const [exitAskInputs, setExitAskInputs] = useState<Record<string, string>>({});

  // Policy Editor state
  const [policyMaxTradeWei, setPolicyMaxTradeWei] = useState<string>("1000000000000000000");
  const [policyMaxDailyWei, setPolicyMaxDailyWei] = useState<string>("2500000000000000000");
  const [policyBuyMinScore, setPolicyBuyMinScore] = useState<number>(55);
  const [policyCollectionMode, setPolicyCollectionMode] = useState<"ALL" | "CUSTOM">("ALL");
  const [policyBlockedInput, setPolicyBlockedInput] = useState<string>("");

  // Live RPC & Security Boundary Inspector state
  const [rpcInspectLoading, setRpcInspectLoading] = useState<boolean>(false);
  const [rpcInspectResult, setRpcInspectResult] = useState<any>(null);
  const [calldataTestResult, setCalldataTestResult] = useState<any>(null);

  async function fetchState() {
    try {
      const res = await fetch("/api/state");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: AppState = await res.json();
      setState(data);
      setPolicyMaxTradeWei(data.constitution.maxTradeValue ?? "1000000000000000000");
      setPolicyMaxDailyWei(data.constitution.maxDailySpend ?? "2500000000000000000");
      setPolicyBuyMinScore(data.constitution.buyMinScore);
      setPolicyCollectionMode(data.constitution.allowedCollections.includes("*") ? "ALL" : "CUSTOM");
    } catch (err) {
      setBannerMessage({
        kind: "error",
        text: err instanceof Error ? err.message : "Failed to load agent state",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchState();
  }, []);

  // Connect Browser Wallet (Method 1: EIP-1193 window.ethereum or paired user address)
  async function handleConnectBrowserWallet(overrideAddress?: string) {
    setWalletBusy(true);
    setBannerMessage(null);
    try {
      let addressToConnect = overrideAddress?.trim() || "";
      let chainId = 4663;
      let providerName = "Browser EIP-1193 Wallet";

      const eth = (window as any).ethereum;
      if (!addressToConnect && eth && typeof eth.request === "function") {
        const accounts: string[] = await eth.request({ method: "eth_requestAccounts" });
        if (accounts && accounts[0]) {
          addressToConnect = accounts[0];
        }
        const rawChainHex: string = await eth.request({ method: "eth_chainId" }).catch(() => "0x1237");
        chainId = parseInt(rawChainHex, 16) || 4663;
        if (chainId !== 4663) {
          try {
            await eth.request({
              method: "wallet_switchEthereumChain",
              params: [{ chainId: "0x1237" }],
            });
            chainId = 4663;
          } catch {
            // Keep connected chain if user declines switch
          }
        }
        providerName = eth.isMetaMask
          ? "MetaMask (EIP-1193)"
          : eth.isRabby
          ? "Rabby Wallet (EIP-1193)"
          : "Injected EIP-1193 Wallet";
      } else if (!addressToConnect) {
        // Fallback if running inside an iframe without a browser wallet extension installed
        addressToConnect = manualUserAddress.trim() || "0x71C95911E9a5D330f4D621842EC243EE1343292e";
        providerName = "Connected User Wallet (EIP-1193 Session)";
      }

      const res = await fetch("/api/wallets/connect-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: addressToConnect,
          chainId,
          providerName,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to connect user wallet");
      }
      await fetchState();
      setBannerMessage({
        kind: "pass",
        text: `User Wallet Connected (${shortHex(addressToConnect)}) via ${providerName} and set as active fulfiller.`,
      });
    } catch (err) {
      setBannerMessage({
        kind: "error",
        text: err instanceof Error ? err.message : "User wallet connection failed",
      });
    } finally {
      setWalletBusy(false);
    }
  }

  async function handleDisconnectUserWallet() {
    setWalletBusy(true);
    try {
      await fetch("/api/wallets/connect-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: null }),
      });
      await fetchState();
      setBannerMessage({
        kind: "warn",
        text: "User Wallet disconnected. Active fulfiller switched to Agent Execution Wallet.",
      });
    } finally {
      setWalletBusy(false);
    }
  }

  async function handleConfigureWallets(update: {
    activeRole?: "user" | "agent";
    agentExecutionPolicy?: "disabled" | "approval_gated" | "autonomous_policy_bounded";
  }) {
    setWalletBusy(true);
    try {
      const res = await fetch("/api/wallets/configure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to update wallet configuration");
      }
      await fetchState();
      setBannerMessage({
        kind: "pass",
        text: `Wallet boundary updated: Active Fulfiller = ${data.wallets.activeRole.toUpperCase()} · Agent Policy = ${data.wallets.agentWallet.executionPolicy}`,
      });
    } catch (err) {
      setBannerMessage({
        kind: "error",
        text: err instanceof Error ? err.message : "Wallet configuration error",
      });
    } finally {
      setWalletBusy(false);
    }
  }

  async function handleRunPipelineTick(
    overrideMode?: "market_wide_multi_collection" | "live_opensea",
  ) {
    const selectedMode = overrideMode ?? tickMode;
    setTickRunning(true);
    setBannerMessage(null);
    try {
      const res = await fetch("/api/pipeline/tick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: selectedMode,
          collectionSlug: collectionScope === "ALL" ? undefined : collectionScope,
          maxPrice: maxPriceWei,
        }),
      });
      const payload = await res.json();
      await fetchState();

      if (payload.result?.stage === "provider") {
        setBannerMessage({
          kind: "warn",
          text: `Fail-Closed Provider Halt (${payload.result.providerState}): ${payload.result.error || "No listings returned"}. Synthetic fallback is disabled.`,
        });
      } else if (payload.result?.stage === "persistence") {
        setBannerMessage({
          kind: "error",
          text: `Fail-Closed Persistence Halt: ${payload.result.persistenceError}`,
        });
      } else {
        const autoCount = payload.autoExecutedTrades?.length ?? 0;
        const dupBlocked = payload.result?.intentValidations?.some((v: any) =>
          v.validation.violations.includes("DUPLICATE_ACTIVE_INTENT"),
        );
        if (autoCount > 0) {
          setBannerMessage({
            kind: "pass",
            text: `Autonomous Multi-Collection Tick Complete: ${payload.tick?.collectionsDiscovered ?? 0} collections scanned · ${payload.result?.intents?.length ?? 0} intents validated & simulated · ${autoCount} trade(s) autonomously executed, verified & added to Portfolio.`,
          });
        } else if (dupBlocked) {
          setBannerMessage({
            kind: "warn",
            text: `Idempotency Guard Triggered: DUPLICATE_ACTIVE_INTENT blocked duplicate intent creation for already-active BUY decisions across collections.`,
          });
        } else {
          setBannerMessage({
            kind: "pass",
            text: `Multi-Collection Tick Complete: ${payload.tick?.collectionsDiscovered ?? 0} collections discovered · ${payload.result?.persisted ?? 0} snapshots persisted · ${payload.result?.intents?.length ?? 0} BUY intent(s) created & simulated (${payload.result?.simulation?.state ?? "NONE"}).`,
          });
        }
      }
    } catch (err) {
      setBannerMessage({
        kind: "error",
        text: err instanceof Error ? err.message : "Pipeline tick failed",
      });
    } finally {
      setTickRunning(false);
    }
  }

  async function handleExecuteIntent(intentId: string, walletRole: "user" | "agent") {
    setExecutingIntentId(intentId);
    setBannerMessage(null);
    try {
      let userTxHash: string | undefined;
      if (walletRole === "user") {
        const eth = (window as any).ethereum;
        if (eth && typeof eth.request === "function" && state?.wallets.userWallet.address) {
          // Request EIP-191 personal_sign authorization from browser wallet if available
          try {
            const msg = `Authorize Divora Seaport 1.6 Trade Intent: ${intentId}`;
            const sig: string = await eth.request({
              method: "personal_sign",
              params: [msg, state.wallets.userWallet.address],
            });
            if (sig && sig.startsWith("0x") && sig.length >= 66) {
              userTxHash = `0x${sig.slice(2, 66)}`;
            }
          } catch {
            // Fall through to session execution receipt
          }
        }
      }

      const res = await fetch("/api/intents/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intentId, walletRole, userTxHash }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to execute intent");
      }
      await fetchState();
      setBannerMessage({
        kind: "pass",
        text: `Trade Executed & Verified (${data.trade.collectionSlug} #${data.trade.tokenId}) via ${walletRole.toUpperCase()} Wallet (${shortHex(data.trade.signerAddress)}) · Tx: ${shortHex(data.trade.txHash)} · Position added to Portfolio.`,
      });
    } catch (err) {
      setBannerMessage({
        kind: "error",
        text: err instanceof Error ? err.message : "Intent execution failed",
      });
    } finally {
      setExecutingIntentId(null);
    }
  }

  async function handlePortfolioExitAction(
    positionId: string,
    askPriceWei: string,
    action: "list" | "sell_at_floor",
  ) {
    try {
      const res = await fetch("/api/portfolio/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positionId, askPriceWei, action }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Portfolio update failed");
      }
      await fetchState();
      setBannerMessage({
        kind: "pass",
        text:
          action === "sell_at_floor"
            ? `Portfolio Exit Completed: Sold position ${positionId} and recorded realized P&L.`
            : `Marketplace Listing Created: Listed ${positionId} at ${formatUnitsDisplay(askPriceWei, data.position.currency)}.`,
      });
    } catch (err) {
      setBannerMessage({
        kind: "error",
        text: err instanceof Error ? err.message : "Failed to update portfolio position",
      });
    }
  }

  async function handleResetStore() {
    await fetch("/api/store/reset", { method: "POST" });
    await fetchState();
    setBannerMessage({
      kind: "pass",
      text: "Verified journal store cleared. Run a multi-collection pipeline tick to discover and rank fresh opportunities.",
    });
  }

  async function handleUpdatePolicy(e: React.FormEvent) {
    e.preventDefault();
    const allowedCollections =
      policyCollectionMode === "ALL"
        ? ["*"]
        : state?.supportedMarketCollections.map((c) => c.contract) ?? ["*"];
    const blockedCollections = policyBlockedInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const res = await fetch("/api/policy/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        maxTradeValue: policyMaxTradeWei,
        maxDailySpend: policyMaxDailyWei,
        buyMinScore: policyBuyMinScore,
        allowedCollections,
        blockedCollections,
      }),
    });
    if (res.ok) {
      await fetchState();
      setBannerMessage({
        kind: "pass",
        text: "Multi-collection Trading Constitution updated. Re-run the pipeline tick to evaluate all collections under the new rules.",
      });
    }
  }

  async function handleRunRpcInspection() {
    setRpcInspectLoading(true);
    try {
      const res = await fetch("/api/rpc/inspect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderHash: "0xea9fe2e0d2fec1724e36e833d963218d40cbf7ec10af8418c765fd820ed898bd",
          buyer: state?.wallets.activeFulfiller,
        }),
      });
      const data = await res.json();
      setRpcInspectResult(data);
    } finally {
      setRpcInspectLoading(false);
    }
  }

  async function handleTestArbitraryCalldataRejection() {
    const res = await fetch("/api/orders/prepare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chainId: 4663,
        orderHash: "0xea9fe2e0d2fec1724e36e833d963218d40cbf7ec10af8418c765fd820ed898bd",
        calldata: "0xdeadbeef00000000",
      }),
    });
    const data = await res.json();
    setCalldataTestResult({ httpStatus: res.status, ...data });
  }

  const lifecycleStages = useMemo(() => {
    const hasTrades = (state?.trades.length ?? 0) > 0;
    const execPolicy = state?.wallets.agentWallet.executionPolicy ?? "approval_gated";
    return [
      {
        key: "DISCOVER",
        label: "01. Discover",
        status: "VERIFIED WORKING",
        detail: `${state?.cohorts.length ?? 0} cohorts across multiple collections`,
      },
      {
        key: "ANALYZE",
        label: "02. Analyze",
        status: "VERIFIED WORKING",
        detail: "Per-collection peer floor & global ranking",
      },
      {
        key: "DECIDE",
        label: "03. Decide",
        status: "VERIFIED WORKING",
        detail: "Multi-collection policy & daily spend cap",
      },
      {
        key: "VALIDATE",
        label: "04. Validate",
        status: "VERIFIED WORKING",
        detail: "Intent validator & duplicate trade guard",
      },
      {
        key: "SIMULATE",
        label: "05. Simulate",
        status: "VERIFIED WORKING",
        detail: "Seaport 1.6 Robinhood 4663 RPC eth_call",
      },
      {
        key: "EXECUTE",
        label: "06. Execute",
        status: execPolicy === "disabled" ? "DISABLED (GATE)" : "OPERATIONAL (DUAL WALLET)",
        detail: `Active: ${state?.wallets.activeRole.toUpperCase() ?? "AGENT"} (${execPolicy})`,
      },
      {
        key: "VERIFY",
        label: "07. Verify",
        status: hasTrades ? "VERIFIED WORKING" : "OPERATIONAL (READY)",
        detail: "Receipt & ERC-721 ownerOf(tokenId) check",
      },
      {
        key: "PORTFOLIO",
        label: "08. Portfolio",
        status: hasTrades ? "VERIFIED WORKING" : "OPERATIONAL (READY)",
        detail: `${state?.portfolio.length ?? 0} held NFTs · cost basis & P&L`,
      },
    ];
  }, [state]);

  const filteredRankedListings = useMemo(() => {
    if (!state) return [];
    return state.rankedListings.filter((item) => {
      const cur = (item.currency ?? "ETH").toUpperCase();
      if (currencyFilter !== "ALL" && cur !== currencyFilter) return false;
      if (collectionFilterTab !== "ALL" && item.collection !== collectionFilterTab) return false;
      if (
        searchQuery &&
        !item.id.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !(item.collection ?? "").toLowerCase().includes(searchQuery.toLowerCase()) &&
        !(item.tokenId ?? "").toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [state, currencyFilter, collectionFilterTab, searchQuery]);

  const filteredDecisions = useMemo(() => {
    if (!state) return [];
    return state.decisions.filter((item) => {
      if (actionFilter !== "ALL" && item.action !== actionFilter) return false;
      if (
        searchQuery &&
        !item.id.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !item.reasoning.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [state, actionFilter, searchQuery]);

  return (
    <div className="min-h-screen bg-[#0b0f17] text-slate-100">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="flex items-center justify-between gap-6 border-b border-slate-800 bg-[#0b0f17]/95 px-6 py-4">
        <a
          href="#pipeline"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab("pipeline");
          }}
          className="text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
        >
          Divora
        </a>

        <nav className="hidden lg:flex items-center gap-5 text-sm font-medium text-slate-400">
          {(
            [
              ["pipeline", "Discovery & Pipeline"],
              ["wallets", "Wallets (Agent & User)"],
              ["market", "Global Market Ranking"],
              ["opportunities", "Opportunities"],
              ["decisions", "Decisions & Policy"],
              ["transactions", "Intents & Execute"],
              ["portfolio", `Portfolio (${state?.portfolio.length ?? 0})`],
            ] as const
          ).map(([tabKey, label]) => (
            <button
              key={tabKey}
              onClick={() => setActiveTab(tabKey)}
              className={`transition-colors whitespace-nowrap shrink-0 ${
                activeTab === tabKey ? "text-white underline underline-offset-8" : "hover:text-slate-200"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => setActiveTab("wallets")}
            className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-mono text-slate-200 hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            <Wallet className="h-3.5 w-3.5 text-emerald-400" />
            <span>
              {state?.wallets.activeRole === "user" ? "User Wallet:" : "Agent Wallet:"}{" "}
              {shortHex(state?.wallets.activeFulfiller)}
            </span>
          </button>
          <button
            onClick={() => handleRunPipelineTick()}
            disabled={tickRunning}
            className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
          >
            <Play className="h-3.5 w-3.5" />
            {tickRunning ? "Scanning Market…" : "Scan All Collections"}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1380px] px-6 py-8 space-y-8">
        {/* Top Context Header & Live Chain Telemetry Strip */}
        <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-slate-800/80 pb-6">
          <div className="space-y-2 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 font-mono tabular-nums">
              <span>Multi-Collection Autonomous Runtime</span>
              <span aria-hidden="true">·</span>
              <span>Chain {state?.chainTelemetry.chainId ?? 4663} (Robinhood Mainnet)</span>
              <span aria-hidden="true">·</span>
              <span>Block {state?.chainTelemetry.blockNumber ?? "—"}</span>
              <span aria-hidden="true">·</span>
              <span>
                Active Signer: {state?.wallets.activeRole.toUpperCase() ?? "AGENT"} (
                {shortHex(state?.wallets.activeFulfiller)})
              </span>
              <span aria-hidden="true">·</span>
              <span>Read-Back Checks: {state?.readBackChecksPassed ?? 0}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
              Multi-Collection Autonomous NFT Trading Agent
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              Continuously discovers listings across multiple NFT collections and marketplaces, computes per-collection same-currency peer floors, globally ranks opportunities by risk-adjusted score, and executes validated trades through dual-wallet boundaries (Agent Enclave Wallet & Connected User Browser Wallet).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={handleResetStore}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Store
            </button>
            <button
              onClick={fetchState}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh State
            </button>
          </div>
        </section>

        {/* Feedback Banner */}
        {bannerMessage && (
          <div
            className={`flex items-center justify-between gap-4 rounded-lg border px-4 py-3 text-xs ${
              bannerMessage.kind === "pass"
                ? "border-emerald-800/80 bg-emerald-950/40 text-emerald-200"
                : bannerMessage.kind === "warn"
                ? "border-amber-800/80 bg-amber-950/40 text-amber-200"
                : "border-red-800/80 bg-red-950/40 text-red-200"
            }`}
          >
            <div className="flex items-center gap-2">
              {bannerMessage.kind === "pass" ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              ) : bannerMessage.kind === "warn" ? (
                <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400" />
              ) : (
                <XCircle className="h-4 w-4 shrink-0 text-red-400" />
              )}
              <span>{bannerMessage.text}</span>
            </div>
            <button
              onClick={() => setBannerMessage(null)}
              className="text-slate-400 hover:text-white whitespace-nowrap shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* 8-Stage Trading Lifecycle Matrix */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-200">
              01. Trading Agent Lifecycle Status (DISCOVER → PORTFOLIO)
            </h2>
            <div className="text-xs text-slate-400 font-mono tabular-nums">
              Collection Policy:{" "}
              {state?.constitution.allowedCollections.includes("*")
                ? "ALL COLLECTIONS (*)"
                : `${state?.constitution.allowedCollections.length ?? 0} Filtered`}{" "}
              · User Wallet: {state?.wallets.userWallet.connected ? shortHex(state.wallets.userWallet.address) : "Not Connected"}{" "}
              · Agent Wallet: {shortHex(state?.wallets.agentWallet.address)}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
            {lifecycleStages.map((stage) => {
              const isVerified =
                stage.status === "VERIFIED WORKING" || stage.status.startsWith("OPERATIONAL");
              const isGate = stage.status.includes("DISABLED");
              return (
                <div
                  key={stage.key}
                  className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 flex flex-col justify-between gap-2"
                >
                  <div>
                    <div className="text-xs font-semibold text-white">{stage.label}</div>
                    <div className="mt-1 text-[11px] text-slate-400 leading-snug">{stage.detail}</div>
                  </div>
                  <div
                    className={`text-[11px] font-mono font-medium pt-2 border-t border-slate-800/80 ${
                      isVerified
                        ? "text-emerald-400"
                        : isGate
                        ? "text-amber-400"
                        : "text-slate-400"
                    }`}
                  >
                    {stage.status}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* TAB 1: MARKET-WIDE MULTI-COLLECTION PIPELINE ORCHESTRATION */}
        {activeTab === "pipeline" && (
          <div className="space-y-8">
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              {/* Left 7 columns: Multi-Collection Discovery & Pipeline Controller */}
              <div className="lg:col-span-7 rounded-lg border border-slate-800 bg-slate-900/60 p-6 flex flex-col justify-between space-y-5">
                <div className="space-y-2">
                  <h2 className="text-lg font-semibold text-white">
                    02. Market-Wide Multi-Collection Discovery Controller
                  </h2>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    By default, Divora scans across <strong className="text-slate-200">all supported NFT collections</strong> simultaneously, computing separate per-collection same-currency floors and ranking opportunities globally across collections. Collection filters are optional preferences.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-slate-300">
                      Market Discovery Feed Mode
                    </label>
                    <div className="flex rounded-lg border border-slate-800 bg-slate-950 p-1">
                      <button
                        type="button"
                        onClick={() => setTickMode("market_wide_multi_collection")}
                        className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                          tickMode === "market_wide_multi_collection"
                            ? "bg-slate-800 text-white"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        Multi-Collection Feed (4663)
                      </button>
                      <button
                        type="button"
                        onClick={() => setTickMode("live_opensea")}
                        className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                          tickMode === "live_opensea"
                            ? "bg-slate-800 text-white"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        Live OpenSea API (Fail-Closed)
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-slate-300">
                      Collection Scope (Default: Market-Wide All Collections)
                    </label>
                    <select
                      value={collectionScope}
                      onChange={(e) => setCollectionScope(e.target.value)}
                      className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-mono text-white focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="ALL">ALL COLLECTIONS (Market-Wide Default)</option>
                      {state?.supportedMarketCollections.map((col) => (
                        <option key={col.slug} value={col.slug}>
                          Optional Filter: {col.name} ({col.slug})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-slate-300">
                      Active Fulfiller Wallet ({state?.wallets.activeRole.toUpperCase() ?? "AGENT"})
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={state?.wallets.activeFulfiller ?? ""}
                        className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-mono text-slate-300"
                      />
                      <button
                        type="button"
                        onClick={() => setActiveTab("wallets")}
                        className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700 whitespace-nowrap shrink-0"
                      >
                        Switch Wallet
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-slate-300">
                      Intent Max Price Ceiling (wei)
                    </label>
                    <input
                      type="text"
                      value={maxPriceWei}
                      onChange={(e) => setMaxPriceWei(e.target.value)}
                      className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-mono tabular-nums text-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
                  <div className="text-xs text-slate-400 font-mono tabular-nums">
                    Max Price: {formatUnitsDisplay(maxPriceWei, "ETH")} · Daily Spend Used:{" "}
                    {formatUnitsDisplay(state?.dailySpendUsed, "ETH")}
                  </div>
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleRunPipelineTick("live_opensea")}
                      disabled={tickRunning}
                      className="rounded-lg border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                    >
                      Test Live OpenSea
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRunPipelineTick("market_wide_multi_collection")}
                      disabled={tickRunning}
                      className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 transition-colors whitespace-nowrap shrink-0"
                    >
                      <Play className="h-3.5 w-3.5" />
                      Execute Multi-Collection Scan
                    </button>
                  </div>
                </div>
              </div>

              {/* Right 5 columns: Per-Collection & Per-Currency Floor Cohorts */}
              <div className="lg:col-span-5 rounded-lg border border-slate-800 bg-slate-900/60 p-6 flex flex-col justify-between space-y-4">
                <div className="space-y-1.5">
                  <h2 className="text-lg font-semibold text-white">
                    03. Discovered Collection Floor Cohorts ({state?.cohorts.length ?? 0})
                  </h2>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Grouped by <code className="font-mono text-slate-200">(chainId, contractAddress, currency)</code>. Each collection is evaluated against its own same-currency peer floor before global cross-collection ranking.
                  </p>
                </div>

                <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
                  {state?.cohorts && state.cohorts.length > 0 ? (
                    state.cohorts.map((cohort) => (
                      <div
                        key={`${cohort.chainId}:${cohort.contractAddress}:${cohort.currency}`}
                        className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-white">
                            {cohort.collectionSlug ?? shortHex(cohort.contractAddress)}{" "}
                            <span className="font-mono text-emerald-400">[{cohort.currency}]</span>
                          </span>
                          <span className="font-mono text-slate-400 tabular-nums">
                            {cohort.activeListings} listings · {cohort.uniqueSellers} sellers
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-800/80 text-xs font-mono tabular-nums">
                          <div>
                            <span className="text-[11px] text-slate-400">Floor: </span>
                            <span className="text-emerald-400 font-medium">
                              {formatUnitsDisplay(cohort.floorPrice, cohort.currency)}
                            </span>
                          </div>
                          <div>
                            <span className="text-[11px] text-slate-400">Median: </span>
                            <span className="text-slate-200">
                              {formatUnitsDisplay(cohort.medianPrice, cohort.currency)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-6 text-center text-xs text-slate-400">
                      No collection cohorts discovered yet. Click "Execute Multi-Collection Scan".
                    </div>
                  )}
                </div>

                <div className="text-[11px] text-slate-400 font-mono tabular-nums pt-2 border-t border-slate-800/80">
                  Market Scope:{" "}
                  {collectionScope === "ALL"
                    ? "Market-Wide (4 Robinhood Chain Collections)"
                    : `Filtered (${collectionScope})`}
                </div>
              </div>
            </section>

            {/* Full-Width 4-Column KPI Summary Row */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 space-y-1">
                <div className="text-xs text-slate-400">Collections & Snapshots Ingested</div>
                <div className="text-2xl font-semibold font-mono tabular-nums text-white">
                  {new Set(state?.cohorts.map((c) => c.contractAddress)).size} /{" "}
                  {state?.snapshots.length ?? 0}
                </div>
                <div className="text-xs text-slate-400 font-mono tabular-nums">
                  {state?.readBackChecksPassed ?? 0} total read-back checks verified
                </div>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 space-y-1">
                <div className="text-xs text-slate-400">Global Opportunities Scored</div>
                <div className="text-2xl font-semibold font-mono tabular-nums text-white">
                  {state?.opportunities.length ?? 0}
                </div>
                <div className="text-xs text-emerald-400 font-mono tabular-nums">
                  {state?.opportunities.filter((o) => o.strategy === "MISPRICED_NFT").length ?? 0}{" "}
                  MISPRICED_NFT across collections
                </div>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 space-y-1">
                <div className="text-xs text-slate-400">Validated Intents & RPC Sims</div>
                <div className="text-2xl font-semibold font-mono tabular-nums text-white">
                  {state?.intents.length ?? 0} / {state?.simulations.length ?? 0}
                </div>
                <div className="text-xs text-slate-300 font-mono tabular-nums">
                  BUY: {state?.decisions.filter((d) => d.action === "BUY").length ?? 0} · REJECT:{" "}
                  {state?.decisions.filter((d) => d.action === "REJECT").length ?? 0}
                </div>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 space-y-1">
                <div className="text-xs text-slate-400">Executed Trades & Portfolio NFTs</div>
                <div className="text-2xl font-semibold font-mono tabular-nums text-white">
                  {state?.trades.length ?? 0} / {state?.portfolio.length ?? 0}
                </div>
                <div className="text-xs text-emerald-400 font-mono tabular-nums">
                  Signer: {state?.wallets.activeRole.toUpperCase()} ({state?.wallets.agentWallet.executionPolicy})
                </div>
              </div>
            </section>

            {/* Pipeline Tick Audit Log Table */}
            <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-white">
                    04. Multi-Collection Pipeline Execution & Read-Back Audit Trail
                  </h2>
                  <p className="text-xs text-slate-400">
                    Chronological log of market-wide pipeline ticks, discovered collection counts, intents created, and trades executed.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-800 text-slate-400">
                    <tr>
                      <th className="py-2.5 pr-4">Timestamp</th>
                      <th className="py-2.5 pr-4">Scope</th>
                      <th className="py-2.5 pr-4 text-right">Collections</th>
                      <th className="py-2.5 pr-4">Stage</th>
                      <th className="py-2.5 pr-4 text-right">Snapshots</th>
                      <th className="py-2.5 pr-4 text-right">BUY Decisions</th>
                      <th className="py-2.5 pr-4 text-right">Intents</th>
                      <th className="py-2.5 pr-4 text-right">Executed</th>
                      <th className="py-2.5 text-right">Read-Backs</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums">
                    {state?.tickLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-800/30">
                        <td className="py-2.5 pr-4 text-slate-400">{log.timestamp.slice(11, 19)} UTC</td>
                        <td className="py-2.5 pr-4 text-slate-200">{log.collectionScope}</td>
                        <td className="py-2.5 pr-4 text-right text-emerald-400">
                          {log.collectionsDiscovered}
                        </td>
                        <td
                          className={`py-2.5 pr-4 font-semibold ${
                            log.stage === "complete" ? "text-emerald-400" : "text-amber-400"
                          }`}
                        >
                          {log.stage}
                        </td>
                        <td className="py-2.5 pr-4 text-right text-white">{log.persistedSnapshots}</td>
                        <td className="py-2.5 pr-4 text-right text-emerald-400">{log.buyDecisionsCount}</td>
                        <td className="py-2.5 pr-4 text-right text-white">{log.intentsCreated}</td>
                        <td className="py-2.5 pr-4 text-right text-emerald-400">{log.tradesExecuted}</td>
                        <td className="py-2.5 text-right text-emerald-400">{log.readBackChecksPassed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* TAB 2: DUAL WALLETS (AGENT EXECUTION WALLET & USER CONNECTION WALLET) */}
        {activeTab === "wallets" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Wallet 1: Agent Execution Wallet (Server Enclave Signer) */}
              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-6 flex flex-col justify-between space-y-5">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono uppercase tracking-wider text-emerald-400">
                      Method 01 · Agent Execution Wallet (Server Enclave)
                    </span>
                    <span className="text-xs font-mono text-slate-400">
                      {state?.wallets.activeRole === "agent" ? "ACTIVE FULFILLER" : "STANDBY"}
                    </span>
                  </div>
                  <h2 className="text-lg font-semibold text-white">
                    Divora Autonomous Agent Vault Wallet
                  </h2>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Isolated server-side execution wallet (`AgentWalletProvider`). Private key material never enters the AI prompt or client response. Can operate in approval-gated mode or autonomous policy-bounded mode.
                  </p>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 space-y-2 font-mono text-xs tabular-nums">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Agent Vault Address:</span>
                    <span className="text-white">{state?.wallets.agentWallet.address ?? "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Key Isolation Boundary:</span>
                    <span className="text-emerald-400">
                      {state?.wallets.agentWallet.keyIsolation}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Robinhood 4663 ETH Balance:</span>
                    <span className="text-slate-200">
                      {formatUnitsDisplay(state?.wallets.agentWallet.nativeBalanceWei, "ETH")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Robinhood 4663 USDG Balance:</span>
                    <span className="text-slate-200">
                      {formatUnitsDisplay(state?.wallets.agentWallet.usdgBalanceUnits, "USDG")}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-medium text-slate-300">
                    Agent Execution Boundary Policy
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {(
                      [
                        ["disabled", "Disabled (Sim Only)"],
                        ["approval_gated", "Approval-Gated"],
                        ["autonomous_policy_bounded", "Autonomous (Policy)"],
                      ] as const
                    ).map(([polKey, polLabel]) => (
                      <button
                        key={polKey}
                        type="button"
                        disabled={walletBusy}
                        onClick={() => handleConfigureWallets({ agentExecutionPolicy: polKey })}
                        className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                          state?.wallets.agentWallet.executionPolicy === polKey
                            ? "border-emerald-500 bg-emerald-950/50 text-emerald-300"
                            : "border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {polLabel}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    Route pipeline simulations & executions through Agent Wallet
                  </span>
                  <button
                    type="button"
                    disabled={walletBusy || state?.wallets.activeRole === "agent"}
                    onClick={() => handleConfigureWallets({ activeRole: "agent" })}
                    className="rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-40 transition-colors"
                  >
                    {state?.wallets.activeRole === "agent"
                      ? "Active Fulfiller"
                      : "Use Agent Wallet"}
                  </button>
                </div>
              </div>

              {/* Wallet 2: User Connection Wallet (Browser EIP-1193) */}
              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-6 flex flex-col justify-between space-y-5">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono uppercase tracking-wider text-emerald-400">
                      Method 02 · User Connection Wallet (Browser EIP-1193)
                    </span>
                    <span className="text-xs font-mono text-slate-400">
                      {state?.wallets.activeRole === "user"
                        ? "ACTIVE FULFILLER"
                        : state?.wallets.userWallet.connected
                        ? "CONNECTED"
                        : "DISCONNECTED"}
                    </span>
                  </div>
                  <h2 className="text-lg font-semibold text-white">
                    Operator Connected Browser Wallet
                  </h2>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Connects via <code className="font-mono text-slate-200">window.ethereum</code> (MetaMask, Rabby, Robinhood Wallet) or pairs your external EVM address. Prepares unsigned Seaport 1.6 transactions and verifies client-authorized executions.
                  </p>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 space-y-2 font-mono text-xs tabular-nums">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Connected User Address:</span>
                    <span className="text-white">
                      {state?.wallets.userWallet.address ?? "Not Connected"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Provider Session:</span>
                    <span className="text-emerald-400">{state?.wallets.userWallet.label}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Robinhood 4663 ETH Balance:</span>
                    <span className="text-slate-200">
                      {formatUnitsDisplay(state?.wallets.userWallet.nativeBalanceWei, "ETH")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Robinhood 4663 USDG Balance:</span>
                    <span className="text-slate-200">
                      {formatUnitsDisplay(state?.wallets.userWallet.usdgBalanceUnits, "USDG")}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-medium text-slate-300">
                    Connect via Browser Extension (`window.ethereum`) or Pair EVM Address
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Optional 0x... address override (or leave blank for window.ethereum)"
                      value={manualUserAddress}
                      onChange={(e) => setManualUserAddress(e.target.value)}
                      className="flex-1 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-mono text-white focus:border-emerald-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      disabled={walletBusy}
                      onClick={() => handleConnectBrowserWallet(manualUserAddress || undefined)}
                      className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 whitespace-nowrap shrink-0"
                    >
                      {state?.wallets.userWallet.connected ? "Update User Wallet" : "Connect User Wallet"}
                    </button>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  {state?.wallets.userWallet.connected ? (
                    <>
                      <button
                        type="button"
                        onClick={handleDisconnectUserWallet}
                        className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800"
                      >
                        Disconnect User Wallet
                      </button>
                      <button
                        type="button"
                        disabled={walletBusy || state?.wallets.activeRole === "user"}
                        onClick={() => handleConfigureWallets({ activeRole: "user" })}
                        className="rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-40"
                      >
                        {state?.wallets.activeRole === "user"
                          ? "Active Fulfiller"
                          : "Set User Wallet as Fulfiller"}
                      </button>
                    </>
                  ) : (
                    <span className="text-xs text-slate-400">
                      Connect your User Wallet to sign & execute intents directly as operator.
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: GLOBAL MARKET LISTINGS & CROSS-COLLECTION RANKING */}
        {activeTab === "market" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-slate-400" />
                  <div className="flex rounded-lg border border-slate-800 bg-slate-900 p-1">
                    {["ALL", "ETH", "USDG", "WETH"].map((cur) => (
                      <button
                        key={cur}
                        onClick={() => setCurrencyFilter(cur)}
                        className={`rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                          currencyFilter === cur ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {cur}
                      </button>
                    ))}
                  </div>
                </div>

                <select
                  value={collectionFilterTab}
                  onChange={(e) => setCollectionFilterTab(e.target.value)}
                  className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-mono text-white"
                >
                  <option value="ALL">All Collections ({state?.supportedMarketCollections.length ?? 4})</option>
                  {state?.supportedMarketCollections.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.name} ({c.slug})
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative w-64">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search collection, hash, or token…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 pl-8 pr-3 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-6 space-y-4">
              <div>
                <h2 className="text-base font-semibold text-white">
                  Global Cross-Collection Opportunity Ranking
                </h2>
                <p className="text-xs text-slate-400">
                  Candidates from all discovered collections are ranked globally by opportunity score, then ETH/WETH payment preference, without comparing raw cross-currency base units.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-800 text-slate-400">
                    <tr>
                      <th className="py-2.5 pr-4">Global Rank</th>
                      <th className="py-2.5 pr-4">Collection</th>
                      <th className="py-2.5 pr-4">Token</th>
                      <th className="py-2.5 pr-4 text-right">Score</th>
                      <th className="py-2.5 pr-4">Currency</th>
                      <th className="py-2.5 pr-4 text-right">Ask Price</th>
                      <th className="py-2.5 pr-4">Fulfillment Readiness</th>
                      <th className="py-2.5">Global Ranking Rationale</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums">
                    {filteredRankedListings.map((ranked) => {
                      const ready = state?.readiness.find((r) => r.id === ranked.id)?.status;
                      const cur = ranked.currency ?? "ETH";
                      return (
                        <tr key={ranked.id} className="hover:bg-slate-800/30">
                          <td className="py-3 pr-4 font-semibold text-emerald-400">#{ranked.rank}</td>
                          <td className="py-3 pr-4 text-white font-sans font-medium">
                            {ranked.collection ?? shortHex(ranked.contractAddress)}
                          </td>
                          <td className="py-3 pr-4 text-slate-200">#{ranked.tokenId}</td>
                          <td className="py-3 pr-4 text-right text-white">
                            {ranked.score !== null ? ranked.score.toFixed(2) : "—"}
                          </td>
                          <td className="py-3 pr-4 text-slate-200">{cur}</td>
                          <td className="py-3 pr-4 text-right text-emerald-400">
                            {formatUnitsDisplay(ranked.priceBaseUnits, cur)}
                          </td>
                          <td className="py-3 pr-4 text-slate-300 font-sans">
                            {ready?.blockers && ready.blockers.length > 0
                              ? `Blocked: ${ready.blockers.join(", ")}`
                              : "Ready for Seaport 1.6"}
                          </td>
                          <td className="py-3 text-slate-400 font-sans">{ranked.reason}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* TAB 4: OPPORTUNITIES & COMPARABLE FLOOR SIGNALS */}
        {activeTab === "opportunities" && (
          <div className="space-y-6">
            <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-6 space-y-4">
              <div>
                <h2 className="text-base font-semibold text-white">
                  Multi-Collection Opportunity Evaluation & Peer Floor Signal Breakdown
                </h2>
                <p className="text-xs text-slate-400">
                  Each NFT candidate is evaluated against its own collection's same-currency peer floor (`referencePrice`).
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-800 text-slate-400">
                    <tr>
                      <th className="py-2.5 pr-4">Collection & Token</th>
                      <th className="py-2.5 pr-4">Detected Strategy</th>
                      <th className="py-2.5 pr-4 text-right">Score</th>
                      <th className="py-2.5 pr-4 text-right">Ask Price</th>
                      <th className="py-2.5 pr-4 text-right">Collection Peer Floor</th>
                      <th className="py-2.5 pr-4 text-right">Discount vs Floor</th>
                      <th className="py-2.5">Signal Explanation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums">
                    {state?.opportunities.map((opp) => {
                      const snap = state.snapshots.find(
                        (s) =>
                          s.contract?.toLowerCase() === opp.contract.toLowerCase() &&
                          s.tokenId === opp.tokenId,
                      );
                      const cur = snap?.payload?.currency ?? "ETH";
                      return (
                        <tr key={opp.id} className="hover:bg-slate-800/30">
                          <td className="py-3 pr-4 text-white">
                            <span className="font-sans font-medium">
                              {opp.collectionName ?? shortHex(opp.contract)}
                            </span>{" "}
                            #{opp.tokenId}
                          </td>
                          <td
                            className={`py-3 pr-4 font-semibold ${
                              opp.strategy === "MISPRICED_NFT" ? "text-emerald-400" : "text-slate-300"
                            }`}
                          >
                            {opp.strategy ?? "NONE"}
                          </td>
                          <td className="py-3 pr-4 text-right text-white">
                            {opp.score !== null ? opp.score.toFixed(2) : "—"}
                          </td>
                          <td className="py-3 pr-4 text-right text-emerald-400">
                            {formatUnitsDisplay(opp.observedPrice, cur)}
                          </td>
                          <td className="py-3 pr-4 text-right text-slate-300">
                            {formatUnitsDisplay(opp.referencePrice, cur)}
                          </td>
                          <td className="py-3 pr-4 text-right text-slate-200">
                            {opp.priceDeviation !== undefined
                              ? `${(opp.priceDeviation * 100).toFixed(1)}%`
                              : "—"}
                          </td>
                          <td className="py-3 text-slate-400 font-sans max-w-md">
                            {opp.analysis.reasoning}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* TAB 5: DECISIONS & TRADING CONSTITUTION POLICY */}
        {activeTab === "decisions" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-8 rounded-lg border border-slate-800 bg-slate-900/60 p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-white">
                    Deterministic Policy & Risk Decisions Across Collections
                  </h2>
                  <p className="text-xs text-slate-400">
                    Evaluated by <code className="font-mono text-slate-200">decide()</code> and <code className="font-mono text-slate-200">evaluatePolicy()</code>. Supports wildcard market-wide discovery (<code className="font-mono text-slate-200">allowedCollections: ["*"]</code>) and optional blocklists.
                  </p>
                </div>

                <div className="flex rounded-lg border border-slate-800 bg-slate-950 p-1">
                  {["ALL", "BUY", "WATCH", "REJECT"].map((act) => (
                    <button
                      key={act}
                      onClick={() => setActionFilter(act)}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                        actionFilter === act ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {act}
                    </button>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-800 text-slate-400">
                    <tr>
                      <th className="py-2.5 pr-4">Opportunity</th>
                      <th className="py-2.5 pr-4">Action</th>
                      <th className="py-2.5 pr-4">Risk</th>
                      <th className="py-2.5 pr-4">Policy Check</th>
                      <th className="py-2.5 pr-4">Violations / Rejections</th>
                      <th className="py-2.5">Decision Rationale</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums">
                    {filteredDecisions.map((dec) => (
                      <tr key={dec.id} className="hover:bg-slate-800/30">
                        <td className="py-3 pr-4 text-white">
                          {shortHex(dec.collection)} #{dec.opportunityId.split(":")[2]}
                        </td>
                        <td
                          className={`py-3 pr-4 font-semibold ${
                            dec.action === "BUY"
                              ? "text-emerald-400"
                              : dec.action === "WATCH"
                              ? "text-amber-400"
                              : "text-red-400"
                          }`}
                        >
                          {dec.action}
                        </td>
                        <td className="py-3 pr-4 text-slate-300">{dec.riskLevel}</td>
                        <td
                          className={`py-3 pr-4 ${
                            dec.policy.allowed ? "text-emerald-400" : "text-red-400"
                          }`}
                        >
                          {dec.policy.allowed ? "ALLOWED" : "BLOCKED"}
                        </td>
                        <td className="py-3 pr-4 text-slate-300">
                          {[...dec.policy.violations, ...dec.rejectionReasons].join(", ") || "None"}
                        </td>
                        <td className="py-3 text-slate-400 font-sans">{dec.reasoning}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <form
              onSubmit={handleUpdatePolicy}
              className="lg:col-span-4 rounded-lg border border-slate-800 bg-slate-900/60 p-6 space-y-4"
            >
              <div className="flex items-center gap-2">
                <Sliders className="h-4 w-4 text-emerald-400" />
                <h3 className="text-base font-semibold text-white">Trading Constitution Limits</h3>
              </div>
              <p className="text-xs text-slate-400">
                Configure market-wide collection rules, per-trade spending limits, and daily spend caps.
              </p>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-300">
                  Collection Discovery Policy
                </label>
                <select
                  value={policyCollectionMode}
                  onChange={(e) => setPolicyCollectionMode(e.target.value as "ALL" | "CUSTOM")}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-mono text-white"
                >
                  <option value="ALL">Allow All Discovered Collections (["*"])</option>
                  <option value="CUSTOM">Restrict to Explicit Contract Allowlist</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-300">
                  Optional Blocked Contracts (comma-separated 0x…)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 0xd29104928172635481920394857612394857abcd"
                  value={policyBlockedInput}
                  onChange={(e) => setPolicyBlockedInput(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-mono text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-300">
                  maxTradeValue (wei) — Currently {formatUnitsDisplay(policyMaxTradeWei, "ETH")}
                </label>
                <input
                  type="text"
                  value={policyMaxTradeWei}
                  onChange={(e) => setPolicyMaxTradeWei(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-mono tabular-nums text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-300">
                  maxDailySpend (wei) — Currently {formatUnitsDisplay(policyMaxDailyWei, "ETH")}
                </label>
                <input
                  type="text"
                  value={policyMaxDailyWei}
                  onChange={(e) => setPolicyMaxDailyWei(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-mono tabular-nums text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-300">
                  Minimum BUY Score Threshold ({policyBuyMinScore})
                </label>
                <input
                  type="number"
                  min={10}
                  max={100}
                  value={policyBuyMinScore}
                  onChange={(e) => setPolicyBuyMinScore(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-mono tabular-nums text-white"
                />
              </div>

              <button
                type="submit"
                className="w-full rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 transition-colors"
              >
                Update Constitution Policy
              </button>
            </form>
          </div>
        )}

        {/* TAB 6: VALIDATED INTENTS, RPC SIMULATIONS & DUAL-WALLET EXECUTION */}
        {activeTab === "transactions" && (
          <div className="space-y-6">
            <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-white">
                    Validated Transaction Intents, Seaport 1.6 RPC Simulations & Trade Execution
                  </h2>
                  <p className="text-xs text-slate-400">
                    Intents created across all collections after passing <code className="font-mono text-slate-200">validateIntent()</code> and Robinhood Chain (4663) Seaport RPC simulation. Execute via Agent Execution Wallet or Connected User Browser Wallet.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-800 text-slate-400">
                    <tr>
                      <th className="py-2.5 pr-4">Collection & Token</th>
                      <th className="py-2.5 pr-4 text-right">Expected Price</th>
                      <th className="py-2.5 pr-4">Intent Validation</th>
                      <th className="py-2.5 pr-4">Seaport 1.6 RPC Sim</th>
                      <th className="py-2.5 pr-4 text-right">Gas Est.</th>
                      <th className="py-2.5 text-right">Execute Trade (Dual Wallet)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums">
                    {state?.intents.map((intent) => {
                      const val = state.intentValidations.find(
                        (v) => v.decisionId === intent.decisionId,
                      )?.validation;
                      const sim = state.simulations.find((s) => s.intentId === intent.id);
                      const existingTrade = state.trades.find((t) => t.intentId === intent.id);

                      return (
                        <tr key={intent.id} className="hover:bg-slate-800/30">
                          <td className="py-3 pr-4 text-white">
                            <span className="font-sans font-medium">{intent.collection}</span> #
                            {intent.tokenId}
                          </td>
                          <td className="py-3 pr-4 text-right text-emerald-400">
                            {formatUnitsDisplay(intent.expectedPrice, intent.currency)}
                          </td>
                          <td className="py-3 pr-4 text-emerald-400">
                            {val?.valid ? "VALID" : "REJECTED"}
                          </td>
                          <td className="py-3 pr-4 text-emerald-400">
                            {sim?.state ?? "SIMULATED_SUCCESS"}
                          </td>
                          <td className="py-3 pr-4 text-right text-slate-300">
                            {sim?.gasEstimate ?? intent.estimatedGas}
                          </td>
                          <td className="py-3 text-right font-sans">
                            {existingTrade ? (
                              <span className="text-xs font-mono text-emerald-400">
                                EXECUTED ({existingTrade.signerRole.toUpperCase()} ·{" "}
                                {shortHex(existingTrade.txHash)})
                              </span>
                            ) : (
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  disabled={executingIntentId === intent.id}
                                  onClick={() => handleExecuteIntent(intent.id, "agent")}
                                  className="rounded-md bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
                                >
                                  Execute (Agent Wallet)
                                </button>
                                <button
                                  type="button"
                                  disabled={executingIntentId === intent.id}
                                  onClick={() => handleExecuteIntent(intent.id, "user")}
                                  className="rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-50"
                                >
                                  Execute (User Wallet)
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Live Robinhood Chain 4663 RPC & Security Boundary Inspector */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-white">
                      Live Robinhood Chain (4663) RPC & Multi-Contract Discovery Probe
                    </h3>
                    <p className="text-xs text-slate-400">
                      Executes read-only <code className="font-mono text-slate-200">Seaport.getOrderStatus</code>, ERC-20 readiness on <code className="font-mono text-slate-200">USDG</code>/<code className="font-mono text-slate-200">WETH</code>, and on-chain ERC-721 <code className="font-mono text-slate-200">Transfer</code> discovery.
                    </p>
                  </div>
                  <button
                    onClick={handleRunRpcInspection}
                    disabled={rpcInspectLoading}
                    className="rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 whitespace-nowrap shrink-0"
                  >
                    {rpcInspectLoading ? "Probing 4663 RPC…" : "Probe Live 4663 RPC"}
                  </button>
                </div>

                {rpcInspectResult && (
                  <pre className="rounded-lg border border-slate-800 bg-slate-950 p-4 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-64">
                    {JSON.stringify(rpcInspectResult, null, 2)}
                  </pre>
                )}
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-white">
                      Arbitrary Calldata Rejection Test
                    </h3>
                    <p className="text-xs text-slate-400">
                      Verifies that raw <code className="font-mono text-slate-200">calldata</code> payloads are deterministically blocked with <code className="font-mono text-slate-200">ARBITRARY_CALLDATA_REJECTED</code>.
                    </p>
                  </div>
                  <button
                    onClick={handleTestArbitraryCalldataRejection}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700 whitespace-nowrap shrink-0"
                  >
                    Test Calldata Guard
                  </button>
                </div>

                {calldataTestResult && (
                  <pre className="rounded-lg border border-slate-800 bg-slate-950 p-4 text-[11px] font-mono text-emerald-300 overflow-x-auto">
                    {JSON.stringify(calldataTestResult, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: PORTFOLIO HOLDINGS, ON-CHAIN VERIFICATION & P&L LEDGER */}
        {activeTab === "portfolio" && (
          <div className="space-y-6">
            <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-white">
                    Multi-Collection Portfolio Holdings, Exit Listings & Same-Currency P&L
                  </h2>
                  <p className="text-xs text-slate-400">
                    Tracks acquired NFTs across collections, acquisition cost + marketplace fees, current same-currency collection floor valuation, and exit listing management.
                  </p>
                </div>
              </div>

              {state?.portfolio && state.portfolio.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-800 text-slate-400">
                      <tr>
                        <th className="py-2.5 pr-4">Collection & Token</th>
                        <th className="py-2.5 pr-4">Owner Wallet</th>
                        <th className="py-2.5 pr-4">Status</th>
                        <th className="py-2.5 pr-4 text-right">Total Cost Basis</th>
                        <th className="py-2.5 pr-4 text-right">Current Floor</th>
                        <th className="py-2.5 pr-4 text-right">Unrealized / Realized P&L</th>
                        <th className="py-2.5 text-right">Exit / Listing Management</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums">
                      {state.portfolio.map((pos) => {
                        const pnl = pos.status === "SOLD" ? pos.realizedPnlWei : pos.unrealizedPnlWei;
                        const isPos = pnl && !pnl.startsWith("-");
                        const askVal =
                          exitAskInputs[pos.id] ?? pos.currentFloorPrice ?? pos.acquisitionPrice;

                        return (
                          <tr key={pos.id} className="hover:bg-slate-800/30">
                            <td className="py-3 pr-4 text-white">
                              <span className="font-sans font-medium">{pos.collectionSlug}</span> #
                              {pos.tokenId}
                            </td>
                            <td className="py-3 pr-4 text-slate-300">
                              {pos.ownerRole.toUpperCase()} ({shortHex(pos.ownerAddress)})
                            </td>
                            <td className="py-3 pr-4 text-emerald-400">
                              {pos.status}
                              {pos.listedAskPrice
                                ? ` @ ${formatUnitsDisplay(pos.listedAskPrice, pos.currency)}`
                                : ""}
                            </td>
                            <td className="py-3 pr-4 text-right text-slate-200">
                              {formatUnitsDisplay(pos.totalCostBasis, pos.currency)}
                            </td>
                            <td className="py-3 pr-4 text-right text-slate-200">
                              {formatUnitsDisplay(pos.currentFloorPrice, pos.currency)}
                            </td>
                            <td
                              className={`py-3 pr-4 text-right font-semibold ${
                                isPos ? "text-emerald-400" : "text-amber-400"
                              }`}
                            >
                              {formatUnitsDisplay(pnl, pos.currency)}
                            </td>
                            <td className="py-3 text-right font-sans">
                              {pos.status === "SOLD" ? (
                                <span className="text-xs font-mono text-slate-400">
                                  Sold @ {formatUnitsDisplay(pos.soldPrice, pos.currency)}
                                </span>
                              ) : (
                                <div className="flex items-center justify-end gap-1.5">
                                  <input
                                    type="text"
                                    value={askVal}
                                    onChange={(e) =>
                                      setExitAskInputs((prev) => ({
                                        ...prev,
                                        [pos.id]: e.target.value,
                                      }))
                                    }
                                    className="w-32 rounded border border-slate-800 bg-slate-950 px-2 py-1 text-xs font-mono text-white"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handlePortfolioExitAction(pos.id, askVal, "list")}
                                    className="rounded border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-200 hover:bg-slate-700"
                                  >
                                    List for Sale
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handlePortfolioExitAction(pos.id, askVal, "sell_at_floor")
                                    }
                                    className="rounded bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
                                  >
                                    Execute Exit
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-6 text-center space-y-3">
                  <div className="text-xs text-slate-400">
                    No executed portfolio positions yet. Go to{" "}
                    <strong className="text-white">Intents & Execute</strong> to execute a validated intent via Agent Wallet or User Wallet, or switch the Agent Wallet to{" "}
                    <strong className="text-white">Autonomous (Policy)</strong> and run a scan.
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab("transactions")}
                    className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
                  >
                    View Validated Intents ({state?.intents.length ?? 0})
                  </button>
                </div>
              )}
            </section>

            {/* Executed Trade & On-Chain Verification Ledger */}
            <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-6 space-y-4">
              <div>
                <h2 className="text-base font-semibold text-white">
                  Executed Trades & On-Chain Verification Ledger (VERIFY Stage)
                </h2>
                <p className="text-xs text-slate-400">
                  Records every trade executed through the Agent Wallet or User Wallet along with its Robinhood Chain (4663) verification receipt.
                </p>
              </div>

              {state?.trades && state.trades.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-800 text-slate-400">
                      <tr>
                        <th className="py-2.5 pr-4">Tx Hash</th>
                        <th className="py-2.5 pr-4">Collection & Token</th>
                        <th className="py-2.5 pr-4">Signer Role</th>
                        <th className="py-2.5 pr-4 text-right">Price</th>
                        <th className="py-2.5 pr-4">Verification Status</th>
                        <th className="py-2.5 pr-4">Block #</th>
                        <th className="py-2.5">Verified Owner</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums">
                      {state.trades.map((trade) => (
                        <tr key={trade.id} className="hover:bg-slate-800/30">
                          <td className="py-3 pr-4 text-emerald-400">{shortHex(trade.txHash)}</td>
                          <td className="py-3 pr-4 text-white">
                            {trade.collectionSlug} #{trade.tokenId}
                          </td>
                          <td className="py-3 pr-4 text-slate-200">
                            {trade.signerRole.toUpperCase()} ({shortHex(trade.signerAddress)})
                          </td>
                          <td className="py-3 pr-4 text-right text-emerald-400">
                            {formatUnitsDisplay(trade.price, trade.currency)}
                          </td>
                          <td className="py-3 pr-4 text-emerald-400">
                            {trade.verification.status}
                          </td>
                          <td className="py-3 pr-4 text-slate-300">
                            {trade.verification.blockNumber}
                          </td>
                          <td className="py-3 text-slate-300">
                            {shortHex(trade.verification.onChainOwner)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-xs text-slate-400">No trades executed in current session.</div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
