// GS-LOP-GON (09/11/2026) — "Lớp gọn" của gia sư, phần MÁY CHỦ: chuyển hướng /lop-cua-toi/[courseId] → trang lớp, cổng quyền của /lop-cua-toi/quan-lop/[id]*, cô lập hai gia sư,
// đồng giảng / quản trị / học sinh / gia sư chờ duyệt / khách, chống mở chuyển hướng ra ngoài, API gallery lớp. Đặc tả: docs/kin/phong-ban/dac-ta/GS-LOP-GON.md mục 3, 9.1.
// Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-lop-gon.ts   (máy chủ thử ở BASE, DB riêng — bài gọi wipe()).
//
// Hai kiểu chuyển hướng, kiểm khác nhau (ĐO THẬT trên máy chủ thử, không đoán):
//   - /lop-cua-toi/[courseId] KHÔNG có loading.tsx → redirect() là 307 thật, kiểm cứng: 307 + Location, không bao giờ 308, Cache-Control không cho lưu lại.
//   - /lop-cua-toi/quan-lop/[id]* nằm dưới (tutor)/loading.tsx → trang được STREAM: HTTP luôn 200, chuyển hướng đi bằng <meta id="__next-page-redirect" http-equiv="refresh">
//     (và điều hướng phía trình duyệt). Vì vậy "403 / 404" của TRANG là nội dung màn (data-class-gate), không phải mã HTTP; mã HTTP 403 / 404 kiểm ở API.
//     Bài đọc cả hai dạng (Location hoặc meta) qua hàm `go()` và chỉ chấp nhận đích đúng.
//
// CA PHÁ CỐ Ý (09/11/2026, đã chạy thật: phá → đỏ đúng ca → trả lại):
//   - [courseId]/page.tsx bỏ dòng `if (isOwner && isTeacher) redirect(...)` → 15 ca 'chủ lớp → 307' đỏ; đổi thành `if (isTeacher)` → 5 ca đỏ (đồng giảng / bộ môn / gia sư B bị chuyển nhầm);
//     đổi thành `if (isOwner)` → ca 'quản trị đứng tên một lớp KHÔNG bị chuyển' đỏ (ca này thêm sau vì quản trị xem ở lớp của gia sư khác không bắt được lỗi này);
//   - quan-lop/[id]/hoc-vien/page.tsx `ownerOnly: true` → false, hoặc bỏ nhánh redirect đồng giảng ở quan-lop/[id]/page.tsx → ca 'đồng giảng → /lop-cua-toi/<id>' đỏ (2 ca mỗi lần);
//   - tutorClassPageServer.loadClassHead gộp 404 vào 403 → mọi ca 'id lạ → màn không tìm thấy' đỏ;
//   - tutorClassTableServer trả `cover: c.bg` (bg thô) → 4 ca gallery đỏ (https đã lọc, không rò bg thô, bg độc, bg http);
//   - HAI lớp chặn cùng lúc: hoc-vien/page.tsx bỏ `if (!gate.ok) return null` VÀ layout.tsx vẫn render {children} khi bị cấm → ca 'B không lộ tên lớp / học sinh' đỏ cho …/hoc-vien (chỉ bỏ MỘT lớp thì bài vẫn xanh vì lớp kia còn chặn — đúng ý phòng thủ hai tầng);
//   - phần hàm thuần (t-class-routes-lib.ts): bỏ danh sách trắng query, nới coverImageOf nhận http (phải bỏ CẢ kiểm u.protocol — còn một tầng chặn thứ hai), bỏ kiểm tài khoản trong địa chỉ, bỏ lọc vai đồng giảng → ca tương ứng đỏ.
//   LƯU Ý khi tự phá: máy chủ `next dev` có thể giữ bản đã phá của một module dù đã trả lại tệp (gặp ở tutorClassRoutes.ts, kèm `touch` cũng không đỡ) → kết quả đỏ giả; dừng + bật lại bằng .local-dev/wt-up.sh.
import { api, mkTutor, mkUser, mkCourse, wipe, check, section, done, BASE, type TUser } from "./h";
import { prisma } from "@/lib/prisma";
import { legacyClassTarget } from "@/lib/tutorClassRoutes";

const FORM = { "content-type": "application/x-www-form-urlencoded" };
const form = (path: string, as: TUser | undefined, pairs: [string, string][] = []) => api("POST", path, { as, raw: new URLSearchParams(pairs), headers: FORM });

type Res = Awaited<ReturnType<typeof api>>;
/** Đích chuyển hướng của một phản hồi trang: Location (307/303) hoặc <meta refresh> của trang stream. null = không chuyển hướng. */
function go(r: Res): { to: string | null; kind: "http" | "meta" | "none" } {
  const h = r.headers.get("location");
  if (h) { const u = new URL(h, BASE); return { to: u.pathname + u.search, kind: "http" }; }
  const m = /<meta id="__next-page-redirect"[^>]*content="\d+;url=([^"]+)"/.exec(r.text);
  if (m) { const u = new URL(m[1].replace(/&amp;/g, "&"), BASE); return { to: u.pathname + u.search, kind: "meta" }; }
  return { to: null, kind: "none" };
}
const h1Count = (t: string) => (t.match(/<h1[\s>]/g) ?? []).length;
const stripCount = (t: string) => (t.match(/aria-label="Trang của/g) ?? []).length;
const hasGate = (t: string, code: "forbidden" | "not-found") => t.includes(`data-class-gate="${code}"`);
const QL = "/lop-cua-toi/quan-lop";
const noStore = (r: Res) => { const cc = r.headers.get("cache-control") ?? ""; return /no-store/.test(cc) || /no-cache/.test(cc); };

(async () => {
  await wipe();
  const A = await mkTutor("Cô Lan Chủ A");
  const B = await mkTutor("Thầy Bình Chủ B");
  const CO = await mkTutor("Cô Hoa Đồng Giảng");
  const SUB = await mkTutor("Thầy Sử Bộ Môn");
  const ADM = await mkUser({ name: "Quản trị", role: "admin", adminRole: "admin_super" });
  const PEND = await mkUser({ name: "Ứng Viên Chờ Duyệt" }); await prisma.user.update({ where: { id: PEND.id }, data: { tutorAppliedAt: new Date() } });
  const STU = await mkUser({ name: "Học Sinh Ngoài Lớp" });
  const ENR = await mkUser({ name: "Học Sinh Bí Mật Trong Lớp A" });

  const CA = await mkCourse(A.id, { name: "Lớp Toán Bí Mật Của Cô A" });
  const CB = await mkCourse(B.id, { name: "Lớp Văn Riêng Của Thầy B" });
  await prisma.course.update({ where: { id: CA.id }, data: { bg: 'url("https://cdn.example.com/a/bia.jpg")' } });
  await prisma.course.update({ where: { id: CB.id }, data: { bg: "linear-gradient(135deg,#123456,#abcdef)" } });
  await prisma.enrollment.create({ data: { userId: ENR.id, courseId: CA.id, status: "active" } });
  await prisma.courseTeacher.create({ data: { courseId: CA.id, userId: CO.id, role: "co_teacher", status: "active", invitedBy: A.id } });
  await prisma.courseTeacher.create({ data: { courseId: CA.id, userId: SUB.id, role: "subject_teacher", status: "active", invitedBy: A.id } });
  const idA = CA.id, idB = CB.id;

  // ── 1. /lop-cua-toi/[courseId]: chủ lớp → 307 + Cache-Control, giữ query phụ ─────────────────────────
  section("1. Chủ lớp mở /lop-cua-toi/<id> → 307 sang đúng tab (không 308, không cho lưu lại), giữ moi / lich / them / duyet / n / ma");
  const rows: [string, string, string][] = [
    ["", "", `${QL}/${idA}/giao-trinh`],
    ["?tab=diem-danh", "", `${QL}/${idA}/diem-danh`],
    ["?tab=hoc-sinh", "", `${QL}/${idA}/hoc-vien`],
    ["?tab=hoc-sinh&duyet=ok&n=2", "", `${QL}/${idA}/hoc-vien?muc=xin-vao&duyet=ok&n=2`],
    ["?tab=hoc-sinh&them=3", "", `${QL}/${idA}/hoc-vien?them=3`],
    ["?tab=ma-moi", "", `${QL}/${idA}/hoc-vien?muc=ma-moi`],
    ["?tab=ma-moi&moi=1&ma=loi", "", `${QL}/${idA}/hoc-vien?muc=ma-moi&moi=1&ma=loi`],
    ["?tab=giao-vien", "", `${QL}/${idA}?tab=cai-dat&muc=dong-giang`],
    ["?tab=hoc-phi", "", `${QL}/${idA}?tab=cai-dat&muc=hoc-phi`],
    ["?tab=cong-dong", "", `${QL}/${idA}?tab=cai-dat&muc=cong-dong`],
    ["?tab=khong-biet", "", `${QL}/${idA}/giao-trinh`],
    ["?moi=1", "", `${QL}/${idA}/hoc-vien?muc=ma-moi&moi=1`],
    ["?moi=1&them=2&ma=loi&lich=loi", "", `${QL}/${idA}/hoc-vien?muc=ma-moi&moi=1&them=2&ma=loi&lich=loi`],
    ["?lich=loi", "", `${QL}/${idA}/lich-hoc?lich=loi`],
    ["?duyet=tuchoi", "", `${QL}/${idA}/hoc-vien?muc=xin-vao&duyet=tuchoi`],
  ];
  for (const [q, , want] of rows) {
    const r = await api("GET", `/lop-cua-toi/${idA}${q}`, { as: A });
    check(`307 ${q || "(không query)"} → ${want.replace(idA, "<A>")}`, r.status === 307 && go(r).to === want && go(r).kind === "http", [r.status, go(r).to]);
  }
  const r0 = await api("GET", `/lop-cua-toi/${idA}?tab=hoc-phi`, { as: A });
  check("không bao giờ 308 / 301 (trình duyệt sẽ nhớ vĩnh viễn); 307 không được cho lưu lại: Cache-Control no-store hoặc no-cache", ![301, 308].includes(r0.status) && r0.status === 307 && noStore(r0), [r0.status, r0.headers.get("cache-control")]);
  console.log(`    (đo: Cache-Control của 307 trên máy chủ thử = "${r0.headers.get("cache-control")}" — \`next dev\` luôn ghi no-cache cho mọi trang; bản production dùng no-store qua getCacheControlHeader(revalidate 0), CHƯA đo trên bản build)`);
  check("hàm thuần legacyClassTarget cho CÙNG đích với máy chủ (không lệch)", (await Promise.all(rows.map(async ([q]) => go(await api("GET", `/lop-cua-toi/${idA}${q}`, { as: A })).to === legacyClassTarget(idA, Object.fromEntries(new URLSearchParams(q.replace(/^\?/, "")))) ))).every(Boolean));

  section("1b. Phá: mở chuyển hướng ra ngoài / tham số lạ / id lạ");
  for (const q of ["?tab=//evil.example", "?tab=https://evil.example", "?duyet=http://evil.example", "?tab=hoc-sinh&duyet=//evil.example&n=http://x", "?tab=ma-moi&moi=https://evil.example&redirect=https://evil.example&next=/x", "?tab=hoc-sinh&them=%2F%2Fevil.example"]) {
    const g = go(await api("GET", `/lop-cua-toi/${idA}${q}`, { as: A })).to ?? "";
    check(`${q} → đích cùng gốc, nằm trong ${QL}/<A>, không khoá chuyển hướng lạ (redirect / next / url)`, (() => { const u = new URL(g, BASE); return u.origin === new URL(BASE).origin && u.pathname.startsWith(`${QL}/${idA}`) && !["redirect", "next", "url", "returnTo"].some(k => u.searchParams.has(k)); })(), g);
  }

  section("1c. Người khác với /lop-cua-toi/<id>: đồng giảng, bộ môn, quản trị xem, học sinh KHÔNG bị chuyển sang quan-lop");
  for (const [who, u] of [["đồng giảng", CO], ["giáo viên bộ môn", SUB]] as [string, TUser][]) {
    const r = await api("GET", `/lop-cua-toi/${idA}`, { as: u });
    check(`${who}: 200, vẫn là trang lớp kiểu cũ (LopChiTiet), KHÔNG chuyển hướng`, r.status === 200 && go(r).to === null && r.text.includes("Lớp Toán Bí Mật Của Cô A"), [r.status, go(r).to]);
    const r2 = await api("GET", `/lop-cua-toi/${idA}?tab=hoc-phi`, { as: u });
    check(`${who}: ?tab=hoc-phi cũng không chuyển hướng`, r2.status === 200 && go(r2).to === null, [r2.status, go(r2).to]);
  }
  const rAdm = await api("GET", `/lop-cua-toi/${idA}`, { as: ADM });
  check("quản trị xem thử: KHÔNG bị chuyển sang quan-lop (LopChiTiet như cũ)", go(rAdm).to === null || !go(rAdm).to!.startsWith(QL), [rAdm.status, go(rAdm).to]);
  const CAD = await mkCourse(ADM.id, { name: "Lớp Do Quản Trị Đứng Tên" }); // quản trị là ownerId nhưng KHÔNG phải gia sư thật → giữ trang cũ (xem thử)
  const rAdmOwn = await api("GET", `/lop-cua-toi/${CAD.id}?tab=hoc-phi`, { as: ADM });
  check("quản trị đứng tên một lớp (isOwner nhưng không phải gia sư) → KHÔNG bị chuyển sang quan-lop", !(go(rAdmOwn).to ?? "").startsWith(QL), [rAdmOwn.status, go(rAdmOwn).to]);
  const rEnr = await api("GET", `/lop-cua-toi/${idA}`, { as: ENR });
  check("học sinh trong lớp: 200, khung học sinh, KHÔNG chuyển hướng", rEnr.status === 200 && go(rEnr).to === null, [rEnr.status, go(rEnr).to]);
  const rStu = await api("GET", `/lop-cua-toi/${idA}`, { as: STU });
  check("học sinh ngoài lớp: không vào được (không 200 thân lớp, không lộ tên lớp)", !(rStu.status === 200 && rStu.text.includes("Lớp Toán Bí Mật Của Cô A")), rStu.status);
  const rB = await api("GET", `/lop-cua-toi/${idA}`, { as: B });
  check("gia sư B (không phải chủ / đồng giảng) mở /lop-cua-toi/<A>: không lộ lớp, không chuyển vào quan-lop của A", !rB.text.includes("Lớp Toán Bí Mật Của Cô A") && !(go(rB).to ?? "").includes(idA), [rB.status, go(rB).to]);
  const rPend = await api("GET", `/lop-cua-toi/${idA}`, { as: PEND });
  check("gia sư CHỜ DUYỆT mở /lop-cua-toi/<id> → 307 /lop-cua-toi/cho-duyet (không lộ lớp)", rPend.status === 307 && go(rPend).to === "/lop-cua-toi/cho-duyet" && !rPend.text.includes("Lớp Toán Bí Mật"), [rPend.status, go(rPend).to]);
  const rGuest = await api("GET", `/lop-cua-toi/${idA}?tab=hoc-sinh`);
  check("khách → 307 /dang-nhap?redirect=…", rGuest.status === 307 && (go(rGuest).to ?? "").startsWith("/dang-nhap?redirect="), [rGuest.status, go(rGuest).to]);
  const rNone = await api("GET", `/lop-cua-toi/khong-co-lop-nay`, { as: A });
  check("id không có lớp → 404 (không 500)", rNone.status === 404, rNone.status);

  // ── 2. quan-lop/<id> của chủ lớp: gốc → giao-trinh, liên kết cũ, thân tab ───────────────────────────
  section("2. Chủ lớp: quan-lop/<id> (không ?tab=) → Giáo trình; liên kết cũ → trang con; ?tab=cai-dat | chuong-bai → thân tab");
  const dec: [string, string][] = [
    ["", `${QL}/${idA}/giao-trinh`], ["?tab=giao-trinh", `${QL}/${idA}/giao-trinh`], ["?tab=lich-hoc", `${QL}/${idA}/lich-hoc`], ["?tab=hoc-vien", `${QL}/${idA}/hoc-vien`],
    ["?tab=diem-danh", `${QL}/${idA}/diem-danh`], ["?tab=xyz", `${QL}/${idA}/giao-trinh`],
  ];
  for (const [q, want] of dec) {
    const g = go(await api("GET", `${QL}/${idA}${q}`, { as: A }));
    check(`${q || "(gốc trần)"} → ${want.replace(idA, "<A>")}`, g.to === want, g);
  }
  const g0 = await api("GET", `${QL}/${idA}`, { as: A });
  console.log(`    (đo: quan-lop/<id> trần trả HTTP ${g0.status}, kiểu chuyển hướng "${go(g0).kind}" — dưới (tutor)/loading.tsx; 307 thật cần proxy, xem bàn giao mục D)`);
  const cd = await api("GET", `${QL}/${idA}?tab=cai-dat`, { as: A });
  check("?tab=cai-dat → 200, thân Cài đặt, không chuyển hướng", cd.status === 200 && go(cd).to === null && cd.text.includes("Mục của Cài đặt"), [cd.status, go(cd).to]);
  for (const m of ["hoc-phi", "dong-giang", "cong-dong", "ban-ghi", "rac-ruoi"]) {
    const r = await api("GET", `${QL}/${idA}?tab=cai-dat&muc=${m}`, { as: A });
    check(`?tab=cai-dat&muc=${m} → 200 không lỗi (muc lạ → mục mặc định)`, r.status === 200 && go(r).to === null && r.text.includes("Mục của Cài đặt"), [r.status]);
  }
  const cb = await api("GET", `${QL}/${idA}?tab=chuong-bai`, { as: A });
  check("?tab=chuong-bai → 200, không chuyển hướng", cb.status === 200 && go(cb).to === null, [cb.status, go(cb).to]);
  const hv = await api("GET", `${QL}/${idA}/hoc-vien`, { as: A });
  check("hoc-vien → 200, thân tab Học sinh, mục con Danh bạ", hv.status === 200 && go(hv).to === null && hv.text.includes("data-hoc-sinh-tab"), [hv.status]);
  for (const m of ["xin-vao", "ma-moi", "them", "rac"]) {
    const r = await api("GET", `${QL}/${idA}/hoc-vien?muc=${m}`, { as: A });
    check(`hoc-vien?muc=${m} → 200 (muc lạ → danh bạ)`, r.status === 200 && go(r).to === null && r.text.includes("data-hoc-sinh-tab"), [r.status]);
  }
  const dd = await api("GET", `${QL}/${idA}/diem-danh`, { as: A });
  check("diem-danh → 200, có 'Lịch sử buổi học', không chuyển hướng", dd.status === 200 && go(dd).to === null && dd.text.includes("Lịch sử buổi học"), [dd.status]);
  section("2b. Một đầu lớp, MỘT dải tab (6 tab đúng thứ tự), không breadcrumb quản trị — trên cả 6 trang của chủ lớp");
  const ORDER = ["Giáo trình", "Học sinh", "Điểm danh", "Bài tập", "Lịch học", "Cài đặt"];
  for (const p of [`/giao-trinh`, `/hoc-vien`, `/diem-danh`, `/lich-hoc`, `?tab=chuong-bai`, `?tab=cai-dat`]) {
    const r = await api("GET", `${QL}/${idA}${p}`, { as: A });
    const strip = /<nav[^>]*aria-label="Trang của[^"]*"[^>]*>([\s\S]*?)<\/nav>/.exec(r.text)?.[1] ?? "";
    const labels = [...strip.matchAll(/<a [^>]*>([\s\S]*?)<\/a>/g)].map(m => m[1].replace(/<[^>]+>/g, "").trim());
    check(`${p}: đúng 1 <h1> (tên lớp), 1 dải tab, không "Bảng điều khiển /"`, r.status === 200 && h1Count(r.text) === 1 && stripCount(r.text) === 1 && !/Bảng điều khiển\s*\//.test(r.text.replace(/<[^>]+>/g, "")) && r.text.includes("Lớp Toán Bí Mật Của Cô A"), { s: r.status, h1: h1Count(r.text), nav: stripCount(r.text) });
    check(`${p}: thứ tự tab ${ORDER.join(" · ")}`, labels.join(" · ") === ORDER.join(" · "), labels);
  }

  // ── 3. Cô lập hai gia sư ──────────────────────────────────────────────────────────────────────────
  section("3. Cô lập: gia sư B mở lớp của A ở MỌI đường → màn 'Bạn không có quyền với lớp này', không lộ tên lớp / học sinh / chuyển hướng");
  const PATHS = ["", "/giao-trinh", "/hoc-vien", "/diem-danh", "/lich-hoc", "?tab=cai-dat", "?tab=chuong-bai", "/hoc-vien?muc=ma-moi", "/giao-trinh/xem/khong-co", "/diem-danh/in"];
  for (const p of PATHS) {
    const r = await api("GET", `${QL}/${idA}${p}`, { as: B });
    const ok = hasGate(r.text, "forbidden") && go(r).to === null && !r.text.includes("Lớp Toán Bí Mật Của Cô A") && !r.text.includes("Học Sinh Bí Mật") && !r.text.includes(A.name) && !r.text.includes("cdn.example.com");
    check(`B → …/<A>${p || "/"}: màn không có quyền, không lộ tên lớp / học sinh / chủ lớp / ảnh bìa`, ok, { s: r.status, gate: hasGate(r.text, "forbidden"), to: go(r).to, leak: r.text.includes("Lớp Toán Bí Mật") });
  }
  const own = await api("GET", `${QL}/${idB}/giao-trinh`, { as: B });
  check("B mở lớp CỦA B → vào được (không màn cấm), đúng 1 h1 = tên lớp B", !hasGate(own.text, "forbidden") && own.text.includes("Lớp Văn Riêng Của Thầy B") && h1Count(own.text) === 1, [own.status, h1Count(own.text)]);
  const ownA = await api("GET", `${QL}/${idB}/giao-trinh`, { as: A });
  check("và A KHÔNG vào được lớp của B (đối xứng)", hasGate(ownA.text, "forbidden") && !ownA.text.includes("Lớp Văn Riêng Của Thầy B"));

  section("3b. API: lớp của gia sư khác → 403, không có → 404 (mã HTTP thật nằm ở API)");
  const apiProbes: [string, () => Promise<Res>][] = [
    ["GET /api/tutor/lop/<A>/giao-trinh", () => api("GET", `/api/tutor/lop/${idA}/giao-trinh`, { as: B })],
    ["GET /api/courses/<A>/class-schedules", () => api("GET", `/api/courses/${idA}/class-schedules`, { as: B })],
    ["GET /api/tutor/lop/<A>/yeu-cau", () => api("GET", `/api/tutor/lop/${idA}/yeu-cau`, { as: B })],
    ["GET /api/tutor/lop/<A>/giao-vien", () => api("GET", `/api/tutor/lop/${idA}/giao-vien`, { as: B })],
    ["POST /api/media/document/init (courseId của A)", () => api("POST", "/api/media/document/init", { as: B, body: { courseId: idA, fileName: "a.pdf", size: 1000, mimeType: "application/pdf", confirmedNotice: true } })],
    ["POST /api/media/document/init (đồng giảng, không phải chủ)", () => api("POST", "/api/media/document/init", { as: CO, body: { courseId: idA, fileName: "a.pdf", size: 1000, mimeType: "application/pdf", confirmedNotice: true } })],
  ];
  for (const [n, f] of apiProbes) { const r = await f(); check(`${n} → 403`, r.status === 403 && !/Lớp Toán Bí Mật|Học Sinh Bí Mật/.test(r.text), [r.status, r.text.slice(0, 120)]); }
  const n404 = await api("POST", "/api/media/document/init", { as: B, body: { courseId: "khong-co-lop", fileName: "a.pdf", size: 1000, mimeType: "application/pdf", confirmedNotice: true } });
  check("POST /api/media/document/init với lớp không có → 404", n404.status === 404, n404.status);
  const co404 = await api("GET", "/api/tutor/lop/khong-co-lop/giao-trinh", { as: B });
  check("GET /api/tutor/lop/<không có>/giao-trinh → 404", co404.status === 404, co404.status);
  const coSched = await api("GET", `/api/courses/${idA}/class-schedules`, { as: CO });
  check("Q5: đồng giảng ĐỌC được khung giờ (course.view) → tab 'Lịch học' của đồng giảng dùng được", coSched.status === 200 && Array.isArray(coSched.json), coSched.status);
  const subSched = await api("GET", `/api/courses/${idA}/class-schedules`, { as: SUB });
  check("Q5: giáo viên bộ môn cũng đọc được khung giờ", subSched.status === 200, subSched.status);
  const noAuth = await api("POST", "/api/media/document/init", { body: { courseId: idA, fileName: "a.pdf", size: 1000, confirmedNotice: true } });
  check("chưa đăng nhập → 401", noAuth.status === 401, noAuth.status);

  // ── 4. Id lạ ─────────────────────────────────────────────────────────────────────────────────────
  section("4. Id lạ: không có / NUL / quá dài → màn 'Không tìm thấy lớp', không 500");
  const weird: [string, string][] = [["khong-co", "khong-co"], ["chứa %00", "a%00b"], ["300 ký tự", "x".repeat(300)], ["a%2Fb", "a%2Fb"], ["..%2F..%2Fadmin", "..%2F..%2Fadmin"], ["dấu cách", "a%20b"]];
  for (const [label, id] of weird) {
    for (const sub of ["", "/giao-trinh", "/hoc-vien", "/diem-danh"]) {
      const r = await api("GET", `${QL}/${id}${sub}`, { as: A });
      check(`id ${label} ${sub || "(gốc)"} → không 500, màn không tìm thấy, không chuyển hướng`, r.status < 500 && hasGate(r.text, "not-found") && go(r).to === null, [r.status, hasGate(r.text, "not-found"), go(r).to]);
    }
  }
  const idPhaAdmin = await api("GET", `${QL}/${idA}%2F..%2F..%2Fadmin`, { as: A });
  check("id có %2F..%2F không thoát khỏi nhóm lớp (không vào trang quản trị)", idPhaAdmin.status < 500 && hasGate(idPhaAdmin.text, "not-found"), idPhaAdmin.status);

  // ── 5. Gia sư chờ duyệt, khách, học sinh, quản trị ───────────────────────────────────────────────
  section("5. Gia sư chờ duyệt / khách / học sinh / quản trị mở quan-lop/**");
  for (const p of ["", "/giao-trinh", "/hoc-vien", "/diem-danh", "/lich-hoc", "?tab=cai-dat", "?tab=chuong-bai"]) {
    const rp = await api("GET", `${QL}/${idA}${p}`, { as: PEND });
    check(`chờ duyệt → …/<A>${p || "/"}: chuyển /lop-cua-toi/cho-duyet, không lộ lớp`, go(rp).to === "/lop-cua-toi/cho-duyet" && !rp.text.includes("Lớp Toán Bí Mật"), [rp.status, go(rp).to]);
    const rg = await api("GET", `${QL}/${idA}${p}`);
    check(`khách → …/<A>${p || "/"}: chuyển /dang-nhap?redirect=, không lộ lớp`, (go(rg).to ?? "").startsWith("/dang-nhap?redirect=") && !rg.text.includes("Lớp Toán Bí Mật"), [rg.status, go(rg).to]);
    const rs = await api("GET", `${QL}/${idA}${p}`, { as: STU });
    check(`học sinh → …/<A>${p || "/"}: chuyển /lop-cua-toi, không lộ lớp`, go(rs).to === "/lop-cua-toi" && !rs.text.includes("Lớp Toán Bí Mật"), [rs.status, go(rs).to]);
    const ra = await api("GET", `${QL}/${idA}${p}`, { as: ADM });
    check(`quản trị cấp 1 → …/<A>${p || "/"}: về /admin (vỏ gia sư không phải của họ), không lộ lớp`, go(ra).to === "/admin" && !ra.text.includes("Lớp Toán Bí Mật"), [ra.status, go(ra).to]);
  }

  // ── 6. Đồng giảng / bộ môn ───────────────────────────────────────────────────────────────────────
  section("6. Đồng giảng / giáo viên bộ môn: chỉ Giáo trình + Lịch học; mọi tab còn lại → /lop-cua-toi/<id>");
  for (const [who, u] of [["đồng giảng", CO], ["bộ môn", SUB]] as [string, TUser][]) {
    for (const p of ["/hoc-vien", "/diem-danh", "?tab=cai-dat", "?tab=chuong-bai", "?tab=hoc-vien"]) {
      const r = await api("GET", `${QL}/${idA}${p}`, { as: u });
      check(`${who} → …/<A>${p} → /lop-cua-toi/<A>`, go(r).to === `/lop-cua-toi/${idA}`, [r.status, go(r).to]);
    }
    for (const p of ["/giao-trinh", "/lich-hoc"]) {
      const r = await api("GET", `${QL}/${idA}${p}`, { as: u });
      const strip = /<nav[^>]*aria-label="Trang của[^"]*"[^>]*>([\s\S]*?)<\/nav>/.exec(r.text)?.[1] ?? "";
      const labels = [...strip.matchAll(/<a [^>]*>([\s\S]*?)<\/a>/g)].map(m => m[1].replace(/<[^>]+>/g, "").trim());
      check(`${who} → …/<A>${p}: vào được, dải chỉ "Giáo trình · Lịch học", đúng 1 h1`, !hasGate(r.text, "forbidden") && go(r).to === null && labels.join(" · ") === "Giáo trình · Lịch học" && h1Count(r.text) === 1, [r.status, labels, h1Count(r.text)]);
    }
  }

  // ── 7. API tổng hợp danh sách lớp (gallery) ──────────────────────────────────────────────────────
  section("7. GET /api/tutor/lop (thư viện lớp): chỉ lớp của mình, cover là null hoặc https đã lọc, không tên học sinh");
  const la = await api("GET", "/api/tutor/lop", { as: A });
  const lb = await api("GET", "/api/tutor/lop", { as: B });
  check("A thấy đúng lớp của A, không thấy lớp của B", la.status === 200 && la.json.rows.length === 1 && la.json.rows[0].id === idA && !la.text.includes("Lớp Văn Riêng") && lb.json.rows.length === 1 && lb.json.rows[0].id === idB && !lb.text.includes("Lớp Toán Bí Mật"), [la.json?.rows?.map((r: any) => r.id), lb.json?.rows?.map((r: any) => r.id)]);
  check("cover của A = https đã lọc (url(...) trong bg); cover của B (gradient) = null", la.json.rows[0].cover === "https://cdn.example.com/a/bia.jpg" && lb.json.rows[0].cover === null, [la.json.rows[0].cover, lb.json.rows[0].cover]);
  check("không rò chuỗi bg thô, tên học sinh, email, số điện thoại", !/url\(|linear-gradient|bg"/.test(la.text + lb.text) && !la.text.includes("Học Sinh Bí Mật") && !/@test\.local|phone|email/i.test(la.text), la.text.slice(0, 300));
  check("hình dạng cũ vẫn còn đủ (chỉ THÊM cover)", ["id", "name", "category", "classStatus", "hidden", "students", "capacity", "schedule", "sessionsTaught"].every(k => k in la.json.rows[0]) && la.json.rows[0].students === 1 && typeof la.json.totalStudents === "number");
  await prisma.course.update({ where: { id: idA }, data: { bg: 'url("javascript:alert(1)")' } });
  const lbad = await api("GET", "/api/tutor/lop", { as: A });
  check("bg độc (url(javascript:…)) → cover null", lbad.json.rows[0].cover === null, lbad.json.rows[0].cover);
  await prisma.course.update({ where: { id: idA }, data: { bg: 'url("http://insecure.example.com/x.jpg")' } });
  check("bg http: → cover null (chỉ https)", (await api("GET", "/api/tutor/lop", { as: A })).json.rows[0].cover === null);
  const lGuest = await api("GET", "/api/tutor/lop");
  const lStu = await api("GET", "/api/tutor/lop", { as: STU });
  const lPend = await api("GET", "/api/tutor/lop", { as: PEND });
  check("khách 401; học sinh / chờ duyệt không xem được (403)", lGuest.status === 401 && lStu.status === 403 && lPend.status === 403, [lGuest.status, lStu.status, lPend.status]);

  // ── 8. Kế hoạch buổi không còn trong thanh bên nhưng route còn ───────────────────────────────────
  section("8. Route Kế hoạch buổi vẫn chạy (lối vào từ Lịch / chi tiết buổi dùng nó)");
  const kh = await api("GET", "/lop-cua-toi/ke-hoach-buoi", { as: A });
  check("GET /lop-cua-toi/ke-hoach-buoi → 200", kh.status === 200 && go(kh).to === null, [kh.status, go(kh).to]);

  await done();
})();
