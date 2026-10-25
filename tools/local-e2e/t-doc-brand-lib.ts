// KiN Pro F3 — quy tắc THUẦN của giấy tờ có thương hiệu (src/lib/docBrand.ts). Không DB, không máy chủ.
import { ACCENTS, ACCENT_KEYS, NAME_MAX, SIGNATURE_MAX, PRINT_FOOTER, brandedGate, isAccentKey, printLook, readBrandSnapshot, sanitizeBrand, BRANDED_GATE_STATUS } from "@/lib/docBrand";
import { check, section, done } from "./h";

const ok = (r: ReturnType<typeof sanitizeBrand>) => r.ok;
const base = { displayName: "Lớp Toán cô Lan", accent: "xanh-kin", signature: "Chúc em tiến bộ" };

section("Màu nhấn: chỉ khoá trong danh sách, và mọi màu là token --kin-*");
check("4 màu, đều trỏ var(--kin-…)", ACCENT_KEYS.length === 4 && ACCENT_KEYS.every(k => /^var\(--kin-[a-z0-9-]+\)$/.test(ACCENTS[k].css)));
check("không có màu đỏ lỗi trong danh sách (đỏ để dành cho lỗi và tiền)", ACCENT_KEYS.every(k => !/chu-loi|cham-loi/.test(ACCENTS[k].css)));
check("khoá lạ / mã hex / tên màu / prototype → không phải khoá", !isAccentKey("#ff0000") && !isAccentKey("red") && !isAccentKey("__proto__") && !isAccentKey("toString") && !isAccentKey(null) && !isAccentKey(5) && isAccentKey("luc"));

section("sanitizeBrand");
check("hợp lệ → làm sạch khoảng trắng", (() => { const r = sanitizeBrand({ ...base, displayName: "  Lớp   Toán  cô Lan " }); return r.ok && r.brand.displayName === "Lớp Toán cô Lan"; })());
check("chữ ký trống / vắng → chuỗi rỗng, vẫn hợp lệ", (() => { const a = sanitizeBrand({ displayName: "A", accent: "muc" }), b = sanitizeBrand({ displayName: "A", accent: "muc", signature: null }); return a.ok && a.brand.signature === "" && b.ok && b.brand.signature === ""; })());
check("tên trống / toàn khoảng trắng / không phải chuỗi → từ chối", !ok(sanitizeBrand({ ...base, displayName: "" })) && !ok(sanitizeBrand({ ...base, displayName: "   " })) && !ok(sanitizeBrand({ ...base, displayName: 5 })) && !ok(sanitizeBrand({ accent: "luc" })));
check(`tên ${NAME_MAX} ký tự được, ${NAME_MAX + 1} thì không`, ok(sanitizeBrand({ ...base, displayName: "a".repeat(NAME_MAX) })) && !ok(sanitizeBrand({ ...base, displayName: "a".repeat(NAME_MAX + 1) })));
check(`chữ ký ${SIGNATURE_MAX} được, ${SIGNATURE_MAX + 1} thì không; không phải chuỗi → từ chối`, ok(sanitizeBrand({ ...base, signature: "b".repeat(SIGNATURE_MAX) })) && !ok(sanitizeBrand({ ...base, signature: "b".repeat(SIGNATURE_MAX + 1) })) && !ok(sanitizeBrand({ ...base, signature: ["x"] })));
check("màu mã hex / tên màu / thiếu → từ chối (không nhận màu tự do)", !ok(sanitizeBrand({ ...base, accent: "#ff0000" })) && !ok(sanitizeBrand({ ...base, accent: "red" })) && !ok(sanitizeBrand({ ...base, accent: undefined })) && !ok(sanitizeBrand({ ...base, accent: "constructor" })));
check("đầu vào không phải đối tượng → từ chối", !ok(sanitizeBrand(null)) && !ok(sanitizeBrand("x")) && !ok(sanitizeBrand([base])) && !ok(sanitizeBrand(undefined)));
check("ký tự điều khiển và < > bị loại (không chèn thẻ)", (() => { const r = sanitizeBrand({ ...base, displayName: "Lớp\u0000 <b>Toán</b>\n" }); return r.ok && !/[<>\u0000\n]/.test(r.brand.displayName); })());
for (const bad of ["Trung tâm đã xác minh", "Dạy ĐÚNG LUẬT", "Miễn thuế", "Đã gửi", "Chính thức của Bộ", "Được cấp phép", "Chứng nhận KiN", "Midnight Elite", "xac minh", "dung luat"]) {
  check(`chặn lời không bảo chứng được (tên): “${bad}”`, !ok(sanitizeBrand({ ...base, displayName: bad })));
}
check("chặn cả trong chữ ký", !ok(sanitizeBrand({ ...base, signature: "Đã xác minh bởi KiN" })));
check("chữ bình thường không bị chặn nhầm (“Lớp Toán cô Lan”, “Gia sư Hoá”)", ok(sanitizeBrand(base)) && ok(sanitizeBrand({ ...base, displayName: "Gia sư Hoá thầy Minh" })));

section("readBrandSnapshot: dữ liệu DB hỏng không làm sập, chỉ về mẫu KiN");
check("ảnh chụp hợp lệ đọc lại đúng", readBrandSnapshot(base)?.displayName === "Lớp Toán cô Lan");
check("null / chuỗi / thiếu khoá / màu lạ → null", readBrandSnapshot(null) === null && readBrandSnapshot("x") === null && readBrandSnapshot({ displayName: "A" }) === null && readBrandSnapshot({ ...base, accent: "#fff" }) === null);

section("printLook: mẫu KiN mặc định và có thương hiệu");
const kin = printLook(null), br = printLook(readBrandSnapshot(base));
check("không có ảnh chụp → mẫu KiN, tiêu đề 'KiN', không chữ ký", kin.mode === "kin" && kin.headline === "KiN" && kin.signature === "");
check("có ảnh chụp → tên và màu của gia sư", br.mode === "brand" && br.headline === "Lớp Toán cô Lan" && br.accentCss === ACCENTS["xanh-kin"].css && br.signature === "Chúc em tiến bộ");
check("chân trang 'Ghi trên KiN' là hằng số, không phụ thuộc thương hiệu", /^Ghi trên KiN\./.test(PRINT_FOOTER) && !/đã xác minh|đúng luật|miễn thuế|đã gửi/i.test(PRINT_FOOTER));
check("printLook không có đường nào nhận/ghi đè chân trang (kiểu trả về không có trường footer)", !("footer" in br) && !("footer" in kin));

section("brandedGate: thứ tự kiểm và hết hạn chỉ chặn tạo mới");
const g = (o: Partial<Parameters<typeof brandedGate>[0]>) => brandedGate({ approved: true, hasSnapshot: false, allowed: true, hasBrand: true, ...o }).kind;
check("chưa duyệt → not_approved (kể cả Pro)", g({ approved: false }) === "not_approved" && g({ approved: false, allowed: false }) === "not_approved");
check("Pro đã cài thương hiệu → create", g({}) === "create");
check("Free (không được) tạo mới → pro_required", g({ allowed: false }) === "pro_required");
check("HẾT HẠN Pro nhưng bản đã tạo → existing (xem lại được, không hỏi gói)", g({ allowed: false, hasSnapshot: true }) === "existing");
check("Pro chưa cài tên → no_brand; Free chưa cài → vẫn pro_required trước", g({ hasBrand: false }) === "no_brand" && g({ allowed: false, hasBrand: false }) === "pro_required");
check("mã trạng thái: 409 / 200 / 403 / 400 / 200", BRANDED_GATE_STATUS.not_approved === 409 && BRANDED_GATE_STATUS.existing === 200 && BRANDED_GATE_STATUS.pro_required === 403 && BRANDED_GATE_STATUS.no_brand === 400 && BRANDED_GATE_STATUS.create === 200);

done();
