// BU-03 — kiểu dữ liệu + bọc fetch cho các màn Đề thi kiểu Azota của GIA SƯ (trình duyệt). Kiểu GIỐNG HỆT hợp đồng ở docs/kin/phong-ban/dac-ta/BU-03.md
// (mục P1.2, P1.3, P1.4, mục 4). tut-code viết API song song theo cùng hợp đồng; tut-dev và tut-code không thêm trường ngoài hợp đồng khi chưa báo nhau.
// P1 (Ngân hàng câu hỏi + Nhập Word) và P2 (ma trận, bốc/đổi câu, mã đề, tệp đề gốc) đã có ở đây; P3 (giao đề, kết quả) là vòng sau (chỗ mở rộng ở cuối tệp).
// Lỗi API luôn có dạng { error: "<tiếng Việt>", code?: "MÃ" } (Q3) — qfetch (quizClient.ts) đã trả đúng dạng này, không ném lỗi.
import { qfetch, type ApiResult } from "@/components/tutor/quiz/quizClient";
import { toTutorPath } from "@/lib/tutorRoutes";
import type { QuizQuestionInput, QuizQuestionType } from "@/lib/quizQuestion";
import { distributePoints } from "@/lib/scoreDistribution";

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
export type LuuNhieuItem = QuizQuestionInput & { difficulty?: Level; categoryId?: string }; // mức / nút riêng từng câu (P1 đã nhận)
export interface LuuNhieuReq { categoryId: string; items: LuuNhieuItem[]; defaultDifficulty?: Level }
export interface LuuNhieuRes { saved: number; skippedDuplicate: number; skippedInvalid: number; ids: string[] }
export const luuNhieu = (req: LuuNhieuReq) => qfetch<LuuNhieuRes>("POST", "/api/tutor/ngan-hang/luu-nhieu", req);

/** Đổi một câu đã rà soát thành đầu vào lưu ngân hàng. Điểm mặc định 1 (ngân hàng không giữ điểm; điểm chia lại khi đưa câu vào đề). */
export function toBankInput(q: { type: QuizQuestionType; text: string; imageUrl?: string; explanation: string; options: { text: string; isCorrect: boolean; subLabel?: string }[] }): QuizQuestionInput {
  return {
    type: q.type, text: q.text.trim(), points: 1, imageUrl: q.imageUrl ?? null, explanation: q.explanation.trim() || null,
    options: q.type === "ESSAY" ? [] : q.options.map(o => ({ text: o.text.trim(), isCorrect: o.isCorrect, subLabel: o.subLabel ?? null })),
  };
}

// ─── Đường dẫn P2 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
const TS = "/admin/thi-thu";
export const deThiListHref = (lop?: string | null) => deThiHref(TS, DE_THI_BASE) + (lop ? `?lop=${encodeURIComponent(lop)}` : "");
export const taoDeHref = (cach?: "ma-tran" | "word" | "pdf" | "trang") => deThiHref(`${TS}/tao-moi`, `${DE_THI_BASE}/tao-moi`) + (cach === "pdf" || cach === "trang" ? `?cach=${cach}` : "");
export const deThiDetailHref = (id: string) => deThiHref(`${TS}/${encodeURIComponent(id)}`, `${DE_THI_BASE}/${encodeURIComponent(id)}`);
export const deThiSubHref = (id: string, sub: "phien-ban" | "giao" | "ket-qua" | "ma-de" | "cham") => `${deThiDetailHref(id)}/${sub}`;
export const maTranListHref = () => deThiHref(`${TS}/ma-tran`, `${DE_THI_BASE}/ma-tran`);
export const maTranHref = (id: string) => deThiHref(`${TS}/ma-tran/${encodeURIComponent(id)}`, `${DE_THI_BASE}/ma-tran/${encodeURIComponent(id)}`);
export const maTranMoiHref = () => maTranHref("moi");
export const tepGocHref = () => deThiHref(`${TS}/ngan-hang-de-thi`, `${DE_THI_BASE}/ngan-hang-de-thi`);
/** Nhập Word thẳng vào MỘT ĐỀ NHÁP MỚI (không qua ngân hàng): dùng import-save có sẵn. */
export const nhapWordDeHref = () => nhapWordHref() + "?dich=de";

const unwrapList = <T,>(d: T[] | { items?: T[] } | null | undefined): T[] => (Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : []);

// ─── P2.3 Ngân hàng đề  (GET /api/tutor/de-thi?lop=&trangThai=) ───────────────────────────────────────────────────────────────
/** Máy chủ trả status ∈ draft|upcoming|available|completed (bản cũ đã ẩn); giao diện chịu cả giá trị lạ bằng cách hiện chữ thô. */
export const EXAM_STATUS_LABEL: Record<string, { tone: "xong" | "cho" | "loi" | "mo"; text: string }> = {
  draft: { tone: "cho", text: "Bản nháp" }, published: { tone: "xong", text: "Đã phát hành" }, closed: { tone: "mo", text: "Đã đóng" },
  upcoming: { tone: "mo", text: "Đã lên lịch" }, available: { tone: "xong", text: "Đang mở" }, completed: { tone: "mo", text: "Đã đóng" }, superseded: { tone: "mo", text: "Bản cũ" },
};
export type ExamMode = "practice" | "test";
export const MODE_LABEL: Record<ExamMode, string> = { practice: "Luyện tập", test: "Kiểm tra" };
export interface DeThiItem {
  id: string; title: string; status: string; mode: ExamMode | null;
  variants: number | unknown[]; // máy chủ trả SỐ mã đề đã gồm đề gốc (1 = chưa chia mã)
  questionCount: number; courseId: string | null; courseName?: string | null;
  updatedAt: string; // máy chủ trả mốc 1970 khi đề chưa có nhật ký: giao diện hiện "—"
  extractedFrom?: { id: string; fileName: string } | null; // tệp đề gốc đã tách ra đề này
}
export const variantCountOf = (it: Pick<DeThiItem, "variants">): number => Array.isArray(it.variants) ? it.variants.length : Number(it.variants) || 0;
export const fetchDeThi = async (q: { lop?: string | null; trangThai?: string | null } = {}): Promise<ApiResult<DeThiItem[]>> => {
  const qs = [q.lop ? `lop=${encodeURIComponent(q.lop)}` : "", q.trangThai ? `trangThai=${encodeURIComponent(q.trangThai)}` : ""].filter(Boolean).join("&");
  const r = await qfetch<DeThiItem[] | { items?: DeThiItem[] }>("GET", `/api/tutor/de-thi${qs ? `?${qs}` : ""}`);
  return r.ok ? { ...r, data: unwrapList(r.data) } : { ...r, data: null };
};
/** Tên lớp (id → tên) để hiện cột Lớp: hợp đồng chỉ trả courseId. Dùng API có sẵn /api/tutor/bai-tap (cùng nguồn QuizNew). */
export async function fetchCourseNames(): Promise<{ id: string; name: string }[]> {
  const r = await qfetch<{ courses?: { id: string; name: string }[] }>("GET", "/api/tutor/bai-tap");
  return r.ok && Array.isArray(r.data?.courses) ? r.data!.courses! : [];
}

// ─── P2.2/P2.3 Ma trận đề ───────────────────────────────────────────────────────────────────────────────────────────────────────
export interface BlueprintRow { categoryId: string; difficulty: Level; count: number } // đúng ba khoá này
export interface Blueprint { id: string; name: string; rows: BlueprintRow[]; total?: number; updatedAt?: string }
/** Giới hạn Q5 (cùng số với máy chủ): ≤ 50 dòng, mỗi dòng 1..100 câu, tổng ≤ 200. */
export const BP_MAX_ROWS = 50, BP_MAX_PER_ROW = 100, BP_MAX_TOTAL = 200;
export const blueprintTotal = (rows: readonly BlueprintRow[]): number => rows.reduce((s, r) => s + r.count, 0);
/** Câu tiếng Việt nếu ma trận vượt giới hạn / rỗng; null nếu ổn. */
export function blueprintProblem(rows: readonly BlueprintRow[]): string | null {
  if (rows.length === 0) return "Cô nhập số câu vào ít nhất một ô của bảng.";
  if (rows.length > BP_MAX_ROWS) return `Ma trận tối đa ${BP_MAX_ROWS} dòng (mỗi ô có số câu là một dòng). Cô bớt bớt ô.`;
  if (rows.some(r => !Number.isInteger(r.count) || r.count < 1 || r.count > BP_MAX_PER_ROW)) return `Mỗi ô chỉ nhận từ 1 đến ${BP_MAX_PER_ROW} câu.`;
  if (blueprintTotal(rows) > BP_MAX_TOTAL) return `Một đề tối đa ${BP_MAX_TOTAL} câu; ma trận đang có ${blueprintTotal(rows)} câu.`;
  return null;
}

export const fetchBlueprints = async (): Promise<ApiResult<Blueprint[]>> => {
  const r = await qfetch<Blueprint[] | { items?: Blueprint[] }>("GET", "/api/tutor/de-thi/ma-tran");
  return r.ok ? { ...r, data: unwrapList(r.data) } : { ...r, data: null };
};
export const fetchBlueprint = (id: string) => qfetch<Blueprint>("GET", `/api/tutor/de-thi/ma-tran/${encodeURIComponent(id)}`);
export const createBlueprint = (name: string, rows: BlueprintRow[]) => qfetch<{ id: string }>("POST", "/api/tutor/de-thi/ma-tran", { name, rows });
export const updateBlueprint = (id: string, name: string, rows: BlueprintRow[]) => qfetch<unknown>("PUT", `/api/tutor/de-thi/ma-tran/${encodeURIComponent(id)}`, { name, rows });
export const deleteBlueprint = (id: string) => qfetch<unknown>("DELETE", `/api/tutor/de-thi/ma-tran/${encodeURIComponent(id)}`);

/** Một câu bốc được, nội dung rút gọn để xem. Hợp đồng ghi "kèm nội dung rút gọn" mà chưa nêu tên trường: mọi trường ngoài `id` là tuỳ chọn. */
export interface PickItem { id: string; text?: string; type?: QuizQuestionType; difficulty?: Level | null; categoryId?: string }
export interface Shortage { rowIndex: number; need: number; have: number; categoryId: string; difficulty: Level }
export interface RutRes { picks: { rowIndex: number; itemIds: string[]; items?: PickItem[] }[]; shortages: Shortage[]; seed: string }
export interface RutReq { rows: BlueprintRow[]; seed?: string; scope?: Scope; locked?: string[]; exclude?: string[] }
/** Chỉ xem trước, KHÔNG ghi. `rows` gửi lên là danh sách đã bỏ ô 0 câu, nên `rowIndex` trả về trỏ đúng vào danh sách này. */
export const rutCau = (req: RutReq) => qfetch<RutRes>("POST", "/api/tutor/de-thi/ma-tran/rut", req);
export interface DoiCauReq { rows: BlueprintRow[]; rowIndex: number; itemId: string; current: string[]; seed: string }
/** 409 code NO_ALTERNATIVE = không còn câu nào khác để đổi. `item` (nội dung rút gọn của câu mới) là điều mong muốn, chưa chắc có trong hợp đồng. */
export const doiCau = (req: DoiCauReq) => qfetch<{ itemId: string; item?: PickItem }>("POST", "/api/tutor/de-thi/ma-tran/doi-cau", req);
export interface TaoTuMaTranReq { title: string; courseId?: string | null; blueprintId?: string | null; itemIds: string[]; mode?: ExamMode; allowShort?: boolean }
/** 201 { examId }; 422 code SHORTAGE khi ma trận còn thiếu mà chưa gửi allowShort:true; 403 câu không thấy được; 404 câu không có. */
export const taoTuMaTran = (req: TaoTuMaTranReq) => qfetch<{ examId: string }>("POST", "/api/tutor/de-thi/tao-tu-ma-tran", req);

// ─── P2.3 Mã đề  (GET/POST /api/tutor/de-thi/[id]/ma-de) ───────────────────────────────────────────────────────────────────────
export const MA_DE_MAX = 8, MA_DE_MIN = 2;
/** Cùng luật variantCode(no) = 100 + no của deThiVariants.ts (máy chủ): mã đề 101, 102… */
export const variantCodeOf = (no: number): number => 100 + no;
/** `count` = TỔNG số mã gồm cả đề gốc (2..8). `fixed` = vị trí câu giữ nguyên, ĐÁNH SỐ TỪ 1 (như "Câu 1"). Phải bật ít nhất một kiểu đảo (400 NOTHING_TO_SHUFFLE). */
export interface MaDeReq { count: number; shuffleQuestions: boolean; shuffleOptions: boolean; fixed: number[] }
export interface MaDeVariant { id?: string; variantNo: number; code?: number; questionCount?: number; warnings?: (string | { message?: string })[] }
export interface MaDeRes {
  variants: MaDeVariant[]; // gồm cả đề gốc (variantNo 1)
  /** Lưu ý khi đảo (vd. câu có "Cả A và B" không đảo phương án); cùng nội dung cho mọi mã. */
  warnings?: (string | { message?: string })[];
  hasVariants?: boolean;
  /** Cờ VARIANT_STUDENT_SUPPORT của máy chủ: false = phòng thi học sinh chưa làm được đề nhiều mã, chặn phát hành. */
  studentSupport?: boolean;
  questionCount?: number;
}
export const fetchMaDe = async (id: string): Promise<ApiResult<MaDeRes>> => {
  const r = await qfetch<MaDeRes | MaDeVariant[]>("GET", `/api/tutor/de-thi/${encodeURIComponent(id)}/ma-de`);
  if (!r.ok || !r.data) return { ...r, data: null };
  return { ...r, data: Array.isArray(r.data) ? { variants: r.data } : { ...r.data, variants: Array.isArray(r.data.variants) ? r.data.variants : [] } };
};
/** 400 IS_VARIANT khi id là mã đề con; 409/422 nếu đề gốc không còn nháp. Tạo lại = xoá con cũ, tạo mới trong một giao dịch. */
export const taoMaDe = (id: string, req: MaDeReq) => qfetch<unknown>("POST", `/api/tutor/de-thi/${encodeURIComponent(id)}/ma-de`, req);
export const warningText = (w: string | { message?: string }): string => typeof w === "string" ? w : w.message ?? "";
/** Mã lỗi của phát hành (quiz/[id]/publish, mục 6.2) đã biết lý do: giao diện nói rõ thay vì câu máy chủ chung chung. */
export const PUBLISH_BLOCK_TEXT: Record<string, string> = {
  FORMULA_UNREAD: "Còn câu có nhãn ⟦công thức⟧ chưa được gõ lại. Cô sửa các câu đó trong đề gốc rồi tạo lại mã đề.",
  VARIANTS_NOT_READY: "Phía học sinh chưa làm được đề nhiều mã (đang chờ bản cập nhật phòng thi). Cô vẫn soạn và lưu mã đề được, chỉ chưa phát hành.",
  VARIANTS_STALE: "Đề gốc đã được sửa sau khi tạo mã đề nên các mã con không còn khớp. Cô bấm “Tạo lại mã đề” rồi phát hành.",
  VARIANTS_ESSAY: "Đề nhiều mã chưa phát hành được khi đề có câu tự luận (màn chấm bài chưa gom bài của các mã đề). Cô phát hành đề một mã, hoặc tách phần tự luận ra đề riêng.",
};

// ─── P2.3 Tệp đề gốc  (POST …/tep-goc/[fileId]/tach|gan-de) ────────────────────────────────────────────────────────────────────
export const tachTepGoc = (fileId: string) => qfetch<AzotaParse>("POST", `/api/tutor/de-thi/tep-goc/${encodeURIComponent(fileId)}/tach`, {});
export const ganDe = (fileId: string, examId: string) => qfetch<unknown>("POST", `/api/tutor/de-thi/tep-goc/${encodeURIComponent(fileId)}/gan-de`, { examId });
export const isDocxFile = (f: { fileName: string; fileType?: string }): boolean => /\.docx$/i.test(f.fileName) || /wordprocessingml/.test(f.fileType ?? "");

// ─── Nhập Word vào ĐỀ NHÁP  (POST /api/tutor/quiz/import-save, có sẵn) ─────────────────────────────────────────────────────────────
/** Đổi câu đã rà soát thành đầu vào đề nháp: tổng 10 điểm chia đều (distributePoints). Câu thiếu đáp án vẫn lưu được vì là nháp (luật lỏng của import-save). */
export function toExamInputs(items: Parameters<typeof toBankInput>[0][]): QuizQuestionInput[] {
  const pts = distributePoints(10, items.length);
  return items.map((q, i) => ({ ...toBankInput(q), points: pts[i] }));
}
export interface ImportSaveReq { title: string; courseId?: string | null; fileName?: string; questions: QuizQuestionInput[] }
export const importSave = (req: ImportSaveReq) => qfetch<{ id: string }>("POST", "/api/tutor/quiz/import-save", req);

// ─── P3.2 Chế độ và mặc định theo bảng của đặc tả ────────────────────────────────────────────────────────────────────────────────
export type AnswerVisibility = "never" | "after_submit" | "after_exam_ends";
/** Mặc định khi chọn chế độ (bảng P3.2). Đề cũ (mode=null) giữ nguyên hành vi hiện tại, không áp bảng này. */
export const MODE_DEFAULTS: Record<ExamMode, { maxAttempts: number | null; answerVisibility: AnswerVisibility; hideAnswerForWrong: boolean; showLeaderboard: boolean; needSchedule: boolean }> = {
  practice: { maxAttempts: null, answerVisibility: "after_submit", hideAnswerForWrong: false, showLeaderboard: false, needSchedule: false },
  test: { maxAttempts: 1, answerVisibility: "after_exam_ends", hideAnswerForWrong: true, showLeaderboard: false, needSchedule: true },
};
export const MODE_BLURB: Record<ExamMode, string> = {
  practice: "Học sinh làm lúc nào cũng được, làm lại nhiều lần, xem đáp án ngay sau khi nộp.",
  test: "Có giờ mở và thời lượng cố định, mỗi em làm một lần, đáp án chỉ hiện khi hết giờ và ẩn đáp án đúng ở câu em làm sai.",
};
/** Ba mức xem điểm/đáp án của đặc tả + mức “hết giờ” (mặc định của chế độ Kiểm tra, vẫn là một giá trị của answerVisibility). */
export type ViewLevel = AnswerVisibility | "hold";
export const VIEW_LEVELS: { value: ViewLevel; label: string; hint: string }[] = [
  { value: "never", label: "Không cho xem", hint: "Học sinh không thấy điểm và đáp án trong KiN. Cô đọc điểm ở trang Kết quả." },
  { value: "after_submit", label: "Xem ngay sau khi nộp", hint: "Học sinh thấy điểm và đáp án ngay khi bấm nộp." },
  { value: "after_exam_ends", label: "Xem khi hết giờ làm bài", hint: "Em nộp sớm vẫn phải chờ đến hết giờ mới thấy đáp án, để không lộ đề cho bạn đang làm." },
  { value: "hold", label: "Giữ đến khi cô công bố", hint: "Học sinh chỉ thấy “đã nộp”. Điểm và đáp án hiện sau khi cô công bố ở trang Chấm." },
];
export const viewLevelOf = (c: Pick<GiaoCfg, "answerVisibility" | "holdUntilPublish">): ViewLevel => c.holdUntilPublish ? "hold" : c.answerVisibility;

// ─── P3.3 Giao đề  (GET/PATCH/POST /api/tutor/de-thi/[id]/giao) ────────────────────────────────────────────────────────────────────
export interface GiaoCfg {
  mode: ExamMode | null; courseId: string | null;
  dateKey: string | null; time: string | null; durationMin: number | null; // dateKey "YYYY-MM-DD", time "HH:mm"
  hasPassword: boolean; // KHÔNG BAO GIỜ có mật khẩu hay mã băm
  maxAttempts: number | null; answerVisibility: AnswerVisibility; hideAnswerForWrong: boolean; showLeaderboard: boolean; holdUntilPublish: boolean;
  status: string; variants: number | unknown[];
  /** Ngoài hợp đồng gốc (tut-code đã báo): số lượt làm của cả nhóm mã đề — để biết các khoá đang bị khoá. */
  attemptCount?: number;
}
export const fetchGiao = (id: string) => qfetch<GiaoCfg>("GET", `/api/tutor/de-thi/${encodeURIComponent(id)}/giao`);
/** Tập con các khoá của GiaoCfg + password (đặt chuỗi / xoá bằng null). 400 FORBIDDEN_FIELD nếu gửi price/activeGuest/guestCanTake — giao diện không bao giờ gửi. */
export type GiaoPatch = Partial<Pick<GiaoCfg, "mode" | "courseId" | "dateKey" | "time" | "durationMin" | "maxAttempts" | "answerVisibility" | "hideAnswerForWrong" | "showLeaderboard" | "holdUntilPublish">> & { password?: string | null };
/** 409 HAS_ATTEMPTS: đã có lượt làm → mode, courseId, durationMin bị khoá. 400 NEED_SCHEDULE: kiểm tra thiếu giờ. 403 NOT_YOUR_CLASS: lớp không phải của cô. */
export const patchGiao = (id: string, body: GiaoPatch) => qfetch<{ warnings?: (string | { message?: string })[] } | null>("PATCH", `/api/tutor/de-thi/${encodeURIComponent(id)}/giao`, body);
export const dongMoGiao = (id: string, action: "close" | "reopen") => qfetch<unknown>("POST", `/api/tutor/de-thi/${encodeURIComponent(id)}/giao`, { action });
/** Các khoá bị khoá khi đã có lượt làm (đặc tả P3.3). */
export const LOCKED_WHEN_ATTEMPTS = ["mode", "courseId", "durationMin"] as const;
export const GIAO_ERROR_TEXT: Record<string, string> = {
  HAS_ATTEMPTS: "Đã có học sinh làm bài nên cô không đổi được chế độ, lớp và thời lượng. Các mục còn lại vẫn sửa được.",
  NEED_SCHEDULE: "Bài kiểm tra cần có ngày, giờ mở và thời lượng.",
  NOT_YOUR_CLASS: "Lớp này không phải của cô.",
  FORBIDDEN_FIELD: "Đề của gia sư không đặt giá hay mở cho khách.",
};
/** Kiểm trước khi gửi (cùng ý với validateAssignPatch của máy chủ, máy chủ vẫn là nơi quyết định). Trả câu tiếng Việt hoặc null. */
export function giaoProblem(c: Pick<GiaoCfg, "mode" | "dateKey" | "time" | "durationMin" | "maxAttempts">): string | null {
  if (c.mode && MODE_DEFAULTS[c.mode].needSchedule && (!c.dateKey || !c.time || !c.durationMin)) return "Bài kiểm tra cần có ngày, giờ mở và thời lượng.";
  if (c.durationMin != null && (!Number.isInteger(c.durationMin) || c.durationMin < 1 || c.durationMin > 300)) return "Thời lượng từ 1 đến 300 phút.";
  if (c.maxAttempts != null && (!Number.isInteger(c.maxAttempts) || c.maxAttempts < 1 || c.maxAttempts > 20)) return "Số lần làm từ 1 đến 20, hoặc để không giới hạn.";
  return null;
}
export const deThiKetQuaHref = (id: string) => deThiSubHref(id, "ket-qua");

// ─── P3.3 Kết quả  (GET …/ket-qua · …/ket-qua/bang-diem · …/ket-qua/xuat-xlsx) ───────────────────────────────────────────────────
export interface KetQua {
  basic: { attempts: number; students: number; avg: number | null; median: number | null; max: number | null; min: number | null; passRate: number | null; avgDurationSec: number | null };
  distribution: { label: string; count: number }[]; // 5 khoảng: 0–<20% … 80–100%
  frequency: { score: number; count: number }[];    // bước 0,5 trên thang 10
  questions: { order: number; variantKey: string; correctRate: number; answered: number; avgSec: number | null; flagged: boolean }[];
  variants: { variantNo: number; code: number; attempts: number; avg: number | null }[];
}
export type Chon = "dau" | "cuoi" | "cao-nhat";
export const CHON_LABEL: Record<Chon, string> = { dau: "Lần làm đầu tiên", cuoi: "Lần làm cuối cùng", "cao-nhat": "Lần điểm cao nhất" };
export interface BangDiemRow { attemptId: string; studentName: string; email?: string; score: number | null; submittedAt: string | null; durationSec: number | null; variantNo: number | null; tabSwitchCount: number }
export const fetchKetQua = (id: string) => qfetch<KetQua>("GET", `/api/tutor/de-thi/${encodeURIComponent(id)}/ket-qua`);
export const fetchBangDiem = (id: string, chon: Chon) => qfetch<{ rows: BangDiemRow[] }>("GET", `/api/tutor/de-thi/${encodeURIComponent(id)}/ket-qua/bang-diem?chon=${chon}`);
export const xuatXlsxHref = (id: string, chon: Chon) => `/api/tutor/de-thi/${encodeURIComponent(id)}/ket-qua/xuat-xlsx?chon=${chon}`;
/** Định dạng số kiểu Việt: dấu phẩy thập phân, tối đa một chữ số. */
export const fmtNum = (n: number | null | undefined, digits = 1): string => n == null || !Number.isFinite(n) ? "—" : n.toLocaleString("vi-VN", { maximumFractionDigits: digits });
/** passRate và correctRate máy chủ trả TỈ LỆ 0–1. */
export const fmtPct = (n: number | null | undefined): string => n == null || !Number.isFinite(n) ? "—" : `${Math.round(n * 100)}%`;
export const fmtDur = (sec: number | null | undefined): string => sec == null || !Number.isFinite(sec) ? "—" : sec >= 3600 ? `${Math.floor(sec / 3600)} giờ ${Math.round((sec % 3600) / 60)} phút` : sec >= 60 ? `${Math.floor(sec / 60)} phút ${Math.round(sec % 60)} giây` : `${Math.round(sec)} giây`;
