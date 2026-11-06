import React from "react";
import {
  KeyRound,
  Link2Off,
  Play,
  RefreshCw,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import type { AppState } from "../types/agent";
import { formatNetworkName, shortHex } from "../services/divoraClient";

interface CommandCenterHeaderProps {
  state: AppState | null;
  loading: boolean;
  walletBusy: boolean;
  tickRunning: boolean;
  onCreateAgentWallet: () => void;
  onConnectUserWallet: () => void;
  onDisconnectUserWallet: () => void;
  onSwitchActiveRole: (role: "user" | "agent") => void;
  onRunScan: () => void;
  onRefreshState: () => void;
}

export const CommandCenterHeader: React.FC<CommandCenterHeaderProps> = ({
  state,
  loading,
  walletBusy,
  tickRunning,
  onCreateAgentWallet,
  onConnectUserWallet,
  onDisconnectUserWallet,
  onSwitchActiveRole,
  onRunScan,
  onRefreshState,
}) => {
  const userWallet = state?.wallets.userWallet;
  const agentWallet = state?.wallets.agentWallet;
  const chainTelemetry = state?.chainTelemetry;

  return (
    <div className="border-b border-slate-800/80 bg-[#090d16]">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="mx-auto flex max-w-[1400px] items-center justify-between gap-8 px-6 py-4 border-b border-slate-800/60">
        <a
          href="#top"
          className="text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
        >
          Divora
        </a>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
          <a
            href="#portfolio-overview"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Portfolio
          </a>
          <a
            href="#agent-status"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Agent Status
          </a>
          <a
            href="#best-opportunities"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Opportunities
          </a>
          <a
            href="#recent-activity"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Decisions & Sims
          </a>
          <a
            href="#detailed-views"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Market Inspector
          </a>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onRunScan}
            disabled={tickRunning}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 shadow-[0_0_20px_rgba(37,99,235,0.25)]"
          >
            <Play className="h-3.5 w-3.5" />
            <span>{tickRunning ? "Scanning Market…" : "Scan All Collections"}</span>
          </button>
        </div>
      </header>

      {/* Command Center Network Status & Immediate Top-Level Wallet Actions */}
      <div className="mx-auto max-w-[1400px] px-6 py-6">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          {/* Branding & Live Network Telemetry */}
          <div className="space-y-2 max-w-xl">
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono tabular-nums text-slate-400">
              <span className="text-blue-400 font-medium">
                {chainTelemetry?.reachable
                  ? formatNetworkName(chainTelemetry.chainId)
                  : "Robinhood Chain (4663) · RPC Check"}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Block {chainTelemetry?.blockNumber ? `#${chainTelemetry.blockNumber}` : loading ? "Loading…" : "Unavailable"}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Scope: Multi-Collection Market-Wide ({state?.supportedMarketCollections.length ?? 4} Collections)
              </span>
              <button
                type="button"
                onClick={onRefreshState}
                className="ml-1 inline-flex items-center gap-1 text-slate-400 hover:text-white transition-colors whitespace-nowrap shrink-0"
                title="Refresh on-chain and pipeline state"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Refresh</span>
              </button>
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
              Autonomous Multi-Collection NFT Trading Command Center
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              Discovers and ranks mispriced NFT listings across supported collections with currency-isolated floor analysis, deterministic policy validation, and read-only Seaport 1.6 RPC simulation.
            </p>
          </div>

          {/* Top-Level Dual Wallet Actions (Agent Wallet & User Wallet) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 xl:w-[660px] shrink-0">
            {/* 1. Dedicated Agent Wallet Action Card */}
            <div className="rounded-xl border border-slate-800 bg-[#0f1624] p-4 flex flex-col justify-between gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="text-xs font-medium text-blue-400">
                    Divora Agent Wallet (Server Enclave)
                  </div>
                  <div className="text-xs text-slate-400 font-mono tabular-nums">
                    {agentWallet?.provisioned && agentWallet.address ? (
                      <>
                        <span className="text-white font-semibold">
                          {shortHex(agentWallet.address)}
                        </span>
                        <span aria-hidden="true"> · </span>
                        <span>{formatNetworkName(agentWallet.chainId)}</span>
                      </>
                    ) : (
                      <span>Not Created · Key Isolated on Server</span>
                    )}
                  </div>
                </div>
                <ShieldCheck className="h-4 w-4 text-blue-400 shrink-0" />
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                <span className="text-[11px] text-slate-400 font-mono">
                  {agentWallet?.provisioned
                    ? "Status: Provisioned · Signing Off"
                    : "No auto-fund · No auto-approval"}
                </span>

                {!agentWallet?.provisioned ? (
                  <button
                    type="button"
                    disabled={walletBusy}
                    onClick={onCreateAgentWallet}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    <span>Create Agent Wallet</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    {state?.wallets.activeRole !== "agent" && (
                      <button
                        type="button"
                        disabled={walletBusy}
                        onClick={() => onSwitchActiveRole("agent")}
                        className="rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
                      >
                        Set Active
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={walletBusy}
                      onClick={onCreateAgentWallet}
                      className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                      title="Rotate isolated server-enclave Agent Wallet"
                    >
                      Rotate Key
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 2. User Connection Wallet Action Card */}
            <div className="rounded-xl border border-slate-800 bg-[#0f1624] p-4 flex flex-col justify-between gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="text-xs font-medium text-slate-200">
                    Connected User Wallet (Browser EIP-1193)
                  </div>
                  <div className="text-xs text-slate-400 font-mono tabular-nums">
                    {userWallet?.connected && userWallet.address ? (
                      <>
                        <span className="text-white font-semibold">
                          {shortHex(userWallet.address)}
                        </span>
                        <span aria-hidden="true"> · </span>
                        <span>{formatNetworkName(userWallet.chainId)}</span>
                      </>
                    ) : (
                      <span>Disconnected · {userWallet?.label ?? "EIP-1193 Provider"}</span>
                    )}
                  </div>
                </div>
                <Wallet className="h-4 w-4 text-slate-300 shrink-0" />
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                <span className="text-[11px] text-slate-400 font-mono truncate">
                  {userWallet?.connected
                    ? `Connected · ${userWallet.label}`
                    : "Requires window.ethereum"}
                </span>

                {!userWallet?.connected ? (
                  <button
                    type="button"
                    disabled={walletBusy}
                    onClick={onConnectUserWallet}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/50 bg-blue-600/15 px-3.5 py-2 text-xs font-semibold text-blue-300 hover:bg-blue-600/25 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Wallet className="h-3.5 w-3.5" />
                    <span>Connect Wallet</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    {state?.wallets.activeRole !== "user" && (
                      <button
                        type="button"
                        disabled={walletBusy}
                        onClick={() => onSwitchActiveRole("user")}
                        className="rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
                      >
                        Set Active
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={walletBusy}
                      onClick={onDisconnectUserWallet}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                    >
                      <Link2Off className="h-3 w-3" />
                      <span>Disconnect</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
