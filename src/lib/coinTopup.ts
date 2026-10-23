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
  vndToCoin, validateTopupInput, bankMemo,
} from "@/lib/coinTopup-constants";

export async function countPendingByUser(userId: string): Promise<number> {
  const client = prisma as unknown as { coinTopupRequest: { count(args: unknown): Promise<number> } };
  return client.coinTopupRequest.count({ where: { userId, status: "pending" } });
}

export interface TopupBankInfo { bankName: string; accountNo: string; accountName: string }

/**
 * Tài khoản nhận tiền nạp Coin, lấy từ biến môi trường KIN_TOPUP_BANK_NAME / KIN_TOPUP_ACCOUNT_NO / KIN_TOPUP_ACCOUNT_NAME.
 * Thiếu BẤT KỲ biến nào → null (giao diện ẩn khối chuyển khoản); không bao giờ trả số tài khoản mặc định hay giả.
 */
export function getTopupBankInfo(env: Record<string, string | undefined> = process.env): TopupBankInfo | null {
  const bankName = env.KIN_TOPUP_BANK_NAME?.trim(), accountNo = env.KIN_TOPUP_ACCOUNT_NO?.replace(/\s+/g, ""), accountName = env.KIN_TOPUP_ACCOUNT_NAME?.trim();
  if (!bankName || !accountNo || !accountName || !/^\d{6,19}$/.test(accountNo)) return null;
  return { bankName, accountNo, accountName };
}
