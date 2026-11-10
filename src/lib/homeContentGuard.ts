// HOME-02 — luật THUẦN cho màn sửa trang chủ (không import prisma / next / react): dùng ở máy chủ (PUT) và trình duyệt (bộ đếm, báo lỗi sớm).
// Hình dạng nội dung và kiểm cấu trúc nằm ở siteContent.ts (HOME-01); tệp này thêm: cụm cấm (lời hứa KiN không có), bộ đếm ký tự theo trường,
// số lượng ô/thẻ, danh sách đường dẫn gợi ý, và so sánh hai bản để ghi nhật ký (chỉ TÊN trường).
import { HOME_LIMITS, type HomeContent, type HomeIssue } from "@/lib/siteContent";

/** Cụm cấm: chữ trang công khai là lời hứa của KiN với phụ huynh. Danh sách này phải BAO TRÙM sáu dòng STU-002 + các dòng cũ của tools/local-e2e/t-no-fabricated.ts
 *  (có bài khoá trong t-home-content-guard-lib). Khi t-no-fabricated đổi, đổi cả đây. */
export const CLAIM_BLOCKLIST: readonly { re: RegExp; reason: string }[] = [
  { re: /1\.200\+|10\.000\+/, reason: "số liệu chưa có nguồn" },
  // BU-HS-LANDING: dạng "50.000+" / "3.500+ gia sư" / "200+ đề" (số tròn kèm dấu cộng là kiểu số bịa của trang bán hàng).
  { re: /\d{1,3}(\.\d{3})+\s?\+|\d+\s?\+\s*(học viên|học sinh|gia sư|giáo viên|đề)/i, reason: "số liệu chưa có nguồn" },
  { re: /Hoàn tiền 100%/i, reason: "KiN không thu học phí hộ nên không có hoàn tiền" },
  { re: /hàng đầu|số 1\b|số một|tốt nhất/i, reason: "lời tự xưng không có căn cứ" },
  { re: /Học trọn đời|Mua 1 lần, xem không giới hạn|miễn phí[^.]*(trọn đời|mãi mãi)/i, reason: "trái cách bán thật (học phí theo tháng)" },
  { re: /AI hỗ trợ giải bài|hỏi AI 24\/7|AI giải bài 24\/7|Ngoài giờ có AI/i, reason: "KiN chưa có AI giải bài" },
  { re: /VNPay/i, reason: "đối tác thanh toán không hề tích hợp" },
  { re: /Combo 8 môn chỉ|tiết kiệm 57%/i, reason: "khoá combo và mức giảm giá không có" },
  { re: /trợ giảng (riêng|phản hồi|người thật)|phân công trợ giảng/i, reason: "KiN không có vai trợ giảng" },
  { re: /live mỗi tối|Học trực tiếp LIVE|video quay sẵn/i, reason: "KiN không tổ chức lớp live" },
  { re: /realtime|thời gian thực/i, reason: "không có cập nhật thời gian thực" },
  { re: /(phản hồi|trả lời) trong ngày/i, reason: "không ai đỡ cam kết thời gian phản hồi" },
  { re: /24\s?(h|giờ)?\s?[\/\-]\s?7|24\s?(h|giờ)\s?(một|mỗi)\s?ngày|cả ngày lẫn đêm/i, reason: "KiN không hỗ trợ 24/7" },
  { re: /top\s?(1|một)\b/i, reason: "lời tự xưng không có căn cứ" },
  { re: /đảm bảo đầu ra|bao (đỗ|đậu|điểm)/i, reason: "KiN không cam kết kết quả" },
  { re: /thứ hạng toàn hệ thống|GPA, streak và/, reason: "không có bảng GPA / streak theo thời gian thực" },
  { re: /cam kết|đảm bảo (kết quả|điểm|đỗ|đậu)/i, reason: "KiN không cam kết kết quả" },
  { re: /\d{2,}\s?(học sinh|gia sư|phụ huynh)|\d+\s?(%|phần trăm)/i, reason: "số liệu viết tay dễ sai; số thật hiện ở khối số liệu tự động" },
];

/** Bản KHÔNG DẤU của các cụm cấm (chạy trên chữ đã bỏ dấu, hạ chữ thường): bắt người gõ "Truong hang dau", "Hoan tien 100 phan tram"…
 *  Đồng bộ với GUARD_LISTS của tools/local-e2e/t-no-fabricated.ts: thêm cụm vào một danh sách thì thêm cả hai, và thêm ca phá vào t-home-content-guard-lib. */
const FOLDED_BLOCKLIST: readonly { re: RegExp; reason: string }[] = [
  { re: /hoan tien/, reason: "KiN không thu học phí hộ nên không có hoàn tiền" },
  { re: /hang dau|so 1\b|so mot|tot nhat|top\s?(1|mot)\b/, reason: "lời tự xưng không có căn cứ" },
  { re: /hoc tron doi|mien phi[^.]*(tron doi|mai mai)/, reason: "trái cách bán thật (học phí theo tháng)" },
  { re: /24\s?(h|gio)?\s?[\/\-]\s?7|ca ngay lan dem/, reason: "KiN không hỗ trợ 24/7" },
  { re: /dam bao (dau ra|ket qua|diem|do|dau)|cam ket|bao (do|dau|diem)\b/, reason: "KiN không cam kết kết quả" },
  { re: /\d+\s?(%|phan tram)/, reason: "số liệu viết tay dễ sai; số thật hiện ở khối số liệu tự động" },
  { re: /vnpay|realtime|thoi gian thuc|live moi toi|tro giang (rieng|phan hoi|nguoi that)/, reason: "tính năng / đối tác KiN không có" },
];

/** Bỏ dấu tiếng Việt (NFD rồi bỏ dấu kết hợp; đ→d), hạ chữ thường. */
function foldVi(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase();
}

/** Bỏ ký tự độ rộng bằng 0 và gộp khoảng trắng, đưa về dạng chuẩn NFC để chữ có dấu tách rời không lách được. */
function squash(text: string): string {
  return text.normalize("NFKC").replace(/[​-‍⁠﻿­]/g, "").replace(/\s+/g, " ");
}

/** Trả cụm cấm đã khớp đầu tiên (và lý do), hoặc null. */
export function checkClaims(text: string): { match: string; reason: string } | null {
  const t = squash(text);
  for (const { re, reason } of CLAIM_BLOCKLIST) {
    const m = re.exec(t);
    if (m) return { match: m[0], reason };
  }
  const f = foldVi(t);
  for (const { re, reason } of FOLDED_BLOCKLIST) {
    const m = re.exec(f);
    if (m) return { match: m[0], reason };
  }
  return null;
}

/** Số ký tự Unicode (không đếm byte) sau khi cắt khoảng trắng đầu/cuối. */
export const countChars = (s: string): number => [...s.trim()].length;

/** Mọi trường chữ (không phải đường dẫn) kèm đường dẫn của nó. */
export function textFields(c: HomeContent): { path: string; value: string }[] {
  const out: { path: string; value: string }[] = [];
  const add = (path: string, value: string) => out.push({ path, value });
  add("badge", c.badge); add("title", c.title); add("lead", c.lead);
  c.exams.forEach((e, i) => { add(`exams[${i}].label`, e.label); add(`exams[${i}].desc`, e.desc); });
  add("why.title", c.why.title); add("why.subtitle", c.why.subtitle);
  c.why.cards.forEach((k, i) => { add(`why.cards[${i}].title`, k.title); add(`why.cards[${i}].desc`, k.desc); });
  add("findTutor.title", c.findTutor.title); add("findTutor.desc", c.findTutor.desc); add("findTutor.buttonLabel", c.findTutor.buttonLabel); add("findTutor.parentNote", c.findTutor.parentNote);
  add("cta.title", c.cta.title); add("cta.desc", c.cta.desc);
  add("cta.primary.label", c.cta.primary.label); add("cta.secondary.label", c.cta.secondary.label);
  return out;
}

/** Quét mọi trường chữ tìm cụm cấm. Lỗi nêu CỤM ĐÃ KHỚP và lý do, theo đường dẫn trường. */
export function checkHomeClaims(c: HomeContent): HomeIssue[] {
  const issues: HomeIssue[] = [];
  for (const f of textFields(c)) {
    const hit = checkClaims(f.value);
    if (hit) issues.push({ path: f.path, message: `'${hit.match}': ${hit.reason}` });
  }
  return issues;
}

/** Số lượng ô / thẻ trên dữ liệu THÔ (validateHomeContent âm thầm thay danh sách rỗng bằng mặc định, nên phải chặn trước). */
export function checkHomeCounts(raw: unknown): HomeIssue[] {
  const issues: HomeIssue[] = [];
  const r = raw as { exams?: unknown; why?: { cards?: unknown } } | null;
  if (!r || typeof r !== "object") return issues;
  if (Array.isArray(r.exams) && (r.exams.length < 1 || r.exams.length > HOME_LIMITS.examsMax)) issues.push({ path: "exams", message: `cần từ 1 đến ${HOME_LIMITS.examsMax} ô kỳ thi` });
  const cards = r.why && typeof r.why === "object" ? r.why.cards : undefined;
  if (Array.isArray(cards) && (cards.length < 1 || cards.length > HOME_LIMITS.cardsMax)) issues.push({ path: "why.cards", message: `cần từ 1 đến ${HOME_LIMITS.cardsMax} thẻ` });
  return issues;
}

/** Giới hạn ký tự của một trường theo đường dẫn (cho bộ đếm). null = không đếm (icon, đường dẫn…). */
export function limitFor(path: string): number | null {
  const L = HOME_LIMITS;
  const p = path.replace(/\[\d+\]/g, "[]");
  const map: Record<string, number> = {
    badge: L.badge, title: L.title, lead: L.lead,
    "exams[].label": L.examLabel, "exams[].desc": L.examDesc,
    "why.title": L.whyTitle, "why.subtitle": L.whySubtitle, "why.cards[].title": L.cardTitle, "why.cards[].desc": L.cardDesc,
    "findTutor.title": L.findTitle, "findTutor.desc": L.findDesc, "findTutor.buttonLabel": L.findButton, "findTutor.parentNote": L.findNote,
    "cta.title": L.ctaTitle, "cta.desc": L.ctaDesc, "cta.primary.label": L.linkLabel, "cta.secondary.label": L.linkLabel,
  };
  return map[p] ?? null;
}

/** Đường dẫn gợi ý cho ô liên kết (không bắt buộc dùng). */
export const HREF_SUGGESTIONS: readonly string[] = ["/khoa-hoc", "/thi-thu", "/giang-vien", "/dang-ky", "/dang-ky?vai=gia-su", "/dang-nhap", "/cong-dong", "/tin-tuc", "/diem-chuan"];

/** Đường dẫn nội bộ không nằm trong gợi ý và không phải ô kỳ thi (đã tự dựng từ danh mục) → nhắc người sửa mở thử. */
export function hrefNeedsManualCheck(href: string): boolean {
  if (!href.startsWith("/")) return false;
  const base = href.split(/[?#]/)[0];
  return !HREF_SUGGESTIONS.some(s => s.split("?")[0] === base);
}

function flatten(v: unknown, path: string, out: Map<string, string>): void {
  if (Array.isArray(v)) v.forEach((x, i) => flatten(x, `${path}[${i}]`, out));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) flatten(x, path ? `${path}.${k}` : k, out);
  else out.set(path, String(v));
}

/** Danh sách đường dẫn trường khác nhau giữa hai bản. Đổi thứ tự thẻ → liệt kê trường của các chỉ số đổi. Hai bản bằng nhau → []. CHỈ TÊN trường, không chép chữ. */
export function diffHomeContent(before: HomeContent, after: HomeContent): string[] {
  const a = new Map<string, string>(), b = new Map<string, string>();
  flatten(before, "", a); flatten(after, "", b);
  const keys = [...new Set([...a.keys(), ...b.keys()])];
  return keys.filter(k => a.get(k) !== b.get(k));
}
