// Địa chỉ quay lại sau đăng nhập (?redirect=…). Chỉ nhận đường dẫn NỘI BỘ: bắt đầu bằng một dấu "/" và không phải "//host" hay "/\host"
// (trình duyệt hiểu cả hai là địa chỉ ngoài → kẻ xấu dựng link đăng nhập đẩy người dùng sang trang giả mạo sau khi họ vừa nhập mã).
export function safeRedirect(raw: string | null | undefined): string | null {
  if (!raw || raw.length > 2000) return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return null;
  if (/[\u0000-\u001f\u007f]/.test(raw)) return null;
  return raw;
}

/** SCL P1-5 (21/11/2026): trang đăng nhập / đăng ký mở sẵn vai nào. Đang định vào khu học sinh (/student…) hoặc cầm link mời (?code=) ⇒ "hoc-sinh",
 *  để học sinh mới không bị đẩy sang tab và biểu mẫu gia sư rồi mất lối nhập mã. `vai` ghi rõ trên địa chỉ thì theo `vai`. */
export function loginVaiFor(vai: string | null | undefined, redirect: string | null | undefined): "hoc-sinh" | "gia-su" {
  if (vai === "hoc-sinh" || vai === "gia-su") return vai;
  const r = safeRedirect(redirect);
  if (!r) return "gia-su";
  const [path, query = ""] = r.split("?");
  return path === "/student" || path.startsWith("/student/") || /(^|&)code=/.test(query) ? "hoc-sinh" : "gia-su";
}

/** Ô nhập mã lớp (nút "Tôi có mã mời vào lớp"). */
export const INVITE_ENTRY = "/student/nhap-ma-lop";
export const isInviteEntry = (r: string | null) => !!r && (r === INVITE_ENTRY || r.startsWith(`${INVITE_ENTRY}?`));
