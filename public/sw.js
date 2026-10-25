// KiN — service worker CHỈ để nhận thông báo đẩy của gia sư (ĐX-02).
// Cố ý KHÔNG có `fetch`, KHÔNG có cache: không giữ trang cũ, không làm hỏng phiên đăng nhập, không chạy offline.
// Chữ trên màn hình khoá do máy chủ dựng từ LOẠI thông báo (src/lib/pushRules.ts) — không có tên học sinh hay số tiền.
// Tin chỉ có ba khoá: title, body, url. Tin sai dạng thì bỏ, không hiện thông báo trống.

self.addEventListener("install", () => { self.skipWaiting(); });
self.addEventListener("activate", (event) => { event.waitUntil(self.clients.claim()); });

/** Chỉ nhận đường dẫn CÙNG tên miền, bắt đầu bằng một dấu "/" (không "//", không "/\\", không có giao thức): tin lạ không dẫn người dùng ra ngoài. */
function safeUrl(u) {
  return typeof u === "string" && u.length < 300 && u.charAt(0) === "/" && u.charAt(1) !== "/" && u.charAt(1) !== "\\" ? u : "/lop-cua-toi";
}

self.addEventListener("push", (event) => {
  let data = null;
  try { data = event.data ? event.data.json() : null; } catch (e) { data = null; }
  if (!data || typeof data.title !== "string" || !data.title || data.title.length > 120) return;
  const body = typeof data.body === "string" ? data.body.slice(0, 200) : "";
  event.waitUntil(self.registration.showNotification(data.title, {
    body,
    icon: "/icons/kin-192.png",
    data: { url: safeUrl(data.url) },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(safeUrl(event.notification.data && event.notification.data.url), self.location.origin).href;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const w of wins) {
      if (new URL(w.url).origin === self.location.origin && "focus" in w) {
        try { await w.focus(); if ("navigate" in w) await w.navigate(target); return; } catch (e) { /* mở cửa sổ mới */ }
      }
    }
    await self.clients.openWindow(target);
  })());
});
