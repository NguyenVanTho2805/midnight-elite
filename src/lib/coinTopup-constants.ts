// Constants + validator cho nạp Coin — KHÔNG import Prisma (an toàn cho
// Client Component). Phần đụng DB nằm ở src/lib/coinTopup.ts.
//
// Tách riêng vì page `/student/vi` cần MIN/MAX hiển thị trong UI; nếu
// client import từ coinTopup.ts chính thì Next.js kéo cả Prisma vào
// client bundle và build fail với "node:module not supported".

export const MIN_TOPUP_VND = 10_000;
export const MAX_TOPUP_VND = 50_000_000;

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

export const MAX_PENDING_PER_USER = 3;

export function bankMemo(userId: string): string {
  return `KIN ${userId.slice(0, 8).toUpperCase()}`;
}

export const BANK_INFO = {
  bankName:   "Vietcombank",
  accountNo:  "0123456789",
  accountName: "CONG TY KIN EDUCATION",
};
