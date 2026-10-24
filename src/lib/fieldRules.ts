// HT-02 — luật kiểm tra dữ liệu tại chỗ khi nhập (thuần, không React) để dùng chung cho mọi biểu mẫu và để test.
// Quy ước: luật trả về câu báo lỗi tiếng Việt, hoặc null nếu ổn. Luật "định dạng" (email, số điện thoại…) bỏ qua ô trống — ô trống do `required` báo.
// Đây CHỈ là lớp báo sớm cho người nhập; máy chủ vẫn kiểm lại và là nguồn quyết định. KHÔNG đưa nội dung ô (mật khẩu, tên, SĐT) vào log hay thông báo lỗi.
export type FieldRule = (value: string) => string | null;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Số di động Việt Nam 10 số (đầu 03/05/07/08/09), cho phép dấu cách. Cùng quy tắc trang đăng ký hiện có.
const PHONE_RE = /^0[35789][0-9]{8}$/;

export const required = (msg: string): FieldRule => v => (v.trim() === "" ? msg : null);
export const email = (msg = "Email chưa đúng dạng, ví dụ ten@gmail.com"): FieldRule => v => (v.trim() === "" || EMAIL_RE.test(v.trim()) ? null : msg);
export const phoneVn = (msg = "Số điện thoại chưa hợp lệ, ví dụ 0901234567"): FieldRule => v => (v.trim() === "" || PHONE_RE.test(v.replace(/\s/g, "")) ? null : msg);
export const minLength = (n: number, msg?: string): FieldRule => v => (v === "" || v.trim().length >= n ? null : msg ?? `Cần ít nhất ${n} ký tự`);
export const maxLength = (n: number, msg?: string): FieldRule => v => (v.length <= n ? null : msg ?? `Tối đa ${n} ký tự`);
export const matches = (other: () => string, msg: string): FieldRule => v => (v === "" || v === other() ? null : msg);

/** Câu báo lỗi đầu tiên theo thứ tự luật, hoặc null. */
export function firstError(value: string, rules: readonly FieldRule[]): string | null {
  for (const r of rules) { const m = r(value); if (m) return m; }
  return null;
}

/** Kiểm cả biểu mẫu: trả về { tênÔ: câu lỗi } chỉ gồm ô có lỗi. */
export function validateAll(values: Record<string, string>, rules: Record<string, readonly FieldRule[]>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of Object.keys(rules)) { const m = firstError(values[k] ?? "", rules[k]); if (m) out[k] = m; }
  return out;
}
