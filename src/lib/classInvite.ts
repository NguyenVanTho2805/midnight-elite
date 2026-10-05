// BE-063/064 (1.4.6) — ClassInvite helpers.
//
// Mã mời ngắn (base32 Crockford không 0/1/I/O/U) 8 ký tự: ~41 bit entropy.
// Khác token 32 byte hex của ParentConsent — mục đích khác: học viên phải tự
// gõ hoặc copy ngắn, không chuyền qua email.
//
// Generated Prisma client đang chạy trong môi trường cục bộ KHÔNG có engine
// (proxy chặn binaries.prisma.sh); Vercel sẽ regenerate khi build nên các
// route dưới dùng `prisma.classInvite` trực tiếp, còn ở đây ta expose một
// alias typed để tránh "any" lan ra toàn bộ route.

import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTVWXYZ"; // 31 ký tự, loại 0/1/I/O/U/F
const CODE_LEN = 8;

export function generateInviteCode(len = CODE_LEN): string {
  // randomBytes rồi modulo alphabet.length: 256 % 31 = 8 → thiên lệch nhẹ
  // (<10%) không đáng kể cho mã mời; cần strong unbiased thì ParentConsent.token
  // mới dùng.
  const buf = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[buf[i] % ALPHABET.length];
  return out;
}

// Shape dùng chung — tránh phải `(prisma as any)` ở nhiều route. Mô tả vừa đủ
// cho các query dưới; không bọc toàn bộ Prisma Delegate.
type ClassInviteRow = {
  id: string;
  courseId: string;
  code: string;
  maxUses: number | null;
  usedCount: number;
  expiresAt: Date | null;
  revoked: boolean;
  createdBy: string;
  createdAt: Date;
};

export interface ClassInviteDelegate {
  create(args: { data: Omit<ClassInviteRow, "id" | "usedCount" | "createdAt" | "revoked"> & { usedCount?: number } }): Promise<ClassInviteRow>;
  findUnique(args: { where: { id?: string; code?: string } }): Promise<ClassInviteRow | null>;
  findMany(args: { where?: Partial<ClassInviteRow>; orderBy?: unknown; select?: unknown }): Promise<ClassInviteRow[]>;
  update(args: { where: { id: string }; data: Partial<ClassInviteRow> }): Promise<ClassInviteRow>;
  updateMany(args: { where: Partial<ClassInviteRow> & { usedCount?: unknown }; data: Partial<ClassInviteRow> | { usedCount: { increment: number } } }): Promise<{ count: number }>;
}

/**
 * Trả về delegate `prisma.classInvite` với type đã khai báo ở trên.
 * Prisma client (tạo lúc build Vercel) sẽ có sẵn `classInvite` thật; ở local
 * nếu client chưa regen, type cast này vẫn chạy đúng runtime vì schema đã có
 * model, chỉ là TS types trong `src/generated/prisma` chưa cập nhật.
 */
export function invites(client: typeof prisma = prisma): ClassInviteDelegate {
  return (client as unknown as { classInvite: ClassInviteDelegate }).classInvite;
}

export type InviteValidity =
  | { ok: true }
  | { ok: false; status: 404 | 410 | 409; error: string };

export function checkInviteValidity(inv: ClassInviteRow | null, now = new Date()): InviteValidity {
  if (!inv) return { ok: false, status: 404, error: "Mã mời không tồn tại" };
  if (inv.revoked) return { ok: false, status: 410, error: "Mã mời đã bị thu hồi" };
  if (inv.expiresAt && inv.expiresAt <= now) return { ok: false, status: 410, error: "Mã mời đã hết hạn" };
  if (inv.maxUses !== null && inv.usedCount >= inv.maxUses) {
    return { ok: false, status: 409, error: "Mã mời đã hết lượt sử dụng" };
  }
  return { ok: true };
}
