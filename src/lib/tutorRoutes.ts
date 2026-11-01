// BU-00 bước 3 (31/10/2026) — bản đồ đường THUẦN giữa trang quản trị dùng chung (/admin/thi-thu*, /admin/khoa-hoc*) và bí danh của gia sư
// dưới /lop-cua-toi (de-thi*, quan-lop*). Không React, không DB, không đọc cookie — để test từng cặp (tools/local-e2e/t-tutor-routes-lib.ts).
//
// Vì sao có tệp này: gia sư KHÔNG còn làm việc trong /admin/* (vỏ quản trị). Hai tệp trang lớn (admin/khoa-hoc/[id] ~2.500 dòng, admin/thi-thu ~2.000 dòng)
// chưa tách (để BU-02/BU-03), nên trang mỏng dưới src/app/lop-cua-toi/(tutor)/(noi-dung)/ re-export đúng trang gốc, chạy trong vỏ gia sư (TutorShell).
// Proxy (src/lib/hostRouting.ts) thấy gia sư mở /admin/... thì 307 sang đường ở đây; link cũ trong thông báo đã lưu DB vẫn tới nhờ 307.
//
// Quy tắc: `danh-muc` (danh mục khoá học) KHÔNG có bí danh — gia sư không có quyền; mọi /admin/... khác cũng → null (proxy đưa về /lop-cua-toi).

/** Mỗi họ: gốc quản trị, gốc gia sư, các đuôi hợp lệ sau gốc (":id" = một segment bất kỳ; "" = chính trang gốc), segment cấm làm :id. */
interface Family { admin: string; tutor: string; tails: readonly string[]; banned: readonly string[] }
const FAMILIES: readonly Family[] = [
  { admin: "/admin/thi-thu", tutor: "/lop-cua-toi/de-thi",
    tails: ["", ":id", "tao-moi", "ngan-hang-cau-hoi", "ngan-hang-cau-hoi/:id", "ngan-hang-cau-hoi/cau-hoi", "ngan-hang-de-thi"], banned: [] },
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

function translate(input: string, from: "admin" | "tutor"): string | null {
  const [path, search] = splitQuery(input);
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
export function toAdminPath(tutorPath: string): string | null { return translate(tutorPath, "tutor"); }

/** Liên kết trong trang DÙNG CHUNG: gia sư đi đường của mình, quản trị giữ /admin/... (không map được thì về Hộp việc của gia sư). */
export function contentHref(isTeacher: boolean, adminPath: string): string {
  return isTeacher ? (toTutorPath(adminPath) ?? "/lop-cua-toi") : adminPath;
}

// ─── Dải tab của vỏ nội dung gia sư (src/components/tutor/TutorContentTabs.tsx) ────────────────────────────────────────────────
export interface ContentTab { label: string; href: string; active: boolean }
export interface ContentTabGroup { label: string; tabs: ContentTab[] }

const isUnder = (p: string, root: string) => p === root || p.startsWith(root + "/");
const COURSE_TABS = ["cai-dat", "chuong-bai", "lich-hoc", "hoc-vien"] as const;

/**
 * Dải tab theo đường đang mở (chỉ đường GIA SƯ). `tab` = giá trị ?tab= của trang quản lớp (mặc định "cai-dat" như trang gốc).
 *  - /lop-cua-toi/de-thi…        → "Đề thi · Ngân hàng câu hỏi · Ngân hàng đề" (sáng theo tiền tố dài nhất).
 *  - /lop-cua-toi/quan-lop/[id]… → "Cài đặt · Chương bài · Lịch học · Học viên · Điểm danh" (3 tab ?tab= của trang gốc + 2 trang con /hoc-vien, /diem-danh).
 *  - danh sách lớp, tao-moi, đường khác → null (không dải tab).
 */
export function contentTabsFor(pathname: string, tab: string | null = null): ContentTabGroup | null {
  const DE_THI = "/lop-cua-toi/de-thi";
  if (isUnder(pathname, DE_THI)) {
    const defs = [
      { label: "Đề thi", href: DE_THI },
      { label: "Ngân hàng câu hỏi", href: `${DE_THI}/ngan-hang-cau-hoi` },
      { label: "Ngân hàng đề", href: `${DE_THI}/ngan-hang-de-thi` },
    ];
    const best = defs.filter(d => isUnder(pathname, d.href)).sort((a, b) => b.href.length - a.href.length)[0];
    return { label: "Đề thi", tabs: defs.map(d => ({ ...d, active: d === best })) };
  }
  const m = /^\/lop-cua-toi\/quan-lop\/([^/]+)(?:\/(.*))?$/.exec(pathname);
  if (!m || m[1] === "tao-moi") return null;
  const base = `/lop-cua-toi/quan-lop/${m[1]}`;
  const sub = m[2] ?? "";
  const current = sub === "" ? ((COURSE_TABS as readonly string[]).includes(tab ?? "") ? tab : "cai-dat") : null;
  return {
    label: "Quản lớp",
    tabs: [
      { label: "Cài đặt", href: `${base}?tab=cai-dat`, active: current === "cai-dat" },
      { label: "Chương bài", href: `${base}?tab=chuong-bai`, active: current === "chuong-bai" },
      { label: "Lịch học", href: `${base}?tab=lich-hoc`, active: current === "lich-hoc" },
      // "Học viên" là trang danh bạ riêng (/hoc-vien, TK-171); ?tab=hoc-vien ("Học viên đăng ký") của trang gốc cũng sáng tab này.
      { label: "Học viên", href: `${base}/hoc-vien`, active: sub === "hoc-vien" || current === "hoc-vien" },
      { label: "Điểm danh", href: `${base}/diem-danh`, active: sub === "diem-danh" || sub.startsWith("diem-danh/") },
    ],
  };
}
