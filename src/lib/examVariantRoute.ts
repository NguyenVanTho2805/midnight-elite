// BU-04 — định tuyến mã đề cho phòng thi học sinh. THUẦN (không prisma, không next). Phần có DB: examVariantServer.ts.
// Mô hình (BU-03): đề gốc có variantNo 1 (hoặc null nếu chưa chia mã), mã con có variantOfId = id gốc và variantNo 2..N.
// Học sinh KHÔNG bao giờ biết id/số mã của mã khác; mọi id mã con quy về gốc trước khi dùng.
import { pickVariantNo } from "@/lib/deThiVariantPick";
import { variantCode } from "@/lib/deThiVariants";

export interface VariantRef { id: string; variantOfId: string | null }
/** Id gốc: mã con → `variantOfId`; đề gốc / đề thường → chính nó. */
export function rootIdOf(exam: VariantRef): string {
  return exam.variantOfId ?? exam.id;
}

export interface GroupMember { id: string; variantNo: number | null }
const noOf = (m: GroupMember, isRoot: boolean) => (isRoot ? 1 : m.variantNo ?? 0);

/** Các thành viên nhóm theo variantNo tăng dần; đề gốc luôn là 1 (kể cả khi cột variantNo còn null). Trùng id bị gộp. */
export function normalizeMembers(rootId: string, members: readonly GroupMember[]): { id: string; variantNo: number }[] {
  const seen = new Set<string>();
  const out: { id: string; variantNo: number }[] = [];
  for (const m of members) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    out.push({ id: m.id, variantNo: noOf(m, m.id === rootId) });
  }
  if (!seen.has(rootId)) out.push({ id: rootId, variantNo: 1 });
  return out.sort((a, b) => a.variantNo - b.variantNo || a.id.localeCompare(b.id));
}

export function memberIds(rootId: string, members: readonly GroupMember[]): string[] {
  return normalizeMembers(rootId, members).map(m => m.id);
}

/**
 * Mã đề của học sinh: ổn định theo (gốc, học sinh, số mã) — cùng bộ ba luôn ra cùng mã (không ngẫu nhiên theo lần vào).
 * Nhóm 1 mã → chính đề gốc. Số mã n lấy từ số thành viên; mã tìm không thấy theo variantNo thì rơi về chỉ số.
 */
export function pickMember(rootId: string, userId: string, members: readonly GroupMember[]): { id: string; variantNo: number } {
  const list = normalizeMembers(rootId, members);
  const n = list.length;
  if (n <= 1) return list.find(m => m.id === rootId) ?? { id: rootId, variantNo: 1 };
  const want = pickVariantNo(rootId, userId, n);
  return list.find(m => m.variantNo === want) ?? list[want - 1] ?? list[0];
}

/** Mã hiển thị (101, 102…) — chỉ khi đề thật sự có nhiều mã; ngược lại null. */
export function variantCodeOf(groupSize: number, variantNo: number): number | null {
  return groupSize > 1 && Number.isInteger(variantNo) && variantNo >= 1 ? variantCode(variantNo) : null;
}

/**
 * Đề này có được LIỆT KÊ cho học sinh không.
 *  - mã con: không bao giờ (vào bằng đường dẫn thì quy về gốc);
 *  - "giao theo link" (không gắn lớp, chủ đề là gia sư): không liệt kê, nhưng vẫn vào được bằng đường dẫn;
 *  - có `enrolledCourseIds`: đề gắn lớp chỉ liệt kê khi học sinh đang học lớp đó (đề không lớp của quản trị = thư viện chung vẫn hiện).
 */
export function isListedToStudent(
  exam: { variantOfId: string | null; courseId: string | null },
  ownerAdminRole: string | null | undefined,
  enrolledCourseIds?: ReadonlySet<string> | null,
): boolean {
  if (exam.variantOfId) return false;
  if (exam.courseId === null) return ownerAdminRole !== "teacher";
  if (enrolledCourseIds) return enrolledCourseIds.has(exam.courseId);
  return true;
}
