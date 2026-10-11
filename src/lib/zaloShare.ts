// TT-199 giai đoạn 1 / TT-201 — "Gửi qua Zalo" bằng một chạm, KHÔNG bot, KHÔNG tự gửi.
//  • Điện thoại có bảng chia sẻ của máy (Web Share API): mở bảng đó với tin soạn sẵn; gia sư chọn Zalo
//    rồi chọn người nhận và tự bấm gửi.
//  • Máy tính: chép tin vào bộ nhớ tạm rồi mở Zalo (đúng cuộc trò chuyện nếu có SĐT); gia sư dán và gửi.
// KiN chỉ biết gia sư ĐÃ MỞ Zalo, không biết tin có đi thật hay không (đặc tả gui-qua-zalo.md mục 3).
// Chỉ chạy ở trình duyệt.

export type ZaloOpenResult =
  | { opened: true; method: "share" | "copy"; copied: boolean }
  | { opened: false; reason: "cancelled" | "failed" };

/** Giữ chữ số; "+84901234567"/"84901234567" → "0901234567". Không hợp lệ → null. */
export function normalizeZaloPhone(raw: string | null | undefined): string | null {
  const d = (raw ?? "").replace(/\D/g, "");
  if (!d) return null;
  const local = d.startsWith("84") && d.length >= 11 ? `0${d.slice(2)}` : d;
  return /^0\d{9,10}$/.test(local) ? local : null;
}

export function zaloChatUrl(phone: string | null | undefined): string {
  const p = normalizeZaloPhone(phone);
  return p ? `https://zalo.me/${p}` : "https://chat.zalo.me/";
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; }
  } catch { /* thử cách dự phòng */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch { return false; }
}

const isTouchPhone = () => typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches && !!navigator.share;

export async function openZalo(o: { text: string; phone?: string | null }): Promise<ZaloOpenResult> {
  if (isTouchPhone()) {
    try { await navigator.share({ text: o.text }); return { opened: true, method: "share", copied: false }; }
    catch (e) {
      if ((e as { name?: string })?.name === "AbortError") return { opened: false, reason: "cancelled" };
      // bảng chia sẻ lỗi → rơi xuống cách chép + mở Zalo
    }
  }
  const copied = await copyText(o.text);
  const w = window.open(zaloChatUrl(o.phone), "_blank", "noopener");
  if (!w && !copied) return { opened: false, reason: "failed" };
  return { opened: true, method: "copy", copied };
}
