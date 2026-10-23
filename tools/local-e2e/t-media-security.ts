// MD-03 + QZ-14 + MD-09(trang) + MD-16 — API và DB thật: link học liệu theo vai, mật khẩu thi chỉ băm và không lộ qua GET, /xem-tai-lieu,
// hạn Azota theo giờ VN trong /api/deadlines. Cần máy chủ thử đang chạy (BASE). Bài gọi wipe(): chỉ dùng DB riêng của worktree.
import { api, mkTutor, mkUser, mkCourse, mkSuper, wipe, check, section, done, BASE } from "./h";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { addDaysKey, vnDateKeyOf } from "@/lib/classSessions";

const V = "https://video.example/secret-video", Z = "https://zoom.example/j/999", A1 = "https://azota.vn/secret-a1", A2 = "https://azota.vn/secret-a2";
const DOC_URL = "https://res.cloudinary.com/demo/raw/upload/secret-doc.pdf";
const AZ_JSON = JSON.stringify([A1, A2]);
const DOCS = JSON.stringify([{ name: "Tài liệu bí mật", url: DOC_URL }]);
const SECRETS = ["secret-video", "zoom.example", "secret-a1", "secret-a2", "secret-doc", "Tài liệu bí mật"];
const leaks = (j: unknown) => SECRETS.filter(s => JSON.stringify(j).includes(s));

async function lessonTree(courseId: string, tag: string) {
  const sec = await prisma.section.create({ data: { id: `s-${tag}`, title: "Phần 1", courseId, order: 0 } });
  const ch = await prisma.chapter.create({ data: { id: `ch-${tag}`, title: "Chương 1", sectionId: sec.id, order: 0 } });
  const mk = (id: string, isFree: boolean, order: number) => prisma.lesson.create({
    data: { id: `${id}-${tag}`, code: id, title: `Bài ${id}`, type: "record", chapterId: ch.id, order, isFree, isLocked: !isFree,
      videoUrl: V, zoomUrl: Z, azotaUrl: AZ_JSON, azotaDeadline: "2026-10-23T20:00", documents: DOCS, adminNote: "ghi chú gia sư" },
  });
  return { paid: await mk("paid", false, 0), free: await mk("free", true, 1) };
}

(async () => {
  await wipe();
  const T = await mkTutor("Cô Chủ Lớp"), T2 = await mkTutor("Thầy Lạ"), ADM = await mkSuper("Quản trị");
  const stuIn = await mkUser({ name: "HS đã ghi danh" }), stuOut = await mkUser({ name: "HS chưa ghi danh" });
  const stuSus = await mkUser({ name: "HS tạm ngưng" }), stuPend = await mkUser({ name: "HS chờ đồng ý" });
  const course = await mkCourse(T.id, { name: "Toán 9" });
  const orphan = await mkCourse(null, { name: "Lớp cũ không chủ" });
  for (const [u, st] of [[stuIn, "active"], [stuSus, "suspended"], [stuPend, "pending_consent"]] as const) {
    await prisma.enrollment.create({ data: { userId: u.id, courseId: course.id, status: st } });
  }
  const L = await lessonTree(course.id, "a");
  const LO = await lessonTree(orphan.id, "o");

  section("MD-03 · GET /api/courses/[id]");
  const lessonsOf = (r: { json: any }) => r.json.sections[0].chapters[0].lessons as any[];
  const pick = (r: { json: any }, id: string) => lessonsOf(r).find(l => l.id === id)!;
  const emptied = (l: any) => l.videoUrl === null && l.zoomUrl === null && l.azotaUrl === null && l.documents === "[]";
  const full = (l: any) => l.videoUrl === V && l.zoomUrl === Z && l.azotaUrl === AZ_JSON && l.documents === DOCS;
  const cg = await api("GET", `/api/courses/${course.id}`);
  check("khách: 200, thấy tên Bài; bài trả phí bị bỏ link", cg.status === 200 && pick(cg, L.paid.id).title === "Bài paid" && emptied(pick(cg, L.paid.id)), cg.json);
  check("khách: bài miễn phí MỞ link (isFree)", full(pick(cg, L.free.id)));
  check("khách: bài trả phí không chứa BẤT KỲ chuỗi bí mật nào (video, zoom, azota, tài liệu, tên tài liệu)", leaks(pick(cg, L.paid.id)).length === 0, leaks(pick(cg, L.paid.id)));
  const co = await api("GET", `/api/courses/${course.id}`, { as: stuOut });
  check("học viên CHƯA ghi danh: bài trả phí không có link, không có ghi chú gia sư", co.status === 200 && emptied(pick(co, L.paid.id)) && pick(co, L.paid.id).adminNote === null);
  check("học viên chưa ghi danh: bài trả phí không chứa chuỗi bí mật nào", leaks(pick(co, L.paid.id)).length === 0, leaks(pick(co, L.paid.id)));
  for (const [u, nm] of [[stuSus, "tạm ngưng (suspended)"], [stuPend, "chờ đồng ý (pending_consent)"]] as const) {
    const r = await api("GET", `/api/courses/${course.id}`, { as: u });
    check(`học viên ${nm}: KHOÁ link bài trả phí`, r.status === 200 && emptied(pick(r, L.paid.id)), r.json?.error);
  }
  const ci = await api("GET", `/api/courses/${course.id}`, { as: stuIn });
  check("học viên ĐÃ ghi danh (active): đủ link", full(pick(ci, L.paid.id)) && full(pick(ci, L.free.id)));
  const cT = await api("GET", `/api/courses/${course.id}`, { as: T });
  check("gia sư CHỦ lớp: đủ link", full(pick(cT, L.paid.id)));
  const cT2 = await api("GET", `/api/courses/${course.id}`, { as: T2 });
  check("gia sư LẠ (lớp của người khác): KHOÁ link bài trả phí", cT2.status === 200 && emptied(pick(cT2, L.paid.id)), cT2.json?.error);
  const cA = await api("GET", `/api/courses/${course.id}`, { as: ADM });
  check("quản trị cấp 1: đủ link", full(pick(cA, L.paid.id)));
  const cOrphanT = await api("GET", `/api/courses/${orphan.id}`, { as: T });
  check("lớp cũ KHÔNG chủ: gia sư bất kỳ bị khoá, quản trị vẫn thấy", emptied(pick(cOrphanT, LO.paid.id)) && full(pick(await api("GET", `/api/courses/${orphan.id}`, { as: ADM }), LO.paid.id)));

  section("MD-03 · GET /api/lessons/[id]/context");
  const ctxOf = (id: string, as?: any) => api("GET", `/api/lessons/${id}/context`, { as });
  check("chưa đăng nhập → 401", (await ctxOf(L.paid.id)).status === 401);
  const x1 = await ctxOf(L.paid.id, stuOut);
  check("chưa ghi danh xem bài TRẢ PHÍ: 403 và không có link nào trong thân", x1.status === 403 && leaks(x1.json).length === 0, x1.status);
  const x2 = await ctxOf(L.free.id, stuOut);
  check("chưa ghi danh xem bài MIỄN PHÍ: nhận link bài đó nhưng KHÔNG nhận link bài trả phí trong cây khoá", x2.status === 200 && full(x2.json.lesson) && emptied(x2.json.course.sections[0].chapters[0].lessons.find((l: any) => l.id === L.paid.id)), x2.status);
  const x3 = await ctxOf(L.paid.id, stuIn);
  check("đã ghi danh: đủ link", x3.status === 200 && full(x3.json.lesson) && x3.json.enrolled === true);
  const x4 = await ctxOf(L.paid.id, T2);
  check("gia sư LẠ: coi như người ngoài, bài trả phí → 403, không lộ link", x4.status === 403 && leaks(x4.json).length === 0, x4.status);
  const x5 = await ctxOf(L.paid.id, T);
  check("gia sư chủ lớp: đủ link", x5.status === 200 && full(x5.json.lesson));
  const x6 = await ctxOf(L.paid.id, stuSus);
  check("học viên tạm ngưng: xem lại bài theo quy tắc R01 (200, có link) — không bị nới thêm quyền nộp bài", x6.status === 200 && full(x6.json.lesson));
  const x7 = await ctxOf(L.paid.id, stuPend);
  check("học viên chờ đồng ý (pending_consent) xem bài TRẢ PHÍ → 403, không lộ link", x7.status === 403 && leaks(x7.json).length === 0, x7.status);

  section("MD-03 · GET /api/lessons/[id]");
  const gl = (id: string, as?: any) => api("GET", `/api/lessons/${id}`, { as });
  check("chưa đăng nhập → 401", (await gl(L.paid.id)).status === 401);
  check("học viên chưa ghi danh → 403", (await gl(L.paid.id, stuOut)).status === 403);
  check("học viên tạm ngưng / chờ đồng ý → 403", (await gl(L.paid.id, stuSus)).status === 403 && (await gl(L.paid.id, stuPend)).status === 403);
  const g1 = await gl(L.paid.id, stuIn);
  check("học viên đã ghi danh: 200, đủ link", g1.status === 200 && full(g1.json));
  check("học viên đã ghi danh KHÔNG nhận ownerId (định danh gia sư) ở bất kỳ chỗ nào", g1.status === 200 && !JSON.stringify(g1.json).includes("ownerId") && !JSON.stringify(g1.json).includes(T.id), g1.json?.chapter);
  check("…nhưng vẫn có chapter.section.courseId", g1.json?.chapter?.section?.courseId === course.id);
  check("gia sư LẠ → 403", (await gl(L.paid.id, T2)).status === 403);
  const g2 = await gl(L.paid.id, T);
  check("gia sư chủ lớp: 200, đủ link, không ownerId", g2.status === 200 && full(g2.json) && !JSON.stringify(g2.json).includes("ownerId"));
  const g3 = await gl(L.paid.id, ADM);
  check("quản trị: 200, không ownerId", g3.status === 200 && !JSON.stringify(g3.json).includes(T.id));
  check("lớp không chủ: gia sư → 403, quản trị → 200", (await gl(LO.paid.id, T)).status === 403 && (await gl(LO.paid.id, ADM)).status === 200);
  check("bài không tồn tại → 404", (await gl("khong-co", ADM)).status === 404);

  section("MD-09 · trang /xem-tai-lieu");
  // Trang là client component nhưng vẫn render phía máy chủ (SSR); địa chỉ cũng nằm trong dữ liệu khung của Next nên chỉ kiểm THUỘC TÍNH HTML nguy hiểm.
  const page = async (u: string) => { const r = await fetch(`${BASE}/xem-tai-lieu?url=${encodeURIComponent(u)}&name=Tai+lieu`, { redirect: "manual" }); return { status: r.status, html: await r.text() }; };
  const danger = (h: string, needle: string) => new RegExp(`(href|src)="[^"]*${needle}`, "i").test(h);
  const REFUSED = "Không mở được tài liệu";
  for (const [nm, u, needle] of [["javascript:", "javascript:alert(1)", "javascript:"], ["data:", "data:text/html,<script>1</script>", "data:"], ["host lạ .pdf", "https://evil.example/a.pdf", "evil\\.example"], ["host lạ .docx (Office Viewer)", "https://evil.example/a.docx", "(evil\\.example|officeapps)"], ["//host cùng giao thức", "//evil.example/a.pdf", "evil\\.example"], ["Cloudinary của NGƯỜI KHÁC", "https://res.cloudinary.com/nguoi-khac/raw/upload/a.pdf", "cloudinary"], ["http (không https)", "http://docs.google.com/document/d/1/edit", "docs\\.google"]] as const) {
    const r = await page(u);
    check(`${nm}: 200, hiện thông báo tiếng Việt, KHÔNG có iframe/href/src nguy hiểm`, r.status === 200 && r.html.includes(REFUSED) && !/<iframe/i.test(r.html) && !danger(r.html, needle), { status: r.status, hasMsg: r.html.includes(REFUSED) });
  }
  const none = await page("");
  check("thiếu đường dẫn: thông báo 'Thiếu đường dẫn tài liệu'", none.html.includes("Thiếu đường dẫn tài liệu") || none.html.includes(REFUSED));
  const okInt = await page("/api/files/bai-giang.pdf");
  check("đường dẫn nội bộ .pdf hợp lệ: nhúng iframe tới đúng đường dẫn đó", /<iframe[^>]+src="\/api\/files\/bai-giang\.pdf"/.test(okInt.html) && !okInt.html.includes(REFUSED), okInt.html.match(/<iframe[^>]*>/)?.[0]);
  const okG = await page("https://docs.google.com/document/d/ABC123/edit?usp=sharing");
  check("Google Docs hợp lệ: nhúng bản /preview", /<iframe[^>]+src="https:\/\/docs\.google\.com\/document\/d\/ABC123\/preview"/.test(okG.html));
  const okInt2 = await page("/api/files/bai.docx");
  check("đường dẫn nội bộ .docx: KHÔNG gửi cho Office Viewer của Microsoft", !okInt2.html.includes("view.officeapps.live.com"));

  section("QZ-14 · mật khẩu vào thi");
  const mkExam = (as: any, body: Record<string, unknown>) => api("POST", "/api/exams", { as, body: { title: "Đề thử", category: "toan", date: "2026-10-30", time: "08:00", duration: "45 phút", questions: 1, status: "available", createdAt: new Date().toISOString(), ...body } });
  const addQ = async (examId: string) => {
    const q = await prisma.examQuestion.create({ data: { id: `q-${examId}`, examId, text: "1+1=?", type: "MC" } });
    await prisma.examOption.createMany({ data: [{ id: `o1-${q.id}`, questionId: q.id, text: "2", isCorrect: true, order: 0 }, { id: `o2-${q.id}`, questionId: q.id, text: "3", isCorrect: false, order: 1 }] });
  };
  const PW = "Bi-mat-Đề-1";
  const e1 = await mkExam(T, { password: PW });
  check("tạo đề có mật khẩu: 201, JSON không có password/passwordHash, hasPassword = true", e1.status === 201 && e1.json.hasPassword === true && !("password" in e1.json) && !("passwordHash" in e1.json) && !JSON.stringify(e1.json).includes(PW), e1.json);
  const row1 = await prisma.exam.findUnique({ where: { id: e1.json.id } });
  check("DB: password = null, passwordHash là bcrypt, không chứa mật khẩu gốc", row1?.password === null && /^\$2[aby]\$/.test(row1?.passwordHash ?? "") && !row1!.passwordHash!.includes(PW), row1?.password);
  await addQ(e1.json.id);
  for (const [nm, r] of [["GET /api/exams/[id]", await api("GET", `/api/exams/${e1.json.id}`, { as: T })], ["GET /api/exams (danh sách)", await api("GET", "/api/exams", { as: T })], ["GET /api/exams công khai", await api("GET", "/api/exams?activeOnly=1")], ["GET /api/exams/[id] khách", await api("GET", `/api/exams/${e1.json.id}`)]] as const) {
    const s = JSON.stringify(r.json ?? "");
    check(`${nm}: không chứa mật khẩu, băm hay tên cột bí mật`, !s.includes(PW) && !s.includes("passwordHash") && !s.includes(row1!.passwordHash!) && !/"password":/.test(s), r.status);
  }
  const pg = await api("GET", `/api/exams/${e1.json.id}`, { as: T });
  check("GET chi tiết: hasPassword = true", pg.json?.hasPassword === true);
  const startUrl = `/api/exams/${e1.json.id}/start`;
  check("vào thi KHÔNG mật khẩu → 403 'Sai mật khẩu'", (await api("POST", startUrl, { as: stuIn, body: {} })).status === 403);
  check("vào thi SAI mật khẩu → 403", (await api("POST", startUrl, { as: stuIn, body: { password: "sai" } })).status === 403);
  check("mật khẩu kiểu khác (số, mảng, đối tượng) → 403, không 500", (await Promise.all([123, [PW], { a: PW }, null].map(p => api("POST", startUrl, { as: stuIn, body: { password: p } })))).every(r => r.status === 403));
  check("chuyển đúng mật khẩu qua query string KHÔNG có tác dụng", (await api("POST", startUrl + `?password=${encodeURIComponent(PW)}`, { as: stuIn, body: {} })).status === 403);
  const ok1 = await api("POST", startUrl, { as: stuIn, body: { password: PW } });
  check("ĐÚNG mật khẩu → vào thi (2xx)", ok1.status >= 200 && ok1.status < 300, ok1.json);
  check("phản hồi vào thi không chứa mật khẩu hay băm", !JSON.stringify(ok1.json).includes(PW) && !JSON.stringify(ok1.json).includes("passwordHash"));
  const resume = await api("POST", startUrl, { as: stuIn, body: {} });
  check("vào lại (đang làm dở) không hỏi lại mật khẩu", resume.status >= 200 && resume.status < 300, resume.json);

  section("QZ-14 · đặt lại / bỏ / giữ nguyên");
  const hashBefore = (await prisma.exam.findUnique({ where: { id: e1.json.id } }))!.passwordHash;
  const keep = await api("PUT", `/api/exams/${e1.json.id}`, { as: T, body: { title: "Đề thử đổi tên" } });
  check("sửa đề KHÔNG gửi password → giữ nguyên băm cũ", keep.status === 200 && (await prisma.exam.findUnique({ where: { id: e1.json.id } }))!.passwordHash === hashBefore && keep.json.hasPassword === true);
  const reset = await api("PUT", `/api/exams/${e1.json.id}`, { as: T, body: { password: "Mat-khau-moi" } });
  const rowR = await prisma.exam.findUnique({ where: { id: e1.json.id } });
  check("đặt lại: băm mới khác băm cũ, password thô vẫn null, JSON sạch", reset.status === 200 && rowR!.passwordHash !== hashBefore && rowR!.password === null && !JSON.stringify(reset.json).includes("Mat-khau-moi"));
  check("sau khi đặt lại: mật khẩu CŨ không còn dùng được (với học viên chưa có lượt)", (await api("POST", startUrl, { as: stuOut, body: { password: PW } })).status !== 200);
  const clear = await api("PUT", `/api/exams/${e1.json.id}`, { as: T, body: { password: "" } });
  const rowC = await prisma.exam.findUnique({ where: { id: e1.json.id } });
  check("gửi chuỗi rỗng = bỏ mật khẩu (cả hai cột null), hasPassword = false", clear.status === 200 && rowC!.password === null && rowC!.passwordHash === null && clear.json.hasPassword === false);
  check("gia sư LẠ không đặt được mật khẩu đề của người khác", [403, 404].includes((await api("PUT", `/api/exams/${e1.json.id}`, { as: T2, body: { password: "chiem-quyen" } })).status) && (await prisma.exam.findUnique({ where: { id: e1.json.id } }))!.passwordHash === null);
  check("học viên không đặt được mật khẩu đề", [401, 403].includes((await api("PUT", `/api/exams/${e1.json.id}`, { as: stuIn, body: { password: "x" } })).status));

  section("QZ-14 · đề CŨ còn mật khẩu thô (tương thích ngược + tự nâng cấp)");
  const e2 = await mkExam(T, {});
  await addQ(e2.json.id);
  await prisma.exam.update({ where: { id: e2.json.id }, data: { password: "cu-123", passwordHash: null } });
  const lg = await api("GET", `/api/exams/${e2.json.id}`, { as: T });
  check("đề cũ: GET báo hasPassword = true nhưng không lộ chuỗi thô", lg.json.hasPassword === true && !JSON.stringify(lg.json).includes("cu-123"));
  check("đề cũ: sai mật khẩu → 403", (await api("POST", `/api/exams/${e2.json.id}/start`, { as: stuOut, body: { password: "cu-124" } })).status === 403);
  check("đề cũ: sai mật khẩu KHÔNG làm nâng cấp (vẫn còn bản thô)", (await prisma.exam.findUnique({ where: { id: e2.json.id } }))!.password === "cu-123");
  const lo = await api("POST", `/api/exams/${e2.json.id}/start`, { as: stuOut, body: { password: "cu-123" } });
  check("đề cũ: đúng mật khẩu thô vẫn vào thi được", lo.status >= 200 && lo.status < 300, lo.json);
  const up = await prisma.exam.findUnique({ where: { id: e2.json.id } });
  check("…và được TỰ NÂNG LÊN băm: password = null, passwordHash là bcrypt khớp mật khẩu", up!.password === null && !!up!.passwordHash && await bcrypt.compare(require("node:crypto").createHash("sha256").update("cu-123").digest("base64"), up!.passwordHash));
  const lo2 = await api("POST", `/api/exams/${e2.json.id}/start`, { as: stuPend, body: { password: "cu-123" } });
  check("sau khi nâng cấp, người khác vẫn vào được bằng mật khẩu cũ", lo2.status !== 403, lo2.json);

  section("MD-16 · /api/deadlines theo giờ Việt Nam");
  // Hạn "YYYY-MM-DDTHH:mm" không có múi giờ = giờ VN. Chọn mốc tương lai xa để không bị lọc 'hết hạn'.
  const ch = await prisma.lesson.update({ where: { id: L.paid.id }, data: { azotaDeadline: "2099-10-23T20:00" } });
  await prisma.lesson.update({ where: { id: L.free.id }, data: { azotaDeadline: "tối mai" } });
  const d2 = await api("GET", "/api/deadlines", { as: stuIn });
  const row = (d2.json as any[]).find(x => x.lessonId === ch.id);
  check("học viên thấy hạn của bài mình học, hiển thị '20:00 23/10' (không phải giờ máy chủ)", d2.status === 200 && row?.deadlineFormatted === "20:00 23/10", d2.json);
  check("hạn không đọc được ('tối mai') bị bỏ, không làm hỏng danh sách", !(d2.json as any[]).some(x => x.lessonId === L.free.id));
  check("azotaUrl trả về là MỘT link http (không phải chuỗi JSON)", row?.azotaUrl === A1, row?.azotaUrl);
  check("không đăng nhập → danh sách rỗng (không lộ hạn)", (await api("GET", "/api/deadlines")).json?.length === 0);
  check("học viên chưa ghi danh không thấy hạn của lớp", ((await api("GET", "/api/deadlines", { as: stuOut })).json as any[]).length === 0);
    await prisma.lesson.update({ where: { id: L.paid.id }, data: { azotaDeadline: "2020-01-01T08:00" } });
  check("hạn đã qua bị lọc", !((await api("GET", "/api/deadlines", { as: stuIn })).json as any[]).some(x => x.lessonId === L.paid.id));

  section("MD-16 · hạn Azota vào lịch học (/api/schedule)");
  const day = addDaysKey(vnDateKeyOf(new Date()), 2);
  await prisma.lesson.update({ where: { id: L.paid.id }, data: { azotaDeadline: `${day}T20:00`, azotaUrl: AZ_JSON } });
  await prisma.lesson.update({ where: { id: L.free.id }, data: { azotaDeadline: `${addDaysKey(day, 1)}T07:30`, azotaUrl: "javascript:alert(1)" } });
  const sc = await api("GET", "/api/schedule", { as: stuIn });
  const ev = (sc.json.events as any[]).find(e => e.id === `deadline-${L.paid.id}`);
  check("hạn dạng datetime-local ('…T20:00') vào lịch đúng NGÀY và đúng GIỜ VN (20:00, không còn 23:59)", sc.status === 200 && ev?.isoDate === day && ev?.time === "20:00", ev);
  check("bài có 2 link Azota: link của sự kiện là MỘT địa chỉ http (link đầu), không phải chuỗi JSON", ev?.link === A1, ev?.link);
  const ev2 = (sc.json.events as any[]).find(e => e.id === `deadline-${L.free.id}`);
  check("hạn 07:30 sáng giữ nguyên ngày (không lùi ngày do múi giờ)", ev2?.isoDate === addDaysKey(day, 1) && ev2?.time === "07:30", ev2);
  check("CA PHÁ: link 'javascript:' của gia sư KHÔNG được đưa vào sự kiện", ev2 && ev2.link === undefined, ev2?.link);
  await prisma.lesson.update({ where: { id: L.free.id }, data: { azotaDeadline: "tối mai" } });
  check("hạn không đọc được: bỏ khỏi lịch, lịch vẫn trả 200", (await api("GET", "/api/schedule", { as: stuIn })).status === 200 && !((await api("GET", "/api/schedule", { as: stuIn })).json.events as any[]).some(e => e.id === `deadline-${L.free.id}`));
  check("học viên chưa ghi danh không thấy hạn của lớp trong lịch", !((await api("GET", "/api/schedule", { as: stuOut })).json.events as any[]).some(e => e.id === `deadline-${L.paid.id}`));
  check("chưa đăng nhập → 401", (await api("GET", "/api/schedule")).status === 401);

  done();
})();
