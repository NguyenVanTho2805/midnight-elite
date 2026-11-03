// BU-08 mục 4.6 / 8.2 — 308 từ đường quản trị cũ sang mới (cần next.config.ts đã nhập src/lib/adminRedirects.ts — COO gắn, D1).
// Cần Next dev cổng 3100. Đã chạy tuần tự trên máy test (02/11/2026), số liệu trong PR.
// Ca phá cố ý: thêm { from: "/admin/danh-gia", to: … } vào ADMIN_REDIRECTS → ca "đường giữ nguyên không 308" đỏ.
import { BASE, wipe, mkTutor, mkSuper, cookieFor, check, section, done } from "./h";

// adm-test 02/11: /admin* ở tên miền chính bị proxy.ts đẩy 307 sang tên miền admin TRƯỚC khi tới trang → phải gọi thẳng tên miền admin.
// Không có /etc/hosts nên nối 127.0.0.1:<cổng> và đặt header Host (node:http, vì fetch có thể bỏ qua Host).
import http from "node:http";
const PORT = Number(new URL(BASE).port || 3100), ADMIN_HOST = `admin.midnightelite-edu.com:${PORT}`;
const hit = (path: string, cookie?: string): Promise<{ status: number; headers: { get(k: string): string | null } }> => new Promise((resolve, reject) => {
  const u = path.startsWith("http") ? new URL(path) : new URL(path, `http://${ADMIN_HOST}`);
  const req = http.request({ host: "127.0.0.1", port: PORT, path: u.pathname + u.search, method: "GET", headers: { host: u.host, ...(cookie ? { cookie } : {}) } }, res => {
    res.resume(); res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: { get: k => { const v = res.headers[k.toLowerCase()]; return Array.isArray(v) ? v[0] : v ?? null; } } }));
  });
  req.on("error", reject); req.end();
});

(async () => {
  await wipe();
  const SA = await mkSuper("Quản trị cấp 1"), T = await mkTutor("Cô Lan");
  section("308 giữ query");
  let r = await hit("/admin/ho-so-gia-su?x=1");
  // Next ghép query của yêu cầu TRƯỚC query của đích (`?x=1&loai=gia-su`), còn lookupAdminRedirect (thuần) ghép sau; thứ tự tham số không có ý nghĩa nên so theo TẬP tham số.
  const qs = (loc: string | null) => { const u = new URL(loc ?? "", "http://x"); return { path: u.pathname, params: JSON.stringify([...u.searchParams.entries()].sort()) }; };
  const l1 = qs(r.headers.get("location"));
  check("/admin/ho-so-gia-su?x=1 → 308 tới /admin/kiem-duyet với đủ loai=gia-su và x=1 (không phụ thuộc thứ tự)", r.status === 308 && l1.path === "/admin/kiem-duyet" && l1.params === JSON.stringify([["loai", "gia-su"], ["x", "1"]]), [r.status, r.headers.get("location")]);
  // Tham số trùng tên: ĐÍCH thắng (khớp lookupAdminRedirect) — không để đường cũ + ?loai=tra-loi đổi được loại hàng chờ.
  const rd = await hit("/admin/ho-so-gia-su?loai=tra-loi&loai=ho-so");
  const ld = qs(rd.headers.get("location"));
  check("?loai=tra-loi&loai=ho-so trên đường cũ → vẫn loai=gia-su duy nhất (đích thắng)", rd.status === 308 && ld.params === JSON.stringify([["loai", "gia-su"]]), [rd.status, rd.headers.get("location")]);
  r = await hit("/admin/cong-dong/bao-cao");
  check("/admin/cong-dong/bao-cao → 308 ?loai=tra-loi", r.status === 308 && /\/admin\/kiem-duyet\?loai=tra-loi$/.test(r.headers.get("location") ?? ""), [r.status, r.headers.get("location")]);

  section("Đường giữ nguyên KHÔNG 308");
  for (const p of ["/admin", "/admin/kiem-duyet", "/admin/hoc-sinh", "/admin/danh-gia", "/admin/topups", "/admin/cong-dong", "/admin/khoa-hoc", "/admin/nhat-ky"]) {
    const x = await hit(p, await cookieFor(SA));
    check(`${p} không bị 308 (${x.status})`, x.status !== 308);
  }

  section("Chuỗi chuyển hướng theo vai");
  // adm-test 02/11: giữ URL tuyệt đối khi đi theo (đổi tên miền admin ↔ chính là một phần của chuỗi); trả về đường dẫn cuối.
  const follow = async (start: string, cookie?: string) => { let url = start; for (let i = 0; i < 8; i++) { const x = await hit(url, cookie); const loc = x.headers.get("location"); const cur = new URL(url, `http://${ADMIN_HOST}`); if (x.status < 300 || x.status >= 400 || !loc) return { url: cur.pathname + cur.search, status: x.status }; url = new URL(loc, cur).toString(); } const cur = new URL(url, `http://${ADMIN_HOST}`); return { url: cur.pathname + cur.search, status: 0 }; };
  const tr = await follow("/admin/ho-so-gia-su", await cookieFor(T));
  check("gia sư mở đường cũ rồi đi hết chuỗi → KHÔNG vào được /admin* (tới Hộp việc / trang gia sư)", !tr.url.startsWith("/admin"), tr);
  const anon = await follow("/admin/ho-so-gia-su");
  // adm-test 02/11: khách vào /admin* nhận HTTP 200 (khung tải) và bị đẩy về đăng nhập PHÍA TRÌNH DUYỆT (kể cả /admin/kiem-duyet), nên ở mức HTTP chỉ kiểm: đi hết chuỗi không văng lỗi, không lộ dữ liệu (API 401). Phần "tới đăng nhập" do ui-admin-gia-su kiểm bằng trình duyệt.
  check("chưa đăng nhập: chuỗi kết thúc 200 ở /admin/kiem-duyet hoặc /dang-nhap, và API hàng chờ 401", ((anon.status === 200) && (/dang-nhap/.test(anon.url) || anon.url.startsWith("/admin/kiem-duyet"))) && (await hit("/api/admin/kiem-duyet")).status === 401, anon);
  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
