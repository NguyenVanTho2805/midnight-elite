// Link trong cột Lesson.videoUrl / zoomUrl / azotaUrl: MỘT đường dẫn thường, hoặc chuỗi JSON của MẢNG đường dẫn khi bài có nhiều link
// (admin lưu bằng serializeUrls ở trang sửa lớp). Dùng chuỗi JSON thẳng làm href là lỗi: bài có 2 link Azota cho ra liên kết hỏng.

/** Tách thành danh sách đường dẫn; bỏ ô trống, trùng lặp. Không kiểm scheme (xem httpLinks). */
export function parseLinkList(raw: string | null | undefined): string[] {
  if (typeof raw !== "string") return [];
  const s = raw.trim();
  if (!s) return [];
  let items: unknown[] = [s];
  if (s.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(s);
      if (Array.isArray(parsed)) items = parsed;
    } catch { /* chuỗi thường bắt đầu bằng "[" — coi như một link */ }
  }
  const out: string[] = [];
  for (const it of items) {
    if (typeof it !== "string") continue;
    const v = it.trim();
    if (v && !out.includes(v)) out.push(v);
  }
  return out;
}

const HTTP_RE = /^https?:\/\/[^\s]+$/i;

/** Chỉ giữ http/https — không bao giờ đưa `javascript:` hay `data:` do gia sư nhập vào thuộc tính href. */
export function httpLinks(raw: string | null | undefined): string[] {
  return parseLinkList(raw).filter(u => HTTP_RE.test(u));
}

/** Link đầu tiên dùng được, hoặc null. */
export function firstHttpLink(raw: string | null | undefined): string | null {
  return httpLinks(raw)[0] ?? null;
}
