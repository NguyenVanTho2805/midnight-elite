// LOI-04 mục 4.0 — gọi API Nhắc học từ trình duyệt: fetch JSON + AbortController 15 giây. KHÔNG BAO GIỜ ném lỗi, KHÔNG báo thành công giả:
// trả { ok: true, data } chỉ khi máy chủ trả 2xx kèm thân JSON hợp lệ; còn lại { ok: false, status, error } với câu tiếng Việt hiện được tại chỗ.
// 4xx ⇒ dùng nguyên câu máy chủ (vd "Đã đủ 500 nhắc việc…"); 5xx / thân hỏng / mạng / hết giờ ⇒ câu chung. Không log gì ra console (ghi chú là dữ liệu riêng).
export const NHAC_TIMEOUT_MS = 15_000;
export const NHAC_API = "/api/student/nhac-hoc";

export type NhacApiResult<T> = { ok: true; status: number; data: T } | { ok: false; status: number; error: string };

export async function nhacFetch<T>(path: string, init: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown } = {}): Promise<NhacApiResult<T>> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), NHAC_TIMEOUT_MS);
  const write = (init.method ?? "GET") !== "GET";
  try {
    const res = await fetch(path, {
      method: init.method ?? "GET",
      credentials: "same-origin",
      cache: "no-store",
      signal: ctl.signal,
      headers: init.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
    const d: unknown = await res.json().catch(() => null);
    const serverMsg = d && typeof d === "object" && typeof (d as { error?: unknown }).error === "string" ? (d as { error: string }).error : "";
    if (!res.ok) {
      const error = res.status >= 400 && res.status < 500 && serverMsg ? serverMsg : write ? "Chưa lưu được, thử lại nhé." : "Không tải được, thử lại nhé.";
      return { ok: false, status: res.status, error };
    }
    if (d === null || typeof d !== "object") return { ok: false, status: res.status, error: write ? "Chưa lưu được, thử lại nhé." : "Không tải được, thử lại nhé." };
    return { ok: true, status: res.status, data: d as T };
  } catch {
    const timeout = ctl.signal.aborted;
    const error = timeout
      ? (write ? "Mạng chậm quá, chưa lưu được. Thử lại nhé." : "Mạng chậm quá, chưa tải được. Thử lại nhé.")
      : (write ? "Chưa lưu được, kiểm tra mạng rồi thử lại nhé." : "Chưa tải được, kiểm tra mạng rồi thử lại nhé.");
    return { ok: false, status: 0, error };
  } finally {
    clearTimeout(timer);
  }
}
