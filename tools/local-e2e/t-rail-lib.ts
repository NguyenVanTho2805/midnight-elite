// Thanh bên trái thu/mở (14/10/2026) — phần THUẦN: src/lib/railState.ts (trạng thái, phím tắt, script chạy trước khi vẽ),
// src/lib/signedInShell.ts (người nào, ở trang nào thì có thanh bên), và tuỳ chọn `rail` trong src/lib/userPreferences.ts.
import { RAIL_KEY, RAIL_ATTR, RAIL_OPEN_KEY, RAIL_INIT_SCRIPT, DEFAULT_RAIL, parseRail, toggleRail, widenRail, reopenRail, isRailShortcut } from "@/lib/railState";
import { shellFor, NO_SHELL_PATHS, shellHintFor, parseShellHint, SHELL_HINT_KEY, SHELL_HINT_ATTR, SHELL_INIT_SCRIPT } from "@/lib/signedInShell";
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
// 25/10/2026 (Figma "Nền móng"): mặc định là thanh RỘNG; script luôn đặt đúng MỘT thuộc tính (đã lưu thì giá trị đó, chưa lưu / lạ thì "rong").
check("đã lưu 'mo' → đặt data-kin-rail=mo (người dùng đã chọn thanh hẹp thì giữ)", JSON.stringify(run("mo")) === JSON.stringify([[RAIL_ATTR, "mo"]]), run("mo"));
check("chưa lưu gì → đặt data-kin-rail=rong (mặc định: thanh rộng có nhóm)", JSON.stringify(run(null)) === JSON.stringify([[RAIL_ATTR, "rong"]]), run(null));
check("giá trị lạ → quay về mặc định 'rong', không đoán", JSON.stringify(run("lung tung")) === JSON.stringify([[RAIL_ATTR, "rong"]]), run("lung tung"));
let threw = false; try { run("THROW"); } catch { threw = true; }
check("trình duyệt chặn localStorage (chế độ riêng tư) → script không ném lỗi, không làm hỏng trang, vẫn đặt mặc định 'rong'", !threw && JSON.stringify(run("THROW")) === JSON.stringify([[RAIL_ATTR, "rong"]]));
check("mặc định khai báo trong mã là 'rong'; script đặt trong hàm bọc sẵn (không rò biến ra phạm vi toàn cục)", DEFAULT_RAIL === "rong" && RAIL_INIT_SCRIPT.startsWith("(function(){") && RAIL_INIT_SCRIPT.endsWith("})()"));
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
const adminSuper = { role: "admin", adminRole: "admin_super" }, adminContent = { role: "admin", adminRole: "admin_content" };
check("quản trị cấp 1 / cấp nội dung → vỏ HỌC VIÊN ở mọi trang khách (xem thử khu học sinh; 15/10/2026: trước đây rơi ra khung khách)", ["/thu-vien", "/thi-thu", "/cong-dong", "/bang-xep-hang", "/tin-tuc", "/khoa-hoc", "/giang-vien", "/diem-chuan"].every(p => shellFor(adminSuper, p) === "student" && shellFor(adminContent, p) === "student"));
check("quản trị không có adminRole (tài khoản cũ) → cũng vỏ học viên, không rơi ra khung khách", shellFor({ role: "admin", adminRole: null }, "/thu-vien") === "student" && shellFor({ role: "admin" }, "/thu-vien") === "student");
check("mọi người đã đăng nhập (học viên, gia sư, quản trị) đều có vỏ ở trang khách — không ai thấy thanh trên + chân trang của khách", [student, tutor, adminSuper, adminContent].every(u => shellFor(u, "/thu-vien") !== null));
check("vai chưa rõ (null) → không có", shellFor({ role: null, adminRole: null }, "/thu-vien") === null);
for (const p of NO_SHELL_PATHS) check(`${p} (đăng nhập / đăng ký / khôi phục) → không có thanh bên dù đã đăng nhập`, shellFor(student, p) === null && shellFor(tutor, p) === null && shellFor(student, p + "/x") === null);
check("trang chỉ giống TIỀN TỐ ('/dang-nhap-gi-do') thì vẫn có thanh bên — so khớp theo đoạn đường dẫn, không theo chuỗi", shellFor(student, "/dang-nhap-gi-do") === "student" && shellFor(student, "/dang-ky-lop") === "student");
check("danh sách loại trừ đủ 6 trang xác thực", NO_SHELL_PATHS.length === 6 && ["/dang-nhap", "/dang-ky", "/quen-mat-khau", "/dat-lai-mat-khau", "/xac-thuc-email", "/xac-nhan-phu-huynh"].every(p => (NO_SHELL_PATHS as readonly string[]).includes(p)), NO_SHELL_PATHS);

section("Ba trạng thái: 'rong' (272px, có nhóm — MẶC ĐỊNH từ 25/10/2026) · 'mo' (79px) · 'thu' (0)");
check("parseRail nhận 'rong' (ba giá trị hợp lệ: mo / rong / thu)", parseRail("rong") === "rong" && parseRail("mo") === "mo" && parseRail("thu") === "thu");
check("giá trị gần giống vẫn bị từ chối ('RONG', 'wide', 'rộng')", ["RONG", "Rong", "wide", "rộng", " rong"].every(v => parseRail(v) === null));
check("phím '[': đang mở (79px hoặc 220px) → thu; đang thu → mở", toggleRail("mo") === "thu" && toggleRail("rong") === "thu" && toggleRail("thu") === "mo");
check("nút mở rộng: hẹp ⇄ rộng; đang thu thì KHÔNG đổi (không tự mở thanh bằng nút này)", widenRail("mo") === "rong" && widenRail("rong") === "mo" && widenRail("thu") === "thu");
check("mở lại sau khi thu về đúng bề rộng đã dùng ('mo' → 'mo', 'rong' → 'rong'); chưa có / giá trị lạ → mặc định (rộng)", reopenRail("rong") === "rong" && reopenRail("mo") === "mo" && [null, undefined, "", "thu", "x", 1].every(v => reopenRail(v) === "rong"));
check("khoá nhớ bề rộng mở khác khoá trạng thái hiện tại", (RAIL_OPEN_KEY as string) !== RAIL_KEY);
{
  const run = (stored: string | null) => {
    const attrs = new Map<string, string>();
    new Function("localStorage", "document", RAIL_INIT_SCRIPT)({ getItem: (k: string) => (k === RAIL_KEY ? stored : null) }, { documentElement: { setAttribute: (k: string, v: string) => void attrs.set(k, v) } });
    return attrs.get(RAIL_ATTR) ?? null;
  };
  check("script trước khi vẽ: đã lưu 'rong' → data-kin-rail=rong ngay từ khung hình đầu (không nháy 79px rồi nở ra)", run("rong") === "rong");
  check("…đã lưu 'thu' / 'mo' → đúng giá trị đó; rỗng / lạ / chưa lưu → 'rong' (mặc định thanh rộng)", run("thu") === "thu" && run("mo") === "mo" && run(null) === "rong" && run("") === "rong" && run("RONG") === "rong");
}

section("Gợi ý vỏ — không nháy khung khách khi tải cứng (src/lib/signedInShell.ts)");
check("gợi ý của học viên = 'student', gia sư = 'tutor', quản trị = 'student', khách = null", shellHintFor(student) === "student" && shellHintFor(tutor) === "tutor" && shellHintFor(adminSuper) === "student" && shellHintFor(null) === null);
check("parseShellHint chỉ nhận 'student' / 'tutor' — giá trị lạ, rỗng, sai kiểu → null", parseShellHint("student") === "student" && parseShellHint("tutor") === "tutor" && [undefined, null, "", "Student", "admin", 1, true, {}].every(v => parseShellHint(v) === null));
check("khoá và thuộc tính không trùng với của thanh bên thu/mở", (SHELL_HINT_KEY as string) !== RAIL_KEY && (SHELL_HINT_ATTR as string) !== RAIL_ATTR && SHELL_HINT_ATTR === "data-kin-vo");
check("script chạy trước khi vẽ: một dòng, không chứa '</script', bọc try (không ném lỗi khi localStorage bị chặn)", !SHELL_INIT_SCRIPT.includes("\n") && !/<\/script/i.test(SHELL_INIT_SCRIPT) && SHELL_INIT_SCRIPT.startsWith("try{") && SHELL_INIT_SCRIPT.endsWith("catch(e){}"));
{
  type Doc = { documentElement: { getAttribute: (k: string) => string | null; setAttribute: (k: string, v: string) => void } };
  const run = (stored: string | null) => {
    const attrs = new Map<string, string>();
    const documentRef: Doc = { documentElement: { getAttribute: k => attrs.get(k) ?? null, setAttribute: (k, v) => void attrs.set(k, v) } };
    const localStorageRef = { getItem: (k: string) => (k === SHELL_HINT_KEY ? stored : null) };
    new Function("localStorage", "document", SHELL_INIT_SCRIPT)(localStorageRef, documentRef);
    return documentRef.documentElement.getAttribute(SHELL_HINT_ATTR);
  };
  check("script: đã nhớ 'student' → đặt data-kin-vo=student lên <html>", run("student") === "student");
  check("script: đã nhớ 'tutor' → đặt data-kin-vo=tutor", run("tutor") === "tutor");
  check("script: chưa nhớ gì → không đặt gì (khách vẫn thấy khung khách)", run(null) === null);
  check("script: giá trị hỏng ('admin', rỗng) → không đặt gì", run("admin") === null && run("") === null);
  check("script: localStorage ném lỗi (trình duyệt chặn) → im lặng, không đặt gì", (() => {
    const attrs = new Map<string, string>();
    new Function("localStorage", "document", SHELL_INIT_SCRIPT)({ getItem: () => { throw new Error("blocked"); } }, { documentElement: { setAttribute: (k: string, v: string) => void attrs.set(k, v) } });
    return attrs.size === 0;
  })());
}

section("Tuỳ chọn `rail` lưu theo tài khoản (User.preferences)");
check("đọc: 'thu' và 'mo' giữ nguyên", readPreferences({ rail: "thu" }).rail === "thu" && readPreferences({ rail: "mo" }).rail === "mo");
check("đọc khoan dung: giá trị hỏng bị bỏ, không ném lỗi, các khoá khác còn nguyên", (() => { const p = readPreferences({ rail: "xxx", theme: "man" }); return p.rail === undefined && p.theme === "man"; })());
check("vá: đặt 'thu'", (() => { const r = applyPreferencesPatch({}, { rail: "thu" }); return r.ok && r.value.rail === "thu"; })());
check("tài khoản nhớ được 'rong': đọc và vá đều nhận (máy khác cũng mở rộng)", readPreferences({ rail: "rong" }).rail === "rong" && (() => { const r = applyPreferencesPatch({}, { rail: "rong" }); return r.ok && r.value.rail === "rong"; })());
check("vá: null đưa về mặc định (xoá khoá)", (() => { const r = applyPreferencesPatch({ rail: "thu" }, { rail: null }); return r.ok && !("rail" in r.value); })());
for (const bad of ["xxx", "THU", 1, true, [], {}]) check(`vá nghiêm: rail=${JSON.stringify(bad)} → từ chối cả bản vá`, !applyPreferencesPatch({}, { rail: bad }).ok);
check("vá rail không làm mất khoá khác", (() => { const r = applyPreferencesPatch({ theme: "man", modules: ["lop"] }, { rail: "thu" }); return r.ok && r.value.theme === "man" && r.value.modules?.[0] === "lop" && r.value.rail === "thu"; })());

done();
