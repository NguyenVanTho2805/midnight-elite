// BU-HS-NOP-TEP — phần gọi mạng của khối nộp tệp (dùng chung cho học sinh và gia sư trả bài). Không có giao diện ở đây.
// Luồng một tệp: kiểm sơ bộ ngay trên trình duyệt (chỉ để báo sớm, máy chủ vẫn kiểm lại) → POST init → gửi byte (XHR có tiến độ, thẳng lên kho
// hoặc PUT về máy chủ khi chạy cục bộ) → POST complete (máy chủ đo dung lượng thật + soi nội dung). Không bao giờ ghi tên tệp vào log hay thông điệp lỗi.
// Mốc giờ (nộp lúc, hết hạn) luôn do máy chủ trả về; ở đây chỉ ĐỊNH DẠNG theo giờ Việt Nam, không tự tính hạn.
import {
  NOP_TEP_API, NOP_TEP_MAX_BYTES, NOP_TEP_MAX_FILES, NOP_TEP_MSG_OFF, NOP_TEP_MSG_TOO_MANY, NOP_TEP_RETENTION_DAYS, validateNopTepRequest,
  type NopTepFileJson, type NopTepLimits,
} from "@/lib/nopTep";

export type NopTepMode = "student" | "tutor_return";
export const NOP_TEP_BASE = "/api/media/nop-bai";

export type NopTepScope =
  | { mode: "student"; assignmentId: string }
  | { mode: "tutor_return"; assignmentId: string; submissionId: string };

/** Dạng một tệp trả ra từ API (nopTep.ts, mục 3.4 của đặc tả). `submitted` = đã gắn vào bài nộp / bài trả; false = bản nháp đang chuẩn bị. */
export type NopTepFileView = NopTepFileJson;
export type { NopTepLimits };
export interface NopTepList {
  enabled: boolean; reason: string | null; limits: NopTepLimits; files: NopTepFileView[];
  /** Chỉ học sinh: mốc nộp do MÁY CHỦ đặt + đã chấm hay chưa. */
  submission: { submittedAt: string; graded: boolean } | null;
}

const DEFAULT_LIMITS: NopTepLimits = { maxBytes: NOP_TEP_MAX_BYTES, maxFiles: NOP_TEP_MAX_FILES, exts: ["docx", "pdf"], retentionDays: NOP_TEP_RETENTION_DAYS };

const num = (v: unknown, d: number): number => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : d);
const str = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);

function normaliseFile(raw: unknown): NopTepFileView | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.href !== "string") return null;
  return {
    id: r.id, kind: r.kind === "tutor_return" ? "tutor_return" : "student", name: str(r.name, "Tệp"), ext: str(r.ext).toLowerCase(),
    sizeBytes: typeof r.sizeBytes === "number" ? r.sizeBytes : null,
    status: (["pending", "ready", "removed", "expired"].includes(str(r.status)) ? str(r.status) : "ready") as NopTepFileView["status"],
    createdAt: str(r.createdAt), expiresAt: str(r.expiresAt), expired: r.expired === true, submitted: r.submitted === true, href: r.href,
  };
}

export async function loadNopTepList(scope: NopTepScope): Promise<{ ok: true; data: NopTepList } | { ok: false; status: number }> {
  const q = scope.mode === "student" ? `assignmentId=${encodeURIComponent(scope.assignmentId)}` : `submissionId=${encodeURIComponent(scope.submissionId)}`;
  try {
    const r = await fetch(`${NOP_TEP_API.list}?${q}`, { credentials: "same-origin", cache: "no-store" });
    if (!r.ok) return { ok: false, status: r.status };
    const j = await r.json().catch(() => null) as Record<string, unknown> | null;
    if (!j || typeof j !== "object") return { ok: false, status: 500 };
    const lim = (j.limits ?? {}) as Record<string, unknown>;
    const sub = (j.submission ?? null) as Record<string, unknown> | null;
    const files = Array.isArray(j.files) ? j.files.map(normaliseFile).filter((f): f is NopTepFileView => f !== null) : [];
    return {
      ok: true,
      data: {
        enabled: j.enabled === true,
        reason: typeof j.reason === "string" ? j.reason : null,
        limits: { maxBytes: num(lim.maxBytes, DEFAULT_LIMITS.maxBytes), maxFiles: num(lim.maxFiles, DEFAULT_LIMITS.maxFiles), exts: DEFAULT_LIMITS.exts, retentionDays: num(lim.retentionDays ?? j.retentionDays, DEFAULT_LIMITS.retentionDays) },
        files,
        submission: sub && typeof sub.submittedAt === "string" ? { submittedAt: sub.submittedAt, graded: sub.graded === true } : null,
      },
    };
  } catch { return { ok: false, status: 0 }; }
}

// ── Kiểm sơ bộ + lời nhắn lỗi ─────────────────────────────────────────────────
// Câu lỗi nội dung/đuôi lấy từ nopTep.ts (NOP_TEP_ERRORS) để trình duyệt và máy chủ nói CÙNG một câu; ở đây chỉ thêm câu về mạng/phiên/quyền.
const MSG = {
  too_many: NOP_TEP_MSG_TOO_MANY,
  too_big: "Tệp lớn hơn 10 MB. Hãy nén ảnh trong bài hoặc chia nhỏ tệp.",
  network: "Không tải lên được. Kiểm tra mạng rồi bấm Thử lại.",
  disabled: NOP_TEP_MSG_OFF,
  rate: "Bạn thao tác hơi nhanh, đợi một chút.",
  auth: "Phiên đăng nhập đã hết. Hãy đăng nhập lại rồi chọn tệp.",
  forbidden: "Bạn không có quyền gửi tệp cho bài này.",
  server: "Máy chủ đang bận. Bấm Thử lại sau ít phút.",
  rejected: "Tệp này chưa dùng được. Hãy chọn tệp Word hoặc PDF khác.",
} as const;
export const NOP_TEP_MSG = MSG;

export type NopTepFailKind = "network" | "disabled" | "rate" | "auth" | "forbidden" | "server" | "rejected" | "too_many" | "invalid";
export interface NopTepFail { ok: false; kind: NopTepFailKind; message: string; retryable: boolean; aborted?: boolean }

/** Báo sớm trên trình duyệt. Không thay máy chủ: chỉ để người dùng khỏi chờ khi tệp rõ ràng sai. */
export function preflightNopTep(file: { name: string; size: number; type: string }, limits: NopTepLimits): NopTepFail | null {
  const res = validateNopTepRequest({ name: file.name, size: file.size, type: file.type }, { maxBytes: limits.maxBytes });
  return res.ok ? null : { ok: false, kind: "invalid", message: res.error, retryable: false };
}

function failFrom(status: number, body: Record<string, unknown>): NopTepFail {
  const serverMsg = typeof body.error === "string" && body.error.trim() ? body.error.trim() : "";
  if (status === 0) return { ok: false, kind: "network", message: MSG.network, retryable: true };
  if (status === 401) return { ok: false, kind: "auth", message: MSG.auth, retryable: false };
  if (status === 409) {
    if (body.code === "too_many") return { ok: false, kind: "too_many", message: MSG.too_many, retryable: false };
    if (typeof body.reason === "string") return { ok: false, kind: "disabled", message: MSG.disabled, retryable: false }; // cấu hình tắt (init trả kèm `reason`)
    return { ok: false, kind: "server", message: serverMsg || MSG.server, retryable: true }; // vd "Hãy tải lại": bấm Thử lại chạy lại cả ba bước
  }
  if (status === 429) return { ok: false, kind: "rate", message: MSG.rate, retryable: true };
  if (status === 413) return { ok: false, kind: "rejected", message: MSG.too_big, retryable: false };
  if (status === 403 || status === 404) return { ok: false, kind: "forbidden", message: serverMsg || MSG.forbidden, retryable: false };
  if (status >= 500) return { ok: false, kind: "server", message: MSG.server, retryable: true };
  return { ok: false, kind: "rejected", message: serverMsg || MSG.rejected, retryable: false };
}

async function postJson(url: string, body: unknown): Promise<{ status: number; ok: boolean; json: Record<string, unknown> }> {
  try {
    const r = await fetch(url, { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await r.json().catch(() => ({})) as Record<string, unknown>;
    return { status: r.status, ok: r.ok, json: json && typeof json === "object" ? json : {} };
  } catch { return { status: 0, ok: false, json: {} }; }
}

// ── Gửi byte có tiến độ ──────────────────────────────────────────────────────
function sendWithProgress(method: "PUT" | "POST", url: string, file: File, fields: Record<string, string> | undefined, onPct: (p: number) => void, setAbort: (f: () => void) => void): Promise<{ ok: boolean; status: number; aborted?: boolean }> {
  return new Promise(resolve => {
    const x = new XMLHttpRequest();
    x.open(method, url);
    if (method === "PUT") { x.withCredentials = true; x.setRequestHeader("Content-Type", file.type || "application/octet-stream"); }
    x.upload.onprogress = e => { if (e.lengthComputable && e.total > 0) onPct(Math.min(100, Math.round((e.loaded / e.total) * 100))); };
    x.onload = () => resolve({ ok: x.status >= 200 && x.status < 300, status: x.status });
    x.onerror = () => resolve({ ok: false, status: 0 });
    x.onabort = () => resolve({ ok: false, status: 0, aborted: true });
    setAbort(() => x.abort());
    if (method === "POST") { const fd = new FormData(); Object.entries(fields ?? {}).forEach(([k, v]) => fd.append(k, v)); fd.append("file", file); x.send(fd); }
    else x.send(file);
  });
}

export type NopTepStage = "init" | "upload" | "check";
export interface NopTepUploadHooks {
  onStage: (s: NopTepStage) => void;
  onProgress: (pct: number) => void;
  setAbort: (f: () => void) => void;
}

/** init → tải byte → complete. Thành công trả `fileId` (tệp đã `ready`). Lỗi trả thông điệp tiếng Việt, không có tên tệp. */
export async function uploadNopTepFile(file: File, scope: NopTepScope, hooks: NopTepUploadHooks): Promise<{ ok: true; fileId: string } | NopTepFail> {
  hooks.onStage("init");
  const initBody: Record<string, unknown> = { kind: scope.mode, assignmentId: scope.assignmentId, name: file.name, size: file.size, type: file.type };
  if (scope.mode === "tutor_return") initBody.submissionId = scope.submissionId;
  const init = await postJson(NOP_TEP_API.init, initBody);
  if (!init.ok) return failFrom(init.status, init.json);
  const fileId = typeof init.json.fileId === "string" ? init.json.fileId : "";
  const up = init.json.upload as { method?: "PUT" | "POST"; url?: string; fields?: Record<string, string> } | undefined;
  if (!fileId || !up || typeof up.url !== "string") return { ok: false, kind: "server", message: MSG.server, retryable: true };

  hooks.onStage("upload");
  hooks.onProgress(0);
  const sent = await sendWithProgress(up.method === "PUT" ? "PUT" : "POST", up.url, file, up.fields, hooks.onProgress, hooks.setAbort);
  if (sent.aborted) return { ok: false, kind: "network", message: MSG.network, retryable: true, aborted: true };
  if (!sent.ok) {
    void removeNopTepFile(fileId); // dọn hàng đang chờ, không cần đợi
    // Kho từ chối (vd quá trần dung lượng của gói) ⇒ báo như lỗi mạng cho người dùng thử lại; máy chủ KiN vẫn là nơi quyết định cuối ở bước complete.
    return sent.status === 413 ? { ok: false, kind: "rejected", message: MSG.too_big, retryable: false } : failFrom(sent.status, {});
  }
  hooks.onProgress(100);

  hooks.onStage("check");
  const done = await postJson(NOP_TEP_API.complete, { fileId });
  if (!done.ok) return failFrom(done.status, done.json);
  return { ok: true, fileId };
}

export async function removeNopTepFile(fileId: string): Promise<{ ok: boolean; status: number; message?: string }> {
  const r = await postJson(NOP_TEP_API.remove(fileId), {});
  return { ok: r.ok, status: r.status, message: typeof r.json.error === "string" ? r.json.error : undefined };
}

/** Gia sư gắn tệp trả bài (đã ready) vào bài nộp — gọi SAU khi chấm điểm. */
export async function attachNopTepReturn(submissionId: string, fileIds: string[]): Promise<{ ok: boolean; status: number }> {
  const r = await postJson(NOP_TEP_API.attach, { submissionId, fileIds });
  return { ok: r.ok, status: r.status };
}

// ── Định dạng hiển thị ───────────────────────────────────────────────────────
export function formatBytes(n: number | null | undefined): string {
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

const VN_FMT = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
function vnParts(iso: string): { d: string; m: string; y: string; hh: string; mm: string } | null {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return null;
  const p: Record<string, string> = {};
  for (const part of VN_FMT.formatToParts(t)) p[part.type] = part.value;
  return { d: p.day, m: p.month, y: p.year, hh: p.hour, mm: p.minute };
}
/** "09/11/2026" theo giờ Việt Nam. */
export function formatVnDate(iso: string): string { const p = vnParts(iso); return p ? `${p.d}/${p.m}/${p.y}` : ""; }
/** "20:41 ngày 09/11/2026" theo giờ Việt Nam. */
export function formatVnStamp(iso: string): string { const p = vnParts(iso); return p ? `${p.hh}:${p.mm} ngày ${p.d}/${p.m}/${p.y}` : ""; }

/** Tách "Ten bai.docx" thành phần tên và đuôi để cắt GIỮA tên mà vẫn thấy đuôi. */
export function splitName(name: string): { stem: string; ext: string } {
  const i = name.lastIndexOf(".");
  return i > 0 ? { stem: name.slice(0, i), ext: name.slice(i) } : { stem: name, ext: "" };
}
