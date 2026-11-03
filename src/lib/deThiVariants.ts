// BU-03 P2 — nhiều mã đề: đảo câu (giữ vị trí cố định, đảo trong từng Phần), đảo phương án (trừ câu "Cả A và B"…), mã đề 101, 102…,
// khoá nhận diện câu xuyên mã đề, cổng phát hành. THUẦN (không prisma/next). v1 KHÔNG đảo thứ tự ý Đúng-Sai (chủ đã chốt).
import { createHash } from "node:crypto";
import { makeRng, shuffleSeeded } from "@/lib/deThiBlueprint";
import { FORMULA_PLACEHOLDER } from "@/lib/ommlLatex";

/** Đề gốc = mã 1; mã con 2..8 (đặc tả Q5: ≤ 8 mã đề mỗi đề gốc). `count` là TỔNG số mã gồm cả đề gốc. */
export const VARIANT_MIN = 2;
export const VARIANT_MAX = 8;

/** Mã đề hiển thị: variantNo 1 → 101, 2 → 102… (chủ chốt 02/11/2026). */
export function variantCode(no: number): number { return 100 + no; }

// ── Đảo ───────────────────────────────────────────────────────────────────────────────────────
/**
 * Đảo `order` nhưng GIỮ NGUYÊN các vị trí trong `fixedIdx`. Nếu có `groups` (nhãn Phần của từng vị trí), chỉ đảo trong từng Phần
 * (câu không rời Phần của nó). Chỉ số cố định ngoài phạm vi / lặp bị bỏ qua. Không sửa `order`.
 */
export function shuffleWithFixed<T>(order: readonly T[], fixedIdx: readonly number[], rng: () => number, groups?: readonly (string | null)[]): T[] {
  const out = [...order];
  const fixed = new Set(fixedIdx.filter(i => Number.isInteger(i) && i >= 0 && i < order.length));
  const byGroup = new Map<string | null, number[]>();
  for (let i = 0; i < order.length; i++) {
    const g = groups ? (groups[i] ?? null) : null;
    const arr = byGroup.get(g) ?? []; arr.push(i); byGroup.set(g, arr);
  }
  for (const positions of byGroup.values()) {
    const free = positions.filter(p => !fixed.has(p));
    const shuffled = shuffleSeeded(free.map(p => order[p]), rng);
    free.forEach((p, k) => { out[p] = shuffled[k]; });
  }
  return out;
}

const deaccent = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
// Mẫu chữ có sẵn thứ tự/tham chiếu tới phương án khác: đảo thì đáp án sai nghĩa.
const UNSAFE_WORDING: RegExp[] = [
  /\btat ca (cac )?(dap an|phuong an|y|cau)( tren| deu| dung| sai|$)/,
  /\btat ca (deu )?(dung|sai)\b/,
  /\bca\s+[a-d]\s*(va|,|&)\s*[a-d]\b/,
  /\bkhong (co )?(dap an|phuong an|y) nao\b/,
  /\b(dap an|phuong an) (tren|tren day|con lai|nao)\b/,
  /\bcac (dap an|phuong an) (tren|tren day)\b/,
  /\bdeu (dung|sai)\b/,
];
// Chỉ "A và C", "A, B", "Cả A và B" khi toàn bộ phương án chỉ là các chữ cái HOA (tránh nhầm "a và b" là số trong toán).
const UNSAFE_LETTERS = /^\s*(?:[Cc]ả\s+)?[A-D](?:\s*(?:và|,|&)\s*[A-D])+\s*\.?\s*$/;

/** Phương án có tham chiếu tới phương án khác (Cả A và B, Tất cả đáp án trên, Không đáp án nào, A và C…) → KHÔNG đảo phương án của câu đó. */
export function optionsShuffleUnsafe(options: readonly { text: string }[]): boolean {
  return options.some(o => {
    const t = o.text ?? "";
    if (UNSAFE_LETTERS.test(t)) return true;
    const d = deaccent(t).toLowerCase();
    return UNSAFE_WORDING.some(re => re.test(d));
  });
}

// ── Nhận diện câu xuyên mã đề ───────────────────────────────────────────────────────────────────
export interface KeyQuestion { type: string; text: string; options: readonly { text: string; isCorrect: boolean }[] }
const norm = (s: string) => (s ?? "").normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Khoá ổn định của một câu: băm (loại + chữ chuẩn hoá + các phương án SẮP XẾP kèm đúng/sai). Đảo thứ tự phương án KHÔNG đổi khoá,
 * đổi đáp án đúng hoặc đổi chữ thì đổi — để gom thống kê từng câu xuyên mã đề mà không thêm cột.
 */
export function variantKey(q: KeyQuestion): string {
  const opts = q.options.map(o => `${norm(o.text)}|${o.isCorrect ? 1 : 0}`).sort();
  return createHash("sha256").update([q.type, norm(q.text), ...opts].join("\n")).digest("hex").slice(0, 16);
}

// ── Kế hoạch dựng mã đề ──────────────────────────────────────────────────────────────────────────
export interface PlanQuestion { type: string; sectionLabel: string | null; options: readonly { text: string }[] }
export interface VariantSpec { variantNo: number; code: number; order: number[]; optionOrders: number[][] }
export interface VariantWarning { questionIndex: number; code: "OPTIONS_NOT_SHUFFLED"; message: string }
export interface VariantPlan { variants: VariantSpec[]; warnings: VariantWarning[] }
export interface PlanOptions { count: number; shuffleQuestions: boolean; shuffleOptions: boolean; fixed: readonly number[]; seed: string }

const isIdentity = (a: readonly number[]) => a.every((v, i) => v === i);
const OPTION_SHUFFLE_TYPES = new Set(["MC", "MC_MULTI"]); // Đ/S giữ thứ tự ý (v1), trả lời ngắn/tự luận không có phương án để đảo

/** Cảnh báo "phương án không đảo được" cho từng câu của đề gốc (hiện ở màn Mã đề cả khi chưa tạo). */
export function shuffleWarnings(questions: readonly PlanQuestion[]): VariantWarning[] {
  const out: VariantWarning[] = [];
  questions.forEach((q, i) => {
    if (OPTION_SHUFFLE_TYPES.has(q.type) && optionsShuffleUnsafe(q.options)) {
      out.push({ questionIndex: i, code: "OPTIONS_NOT_SHUFFLED", message: `Câu ${i + 1} có phương án nhắc tới phương án khác (vd "Cả A và B") nên giữ nguyên thứ tự phương án.` });
    }
  });
  return out;
}

/**
 * Dựng kế hoạch cho các mã con 2..count từ đề gốc (mã 1 giữ nguyên). Cùng `seed` → cùng kế hoạch. Cố gắng để mã con khác đề gốc
 * (thử lại vài lần) khi còn gì để đảo; nếu không còn gì để đảo thì mã con trùng đề gốc — gọi bên ngoài nên báo.
 */
export function buildVariantPlan(questions: readonly PlanQuestion[], opt: PlanOptions): VariantPlan {
  const n = questions.length;
  const groups = questions.map(q => q.sectionLabel);
  const unsafe = new Set(shuffleWarnings(questions).map(w => w.questionIndex));
  const variants: VariantSpec[] = [];
  for (let no = 2; no <= opt.count; no++) {
    const rng = makeRng(`${opt.seed}|v${no}`);
    const base = Array.from({ length: n }, (_, i) => i);
    let order = base, optionOrders: number[][] = [];
    for (let attempt = 0; attempt < 8; attempt++) {
      order = opt.shuffleQuestions ? shuffleWithFixed(base, opt.fixed, rng, groups) : base;
      optionOrders = questions.map((q, i) => {
        const idn = q.options.map((_, k) => k);
        if (!opt.shuffleOptions || !OPTION_SHUFFLE_TYPES.has(q.type) || unsafe.has(i) || idn.length < 2) return idn;
        return shuffleSeeded(idn, rng);
      });
      const changed = !isIdentity(order) || optionOrders.some(o => !isIdentity(o));
      const canChange = (opt.shuffleQuestions && n > 1) || (opt.shuffleOptions && questions.some((q, i) => OPTION_SHUFFLE_TYPES.has(q.type) && !unsafe.has(i) && q.options.length > 1));
      if (changed || !canChange) break;
    }
    variants.push({ variantNo: no, code: variantCode(no), order, optionOrders });
  }
  return { variants, warnings: shuffleWarnings(questions) };
}

// ── Cổng phát hành ──────────────────────────────────────────────────────────────────────────────
export interface GateQuestion { text: string; explanation?: string | null; options: readonly { text: string }[] }
export type GateBlock = { status: 422; code: "FORMULA_UNREAD" | "VARIANTS_NOT_READY" | "VARIANTS_ESSAY" | "NEED_SCHEDULE" | "VARIANTS_STALE"; error: string };

/** Câu nào (1-based) còn nhãn ⟦công thức⟧ — công thức MathType chưa đọc được, gia sư phải gõ tay. */
export function questionsWithFormulaPlaceholder(questions: readonly GateQuestion[]): number[] {
  const out: number[] = [];
  questions.forEach((q, i) => {
    if (q.text.includes(FORMULA_PLACEHOLDER) || (q.explanation ?? "").includes(FORMULA_PLACEHOLDER) || q.options.some(o => o.text.includes(FORMULA_PLACEHOLDER))) out.push(i + 1);
  });
  return out;
}

/**
 * Cổng phát hành của đề (mục 6.2): còn ⟦công thức⟧ → FORMULA_UNREAD; N>1 mã mà phòng thi chưa hỗ trợ → VARIANTS_NOT_READY;
 * mode=test thiếu giờ → NEED_SCHEDULE; mã con không còn khớp đề gốc → VARIANTS_STALE; N>1 mã mà đề CÓ câu tự luận → VARIANTS_ESSAY
 * (BU-04 rà soát: màn chấm bài của gia sư và quyết định giữ điểm đọc theo TỪNG đề, chưa gom bài của các mã con → học sinh làm mã con kẹt
 * "chờ gia sư chấm" và gia sư không thấy bài để chấm). `null` = qua cổng.
 */
export function publishGate(i: {
  questions: readonly GateQuestion[]; variantCount: number; variantStudentSupport: boolean;
  mode: string | null; hasSchedule: boolean; variantsStale?: boolean; hasEssay?: boolean;
}): GateBlock | null {
  const bad = questionsWithFormulaPlaceholder(i.questions);
  if (bad.length) {
    return { status: 422, code: "FORMULA_UNREAD", error: `Chưa phát hành được: câu ${bad.slice(0, 5).join(", ")}${bad.length > 5 ? "…" : ""} còn nhãn ⟦công thức⟧ — KiN chưa đọc được công thức MathType. Cô gõ lại công thức ở trình soạn rồi phát hành.` };
  }
  if (i.mode === "test" && !i.hasSchedule) return { status: 422, code: "NEED_SCHEDULE", error: "Bài kiểm tra cần có ngày, giờ mở và thời lượng. Cô đặt đủ ba mục rồi phát hành." };
  if (i.variantCount > 1 && i.variantsStale) return { status: 422, code: "VARIANTS_STALE", error: "Đề gốc đã đổi sau khi tạo mã đề nên các mã đề con không còn khớp. Cô tạo lại mã đề rồi phát hành." };
  if (i.variantCount > 1 && !i.variantStudentSupport) {
    return { status: 422, code: "VARIANTS_NOT_READY", error: "Đề nhiều mã chưa phát hành được vì phòng thi của học sinh chưa hỗ trợ mã đề. Cô phát hành đề một mã, hoặc chờ KiN bật tính năng này." };
  }
  if (i.variantCount > 1 && i.hasEssay) {
    return { status: 422, code: "VARIANTS_ESSAY", error: "Đề nhiều mã chưa phát hành được khi đề có câu tự luận: màn chấm bài của cô chưa gom bài của các mã đề. Cô phát hành đề một mã, hoặc tách phần tự luận ra đề riêng." };
  }
  return null;
}

/** Mã con còn khớp đề gốc không? So tập khoá câu (không phụ thuộc thứ tự câu / thứ tự phương án). */
export function variantMatchesRoot(root: readonly KeyQuestion[], child: readonly KeyQuestion[]): boolean {
  if (root.length !== child.length) return false;
  const a = root.map(variantKey).sort(), b = child.map(variantKey).sort();
  return a.every((k, i) => k === b[i]);
}

/**
 * Điều kiện Prisma cho danh sách "chọn quiz để thêm câu" (GET /api/tutor/quiz): chỉ đề của chính gia sư, không phải bản đã bị thay,
 * và KHÔNG BAO GIỜ là mã đề con (nội dung suy ra từ đề gốc — thêm / sửa câu vào đó làm lệch nhóm mã đề). `editable` = chưa ai làm.
 */
export function pickerWhere(ownerId: string, editable: boolean) {
  return { ownerId, supersededById: null, variantOfId: null, ...(editable ? { attempts: { none: {} } } : {}) };
}
