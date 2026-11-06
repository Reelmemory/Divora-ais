import { PrismaClient } from "@prisma/client";
import type { IntentValidation, SimulationResult, StructuredTransactionRequest } from "@divora/shared";

export class PrismaTransactionStore {
  constructor(private prisma: PrismaClient) {}

  async hasActiveIntent(decisionId: string, now = new Date(), orderHash?: string): Promise<boolean> {
    if (typeof (this.prisma.transactionIntentRecord as unknown as { findFirst?: unknown }).findFirst !== "function") {
      return false;
    }
    const existing = await this.prisma.transactionIntentRecord.findFirst({
      where: {
        expiresAt: { gt: now },
        OR: orderHash ? [{ decisionId }, { orderHash }] : [{ decisionId }],
      },
    });
    return Boolean(existing);
  }

  async saveIntent(
    intentId: string,
    data: {
      orderHash?: string;
      decisionId: string;
      opportunityId: string;
      chainId: number;
      contract: string;
      tokenId: string;
      marketplace: string;
      expectedPrice: string;
      maxPrice: string;
      estimatedGas: string;
      slippageBps: number;
      payload: StructuredTransactionRequest;
      validation?: IntentValidation;
      expiresAt: Date;
    },
  ) {
    const persistFn = async (tx: PrismaClient) => {
      if (typeof (tx.transactionIntentRecord as unknown as { findFirst?: unknown }).findFirst === "function") {
        const active = await tx.transactionIntentRecord.findFirst({
          where: {
            expiresAt: { gt: new Date() },
            OR: data.orderHash
              ? [{ decisionId: data.decisionId }, { orderHash: data.orderHash }]
              : [{ decisionId: data.decisionId }],
          },
        });
        if (active && active.id !== intentId) {
          throw new Error(`DUPLICATE_ACTIVE_INTENT: Active intent ${active.id} already exists for order/decision`);
        }
      }

      const saved = await tx.transactionIntentRecord.upsert({
        where: { id: intentId },
        update: {
          orderHash: data.orderHash ?? null,
          expectedPrice: data.expectedPrice,
          maxPrice: data.maxPrice,
          estimatedGas: data.estimatedGas,
          slippageBps: data.slippageBps,
          payload: JSON.parse(JSON.stringify(data.payload)),
          expiresAt: data.expiresAt,
          validation: data.validation
            ? {
                upsert: {
                  create: {
                    valid: data.validation.valid,
                    violations: data.validation.violations,
                    warnings: data.validation.warnings,
                    evaluatedRules: data.validation.evaluatedRules,
                  },
                  update: {
                    valid: data.validation.valid,
                    violations: data.validation.violations,
                    warnings: data.validation.warnings,
                    evaluatedRules: data.validation.evaluatedRules,
                  },
                },
              }
            : undefined,
        },
        create: {
          id: intentId,
          orderHash: data.orderHash ?? null,
          decisionId: data.decisionId,
          opportunityId: data.opportunityId,
          chainId: data.chainId,
          contract: data.contract,
          tokenId: data.tokenId,
          marketplace: data.marketplace,
          expectedPrice: data.expectedPrice,
          maxPrice: data.maxPrice,
          estimatedGas: data.estimatedGas,
          slippageBps: data.slippageBps,
          payload: JSON.parse(JSON.stringify(data.payload)),
          createdAt: new Date(),
          expiresAt: data.expiresAt,
          executable: false,
          validation: data.validation
            ? {
                create: {
                  valid: data.validation.valid,
                  violations: data.validation.violations,
                  warnings: data.validation.warnings,
                  evaluatedRules: data.validation.evaluatedRules,
                },
              }
            : undefined,
        },
      });

      if (typeof (tx.transactionIntentRecord as unknown as { findUnique?: unknown }).findUnique === "function") {
        const readBack = await tx.transactionIntentRecord.findUnique({ where: { id: intentId } });
        if (!readBack) {
          throw new Error(`Read-back verification failed for transaction intent ${intentId}`);
        }
      }

      return saved;
    };

    if (typeof (this.prisma as unknown as { $transaction?: unknown }).$transaction === "function") {
      return this.prisma.$transaction((tx) => persistFn(tx as unknown as PrismaClient));
    }
    return persistFn(this.prisma);
  }

  async saveSimulation(result: SimulationResult) {
    const saved = await this.prisma.simulationResultRecord.upsert({
      where: { id: result.id },
      update: {
        state: result.state,
        success: result.success,
        revertReason: result.revertReason,
        payload: JSON.parse(JSON.stringify(result)),
        expiresAt: new Date(result.expiresAt),
        executable: result.executable,
      },
      create: {
        id: result.id,
        intentId: result.intentId,
        state: result.state,
        success: result.success,
        revertReason: result.revertReason,
        payload: JSON.parse(JSON.stringify(result)),
        createdAt: new Date(result.simulationTimestamp),
        expiresAt: new Date(result.expiresAt),
        executable: result.executable,
      },
    });

    if (typeof (this.prisma.simulationResultRecord as unknown as { findUnique?: unknown }).findUnique === "function") {
      const readBack = await this.prisma.simulationResultRecord.findUnique({ where: { id: result.id } });
      if (!readBack) {
        throw new Error(`Read-back verification failed for simulation result ${result.id}`);
      }
    }

    return saved;
  }
}