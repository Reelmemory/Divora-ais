import React from "react";
import {
  Activity,
  Clock,
  Globe,
  Play,
  RotateCcw,
  Shield,
} from "lucide-react";
import type { AppState } from "../types/agent";
import { formatUnitsDisplay } from "../services/divoraClient";

interface AgentStatusBarProps {
  state: AppState | null;
  tickRunning: boolean;
  tickMode: "market_wide_multi_collection" | "live_opensea";
  collectionScope: string;
  maxPriceWei: string;
  onChangeTickMode: (mode: "market_wide_multi_collection" | "live_opensea") => void;
  onChangeCollectionScope: (scope: string) => void;
  onChangeMaxPriceWei: (val: string) => void;
  onRunTick: (mode?: "market_wide_multi_collection" | "live_opensea") => void;
  onResetStore: () => void;
}

export const AgentStatusBar: React.FC<AgentStatusBarProps> = ({
  state,
  tickRunning,
  tickMode,
  collectionScope,
  maxPriceWei,
  onChangeTickMode,
  onChangeCollectionScope,
  onChangeMaxPriceWei,
  onRunTick,
  onResetStore,
}) => {
  const lastSuccessLog = state?.tickLogs.find((l) => l.stage === "complete") ?? state?.tickLogs[0];
  const uniqueCollections = new Set((state?.cohorts ?? []).map((c) => c.contractAddress)).size;

  return (
    <section id="agent-status" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-white">
            02. Agent Status & Multi-Collection Discovery Controls
          </h2>
          <p className="text-xs text-slate-400">
            Default discovery evaluates all supported collections across the market simultaneously. Optional collection filters never override global constitution rules.
          </p>
        </div>

        <button
          type="button"
          onClick={onResetStore}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Reset Journal</span>
        </button>
      </div>

      {/* 4-Metric Agent Status Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-800 bg-[#0f1624] p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Agent Runtime Status</span>
            <Activity className="h-4 w-4 text-blue-400" />
          </div>
          <div className="text-base font-semibold text-white">
            {tickRunning ? "Running · Scanning Market" : "Ready · Deterministic Tick"}
          </div>
          <div className="text-xs font-mono tabular-nums text-slate-400">
            Persistence: {state?.environment.persistenceMode ?? "verified-journal-store"} ·{" "}
            {state?.readBackChecksPassed ?? 0} read-backs
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0f1624] p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Discovery Status</span>
            <Globe className="h-4 w-4 text-blue-400" />
          </div>
          <div className="text-base font-semibold text-white">
            Market-Wide ({uniqueCollections} Collections)
          </div>
          <div className="text-xs font-mono tabular-nums text-slate-400">
            {state?.cohorts.length ?? 0} currency cohorts · {state?.snapshots.length ?? 0} listings normalized
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0f1624] p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Last Successful Pipeline Run</span>
            <Clock className="h-4 w-4 text-blue-400" />
          </div>
          <div className="text-base font-semibold font-mono tabular-nums text-white">
            {lastSuccessLog ? `${lastSuccessLog.timestamp.slice(11, 19)} UTC` : "No runs recorded"}
          </div>
          <div className="text-xs font-mono tabular-nums text-slate-400">
            {lastSuccessLog
              ? `Stage: ${lastSuccessLog.stage} · ${lastSuccessLog.opportunitiesCount} scored · ${lastSuccessLog.intentsCreated} intent(s)`
              : "Trigger a scan below"}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0f1624] p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Execution Mode</span>
            <Shield className="h-4 w-4 text-blue-400" />
          </div>
          <div className="text-base font-semibold text-white">
            Disabled (Simulation Gate)
          </div>
          <div className="text-xs font-mono tabular-nums text-slate-400">
            Policy: {state?.execution ?? "disabled"} · Sign: false · Broadcast: false
          </div>
        </div>
      </div>

      {/* Discovery & Pipeline Control Bar */}
      <div className="rounded-xl border border-slate-800 bg-[#0f1624] p-5">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-4 space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">
              Market Feed Source
            </label>
            <div className="flex rounded-lg border border-slate-800 bg-[#090d16] p-1">
              <button
                type="button"
                onClick={() => onChangeTickMode("market_wide_multi_collection")}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  tickMode === "market_wide_multi_collection"
                    ? "bg-blue-600 text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Multi-Collection Feed (4663)
              </button>
              <button
                type="button"
                onClick={() => onChangeTickMode("live_opensea")}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  tickMode === "live_opensea"
                    ? "bg-blue-600 text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Live OpenSea (Fail-Closed)
              </button>
            </div>
          </div>

          <div className="md:col-span-4 space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">
              Collection Discovery Scope (Default: All Collections)
            </label>
            <select
              value={collectionScope}
              onChange={(e) => onChangeCollectionScope(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-[#090d16] px-3 py-2 text-xs font-mono text-white focus:border-blue-500 focus:outline-none"
            >
              <option value="ALL">All Supported Collections (Market-Wide Default)</option>
              {state?.supportedMarketCollections.map((col) => (
                <option key={col.slug} value={col.slug}>
                  Optional Preference: {col.name} ({col.slug})
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2 space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">
              Max Intent Price ({formatUnitsDisplay(maxPriceWei, "ETH")})
            </label>
            <input
              type="text"
              value={maxPriceWei}
              onChange={(e) => onChangeMaxPriceWei(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-[#090d16] px-3 py-2 text-xs font-mono tabular-nums text-white focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="md:col-span-2 flex justify-end">
            <button
              type="button"
              disabled={tickRunning}
              onClick={() => onRunTick()}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Play className="h-3.5 w-3.5" />
              <span>{tickRunning ? "Running…" : "Run Discovery"}</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
