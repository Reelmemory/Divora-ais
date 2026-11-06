import React from "react";
import {
  Briefcase,
  Coins,
  KeyRound,
  Layers,
  Scale,
  Wallet,
} from "lucide-react";
import type { AppState } from "../types/agent";
import {
  formatNetworkName,
  formatUnitsDisplay,
  shortHex,
  type PortfolioSummaryMetrics,
} from "../services/divoraClient";

interface PortfolioOverviewProps {
  state: AppState | null;
  loading: boolean;
  summary: PortfolioSummaryMetrics;
  onOpenPortfolioTab: () => void;
}

export const PortfolioOverview: React.FC<PortfolioOverviewProps> = ({
  state,
  loading,
  summary,
  onOpenPortfolioTab,
}) => {
  const userWallet = state?.wallets.userWallet;
  const agentWallet = state?.wallets.agentWallet;
  const trades = state?.trades ?? [];

  return (
    <section id="portfolio-overview" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-white">
            01. Portfolio & Wallet Balances Overview
          </h2>
          <p className="text-xs text-slate-400">
            Live Robinhood Chain (4663) on-chain balances, verified NFT holdings across collections, and trading budget allocation. Token currencies and decimals are never combined without verified valuation.
          </p>
        </div>
        <div className="text-xs font-mono tabular-nums text-slate-400">
          Active Simulation Fulfiller:{" "}
          <span className="text-blue-400 font-medium">
            {state?.wallets.activeFulfiller
              ? `${state.wallets.activeRole.toUpperCase()} (${shortHex(state.wallets.activeFulfiller)})`
              : "None Connected (Read-Only Probe)"}
          </span>
        </div>
      </div>

      {/* Primary 4-Card Portfolio Overview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-stretch">
        {/* Card 1: Connected User Wallet Balance */}
        <div className="rounded-xl border border-slate-800 bg-[#0f1624] p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-300">
                Connected User Wallet
              </span>
              <Wallet className="h-4 w-4 text-slate-400" />
            </div>

            {loading ? (
              <div className="text-sm font-mono text-slate-400">Loading wallet state…</div>
            ) : !userWallet?.connected || !userWallet.address ? (
              <div className="space-y-1 pt-1">
                <div className="text-base font-semibold text-slate-300">Disconnected</div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Connect your browser wallet above via EIP-1193 to inspect live on-chain ETH, USDG, and WETH balances.
                </p>
              </div>
            ) : (
              <div className="space-y-2 pt-1">
                <div>
                  <div className="text-xl font-semibold font-mono tabular-nums text-white">
                    {formatUnitsDisplay(userWallet.nativeBalanceWei, "ETH")}
                  </div>
                  <div className="text-[11px] font-mono text-slate-400">
                    USD Equivalent: Price feed unavailable on Chain 4663
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 space-y-1 text-xs font-mono tabular-nums">
                  <div className="flex justify-between">
                    <span className="text-slate-400">USDG (6 dec):</span>
                    <span className="text-slate-200">
                      {formatUnitsDisplay(userWallet.usdgBalanceUnits, "USDG")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">WETH (18 dec):</span>
                    <span className="text-slate-200">
                      {formatUnitsDisplay(userWallet.wethBalanceWei, "WETH")}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-800/80 text-[11px] font-mono tabular-nums text-slate-400 flex items-center justify-between">
            <span>
              {userWallet?.connected && userWallet.address
                ? shortHex(userWallet.address)
                : "No session"}
            </span>
            <span>
              {userWallet?.connected
                ? formatNetworkName(userWallet.chainId)
                : "EIP-1193"}
            </span>
          </div>
        </div>

        {/* Card 2: Agent Wallet Balance (Separately Displayed) */}
        <div className="rounded-xl border border-slate-800 bg-[#0f1624] p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-blue-400">
                Agent Wallet (Isolated Vault)
              </span>
              <KeyRound className="h-4 w-4 text-blue-400" />
            </div>

            {loading ? (
              <div className="text-sm font-mono text-slate-400">Loading agent vault…</div>
            ) : !agentWallet?.provisioned || !agentWallet.address ? (
              <div className="space-y-1 pt-1">
                <div className="text-base font-semibold text-slate-300">Not Created</div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Click "Create Agent Wallet" above to provision an isolated server-enclave wallet. Creating a wallet does not auto-fund or enable trading.
                </p>
              </div>
            ) : (
              <div className="space-y-2 pt-1">
                <div>
                  <div className="text-xl font-semibold font-mono tabular-nums text-white">
                    {formatUnitsDisplay(agentWallet.nativeBalanceWei, "ETH")}
                  </div>
                  <div className="text-[11px] font-mono text-slate-400">
                    On-Chain Native ETH · Unfunded by default
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 space-y-1 text-xs font-mono tabular-nums">
                  <div className="flex justify-between">
                    <span className="text-slate-400">USDG (6 dec):</span>
                    <span className="text-slate-200">
                      {formatUnitsDisplay(agentWallet.usdgBalanceUnits, "USDG")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">WETH (18 dec):</span>
                    <span className="text-slate-200">
                      {formatUnitsDisplay(agentWallet.wethBalanceWei, "WETH")}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-800/80 text-[11px] font-mono tabular-nums text-slate-400 flex items-center justify-between">
            <span>
              {agentWallet?.provisioned && agentWallet.address
                ? shortHex(agentWallet.address)
                : "Unprovisioned"}
            </span>
            <span>
              {agentWallet?.provisioned
                ? "Enclave · Signing Disabled"
                : "Server Enclave"}
            </span>
          </div>
        </div>

        {/* Card 3: Total Portfolio Value & NFT Holdings Breakdown */}
        <div className="rounded-xl border border-slate-800 bg-[#0f1624] p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-300">
                Verified Portfolio & NFT Holdings
              </span>
              <Layers className="h-4 w-4 text-blue-400" />
            </div>

            <div className="pt-1">
              <div className="text-xl font-semibold font-mono tabular-nums text-white">
                {summary.heldPositionsCount} Held NFT{summary.heldPositionsCount === 1 ? "" : "s"}
              </div>
              <div className="text-[11px] font-mono tabular-nums text-slate-400">
                {summary.heldPositionsCount === 0
                  ? "Total Value: 0.00000 ETH (No verified holdings)"
                  : `Floor Valuation: ${
                      summary.ethHoldingsFloorTotalWei
                        ? formatUnitsDisplay(summary.ethHoldingsFloorTotalWei, "ETH")
                        : "0.00000 ETH"
                    }${
                      summary.usdgHoldingsFloorTotalUnits
                        ? ` · ${formatUnitsDisplay(summary.usdgHoldingsFloorTotalUnits, "USDG")}`
                        : ""
                    }`}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800/80 space-y-1 text-xs font-mono tabular-nums">
              {summary.collectionBreakdown.map((col) => (
                <div key={col.slug} className="flex items-center justify-between">
                  <span className="text-slate-400 truncate max-w-[140px]" title={col.name}>
                    {col.name}:
                  </span>
                  <span className="text-slate-200">
                    {col.heldCount} held · Floor{" "}
                    {col.ethFloorPrice
                      ? formatUnitsDisplay(col.ethFloorPrice, "ETH")
                      : col.usdgFloorPrice
                      ? formatUnitsDisplay(col.usdgFloorPrice, "USDG")
                      : "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>Verified on-chain records only</span>
            <button
              type="button"
              onClick={onOpenPortfolioTab}
              className="text-blue-400 hover:text-blue-300 transition-colors whitespace-nowrap shrink-0"
            >
              Inspect Ledger →
            </button>
          </div>
        </div>

        {/* Card 4: Available Trading Balance vs Configured Trading Budget */}
        <div className="rounded-xl border border-slate-800 bg-[#0f1624] p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-300">
                Available Balance vs. Policy Budget
              </span>
              <Scale className="h-4 w-4 text-blue-400" />
            </div>

            <div className="pt-1">
              <div className="text-xs text-slate-400">Available On-Chain Trading Balance</div>
              <div className="text-lg font-semibold font-mono tabular-nums text-white">
                {summary.activeWalletAvailable.connected
                  ? `${formatUnitsDisplay(summary.activeWalletAvailable.nativeEthWei, "ETH")} · ${formatUnitsDisplay(
                      summary.activeWalletAvailable.usdgUnits,
                      "USDG",
                    )}`
                  : "Unavailable (Connect or Create Wallet)"}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800/80 space-y-1 text-xs font-mono tabular-nums">
              <div className="flex justify-between">
                <span className="text-slate-400">Configured Per-Trade Cap:</span>
                <span className="text-slate-200">
                  {formatUnitsDisplay(summary.budget.maxTradeValueWei, "ETH")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Configured Daily Budget:</span>
                <span className="text-slate-200">
                  {formatUnitsDisplay(summary.budget.maxDailySpendWei, "ETH")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Committed Intent Spend (24h):</span>
                <span className="text-blue-400">
                  {formatUnitsDisplay(summary.budget.dailySpendUsedWei, "ETH")}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800/80 text-[11px] font-mono tabular-nums text-slate-400 flex items-center justify-between">
            <span>Remaining Daily Cap:</span>
            <span className="text-slate-200 font-medium">
              {formatUnitsDisplay(summary.budget.remainingDailyBudgetWei, "ETH")}
            </span>
          </div>
        </div>
      </div>

      {/* Recent Trades & Transaction Status Bar */}
      <div className="rounded-xl border border-slate-800 bg-[#0f1624] px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-xs">
          <Briefcase className="h-4 w-4 text-blue-400 shrink-0" />
          <span className="font-medium text-white">Recent Trades & Transaction Status:</span>
          {trades.length > 0 ? (
            <span className="font-mono tabular-nums text-slate-300">
              {trades.length} verified trade(s) · Latest: {trades[0]?.collectionSlug} #
              {trades[0]?.tokenId} at {formatUnitsDisplay(trades[0]?.price, trades[0]?.currency)} (
              {shortHex(trades[0]?.txHash)})
            </span>
          ) : (
            <span className="text-slate-400">
              No executed trades recorded. Live signing and transaction broadcasting are disabled;{" "}
              <span className="font-mono tabular-nums text-slate-200">
                {state?.intents.length ?? 0}
              </span>{" "}
              validated BUY intent(s) simulated via Robinhood 4663 RPC.
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs font-mono tabular-nums text-slate-400 shrink-0">
          <Coins className="h-3.5 w-3.5 text-slate-500" />
          <span>Signed: {String(state?.signed ?? false)}</span>
          <span aria-hidden="true">·</span>
          <span>Broadcast: {String(state?.broadcast ?? false)}</span>
        </div>
      </div>
    </section>
  );
};
