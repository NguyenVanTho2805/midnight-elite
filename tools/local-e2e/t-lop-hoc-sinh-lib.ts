// KiN lớp bước 4 — phần thuần của hai màn chỉ đọc: lọc / tìm / sắp / phân trang danh sách học sinh (src/lib/lop/loc-hoc-sinh.ts) và lối vào menu "Lớp ôn"
// (src/lib/adminNav.ts). Không DB, không mạng, không dev server. Chạy cả hai chế độ cờ: mặc định (tắt) và NEXT_PUBLIC_KIN_MO_LOP_ON=1.
// Ca phá cố ý (đã chạy 27/11/2026, mỗi cái làm ĐỎ đúng ca tương ứng): bỏ `!!v` (môn chưa ghi danh vẫn khớp lọc môn); so SĐT khi mới 2 chữ số; bỏ chặn trang vượt quá;
// MOI_TRANG 50 → 20; bỏ `LOP_ON ?` trong visibleModules (cờ tắt vẫn hiện menu); bỏ `permission` của mục Lớp ôn (quản trị nội dung thấy menu).
import { docLoc, hrefLoc, locHocSinh, MOI_TRANG, type DongHs } from "@/lib/lop/loc-hoc-sinh";
import { ADMIN_MODULES, matchSub, visibleModules } from "@/lib/adminNav";
import { FEATURES, LOP_ON, type FeatureEnv } from "@/lib/features";
import { check, section, done } from "./h";

const hs = (ma: string, ten: string, o: Partial<DongHs> = {}): DongHs => ({ ma_hs: ma, ho_ten: ten, lua: { ma: "L1" }, sdt_hs: null, sdt_ph: null, gmail: null, mon: { toan: null, su: null, dia: null, anh: null }, tinh_trang: "Đang học", thu: null, dang_ky: "2026-09-01", ...o });
const DS: DongHs[] = [
  hs("HS0001", "Nguyễn Minh An", { mon: { toan: "hoc", su: null, dia: "thu", anh: null }, thu: { den: "2026-12-03", con_ngay: 6 }, sdt_hs: "0910000001", gmail: "an@gmail.com", dang_ky: "2026-09-02" }),
  hs("HS0002", "Trần Ngọc Nam", { mon: { toan: "thu", su: null, dia: null, anh: "thu" }, tinh_trang: "Thử đến 29/11", thu: { den: "2026-11-29", con_ngay: 2 }, lua: { ma: "L2" }, sdt_ph: "0820000002", dang_ky: "2026-11-15" }),
  hs("HS0003", "Hoàng Khánh Linh", { mon: { toan: "nghi", su: "nghi", dia: null, anh: null }, tinh_trang: "Hết thử 14/11 – hỏi em", lua: { ma: "L2" }, dang_ky: "2026-10-31" }),
  hs("HS0004", "Vũ Đức Anh", { mon: { toan: "nghi", su: null, dia: null, anh: null }, tinh_trang: "Đã nghỉ", lua: null, dang_ky: null }),
];
const ma = (p: Record<string, string>) => locHocSinh(DS, docLoc(p)).hien.map((x) => x.ma_hs).join(",");

section("Đọc tham số URL");
check("không tham số ⇒ không lọc, sắp theo tên, trang 1", JSON.stringify(docLoc({})) === JSON.stringify({ q: "", mon: null, loai: null, lua: null, het: null, sap: "ten", trang: 1 }), docLoc({}));
check("giá trị lạ (loai, het, sap, trang) ⇒ coi như không có, không ném lỗi", JSON.stringify(docLoc({ loai: "x", het: "9", sap: "__proto__", trang: "-3" })) === JSON.stringify(docLoc({})), docLoc({ loai: "x", het: "9", sap: "__proto__", trang: "-3" }));
check("tham số lặp (mảng) lấy giá trị đầu; q cắt khoảng trắng và ≤ 100 ký tự", docLoc({ q: ["  an  ", "b"] }).q === "an" && docLoc({ q: "x".repeat(300) }).q.length === 100);

section("Lọc và tìm");
check("không lọc ⇒ đủ 4 em, giữ thứ tự đầu vào", ma({}) === "HS0001,HS0002,HS0003,HS0004");
check("mon=toan ⇒ mọi em từng ghi danh Toán (kể cả đã nghỉ)", ma({ mon: "toan" }) === "HS0001,HS0002,HS0003,HS0004");
check("mon=dia ⇒ chỉ em có ô Địa; ô null (chưa ghi danh) KHÔNG khớp", ma({ mon: "dia" }) === "HS0001", ma({ mon: "dia" }));
check("loai=thu ⇒ em có ít nhất một môn đang thử", ma({ loai: "thu" }) === "HS0001,HS0002");
check("mon + loai phải cùng MỘT môn: toan + thu ⇒ chỉ Nam (An thử Địa, không thử Toán)", ma({ mon: "toan", loai: "thu" }) === "HS0002", ma({ mon: "toan", loai: "thu" }));
check("loai=chinh-thuc / nghi", ma({ loai: "chinh-thuc" }) === "HS0001" && ma({ loai: "nghi" }) === "HS0003,HS0004");
check("lua=L2; em không có lứa không khớp lứa nào", ma({ lua: "L2" }) === "HS0002,HS0003" && ma({ lua: "L1" }) === "HS0001");
check("het=3 ⇒ còn ≤ 3 ngày và chưa có môn chính thức (An còn 6 ngày + đã chính thức ⇒ không)", ma({ het: "3" }) === "HS0002", ma({ het: "3" }));
check("het=da-het ⇒ tình trạng bắt đầu bằng 'Hết thử'", ma({ het: "da-het" }) === "HS0003");
check("tìm tên không dấu, không phân biệt hoa thường", ma({ q: "nguyen minh" }) === "HS0001" && ma({ q: "ĐỨC" }) === "HS0004");
check("tìm theo mã", ma({ q: "hs0003" }) === "HS0003");
check("tìm SĐT học sinh và SĐT phụ huynh từ 3 chữ số; 2 chữ số không tính là SĐT", ma({ q: "0910 000" }) === "HS0001" && ma({ q: "0820000002" }) === "HS0002" && ma({ q: "09" }) === "", [ma({ q: "0910 000" }), ma({ q: "0820000002" }), ma({ q: "09" })]);
check("tìm Gmail", ma({ q: "an@gmail" }) === "HS0001");
check("không ai khớp ⇒ tong 0, tu 0, den 0", (() => { const r = locHocSinh(DS, docLoc({ q: "khongaico" })); return r.tong === 0 && r.tu === 0 && r.den === 0 && r.soTrang === 1; })());

section("Sắp xếp");
check("sap=moi ⇒ đăng ký mới nhất trước, em không có ngày xuống cuối", ma({ sap: "moi" }) === "HS0002,HS0003,HS0001,HS0004", ma({ sap: "moi" }));
check("sap=het ⇒ hạn thử gần nhất trước, em không thử xuống cuối", ma({ sap: "het" }).startsWith("HS0002,HS0001"), ma({ sap: "het" }));

section("Phân trang 50");
const nhieu = Array.from({ length: 120 }, (_, i) => hs(`HS${String(i + 1).padStart(4, "0")}`, `Em ${i + 1}`));
const t1 = locHocSinh(nhieu, docLoc({})), t3 = locHocSinh(nhieu, docLoc({ trang: "3" })), t9 = locHocSinh(nhieu, docLoc({ trang: "9" }));
check("mỗi trang đúng 50 em", MOI_TRANG === 50 && t1.hien.length === 50 && t1.tu === 1 && t1.den === 50 && t1.soTrang === 3 && t1.tong === 120, [t1.tu, t1.den, t1.soTrang]);
check("trang cuối: 101–120", t3.hien.length === 20 && t3.tu === 101 && t3.den === 120 && t3.hien[0].ma_hs === "HS0101");
check("trang vượt quá ⇒ về trang cuối (không trang trắng)", t9.trang === 3 && t9.hien.length === 20);

section("Địa chỉ giữ bộ lọc");
const p = docLoc({ q: "an", mon: "toan", trang: "2" });
check("đổi trang giữ lọc", hrefLoc("/x", p, { trang: 3 }) === "/x?q=an&mon=toan&trang=3", hrefLoc("/x", p, { trang: 3 }));
check("đổi lọc / sắp ⇒ về trang 1; tham số mặc định không lên URL", hrefLoc("/x", p, { sap: "het" }) === "/x?q=an&mon=toan&sap=het" && hrefLoc("/x", docLoc({})) === "/x");
check("tắt một bộ lọc (het: null)", hrefLoc("/x", docLoc({ het: "3", lua: "L2" }), { het: null }) === "/x?lua=L2");
check("ký tự đặc biệt trong q được mã hoá", hrefLoc("/x", docLoc({ q: "a&b=c" })) === "/x?q=a%26b%3Dc");

section(`Menu quản trị — cờ LOP_ON đang ${LOP_ON ? "BẬT" : "TẮT"}`);
const FE: FeatureEnv = Object.fromEntries(FEATURES.map((k) => [k, "1"])) as FeatureEnv;
const hrefs = (r: "admin_super" | "admin_content" | "teacher" | null) => visibleModules(r, FE).flatMap((m) => m.subs.map((s) => s.href));
check("ADMIN_MODULES vẫn đúng 4 module (Lớp ôn nằm ngoài)", ADMIN_MODULES.length === 4 && !ADMIN_MODULES.some((m) => m.key === "lop-on"));
check("matchSub nhận ra ba trang (kể cả khi cờ tắt): Hôm nay / Học sinh / hồ sơ một em → Học sinh",
  matchSub("/admin/lop-on")?.sub.label === "Hôm nay" && matchSub("/admin/lop-on")?.moduleKey === "lop-on" && matchSub("/admin/lop-on/hoc-sinh")?.sub.label === "Học sinh" && matchSub("/admin/lop-on/hoc-sinh/HS0001")?.sub.label === "Học sinh");
check("không khớp nhầm tiền tố: /admin/lop-onx", matchSub("/admin/lop-onx") === null);
check("quản trị nội dung, gia sư, chưa biết vai: KHÔNG bao giờ thấy Lớp ôn", ["admin_content", "teacher", null].every((r) => !hrefs(r as "teacher").some((h) => h.startsWith("/admin/lop-on"))));
if (LOP_ON) check("cờ bật: quản trị cấp 1 thấy module Lớp ôn ở CUỐI, vào bằng Hôm nay", (() => { const m = visibleModules("admin_super", FE).at(-1); return m?.key === "lop-on" && m.href === "/admin/lop-on" && m.subs.length === 6; })());
else check("cờ tắt: quản trị cấp 1 cũng không thấy Lớp ôn", !hrefs("admin_super").some((h) => h.startsWith("/admin/lop-on")), hrefs("admin_super"));

done();
