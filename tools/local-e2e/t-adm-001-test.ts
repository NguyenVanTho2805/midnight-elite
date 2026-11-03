// ADM-001 — BÀI BỔ SUNG của adm-test (mô hình kẻ tấn công / leo quyền miền quản trị). Bổ sung cho t-adm-001.ts (adm-code), KHÔNG lặp lại ca của bài đó.
// A. Ma trận leo quyền: 5 phiên (khách, học sinh, gia sư, admin_content, admin_super) × route articles / students / restore / nhat-ky / enrollments.
//    Gia sư KHÔNG BAO GIỜ nhận 2xx/3xx. Mọi lần bị chặn: AuditLog không tăng, bản ghi không đổi.
// B. Body tấn công vào articles: authorId / id / createdAt / views / publishedAt không đổi được; update không ghi 'authorId' vào metadata.fields.
// C. Kiểu dữ liệu sai / rác (ghi nhận hành vi, KHÔNG bắt đỏ — validator thuộc ADM-002): chỉ bắt đỏ khi nó ghi DB hoặc để lại nhật ký.
// D. Students: restore bởi admin_content/gia sư khi em ĐANG ẩn → 403 và vẫn ẩn; wasBanned; lớp suspended không chặn ẩn; cookie cũ của em vừa ẩn bị chặn khi GHI; ?includeHidden=… lạ không lọt bản ẩn.
// E. Nhật ký: không metadata, không tên / email / SĐT / trường của học sinh ở bất kỳ trường nào; bộ lọc phá vẫn 200; chỉ cấp 1 đọc được.
// Chạy (COO, tuần tự, sau `prisma db push` + `prisma generate` + restart Next dev):  source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-adm-001-test.ts
// Bài KHÔNG gọi /api/auth/login (dùng cookieFor) nên không đụng giới hạn đăng nhập 10 lần/phút.
//
// CA PHÁ CỐ Ý (chạy tay từng thứ rồi hoàn lại):
//   - Bỏ `banned: true` khỏi data của DELETE students/[id] → ca D3 đỏ (cookie cũ của em vừa ẩn không còn bị 403 khi ghi).
//   - Đổi `requirePermission(MANAGE_STUDENTS)` ở restore thành MANAGE_NEWS → ca A2 / D1 đỏ (admin_content khôi phục được).
//   - Thêm `authorId` vào `data` của PATCH articles → ca B2 đỏ.
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

  // Bài mẫu do CA tạo (nền cho ma trận và tấn công body).
  const mk = await api("POST", ART, { as: CA, body: body("bai-nen") });
  const A0 = mk.json?.id as string;
  check("0. nền: CA tạo bài mẫu → 201", mk.status === 201 && !!A0, mk.json);

  // ───────────────────────────── A. LEO QUYỀN ─────────────────────────────
  section("A. Ma trận leo quyền (khách · học sinh · gia sư · admin_content · admin_super)");
  const seen: number[] = [];                       // mọi mã trả về cho GIA SƯ — không được có 2xx/3xx
  const run = async (method: string, path: string, who: TUser | undefined, b?: unknown) => {
    const r = await api(method, path, { as: who, body: b });
    if (who?.id === T.id) seen.push(r.status);
    return r.status;
  };
  const a0Before = await prisma.article.findUnique({ where: { id: A0 } });
  const xBefore = await prisma.user.findUnique({ where: { id: X.id } });
  const n0 = await auditCount();

  // A1: articles — chỉ admin_content / admin_super. Khách 401; học sinh, gia sư 403.
  const artDenied: [string, string, unknown?][] = [["GET", ART], ["POST", ART, body("len-quyen")], ["GET", `${ART}/${A0}`], ["PATCH", `${ART}/${A0}`, { title: "Bị sửa" }], ["DELETE", `${ART}/${A0}`]];
  const resA1: Record<string, number[]> = {};
  for (const [m, p, b] of artDenied) resA1[`${m} ${p.replace(A0, ":id")}`] = [await run(m, p, undefined, b), await run(m, p, S, b), await run(m, p, T, b)];
  check("A1. articles GET/POST/PATCH/DELETE: khách 401, học sinh 403, gia sư 403", Object.values(resA1).every(([a, s, t]) => a === 401 && s === 403 && t === 403), resA1);
  check("A1b. admin_content và admin_super đọc danh sách tin → 200", (await run("GET", ART, CA)) === 200 && (await run("GET", ART, SA)) === 200);

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
  const a0After = await prisma.article.findUnique({ where: { id: A0 } });
  const xAfter = await prisma.user.findUnique({ where: { id: X.id } });
  check("A4. sau cả ma trận: AuditLog không tăng; bài mẫu giữ nguyên; học sinh X giữ nguyên (tên, deletedAt, banned); không có bài 'len-quyen'; không có user 'len@test.local'",
    (await auditCount()) === n0 && a0After?.title === a0Before?.title && a0After?.updatedAt.getTime() === a0Before?.updatedAt.getTime() && xAfter?.name === xBefore?.name && xAfter?.deletedAt === null && xAfter?.banned === false
      && (await prisma.article.count({ where: { slug: "len-quyen" } })) === 0 && (await prisma.user.count({ where: { email: "len@test.local" } })) === 0,
    { audit: [n0, await auditCount()], x: xAfter && [xAfter.name, xAfter.deletedAt, xAfter.banned] });
  check("A5. admin_super đọc danh sách học sinh → 200 (đối chứng: ma trận trên chặn đúng người, không chặn tất cả)", (await run("GET", STU, SA)) === 200 && (await run("GET", "/api/admin/nhat-ky", SA)) === 200);

  // ───────────────────────────── B. BODY TẤN CÔNG ARTICLES ─────────────────────────────
  section("B. Body tấn công vào articles: authorId / id / createdAt / views / publishedAt");
  const evil = { authorId: SA.id, id: "id-gia-mao", createdAt: "2001-01-01T00:00:00.000Z", updatedAt: "2001-01-01T00:00:00.000Z", views: 999999, publishedAt: "2001-01-01T00:00:00.000Z" };
  let r = await api("POST", ART, { as: CA, body: body("bai-tan-cong", evil) });
  const B1 = r.status === 201 ? await prisma.article.findUnique({ where: { id: r.json.id } }) : null;
  check("B1. POST kèm authorId=SA, id giả, createdAt 2001, views 999999, publishedAt 2001 → 201 nhưng authorId = CA, id ≠ 'id-gia-mao', createdAt gần đây, views 0, publishedAt null (bản nháp)",
    r.status === 201 && B1?.authorId === CA.id && B1?.id !== "id-gia-mao" && B1!.createdAt.getFullYear() >= 2025 && B1?.views === 0 && B1?.publishedAt === null, B1 && { authorId: B1.authorId, id: B1.id, createdAt: B1.createdAt, views: B1.views, publishedAt: B1.publishedAt });

  const beforeP = await prisma.article.findUnique({ where: { id: A0 } });
  const nb = await auditCount();
  r = await api("PATCH", `${ART}/${A0}`, { as: SA, body: evil });
  const afterP = await prisma.article.findUnique({ where: { id: A0 } });
  check("B2. PATCH (admin_super) kèm đủ trường tấn công → 200 nhưng authorId, id, createdAt, views, publishedAt KHÔNG đổi",
    r.status === 200 && afterP?.authorId === beforeP?.authorId && afterP?.id === A0 && afterP?.createdAt.getTime() === beforeP?.createdAt.getTime() && afterP?.views === beforeP?.views && afterP?.publishedAt?.getTime() === beforeP?.publishedAt?.getTime(),
    { status: r.status, before: beforeP && [beforeP.authorId, beforeP.views], after: afterP && [afterP.authorId, afterP.views] });
  check("B2b. PATCH chỉ toàn trường tấn công (không trường nội dung) → KHÔNG ghi dòng article.update (fields rỗng)", (await auditCount()) === nb, [nb, await auditCount()]);

  r = await api("PATCH", `${ART}/${A0}`, { as: CA, body: { ...evil, title: "Chỉ đổi tiêu đề" } });
  const upd = await prisma.auditLog.findMany({ where: { resourceId: A0, action: "article.update" }, orderBy: { createdAt: "desc" }, take: 1 });
  const fields = ((upd[0]?.metadata as { fields?: string[] } | null)?.fields) ?? [];
  check("B3. PATCH { title + trường tấn công } → article.update.metadata.fields = ['title'] đúng, KHÔNG chứa authorId / id / views / createdAt / publishedAt",
    r.status === 200 && fields.includes("title") && !fields.some(f => ["authorId", "id", "views", "createdAt", "publishedAt", "updatedAt"].includes(f)), fields);

  // Chống tạo trùng slug / thiếu trường / nguồn sai: không để dòng nhật ký.
  const nc = await auditCount();
  const bad = [
    await api("POST", ART, { as: CA, body: body("bai-nen") }),                                        // slug trùng → 409
    await api("POST", ART, { as: CA, body: { ...body("thieu"), excerpt: "" } }),                      // thiếu → 400
    await api("POST", ART, { as: CA, body: body("nguon-xau", { sourceUrl: "javascript:alert(1)", sourceName: "x" }) }), // nguồn sai → 400
    await api("PATCH", `${ART}/khong-co`, { as: CA, body: { title: "x" } }),                          // 404
    await api("DELETE", `${ART}/khong-co`, { as: CA }),                                               // 404
    await api("PATCH", `${ART}/${A0}`, { as: CA, body: { slug: "bai-tan-cong" } }),                   // slug trùng → 409
  ];
  check("B4. thất bại hợp lệ (409 trùng slug, 400 thiếu/nguồn sai, 404, 409 PATCH trùng slug) → mã đúng và AuditLog KHÔNG tăng (logAction không nằm ở nhánh lỗi)",
    bad.map(x => x.status).join() === "409,400,400,404,404,409" && (await auditCount()) === nc, [bad.map(x => x.status), nc, await auditCount()]);

  // ───────────────────────────── C. KIỂU SAI / RÁC (ghi nhận) ─────────────────────────────
  section("C. Kiểu dữ liệu sai: ghi nhận mã trả về (P2 ADM-002 nếu 500); đỏ CHỈ khi ghi DB hoặc để lại nhật ký sai");
  const draft = await api("POST", ART, { as: CA, body: body("bai-kieu-sai") });
  const D = draft.json.id as string;
  const nd = await auditCount();
  const junk: [string, unknown][] = [
    ['published: "true" (chuỗi)', { published: "true" }], ["published: 1", { published: 1 }], ["published: null", { published: null }],
    ["title: 12345 (số)", { title: 12345 }], ["title: {} (object)", { title: {} }], ["readTime: 'abc'", { readTime: "abc" }], ["isPinned: 'yes'", { isPinned: "yes" }],
  ];
  const observed: Record<string, number> = {};
  for (const [label, patch] of junk) observed[label] = (await api("PATCH", `${ART}/${D}`, { as: CA, body: patch })).status;
  const dRow = await prisma.article.findUnique({ where: { id: D } });
  note("PATCH kiểu sai → mã (500 = P2 validator, thuộc ADM-002)", observed);
  check("C1. sau các PATCH kiểu sai: bài vẫn là bản nháp (published === false, publishedAt null), tiêu đề cũ", dRow?.published === false && dRow?.publishedAt === null && dRow?.title === "Bài bai-kieu-sai", dRow && { published: dRow.published, title: dRow.title });
  check("C2. không có 'article.publish' nào cho bài này và không dòng nhật ký nào lọt sau các PATCH lỗi (mọi mã 4xx/5xx → 0 dòng mới; mã 200 chỉ được kèm dòng update)",
    (await prisma.auditLog.count({ where: { resourceId: D, action: "article.publish" } })) === 0 &&
    ((await auditCount()) - nd) <= Object.values(observed).filter(s => s === 200).length, [nd, await auditCount(), observed]);
  const rt = await api("POST", ART, { as: CA, body: { ...body("bai-title-so"), title: 12345 } });
  const rp = await api("POST", ART, { as: CA, body: { ...body("bai-pub-chuoi"), published: "true" } });
  note("POST title số → mã", rt.status); note("POST published:'true' → mã", rp.status);
  check("C3. POST title số: không tạo bài 'bai-title-so' nếu không phải 201; POST published chuỗi: nếu 201 thì published là boolean thật",
    (rt.status === 201 || (await prisma.article.count({ where: { slug: "bai-title-so" } })) === 0) && (rp.status !== 201 || typeof (await prisma.article.findUnique({ where: { slug: "bai-pub-chuoi" } }))?.published === "boolean"), [rt.status, rp.status]);
  // Ghi nhận (không đỏ): slug rác, PATCH tiêu đề toàn khoảng trắng, JSON hỏng.
  const rs = await api("POST", ART, { as: CA, body: body("dâd ầ fsegs") });
  const rb = await api("PATCH", `${ART}/${D}`, { as: CA, body: { title: "   " } });
  const rj = await api("POST", ART, { as: CA, raw: "{khong-phai-json", headers: { "content-type": "application/json" } });
  note("POST slug 'dâd ầ fsegs' → mã (201 = chưa có validator slug, P2 ADM-002)", rs.status);
  note("PATCH title '   ' → mã (200 = tiêu đề rỗng lọt, P2 ADM-002; POST thì chặn 400)", rb.status);
  note("POST JSON hỏng → mã", rj.status);
  check("C4. JSON hỏng không phải 2xx", !is2xx3xx(rj.status), rj.status);

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
  check("D3b. cookie cũ của H không gọi được route quản trị nào (role student): DELETE/PATCH students, POST articles → 403", [await fetch((process.env.BASE ?? "http://localhost:3100") + `${STU}/${X.id}`, { method: "DELETE", headers: { cookie: cookieOld } }), await fetch((process.env.BASE ?? "http://localhost:3100") + ART, { method: "POST", headers: { cookie: cookieOld, "content-type": "application/json" }, body: JSON.stringify(body("hs-an-dang-bai")) })].every(x => x.status === 403) && (await prisma.article.count({ where: { slug: "hs-an-dang-bai" } })) === 0);

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
