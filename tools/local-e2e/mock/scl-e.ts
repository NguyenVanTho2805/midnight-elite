// SCL nhóm E — dữ liệu GIẢ cho "Vào lớp": một lớp cũ của giasu@kin.local chưa chọn cách vào lớp (joinPolicy null ⇒ mã thành yêu cầu chờ duyệt, Q7),
// có mã lớp và hai học sinh thử đang xin vào. Chạy lặp lại được (id/email cố định, upsert). Chỉ tên thử, không dữ liệu thật.
import { generateInviteCode } from "@/lib/classInvite";
import type { MockFn } from "../mock-seed";

const COURSE_ID = "lop-scl-e-lop-cu";

const mock: MockFn = async ({ prisma, tutor }) => {
  const now = new Date().toISOString();
  await prisma.course.upsert({
    where: { id: COURSE_ID },
    update: { ownerId: tutor.id, joinPolicy: null, classStatus: "open" },
    create: {
      id: COURSE_ID, adminId: 990_000_000 + (Date.now() % 1_000_000), name: "Lý 11 (lớp cũ, thử Vào lớp)", adminName: "Lý 11 (lớp cũ, thử Vào lớp)", shortTitle: "Lý 11",
      category: "ly", instructor: "GV", teacherAvatar: "", openDate: "2026-09-01", types: [], bg: "var(--kin-nen-bang)", price: 0, createdAt: now,
      ownerId: tutor.id, joinPolicy: null, classStatus: "open",
    },
  });
  const existing = await prisma.classInvite.findFirst({ where: { courseId: COURSE_ID, kind: "class", revoked: false, maxUses: null, expiresAt: null } });
  const inv = existing ?? await prisma.classInvite.create({ data: { courseId: COURSE_ID, code: generateInviteCode(), maxUses: null, expiresAt: null, createdBy: tutor.id, kind: "class", boundUserId: null } });
  for (const [i, name] of ["Em Thử Xin Vào Một", "Em Thử Xin Vào Hai"].entries()) {
    const email = `scl-e-xin-vao-${i + 1}@kin.local`;
    const u = await prisma.user.upsert({ where: { email }, update: {}, create: { email, name, password: "x", role: "student", emailVerified: false } });
    await prisma.classJoinRequest.upsert({
      where: { userId_courseId: { userId: u.id, courseId: COURSE_ID } },
      update: { status: "pending", inviteId: inv.id, decidedAt: null, note: null },
      create: { userId: u.id, courseId: COURSE_ID, status: "pending", inviteId: inv.id },
    });
  }
  return [
    `SCL-E · giasu@kin.local → /lop-cua-toi/xin-vao-lop : hàng chờ gộp "Xin vào lớp (2)" của lớp "Lý 11 (lớp cũ, thử Vào lớp)"; bấm Duyệt là em vào lớp.`,
    `SCL-E · giasu@kin.local → /lop-cua-toi/quan-lop/${COURSE_ID}/hoc-vien?muc=ma-moi : một mã ${inv.code} + "Sao chép link mời" + "Đổi mã".`,
    `SCL-E · khách (chưa đăng nhập) mở /student/nhap-ma-lop?code=${inv.code} → đăng nhập mở sẵn tab Học sinh → "Tạo tài khoản KiN" 3 ô → về ô nhập mã → "Gửi yêu cầu vào lớp".`,
  ];
};
export default mock;
