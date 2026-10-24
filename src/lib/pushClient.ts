// ĐX-02 — phần THUẦN của trang Cài đặt → "Thông báo đẩy" (chạy ở trình duyệt): quyết định hiện trạng thái nào, chuyển khoá VAPID, nhận ra iPhone.
// Tách ra để test từng ca không cần trình duyệt thật. Phần gọi API và Notification / PushManager ở src/components/tutor/PushSettings.tsx.

export type PushUiState =
  | "unsupported"   // trình duyệt không có Service Worker / Push / Notification (và không phải iPhone chưa cài vào Màn hình chính)
  | "ios-install"   // iPhone / iPad dùng trong Safari thường: chưa "Thêm vào Màn hình chính" nên chưa có Push
  | "server-off"    // hệ thống không được phép gửi (chưa bật, bản xem trước, thiếu khoá) — không cho bật
  | "blocked"       // người dùng đã chặn thông báo của KiN trong trình duyệt
  | "off"           // chưa bật trên máy này
  | "on";           // đã bật trên máy này (trình duyệt có đăng ký VÀ máy chủ nhớ đăng ký đó)

export interface PushUiInput {
  /** Có `serviceWorker`, `PushManager` và `Notification`. */
  supported: boolean;
  ios: boolean;
  /** Đang chạy từ biểu tượng ở Màn hình chính (display-mode: standalone). */
  standalone: boolean;
  serverEnabled: boolean;
  permission: "default" | "granted" | "denied";
  /** Trình duyệt này đang có một đăng ký đẩy. */
  localSub: boolean;
  /** Máy chủ có ghi nhận đúng đăng ký đó cho tài khoản này. */
  mineOnServer: boolean;
}

/**
 * Thứ tự ưu tiên: thiếu hỗ trợ → (iPhone chưa cài thì hướng dẫn cài) → hệ thống tắt → bị chặn → đang bật / chưa bật.
 * "Đang bật" cần CẢ hai phía: nếu trình duyệt còn đăng ký mà máy chủ không còn (đã bị gỡ từ máy khác, hoặc dịch vụ đẩy báo chết) thì coi như CHƯA bật
 * để người dùng bấm bật lại, thay vì hiện "đã bật" mà không nhận được gì.
 */
export function pushUiState(i: PushUiInput): PushUiState {
  if (!i.supported) return i.ios && !i.standalone ? "ios-install" : "unsupported";
  if (!i.serverEnabled) return "server-off";
  if (i.permission === "denied") return "blocked";
  return i.localSub && i.mineOnServer && i.permission === "granted" ? "on" : "off";
}

/** iPhone / iPad. iPadOS 13+ tự xưng là Macintosh nhưng có màn hình cảm ứng nhiều điểm. */
export function isIosDevice(ua: string, maxTouchPoints: number): boolean {
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1);
}

/** Khoá công khai VAPID (base64url) → byte cho `pushManager.subscribe`. Sai dạng thì ném lỗi (không đoán). */
export function urlBase64ToUint8Array(b64: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+={0,2}$/.test(b64)) throw new Error("Khoá VAPID không đúng dạng base64url");
  const padded = b64.replace(/=+$/, "") + "=".repeat((4 - (b64.replace(/=+$/, "").length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Chữ giải thích khi hệ thống không cho bật; `reason` là giá trị `reason` máy chủ trả về. */
export function serverOffText(reason: string | null): string {
  if (reason === "preview") return "Bản xem trước không gửi thông báo đẩy, để khỏi nhắn nhầm tới điện thoại thật. Hãy bật ở trang KiN chính thức.";
  if (reason === "no-keys") return "Hệ thống chưa cấu hình khoá thông báo đẩy nên chưa dùng được. Hãy báo quản trị.";
  return "Thông báo đẩy chưa được bật trên hệ thống này.";
}
