// BU-HS-NOP-TEP — dọn tệp nộp bài hết hạn 60 ngày. CHỈ ba tập được xoá, mỗi tập một câu where xuất từ nopTep.ts (có test đối chiếu với hàm thuần):
//   1. expired : deletedAt = null AND expiresAt < now AND status ≠ expired       (60 ngày đúng giây chưa xoá; +1 ms thì xoá)
//   2. pending : status = pending AND createdAt < now − 24 giờ AND submissionId = null   (tải dở)
//   3. removed : status = removed AND deletedAt = null                           (bỏ đi nhưng kho còn; thử lại lần xoá thất bại)
// Không còn tập nào khác; KHÔNG có deleteMany; KHÔNG xoá hàng SubmissionFile (giữ làm dấu vết); KHÔNG chạm AssignmentSubmission (điểm, nhận xét, fileUrl, fileName nguyên vẹn).
// Thứ tự để lỗi giữa chừng không mất bản ghi: (1) xoá tệp gốc ở kho ("không tìm thấy" = thành công) → (2) CHỈ khi (1) xong mới cập nhật hàng (có điều kiện deletedAt = null) → lỗi ở (1) giữ nguyên hàng, lần sau thử lại.
// Mặc định CHẠY KHÔ: không chạm kho, không ghi DB. Log một dòng JSON: chỉ fileId, không tên tệp, không id học sinh.
import { prisma } from "@/lib/prisma";
import { deleteStored } from "@/lib/nopTepServer";
import { nopTepAbandonedWhere, nopTepExpiredWhere, nopTepRemovedLeftoverWhere } from "@/lib/nopTep";

export type NopTepExpirySet = "expired" | "pending" | "removed";
export interface NopTepExpirySetResult { found: number; deleted: number; failed: number; ids: string[] }
export interface NopTepExpiryResult { job: "het-han-tep-nop-bai"; dryRun: boolean; at: string; sets: Record<NopTepExpirySet, NopTepExpirySetResult>; partial: boolean }
export interface NopTepExpiryRow { id: string; driver: string; storageKey: string }
export interface NopTepExpiryDeps {
  /** Xoá tệp gốc; true = đã xoá hoặc vốn không có. Test tiêm lỗi vào đây. */
  deleteStored: (f: NopTepExpiryRow) => Promise<boolean>;
  /** Ghi nhận đã xoá kho. Test tiêm lỗi DB vào đây. */
  markDone: (id: string, set: NopTepExpirySet, now: Date) => Promise<void>;
}

export const NOP_TEP_EXPIRY_LIMIT = 100;
export const NOP_TEP_EXPIRY_BUDGET_MS = 8000;
export const NOP_TEP_EXPIRY_CONCURRENCY = 5;

const defaultDeps: NopTepExpiryDeps = {
  deleteStored,
  async markDone(id, set, now) {
    // Có điều kiện deletedAt = null: hai lần chạy chồng nhau không giẫm lên nhau.
    await prisma.submissionFile.updateMany({
      where: { id, deletedAt: null },
      data: set === "removed" ? { deletedAt: now } : { status: "expired", expiredAt: now, deletedAt: now },
    });
  },
};

export async function runNopTepExpiry(o: { now: Date; dryRun: boolean; limit?: number; budgetMs?: number; concurrency?: number; deps?: Partial<NopTepExpiryDeps> }): Promise<NopTepExpiryResult> {
  const { now, dryRun } = o;
  const limit = o.limit ?? NOP_TEP_EXPIRY_LIMIT, budgetMs = o.budgetMs ?? NOP_TEP_EXPIRY_BUDGET_MS, conc = Math.max(1, o.concurrency ?? NOP_TEP_EXPIRY_CONCURRENCY);
  const deps: NopTepExpiryDeps = { ...defaultDeps, ...o.deps };
  const started = Date.now();
  const sets: Record<NopTepExpirySet, NopTepExpirySetResult> = {
    expired: { found: 0, deleted: 0, failed: 0, ids: [] }, pending: { found: 0, deleted: 0, failed: 0, ids: [] }, removed: { found: 0, deleted: 0, failed: 0, ids: [] },
  };
  const plan: { set: NopTepExpirySet; where: object; orderBy: object }[] = [
    { set: "expired", where: nopTepExpiredWhere(now), orderBy: [{ expiresAt: "asc" }, { id: "asc" }] },
    { set: "pending", where: nopTepAbandonedWhere(now), orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
    { set: "removed", where: nopTepRemovedLeftoverWhere(), orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
  ];
  const handled = new Set<string>(); // một hàng có thể khớp hai tập (vd removed + quá hạn): chỉ xử lý một lần mỗi lần chạy
  let partial = false;

  for (const step of plan) {
    const r = sets[step.set];
    r.found = await prisma.submissionFile.count({ where: step.where });
    if (r.found === 0) continue;
    const rows: NopTepExpiryRow[] = (await prisma.submissionFile.findMany({
      where: step.where, orderBy: step.orderBy, take: limit, select: { id: true, driver: true, storageKey: true },
    })).filter(x => !handled.has(x.id));
    r.ids = rows.map(x => x.id);
    if (r.found > limit) partial = true;
    if (dryRun) continue;

    for (let i = 0; i < rows.length; i += conc) {
      if (Date.now() - started > budgetMs) { partial = true; break; }
      await Promise.all(rows.slice(i, i + conc).map(async row => {
        handled.add(row.id);
        let ok = false;
        try { ok = await deps.deleteStored(row); } catch { ok = false; }
        if (!ok) { r.failed++; return; }
        try { await deps.markDone(row.id, step.set, now); r.deleted++; } catch { r.failed++; }   // kho đã xoá, DB lỗi: lần sau (1) trả "không tìm thấy" = thành công rồi cập nhật
      }));
    }
  }
  const result: NopTepExpiryResult = { job: "het-han-tep-nop-bai", dryRun, at: now.toISOString(), sets, partial };
  console.info(JSON.stringify(result));
  return result;
}
