import { PrismaClient } from "@prisma/client";

export class PrismaOpportunityStore {
  constructor(private prisma: PrismaClient) {}

  async saveOpportunity(opp: {
    id: string;
    chainId: number;
    chainKey: string;
    contract: string;
    tokenId?: string | null;
    collectionName?: string | null;
    status: string;
    strategy?: string | null;
    score?: number | null;
    confidence: number;
    observedPrice?: string | null;
    referencePrice?: string | null;
    fairValue?: string | null;
    priceDeviation?: number | null;
    evidence: any;
    analysis: any;
    observedAt: Date | string;
    expiresAt: Date | string;
    signals?: Array<{
      category: string;
      code: string;
      applicable: boolean;
      score: number;
      weight: number;
      explanation: string;
      evidence: any;
    }>;
    scoreExplanation?: any;
    scoreResult?: {
      total?: number | null;
      explanation: any;
      bounded: boolean;
    } | null;
  }) {
    const observedAtDate = opp.observedAt instanceof Date ? opp.observedAt : new Date(opp.observedAt);
    const expiresAtDate = opp.expiresAt instanceof Date ? opp.expiresAt : new Date(opp.expiresAt);
    const resolvedScoreResult = opp.scoreResult ?? (opp.scoreExplanation ? {
      total: opp.score ?? null,
      explanation: opp.scoreExplanation,
      bounded: true,
    } : undefined);

    const saved = await this.prisma.opportunityRecord.upsert({
      where: {
        chainId_contract_tokenId: {
          chainId: opp.chainId,
          contract: opp.contract,
          tokenId: opp.tokenId ?? "",
        },
      },
      update: {
        status: opp.status,
        strategy: opp.strategy ?? null,
        score: opp.score ?? null,
        confidence: opp.confidence,
        observedPrice: opp.observedPrice ?? null,
        referencePrice: opp.referencePrice ?? null,
        fairValue: opp.fairValue ?? null,
        priceDeviation: opp.priceDeviation ?? null,
        evidence: opp.evidence,
        analysis: opp.analysis,
        observedAt: observedAtDate,
        expiresAt: expiresAtDate,
        updatedAt: new Date(),
        scoreResult: resolvedScoreResult
          ? {
              upsert: {
                create: {
                  total: resolvedScoreResult.total,
                  explanation: resolvedScoreResult.explanation,
                  bounded: resolvedScoreResult.bounded,
                },
                update: {
                  total: resolvedScoreResult.total,
                  explanation: resolvedScoreResult.explanation,
                  bounded: resolvedScoreResult.bounded,
                },
              },
            }
          : undefined,
        signals: opp.signals
          ? {
              deleteMany: {},
              create: opp.signals.map((s) => ({
                category: s.category,
                code: s.code,
                applicable: s.applicable,
                score: s.score,
                weight: s.weight,
                explanation: s.explanation,
                evidence: s.evidence,
              })),
            }
          : undefined,
      },
      create: {
        id: opp.id,
        chainId: opp.chainId,
        chainKey: opp.chainKey,
        contract: opp.contract,
        tokenId: opp.tokenId ?? "",
        collectionName: opp.collectionName ?? null,
        status: opp.status,
        strategy: opp.strategy ?? null,
        score: opp.score ?? null,
        confidence: opp.confidence,
        observedPrice: opp.observedPrice ?? null,
        referencePrice: opp.referencePrice ?? null,
        fairValue: opp.fairValue ?? null,
        priceDeviation: opp.priceDeviation ?? null,
        evidence: opp.evidence,
        analysis: opp.analysis,
        observedAt: observedAtDate,
        expiresAt: expiresAtDate,
        updatedAt: new Date(),
        scoreResult: resolvedScoreResult
          ? {
              create: {
                total: resolvedScoreResult.total,
                explanation: resolvedScoreResult.explanation,
                bounded: resolvedScoreResult.bounded,
              },
            }
          : undefined,
        signals: opp.signals
          ? {
              create: opp.signals.map((s) => ({
                category: s.category,
                code: s.code,
                applicable: s.applicable,
                score: s.score,
                weight: s.weight,
                explanation: s.explanation,
                evidence: s.evidence,
              })),
            }
          : undefined,
      },
    });

    if (typeof (this.prisma.opportunityRecord as any).findUnique === "function") {
      const readBack = await this.prisma.opportunityRecord.findUnique({ where: { id: saved.id } });
      if (!readBack) {
        throw new Error(`Read-back verification failed for opportunity ${saved.id}`);
      }
    }

    return saved;
  }

  async saveDecision(decision: {
    id: string;
    opportunityId: string;
    action: string;
    status: string;
    confidence: number;
    riskLevel: string;
    reasoning: string;
    supportingSignals: any;
    rejectionReasons: any;
    opportunityScore?: number | null;
    strategy?: string | null;
    collection: string;
    createdAt: Date | string;
    expiresAt: Date | string;
    execution?: string;
    risk?: {
      level: string;
      findings: any;
    };
    policy?: {
      allowed: boolean;
      violations: any;
      warnings: any;
      evaluatedRules: any;
    };
  }) {
    const createdAtDate = decision.createdAt instanceof Date ? decision.createdAt : new Date(decision.createdAt);
    const expiresAtDate = decision.expiresAt instanceof Date ? decision.expiresAt : new Date(decision.expiresAt);

    const saved = await this.prisma.decisionRecord.upsert({
      where: { id: decision.id },
      update: {
        action: decision.action,
        status: decision.status,
        confidence: decision.confidence,
        riskLevel: decision.riskLevel,
        reasoning: decision.reasoning,
        supportingSignals: decision.supportingSignals,
        rejectionReasons: decision.rejectionReasons,
        opportunityScore: decision.opportunityScore ?? null,
        strategy: decision.strategy ?? null,
        collection: decision.collection,
        expiresAt: expiresAtDate,
        execution: decision.execution ?? "disabled",
        risk: decision.risk
          ? {
              upsert: {
                create: {
                  level: decision.risk.level,
                  findings: decision.risk.findings,
                },
                update: {
                  level: decision.risk.level,
                  findings: decision.risk.findings,
                },
              },
            }
          : undefined,
        policy: decision.policy
          ? {
              upsert: {
                create: {
                  allowed: decision.policy.allowed,
                  violations: decision.policy.violations,
                  warnings: decision.policy.warnings,
                  evaluatedRules: decision.policy.evaluatedRules,
                },
                update: {
                  allowed: decision.policy.allowed,
                  violations: decision.policy.violations,
                  warnings: decision.policy.warnings,
                  evaluatedRules: decision.policy.evaluatedRules,
                },
              },
            }
          : undefined,
      },
      create: {
        id: decision.id,
        opportunityId: decision.opportunityId,
        action: decision.action,
        status: decision.status,
        confidence: decision.confidence,
        riskLevel: decision.riskLevel,
        reasoning: decision.reasoning,
        supportingSignals: decision.supportingSignals,
        rejectionReasons: decision.rejectionReasons,
        opportunityScore: decision.opportunityScore ?? null,
        strategy: decision.strategy ?? null,
        collection: decision.collection,
        createdAt: createdAtDate,
        expiresAt: expiresAtDate,
        execution: decision.execution ?? "disabled",
        risk: decision.risk
          ? {
              create: {
                level: decision.risk.level,
                findings: decision.risk.findings,
              },
            }
          : undefined,
        policy: decision.policy
          ? {
              create: {
                allowed: decision.policy.allowed,
                violations: decision.policy.violations,
                warnings: decision.policy.warnings,
                evaluatedRules: decision.policy.evaluatedRules,
              },
            }
          : undefined,
      },
    });

    if (typeof (this.prisma.decisionRecord as any).findUnique === "function") {
      const readBack = await this.prisma.decisionRecord.findUnique({ where: { id: saved.id } });
      if (!readBack) {
        throw new Error(`Read-back verification failed for decision ${saved.id}`);
      }
    }

    return saved;
  }
}