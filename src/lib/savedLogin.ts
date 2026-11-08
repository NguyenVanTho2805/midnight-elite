// Tự động đăng nhập bằng thông tin mà TRÌNH DUYỆT đã lưu (Credential Management API) — kiểu "trình quản lý mật khẩu".
//
// KiN KHÔNG giữ mật khẩu ở bất cứ đâu (không localStorage, không cookie, không DB): chỉ nhờ trình duyệt/Trình quản lý mật khẩu của máy cất giúp, và hỏi lại nó
// lúc mở trang đăng nhập. Ba việc:
//   rememberLogin     — sau một lần đăng nhập mật khẩu THỦ CÔNG thành công: nhờ trình duyệt lưu (nó tự hỏi người dùng có lưu không).
//   readSavedLogin    — lúc mở /dang-nhap: xin lại thông tin đã lưu, KHÔNG hiện hộp chọn (mediation "silent"). Chỉ có kết quả khi người dùng đã cho trình duyệt
//                       tự đăng nhập, chỉ có đúng một tài khoản lưu cho trang này, và họ chưa đăng xuất cố ý từ lần đăng nhập thủ công gần nhất.
//   forgetSilentAccess — khi đăng xuất / khi thông tin đã lưu hết đúng: bảo trình duyệt đừng tự đưa lại cho tới khi người dùng đăng nhập thủ công lần nữa.
// Trình duyệt không có PasswordCredential (Firefox, Safari): mọi hàm là không-làm-gì; đăng nhập thủ công và gợi ý tự điền của trình duyệt vẫn như cũ.
// Mọi lỗi của API này đều bị nuốt: tính năng tiện lợi không bao giờ được làm hỏng đường đăng nhập chính.

export interface SavedLogin { id: string; password: string }

/** Phần của môi trường trình duyệt mà module dùng — để test thay bằng đồ giả. */
export interface CredentialEnv {
  navigator?: { credentials?: {
    get?: (options: unknown) => Promise<unknown>;
    store?: (credential: unknown) => Promise<unknown>;
    preventSilentAccess?: () => Promise<unknown>;
  } };
  PasswordCredential?: new (data: { id: string; password: string; name?: string }) => unknown;
}

const browserEnv = (): CredentialEnv => globalThis as unknown as CredentialEnv;

export function savedLoginSupported(env: CredentialEnv = browserEnv()): boolean {
  return typeof env.PasswordCredential === "function" && typeof env.navigator?.credentials?.get === "function";
}

/** Thông tin đã lưu (nếu trình duyệt đưa không cần hỏi), hoặc null. Không bao giờ ném lỗi, không bao giờ treo chờ người dùng. */
export async function readSavedLogin(env: CredentialEnv = browserEnv()): Promise<SavedLogin | null> {
  if (!savedLoginSupported(env)) return null;
  try {
    const c = await env.navigator!.credentials!.get!({ password: true, mediation: "silent" }) as
      { type?: unknown; id?: unknown; password?: unknown } | null | undefined;
    if (!c || c.type !== "password") return null;
    if (typeof c.id !== "string" || typeof c.password !== "string" || c.id.trim() === "" || c.password === "") return null;
    return { id: c.id, password: c.password };
  } catch {
    return null;
  }
}

/** Nhờ trình duyệt lưu cặp tài khoản + mật khẩu vừa đăng nhập đúng. Trình duyệt tự hỏi người dùng; không lưu gì phía KiN. */
export async function rememberLogin(id: string, password: string, env: CredentialEnv = browserEnv()): Promise<void> {
  if (!savedLoginSupported(env) || typeof env.navigator?.credentials?.store !== "function") return;
  if (id.trim() === "" || password === "") return;
  try {
    await env.navigator.credentials.store(new env.PasswordCredential!({ id, password }));
  } catch {
    /* trình duyệt từ chối (chế độ ẩn danh, bị chặn…): bỏ qua */
  }
}

/** Đừng tự đăng nhập bằng thông tin đã lưu nữa, cho tới khi người dùng đăng nhập thủ công lại. */
export async function forgetSilentAccess(env: CredentialEnv = browserEnv()): Promise<void> {
  if (typeof env.navigator?.credentials?.preventSilentAccess !== "function") return;
  try {
    await env.navigator.credentials.preventSilentAccess();
  } catch {
    /* bỏ qua */
  }
}

/** Mã mà /api/auth/login trả khi bị gọi với `auto: true` mà tài khoản là quản trị (xem route). */
export const AUTO_NOT_ALLOWED = "auto_not_allowed";
