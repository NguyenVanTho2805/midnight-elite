// Phiên KiN → người dùng của lớp (docs/kin/lop/README.md bước 2). Thay bca/server/phien.ts: không cookie riêng, đọc phiên bằng getSession của KiN.
// Ánh xạ MẶC ĐỊNH, giữ nguyên luật KiN (mục 6 của README còn chờ chủ quyết): admin_super ⇒ chủ; teacher ⇒ giáo viên, môn theo bca_phan_cong; student ⇒ học sinh.
// `id` của chủ / giáo viên là User.id của KiN (cuid), KHÔNG phải bca_nguoi_dung.id (uuid).
import { getSession, type SessionPayload } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { LOP_ON } from "@/lib/features";
import { chuanHoaGmail, gmailGoc } from "./chuan-hoa";
import type { Nguoi } from "./quyen";

type HS = { id: number; ho_ten: string; an_luc: Date | null };
/** Nguồn dữ liệu của ánh xạ — tách ra để test không cần DB. */
export type KhoLop = {
  user(id: string): Promise<{ name: string; email: string; role: string; adminRole: string | null; banned: boolean; emailVerified: boolean } | null>;
  giaoVien(): Promise<{ gmail: string; khoa_luc: Date | null; phan_cong: { mon_id: number }[] }[]>;
  hsTheoUser(userId: string): Promise<HS | null>;
  hsTheoGmail(gmail: string): Promise<HS | null>;
};

const COT_HS = { id: true, ho_ten: true, an_luc: true } as const;
const khoPrisma: KhoLop = {
  user: (id) => prisma.user.findUnique({ where: { id }, select: { name: true, email: true, role: true, adminRole: true, banned: true, emailVerified: true } }),
  giaoVien: () => prisma.bcaNguoiDung.findMany({ select: { gmail: true, khoa_luc: true, phan_cong: { select: { mon_id: true } } } }),
  hsTheoUser: (userId) => prisma.bcaHocSinh.findFirst({ where: { userId }, orderBy: { id: "asc" }, select: COT_HS }),
  hsTheoGmail: (gmail) => prisma.bcaHocSinh.findUnique({ where: { gmail }, select: COT_HS }),
};

/** Phần thuần của ánh xạ. Nạp lại User từ CSDL mỗi lần: bị khoá, hoặc vai trong cookie lệch CSDL ⇒ null (đóng, không đoán). */
export async function nguoiTuPhien(p: SessionPayload | null, kho: KhoLop = khoPrisma, lopOn: boolean = LOP_ON): Promise<Nguoi | null> {
  if (!lopOn || !p) return null;
  const u = await kho.user(p.userId);
  if (!u || u.banned || u.role !== p.role || (u.adminRole ?? undefined) !== p.adminRole) return null;
  // Khớp theo email là cấp quyền: chỉ tin email đã xác minh (ai cũng đăng ký KiN được bằng email của người khác).
  const email = u.emailVerified ? u.email : null;
  if (p.role === "admin") {
    if (p.adminRole === "admin_super") return { vai: "chu", id: p.userId, ten: u.name, monIds: [] };
    if (p.adminRole !== "teacher") return null; // admin_content: chưa có quyết định ⇒ không vào lớp
    const goc = gmailGoc(email);
    const gv = goc ? (await kho.giaoVien()).find((x) => gmailGoc(x.gmail) === goc) : undefined;
    // Không có dòng bca_nguoi_dung / bị khoá (khoa_luc) / chưa phân công ⇒ không môn nào, không phải toàn quyền.
    return { vai: "giao_vien", id: p.userId, ten: u.name, monIds: gv && !gv.khoa_luc ? gv.phan_cong.map((x) => x.mon_id) : [] };
  }
  // shortcut: khớp gmail học sinh là so đúng chuỗi chữ thường (không gmailGoc như giáo viên) để khỏi quét cả bảng mỗi request; bỏ được khi bước chuyển dữ liệu đã ghi userId.
  const hs = (await kho.hsTheoUser(p.userId)) ?? (email ? await kho.hsTheoGmail(chuanHoaGmail(email)!) : null);
  // T41: hồ sơ bị ẩn ⇒ hết hiệu lực ngay.
  return hs && !hs.an_luc ? { vai: "hoc_sinh", hocSinhId: hs.id, ten: hs.ho_ten } : null;
}

/** Cho Server Component / route: người dùng lớp của phiên KiN hiện tại. Cờ LOP_ON tắt ⇒ luôn null, không đọc cookie hay CSDL. */
export async function nguoiLop(): Promise<Nguoi | null> {
  return LOP_ON ? nguoiTuPhien(await getSession()) : null;
}
