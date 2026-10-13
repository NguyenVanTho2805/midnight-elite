// Địa chỉ quay lại sau đăng nhập (?redirect=…). Chỉ nhận đường dẫn NỘI BỘ: bắt đầu bằng một dấu "/" và không phải "//host" hay "/\host"
// (trình duyệt hiểu cả hai là địa chỉ ngoài → kẻ xấu dựng link đăng nhập đẩy người dùng sang trang giả mạo sau khi họ vừa nhập mã).
export function safeRedirect(raw: string | null | undefined): string | null {
  if (!raw || raw.length > 2000) return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return null;
  if (/[\u0000-\u001f\u007f]/.test(raw)) return null;
  return raw;
}
