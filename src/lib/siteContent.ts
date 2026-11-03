// Nội dung trang chủ sửa được (HOME-01, 01/11/2026). THUẦN: không import prisma / next / react / griddy-icons, để test không cần DB và dùng chung được ở máy khách.
// Đọc từ DB: siteContentServer.ts. Bảng khoá icon -> component nằm ở page.tsx (không ở đây).
//
// Một lõi, hai cổng: `readHome` đọc đầu vào rồi trả { value, issues }. `parseHomeContent` lấy `value` (không bao giờ ném lỗi, trang chủ dùng);
// `validateHomeContent` ok khi `issues` rỗng (màn quản trị dùng để TỪ CHỐI và nêu trường sai). Hai cổng không thể lệch nhau vì dùng chung lõi.
// Chuỗi chứa HTML được giữ nguyên là chữ (không lọc): an toàn nhờ React tự escape; page.tsx không dùng dangerouslySetInnerHTML cho các trường này.

export const HOME_CONTENT_KEY = "home";
export const HOME_ICON_KEYS = ["key", "calendar", "clipboard", "chat", "book", "users", "graduation", "trophy", "shield", "star"] as const;
export type HomeIconKey = (typeof HOME_ICON_KEYS)[number];
export interface HomeLink { label: string; href: string }
export interface HomeExam { label: string; desc: string; href: string }
export interface HomeCard { icon: HomeIconKey; title: string; desc: string }
export interface HomeContent {
  badge: string;
  title: string; // h1; "\n" = xuống dòng
  lead: string;
  exams: HomeExam[];
  why: { title: string; subtitle: string; cards: HomeCard[] };
  findTutor: { title: string; desc: string; buttonLabel: string; buttonHref: string; parentNote: string };
  cta: { title: string; desc: string; primary: HomeLink; secondary: HomeLink };
}
export type HomeIssue = { path: string; message: string };

/** Giới hạn (đổi một chỗ). Độ dài đếm theo ký tự sau trim. */
export const HOME_LIMITS = {
  badge: 100, title: 120, titleLine: 60, titleLines: 3, lead: 300,
  examsMax: 6, examLabel: 40, examDesc: 60,
  whyTitle: 80, whySubtitle: 140, cardsMax: 6, cardTitle: 40, cardDesc: 200,
  findTitle: 80, findDesc: 200, findButton: 30, findNote: 200,
  ctaTitle: 80, ctaDesc: 200, linkLabel: 40,
  href: 300,
} as const;

const examHref = (label: string) => "/khoa-hoc?category=" + encodeURIComponent(label);
const exam = (label: string, desc: string): HomeExam => ({ label, desc, href: examHref(label) });

function deepFreeze<T>(o: T): T {
  if (o && typeof o === "object") { for (const v of Object.values(o as object)) deepFreeze(v); Object.freeze(o); }
  return o;
}

export const DEFAULT_HOME_CONTENT: HomeContent = deepFreeze({
  badge: "KiN · Luyện thi ĐGNL, THPT & BCA cùng gia sư thật",
  title: "Học cùng gia sư thật,\ntheo lớp và theo lịch",
  lead: "Vào lớp bằng mã gia sư gửi, xem lịch và buổi học, làm bài tập và đề thi thử ngay trên KiN. Phụ huynh xem Sổ của con bằng đường dẫn riêng.",
  exams: [
    exam("ĐGNL HSA", "ĐH Quốc gia Hà Nội"),
    exam("ĐGNL HCM", "ĐH Quốc gia TP.HCM"),
    exam("Tốt nghiệp THPT", "8 môn thi quốc gia"),
    exam("TSA Bách Khoa", "ĐH Bách Khoa HN"),
  ],
  why: {
    title: "Học ở đây thì được gì?",
    subtitle: "Những thứ học sinh thực tế dùng mỗi ngày",
    cards: [
      { icon: "key", title: "Vào lớp bằng mã mời", desc: "Gia sư gửi mã, em nhập là thấy tên gia sư, lịch và học phí (nếu có) của lớp trước khi bấm vào." },
      { icon: "calendar", title: "Lịch học và buổi học", desc: "Một lịch tuần cho mọi lớp: buổi học với gia sư, hạn nộp bài tập và buổi thi thử." },
      { icon: "clipboard", title: "Thi thử trong phòng thi", desc: "Làm đề có giờ như thi thật. Nộp xong, KiN ghi nhận bài và tính điểm phần trắc nghiệm." },
      { icon: "chat", title: "Bài tập và hỏi đáp", desc: "Nộp bài tập gia sư giao ngay trên KiN. Có thắc mắc thì đăng hỏi trong lớp của mình hoặc ngoài cộng đồng." },
    ],
  },
  findTutor: {
    title: "Đang tìm gia sư?",
    desc: "Xem hồ sơ các gia sư trên KiN. Hồ sơ gia sư được quản trị KiN xem trước khi hiện ở trang Tìm gia sư.",
    buttonLabel: "Tìm gia sư",
    buttonHref: "/giang-vien",
    parentNote: "Phụ huynh xem Sổ của con bằng đường dẫn riêng do gia sư gửi, không cần tài khoản.",
  },
  cta: {
    title: "Gia nhập cộng đồng KiN ngay hôm nay",
    desc: "Tạo tài khoản học sinh để thi thử ngay. Có mã từ gia sư thì vào lớp, xem lịch và nộp bài trên KiN.",
    primary: { label: "Tạo tài khoản miễn phí →", href: "/dang-ky" },
    secondary: { label: "Thi thử ĐGNL ngay", href: "/thi-thu" },
  },
}) as HomeContent;

export const isExternalHref = (href: string): boolean => href.startsWith("https://");

const clone = <T,>(v: T): T => structuredClone(v);

/** href hợp lệ: nội bộ (đúng một "/" đầu) hoặc https:// đọc được, không user:pass. Đầu vào đã trim. */
function hrefProblem(h: string): string | null {
  if (h.length > HOME_LIMITS.href) return `liên kết dài quá ${HOME_LIMITS.href} ký tự`;
  if (/[\s\\\u0000-\u001f\u007f]/.test(h)) return "liên kết không được có khoảng trắng, dấu \\ hay ký tự điều khiển";
  if (h.startsWith("/")) return h.startsWith("//") ? "liên kết không được bắt đầu bằng //" : null;
  if (h.startsWith("https://")) {
    try {
      const u = new URL(h);
      if (u.protocol !== "https:" || !u.hostname) return "liên kết https không đọc được";
      if (u.username || u.password) return "liên kết không được chứa tên đăng nhập / mật khẩu";
      return null;
    } catch { return "liên kết https không đọc được"; }
  }
  return "liên kết phải bắt đầu bằng / (trong KiN) hoặc https://";
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const own = (o: Record<string, unknown>, k: string): unknown => (Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined);

type Opt = { max: number; multiline?: boolean; href?: boolean; maxLines?: number; maxLine?: number };

/** Trả chuỗi đã chuẩn hoá hoặc null (kèm issue). */
function readStr(raw: unknown, path: string, opt: Opt, issues: HomeIssue[]): string | null {
  const bad = (message: string) => { issues.push({ path, message }); return null; };
  if (typeof raw !== "string") return bad("phải là chữ");
  const s = raw.replace(/\r/g, "").trim();
  if (!s) return bad("không được để trống");
  if (opt.multiline) {
    if (/[\u0000-\u0009\u000b-\u001f\u007f]/.test(s)) return bad("có ký tự điều khiển");
    const lines = s.split("\n").map(l => l.trim());
    if (lines.some(l => !l)) return bad("có dòng trống");
    if (lines.length > (opt.maxLines ?? 1)) return bad(`quá ${opt.maxLines} dòng`);
    if (lines.some(l => [...l].length > (opt.maxLine ?? opt.max))) return bad(`mỗi dòng tối đa ${opt.maxLine} ký tự`);
    const joined = lines.join("\n");
    if ([...joined].length > opt.max) return bad(`dài quá ${opt.max} ký tự`);
    return joined;
  }
  if (/[\u0000-\u001f\u007f]/.test(s)) return bad("có ký tự điều khiển hoặc xuống dòng");
  if ([...s].length > opt.max) return bad(`dài quá ${opt.max} ký tự`);
  if (opt.href) { const p = hrefProblem(s); if (p) return bad(p); }
  return s;
}

function readHome(raw: unknown): { value: HomeContent; issues: HomeIssue[] } {
  const D = DEFAULT_HOME_CONTENT, L = HOME_LIMITS;
  const issues: HomeIssue[] = [];
  if (!isRecord(raw)) {
    issues.push({ path: "", message: "nội dung phải là một đối tượng" });
    return { value: clone(D), issues };
  }
  const str = (o: Record<string, unknown>, k: string, path: string, opt: Opt, def: string) => readStr(own(o, k), path, opt, issues) ?? def;
  const obj = (o: Record<string, unknown>, k: string, path: string): Record<string, unknown> | null => {
    const v = own(o, k);
    if (isRecord(v)) return v;
    issues.push({ path, message: "phải là một đối tượng" });
    return null;
  };
  /** Phần tử mảng: trường nào sai thì bỏ cả phần tử (issues vẫn được ghi). */
  const list = <T,>(o: Record<string, unknown>, k: string, path: string, max: number, def: T[], item: (e: unknown, p: string, tmp: HomeIssue[]) => T): T[] => {
    const v = own(o, k);
    if (!Array.isArray(v)) { issues.push({ path, message: "phải là danh sách" }); return clone(def); }
    if (v.length > max) issues.push({ path, message: `quá ${max} phần tử` });
    const out: T[] = [];
    v.slice(0, max).forEach((e, i) => {
      const tmp: HomeIssue[] = [];
      const r = item(e, `${path}[${i}]`, tmp);
      issues.push(...tmp);
      if (tmp.length === 0) out.push(r);
    });
    return out.length ? out : clone(def);
  };
  const link = (e: unknown, p: string, tmp: HomeIssue[], withDesc: boolean, labelMax: number, descMax: number): { label: string; desc: string; href: string } => {
    if (!isRecord(e)) { tmp.push({ path: p, message: "phải là một đối tượng" }); return { label: "", desc: "", href: "" }; }
    return {
      label: readStr(own(e, "label"), `${p}.label`, { max: labelMax }, tmp) ?? "",
      desc: withDesc ? readStr(own(e, "desc"), `${p}.desc`, { max: descMax }, tmp) ?? "" : "",
      href: readStr(own(e, "href"), `${p}.href`, { max: L.href, href: true }, tmp) ?? "",
    };
  };

  const v = clone(D);
  v.badge = str(raw, "badge", "badge", { max: L.badge }, D.badge);
  v.title = str(raw, "title", "title", { max: L.title, multiline: true, maxLines: L.titleLines, maxLine: L.titleLine }, D.title);
  v.lead = str(raw, "lead", "lead", { max: L.lead }, D.lead);

  v.exams = list(raw, "exams", "exams", L.examsMax, D.exams, (e, p, tmp) => {
    const r = link(e, p, tmp, true, L.examLabel, L.examDesc);
    return { label: r.label, desc: r.desc, href: r.href };
  });

  const why = obj(raw, "why", "why");
  if (why) {
    v.why.title = str(why, "title", "why.title", { max: L.whyTitle }, D.why.title);
    v.why.subtitle = str(why, "subtitle", "why.subtitle", { max: L.whySubtitle }, D.why.subtitle);
    v.why.cards = list(why, "cards", "why.cards", L.cardsMax, D.why.cards, (e, p, tmp) => {
      if (!isRecord(e)) { tmp.push({ path: p, message: "phải là một đối tượng" }); return D.why.cards[0]; }
      const icon = own(e, "icon");
      const okIcon = typeof icon === "string" && (HOME_ICON_KEYS as readonly string[]).includes(icon);
      if (!okIcon) tmp.push({ path: `${p}.icon`, message: `icon phải là một trong: ${HOME_ICON_KEYS.join(", ")}` });
      return {
        icon: (okIcon ? icon : "key") as HomeIconKey,
        title: readStr(own(e, "title"), `${p}.title`, { max: L.cardTitle }, tmp) ?? "",
        desc: readStr(own(e, "desc"), `${p}.desc`, { max: L.cardDesc }, tmp) ?? "",
      };
    });
  }

  const ft = obj(raw, "findTutor", "findTutor");
  if (ft) {
    v.findTutor.title = str(ft, "title", "findTutor.title", { max: L.findTitle }, D.findTutor.title);
    v.findTutor.desc = str(ft, "desc", "findTutor.desc", { max: L.findDesc }, D.findTutor.desc);
    v.findTutor.buttonLabel = str(ft, "buttonLabel", "findTutor.buttonLabel", { max: L.findButton }, D.findTutor.buttonLabel);
    v.findTutor.buttonHref = str(ft, "buttonHref", "findTutor.buttonHref", { max: L.href, href: true }, D.findTutor.buttonHref);
    v.findTutor.parentNote = str(ft, "parentNote", "findTutor.parentNote", { max: L.findNote }, D.findTutor.parentNote);
  }

  const cta = obj(raw, "cta", "cta");
  if (cta) {
    v.cta.title = str(cta, "title", "cta.title", { max: L.ctaTitle }, D.cta.title);
    v.cta.desc = str(cta, "desc", "cta.desc", { max: L.ctaDesc }, D.cta.desc);
    for (const k of ["primary", "secondary"] as const) {
      const o = obj(cta, k, `cta.${k}`);
      if (!o) continue;
      v.cta[k] = {
        label: str(o, "label", `cta.${k}.label`, { max: L.linkLabel }, D.cta[k].label),
        href: str(o, "href", `cta.${k}.href`, { max: L.href, href: true }, D.cta[k].href),
      };
    }
  }
  return { value: v, issues };
}

function safeRead(raw: unknown): { value: HomeContent; issues: HomeIssue[] } {
  try { return readHome(raw); } catch { return { value: clone(DEFAULT_HOME_CONTENT), issues: [{ path: "", message: "không đọc được nội dung" }] }; }
}

/** KHÔNG BAO GIỜ ném lỗi. Trường sai -> mặc định của riêng trường đó; phần tử mảng sai bị bỏ. Mỗi lần gọi trả bản sao mới. */
export function parseHomeContent(raw: unknown): HomeContent {
  return safeRead(raw).value;
}

/** Cho màn quản trị: từ chối và nêu trường sai, không tự sửa lặng lẽ. Khi ok, `value` là bản đã chuẩn hoá (trim, bỏ \r). */
export function validateHomeContent(raw: unknown): { ok: true; value: HomeContent } | { ok: false; issues: HomeIssue[] } {
  const r = safeRead(raw);
  return r.issues.length === 0 ? { ok: true, value: r.value } : { ok: false, issues: r.issues };
}
