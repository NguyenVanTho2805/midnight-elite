// NC2-051 — nguồn + ảnh bìa của bài Tin tức qua API (cơ sở dữ liệu thật): chỉ người có quyền Tin tức ghi được; kiểm nghiêm trước khi lưu;
// sửa một phần không làm mất nguồn; trang công khai CHỈ nhận nguồn / ảnh đã qua bộ kiểm (dữ liệu lạ do sửa tay trong DB không thành href / src).
import { api, mkUser, mkTutor, mkSuper, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";

const POST = { title: "Điểm chuẩn ĐH Mẫu 2026", slug: "diem-chuan-dh-mau-2026", excerpt: "Trường công bố điểm chuẩn.", content: "Nội dung bài.\n\nĐoạn hai.", category: "tuyen-sinh", published: true,
  sourceUrl: "https://www.facebook.com/kin.edu/posts/123", sourceName: "Fanpage KiN", coverImage: "https://cdn.example.edu.vn/bia.jpg" };
const U = "/api/admin/articles";
const row = (slug: string) => prisma.article.findUniqueOrThrow({ where: { slug } });

(async () => {
  await wipe();
  const SA = await mkSuper("Quản trị cấp 1"), CT = await mkUser({ name: "Biên tập", role: "admin", adminRole: "admin_content" });
  const T = await mkTutor("Cô Lan"), S = await mkUser({ name: "Minh Anh" });

  section("Quyền: chỉ người có quyền Tin tức");
  check("chưa đăng nhập → 401/403", [401, 403].includes((await api("POST", U, { body: POST })).status));
  check("gia sư → bị chặn (POST và PATCH)", [401, 403].includes((await api("POST", U, { as: T, body: POST })).status));
  check("học sinh → bị chặn", [401, 403].includes((await api("POST", U, { as: S, body: POST })).status));
  check("không có bài nào được ghi sau các lần bị chặn", (await prisma.article.count()) === 0);

  section("Tạo bài có nguồn + ảnh bìa");
  const c = await api("POST", U, { as: CT, body: POST });
  check("quản trị nội dung POST đủ nguồn → 201", c.status === 201, c.json);
  let a = await row(POST.slug);
  check("lưu đúng nguồn, tên nguồn và ảnh bìa", a.sourceUrl === POST.sourceUrl && a.sourceName === "Fanpage KiN" && a.coverImage === POST.coverImage, a);
  const c2 = await api("POST", U, { as: SA, body: { ...POST, slug: "khong-nguon", title: "Bài không nguồn", sourceUrl: "", sourceName: "", coverImage: "" } });
  a = await row("khong-nguon");
  check("bài không nguồn / không ảnh (chuỗi rỗng) → 201, cả ba cột là null (không phải chuỗi rỗng)", c2.status === 201 && a.sourceUrl === null && a.sourceName === null && a.coverImage === null, a);
  const c3 = await api("POST", U, { as: SA, body: { title: "Bài kiểu cũ", slug: "kieu-cu", excerpt: "t", content: "c", category: "tin-midnight" } });
  a = await row("kieu-cu");
  check("thân kiểu CŨ (không nhắc tới nguồn) vẫn tạo được; ba cột null", c3.status === 201 && a.sourceUrl === null && a.coverImage === null, c3.json);
  const c4 = await api("POST", U, { as: SA, body: { ...POST, slug: "ten-mien", title: "Tên nguồn trống", sourceName: "" } });
  check("có link, tên nguồn trống → tên nguồn lấy tên miền 'facebook.com'", c4.status === 201 && (await row("ten-mien")).sourceName === "facebook.com", c4.json);

  section("Dữ liệu sai → 400, không ghi gì");
  const before = await prisma.article.count();
  for (const [name, patch] of [
    ["nguồn javascript:", { sourceUrl: "javascript:alert(1)" }],
    ["nguồn ftp", { sourceUrl: "ftp://x.example.com/a" }],
    ["nguồn có tên đăng nhập", { sourceUrl: "https://tin-cay.vn@xau.example.com/" }],
    ["ảnh bìa http (không https)", { coverImage: "http://cdn.example.edu.vn/a.jpg" }],
    ["ảnh bìa data:", { coverImage: "data:image/svg+xml,<svg onload=alert(1)>" }],
    ["tên nguồn quá 80 ký tự", { sourceName: "x".repeat(81) }],
    ["nguồn là số", { sourceUrl: 123 }],
  ] as const) {
    const r = await api("POST", U, { as: SA, body: { ...POST, slug: `sai-${Math.random().toString(36).slice(2, 8)}`, ...patch } });
    check(`POST ${name} → 400 kèm lời tiếng Việt`, r.status === 400 && typeof r.json?.error === "string" && /nguồn|Ảnh bìa|Tên nguồn/i.test(r.json.error), r.json);
  }
  check("không có bài nào được thêm sau các lần sai", (await prisma.article.count()) === before);

  section("Sửa một phần");
  const id = (await row(POST.slug)).id;
  let p = await api("PATCH", `${U}/${id}`, { as: CT, body: { title: "Điểm chuẩn ĐH Mẫu 2026 (cập nhật)" } });
  a = await row(POST.slug);
  check("PATCH chỉ đổi tiêu đề → 200; nguồn, tên nguồn, ảnh bìa GIỮ NGUYÊN", p.status === 200 && a.title.endsWith("(cập nhật)") && a.sourceUrl === POST.sourceUrl && a.sourceName === "Fanpage KiN" && a.coverImage === POST.coverImage, a);
  p = await api("PATCH", `${U}/${id}`, { as: CT, body: { sourceName: "Trang chính thức" } });
  check("PATCH chỉ đổi tên nguồn → 200, link giữ nguyên", p.status === 200 && (await row(POST.slug)).sourceName === "Trang chính thức" && (await row(POST.slug)).sourceUrl === POST.sourceUrl);
  p = await api("PATCH", `${U}/${id}`, { as: CT, body: { coverImage: "http://cdn.example.edu.vn/a.jpg" } });
  check("PATCH ảnh bìa http → 400, bản ghi KHÔNG đổi", p.status === 400 && (await row(POST.slug)).coverImage === POST.coverImage, p.json);
  p = await api("PATCH", `${U}/${id}`, { as: CT, body: { sourceUrl: "javascript:alert(1)" } });
  check("PATCH nguồn javascript: → 400, nguồn cũ vẫn còn", p.status === 400 && (await row(POST.slug)).sourceUrl === POST.sourceUrl, p.json);
  p = await api("PATCH", `${U}/${id}`, { as: CT, body: { sourceUrl: "" } });
  a = await row(POST.slug);
  check("PATCH xoá link nguồn (rỗng) → link VÀ tên nguồn cùng xoá (tên chỉ là nhãn của link); ảnh bìa còn", p.status === 200 && a.sourceUrl === null && a.sourceName === null && a.coverImage === POST.coverImage, a);
  p = await api("PATCH", `${U}/${id}`, { as: CT, body: { coverImage: "" } });
  check("PATCH xoá ảnh bìa (rỗng) → null", p.status === 200 && (await row(POST.slug)).coverImage === null);
  p = await api("PATCH", `${U}/${id}`, { as: CT, body: { sourceUrl: "https://tuyensinh.example.edu.vn/tb", sourceName: "", coverImage: "https://cdn.example.edu.vn/moi.png" } });
  a = await row(POST.slug);
  check("PATCH đặt lại cả ba → 200; tên nguồn trống lấy tên miền", p.status === 200 && a.sourceUrl === "https://tuyensinh.example.edu.vn/tb" && a.sourceName === "tuyensinh.example.edu.vn" && a.coverImage === "https://cdn.example.edu.vn/moi.png", a);
  check("gia sư PATCH → bị chặn, bản ghi không đổi", [401, 403].includes((await api("PATCH", `${U}/${id}`, { as: T, body: { sourceUrl: "https://x.example.com/" } })).status) && (await row(POST.slug)).sourceUrl === "https://tuyensinh.example.edu.vn/tb");

  section("Đọc: GET admin trả đủ ba trường để form sửa điền lại");
  const g = await api("GET", `${U}/${id}`, { as: CT });
  check("GET /api/admin/articles/:id có sourceUrl, sourceName, coverImage", g.status === 200 && g.json.sourceUrl === "https://tuyensinh.example.edu.vn/tb" && g.json.sourceName === "tuyensinh.example.edu.vn" && g.json.coverImage === "https://cdn.example.edu.vn/moi.png", g.json);

  section("Công khai: chỉ nhận dữ liệu đã qua bộ kiểm");
  const pub = await api("GET", `/api/articles?slug=${POST.slug}`);
  check("khách đọc bài đã xuất bản → có nguồn, tên nguồn, ảnh bìa", pub.status === 200 && pub.json.sourceUrl === "https://tuyensinh.example.edu.vn/tb" && pub.json.sourceName === "tuyensinh.example.edu.vn" && pub.json.coverImage === "https://cdn.example.edu.vn/moi.png", pub.json);
  const nosrc = await api("GET", "/api/articles?slug=khong-nguon");
  check("bài không nguồn → ba trường là null (không phải chuỗi rỗng, không thiếu khoá)", nosrc.status === 200 && nosrc.json.sourceUrl === null && nosrc.json.sourceName === null && nosrc.json.coverImage === null && "coverImage" in nosrc.json, nosrc.json);
  const hidden = await api("POST", U, { as: SA, body: { ...POST, slug: "ban-nhap", title: "Bản nháp", published: false } });
  check("bản nháp: khách đọc → 404 (không lộ nguồn / ảnh)", hidden.status === 201 && (await api("GET", "/api/articles?slug=ban-nhap")).status === 404);

  // Dữ liệu lạ chèn thẳng vào DB (bỏ qua API) — mô phỏng sửa tay / nhập từ nơi khác: trang công khai không được biến nó thành href / src.
  await prisma.article.update({ where: { slug: "khong-nguon" }, data: { sourceUrl: "javascript:alert(1)", sourceName: "Bấm vào đây", coverImage: "http://cdn.example.edu.vn/a.jpg" } });
  const evil = await api("GET", "/api/articles?slug=khong-nguon");
  check("DB có nguồn javascript: + ảnh http → API công khai trả CẢ BA là null (kể cả tên nguồn)", evil.status === 200 && evil.json.sourceUrl === null && evil.json.sourceName === null && evil.json.coverImage === null, evil.json);
  await prisma.article.update({ where: { slug: "khong-nguon" }, data: { sourceUrl: "https://example.edu.vn/ok", sourceName: "OK", coverImage: "javascript:alert(2)" } });
  const half = await api("GET", "/api/articles?slug=khong-nguon");
  check("nguồn đúng nhưng ảnh bìa sai → bộ kiểm từ chối cả bộ (an toàn hơn đoán phần nào dùng được)", half.status === 200 && half.json.sourceUrl === null && half.json.coverImage === null, half.json);

  section("Danh sách công khai không đổi dạng");
  const list = await api("GET", "/api/articles");
  check("GET danh sách vẫn là mảng, có title / slug / excerpt, không kèm nội dung đầy đủ", list.status === 200 && Array.isArray(list.json) && list.json.length >= 3 && list.json.every((x: Record<string, unknown>) => typeof x.title === "string" && typeof x.slug === "string" && !("content" in x)), list.json?.[0]);

  done();
})().catch(e => { console.error("CRASH", e); process.exit(1); });
