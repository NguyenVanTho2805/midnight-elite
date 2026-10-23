// Dữ liệu giả cho "Hồ sơ học sinh + đồng ý dữ liệu trẻ" (23/10/2026) của giasu@kin.local. Tên thử rõ ràng, chạy lặp lại được (xoá lô thử cũ rồi dựng lại).
// CHƯA có ý kiến luật sư: dữ liệu này chỉ để thử giao diện trên máy.
import { CONSENT_TEXT_VERSION } from "@/lib/consentPolicy";
import { newId } from "@/lib/studentProfileServer";
import { randomBytes } from "node:crypto";
import { mkUser } from "../h";
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

  // 10-11. Hai anh chị em chung liên hệ (HS-12) — gia đình thử; Bé Lô Ba chưa có phạm vi 'anh chị em' nên bị ẩn khỏi danh sách anh chị em.
  await prisma.familyGroup.deleteMany({ where: { tutorId: tutor.id, label: { contains: TAG } } });
  const fam = await prisma.familyGroup.create({ data: { tutorId: tutor.id, label: `Gia đình Thử ${TAG}`, guardianName: "Chị Mai", guardianPhone: "0912000099" } });
  for (const [n, extra] of [["Bé Anh Cả", ["family"]], ["Bé Em Út", ["family"]], ["Bé Cùng Nhà Ẩn", []]] as const) {
    const id = await mk(n, { ageGroup: "u7", guardianName: "Chị Mai", guardianPhone: "0912000099", familyId: fam.id, source: "manual" });
    await consent(id, ["guardian"], ["basic", ...extra]);
  }
  // 12-13. Hai em chờ xếp lớp theo thứ tự (LO-14)
  const e2 = await mk("Bé Chờ Thứ Hai", { ageGroup: "7to15", guardianName: "Chị Vy", guardianPhone: "0912000006", status: "waitlist", waitlistedAt: new Date(now.getTime() + 60_000), source: "request" });
  await consent(e2, ["guardian", "child"], ["basic"]);

  // Điểm từng buổi (BU-11): em có tài khoản trong lớp đầu tiên của gia sư, hồ sơ riêng có phạm vi 'scores', một buổi điểm danh có điểm, và link Sổ của con cho phụ huynh.
  let scoreLine = "";
  if (course) {
    const stuName = `Em Điểm Thử ${TAG}`;
    let stu = await prisma.user.findFirst({ where: { name: stuName } });
    if (!stu) { const u = await mkUser({ name: stuName }); stu = await prisma.user.findUniqueOrThrow({ where: { id: u.id } }); }
    await prisma.enrollment.upsert({ where: { userId_courseId: { userId: stu.id, courseId: course.id } }, create: { userId: stu.id, courseId: course.id, status: "active" }, update: { status: "active" } });
    await prisma.studentProfile.deleteMany({ where: { tutorId: tutor.id, userId: stu.id } });
    const pid = await mk(stuName.replace(` ${TAG}`, ""), { ageGroup: "16plus", userId: stu.id, source: "manual" });
    await consent(pid, ["self"], ["basic", "scores"]);
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const sess = await prisma.attendanceSession.upsert({ where: { courseId_date: { courseId: course.id, date } }, create: { courseId: course.id, date, createdBy: tutor.id }, update: {} });
    await prisma.attendanceRecord.upsert({ where: { sessionId_userId: { sessionId: sess.id, userId: stu.id } }, create: { sessionId: sess.id, userId: stu.id, status: "present" }, update: {} });
    await prisma.sessionStudentScore.upsert({ where: { sessionId_userId: { sessionId: sess.id, userId: stu.id } }, create: { sessionId: sess.id, userId: stu.id, tutorId: tutor.id, score: 8.5, homeworkPct: 90 }, update: { score: 8.5, homeworkPct: 90 } });
    const token = randomBytes(16).toString("hex");
    const par = await mkUser({ name: "Phụ huynh Em Điểm Thử (thử)" });
    await prisma.parentLink.create({ data: { parentId: par.id, studentId: stu.id, status: "verified", verifiedAt: now, portalToken: token } });
    scoreLine = `Điểm từng buổi — giasu@kin.local → Điểm danh của lớp "${course.name}" ngày hôm nay (/admin/khoa-hoc/${course.id}/diem-danh): mục 'Điểm từng buổi' dưới bảng, em 'Em Điểm Thử' có ô nhập (8,5 điểm, 90%); các em khác ghi 'Thiếu đồng ý ghi điểm'. Phụ huynh: ${process.env.BASE ?? "http://localhost:3000"}/so-cua-con/${token} → mục 'Điểm từng buổi'.`;
  }

  return [
    "Hồ sơ học sinh + đồng ý — đăng nhập giasu@kin.local → Học sinh (/lop-cua-toi/hoc-sinh): bấm tab 'Hồ sơ' (11 hồ sơ thử gắn '(thử)') và 'Chờ xếp lớp' (Bé Chờ Lớp).",
    "Bấm 'Mở hồ sơ' của 'Bé Minh Anh': đủ đồng ý, có thông tin mở rộng và trường tuỳ chỉnh; 'Bé Đã Thu Hồi': hồ sơ bị ẩn, chỉ còn tên + ô ghi đồng ý lại; sổ đồng ý và nhật ký sửa nằm cuối trang.",
    "Bấm 'Thêm học sinh' để chạy wizard 4 bước (ô đồng ý không tích sẵn, chưa tích đủ thì không lưu được); 'Nhập danh sách' để dán/CSV/Excel/lịch có xem trước và lỗi từng dòng; 'Trường tuỳ chỉnh' ở cuối trang Học sinh.",
    "Gia đình + danh sách chờ — trang Học sinh: tab 'Chờ xếp lớp' có 2 em theo thứ tự (Bé Chờ Lớp trước); mở hồ sơ 'Bé Anh Cả' để thấy mục 'Gia đình (chung liên hệ)': liên hệ chung, em cùng nhà, và 1 em bị ẩn vì chưa có đồng ý 'anh chị em'.",
    ...(scoreLine ? [scoreLine] : []),
    "Em tự đồng ý: đăng nhập hocsinh@kin.local → Hồ sơ (/student/ho-so), thẻ 'Đồng ý để gia sư ghi thông tin lớp học của em'.",
  ];
}
