// BU-03 P2 — HỢP ĐỒNG cho BU-04 (phòng thi phía học sinh): học sinh nào vào mã đề nào. THUẦN, ổn định, không ngẫu nhiên theo lần vào.
// Dùng: nhóm mã đề của đề gốc `rootId` có `n` mã (đề gốc = variantNo 1, con = 2..n). `pickVariantFor(rootId, userId, n)` trả chỉ số 0..n-1,
// và variantNo tương ứng = chỉ số + 1 (`pickVariantNo`). Cùng (rootId, userId, n) → luôn cùng kết quả; học sinh gặp cùng mã mọi lần vào.
import { createHash } from "node:crypto";

export function pickVariantFor(rootId: string, userId: string, n: number): number {
  if (!Number.isInteger(n) || n <= 1) return 0;
  const h = createHash("sha256").update(`${rootId}\u0000${userId}`).digest().readUInt32BE(0);
  return h % n;
}

/** variantNo (1..n) mà học sinh được giao. */
export function pickVariantNo(rootId: string, userId: string, n: number): number {
  return pickVariantFor(rootId, userId, n) + 1;
}
