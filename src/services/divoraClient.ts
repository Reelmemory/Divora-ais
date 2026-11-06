import type { AppState, WalletDescriptor } from "../types/agent";

export function formatUnitsDisplay(
  value: string | null | undefined,
  currency: string | null = "ETH",
): string {
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

export function shortHex(val: string | null | undefined): string {
  if (!val) return "—";
  if (val.length <= 14) return val;
  return `${val.slice(0, 6)}…${val.slice(-4)}`;
}

export function formatNetworkName(chainId: number | null | undefined): string {
  if (!chainId) return "Network Unavailable";
  if (chainId === 4663) return "Robinhood Chain (4663)";
  if (chainId === 1) return "Ethereum Mainnet (1)";
  if (chainId === 42161) return "Arbitrum One (42161)";
  if (chainId === 8453) return "Base (8453)";
  return `Chain ${chainId}`;
}

export interface PortfolioCollectionBreakdown {
  slug: string;
  name: string;
  contract: string;
  heldCount: number;
  ethFloorPrice: string | null;
  usdgFloorPrice: string | null;
  activeListingsCount: number;
}

export interface PortfolioSummaryMetrics {
  heldPositionsCount: number;
  soldPositionsCount: number;
  ethHoldingsFloorTotalWei: string | null;
  usdgHoldingsFloorTotalUnits: string | null;
  ethUnrealizedPnlWei: string | null;
  collectionBreakdown: PortfolioCollectionBreakdown[];
  budget: {
    maxTradeValueWei: string | null;
    maxDailySpendWei: string | null;
    dailySpendUsedWei: string;
    remainingDailyBudgetWei: string | null;
  };
  activeWalletAvailable: {
    role: "user" | "agent";
    connected: boolean;
    address: string | null;
    nativeEthWei: string | null;
    usdgUnits: string | null;
    wethWei: string | null;
  };
}

/**
 * Computes verified portfolio metrics, collection breakdown, and available vs. configured budget
 * without ever mixing currencies/decimals or inventing sample holdings.
 */
export function computePortfolioSummary(state: AppState | null): PortfolioSummaryMetrics {
  const heldPositions = (state?.portfolio ?? []).filter((p) => p.status !== "SOLD");
  const soldPositions = (state?.portfolio ?? []).filter((p) => p.status === "SOLD");

  let ethFloorSum = 0n;
  let hasEthValuedHolding = false;
  let usdgFloorSum = 0n;
  let hasUsdgValuedHolding = false;
  let ethPnlSum = 0n;
  let hasEthPnl = false;

  for (const pos of heldPositions) {
    const cur = pos.currency.toUpperCase();
    if (cur === "ETH" && pos.currentFloorPrice && /^\d+$/.test(pos.currentFloorPrice)) {
      ethFloorSum += BigInt(pos.currentFloorPrice);
      hasEthValuedHolding = true;
      if (pos.unrealizedPnlWei && /^-?\d+$/.test(pos.unrealizedPnlWei)) {
        ethPnlSum += BigInt(pos.unrealizedPnlWei);
        hasEthPnl = true;
      }
    } else if (cur === "USDG" && pos.currentFloorPrice && /^\d+$/.test(pos.currentFloorPrice)) {
      usdgFloorSum += BigInt(pos.currentFloorPrice);
      hasUsdgValuedHolding = true;
    }
  }

  const supported = state?.supportedMarketCollections ?? [];
  const cohorts = state?.cohorts ?? [];

  const collectionBreakdown: PortfolioCollectionBreakdown[] = supported.map((col) => {
    const heldInCollection = heldPositions.filter(
      (p) =>
        p.contractAddress.toLowerCase() === col.contract.toLowerCase() ||
        p.collectionSlug.toLowerCase() === col.slug.toLowerCase(),
    ).length;

    const colCohorts = cohorts.filter(
      (c) =>
        c.contractAddress.toLowerCase() === col.contract.toLowerCase() ||
        c.collectionSlug?.toLowerCase() === col.slug.toLowerCase(),
    );
    const ethCohort = colCohorts.find((c) => c.currency.toUpperCase() === "ETH");
    const usdgCohort = colCohorts.find((c) => c.currency.toUpperCase() === "USDG");
    const activeListingsCount = colCohorts.reduce((acc, c) => acc + c.activeListings, 0);

    return {
      slug: col.slug,
      name: col.name,
      contract: col.contract,
      heldCount: heldInCollection,
      ethFloorPrice: ethCohort?.floorPrice ?? null,
      usdgFloorPrice: usdgCohort?.floorPrice ?? null,
      activeListingsCount,
    };
  });

  const maxTradeValueWei = state?.constitution.maxTradeValue ?? null;
  const maxDailySpendWei = state?.constitution.maxDailySpend ?? null;
  const dailySpendUsedWei = state?.dailySpendUsed ?? "0";

  let remainingDailyBudgetWei: string | null = null;
  if (maxDailySpendWei && /^\d+$/.test(maxDailySpendWei) && /^\d+$/.test(dailySpendUsedWei)) {
    const diff = BigInt(maxDailySpendWei) - BigInt(dailySpendUsedWei);
    remainingDailyBudgetWei = (diff > 0n ? diff : 0n).toString();
  }

  const activeRole = state?.wallets.activeRole ?? "agent";
  const activeWallet: WalletDescriptor | undefined =
    activeRole === "user" ? state?.wallets.userWallet : state?.wallets.agentWallet;

  return {
    heldPositionsCount: heldPositions.length,
    soldPositionsCount: soldPositions.length,
    ethHoldingsFloorTotalWei: hasEthValuedHolding ? ethFloorSum.toString() : null,
    usdgHoldingsFloorTotalUnits: hasUsdgValuedHolding ? usdgFloorSum.toString() : null,
    ethUnrealizedPnlWei: hasEthPnl ? ethPnlSum.toString() : null,
    collectionBreakdown,
    budget: {
      maxTradeValueWei,
      maxDailySpendWei,
      dailySpendUsedWei,
      remainingDailyBudgetWei,
    },
    activeWalletAvailable: {
      role: activeRole,
      connected: Boolean(activeWallet?.connected && activeWallet?.address),
      address: activeWallet?.address ?? null,
      nativeEthWei: activeWallet?.nativeBalanceWei ?? null,
      usdgUnits: activeWallet?.usdgBalanceUnits ?? null,
      wethWei: activeWallet?.wethBalanceWei ?? null,
    },
  };
}

export async function fetchAgentState(): Promise<AppState> {
  const res = await fetch("/api/state");
  if (!res.ok) {
    throw new Error(`Failed to fetch agent state (HTTP ${res.status})`);
  }
  return res.json();
}

/**
 * Establishes a dedicated server-enclave Agent Wallet on the backend.
 * Private keys never enter browser storage, frontend logs, or AI context.
 * Does not automatically fund the wallet, grant approvals, or enable trading.
 */
export async function createServerAgentWallet(): Promise<{
  agentAddress: string;
  createdAt: string;
  executionPolicy: string;
}> {
  const res = await fetch("/api/wallets/create-agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.error || "Failed to provision Agent Wallet");
  }
  return data;
}

/**
 * Connects the user's existing browser wallet via a real EIP-1193 provider (`window.ethereum`).
 * Never fakes a connection or substitutes a hardcoded wallet address if no provider is present.
 */
export async function connectBrowserUserWallet(): Promise<{
  address: string;
  chainId: number;
  providerName: string;
}> {
  const eth = (window as unknown as { ethereum?: {
    isMetaMask?: boolean;
    isRabby?: boolean;
    request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  } }).ethereum;

  if (!eth || typeof eth.request !== "function") {
    throw new Error(
      "No EIP-1193 browser wallet provider (window.ethereum) detected. Open in a browser with MetaMask, Rabby, or Robinhood Wallet installed.",
    );
  }

  const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
  const address = accounts?.[0]?.trim();
  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    throw new Error("Wallet provider did not return a valid EVM account address.");
  }

  let chainId = 4663;
  try {
    const rawChainHex = (await eth.request({ method: "eth_chainId" })) as string;
    chainId = parseInt(rawChainHex, 16) || 4663;
    if (chainId !== 4663) {
      try {
        await eth.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x1237" }],
        });
        chainId = 4663;
      } catch {
        // Keep user's current active network if switch is declined
      }
    }
  } catch {
    chainId = 4663;
  }

  const providerName = eth.isMetaMask
    ? "MetaMask (EIP-1193)"
    : eth.isRabby
    ? "Rabby Wallet (EIP-1193)"
    : "Injected EIP-1193 Provider";

  const res = await fetch("/api/wallets/connect-user", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      address,
      chainId,
      providerName,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.error || "Failed to register connected wallet session");
  }

  return { address, chainId, providerName };
}

export async function disconnectBrowserUserWallet(): Promise<void> {
  await fetch("/api/wallets/connect-user", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address: null }),
  });
}

export async function switchActiveWalletRole(activeRole: "user" | "agent"): Promise<void> {
  const res = await fetch("/api/wallets/configure", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ activeRole }),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.error || "Failed to switch active wallet role");
  }
}

export async function runPipelineTick(input: {
  mode: "market_wide_multi_collection" | "live_opensea";
  collectionSlug?: string;
  maxPrice: string;
}) {
  const res = await fetch("/api/pipeline/tick", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return res.json();
}

export async function resetJournalStore(): Promise<void> {
  await fetch("/api/store/reset", { method: "POST" });
}

export async function updateConstitutionPolicy(input: {
  maxTradeValue: string;
  maxDailySpend: string;
  buyMinScore: number;
  allowedCollections: string[];
  blockedCollections: string[];
}): Promise<void> {
  const res = await fetch("/api/policy/update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error("Failed to update Trading Constitution policy");
  }
}

export async function probeLiveRpc(buyer?: string | null) {
  const res = await fetch("/api/rpc/inspect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      orderHash: "0xea9fe2e0d2fec1724e36e833d963218d40cbf7ec10af8418c765fd820ed898bd",
      buyer: buyer || undefined,
    }),
  });
  return res.json();
}

export async function testArbitraryCalldataRejection() {
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
  return { httpStatus: res.status, ...data };
}
