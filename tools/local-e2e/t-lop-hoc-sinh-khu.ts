// KiN lớp bước 7 — khu HỌC SINH ở mức HÀM MÁY CHỦ (src/lib/lop/server/hs.ts: cuaToi, buoiCuaToi, chuoiDiHoc, noiHoSoLop) + gỡ nối khi chủ đổi Gmail (hoc-sinh.ts suaHoSoHocSinh),
// với giờ cố định ("bây giờ" = 22:00 26/11/2026) trên DB cục bộ của worktree. Chuyển từ test gốc của web lớp: bca/tests/khu-hoc-sinh.test.ts (6 ca "cuaToi"; ca route nằm ở t-lop-hoc-sinh-khu-api.ts).
// Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-lop-hoc-sinh-khu.ts   (cần cầu nối DB cổng 443 — .local-dev/wt-up.sh tự bật; KHÔNG cần dev server, không phụ thuộc cờ).
// Dữ liệu: nạp lại bca_* từ `bca_gia` trước và sau (lop-db.ts) — không wipe(). Tài khoản KiN thử tạo bằng upsert; bài khẳng định bảng users không đổi trong lúc nối.
// Khác bản gốc: cuaToi của KiN không trả `tinh_trang` (chuỗi của chủ) và chỉ chọn ma_hs + ho_ten của hồ sơ ⇒ ca "không có câu 'hỏi em'" soát cả JSON trả về.
// Ca phá cố ý (đã chạy 27/11/2026, phá → đỏ → trả lại): cuaToi bỏ `ch ?` ở link_meet → 2 ca "hết thử / hết hạn" đỏ; linkAnToan trả nguyên chuỗi → 2 ca (ZALO_CHUNG, "javascript:") đỏ;
// noiHoSoLop bỏ điều kiện emailVerified → ca "chưa xác minh" đỏ; bỏ `an_luc: null` ở CẢ HAI chỗ (lọc ứng viên + câu UPDATE) → ca "hồ sơ ẩn" đỏ (bỏ một chỗ thì bài vẫn xanh: chỗ kia còn chặn);
// `ung.length !== 1` thành `!ung.length` (lấy hồ sơ đầu) → 2 ca "khớp nhiều" đỏ; suaHoSoHocSinh bỏ `userId: null` → 2 ca "đổi Gmail" đỏ.
import bcrypt from "bcryptjs";
import { check, section, done } from "./h";
import { CHU, buoiId, db, hsId, loi, napLaiBca, nguoi } from "./lop-db";
import { lucVN } from "@/lib/lop/ngay";
import { nguoiTuPhien } from "@/lib/lop/phien";
import { LoiQuyen, type NguoiHocSinh } from "@/lib/lop/quyen";
import { buoiCuaToi, chuoiDiHoc, cuaToi, noiHoSoLop } from "@/lib/lop/server/hs";
import { suaHoSoHocSinh } from "@/lib/lop/server/hoc-sinh";
import type { SessionPayload } from "@/lib/session";

const T22 = lucVN("2026-11-26", "22:00");
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
type D = Awaited<ReturnType<typeof cuaToi>>;
const MEET = "https://meet.google.com/aaa-bbbb-ccc", ZALO = "https://zalo.me/g/toan";
const nguoiHs = async (ma: string): Promise<NguoiHocSinh> => { const h = await db.bcaHocSinh.findUniqueOrThrow({ where: { ma_hs: ma } }); return { vai: "hoc_sinh", hocSinhId: h.id, ten: h.ho_ten }; };
async function tk(email: string, o: { role?: "student" | "admin"; adminRole?: "teacher"; emailVerified?: boolean; banned?: boolean } = {}): Promise<SessionPayload> {
  const data = { name: `B7 ${email}`, role: o.role ?? "student", adminRole: o.adminRole ?? null, emailVerified: o.emailVerified ?? true, banned: o.banned ?? false };
  const u = await db.user.upsert({ where: { email }, update: data, create: { ...data, email, password: await bcrypt.hash("Passw0rd!", 4) } });
  return { userId: u.id, role: data.role, adminRole: o.adminRole };
}
const userIdCua = async (ma: string) => (await db.bcaHocSinh.findUniqueOrThrow({ where: { ma_hs: ma }, select: { userId: true } })).userId;
const nkNoi = (ma: string) => db.bcaNhatKy.findMany({ where: { hanh_dong: "noi_tai_khoan_kin", doi_tuong_id: ma }, orderBy: { id: "asc" } });

async function main() {
  napLaiBca();
  await db.bcaMon.update({ where: { ma: "toan" }, data: { link_meet: MEET, link_zalo: ZALO } });
  for (const [khoa, gia_tri] of [["ZALO_HOC_THU", "https://zalo.me/g/hocthu"], ["ZALO_CHUNG", "nhắn chị Thu"]] as const) await db.bcaCaiDat.upsert({ where: { khoa }, update: { gia_tri }, create: { khoa, gia_tri } });
  const hs = await db.bcaHocSinh.findMany({ where: { an_luc: null }, select: { ma_hs: true }, orderBy: { ma_hs: "asc" } });
  const tatCa: { ma: string; d: D }[] = [];
  for (const { ma_hs } of hs) tatCa.push({ ma: ma_hs, d: await cuaToi(await nguoiHs(ma_hs), T22) });
  const tim = (f: (d: D) => boolean) => tatCa.find((x) => f(x.d));

  section("cuaToi — dữ liệu cho màn học sinh (6 ca gốc)");
  {
    const d = tatCa.find((x) => x.ma === "HS0021")!.d;
    const toan = d.mon.find((m) => m.ma === "toan")!;
    check("em thử còn hạn (HS0021): dang_thu, ngày thử 12/14, còn 2 ngày, hết 28/11", d.trang_thai === "dang_thu" && eq(d.thu, { tu: "2026-11-15", den: "2026-11-28", con_ngay: 2, ngay_thu: 12, tong_ngay: 14 }), [d.trang_thai, d.thu]);
    check("…môn Toán còn hạn: có link Meet + Zalo môn, giờ 22:15, Thứ Ba + Thứ Bảy", toan.ten_day_du === "Toán" && toan.o === "thu" && toan.con_han && toan.link_meet === MEET && toan.link_zalo === ZALO && toan.gio === "22:15" && eq(toan.thu, [2, 6]), toan);
    check("…liên hệ: Zalo học thử là link; ZALO_CHUNG không phải link ⇒ null", eq(d.lien_he, { zalo_hoc_thu: "https://zalo.me/g/hocthu", zalo_chung: null }), d.lien_he);
    check("…mọi buổi có giờ bắt đầu dạng chuỗi và 90 phút", d.buoi.length > 0 && d.buoi.every((b) => typeof b.bat_dau === "string" && b.so_phut === 90));
  }
  {
    const x = tim((d) => d.trang_thai === "het_thu");
    check("em hết thử: het_thu, có ngày hết, không khối học thử", !!x && /^2026-/.test(x.d.het_thu ?? "") && x.d.thu === null, x?.ma);
    check("…KHÔNG link Meet / Zalo môn, không nội dung / record, mọi buổi khoá", !!x && x.d.mon.every((m) => m.link_meet === null && m.link_zalo === null && !m.con_han) && x.d.buoi.every((b) => b.noi_dung === null && b.link_record === null && b.khoa));
  }
  {
    const x = tim((d) => d.trang_thai === "dang_hoc");
    check("em chính thức: dang_hoc, không có khối học thử", !!x && x.d.thu === null, x?.ma);
    check("không em nào nhận câu 'hỏi em' của chủ (soát cả JSON)", !tatCa.some((y) => JSON.stringify(y.d).includes("hỏi em")));
  }
  {
    await db.bcaMon.update({ where: { ma: "toan" }, data: { link_meet: "javascript:alert(1)", link_zalo: "zalo nhóm toán" } });
    const toan = (await cuaToi(await nguoiHs("HS0021"), T22)).mon.find((m) => m.ma === "toan")!;
    check("link không phải http(s) ('javascript:', chữ rác chuyển từ sheet) ⇒ null, không trả cho học sinh", toan.link_meet === null && toan.link_zalo === null, toan);
    await db.bcaMon.update({ where: { ma: "toan" }, data: { link_meet: MEET, link_zalo: ZALO } });
  }
  check("trạng thái luôn thuộc tập đã đặc tả", tatCa.every(({ d }) => ["dang_hoc", "dang_thu", "sap_bat_dau", "chua_ghi_danh", "het_thu", "da_nghi"].includes(d.trang_thai)));
  {
    const b = (ngay: string, diem_danh: string | null, trang_thai = "binh_thuong") => ({ bat_dau: lucVN(ngay, "22:15").toISOString(), so_phut: 90, trang_thai, diem_danh });
    const ds = [b("2026-11-10", "co"), b("2026-11-12", "vang"), b("2026-11-14", "co"), b("2026-11-17", "phep"), b("2026-11-19", null), b("2026-11-21", null, "huy"), b("2026-11-24", "co"), b("2026-11-26", "vang")];
    check("chuỗi đi học: Có +1; Phép, chưa điểm, lớp nghỉ không đứt; Vắng đứt; buổi chưa kết thúc không tính", chuoiDiHoc(ds, lucVN("2026-11-26", "23:00")) === 2 && chuoiDiHoc(ds, lucVN("2026-11-27", "01:00")) === 0 && chuoiDiHoc([], T22) === 0);
  }

  section("Chỉ dữ liệu của chính em (thêm ở KiN)");
  {
    const chu = await nguoi(CHU), em21 = await nguoiHs("HS0021");
    const d = tatCa.find((x) => x.ma === "HS0021")!.d;
    const lo = await db.bcaHocSinh.findUniqueOrThrow({ where: { ma_hs: "HS0021" }, select: { sdt_ph: true, sdt_hs: true, ho_ten_ph: true, gmail: true } });
    const json = JSON.stringify(d);
    check("JSON trả cho em không có SĐT (em / phụ huynh), tên phụ huynh, Gmail, ghi chú, tiền", ![lo.sdt_ph, lo.sdt_hs, lo.ho_ten_ph, lo.gmail].some((v) => v && json.includes(v)) && !/sdt|ghi_chu|so_du|don_gia|ho_ten_ph/.test(json), Object.keys(d.hoc_sinh));
    check("chủ lớp / giáo viên gọi cuaToi, buoiCuaToi ⇒ LoiQuyen", (await loi(() => cuaToi(chu, T22))) instanceof LoiQuyen && (await loi(() => buoiCuaToi(chu, 1, T22))) instanceof LoiQuyen);
    const anh = await buoiId(4, "2026-11-26"), toan = await buoiId(1, "2026-11-24");
    check("HS0021 (Toán + Sử) mở buổi Anh ⇒ LoiQuyen 'không thuộc lớp của em'; buổi không tồn tại cũng vậy", (await loi(() => buoiCuaToi(em21, anh, T22))) instanceof LoiQuyen && (await loi(() => buoiCuaToi(em21, 99999999, T22))) instanceof LoiQuyen);
    const b = await buoiCuaToi(em21, toan, T22);
    check("…mở buổi Toán của mình ⇒ được, không có ghi chú điểm danh", b.id === toan && b.mon === "Toán" && !("ghi_chu" in b), b);
    check("…sau hạn thử (29/11) mở lại buổi đó ⇒ 403 het_han", (await loi(() => buoiCuaToi(em21, toan, lucVN("2026-11-29", "08:00"))))?.ma === "het_han");
    const hetHan = await cuaToi(em21, lucVN("2026-11-29", "08:00"));
    check("…và cuaToi lúc đó: het_thu từ 28/11, không còn link Meet", hetHan.trang_thai === "het_thu" && hetHan.mon.every((m) => m.link_meet === null) && hetHan.buoi.every((x) => x.khoa), [hetHan.trang_thai, hetHan.het_thu]);
  }

  section("Nối hồ sơ lớp với tài khoản KiN (noiHoSoLop)");
  {
    await db.bcaHocSinh.update({ where: { ma_hs: "HS0021" }, data: { gmail: "noi.b7@gmail.com" } });
    await db.bcaHocSinh.update({ where: { ma_hs: "HS0001" }, data: { gmail: "nhieu.b7@gmail.com" } });
    await db.bcaHocSinh.update({ where: { ma_hs: "HS0002" }, data: { gmail: "nhieub7@gmail.com" } });
    const mot = await tk("NoiB7+lop@googlemail.com"), motKhac = await tk("no.ib7@gmail.com"), nhieu = await tk("nhieub7@gmail.com");
    const cxm = await tk("hs24@example.com", { emailVerified: false }), an = await tk("hs70@example.com"), la = await tk("khong-co-ho-so-b7@kin.local");
    const gv = await tk("hs34@example.com", { role: "admin", adminRole: "teacher" }), cam = await tk("hs3@example.com", { banned: true });
    const anhUsers = async () => JSON.stringify(await db.user.findMany({ orderBy: { id: "asc" }, select: { id: true, email: true, name: true, role: true, adminRole: true, emailVerified: true, banned: true, password: true } }));
    const usersTruoc = await anhUsers();

    check("cờ LOP_ON tắt ⇒ 'khong', không nối", (await noiHoSoLop(mot, false)) === "khong" && (await userIdCua("HS0021")) === null);
    check("chưa nối ⇒ nguoiTuPhien KHÔNG tự khớp theo Gmail nữa (null)", (await nguoiTuPhien(mot, undefined, true)) === null);
    check("không có phiên / email không khớp hồ sơ nào ⇒ 'khong'", (await noiHoSoLop(null, true)) === "khong" && (await noiHoSoLop(la, true)) === "khong");
    check("email chưa xác minh (trùng Gmail HS0024) ⇒ 'khong', hồ sơ không bị nối", (await noiHoSoLop(cxm, true)) === "khong" && (await userIdCua("HS0024")) === null);
    check("tài khoản KiN bị khoá (trùng Gmail HS0003) ⇒ 'khong'", (await noiHoSoLop(cam, true)) === "khong" && (await userIdCua("HS0003")) === null);
    check("hồ sơ đang ẩn (HS0070) ⇒ 'khong', không nối vào hồ sơ ẩn", (await noiHoSoLop(an, true)) === "khong" && (await userIdCua("HS0070")) === null);
    check("gia sư có email trùng Gmail hồ sơ (HS0034) ⇒ 'khong' (chỉ vai học sinh được nối)", (await noiHoSoLop(gv, true)) === "khong" && (await userIdCua("HS0034")) === null);
    check("Gmail gốc khớp HAI hồ sơ (nhieu.b7 / nhieub7) ⇒ 'nhieu', không nối hồ sơ nào", (await noiHoSoLop(nhieu, true)) === "nhieu" && (await userIdCua("HS0001")) === null && (await userIdCua("HS0002")) === null && (await nguoiTuPhien(nhieu, undefined, true)) === null);

    const r1 = await noiHoSoLop(mot, true), nk = await nkNoi("HS0021");
    check("khớp ĐÚNG MỘT hồ sơ theo Gmail gốc (hoa/thường, dấu chấm, +nhãn, googlemail) ⇒ 'moi_noi', ghi userId", r1 === "moi_noi" && (await userIdCua("HS0021")) === mot.userId, r1);
    check("…có MỘT dòng nhật ký noi_tai_khoan_kin đứng tên em, trước null / sau userId", nk.length === 1 && nk[0].vai_tro === `hoc_sinh:${await hsId("HS0021")}` && nk[0].nguoi_dung_id === null && eq(nk[0].truoc, { userId: null }) && eq(nk[0].sau, { userId: mot.userId }), nk);
    const u = await nguoiTuPhien(mot, undefined, true);
    check("…sau nối: nguoiTuPhien trả đúng hồ sơ đó", eq(u, { vai: "hoc_sinh", hocSinhId: await hsId("HS0021"), ten: "Nguyễn Minh Linh" }), u);
    check("mở lần hai ⇒ 'da_noi', không thêm nhật ký", (await noiHoSoLop(mot, true)) === "da_noi" && (await nkNoi("HS0021")).length === 1);
    check("tài khoản KHÁC cùng Gmail gốc (no.ib7@gmail.com) ⇒ 'khong': hồ sơ đã có chủ, không bị cướp", (await noiHoSoLop(motKhac, true)) === "khong" && (await userIdCua("HS0021")) === mot.userId);
    check("suốt phần nối: KHÔNG dòng nào của bảng users bị đổi", (await anhUsers()) === usersTruoc);

    section("Chủ đổi Gmail hồ sơ ⇒ gỡ tài khoản đã nối (suaHoSoHocSinh)");
    const chu = await nguoi(CHU);
    await suaHoSoHocSinh(chu, "HS0021", { truong: "THPT Thử B7" });
    check("sửa ô KHÁC (trường) ⇒ giữ nguyên userId", (await userIdCua("HS0021")) === mot.userId);
    await suaHoSoHocSinh(chu, "HS0021", { gmail: "noi.b7@gmail.com" });
    check("lưu lại ĐÚNG Gmail cũ ⇒ giữ nguyên userId", (await userIdCua("HS0021")) === mot.userId);
    await suaHoSoHocSinh(chu, "HS0021", { gmail: "Khac.B7@example.com" });
    const nkSua = await db.bcaNhatKy.findFirst({ where: { hanh_dong: "sua_ho_so_hoc_sinh", doi_tuong_id: "HS0021" }, orderBy: { id: "desc" } });
    check("đổi Gmail ⇒ userId về null; nhật ký ghi userId trước / sau", (await userIdCua("HS0021")) === null && (nkSua?.truoc as { userId?: string })?.userId === mot.userId && (nkSua?.sau as { userId?: unknown; gmail?: string })?.userId === null && (nkSua?.sau as { gmail?: string })?.gmail === "khac.b7@example.com", [nkSua?.truoc, nkSua?.sau]);
    check("…người giữ Gmail cũ hết quyền ngay và không tự nối lại (Gmail không còn khớp)", (await nguoiTuPhien(mot, undefined, true)) === null && (await noiHoSoLop(mot, true)) === "khong");
    await suaHoSoHocSinh(chu, "HS0001", { gmail: "mot-minh.b7@example.com" });
    check("chủ sửa một trong hai hồ sơ trùng ⇒ tài khoản 'nhieu' lúc nãy nối được vào hồ sơ còn lại (HS0002)", (await noiHoSoLop(nhieu, true)) === "moi_noi" && (await userIdCua("HS0002")) === nhieu.userId && (await userIdCua("HS0001")) === null);
    check("bảng users vẫn nguyên sau phần sửa hồ sơ", (await anhUsers()) === usersTruoc);
  }
}

main().catch((e) => { console.error(e); check("bài chạy hết không ném lỗi", false, String(e)); })
  .finally(() => { try { napLaiBca(); console.log("\n(đã nạp lại bca_* từ bca_gia)"); } catch (e) { console.error("KHÔNG nạp lại được bca_*:", e); } return done(); });
