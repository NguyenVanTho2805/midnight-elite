// NC2-029 — dữ liệu giả cho luồng "gia sư mới có lớp đầu tiên" rút gọn. Hai tài khoản thử (mật khẩu chung của bộ mock):
//   • cho-duyet@kin.local — vừa đăng ký gia sư, ĐÃ xác thực email, CHƯA được duyệt (vẫn là học viên) → thấy thẻ "chờ duyệt".
//   • gs-moi@kin.local    — gia sư ĐÃ duyệt, CHƯA có lớp nào → thử "Tạo lớp đầu tiên" với form rút gọn (chỉ Tên), thấy chuyển hướng + nút "Mở lớp".
// Chạy lặp lại được: tài khoản đã có thì được đặt lại đúng trạng thái (gs-moi: xoá lớp thử cũ do chính nó tạo, nếu xoá được).
import type { MockCtx } from "../mock-seed";
import { mkTutor, mkUser } from "../h";

export default async function mock(ctx: MockCtx): Promise<string[]> {
  const { prisma } = ctx;
  const bio = "Cử nhân Toán, 3 năm dạy kèm lớp 9 và ôn thi vào 10 cho học sinh ở Hà Nội (dữ liệu thử).";

  let a = await prisma.user.findUnique({ where: { email: "cho-duyet@kin.local" } });
  if (!a) { const t = await mkUser({ name: "Cô Chờ Duyệt (thử)", role: "student", emailVerified: true }); a = await prisma.user.update({ where: { id: t.id }, data: { email: "cho-duyet@kin.local" } }); }
  await prisma.user.update({
    where: { id: a.id },
    data: { role: "student", adminRole: null, emailVerified: true, tutorAppliedAt: new Date(), tutorVerified: false, tutorVerifiedAt: null, tutorRejectedAt: null, tutorRejectReason: null, bio, subjects: ["Toán"] },
  });

  let b = await prisma.user.findUnique({ where: { email: "gs-moi@kin.local" } });
  if (!b) { const t = await mkTutor("Thầy Mới Dạy (thử)"); b = await prisma.user.update({ where: { id: t.id }, data: { email: "gs-moi@kin.local" } }); }
  await prisma.user.update({ where: { id: b.id }, data: { bio, subjects: ["Toán"], tutorAppliedAt: new Date("2026-09-01T00:00:00Z"), tutorVerified: true, tutorVerifiedAt: new Date("2026-09-02T00:00:00Z") } });
  const dropped = await prisma.course.deleteMany({ where: { ownerId: b.id } }).then(r => r.count).catch(() => -1);

  return [
    `Đăng nhập cho-duyet@kin.local → /student/viec-cua-toi · thẻ vàng "Hồ sơ gia sư của bạn đang chờ quản trị duyệt. KiN sẽ báo khi xong." ở đầu danh sách (học viên khác như hocsinh@kin.local KHÔNG thấy thẻ này)`,
    `Đăng nhập gs-moi@kin.local → /lop-cua-toi/lop → "Tạo lớp đầu tiên" → chỉ gõ Tên (ngày khai giảng / giá / số bài học ghi "tuỳ chọn") → "Tạo khoá học" → tự chuyển sang trang quản khoá, mở sẵn tab Lịch học, toast "Đã tạo khoá học mới", có nút "Mở lớp" (→ /lop-cua-toi/<lớp>, tab Mã mời)${dropped === -1 ? " [lưu ý: lớp thử cũ của tài khoản này không xoá được, có thể còn lớp]" : ""}`,
    `Cùng tài khoản gs-moi@kin.local → /admin/khoa-hoc → menu "···" của dòng lớp → "Mở lớp (mã mời, học viên)"`,
    `Đối chứng: admin@kin.local mở /admin/khoa-hoc?tao=1 (tên miền admin) → vẫn bắt buộc đủ Tên, Ngày khai giảng, Giá bán, Số bài học`,
  ];
}
