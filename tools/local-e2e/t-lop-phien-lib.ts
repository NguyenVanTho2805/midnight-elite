// KiN lớp bước 2 — ánh xạ phiên KiN → người dùng của lớp (src/lib/lop/phien.ts, hàm thuần nguoiTuPhien). Phiên giả + kho giả: không DB, không mạng, không dev server.
// Ca phá cố ý (đã chạy 27/11/2026, mỗi cái làm ĐỎ đúng ca tương ứng): bỏ kiểm cờ → 2 đỏ; bỏ kiểm banned → 1; bỏ so vai cookie với CSDL → 1; tin email chưa xác minh → 2;
// bỏ khoa_luc → 1; so gmail giáo viên bằng chuỗi thô thay gmailGoc → 2; bỏ dòng chặn admin_content → 1; bỏ an_luc → 1; tìm gmail trước userId → 2.
import { nguoiTuPhien, type KhoLop } from "@/lib/lop/phien";
import type { SessionPayload } from "@/lib/session";
import { check, section, done } from "./h";

const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
type U = NonNullable<Awaited<ReturnType<KhoLop["user"]>>>;
const user = (o: Partial<U> = {}): U => ({ name: "Tên", email: "a@gmail.com", role: "student", adminRole: null, banned: false, emailVerified: true, ...o });
const GV = [
  { gmail: "co.anh@gmail.com", khoa_luc: null, phan_cong: [{ mon_id: 4 }, { mon_id: 1 }] },
  { gmail: "khoa@gmail.com", khoa_luc: new Date("2026-11-01T00:00:00Z"), phan_cong: [{ mon_id: 2 }] },
  { gmail: "moi@gmail.com", khoa_luc: null, phan_cong: [] },
];
const HS_USER = { id: 7, ho_ten: "Em Bảy", an_luc: null }, HS_GMAIL = { id: 9, ho_ten: "Em Chín", an_luc: null };
let goi: string[] = [];
const kho = (u: U | null, o: Partial<KhoLop> = {}): KhoLop => ({
  user: async () => { goi.push("user"); return u; },
  giaoVien: async () => { goi.push("giaoVien"); return GV; },
  hsTheoUser: async (id) => { goi.push("hsTheoUser"); return id === "u-noi" ? HS_USER : null; },
  hsTheoGmail: async (g) => { goi.push(`hsTheoGmail:${g}`); return g === "em9@gmail.com" ? HS_GMAIL : null; },
  ...o,
});
const sup: SessionPayload = { userId: "u1", role: "admin", adminRole: "admin_super" };
const gv: SessionPayload = { userId: "u2", role: "admin", adminRole: "teacher" };
const nd: SessionPayload = { userId: "u3", role: "admin", adminRole: "admin_content" };
const hs = (userId = "u4"): SessionPayload => ({ userId, role: "student" });
const uSup = user({ role: "admin", adminRole: "admin_super", name: "Chủ" });
const uGv = (o: Partial<U> = {}) => user({ role: "admin", adminRole: "teacher", name: "Cô Anh", email: "co.anh@gmail.com", ...o });

async function main() {
  section("Cờ LOP_ON và phiên");
  goi = [];
  check("cờ tắt ⇒ null cho mọi vai, không đọc kho", (await Promise.all([sup, gv, hs("u-noi")].map((p) => nguoiTuPhien(p, kho(uSup), false)))).every((x) => x === null) && goi.length === 0, goi);
  check("mặc định (máy không đặt NEXT_PUBLIC_KIN_MO_LOP_ON=1) ⇒ null", process.env.NEXT_PUBLIC_KIN_MO_LOP_ON === "1" || (await nguoiTuPhien(sup, kho(uSup))) === null);
  check("không có phiên ⇒ null", (await nguoiTuPhien(null, kho(uSup), true)) === null);
  check("User không còn trong CSDL ⇒ null", (await nguoiTuPhien(sup, kho(null), true)) === null);
  check("User bị khoá (banned) ⇒ null", (await nguoiTuPhien(sup, kho({ ...uSup, banned: true }), true)) === null);
  check("cookie admin_super nhưng CSDL đã hạ còn teacher ⇒ null", (await nguoiTuPhien(sup, kho(uGv()), true)) === null);
  check("cookie student nhưng CSDL là admin ⇒ null", (await nguoiTuPhien(hs(), kho(uSup), true)) === null);

  section("Quản trị cao nhất ⇒ chủ");
  goi = [];
  const chu = await nguoiTuPhien(sup, kho(uSup), true);
  check("admin_super ⇒ vai chu, id = User.id của KiN, tên theo User", eq(chu, { vai: "chu", id: "u1", ten: "Chủ", monIds: [] }), chu);
  check("chủ không cần dòng bca_nguoi_dung (không đọc bảng lớp)", eq(goi, ["user"]), goi);
  check("admin_content ⇒ null (chưa có quyết định)", (await nguoiTuPhien(nd, kho(user({ role: "admin", adminRole: "admin_content" })), true)) === null);

  section("Giáo viên ⇒ giao_vien, môn theo bca_phan_cong");
  const a = await nguoiTuPhien(gv, kho(uGv()), true);
  check("gmail trùng ⇒ đúng các môn được phân công", eq(a, { vai: "giao_vien", id: "u2", ten: "Cô Anh", monIds: [4, 1] }), a);
  const b = await nguoiTuPhien(gv, kho(uGv({ email: "CoAnh+lop@googlemail.com" })), true);
  check("so bằng gmailGoc: hoa/thường, dấu chấm, +nhãn, googlemail vẫn khớp", b?.vai === "giao_vien" && eq(b.monIds, [4, 1]), b);
  const c = await nguoiTuPhien(gv, kho(uGv({ email: "la@gmail.com" })), true);
  check("không có dòng bca_nguoi_dung ⇒ giao_vien nhưng KHÔNG môn nào", eq(c, { vai: "giao_vien", id: "u2", ten: "Cô Anh", monIds: [] }), c);
  const d = await nguoiTuPhien(gv, kho(uGv({ email: "moi@gmail.com" })), true);
  check("có dòng nhưng chưa phân công ⇒ không môn nào", d?.vai === "giao_vien" && d.monIds.length === 0, d);
  const e = await nguoiTuPhien(gv, kho(uGv({ email: "khoa@gmail.com" })), true);
  check("tài khoản lớp bị khoá (khoa_luc) ⇒ không môn nào", e?.vai === "giao_vien" && e.monIds.length === 0, e);
  const f = await nguoiTuPhien(gv, kho(uGv({ emailVerified: false })), true);
  check("email KiN chưa xác minh ⇒ không khớp phân công (không môn nào)", f?.vai === "giao_vien" && f.monIds.length === 0, f);

  section("Học sinh ⇒ hoc_sinh");
  goi = [];
  const h1 = await nguoiTuPhien(hs("u-noi"), kho(user({ email: "em9@gmail.com" })), true);
  check("đã nối userId ⇒ đúng hồ sơ đó, không tìm theo gmail nữa", eq(h1, { vai: "hoc_sinh", hocSinhId: 7, ten: "Em Bảy" }) && !goi.some((x) => x.startsWith("hsTheoGmail")), [h1, goi]);
  goi = [];
  const h2 = await nguoiTuPhien(hs(), kho(user({ email: " Em9@Gmail.com" })), true);
  check("chưa nối ⇒ tìm theo gmail đã chuẩn hoá (chữ thường, bỏ khoảng trắng)", eq(h2, { vai: "hoc_sinh", hocSinhId: 9, ten: "Em Chín" }) && goi.includes("hsTheoGmail:em9@gmail.com"), [h2, goi]);
  check("không thấy hồ sơ nào ⇒ null", (await nguoiTuPhien(hs(), kho(user({ email: "la@gmail.com" })), true)) === null);
  goi = [];
  check("email KiN chưa xác minh ⇒ không tìm theo gmail ⇒ null", (await nguoiTuPhien(hs(), kho(user({ email: "em9@gmail.com", emailVerified: false })), true)) === null && !goi.some((x) => x.startsWith("hsTheoGmail")), goi);
  const an = { hsTheoUser: async () => ({ ...HS_USER, an_luc: new Date() }) };
  check("hồ sơ bị ẩn (an_luc) ⇒ null, không rơi sang hồ sơ khác theo gmail (T41)", (await nguoiTuPhien(hs("u-noi"), kho(user({ email: "em9@gmail.com" }), an), true)) === null);
  check("học sinh không bao giờ thành vai quản lý", h1?.vai === "hoc_sinh" && h2?.vai === "hoc_sinh" && !("monIds" in (h1 ?? {})));
  await done();
}
main();
