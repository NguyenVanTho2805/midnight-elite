// Lối về Trang chủ trong khu học sinh (BU-HS-TRANG-CHU mục 1.3 + 8): "/" khớp CHÍNH XÁC, mục Trang chủ không sáng ở /student/*,
// và các lối đã rút khỏi menu ở BU-00 không quay lại. THUẦN: src/lib/navActive.ts + src/lib/homeLayout.ts, đọc nguồn StudentShell.tsx / MorePanel.tsx.
//
// Ca phá (đổi gì trong mã thì ca nào phải đỏ):
//  - navActive.under: đổi thành `pathname.startsWith(base)` → mọi ca "/" không sáng ở trang khác đỏ (mục Trang chủ sáng ở mọi trang).
//  - homeLayout.isHomeActive: đổi thành `pathname.startsWith("/")` → ca "/student/viec-cua-toi không làm Trang chủ sáng" đỏ.
//  - StudentShell.tsx: thêm lại `{ label: "Thư viện", href: "/thu-vien" }` vào MORE_GROUPS hoặc modules → hai ca quét nguồn đỏ.
//  - homeLayout.BU00_REMOVED_MENU_HREFS: thêm "/" vào danh sách → ca "mục Trang chủ không nằm trong danh sách bị rút" đỏ.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { matchLen, activeIndex } from "@/lib/navActive";
import { HOME_HREF, isHomeActive, BU00_REMOVED_MENU_HREFS } from "@/lib/homeLayout";
import { check, section, done } from "./h";

const ROOT = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

section("activeIndex / matchLen — '/' khớp chính xác");
const shell = [{ href: "/" }, { href: "/student/viec-cua-toi" }, { href: "/student/hoc-tap" }];
check("/student/hoc-tap → mục số 2 (không phải 0)", activeIndex("/student/hoc-tap", shell) === 2);
check("/student/viec-cua-toi → mục số 1 (không làm Trang chủ sáng)", activeIndex("/student/viec-cua-toi", shell) === 1);
check("/student/bai-giang/abc không có mục nào trong ba mục này → -1, KHÔNG phải 0", activeIndex("/student/bai-giang/abc", shell) === -1);
check("/cong-dong không bao giờ trả chỉ số của '/'", activeIndex("/cong-dong", [{ href: "/" }, { href: "/student/viec-cua-toi" }]) === -1);
// "//" không phải đường dẫn thật (Next gộp "//" thành "/"), nên không đưa vào: `under("//", "/")` đúng do startsWith("//"), vô hại.
for (const p of ["/cong-dong", "/khoa-hoc", "/tin-tuc", "/giang-vien", "/lop-cua-toi", "/student", "/student/lich-hoc", "/cai-dat/chu-de", "/x/", "/?x=1"]) {
  check(`matchLen(${p}, '/') = 0`, matchLen(p, { href: "/" }) === 0, matchLen(p, { href: "/" }));
}
check("matchLen('/student/x', '/') = 0", matchLen("/student/x", { href: "/" }) === 0);
check("matchLen('/', '/') = 1", matchLen("/", { href: "/" }) === 1);
check("activeIndex('/', [/, /student/viec-cua-toi]) = 0", activeIndex("/", [{ href: "/" }, { href: "/student/viec-cua-toi" }]) === 0);
check("'/' cũng khớp qua `also` chỉ khi pathname đúng '/'", activeIndex("/student/x", [{ href: "/student/a", also: ["/"] }]) === -1 && activeIndex("/", [{ href: "/student/a", also: ["/"] }]) === 0);
check("đúng một chỉ số sáng cho từng trang thật của khu học sinh (không dồn về Trang chủ)", ["/student/viec-cua-toi", "/student/lich-hoc", "/student/hoc-tap", "/student/bai-giang/x"].every(p => activeIndex(p, [{ href: "/" }, { href: "/student/viec-cua-toi" }, { href: "/student/lich-hoc" }, { href: "/student/hoc-tap", also: ["/student/bai-giang"] }]) !== 0));

section("isHomeActive / HOME_HREF");
check("HOME_HREF là '/'", HOME_HREF === "/");
check("isHomeActive('/') = true", isHomeActive("/") === true);
for (const p of ["/student/viec-cua-toi", "/student/hoc-tap", "/cong-dong", "/khoa-hoc", "/tin-tuc", "/lop-cua-toi", "", "//", "/?a=1", "/#x", " /", "/ "]) check(`isHomeActive(${JSON.stringify(p)}) = false`, isHomeActive(p) === false);
check("isHomeActive(null/undefined) = false, không ném lỗi", isHomeActive(null) === false && isHomeActive(undefined) === false);
check("isHomeActive và matchLen cùng kết luận cho '/'", ["/", "/a", "/student/hoc-tap"].every(p => isHomeActive(p) === (matchLen(p, { href: HOME_HREF }) > 0)));

section("BU00_REMOVED_MENU_HREFS — danh sách đã rút khỏi menu học sinh");
check("mục Trang chủ ('/') không nằm trong danh sách bị rút", !BU00_REMOVED_MENU_HREFS.includes(HOME_HREF));
check("không đích nào rỗng, đều bắt đầu '/', không trùng", BU00_REMOVED_MENU_HREFS.every(h => h.startsWith("/") && h.length > 1) && new Set(BU00_REMOVED_MENU_HREFS).size === BU00_REMOVED_MENU_HREFS.length);
check("không dính 'Lớp miễn phí' (/khoa-hoc?gia=free là lối tìm lớp đã thêm 08/11)", !BU00_REMOVED_MENU_HREFS.includes("/khoa-hoc?gia=free"));
for (const h of ["/thu-vien", "/thi-thu", "/bang-xep-hang", "/student/hoi-dap", "/khoa-hoc", "/khoa-hoc-da-luu", "/diem-chuan", "/student/vi"]) check(`có ${h}`, BU00_REMOVED_MENU_HREFS.includes(h));

section("Quét nguồn StudentShell.tsx / MorePanel.tsx — không đích hay nhãn đã rút");
const BANNED_LABELS = ["Thư viện", "Thi thử", "Bảng xếp hạng", "Hỏi đáp", "Khoá học đang mở", "Lớp đang theo dõi", "Tra cứu điểm chuẩn", "Ví và Coin"];
for (const rel of ["src/components/student/StudentShell.tsx", "src/components/kin/shell/MorePanel.tsx"]) {
  const src = read(rel);
  const hrefs = [...src.matchAll(/\bhref:\s*"([^"]+)"/g)].map(m => m[1]);
  const labels = [...src.matchAll(/\blabel:\s*"([^"]+)"/g)].map(m => m[1]);
  const badHref = hrefs.filter(h => BU00_REMOVED_MENU_HREFS.includes(h));
  const badLabel = labels.filter(l => BANNED_LABELS.includes(l));
  check(`${rel}: không href nào thuộc danh sách đã rút`, badHref.length === 0, badHref);
  check(`${rel}: không nhãn (label: "…") nào đã rút`, badLabel.length === 0, badLabel);
}
{
  const src = read("src/components/student/StudentShell.tsx");
  check("StudentShell: có lối về '/' (href: \"/\")", /\bhref:\s*"\/"/.test(src));
  check("StudentShell: không còn logo trỏ thẳng Việc của tôi ở vị trí logo thanh bên (home href)", !/home=\{\{\s*href:\s*"\/student\/viec-cua-toi"/.test(src));
}

void done();
