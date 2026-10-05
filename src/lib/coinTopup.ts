// FE-128 — Helpers cho nạp Coin.
//
// Trong giai đoạn này: không tích hợp gateway VNPay/MoMo. Luồng là:
//   1. User chuyển khoản thủ công vào STK công ty với nội dung khớp userId.
//   2. User điền form báo "đã chuyển N VND" → tạo CoinTopupRequest pending.
//   3. Admin đối chiếu sao kê, approve → cộng Coin + ghi CoinTransaction
//      sourceType=TOPUP; hoặc reject với lý do.
//
// 1 Coin = 1 VND trong giai đoạn hiện tại (xem tutorSubscription.ts). Mỗi
// request không gắn tỉ giá — amountVnd = coinAmount; khi đổi tỉ giá, chỉ
// cần sửa helper này.

import { prisma } from "@/lib/prisma";

// Khoảng chấp nhận cho 1 lần nạp (VND). Chặn gõ nhầm/dò:
//   - Tối thiểu 10k để không spam.
//   - Tối đa 50 triệu/lần — hợp đồng cao hơn phải chuyển qua kênh thủ công.
export const MIN_TOPUP_VND = 10_000;
export const MAX_TOPUP_VND = 50_000_000;

// 1 Coin = 1 VND. Để trong 1 chỗ: đổi tỉ giá chỉ sửa hàm này + đồng bộ các
// nơi mô tả giá VIP.
export function vndToCoin(vnd: number): number {
  return vnd;
}

export function validateTopupInput(input: {
  amountVnd?: unknown;
  bankRef?: unknown;
  note?: unknown;
}): { ok: true; amountVnd: number; bankRef: string | null; note: string | null }
 | { ok: false; error: string } {
  const v = input.amountVnd;
  if (typeof v !== "number" || !Number.isInteger(v)) {
    return { ok: false, error: "Số tiền phải là số nguyên VND" };
  }
  if (v < MIN_TOPUP_VND) return { ok: false, error: `Tối thiểu ${MIN_TOPUP_VND.toLocaleString("vi-VN")} VND` };
  if (v > MAX_TOPUP_VND) return { ok: false, error: `Tối đa ${MAX_TOPUP_VND.toLocaleString("vi-VN")} VND` };

  const bankRef = typeof input.bankRef === "string" ? input.bankRef.trim().slice(0, 100) : null;
  const note    = typeof input.note    === "string" ? input.note.trim().slice(0, 500)    : null;

  return { ok: true, amountVnd: v, bankRef: bankRef || null, note: note || null };
}

// Giới hạn số request pending đồng thời/user: 3. Chống user spam tạo
// nhiều request treo cho admin xử lý.
export const MAX_PENDING_PER_USER = 3;

export async function countPendingByUser(userId: string): Promise<number> {
  const client = prisma as unknown as { coinTopupRequest: { count(args: unknown): Promise<number> } };
  return client.coinTopupRequest.count({ where: { userId, status: "pending" } });
}

// Nội dung chuyển khoản chuẩn — admin đối chiếu bằng chuỗi này. Dùng
// prefix "KIN" + 8 ký tự đầu userId để tránh lộ hết id.
export function bankMemo(userId: string): string {
  return `KIN ${userId.slice(0, 8).toUpperCase()}`;
}

// Thông tin tài khoản — hard-code trong giai đoạn này; sau có thể move sang
// env hoặc admin settings.
export const BANK_INFO = {
  bankName:   "Vietcombank",
  accountNo:  "0123456789",
  accountName: "CONG TY KIN EDUCATION",
};
