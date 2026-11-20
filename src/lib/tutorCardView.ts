// LOI-05 (mục 3.2 docs/kin/phong-ban/dac-ta/LOI-05.md) — dữ liệu hiển thị của MỘT thẻ gia sư trên /giang-vien. THUẦN: không React, không Prisma, không node:*.
// Test: tools/local-e2e/t-tutor-card-lib.ts.
//
// Nguyên tắc (mục 2 đặc tả — không bịa, không lộ):
//  • Tên đầy đủ, KHÔNG BAO GIỜ cắt (chỉ làm sạch khoảng trắng / ký tự vô hình).
//  • Không sao, không điểm: `rating` của API không đi vào view. Không "đã xác minh".
//  • Thiếu trường nào thì chuỗi rỗng ("" = giao diện bỏ dòng đó), không "chưa khai", không đoán.
//  • Giá chỉ khi gia sư tự bật (`area.price` là số), luôn kèm "giá tham khảo, tự khai".
//  • Ảnh chỉ nhận data URL `data:image/…` (không http:, không javascript:); còn lại → null, giao diện hiện chữ cái đầu.
import { MODE_LABEL, areaLine as areaLineOf, cleanText, hasPublicArea, priceText, type TeachingMode } from "@/lib/tutorArea";
import { gradesOfTutor, type TutorListItem } from "@/lib/tutorSearch";

export interface TutorCardView {
  id: string;
  /** Tên đầy đủ đã làm sạch khoảng trắng — không cắt. */
  name: string;
  /** ≤ 2 chữ cái in hoa; "?" khi tên không có chữ cái nào. */
  initials: string;
  /** Chỉ data URL `data:image/`; khác → null. */
  avatar: string | null;
  /** Tối đa `maxSubjects` môn đầu (đã bỏ trùng, bỏ rỗng). */
  subjects: string[];
  /** Số môn còn lại (cho "+n"). */
  moreSubjects: number;
  gradeLine: string;
  areaLine: string;
  modeLabel: string;
  priceLine: string;
  bio: string;
}

export const PRICE_SUFFIX = " · giá tham khảo, tự khai";
export const BIO_SNIPPET_MAX = 180;
export const DEFAULT_MAX_SUBJECTS = 4;

/** Chữ đầu của từ ĐẦU và từ CUỐI, in hoa ("Nguyễn Thị Minh Anh" → "NA"; "Lan" → "L"). Từ không có chữ cái (số, emoji, dấu) bị bỏ qua. */
export function initialsOf(name: string): string {
  const firstLetters = cleanText(typeof name === "string" ? name : "")
    .split(" ")
    .map(w => /\p{L}/u.exec(w)?.[0] ?? "")
    .filter(Boolean);
  if (firstLetters.length === 0) return "?";
  const picked = firstLetters.length === 1 ? [firstLetters[0]] : [firstLetters[0], firstLetters[firstLetters.length - 1]];
  // toLocaleUpperCase("vi"): "đ" → "Đ". Một chữ cái có thể in hoa thành 2 ký tự (ß → SS): chỉ giữ ký tự đầu để luôn ≤ 2.
  return picked.map(l => Array.from(l.toLocaleUpperCase("vi"))[0]).join("");
}

const GROUP_LABEL: Record<string, string> = { "tieu-hoc": "Tiểu học", thcs: "THCS", thpt: "THPT", "dai-hoc": "Đại học" };
const GROUP_ORDER = ["tieu-hoc", "thcs", "thpt", "dai-hoc"] as const;
/** Số lớp thuộc mỗi nhóm (Đại học không có số). */
const GROUP_NUMBERS: Record<string, readonly number[]> = { "tieu-hoc": [1, 2, 3, 4, 5], thcs: [6, 7, 8, 9], thpt: [10, 11, 12], "dai-hoc": [] };

/** Dãy số đã sắp → "6–9, 12" (từ 2 số liền nhau trở lên thì gom dải). */
function rangesText(nums: readonly number[]): string {
  const parts: string[] = [];
  for (let i = 0; i < nums.length; ) {
    let j = i;
    while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) j++;
    parts.push(j > i ? `${nums[i]}–${nums[j]}` : String(nums[i]));
    i = j + 1;
  }
  return parts.join(", ");
}

/**
 * Cấp lớp suy từ tên môn (`gradesOfTutor`, không đoán): "Lớp 6–9, 12"; nhóm không có số nào đại diện được nối thêm sau " · "
 * (luôn gồm "Đại học" khi có); không có số thì chỉ nhóm: "THCS · THPT". Không suy được gì → "".
 */
export function gradeLine(subjects: readonly string[]): string {
  const list = Array.isArray(subjects) ? subjects.filter((s): s is string => typeof s === "string") : [];
  const g = gradesOfTutor(list);
  const nums = [...g].map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= 12).sort((a, b) => a - b);
  const groups = GROUP_ORDER.filter(k => g.has(k) && !GROUP_NUMBERS[k].some(n => nums.includes(n))).map(k => GROUP_LABEL[k]);
  const parts = nums.length ? [`Lớp ${rangesText(nums)}`, ...groups] : groups;
  return parts.join(" · ");
}

/** Gộp khoảng trắng/xuống dòng (bỏ ký tự vô hình); dài hơn `max` thì cắt ở ranh giới từ + "…" (kết quả ≤ max ký tự). null → "". */
export function bioSnippet(bio: string | null, max = BIO_SNIPPET_MAX): string {
  const text = cleanText(typeof bio === "string" ? bio : "");
  const limit = Number.isFinite(max) ? Math.max(1, Math.floor(max)) : BIO_SNIPPET_MAX;
  const chars = Array.from(text); // theo điểm mã: không bao giờ tách đôi emoji / cặp thay thế
  if (chars.length <= limit) return text;
  const room = chars.slice(0, limit - 1); // chừa 1 chỗ cho "…"
  // Ranh giới từ: khoảng trắng cuối cùng trong phần giữ lại (nếu không quá sớm); một từ dài liền thì cắt cứng.
  const lastSpace = room.lastIndexOf(" ");
  const kept = lastSpace >= Math.floor((limit - 1) / 2) ? room.slice(0, lastSpace) : room;
  return kept.join("").replace(/[\s,.;:–—-]+$/u, "") + "…";
}

const isDataImage = (v: unknown): v is string => typeof v === "string" && v.startsWith("data:image/");
const modeLabelOf = (m: unknown): string =>
  typeof m === "string" && Object.prototype.hasOwnProperty.call(MODE_LABEL, m) ? MODE_LABEL[m as TeachingMode] : "";
const isPrice = (p: unknown): p is number => typeof p === "number" && Number.isFinite(p) && p > 0;

export function tutorCardView(t: TutorListItem, maxSubjects = DEFAULT_MAX_SUBJECTS): TutorCardView {
  const name = cleanText(typeof t.name === "string" ? t.name : "");
  const seen = new Set<string>();
  const allSubjects: string[] = [];
  for (const s of Array.isArray(t.subjects) ? t.subjects : []) {
    const c = typeof s === "string" ? cleanText(s) : "";
    if (c && !seen.has(c)) { seen.add(c); allSubjects.push(c); }
  }
  const cap = Number.isFinite(maxSubjects) ? Math.max(0, Math.floor(maxSubjects)) : DEFAULT_MAX_SUBJECTS;
  const area = t.area ?? null;
  const price = area?.price;
  return {
    id: t.id,
    name,
    initials: initialsOf(name),
    avatar: isDataImage(t.avatarBase64) ? t.avatarBase64 : null,
    subjects: allSubjects.slice(0, cap),
    moreSubjects: Math.max(0, allSubjects.length - cap),
    gradeLine: gradeLine(allSubjects),
    areaLine: hasPublicArea(area) ? areaLineOf(area) : "",
    modeLabel: modeLabelOf(area?.mode),
    priceLine: isPrice(price) ? priceText(price) + PRICE_SUFFIX : "",
    bio: bioSnippet(t.bio),
  };
}
