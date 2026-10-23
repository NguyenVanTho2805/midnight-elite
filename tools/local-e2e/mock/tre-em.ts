// Dữ liệu giả cho "Hồ sơ học sinh + đồng ý dữ liệu trẻ" (23/10/2026) của giasu@kin.local. Tên thử rõ ràng, chạy lặp lại được (xoá lô thử cũ rồi dựng lại).
// CHƯA có ý kiến luật sư: dữ liệu này chỉ để thử giao diện trên máy.
import { CONSENT_TEXT_VERSION } from "@/lib/consentPolicy";
import { newId } from "@/lib/studentProfileServer";
import type { MockCtx } from "../mock-seed";

const TAG = "(thử)";

export default async function mock(ctx: MockCtx): Promise<string[]> {
  const { prisma, tutor } = ctx;
  await prisma.studentProfile.deleteMany({ where: { tutorId: tutor.id, name: { contains: TAG } } });
  await prisma.studentFieldDef.deleteMany({ where: { tutorId: tutor.id, label: { in: ["Lớp ở trường", "Mục tiêu điểm"] } } });
  const course = await prisma.course.findFirst({ where: { ownerId: tutor.id }, orderBy: { sortOrder: "asc" } });
  const f1 = await prisma.studentFieldDef.create({ data: { tutorId: tutor.id, label: "Lớp ở trường", position: 0 } });
  await prisma.studentFieldDef.create({ data: { tutorId: tutor.id, label: "Mục tiêu điểm", position: 1 } });

  const now = new Date();
  const consent = async (subjectId: string, parties: string[], scopes: string[], o: { revoke?: string[]; batchId?: string } = {}) => {
    for (const party of parties) {
      await prisma.consentRecord.create({
        data: {
          subjectType: "student_profile", subjectId, party, scopes, method: "tutor_attestation", textVersion: CONSENT_TEXT_VERSION, givenById: tutor.id, givenByRole: "tutor",
          batchId: o.batchId ?? null, grantedAt: new Date(now.getTime() - 86_400_000),
          ...(o.revoke?.includes(party) ? { revokedAt: now, revokedById: tutor.id, revokeCause: "guardian_request" } : {}),
        },
      });
    }
  };
  const mk = async (name: string, data: Record<string, unknown>) => {
    const id = newId();
    await prisma.studentProfile.create({ data: { id, tutorId: tutor.id, name: `${name} ${TAG}`, courseId: course?.id ?? null, ...data } as never });
    return id;
  };

  // 1. Con 7-15 tuổi, đủ đồng ý cơ bản + mở rộng của cả phụ huynh và em
  const a = await mk("Bé Minh Anh", {
    ageGroup: "7to15", guardianName: "Chị Hoa", guardianPhone: "0912000001", birthDate: "2014-03-15", address: "12 phố Thử Nghiệm", phone: "0987000001", phoneExtra: "0987000002",
    email: "minhanh.thu@example.com", startDate: "2026-09-01", subjects: ["Toán", "Lý"], notes: "Hay quên vở, cần nhắc.", customData: { [f1.id]: "Lớp 6A" }, source: "wizard",
  });
  await consent(a, ["guardian", "child"], ["basic", "extended"]);
  // 2. Dưới 7 tuổi, chỉ đồng ý cơ bản của phụ huynh
  const b = await mk("Bé Bông", { ageGroup: "u7", guardianName: "Anh Nam", guardianPhone: "0912000002", source: "manual" });
  await consent(b, ["guardian"], ["basic"]);
  // 3. Người lớn 16+, tự đồng ý
  const c = await mk("Anh Khoa", { ageGroup: "16plus", phone: "0987000003", birthDate: "2000-01-20", source: "manual" });
  await consent(c, ["self"], ["basic", "extended"]);
  // 4. Đã bị thu hồi đồng ý của phụ huynh → hồ sơ bị ẩn
  const d = await mk("Bé Đã Thu Hồi", { ageGroup: "7to15", guardianName: "Chị Lan", guardianPhone: "0912000003", address: "Địa chỉ bí mật", source: "manual" });
  await consent(d, ["guardian", "child"], ["basic", "extended"], { revoke: ["guardian"] });
  // 5. Đang chờ xếp lớp
  const e = await mk("Bé Chờ Lớp", { ageGroup: "7to15", guardianName: "Chị Mai", guardianPhone: "0912000004", status: "waitlist", waitlistedAt: now, source: "request" });
  await consent(e, ["guardian", "child"], ["basic"]);
  // 6. Không hoạt động
  const f = await mk("Bé Đã Nghỉ", { ageGroup: "u7", guardianName: "Chị Thu", guardianPhone: "0912000005", status: "inactive", source: "manual" });
  await consent(f, ["guardian"], ["basic"]);
  // 7-9. Một lô nhập hàng loạt (ghi vết theo lần nhập)
  const batchId = newId();
  for (const n of ["Bé Lô Một", "Bé Lô Hai", "Bé Lô Ba"]) {
    const id = await mk(n, { ageGroup: "7to15", guardianPhone: "0912000" + String(10 + n.length), source: "paste", batchId });
    await consent(id, ["guardian", "child"], ["basic"], { batchId });
  }
  await prisma.auditLog.create({ data: { actorId: tutor.id, action: "student_profile.import", resourceType: "StudentProfile", resourceId: batchId, metadata: { count: 3, source: "paste", rights: true } } });

  return [
    "Hồ sơ học sinh + đồng ý — đăng nhập giasu@kin.local → Học sinh (/lop-cua-toi/hoc-sinh): bấm tab 'Hồ sơ' (8 hồ sơ thử gắn '(thử)') và 'Chờ xếp lớp' (Bé Chờ Lớp).",
    "Bấm 'Mở hồ sơ' của 'Bé Minh Anh': đủ đồng ý, có thông tin mở rộng và trường tuỳ chỉnh; 'Bé Đã Thu Hồi': hồ sơ bị ẩn, chỉ còn tên + ô ghi đồng ý lại; sổ đồng ý và nhật ký sửa nằm cuối trang.",
    "Bấm 'Thêm học sinh' để chạy wizard 4 bước (ô đồng ý không tích sẵn, chưa tích đủ thì không lưu được); 'Nhập danh sách' để dán/CSV/Excel/lịch có xem trước và lỗi từng dòng; 'Trường tuỳ chỉnh' ở cuối trang Học sinh.",
    "Em tự đồng ý: đăng nhập hocsinh@kin.local → Hồ sơ (/student/ho-so), thẻ 'Đồng ý để gia sư ghi thông tin lớp học của em'.",
  ];
}
