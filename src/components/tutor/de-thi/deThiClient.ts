// BU-03 — kiểu dữ liệu + bọc fetch cho các màn Đề thi kiểu Azota của GIA SƯ (trình duyệt). Kiểu GIỐNG HỆT hợp đồng ở docs/kin/phong-ban/dac-ta/BU-03.md
// (mục P1.2, P1.3, P1.4, mục 4). tut-code viết API song song theo cùng hợp đồng; tut-dev và tut-code không thêm trường ngoài hợp đồng khi chưa báo nhau.
// Vòng này CHỈ phần P1 (Ngân hàng câu hỏi + Nhập Word). Chỗ mở rộng cho P2 (ma trận, mã đề, tệp gốc) và P3 (giao đề, kết quả) ở cuối tệp.
// Lỗi API luôn có dạng { error: "<tiếng Việt>", code?: "MÃ" } (Q3) — qfetch (quizClient.ts) đã trả đúng dạng này, không ném lỗi.
import { qfetch, type ApiResult } from "@/components/tutor/quiz/quizClient";
import { toTutorPath } from "@/lib/tutorRoutes";
import type { QuizQuestionInput, QuizQuestionType } from "@/lib/quizQuestion";

export { qfetch, type ApiResult };

// ─── Đường dẫn ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Gốc trang gia sư của nhóm Đề thi (cùng gốc với FAMILIES[0].tutor ở tutorRoutes.ts). Chỉ dùng làm đường lùi khi toTutorPath chưa biết đuôi mới. */
export const DE_THI_BASE = "/lop-cua-toi/de-thi";

/**
 * Liên kết tới trang Đề thi / Ngân hàng của gia sư: đi qua toTutorPath, KHÔNG ghi cứng /admin/....
 * `fallback` chỉ dùng khi tutorRoutes.ts chưa có đuôi đó (tut-code thêm `ngan-hang-cau-hoi/nhap-word` ở PR-A) — bỏ được khi đuôi đã có.
 */
export function deThiHref(adminPath: string, fallback: string): string {
  return toTutorPath(adminPath) ?? fallback;
}
const NH = "/admin/thi-thu/ngan-hang-cau-hoi";
export const nganHangHref = () => deThiHref(NH, `${DE_THI_BASE}/ngan-hang-cau-hoi`);
export const nganHangNodeHref = (id: string) => deThiHref(`${NH}/${encodeURIComponent(id)}`, `${DE_THI_BASE}/ngan-hang-cau-hoi/${encodeURIComponent(id)}`);
export const nganHangSoanTayHref = () => deThiHref(`${NH}/cau-hoi`, `${DE_THI_BASE}/ngan-hang-cau-hoi/cau-hoi`);
export const nhapWordHref = (nodeId?: string | null) =>
  deThiHref(`${NH}/nhap-word`, `${DE_THI_BASE}/ngan-hang-cau-hoi/nhap-word`) + (nodeId ? `?nut=${encodeURIComponent(nodeId)}` : "");

// ─── Mức, nhãn tầng ────────────────────────────────────────────────────────────────────────────────────────────────────────
export type Level = "NB" | "TH" | "VD" | "VDC";
export const LEVELS: readonly Level[] = ["NB", "TH", "VD", "VDC"];
export const LEVEL_LABEL: Record<Level, string> = { NB: "Nhận biết", TH: "Thông hiểu", VD: "Vận dụng", VDC: "Vận dụng cao" };

/** Nhãn tầng chỉ để HIỆN cho nút lấy từ /api/question-categories (danh sách phẳng). Nguồn chuẩn là deThiTree.ts ở máy chủ (0=Môn,1=Lớp,2=Chương,3=YCCĐ,≥4=Mục con). */
export function tierLabel(depth: number): string {
  return ["Môn", "Lớp", "Chương", "Yêu cầu cần đạt"][depth] ?? "Mục con";
}

// ─── P1.2 Thống kê chương × mức  (GET /api/tutor/ngan-hang/thong-ke) ───────────────────────────────────────────────────────────
export type Scope = "mine" | "shared" | "all";
export const SCOPE_LABEL: Record<Scope, string> = { mine: "Kho của tôi", shared: "Kho chung", all: "Tất cả" };

export type Counts = Record<Level, number> & { none: number; total: number }; // none = chưa gắn mức
export interface StatNode { id: string; parentId: string | null; name: string; depth: number; label: string; own: Counts; sub: Counts }
export interface ChapterRow { chapterId: string; name: string; yccd: { id: string; name: string; counts: Counts }[]; counts: Counts }
export interface StatsRes { nodes: StatNode[]; chapterMatrix: ChapterRow[] }

export const fetchStats = (root: string, scope: Scope = "all") =>
  qfetch<StatsRes>("GET", `/api/tutor/ngan-hang/thong-ke?root=${encodeURIComponent(root)}&scope=${scope}`);

/** Danh sách phẳng đầu mục (API có sẵn, dùng chung với trang cũ): để biết các nút GỐC (Môn) và dựng ô chọn nút đích. */
export interface CategoryFlat { id: string; name: string; parentId: string | null; sortOrder: number; count: number }
export const fetchCategories = () => qfetch<CategoryFlat[]>("GET", "/api/question-categories");

/** Dựng danh sách nút theo thứ tự cây (cha trước con), kèm độ sâu tính từ gốc. */
export function flattenCategories(list: readonly CategoryFlat[]): (CategoryFlat & { depth: number })[] {
  const kids = new Map<string | null, CategoryFlat[]>();
  const ids = new Set(list.map(c => c.id));
  for (const c of list) {
    const k = c.parentId && ids.has(c.parentId) ? c.parentId : null; // cha không thấy được thì coi như gốc
    kids.set(k, [...(kids.get(k) ?? []), c]);
  }
  const out: (CategoryFlat & { depth: number })[] = [];
  const walk = (parent: string | null, depth: number) => {
    for (const c of (kids.get(parent) ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "vi"))) {
      out.push({ ...c, depth }); walk(c.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

// ─── P1.3 Kết quả đọc Word  (POST /api/tutor/ngan-hang/nhap-word, multipart) ──────────────────────────────────────────────────
export type AzotaFlag = "answer_missing" | "answer_conflict" | "formula_unread" | "image_unreadable";
export type AzotaAnswerSource = "dau-gach-chan" | "bang-het" | "loi-giai" | "mau" | "khong-co";
export interface AzotaQuestion {
  key: string; number: number; sectionIndex: number; sectionLabel: string;
  type: QuizQuestionType;
  text: string; imageUrl?: string;
  options: { text: string; isCorrect: boolean; subLabel?: string }[]; // Đ/S: subLabel "a".."d"; trả lời ngắn: 1 phần tử isCorrect=true chứa đáp án
  explanation: string; difficulty: Level | null;
  answerSource: AzotaAnswerSource;
  flags: AzotaFlag[];
}
export interface AzotaParse {
  questions: AzotaQuestion[];
  errors: { block: number; message: string }[]; // lỗi cứng, câu đó bị bỏ
  warnings: { question: string; code: string; message: string }[];
  stats: { total: number; byType: Record<string, number>; withAnswer: number; withImage: number; withFormulaUnread: number };
  fatal: string | null;
}
export type NhapWordRes = AzotaParse & { images: { key: string; url: string }[] };

export const WORD_MAX_BYTES = 4 * 1024 * 1024; // Q5: giới hạn thân yêu cầu Vercel
export const WORD_MAX_QUESTIONS = 200;
/** Nhãn mà bộ đọc chèn vào chỗ công thức MathType chưa đọc được (P1a). Câu còn nhãn này KHÔNG lưu được cho tới khi sửa tay. */
export const FORMULA_PLACEHOLDER = "⟦công thức⟧";
export const hasFormulaPlaceholder = (s: string | null | undefined): boolean => !!s && s.includes(FORMULA_PLACEHOLDER);

export const ANSWER_SOURCE_LABEL: Record<AzotaAnswerSource, string> = {
  "dau-gach-chan": "gạch chân trong đề", "bang-het": "bảng đáp án cuối đề", "loi-giai": "lời giải", mau: "theo mẫu", "khong-co": "không có",
};

/** Kiểm tệp trước khi tải lên (cùng luật với máy chủ: .docx, ≤ 4 MB). Trả câu tiếng Việt, hoặc null nếu ổn. */
export function wordFileProblem(f: File): string | null {
  if (!/\.docx$/i.test(f.name)) return `Tệp “${f.name}” chưa đúng định dạng. Chỉ nhận Word .docx (không nhận .doc hay .docm).`;
  if (f.size === 0) return `Tệp “${f.name}” trống.`;
  if (f.size > WORD_MAX_BYTES) return `Tệp “${f.name}” nặng hơn 4 MB. Cô tách thành các tệp nhỏ hơn.`;
  return null;
}

/** Tải tệp lên để XEM TRƯỚC. Máy chủ không ghi DB, không gọi AI, không nhúng (Q6). Ngoại lệ multipart của Q3: không qua qfetch vì thân không phải JSON. */
export async function uploadWord(file: File): Promise<ApiResult<NhapWordRes>> {
  const body = new FormData();
  body.append("file", file);
  try {
    const res = await fetch("/api/tutor/ngan-hang/nhap-word", { method: "POST", credentials: "same-origin", cache: "no-store", body });
    const json = await res.json().catch(() => null) as (NhapWordRes & { error?: string; code?: string }) | null;
    if (!res.ok) return { ok: false, status: res.status, data: null, error: json?.error ?? "Chưa đọc được tệp. Thử lại sau ít phút.", code: json?.code ?? null };
    return { ok: true, status: res.status, data: json as NhapWordRes, error: null, code: null };
  } catch {
    return { ok: false, status: 0, data: null, error: "Mất kết nối. Kiểm tra mạng rồi thử lại.", code: null };
  }
}

// ─── P1.4 Lưu hàng loạt  (POST /api/tutor/ngan-hang/luu-nhieu) ─────────────────────────────────────────────────────────────
export interface LuuNhieuReq { categoryId: string; items: QuizQuestionInput[]; defaultDifficulty?: Level }
export interface LuuNhieuRes { saved: number; skippedDuplicate: number; skippedInvalid: number; ids: string[] }
export const luuNhieu = (req: LuuNhieuReq) => qfetch<LuuNhieuRes>("POST", "/api/tutor/ngan-hang/luu-nhieu", req);

/** Đổi một câu đã rà soát thành đầu vào lưu ngân hàng. Điểm mặc định 1 (ngân hàng không giữ điểm; điểm chia lại khi đưa câu vào đề). */
export function toBankInput(q: { type: QuizQuestionType; text: string; imageUrl?: string; explanation: string; options: { text: string; isCorrect: boolean; subLabel?: string }[] }): QuizQuestionInput {
  return {
    type: q.type, text: q.text.trim(), points: 1, imageUrl: q.imageUrl ?? null, explanation: q.explanation.trim() || null,
    options: q.type === "ESSAY" ? [] : q.options.map(o => ({ text: o.text.trim(), isCorrect: o.isCorrect, subLabel: o.subLabel ?? null })),
  };
}

// ─── Chỗ mở rộng ──────────────────────────────────────────────────────────────────────────────────────────────────────────
// P2 (vòng sau): ma trận (BlueprintRow, rút/đổi câu, tạo đề từ ma trận), mã đề, tệp đề gốc  → /api/tutor/de-thi/**
// P3 (vòng sau): giao đề (cấu hình, mode), kết quả 5 khối, Excel                              → /api/tutor/de-thi/[id]/giao|ket-qua/**
