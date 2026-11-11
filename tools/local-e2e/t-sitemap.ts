// BU-07 mục 5.5 — /sitemap.xml và /robots.txt (HTTP vào máy chủ dev + DB). VIẾT, chưa chạy.
// Có: bài đang hiển thị, khoá học status=true, trang tĩnh. Không có: nháp, lên lịch tương lai, khoá ẩn, /admin, /api, /student, /lop-cua-toi, /thi-thu. ≤ 5000 mục.
import { api, mkSuper, wipe, check, section, done, BASE } from "./h";
import { prisma } from "@/lib/prisma";
import { featureOn } from "@/lib/features";
import { request as httpRequest } from "node:http";

(async () => {
  await wipe();
  const A = await mkSuper("Quản trị");
  const now = Date.now();
  const mk = (slug: string, o: Record<string, unknown> = {}) => prisma.article.create({
    data: { slug, title: `Bài ${slug}`, excerpt: "Sapo.", content: "Nội dung.", category: "tuyen-sinh", author: "KiN", authorId: A.id, published: true, publishedAt: new Date(now - 3600_000), ...o },
  });
  await mk("hien-1");
  await mk("hien-cu", { publishedAt: null });
  await mk("nhap-x", { published: false, publishedAt: null });
  await mk("lich-x", { publishedAt: new Date(now + 3600_000) });
  const course = (id: string, status: boolean, n: number) => prisma.course.create({
    data: {
      id, adminId: n, name: `Lớp ${id}`, adminName: id, shortTitle: id, category: "hsa", instructor: "GV", teacherAvatar: "", openDate: "", types: [], bg: "x", price: 0,
      status, createdAt: new Date().toISOString(),
    } as never,
  });
  await course("lop-hien", true, 9001);
  await course("lop-an", false, 9002);

  section("sitemap.xml");
  const sm = await api("GET", "/sitemap.xml");
  check("200 và là XML", sm.status === 200 && /<urlset/.test(sm.text), sm.status);
  const locs = [...sm.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  // LOI-01 (11/11/2026): trang của phần đang ẩn (src/lib/features.ts) không vào sitemap. Cờ đọc ở tiến trình bài này — chạy bài với CÙNG biến NEXT_PUBLIC_KIN_MO_* như máy chủ dev.
  if (featureOn("TIN_TUC")) {
    check("có trang tĩnh /tin-tuc và gốc", locs.some(l => /\/tin-tuc$/.test(l)) && locs.some(l => /^https:\/\/[^/]+$/.test(l)));
    check("có bài đã đăng (cả bài cũ publishedAt=null)", locs.some(l => l.endsWith("/tin-tuc/hien-1")) && locs.some(l => l.endsWith("/tin-tuc/hien-cu")));
  } else {
    check("Tin tức đang ẩn: có gốc, KHÔNG có /tin-tuc và bài nào", locs.some(l => /^https:\/\/[^/]+$/.test(l)) && !locs.some(l => /\/tin-tuc(\/|$)/.test(l)), locs.filter(l => /tin-tuc/.test(l)));
  }
  check("trang của phần đang ẩn (/giang-vien, /diem-chuan) không có khi cờ tắt", (featureOn("TIM_GIA_SU") || !locs.some(l => /\/giang-vien$/.test(l))) && (featureOn("DIEM_CHUAN") || !locs.some(l => /\/diem-chuan$/.test(l))), locs);
  check("KHÔNG có nháp và bài lên lịch tương lai", !locs.some(l => l.endsWith("/tin-tuc/nhap-x")) && !locs.some(l => l.endsWith("/tin-tuc/lich-x")));
  check("có khoá học status=true, KHÔNG có khoá ẩn", locs.some(l => l.endsWith("/khoa-hoc/lop-hien")) && !locs.some(l => l.endsWith("/khoa-hoc/lop-an")));
  check("không có /admin, /api, /student, /lop-cua-toi, /phu-huynh, /thi-thu, ?muc=", !locs.some(l => /\/(admin|api|student|lop-cua-toi|phu-huynh|thi-thu)(\/|$)|\?muc=/.test(l)), locs.filter(l => /admin|api|student|lop-cua-toi|phu-huynh|thi-thu|muc=/.test(l)));
  check("≤ 5000 mục", locs.length <= 5000, locs.length);
  check("mọi địa chỉ là https tuyệt đối", locs.every(l => l.startsWith("https://")));

  section("robots.txt");
  const rb = await api("GET", "/robots.txt");
  check("200, có dòng Sitemap: …/sitemap.xml", rb.status === 200 && /^Sitemap: https:\/\/[^\s]+\/sitemap\.xml$/m.test(rb.text), rb.text.slice(0, 200));
  for (const p of ["/admin", "/api/", "/student", "/lop-cua-toi", "/phu-huynh", "/xem-tai-lieu", "/xac-", "/dat-lai-mat-khau"]) check(`Disallow ${p}`, new RegExp(`^Disallow: ${p.replace(/[/-]/g, "\\$&")}\\s*$`, "m").test(rb.text));
  check("cho phép /", /^Allow: \/\s*$/m.test(rb.text));
  // fetch (undici) bỏ qua header Host tự đặt → dùng node:http để thật sự gửi Host của tên miền admin.
  const ad = await new Promise<string>((res) => {
    const u = new URL(BASE);
    const rq = httpRequest({ host: u.hostname, port: u.port, path: "/robots.txt", headers: { host: "admin.midnightelite-edu.com" } }, (r) => { let b = ""; r.on("data", (c) => (b += c)); r.on("end", () => res(b)); });
    rq.on("error", () => res("")); rq.end();
  });
  check("tên miền admin: Disallow: / (header Host giả; nếu trình chạy chặn đổi Host thì bài này cần chạy qua ADMIN trong ui.ts)", /^Disallow: \/\s*$/m.test(ad) && !/^Allow:/m.test(ad), ad.slice(0, 120));

  await done();
})();
