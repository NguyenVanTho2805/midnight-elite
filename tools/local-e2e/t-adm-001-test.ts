// ADM-001 — BÀI BỔ SUNG của adm-test (mô hình kẻ tấn công / leo quyền miền quản trị). Bổ sung cho t-adm-001.ts (adm-code), KHÔNG lặp lại ca của bài đó.
// A. Ma trận leo quyền: 5 phiên (khách, học sinh, gia sư, admin_content, admin_super) × route articles (SCL F1: đã xoá → 404) / students / restore / nhat-ky / enrollments.
//    Gia sư KHÔNG BAO GIỜ nhận 2xx/3xx. Mọi lần bị chặn: AuditLog không tăng, bản ghi không đổi.
// B, C (body tấn công / kiểu sai vào articles): SCL F1 bỏ cùng route.
// C. Kiểu dữ liệu sai / rác (ghi nhận hành vi, KHÔNG bắt đỏ — validator thuộc ADM-002): chỉ bắt đỏ khi nó ghi DB hoặc để lại nhật ký.
// D. Students: restore bởi admin_content/gia sư khi em ĐANG ẩn → 403 và vẫn ẩn; wasBanned; lớp suspended không chặn ẩn; cookie cũ của em vừa ẩn bị chặn khi GHI; ?includeHidden=… lạ không lọt bản ẩn.
// E. Nhật ký: không metadata, không tên / email / SĐT / trường của học sinh ở bất kỳ trường nào; bộ lọc phá vẫn 200; chỉ cấp 1 đọc được.
// Chạy (COO, tuần tự, sau `prisma db push` + `prisma generate` + restart Next dev):  source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-adm-001-test.ts
// Bài KHÔNG gọi /api/auth/login (dùng cookieFor) nên không đụng giới hạn đăng nhập 10 lần/phút.
//
// CA PHÁ CỐ Ý (chạy tay từng thứ rồi hoàn lại):
//   - Bỏ `banned: true` khỏi data của DELETE students/[id] → ca D3 đỏ (cookie cũ của em vừa ẩn không còn bị 403 khi ghi).
//   - Đổi `requirePermission(MANAGE_STUDENTS)` ở restore thành MANAGE_NEWS → ca A2 / D1 đỏ (admin_content khôi phục được).
//   - Cho `includeHidden !== "0"` ở GET students → ca D5 đỏ.
//   - Thêm 'authorId' vào UPDATABLE_FIELDS → ca B3 đỏ.
import { prisma } from "@/lib/prisma";
import { api, cookieFor, mkUser, mkTutor, mkSuper, mkCourse, wipe, check, section, done, type TUser } from "./h";

const ART = "/api/admin/articles";
const STU = "/api/admin/students";
const auditCount = () => prisma.auditLog.count();
const body = (slug: string, extra: Record<string, unknown> = {}) => ({ title: `Bài ${slug}`, slug, excerpt: "Tóm tắt.", content: "Nội dung.", category: "tuyen-sinh", published: false, ...extra });
const note = (label: string, v: unknown) => console.log(`  ℹ ${label}:`, JSON.stringify(v)?.slice(0, 300));
const is2xx3xx = (s: number) => s >= 200 && s < 400;

(async () => {
  await wipe();
  const SA = await mkSuper("Quản trị Hà");
  const CA = await mkUser({ name: "Biên tập Bình", role: "admin", adminRole: "admin_content" });
  const T = await mkTutor("Cô Lan");
  const S = await mkUser({ name: "Học sinh Gọi Thử" });
  const X = await mkUser({ name: "Phạm Bé Kín Tiếng" });
  await prisma.user.update({ where: { id: X.id }, data: { phone: "0987654321", school: "THCS Bí Mật Xanh" } });

  // SCL F1 (Q8): phần Tin tức đã xoá ⇒ /api/admin/articles không còn; ma trận A1 kiểm route đã mất hẳn (404) với mọi vai, phần B/C (body tấn công bài viết) bỏ.
  const A0 = "bai-khong-con";

  // ───────────────────────────── A. LEO QUYỀN ─────────────────────────────
  section("A. Ma trận leo quyền (khách · học sinh · gia sư · admin_content · admin_super)");
  const seen: number[] = [];                       // mọi mã trả về cho GIA SƯ — không được có 2xx/3xx
  const run = async (method: string, path: string, who: TUser | undefined, b?: unknown) => {
    const r = await api(method, path, { as: who, body: b });
    if (who?.id === T.id) seen.push(r.status);
    return r.status;
  };
  const xBefore = await prisma.user.findUnique({ where: { id: X.id } });
  const n0 = await auditCount();

  // A1: articles — route đã xoá: mọi vai 404 (không còn 2xx nào).
  const artDenied: [string, string, unknown?][] = [["GET", ART], ["POST", ART, body("len-quyen")], ["GET", `${ART}/${A0}`], ["PATCH", `${ART}/${A0}`, { title: "Bị sửa" }], ["DELETE", `${ART}/${A0}`]];
  const resA1: Record<string, number[]> = {};
  for (const [m, p, b] of artDenied) resA1[`${m} ${p.replace(A0, ":id")}`] = [await run(m, p, undefined, b), await run(m, p, S, b), await run(m, p, T, b)];
  check("A1. articles GET/POST/PATCH/DELETE (đã xoá): khách, học sinh, gia sư đều 404", Object.values(resA1).every(r => r.every(x => x === 404)), resA1);
  check("A1b. admin_content và admin_super cũng 404", (await run("GET", ART, CA)) === 404 && (await run("GET", ART, SA)) === 404);

  // A2: students / restore / nhat-ky / enrollments — chỉ admin_super (MANAGE_STUDENTS / VIEW_STUDENTS / MANAGE_ADMINS). admin_content KHÔNG có.
  const supOnly: [string, string, unknown?][] = [
    ["GET", STU], ["GET", `${STU}?includeHidden=1`], ["POST", STU, { name: "Lén Tạo", email: "len@test.local" }], ["PUT", `${STU}/${X.id}`, { name: "Bị Sửa" }],
    ["PATCH", `${STU}/${X.id}`], ["DELETE", `${STU}/${X.id}`], ["POST", `${STU}/${X.id}/restore`],
    ["POST", "/api/admin/enrollments", { userId: X.id, courseId: "x" }], ["GET", "/api/admin/nhat-ky"],
  ];
  const resA2: Record<string, number[]> = {};
  for (const [m, p, b] of supOnly) resA2[`${m} ${p.replace(X.id, ":id")}`] = [await run(m, p, undefined, b), await run(m, p, S, b), await run(m, p, T, b), await run(m, p, CA, b)];
  check("A2. students (GET/POST/PUT/PATCH/DELETE), restore, enrollments POST, nhat-ky: khách 401; học sinh, gia sư, admin_content đều 403", Object.values(resA2).every(([a, s, t, c]) => a === 401 && s === 403 && t === 403 && c === 403), resA2);
  check("A3. GIA SƯ không nhận một mã 2xx/3xx nào trong cả ma trận", seen.length >= 14 && seen.every(s => !is2xx3xx(s)), seen);
  const xAfter = await prisma.user.findUnique({ where: { id: X.id } });
  check("A4. sau cả ma trận: AuditLog không tăng; học sinh X giữ nguyên (tên, deletedAt, banned); không có bài 'len-quyen'; không có user 'len@test.local'",
    (await auditCount()) === n0 && xAfter?.name === xBefore?.name && xAfter?.deletedAt === null && xAfter?.banned === false
      && (await prisma.article.count({ where: { slug: "len-quyen" } })) === 0 && (await prisma.user.count({ where: { email: "len@test.local" } })) === 0,
    { audit: [n0, await auditCount()], x: xAfter && [xAfter.name, xAfter.deletedAt, xAfter.banned] });
  check("A5. admin_super đọc danh sách học sinh → 200 (đối chứng: ma trận trên chặn đúng người, không chặn tất cả)", (await run("GET", STU, SA)) === 200 && (await run("GET", "/api/admin/nhat-ky", SA)) === 200);

  // ───────────────────────────── D. STUDENTS ─────────────────────────────
  section("D. Students: leo quyền khi ĐANG ẩn, wasBanned, lớp suspended, cookie cũ, includeHidden lạ");
  const H = await mkUser({ name: "Lê Bé Đã Ẩn" });
  const cookieOld = await cookieFor(H);                                   // cookie cấp TRƯỚC khi ẩn — phiên còn sống
  const hide = await api("DELETE", `${STU}/${H.id}`, { as: SA });
  check("D0. SA ẩn H (không còn lớp) → 200", hide.status === 200 && hide.json.ok === true, hide.json);

  const nh = await auditCount();
  const rest = [await api("POST", `${STU}/${H.id}/restore`, { as: CA }), await api("POST", `${STU}/${H.id}/restore`, { as: T }), await api("POST", `${STU}/${H.id}/restore`, { as: H }), await api("POST", `${STU}/${H.id}/restore`)];
  const hRow = await prisma.user.findUnique({ where: { id: H.id } });
  check("D1. H đang ẩn: admin_content / gia sư / chính H khôi phục → 403, khách → 401; H VẪN ẩn (deletedAt != null, banned true); không audit thêm",
    rest.map(x => x.status).join() === "403,403,403,401" && hRow?.deletedAt !== null && hRow?.banned === true && (await auditCount()) === nh, [rest.map(x => x.status), hRow && [hRow.deletedAt, hRow.banned]]);

  // D2: wasBanned — em bị khoá từ trước rồi mới ẩn; khôi phục thì mở khoá (đặc tả: vô điều kiện). Ghi rõ ở metadata.
  const W = await mkUser({ name: "Võ Bé Từng Khoá" });
  await prisma.user.update({ where: { id: W.id }, data: { banned: true } });
  const CW = await mkCourse(T.id, { name: "Lớp nền W" });
  await prisma.enrollment.create({ data: { userId: W.id, courseId: CW.id, status: "suspended" } });
  const hw = await api("DELETE", `${STU}/${W.id}`, { as: SA });
  const hwLog = await prisma.auditLog.findFirst({ where: { action: "student.hide", resourceId: W.id } });
  check("D2a. em đã bị khoá từ trước rồi ẩn → 200; metadata.wasBanned === true; không tên/email/SĐT trong metadata",
    hw.status === 200 && (hwLog?.metadata as { wasBanned?: boolean } | null)?.wasBanned === true && !JSON.stringify(hwLog?.metadata ?? {}).includes("Võ"), [hw.status, hwLog?.metadata]);
  const rw = await api("POST", `${STU}/${W.id}/restore`, { as: SA });
  const wRow = await prisma.user.findUnique({ where: { id: W.id } });
  check("D2b. khôi phục → deletedAt null và banned false (khôi phục MỞ KHOÁ cả em vốn bị khoá — hành vi theo đặc tả; xem cờ P3 trong phiếu)", rw.status === 200 && wRow?.deletedAt === null && wRow?.banned === false, wRow && [wRow.deletedAt, wRow.banned]);

  // D3: cookie CŨ của em vừa ẩn — yêu cầu GHI bị chặn (getSessionChecked đối chiếu banned); không ghi được dữ liệu.
  const evOld = { title: "Việc lén", dateKey: new Date().toISOString().slice(0, 10), startTime: "09:00", endTime: "10:00" };
  const wr = await fetch((process.env.BASE ?? "http://localhost:3100") + "/api/student/lich-rieng", { method: "POST", headers: { cookie: cookieOld, "content-type": "application/json" }, body: JSON.stringify(evOld) });
  const wrTxt = await wr.text();
  check("D3. cookie cũ của H (đã ẩn) POST /api/student/lich-rieng → 403 'khóa'; không có StudentPersonalEvent nào của H", wr.status === 403 && /khóa/.test(wrTxt) && (await prisma.studentPersonalEvent.count({ where: { userId: H.id } })) === 0, [wr.status, wrTxt.slice(0, 120)]);
  const rd = await fetch((process.env.BASE ?? "http://localhost:3100") + "/api/student/lich-rieng?from=2026-11-01&to=2026-11-07", { headers: { cookie: cookieOld } });
  note("cookie cũ của em ẩn GỌI ĐỌC (GET lich-rieng) → mã (200 = yêu cầu đọc chỉ tin token, theo thiết kế NC2-033; ghi nhận P3)", rd.status);
  check("D3b. cookie cũ của H không gọi được route quản trị nào (role student): DELETE students → 403 (SCL F1: articles đã xoá)", [await fetch((process.env.BASE ?? "http://localhost:3100") + `${STU}/${X.id}`, { method: "DELETE", headers: { cookie: cookieOld } })].every(x => x.status === 403) && (await prisma.article.count({ where: { slug: "hs-an-dang-bai" } })) === 0);

  // D4: khôi phục xong → cookie cũ dùng được lại (không bị 403 khoá) — chứng minh chặn thật nhờ cờ, không phải do cookie hỏng.
  const rr = await api("POST", `${STU}/${H.id}/restore`, { as: SA });
  const wr2 = await fetch((process.env.BASE ?? "http://localhost:3100") + "/api/student/lich-rieng", { method: "POST", headers: { cookie: cookieOld, "content-type": "application/json" }, body: JSON.stringify(evOld) });
  check("D4. sau khi SA khôi phục H, cùng cookie cũ không còn bị 403 khoá (201 hoặc 400 nội dung, KHÔNG 401/403)", rr.status === 200 && ![401, 403].includes(wr2.status), wr2.status);

  // D5: includeHidden lạ không lọt bản ẩn.
  const Z = await mkUser({ name: "Đào Bé Ẩn Z" });
  await api("DELETE", `${STU}/${Z.id}`, { as: SA });
  const variants = ["abc", "0", "true", "yes", "2", "", "1%20", "%31", "1&includeHidden=0"];
  const leak: string[] = [];
  for (const v of variants) {
    const g = await api("GET", `${STU}?includeHidden=${v}`, { as: SA });
    const has = Array.isArray(g.json) && g.json.some((x: { id: string }) => x.id === Z.id);
    if (v === "%31") { if (!(g.status === 200 && has)) leak.push(`%31 (giải mã thành '1') phải lọt: ${g.status},${has}`); }   // '%31' = '1' sau giải mã — đối chứng hợp lệ
    else if (v === "1&includeHidden=0") { /* tham số đầu thắng ('1') — chỉ ghi nhận */ note("includeHidden=1&includeHidden=0 → lọt?", has); }
    else if (g.status !== 200 || has) leak.push(`${v}: ${g.status},${has}`);
  }
  check("D5. ?includeHidden = abc / 0 / true / yes / 2 / rỗng / '1 ' → 200 và KHÔNG có bản ẩn; chỉ đúng '1' mới trả", leak.length === 0, leak);
  const pg = await api("GET", `${STU}?page=1&limit=2&includeHidden=abc`, { as: SA });
  check("D5b. phân trang + includeHidden=abc → không có bản ẩn trong data", pg.status === 200 && Array.isArray(pg.json?.data) && !pg.json.data.some((x: { id: string }) => x.id === Z.id), pg.json && Object.keys(pg.json));
  note("phân trang: total (đếm cả bản ẩn) so với số dòng hiện — P3 nếu total > số học sinh đang hiện", { total: pg.json?.total, visible: (await api("GET", STU, { as: SA })).json?.length });

  // D6: ghi nhận (không đỏ): PUT trên gia sư / trên em đã ẩn; ẩn đồng thời hai lần.
  const putT = await api("PUT", `${STU}/${T.id}`, { as: SA, body: { name: T.name } });
  const putZ = await api("PUT", `${STU}/${Z.id}`, { as: SA, body: { name: "Đào Bé Ẩn Z" } });
  note("PUT /students/:id trên GIA SƯ (role admin) → mã (200 = thiếu kiểm role, P2)", putT.status);
  note("PUT /students/:id trên em ĐÃ ẨN → mã (200 = sửa được bản ẩn)", putZ.status);
  const Q = await mkUser({ name: "Quách Bé Đua" });
  const [q1, q2] = await Promise.all([api("DELETE", `${STU}/${Q.id}`, { as: SA }), api("DELETE", `${STU}/${Q.id}`, { as: SA })]);
  const qHides = await prisma.auditLog.count({ where: { action: "student.hide", resourceId: Q.id } });
  note("hai DELETE đồng thời → mã và số dòng student.hide (2 = đua ghi, P3)", { q1: q1.status, q2: q2.status, hides: qHides });
  check("D6. hai DELETE đồng thời: cả hai 200, Q ẩn đúng một lần về trạng thái, student.hide là 1 hoặc 2 dòng (không 0, không 500)", q1.status === 200 && q2.status === 200 && qHides >= 1 && qHides <= 2 && (await prisma.user.findUnique({ where: { id: Q.id } }))?.deletedAt !== null, [q1.status, q2.status, qHides]);

  // ───────────────────────────── E. NHẬT KÝ ─────────────────────────────
  section("E. Nhật ký /api/admin/nhat-ky: không metadata, không PII học sinh ở bất kỳ trường nào");
  await api("DELETE", `${STU}/${X.id}`, { as: SA });                      // X có tên/SĐT/trường đặc trưng → student.hide
  await api("POST", `${STU}/${X.id}/restore`, { as: SA });
  const pii = [X.name, X.email, "0987654321", "Bí Mật Xanh", "Kín Tiếng", W.name, H.name, Z.name, "Võ Bé"];
  const pages = [await api("GET", "/api/admin/nhat-ky", { as: SA }), await api("GET", "/api/admin/nhat-ky?action=student.hide", { as: SA }), await api("GET", "/api/admin/nhat-ky?action=student.restore", { as: SA })];
  const leakedPii = pages.flatMap(p => pii.filter(n => p.text.includes(n)));
  check("E1. ba trang nhật ký (không lọc / student.hide / student.restore) → 200; không có tên, email, SĐT, trường của học sinh; không có khoá 'metadata', 'wasBanned', 'otherEnrollments'",
    pages.every(p => p.status === 200) && leakedPii.length === 0 && !pages.some(p => /metadata|wasBanned|otherEnrollments|activeEnrollments/.test(p.text)), leakedPii);
  const hideRows = pages[1].json?.rows ?? [];
  check("E2. student.hide: actionLabel 'Ẩn học sinh', resourceId đã rút gọn (không chứa id đầy đủ của X), actor là tên quản trị (không phải học sinh)",
    hideRows.length >= 3 && hideRows.every((x: { actionLabel: string; resourceId: string; actor: string }) => x.actionLabel === "Ẩn học sinh" && x.resourceId !== X.id && x.resourceId.length < X.id.length && x.actor !== X.name) && !pages[1].text.includes(X.id), hideRows[0]);
  const inj = await api("GET", "/api/admin/nhat-ky?action=student.hide'%20OR%201=1--&page=-5&from=2026-02-31", { as: SA });
  check("E3. bộ lọc phá (SQL trong action, trang âm, ngày 31/02) → 200, filter.action/from null, page 1; không 500", inj.status === 200 && inj.json.filter.action === null && inj.json.filter.from === null && inj.json.filter.page === 1, inj.json?.filter);
  const rawBig = await api("GET", `/api/admin/nhat-ky?action=${"a".repeat(10000)}.b`, { as: SA });
  note("action 10.000 ký tự → mã", rawBig.status);
  check("E4. action 10.000 ký tự không gây 500 (200 với bộ lọc bị bỏ, hoặc 4xx/414)", rawBig.status !== 500, rawBig.status);
  const nk = [await api("GET", "/api/admin/nhat-ky", { as: CA }), await api("GET", "/api/admin/nhat-ky", { as: T }), await api("GET", "/api/admin/nhat-ky", { as: S }), await api("GET", "/api/admin/nhat-ky")];
  check("E5. nhật ký: admin_content / gia sư / học sinh 403, khách 401 (nhắc lại sau khi đã có dòng student.*)", nk.map(x => x.status).join() === "403,403,403,401", nk.map(x => x.status));

  // Đếm cuối: mỗi thao tác thành công = đúng 1 dòng; mọi dòng ADM-001 có actor là người thật (không null).
  const adm = await prisma.auditLog.findMany({ where: { action: { in: ["student.hide", "student.restore", "article.create", "article.update", "article.publish", "article.unpublish", "article.delete"] } } });
  check("E6. mọi dòng student.* / article.* có actorId thuộc admin_super hoặc admin_content (không null, không học sinh/gia sư)", adm.length > 0 && adm.every(x => x.actorId === SA.id || x.actorId === CA.id), adm.filter(x => x.actorId !== SA.id && x.actorId !== CA.id).map(x => [x.action, x.actorId]));
  check("E7. metadata của MỌI dòng ADM-001 không chứa tên / email / SĐT / nội dung bài", adm.every(x => { const s = JSON.stringify(x.metadata ?? {}); return ![SA.name, CA.name, X.name, W.name, H.name, X.email, "0987654321", "Nội dung."].some(n => s.includes(n)); }), adm.map(x => x.metadata));

  await done();
})().catch(e => { console.error("CRASH", e); process.exit(1); });
