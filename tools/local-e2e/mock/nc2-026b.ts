// NC2-026b / NC2-029c — dữ liệu giả:
//  (1) hai em chỉ còn ghi danh "suspended" / "pending_consent" với link Sổ của con (câu đúng sự thật, không lộ lớp/tiền);
//  (2) cho-gs@kin.local = gia sư vừa đăng ký, đã xác thực email, CHƯA duyệt — để thử "quản trị duyệt → tải lại → vào được, không đăng nhập lại".
// Chạy lặp lại được.
import { mkCourse, mkUser } from "../h";
import type { MockCtx } from "../mock-seed";

const COURSE = "Toán 8 — thử tạm dừng / chờ đồng ý (dữ liệu giả)";
const T_SUSP = "026b1000026b1000026b1000026b1000";
const T_PEND = "026b2000026b2000026b2000026b2000";
const BIO = "Dạy Toán cấp 2 ba năm, đã đỗ chuyên Toán, từng kèm nhóm nhỏ ở Hà Nội. (dữ liệu giả) ".repeat(3);

export default async function mock(ctx: MockCtx): Promise<string[]> {
  const { prisma, tutor } = ctx;
  let course = await prisma.course.findFirst({ where: { ownerId: tutor.id, name: COURSE } });
  if (!course) course = await mkCourse(tutor.id, { name: COURSE });
  const parent = (await prisma.user.findFirst({ where: { name: "PH Tạm Dừng (thử)" } })) ?? (await mkUser({ name: "PH Tạm Dừng (thử)" }));

  for (const [name, status, token] of [["Em Tạm Dừng (thử)", "suspended", T_SUSP], ["Em Chờ Đồng Ý (thử)", "pending_consent", T_PEND]] as const) {
    const stu = (await prisma.user.findFirst({ where: { name } })) ?? (await mkUser({ name }));
    await prisma.enrollment.upsert({
      where: { userId_courseId: { userId: stu.id, courseId: course.id } },
      create: { userId: stu.id, courseId: course.id, status },
      update: { status },
    });
    await prisma.parentLink.deleteMany({ where: { studentId: stu.id } });
    await prisma.parentLink.create({ data: { parentId: parent.id, studentId: stu.id, status: "verified", verifiedAt: new Date(), portalToken: token } });
  }

  let cho = await prisma.user.findFirst({ where: { email: "cho-gs@kin.local" } });
  if (!cho) {
    const u = await mkUser({ name: "Gia sư Chờ Duyệt (thử)", emailVerified: true });
    cho = await prisma.user.update({ where: { id: u.id }, data: { email: "cho-gs@kin.local" } });
  }
  // Về trạng thái "đã nộp hồ sơ, chưa duyệt" (kể cả khi đã thử duyệt ở lần trước).
  await prisma.user.update({
    where: { id: cho.id },
    data: { role: "student", adminRole: null, tutorVerified: false, emailVerified: true, tutorAppliedAt: new Date(), bio: BIO, subjects: ["Toán", "Lý"], city: "Hà Nội" },
  });

  const base = process.env.BASE ?? "http://localhost:3000";
  return [
    `Sổ của con, em đang tạm dừng — mở ${base}/so-cua-con/${T_SUSP} : câu "Lớp của con đang tạm dừng. Anh/chị liên hệ gia sư để biết thêm." (không có tên lớp, phiếu, tiền).`,
    `Sổ của con, em chờ phụ huynh đồng ý — mở ${base}/so-cua-con/${T_PEND} : câu "Lớp của con đang chờ anh/chị đồng ý theo quy định. Anh/chị liên hệ gia sư để hoàn tất."`,
    `Phiên tự đồng bộ vai — đăng nhập cho-gs@kin.local (mật khẩu chung Passw0rd!) ở ${base} (chưa vào được khung gia sư); ở tab khác đăng nhập admin@kin.local trên tên miền admin, vào Hồ sơ gia sư và bấm Duyệt "Gia sư Chờ Duyệt (thử)"; quay lại tab đầu, TẢI LẠI trang ${base}/lop-cua-toi → vào được ngay, không phải đăng nhập lại.`,
  ];
}
