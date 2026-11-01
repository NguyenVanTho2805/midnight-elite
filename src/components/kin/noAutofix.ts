// Ô email / mật khẩu / tài khoản: bàn phím điện thoại KHÔNG được tự viết hoa, tự sửa chữ, hay gạch chân chính tả (01/11/2026).
//
// Vì sao: nút "Hiện mật khẩu" đổi ô từ type="password" sang type="text". Ô text trên iPhone / Android mặc định viết hoa chữ đầu và tự sửa chữ, nên người
// đăng ký bấm "Hiện", gõ `uyen2005` mà máy lưu `Uyen2005`; đăng nhập lại với ô ẩn thì gõ đúng `uyen2005` và bị báo sai (ô "nhập lại" cũng bị viết hoa y hệt
// nên vẫn khớp lúc đăng ký). Chặn ngay ở ô, không sửa máy chủ: mật khẩu phải phân biệt hoa / thường.
//
// Tệp riêng, không "use client": hằng số trong module "use client" không dùng được ở nơi khác (bài học BU-00 với kinButtonClass).
// KinInput tự áp cho ô mật khẩu / email / tài khoản; <input> thô thì rải `{...NO_AUTOFIX}`. Kiểm: tools/local-e2e/t-auth-input-attrs, ui-auth-input-attrs.
export const NO_AUTOFIX = { autoCapitalize: "off", autoCorrect: "off", spellCheck: false } as const;

const CREDENTIAL_AUTOCOMPLETE = new Set(["new-password", "current-password", "username", "email"]);

/** Ô này là thông tin đăng nhập (mật khẩu / email / tài khoản)? Xét CẢ `autoComplete`, không chỉ `type`: ô mật khẩu đang ở chế độ "Hiện" mang type="text". */
export function isCredentialField(type?: string, autoComplete?: string): boolean {
  if (type === "password" || type === "email") return true;
  return (autoComplete ?? "").toLowerCase().split(/\s+/).some(t => CREDENTIAL_AUTOCOMPLETE.has(t));
}
