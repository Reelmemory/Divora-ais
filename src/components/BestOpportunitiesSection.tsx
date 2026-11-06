import React from "react";
import { ArrowUpRight, Sparkles } from "lucide-react";
import type { AppState } from "../types/agent";
import { formatUnitsDisplay, shortHex } from "../services/divoraClient";

interface BestOpportunitiesSectionProps {
  state: AppState | null;
  onInspectOpportunities: () => void;
}

export const BestOpportunitiesSection: React.FC<BestOpportunitiesSectionProps> = ({
  state,
  onInspectOpportunities,
}) => {
  const rankedListings = state?.rankedListings ?? [];
  const opportunities = state?.opportunities ?? [];
  const decisions = state?.decisions ?? [];
  const readiness = state?.readiness ?? [];

  const topCandidates = rankedListings.slice(0, 4).map((ranked) => {
    const opp = opportunities.find(
      (o) =>
        o.contract.toLowerCase() === (ranked.contractAddress ?? "").toLowerCase() &&
        o.tokenId === ranked.tokenId,
    );
    const dec = opp ? decisions.find((d) => d.opportunityId === opp.id) : undefined;
    const ready = readiness.find((r) => r.id === ranked.id)?.status;
    return { ranked, opp, dec, ready };
  });

  return (
    <section id="best-opportunities" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-white">
            03. Best Opportunities Across Multiple Collections
          </h2>
          <p className="text-xs text-slate-400">
            Globally ranked candidates across discovered collections using same-currency peer floor benchmarks and risk-adjusted scoring.
          </p>
        </div>

        <button
          type="button"
          onClick={onInspectOpportunities}
          className="inline-flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors whitespace-nowrap shrink-0"
        >
          <span>View All {opportunities.length} Evaluated Candidates</span>
          <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {topCandidates.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-[#0f1624] p-8 text-center space-y-2">
          <div className="text-sm font-medium text-slate-200">
            No multi-collection opportunities currently ranked
          </div>
          <p className="text-xs text-slate-400">
            Run a market-wide discovery scan above to evaluate listings across supported collections.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-stretch">
          {topCandidates.map(({ ranked, opp, dec, ready }) => {
            const currency = ranked.currency ?? "ETH";
            const discountPct =
              opp?.priceDeviation !== undefined
                ? `${(opp.priceDeviation * 100).toFixed(1)}%`
                : "No peer floor";

            return (
              <div
                key={ranked.id}
                className="rounded-xl border border-slate-800 bg-[#0f1624] p-5 flex flex-col justify-between space-y-4 hover:border-slate-700 transition-colors"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-mono tabular-nums text-slate-400">
                    <span className="text-blue-400 font-semibold">
                      Global Rank #{ranked.rank}
                    </span>
                    <span>
                      Score: <strong className="text-white">{ranked.score !== null ? ranked.score.toFixed(1) : "—"}</strong>
                    </span>
                  </div>

                  <div>
                    <div className="text-base font-semibold text-white">
                      {ranked.collection ?? shortHex(ranked.contractAddress)} #{ranked.tokenId}
                    </div>
                    <div className="text-xs text-slate-400 font-mono">
                      {opp?.strategy ?? "OBSERVED_LISTING"} · Confidence {opp?.confidence ?? 0}%
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 space-y-1.5 text-xs font-mono tabular-nums">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Listing Ask ({currency}):</span>
                      <span className="text-white font-semibold">
                        {formatUnitsDisplay(ranked.priceBaseUnits, currency)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Collection Peer Floor:</span>
                      <span className="text-slate-200">
                        {opp?.referencePrice
                          ? formatUnitsDisplay(opp.referencePrice, currency)
                          : "Insufficient Peers"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Price vs. Peer Floor:</span>
                      <span className="text-blue-400 font-medium">{discountPct}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800/80 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400">Decision:</span>
                    <span
                      className={`font-semibold ${
                        dec?.action === "BUY"
                          ? "text-emerald-400"
                          : dec?.action === "WATCH"
                          ? "text-amber-400"
                          : "text-slate-400"
                      }`}
                    >
                      {dec?.action ?? "EVALUATED"} ({dec?.riskLevel ?? "MEDIUM"} RISK)
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 leading-snug line-clamp-2">
                    {ready?.blockers && ready.blockers.length > 0
                      ? `Readiness Blocker: ${ready.blockers.join(", ")}`
                      : opp?.analysis.reasoning ?? ranked.reason}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
