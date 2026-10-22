// NC2-022 — dữ liệu giả cho công tắc Hiện / Ẩn hồ sơ công khai: hai gia sư thử ĐÃ DUYỆT, đều có lớp + vài buổi đã dạy.
//   • "Cô Hiện Hồ Sơ (thử)"  hien@kin.local — đang HIỆN (mặc định).
//   • "Thầy Ẩn Hồ Sơ (thử)"  an@kin.local   — đã ẨN (User.preferences.profile.hidden = true).
// Chạy lặp lại được: nếu tài khoản đã có thì dùng lại và đặt đúng trạng thái hiện / ẩn.
import type { MockCtx } from "../mock-seed";
import { mkAttendanceSession, mkCourse, mkTutor, mkUser } from "../h";

const dayAgo = (n: number) => new Date(`${new Date(Date.now() - n * 86_400_000 + 7 * 3_600_000).toISOString().slice(0, 10)}T00:00:00Z`); // ngày giờ VN

export default async function mock(ctx: MockCtx): Promise<string[]> {
  const { prisma } = ctx;
  async function tutor(email: string, name: string, bio: string, hidden: boolean) {
    let u = await prisma.user.findUnique({ where: { email } });
    const fresh = !u;
    if (!u) {
      const t = await mkTutor(name);
      u = await prisma.user.update({ where: { id: t.id }, data: { email } });
    }
    await prisma.user.update({
      where: { id: u.id },
      data: {
        name, bio, subjects: ["Toán 9", "Luyện thi vào 10"], tutorVerified: true, tutorVerifiedAt: new Date("2026-09-01T00:00:00Z"), city: "Hà Nội",
        preferences: { teaching: { district: "Cầu Giấy", mode: "both", credential: "ĐH Sư phạm Hà Nội · Cử nhân Toán (thử)" }, ...(hidden ? { profile: { hidden: true } } : {}) },
      },
    });
    if (fresh) {
      const c = await mkCourse(u.id, { name: `Toán 9 — ${name}`, capacity: 6 });
      for (let i = 0; i < 3; i++) await prisma.enrollment.create({ data: { userId: (await mkUser({ name: `HS thử ${i + 1}` })).id, courseId: c.id, status: "active" } });
      for (const n of [20, 13, 6]) await mkAttendanceSession(c.id, u.id, dayAgo(n));
    }
    return u;
  }
  const hien = await tutor("hien@kin.local", "Cô Hiện Hồ Sơ (thử)", "Gia sư Toán 9, hồ sơ đang HIỆN (dữ liệu thử).", false);
  const an = await tutor("an@kin.local", "Thầy Ẩn Hồ Sơ (thử)", "Gia sư Toán 9, hồ sơ đang ẨN (dữ liệu thử).", true);
  return [
    `/giang-vien (không cần đăng nhập) · thấy thẻ "Cô Hiện Hồ Sơ (thử)", KHÔNG thấy "Thầy Ẩn Hồ Sơ (thử)"`,
    `/mentor/${hien.id} · mở được hồ sơ của cô Hiện`,
    `/mentor/${an.id} · báo "Không tìm thấy gia sư" (thầy Ẩn đã ẩn hồ sơ)`,
    `Đăng nhập an@kin.local → /lop-cua-toi/ho-so · công tắc "Hồ sơ công khai: Ẩn" (tắt); bản xem trước vẫn xem được, ghi "Hồ sơ đang ẩn"; bật lại thì /mentor/${an.id} mở được`,
    `Đăng nhập hien@kin.local → /lop-cua-toi/ho-so · công tắc "Hiện" (bật); bấm tắt thì cô biến khỏi /giang-vien`,
    `Đăng nhập an@kin.local → /lop-cua-toi/bai-dang · cảnh báo "Hồ sơ của bạn đang ẩn nên link trong bài chưa mở được"`,
  ];
}
