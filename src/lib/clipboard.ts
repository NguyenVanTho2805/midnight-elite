// Sao chép vào bộ nhớ tạm, có đường lui cho trình duyệt không cho dùng navigator.clipboard (trang không an toàn, iframe, Safari cũ).
// Trước đây nằm trong components/tutor/shared.tsx (copyText); chuyển ra đây để mọi nơi (kể cả KinCopyButton) dùng chung một cách.
export async function copyToClipboard(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* rơi xuống cách cũ */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch { return false; }
}
