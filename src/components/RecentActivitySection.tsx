import React from "react";
import { ArrowUpRight, CheckCircle2, Cpu, ShieldAlert } from "lucide-react";
import type { AppState } from "../types/agent";
import { formatUnitsDisplay, shortHex } from "../services/divoraClient";

interface RecentActivitySectionProps {
  state: AppState | null;
  onOpenDecisionsTab: () => void;
  onOpenTransactionsTab: () => void;
}

export const RecentActivitySection: React.FC<RecentActivitySectionProps> = ({
  state,
  onOpenDecisionsTab,
  onOpenTransactionsTab,
}) => {
  const decisions = (state?.decisions ?? []).slice(0, 5);
  const intents = state?.intents ?? [];
  const simulations = state?.simulations ?? [];
  const validations = state?.intentValidations ?? [];

  return (
    <section id="recent-activity" className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white">
          04. Recent Decisions & Transaction Simulation Activity
        </h2>
        <p className="text-xs text-slate-400">
          Explainable policy decisions paired with validated transaction intents and read-only Seaport 1.6 Robinhood Chain (4663) RPC simulations.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left 6 cols: Recent Policy Decisions */}
        <div className="lg:col-span-6 rounded-xl border border-slate-800 bg-[#0f1624] p-5 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">
                Recent Multi-Collection Policy Decisions
              </h3>
              <p className="text-xs text-slate-400">
                BUY: {state?.decisions.filter((d) => d.action === "BUY").length ?? 0} · WATCH:{" "}
                {state?.decisions.filter((d) => d.action === "WATCH").length ?? 0} · REJECT:{" "}
                {state?.decisions.filter((d) => d.action === "REJECT").length ?? 0}
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenDecisionsTab}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors whitespace-nowrap shrink-0"
            >
              <span>All Decisions</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {decisions.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No policy decisions recorded yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-800/70">
              {decisions.map((dec) => {
                const opp = state?.opportunities.find((o) => o.id === dec.opportunityId);
                return (
                  <div key={dec.id} className="py-3 first:pt-0 last:pb-0 space-y-1">
                    <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                      <span className="font-sans font-medium text-white">
                        {opp?.collectionName ?? shortHex(dec.collection)} #
                        {dec.opportunityId.split(":")[2]}
                      </span>
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-semibold ${
                            dec.action === "BUY"
                              ? "text-emerald-400"
                              : dec.action === "WATCH"
                              ? "text-amber-400"
                              : "text-slate-400"
                          }`}
                        >
                          {dec.action}
                        </span>
                        <span aria-hidden="true" className="text-slate-600">
                          ·
                        </span>
                        <span className="text-slate-400">Risk: {dec.riskLevel}</span>
                        <span aria-hidden="true" className="text-slate-600">
                          ·
                        </span>
                        <span className="text-slate-300">
                          Score: {dec.opportunityScore !== null ? dec.opportunityScore.toFixed(1) : "—"}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 leading-snug line-clamp-2">
                      {dec.reasoning}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right 6 cols: Validated Intents & Seaport 1.6 RPC Simulations */}
        <div className="lg:col-span-6 rounded-xl border border-slate-800 bg-[#0f1624] p-5 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">
                Validated Intents & Seaport 1.6 RPC Simulations
              </h3>
              <p className="text-xs text-slate-400">
                Duplicate intents blocked via <code className="font-mono text-slate-200">orderHash</code> &amp;{" "}
                <code className="font-mono text-slate-200">decisionId</code> constraints.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenTransactionsTab}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors whitespace-nowrap shrink-0"
            >
              <span>Inspect RPC Sims</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {intents.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No active BUY intents created yet.
            </div>
          ) : (
            <div className="space-y-3">
              {intents.map((intent) => {
                const sim = simulations.find((s) => s.intentId === intent.id);
                const val = validations.find((v) => v.decisionId === intent.decisionId)?.validation;
                return (
                  <div
                    key={intent.id}
                    className="rounded-lg border border-slate-800 bg-[#090d16] p-3.5 space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <Cpu className="h-3.5 w-3.5 text-blue-400" />
                        <span className="font-semibold text-white">
                          {intent.collection} #{intent.tokenId}
                        </span>
                        <span className="font-mono text-slate-400">
                          ({shortHex(intent.orderHash ?? intent.id)})
                        </span>
                      </div>
                      <span className="font-mono tabular-nums font-semibold text-blue-400">
                        {formatUnitsDisplay(intent.expectedPrice, intent.currency)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono tabular-nums text-slate-400 pt-1.5 border-t border-slate-800/80">
                      <span className="inline-flex items-center gap-1 text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Validation: {val?.valid === false ? "REJECTED" : "VALID"}</span>
                      </span>
                      <span>
                        RPC Sim: <strong className="text-slate-200">{sim?.state ?? "SIMULATED_SUCCESS"}</strong>
                      </span>
                      <span>Gas Est: {sim?.gasEstimate ?? intent.estimatedGas}</span>
                      <span className="inline-flex items-center gap-1 text-amber-400">
                        <ShieldAlert className="h-3 w-3" />
                        <span>Execution Disabled</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="pt-2 border-t border-slate-800/80 text-[11px] font-mono text-slate-400 flex items-center justify-between">
            <span>Seaport 1.6 Read-Only Simulation Boundary</span>
            <span>Executable: false · Broadcast: false</span>
          </div>
        </div>
      </div>
    </section>
  );
};
