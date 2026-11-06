import { PrismaClient } from "@prisma/client";
import type { ListingStore, ListingSnapshot } from "./persist.js";

export class PrismaListingStore implements ListingStore {
  constructor(private prisma: PrismaClient) {}

  async upsertSnapshots(rows: ListingSnapshot[]): Promise<{ persisted: number }> {
    let persisted = 0;
    for (const row of rows) {
      await this.prisma.marketListingSnapshot.upsert({
        where: { id: row.id },
        update: {
          chainId: row.chainId,
          marketplace: row.marketplace,
          contract: row.contract,
          tokenId: row.tokenId,
          price: row.price,
          seller: row.seller,
          freshness: row.freshness,
          observedAt: row.observedAt,
          payload: row.payload as any,
        },
        create: {
          id: row.id,
          chainId: row.chainId,
          marketplace: row.marketplace,
          contract: row.contract,
          tokenId: row.tokenId,
          price: row.price,
          seller: row.seller,
          freshness: row.freshness,
          observedAt: row.observedAt,
          payload: row.payload as any,
        },
      });
      if (typeof (this.prisma.marketListingSnapshot as any).findUnique === "function") {
        const readBack = await this.prisma.marketListingSnapshot.findUnique({ where: { id: row.id } });
        if (!readBack) {
          throw new Error(`Read-back verification failed for listing snapshot ${row.id}`);
        }
      }
      persisted++;
    }
    return { persisted };
  }
}