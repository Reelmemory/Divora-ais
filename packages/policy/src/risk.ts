import type { Opportunity, RiskAssessment, RiskFinding, RiskLevel } from "@divora/shared";

const rank: Record<RiskLevel, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };

export function maxRisk(findings: RiskFinding[]): RiskLevel {
  return findings.reduce<RiskLevel>((current, finding) => (rank[finding.severity] > rank[current] ? finding.severity : current), "LOW");
}

export function assessRisk(opportunity: Opportunity, now = new Date()): RiskAssessment {
  const findings: RiskFinding[] = [];
  if (opportunity.status === "STALE" || new Date(opportunity.expiresAt).getTime() < now.getTime()) {
    findings.push({ type: "staleness", severity: "CRITICAL", reason: "Observation is stale.", evidence: { expiresAt: opportunity.expiresAt } });
  } else {
    findings.push({ type: "staleness", severity: "LOW", reason: "Observation is inside its expiry window.", evidence: { expiresAt: opportunity.expiresAt } });
  }
  if (opportunity.status === "INVALIDATED") {
    findings.push({ type: "contract_data", severity: "CRITICAL", reason: "Conflicting observations invalidated the opportunity.", evidence: { status: opportunity.status } });
  } else if (!opportunity.evidence.metadataPresent) {
    findings.push({ type: "contract_data", severity: "MEDIUM", reason: "Metadata was not collected.", evidence: { metadataPresent: false } });
  } else {
    findings.push({ type: "contract_data", severity: "LOW", reason: "Metadata was collected.", evidence: { metadataPresent: true } });
  }
  if (!opportunity.observedPrice || !opportunity.referencePrice) {
    findings.push({ type: "price", severity: "HIGH", reason: "Price or reference price was not collected.", evidence: { observedPrice: opportunity.observedPrice ?? null, referencePrice: opportunity.referencePrice ?? null } });
  } else {
    findings.push({ type: "price", severity: "LOW", reason: "Observed and reference prices were both collected.", evidence: { observedPrice: opportunity.observedPrice, referencePrice: opportunity.referencePrice } });
  }
  const liquidity = opportunity.signals.find((signal) => signal.category === "liquidity");
  if (!liquidity?.applicable) {
    findings.push({ type: "liquidity", severity: "HIGH", reason: "No liquidity observation was collected.", evidence: { applicable: false } });
  } else if (liquidity.code === "THIN_ACTIVITY") {
    findings.push({ type: "liquidity", severity: "MEDIUM", reason: liquidity.explanation, evidence: liquidity.evidence });
  } else {
    findings.push({ type: "liquidity", severity: "LOW", reason: liquidity.explanation, evidence: liquidity.evidence });
  }
  if (!opportunity.collectionName) {
    findings.push({ type: "collection", severity: "MEDIUM", reason: "Collection name was not collected.", evidence: { contract: opportunity.contract } });
  } else {
    findings.push({ type: "collection", severity: "LOW", reason: "Collection name was collected.", evidence: { collectionName: opportunity.collectionName } });
  }
  if (opportunity.status === "INSUFFICIENT_DATA") {
    findings.push({ type: "contract_data", severity: "HIGH", reason: "Opportunity has insufficient data.", evidence: { status: opportunity.status } });
  }
  return { level: maxRisk(findings), findings };
}
