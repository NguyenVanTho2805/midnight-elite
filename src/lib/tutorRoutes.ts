// BU-00 bước 3 (31/10/2026) — bản đồ đường THUẦN giữa trang quản trị dùng chung (/admin/thi-thu*, /admin/khoa-hoc*) và bí danh của gia sư
// dưới /lop-cua-toi (de-thi*, quan-lop*). Không React, không DB, không đọc cookie — để test từng cặp (tools/local-e2e/t-tutor-routes-lib.ts).
//
// Vì sao có tệp này: gia sư KHÔNG còn làm việc trong /admin/* (vỏ quản trị). Hai tệp trang lớn (admin/khoa-hoc/[id] ~2.500 dòng, admin/thi-thu ~2.000 dòng)
// chưa tách (để BU-02/BU-03), nên trang mỏng dưới src/app/lop-cua-toi/(tutor)/(noi-dung)/ re-export đúng trang gốc, chạy trong vỏ gia sư (TutorShell).
// Proxy (src/lib/hostRouting.ts) thấy gia sư mở /admin/... thì 307 sang đường ở đây; link cũ trong thông báo đã lưu DB vẫn tới nhờ 307.
//
import { classBase } from "@/lib/tutorClassRoutes";

// Quy tắc: `danh-muc` (danh mục khoá học) KHÔNG có bí danh — gia sư không có quyền; mọi /admin/... khác cũng → null (proxy đưa về /lop-cua-toi).

/** Mỗi họ: gốc quản trị, gốc gia sư, các đuôi hợp lệ sau gốc (":id" = một segment bất kỳ; "" = chính trang gốc), segment cấm làm :id. */
interface Family { admin: string; tutor: string; tails: readonly string[]; banned: readonly string[] }
const FAMILIES: readonly Family[] = [
  { admin: "/admin/thi-thu", tutor: "/lop-cua-toi/de-thi",
    tails: ["", ":id", "tao-moi", "ngan-hang-cau-hoi", "ngan-hang-cau-hoi/:id", "ngan-hang-cau-hoi/cau-hoi", "ngan-hang-de-thi",
      // BU-03 (02/11/2026) — đuôi mới của luồng đề thi gia sư (chỉ thêm).
      "ma-tran", "ma-tran/:id", "ngan-hang-cau-hoi/nhap-word", ":id/phien-ban", ":id/giao", ":id/ket-qua", ":id/ma-de", ":id/cham"], banned: [] },
  { admin: "/admin/khoa-hoc", tutor: "/lop-cua-toi/quan-lop",
    tails: ["", ":id", "tao-moi", ":id/hoc-vien", ":id/diem-danh", ":id/diem-danh/in"], banned: ["danh-muc"] },
];

function splitQuery(p: string): [path: string, search: string] {
  const i = p.indexOf("?");
  return i < 0 ? [p, ""] : [p.slice(0, i), p.slice(i)];
}

/** Đuôi `tail` có khớp một mẫu của họ không. ":id" không được trùng segment cố định đứng ngay sau gốc (vd "tao-moi") và không nằm trong `banned`. */
function tailMatches(f: Family, tail: string[]): boolean {
  const fixedFirst = f.tails.map(t => t.split("/")[0]).filter(s => s && s !== ":id");
  return f.tails.some(pattern => {
    const pat = pattern === "" ? [] : pattern.split("/");
    return pat.length === tail.length && pat.every((s, i) => s === ":id"
      ? tail[i].length > 0 && !fixedFirst.includes(tail[i]) && !f.banned.includes(tail[i])
      : s === tail[i]);
  });
}

/** A4: danh sách lớp phụ /lop-cua-toi/quan-lop không còn là trang riêng của gia sư — gốc quản trị /admin/khoa-hoc đi thẳng /lop-cua-toi/lop (?tao=1 → trang tạo lớp). Chiều ngược KHÔNG đổi. */
function tutorListHref(search: string): string {
  const q = new URLSearchParams(search.replace(/^\?/, ""));
  if (q.get("tao") === "1") return "/lop-cua-toi/lop/tao";
  q.delete("tao");
  const rest = q.toString();
  return "/lop-cua-toi/lop" + (rest ? "?" + rest : "");
}

function translate(input: string, from: "admin" | "tutor"): string | null {
  const [path, search] = splitQuery(input);
  if (from === "admin" && path === "/admin/khoa-hoc") return tutorListHref(search);
  const to = from === "admin" ? "tutor" : "admin";
  for (const f of FAMILIES) {
    const src = f[from];
    if (path !== src && !path.startsWith(src + "/")) continue;
    const tail = path === src ? [] : path.slice(src.length + 1).split("/");
    if (tail.some(s => s === "") || !tailMatches(f, tail)) return null; // "//", dấu "/" cuối, hay đuôi lạ: không phải trang nào
    return f[to] + (tail.length ? "/" + tail.join("/") : "") + search;
  }
  return null;
}

/** /admin/thi-thu/abc?x=1 → /lop-cua-toi/de-thi/abc?x=1; /admin/khoa-hoc/danh-muc và mọi /admin/... khác → null. Giữ nguyên query string. */
export function toTutorPath(adminPath: string): string | null { return translate(adminPath, "admin"); }

/** Chiều ngược: /lop-cua-toi/quan-lop/abc?tab=lich-hoc → /admin/khoa-hoc/abc?tab=lich-hoc; đường không thuộc hai họ này → null. */
export function toAdminPath(tutorPath: string): string | null {
  // TUT-lich-keo-tha: trang khung giờ kéo-thả của gia sư (/quan-lop/<id>/lich-hoc) không có bản /admin riêng — quản trị dùng tab "Lịch học" của trang quản khoá. Chiều xuôi (toTutorPath) KHÔNG đổi.
  const [path, search] = splitQuery(tutorPath);
  const m = /^\/lop-cua-toi\/quan-lop\/([^/]+)\/lich-hoc$/.exec(path);
  if (m && m[1] !== "tao-moi" && m[1] !== "danh-muc") {
    const q = new URLSearchParams(search.replace(/^\?/, ""));
    q.set("tab", "lich-hoc");
    return `/admin/khoa-hoc/${m[1]}?${q.toString()}`;
  }
  return translate(tutorPath, "tutor");
}

/** Liên kết trong trang DÙNG CHUNG: gia sư đi đường của mình, quản trị giữ /admin/... (không map được thì về Hộp việc của gia sư). */
export function contentHref(isTeacher: boolean, adminPath: string): string {
  return isTeacher ? (toTutorPath(adminPath) ?? "/lop-cua-toi") : adminPath;
}

/** BU-02: màn Giáo trình của một lớp. Gia sư: đường của gia sư. Quản trị không có màn này (đường mới là đường gia sư, không có bản /admin) nên về tab "Chương bài" (?tab=chuong-bai) của trang quản lớp. */
export function giaoTrinhHref(courseId: string, isTeacher: boolean): string {
  const id = encodeURIComponent(courseId);
  return isTeacher ? `${classBase(courseId)}/giao-trinh` : `/admin/khoa-hoc/${id}?tab=chuong-bai`; // classBase: như encodeURIComponent, thêm mã hoá "." / ".." (không thoát đường dẫn)
}

// ─── Dải tab của vỏ nội dung gia sư (src/components/tutor/TutorContentTabs.tsx) ────────────────────────────────────────────────
export interface ContentTab { label: string; href: string; active: boolean }
export interface ContentTabGroup { label: string; tabs: ContentTab[] }

const isUnder = (p: string, root: string) => p === root || p.startsWith(root + "/");

/** Vai của người xem trong lớp (courseAccess.CourseRole rút gọn). Đồng giảng / giáo viên bộ môn chỉ có Giáo trình + Lịch học. */
export type ContentTabRole = "owner" | "admin" | "co_teacher" | "subject_teacher" | null | undefined;
const isHelper = (r: ContentTabRole) => r === "co_teacher" || r === "subject_teacher";

/**
 * Dải tab theo đường đang mở (chỉ đường GIA SƯ). `tab` = giá trị ?tab= của trang lớp.
 *  - /lop-cua-toi/de-thi…        → "Đề thi · Ngân hàng câu hỏi · Ma trận đề · Tệp đề gốc" (sáng theo tiền tố dài nhất).
 *  - /lop-cua-toi/quan-lop/[id]… → GS-LOP-GON (09/11/2026) "Giáo trình · Học sinh · Điểm danh · Bài tập · Lịch học · Cài đặt" — MỘT dải duy nhất của lớp.
 *      Giáo trình / Học sinh / Điểm danh / Lịch học = trang con (…/giao-trinh, /hoc-vien, /diem-danh, /lich-hoc); Bài tập = ?tab=chuong-bai (cây Phần · Chương · Bài +
 *      bài tập tự nộp), Cài đặt = ?tab=cai-dat. Không có ?tab= thì trang gốc đã chuyển sang Giáo trình nên KHÔNG tab nào sáng ở "gốc trần".
 *      ?tab=lich-hoc / ?tab=hoc-vien (liên kết cũ) vẫn làm sáng đúng tab. `role` đồng giảng / bộ môn → chỉ "Giáo trình · Lịch học".
 *  - danh sách lớp, tao-moi, đường khác → null (không dải tab).
 */
export function contentTabsFor(pathname: string, tab: string | null = null, role: ContentTabRole = null): ContentTabGroup | null {
  const DE_THI = "/lop-cua-toi/de-thi";
  if (isUnder(pathname, DE_THI)) {
    const defs = [
      { label: "Đề thi", href: DE_THI },
      { label: "Ngân hàng câu hỏi", href: `${DE_THI}/ngan-hang-cau-hoi` },
      { label: "Ma trận đề", href: `${DE_THI}/ma-tran` },
      { label: "Tệp đề gốc", href: `${DE_THI}/ngan-hang-de-thi` },
    ];
    const best = defs.filter(d => isUnder(pathname, d.href)).sort((a, b) => b.href.length - a.href.length)[0];
    return { label: "Đề thi", tabs: defs.map(d => ({ ...d, active: d === best })) };
  }
  const m = /^\/lop-cua-toi\/quan-lop\/([^/]+)(?:\/(.*))?$/.exec(pathname);
  if (!m || m[1] === "tao-moi") return null;
  const base = `/lop-cua-toi/quan-lop/${m[1]}`;
  const sub = m[2] ?? "";
  const onSub = (name: string) => sub === name || sub.startsWith(name + "/");
  const onRoot = (name: string) => sub === "" && tab === name; // trang gốc ?tab=<name>
  const all: ContentTab[] = [
    { label: "Giáo trình", href: `${base}/giao-trinh`, active: onSub("giao-trinh") },
    { label: "Học sinh", href: `${base}/hoc-vien`, active: onSub("hoc-vien") || onRoot("hoc-vien") },
    { label: "Điểm danh", href: `${base}/diem-danh`, active: onSub("diem-danh") },
    { label: "Bài tập", href: `${base}?tab=chuong-bai`, active: onRoot("chuong-bai") },
    // TUT-lich-keo-tha: "Lịch học" là lưới kéo-thả ở trang riêng /lich-hoc; ?tab=lich-hoc (liên kết cũ) vẫn sáng tab này.
    { label: "Lịch học", href: `${base}/lich-hoc`, active: onSub("lich-hoc") || onRoot("lich-hoc") },
    { label: "Cài đặt", href: `${base}?tab=cai-dat`, active: onRoot("cai-dat") },
  ];
  return { label: "Quản lớp", tabs: isHelper(role) ? all.filter(t => t.label === "Giáo trình" || t.label === "Lịch học") : all };
}
