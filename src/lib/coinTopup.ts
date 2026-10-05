// Server-only helpers cho nạp Coin — đụng Prisma. Constants + validator
// client-safe nằm ở src/lib/coinTopup-constants.ts; file này re-export
// để các route API không phải import 2 chỗ.
//
// Chống dùng ở client: nếu Client Component vô tình import "@/lib/coinTopup"
// (vd auto-complete), Next.js sẽ cố bundle Prisma → fail build với
// "node:module not supported". Client phải import "@/lib/coinTopup-constants".

import { prisma } from "@/lib/prisma";

export {
  MIN_TOPUP_VND, MAX_TOPUP_VND, MAX_PENDING_PER_USER,
  vndToCoin, validateTopupInput, bankMemo, BANK_INFO,
} from "@/lib/coinTopup-constants";

export async function countPendingByUser(userId: string): Promise<number> {
  const client = prisma as unknown as { coinTopupRequest: { count(args: unknown): Promise<number> } };
  return client.coinTopupRequest.count({ where: { userId, status: "pending" } });
}
