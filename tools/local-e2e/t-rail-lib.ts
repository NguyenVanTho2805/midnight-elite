// Thanh bên trái thu/mở (14/10/2026) — phần THUẦN: src/lib/railState.ts (trạng thái, phím tắt, script chạy trước khi vẽ),
// src/lib/signedInShell.ts (người nào, ở trang nào thì có thanh bên), và tuỳ chọn `rail` trong src/lib/userPreferences.ts.
import { RAIL_KEY, RAIL_ATTR, RAIL_INIT_SCRIPT, parseRail, toggleRail, isRailShortcut } from "@/lib/railState";
import { shellFor, NO_SHELL_PATHS } from "@/lib/signedInShell";
import { readPreferences, applyPreferencesPatch } from "@/lib/userPreferences";
import { check, section, done } from "./h";

section("parseRail / toggleRail");
check("'mo' và 'thu' hợp lệ", parseRail("mo") === "mo" && parseRail("thu") === "thu");
for (const bad of [undefined, null, "", "THU", "Thu", " thu", "open", 1, true, {}, []] as const) check(`${JSON.stringify(bad)} → null (không đoán)`, parseRail(bad) === null);
check("toggleRail đảo hai chiều", toggleRail("mo") === "thu" && toggleRail("thu") === "mo");

section("Script chạy trước khi vẽ trang (để thanh đã thu không nháy ra rồi mới thụt vào)");
const run = (stored: string | null | "THROW") => {
  const set: [string, string][] = [];
  const ls = { getItem: (k: string) => { if (stored === "THROW") throw new Error("storage bị chặn"); return k === RAIL_KEY ? stored : null; } };
  const doc = { documentElement: { setAttribute: (a: string, v: string) => set.push([a, v]) } };
  new Function("localStorage", "document", RAIL_INIT_SCRIPT)(ls, doc);
  return set;
};
check("đã lưu 'thu' → đặt data-kin-rail=thu lên <html>", JSON.stringify(run("thu")) === JSON.stringify([[RAIL_ATTR, "thu"]]), run("thu"));
check("đã lưu 'mo' / chưa lưu gì → không đặt gì (mặc định luôn hiện)", run("mo").length === 0 && run(null).length === 0);
check("giá trị lạ → không đặt gì", run("lung tung").length === 0);
let threw = false; try { run("THROW"); } catch { threw = true; }
check("trình duyệt chặn localStorage (chế độ riêng tư) → script không ném lỗi, không làm hỏng trang", !threw);
check("script nằm trên một dòng, không chứa '</script' (không phá được HTML khi chèn thẳng vào trang)", !/[\r\n]/.test(RAIL_INIT_SCRIPT) && !/<\/script/i.test(RAIL_INIT_SCRIPT));
check("khoá lưu và tên thuộc tính đúng như đã ghi trong tài liệu", RAIL_KEY === "kin.thanh-ben" && RAIL_ATTR === "data-kin-rail");

section("Phím tắt '[' — chỉ khi không đang gõ chữ");
const key = (o: Partial<Parameters<typeof isRailShortcut>[0]> = {}) => isRailShortcut({ key: "[", ctrlKey: false, metaKey: false, altKey: false, target: { tagName: "BODY" }, ...o });
check("'[' trên trang → bật/tắt", key() === true);
check("'[' khi tiêu điểm ở một nút hoặc không ở đâu cả → vẫn bật/tắt", key({ target: { tagName: "BUTTON" } }) && key({ target: null }));
check("phím khác không phải phím tắt", !key({ key: "]" }) && !key({ key: "a" }) && !key({ key: "Enter" }) && !key({ key: "{" }));
check("có Ctrl / Cmd / Alt → bỏ qua (nhường phím tắt của trình duyệt và hệ điều hành)", !key({ ctrlKey: true }) && !key({ metaKey: true }) && !key({ altKey: true }));
for (const tag of ["INPUT", "TEXTAREA", "SELECT"]) check(`đang gõ trong <${tag.toLowerCase()}> → bỏ qua (không nuốt ký tự '[')`, !key({ target: { tagName: tag } }));
check("vùng soạn thảo contenteditable → bỏ qua", !key({ target: { tagName: "DIV", isContentEditable: true } }));
check("vai trò textbox / combobox / searchbox / spinbutton → bỏ qua", ["textbox", "combobox", "searchbox", "spinbutton"].every(r => !key({ target: { tagName: "DIV", role: r } })));
check("đang gõ tiếng Việt bằng bộ gõ (isComposing) → bỏ qua", !key({ isComposing: true }));
check("giữ phím (repeat) → bỏ qua, thanh không nhấp nháy liên tục", !key({ repeat: true }));

section("shellFor — ai, ở trang nào thì có thanh bên");
const student = { role: "student", adminRole: null }, tutor = { role: "admin", adminRole: "teacher" };
check("học viên ở trang khách (/thu-vien, /khoa-hoc…) → thanh bên học viên", ["/thu-vien", "/khoa-hoc", "/khoa-hoc/toan-9", "/giang-vien", "/diem-chuan", "/tin-tuc", "/cong-dong", "/bang-xep-hang", "/ban-do", "/chinh-sach"].every(p => shellFor(student, p) === "student"));
check("gia sư ở trang khách → thanh bên gia sư", ["/thu-vien", "/khoa-hoc", "/giang-vien", "/tin-tuc"].every(p => shellFor(tutor, p) === "tutor"));
check("khách (chưa đăng nhập) → không có", shellFor(null, "/thu-vien") === null);
check("quản trị cấp 1 / cấp nội dung → không có ở trang khách (họ có vỏ riêng trên tên miền quản trị)", shellFor({ role: "admin", adminRole: "admin_super" }, "/thu-vien") === null && shellFor({ role: "admin", adminRole: "admin_content" }, "/thu-vien") === null);
check("vai chưa rõ (null) → không có", shellFor({ role: null, adminRole: null }, "/thu-vien") === null);
for (const p of NO_SHELL_PATHS) check(`${p} (đăng nhập / đăng ký / khôi phục) → không có thanh bên dù đã đăng nhập`, shellFor(student, p) === null && shellFor(tutor, p) === null && shellFor(student, p + "/x") === null);
check("trang chỉ giống TIỀN TỐ ('/dang-nhap-gi-do') thì vẫn có thanh bên — so khớp theo đoạn đường dẫn, không theo chuỗi", shellFor(student, "/dang-nhap-gi-do") === "student" && shellFor(student, "/dang-ky-lop") === "student");
check("danh sách loại trừ đủ 6 trang xác thực", NO_SHELL_PATHS.length === 6 && ["/dang-nhap", "/dang-ky", "/quen-mat-khau", "/dat-lai-mat-khau", "/xac-thuc-email", "/xac-nhan-phu-huynh"].every(p => (NO_SHELL_PATHS as readonly string[]).includes(p)), NO_SHELL_PATHS);

section("Tuỳ chọn `rail` lưu theo tài khoản (User.preferences)");
check("đọc: 'thu' và 'mo' giữ nguyên", readPreferences({ rail: "thu" }).rail === "thu" && readPreferences({ rail: "mo" }).rail === "mo");
check("đọc khoan dung: giá trị hỏng bị bỏ, không ném lỗi, các khoá khác còn nguyên", (() => { const p = readPreferences({ rail: "xxx", theme: "man" }); return p.rail === undefined && p.theme === "man"; })());
check("vá: đặt 'thu'", (() => { const r = applyPreferencesPatch({}, { rail: "thu" }); return r.ok && r.value.rail === "thu"; })());
check("vá: null đưa về mặc định (xoá khoá)", (() => { const r = applyPreferencesPatch({ rail: "thu" }, { rail: null }); return r.ok && !("rail" in r.value); })());
for (const bad of ["xxx", "THU", 1, true, [], {}]) check(`vá nghiêm: rail=${JSON.stringify(bad)} → từ chối cả bản vá`, !applyPreferencesPatch({}, { rail: bad }).ok);
check("vá rail không làm mất khoá khác", (() => { const r = applyPreferencesPatch({ theme: "man", modules: ["lop"] }, { rail: "thu" }); return r.ok && r.value.theme === "man" && r.value.modules?.[0] === "lop" && r.value.rail === "thu"; })());

done();
