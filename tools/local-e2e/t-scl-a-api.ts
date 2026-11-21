// SCL-A — bài API (máy chủ dev + DB riêng, wipe() ở đầu): thử KHAI THÁC từng lỗ của nhóm A. Trước khi sửa các ca dưới ĐỎ, sau sửa XANH.
//   P1-2  POST /api/exam-results: học sinh lớp khác ghi điểm · vượt tổng điểm đề · đề nháp / đề tắt · điểm tự khai vào báo cáo tháng (Q5: chờ duyệt).
//   P2-7  GET /api/exam-results?examId= và GET /api/exams/[id]: người ngoài lớp xem được; học sinh nhận userId.
//   P1-3/4 POST /api/courses (gia sư): lớp không "open" tự công khai; tên gia sư "KiN".
//   P2-8  Khoá tài khoản / đổi mật khẩu / xoá tài khoản: cookie cũ vẫn đọc được.
//   Rà soát: PATCH/PUT /api/courses/[id] (gia sư) đổi cách vào lớp phải kéo theo status; khoá trung tâm giữ "KiN"; học sinh pending_consent xem được đề,
//   suspended nhận đúng mã; điểm chờ duyệt không vào bảng xếp hạng chung; khách GET /api/exams?activeGuest=true không thấy đề gắn lớp.
// Chạy: source tools/local-e2e/env.sh && TZ=Asia/Ho_Chi_Minh npx tsx tools/local-e2e/t-scl-a-api.ts
import { prisma } from "@/lib/prisma";
import { api, cookieFor, mkUser, mkTutor, mkSuper, mkCourse, wipe, check, section, done, BASE } from "./h";
import { loadStudentMonth } from "@/lib/monthlyReportServer";
import { vnMonthKey } from "@/lib/revenue";
import { spawnSync } from "node:child_process";

const mkExam = (id: string, o: object) => prisma.exam.create({ data: { id, code: id, title: id, category: "toan", date: "01/01/2030", time: "08:00", duration: "45 phút", questions: 0, status: "available", createdAt: "2026-11-21", azotaUrl: "https://azota.vn/x", ...o } as never });
const raw = async (method: string, path: string, cookie: string, body?: unknown) => {
  const res = await fetch(BASE + path, { method, headers: { cookie, ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined, redirect: "manual" });
  const text = await res.text(); let json: any = null; try { json = JSON.parse(text); } catch { /* */ }
  return { status: res.status, json, text, setCookie: res.headers.get("set-cookie") ?? "" };
};

async function main() {
  await wipe();
  const T = await mkTutor("Cô Lan Chủ Lớp"), T3 = await mkTutor("Thầy Lớp Khác"), SA = await mkSuper("Quản trị");
  const C = await mkCourse(T.id, { name: "Toán 9" });
  const S = await mkUser({ name: "Em Trong Lớp" }), X = await mkUser({ name: "Em Lớp Khác" });
  await prisma.enrollment.create({ data: { userId: S.id, courseId: C.id, status: "active" } });
  await mkExam("az-lop", { ownerId: T.id, courseId: C.id, totalPoints: 10 });
  await mkExam("az-nhap", { ownerId: T.id, courseId: C.id, totalPoints: 10, isDraft: true });
  await mkExam("az-tat", { ownerId: T.id, courseId: C.id, totalPoints: 10, active: false });
  const YM = vnMonthKey(new Date());
  const base = JSON.stringify((await loadStudentMonth(T.id, S.id, YM))?.subjects.map(s => s.mastery));

  section("P1-2 · POST /api/exam-results");
  const px = await api("POST", "/api/exam-results", { as: X, body: { examId: "az-lop", score: 9 } });
  check("học sinh KHÔNG thuộc lớp ghi điểm đề của lớp → 403, không có dòng", px.status === 403 && (await prisma.examResult.count({ where: { userId: X.id } })) === 0, [px.status, px.json]);
  const over = await api("POST", "/api/exam-results", { as: S, body: { examId: "az-lop", score: 11 } });
  check("điểm vượt tổng điểm của đề (11/10) → 400", over.status === 400, [over.status, over.json]);
  const dr = await api("POST", "/api/exam-results", { as: S, body: { examId: "az-nhap", score: 5 } });
  const off = await api("POST", "/api/exam-results", { as: S, body: { examId: "az-tat", score: 5 } });
  check("đề nháp / đề tắt → 400, không ghi", dr.status === 400 && off.status === 400 && (await prisma.examResult.count({ where: { examId: { in: ["az-nhap", "az-tat"] } } })) === 0, [dr.status, off.status]);
  const ok = await api("POST", "/api/exam-results", { as: S, body: { examId: "az-lop", score: 8 } });
  const row = await prisma.examResult.findUnique({ where: { userId_examId: { userId: S.id, examId: "az-lop" } } });
  check("học sinh trong lớp, điểm hợp lệ → 200; dòng ghi CHỜ DUYỆT, thang 10 của đề", ok.status === 200 && row?.pendingReview === true && row.totalPoints === 10 && row.score === 8, [ok.status, row]);
  const m0 = JSON.stringify((await loadStudentMonth(T.id, S.id, YM))?.subjects.map(s => s.mastery));
  check("báo cáo tháng: điểm tự khai chưa duyệt KHÔNG vào (giống như chưa có điểm)", m0 === base, [base, m0]);
  await prisma.examResult.update({ where: { id: row!.id }, data: { pendingReview: false } });
  const m1 = JSON.stringify((await loadStudentMonth(T.id, S.id, YM))?.subjects.map(s => s.mastery));
  check("ĐỐI CHỨNG: duyệt xong (pendingReview=false) thì điểm vào báo cáo", m1 !== base, m1);
  await api("POST", "/api/exam-results", { as: S, body: { examId: "az-lop", score: 9 } });
  check("khai lại điểm → quay về chờ duyệt", (await prisma.examResult.findUnique({ where: { id: row!.id } }))?.pendingReview === true);

  section("P2-7 · GET bảng điểm và chi tiết đề");
  const B = "/api/exam-results?examId=az-lop";
  const bx = await api("GET", B, { as: X }), bt3 = await api("GET", B, { as: T3 });
  check("học sinh lớp khác / gia sư lớp khác xem bảng điểm → 403, không lộ điểm", bx.status === 403 && bt3.status === 403 && !/"score"/.test(bx.text + bt3.text), [bx.status, bt3.status]);
  const bs = await api("GET", B, { as: S });
  check("học sinh trong lớp: 200, KHÔNG userId, dòng của mình isMe=true", bs.status === 200 && bs.json?.length === 1 && !/userId/.test(bs.text) && !bs.text.includes(S.id) && bs.json[0].isMe === true, bs.text.slice(0, 300));
  const bt = await api("GET", B, { as: T }), bsa = await api("GET", B, { as: SA });
  check("chủ lớp và quản trị: 200, thấy tên thật", bt.status === 200 && bsa.status === 200 && bt.json?.[0]?.user?.name === "Em Trong Lớp" && bsa.json?.[0]?.user?.name === "Em Trong Lớp", [bt.json, bsa.json]);
  const E = "/api/exams/az-lop";
  const ex = await api("GET", E, { as: X }), et3 = await api("GET", E, { as: T3 });
  check("chi tiết đề của lớp: học sinh lớp khác / gia sư lớp khác → 403, không lộ link Azota", ex.status === 403 && et3.status === 403 && !/azota\.vn/.test(ex.text + et3.text), [ex.status, et3.status]);
  const es = await api("GET", E, { as: S }), et = await api("GET", E, { as: T }), esa = await api("GET", E, { as: SA });
  check("học sinh trong lớp, chủ lớp, quản trị: 200", es.status === 200 && et.status === 200 && esa.status === 200, [es.status, et.status, esa.status]);
  await mkExam("az-chung", { totalPoints: 150 });
  const pub = await api("POST", "/api/exam-results", { as: X, body: { examId: "az-chung", score: 120 } });
  const pubB = await api("GET", "/api/exam-results?examId=az-chung", { as: S });
  check("đề KHÔNG gắn lớp: vẫn nộp/xem được như cũ, bảng điểm không lộ userId", pub.status === 200 && pubB.status === 200 && pubB.json?.length === 1 && pubB.json[0].isMe === false && !/userId/.test(pubB.text), [pub.status, pubB.text.slice(0, 200)]);

  section("P1-3 / P1-4 · POST /api/courses (gia sư)");
  const mk = (id: string, joinPolicy: string, extra: object = {}) => api("POST", "/api/courses", { as: T, body: { id, name: id, adminName: id, shortTitle: id, category: "Toán", instructor: "KiN", teacherAvatar: "K", openDate: "01/12/2026", types: ["Video"], bg: "var(--kin-chu-phu)", price: 0, lessons: 0, hours: 0, status: true, joinPolicy, ...extra } });
  const c1 = await mk("scl-a-duyet", "approve");
  const d1 = await prisma.course.findUnique({ where: { id: "scl-a-duyet" } });
  check("lớp 'duyệt' gửi status:true → tạo RIÊNG (status false)", c1.status === 201 && d1?.status === false, [c1.status, c1.json?.error, d1?.status]);
  check("tên gia sư = tên thật người tạo, không 'KiN'", d1?.instructor === "Cô Lan Chủ Lớp" && d1.teacherAvatar === "C", [d1?.instructor, d1?.teacherAvatar]);
  const c2 = await mk("scl-a-mo", "open", { tag: "Miễn phí" });
  const d2 = await prisma.course.findUnique({ where: { id: "scl-a-mo" } });
  check("lớp 'Vào ngay' (miễn phí) → công khai", c2.status === 201 && d2?.status === true, [c2.status, c2.json?.error, d2?.status]);

  section("Rà soát · PATCH/PUT /api/courses/[id] (gia sư): status theo cách vào lớp");
  const st = async (id: string) => (await prisma.course.findUnique({ where: { id } }))?.status;
  const p1 = await api("PATCH", "/api/courses/scl-a-mo", { as: T, body: { joinPolicy: "approve" } });
  check("PATCH open → approve: lớp thành RIÊNG (status false)", p1.status === 200 && (await st("scl-a-mo")) === false, [p1.status, p1.json?.error]);
  const p2 = await api("PATCH", "/api/courses/scl-a-mo", { as: T, body: { joinPolicy: "open" } });
  check("PATCH approve → open: lớp thành công khai (status true) để /join chạy", p2.status === 200 && (await st("scl-a-mo")) === true, [p2.status, p2.json?.error]);
  const p3 = await api("PUT", "/api/courses/scl-a-duyet", { as: T, body: { status: true } });
  check("PUT status:true trên lớp duyệt → bị bỏ qua (vẫn false)", p3.status === 200 && (await st("scl-a-duyet")) === false, [p3.status, p3.json?.error]);
  const p4 = await api("PUT", "/api/courses/scl-a-duyet", { as: T, body: { instructor: "KiN", teacherAvatar: "K" } });
  const d4 = await prisma.course.findUnique({ where: { id: "scl-a-duyet" } });
  check("PUT instructor 'KiN' → bỏ qua, giữ tên thật", p4.status === 200 && d4?.instructor === "Cô Lan Chủ Lớp" && d4.teacherAvatar === "C", [p4.status, d4?.instructor]);
  const sc = await api("POST", "/api/courses", { as: SA, body: { id: "scl-a-trung-tam", name: "TT", adminName: "TT", shortTitle: "TT", category: "Toán", instructor: "KiN", teacherAvatar: "K", openDate: "01/12/2026", types: ["Video"], bg: "var(--kin-chu-phu)", price: 0, lessons: 0, hours: 0, status: true } });
  const dsc = await prisma.course.findUnique({ where: { id: "scl-a-trung-tam" } });
  check("quản trị tạo khoá trung tâm tên 'KiN' → giữ 'KiN', công khai như cũ", sc.status === 201 && dsc?.instructor === "KiN" && dsc.status === true, [sc.status, sc.json?.error, dsc?.instructor]);

  section("Rà soát · pending_consent / suspended xem chi tiết đề");
  const PC = await mkUser({ name: "Em Chờ Phụ Huynh" }), SU = await mkUser({ name: "Em Đã Nghỉ" });
  await prisma.enrollment.create({ data: { userId: PC.id, courseId: C.id, status: "pending_consent" } });
  await prisma.enrollment.create({ data: { userId: SU.id, courseId: C.id, status: "suspended" } });
  const epc = await api("GET", E, { as: PC }), esu = await api("GET", E, { as: SU }), ex2 = await api("GET", E, { as: X });
  check("pending_consent: 200 (luật xem 06/11 không chặn chờ đồng ý)", epc.status === 200, [epc.status, epc.json]);
  check("suspended: 403 kèm mã enrollment_suspended; không ghi danh: 403 kèm enrollment_removed", esu.status === 403 && esu.json?.code === "enrollment_suspended" && !!esu.json?.error && ex2.status === 403 && ex2.json?.code === "enrollment_removed", [esu.json, ex2.json]);

  section("Rà soát · bảng xếp hạng chung bỏ điểm chờ duyệt");
  const names = async () => ((await api("GET", "/api/leaderboard", { as: T })).json as { name: string }[]).map(r => r.name);
  const n0 = await names();
  check("điểm tự khai chờ duyệt KHÔNG lên /api/leaderboard", !n0.includes("Em Trong Lớp") && !n0.includes("Em Lớp Khác"), n0);
  await prisma.examResult.updateMany({ where: { userId: S.id }, data: { pendingReview: false } });
  const n1 = await names();
  check("ĐỐI CHỨNG: duyệt xong thì lên bảng", n1.includes("Em Trong Lớp"), n1);

  section("Rà soát · khách GET /api/exams?activeGuest=true");
  await prisma.exam.update({ where: { id: "az-lop" }, data: { activeGuest: true } });
  await mkExam("az-lop-phi", { ownerId: T.id, courseId: C.id, totalPoints: 10, price: 50000, activeGuest: true });
  const gl = await api("GET", "/api/exams?activeGuest=true");
  const ids = ((gl.json ?? []) as { id: string }[]).map(e => e.id);
  const paid = ((gl.json ?? []) as { id: string; azotaUrl: string | null }[]).find(e => e.id === "az-lop-phi");
  check("đề lớp miễn phí không hiện cho khách; đề lớp thu phí hiện nhưng không link Azota", gl.status === 200 && !ids.includes("az-lop") && !!paid && !paid.azotaUrl, [gl.status, ids, paid]);

  section("P2-8 · khoá tài khoản / đổi mật khẩu thu hồi phiên cũ");
  const K = await mkUser({ name: "Em Bị Khoá" });
  const kc = await cookieFor(K);
  const me0 = await raw("GET", "/api/auth/me", kc);
  check("trước khi khoá: cookie đọc được /api/auth/me", me0.json?.id === K.id, me0.text.slice(0, 120));
  const ban = await api("PATCH", `/api/admin/students/${K.id}`, { as: SA });
  const me1 = await raw("GET", "/api/auth/me", kc);
  check("quản trị khoá → cookie cũ ở yêu cầu ĐỌC thành chưa đăng nhập (null)", ban.status === 200 && ban.json?.banned === true && me1.json === null, [ban.status, me1.text.slice(0, 120)]);
  const unban = await api("PATCH", `/api/admin/students/${K.id}`, { as: SA });
  check("mở khoá: không lỗi, banned false", unban.status === 200 && unban.json?.banned === false, unban.json);

  const P = await mkUser({ name: "Em Đổi Mật Khẩu" });
  const old = await cookieFor(P);
  const other = await cookieFor(P); // phiên ở "máy khác"
  const cp = await raw("POST", "/api/auth/change-password", old, { oldPassword: "Passw0rd!", newPassword: "MatKhauMoi123" });
  const fresh = (cp.setCookie.match(/midnight_session=[^;]+/) ?? [""])[0];
  check("đổi mật khẩu → 200 và cấp lại cookie cho máy này", cp.status === 200 && !!fresh, [cp.status, cp.text.slice(0, 120)]);
  const oth = await raw("GET", "/api/auth/me", other);
  check("phiên ở máy khác (cấp trước) → bị đá (null)", oth.json === null, oth.text.slice(0, 120));
  const fr = await raw("GET", "/api/auth/me", fresh);
  check("cookie vừa cấp lại vẫn đăng nhập", fr.json?.id === P.id, fr.text.slice(0, 120));

  const DEL = await mkUser({ name: "Em Bị Xoá" });
  const dc = await cookieFor(DEL);
  const dl = await api("POST", `/api/admin/students/${DEL.id}/xoa-tai-khoan`, { as: SA });
  const dme = await raw("GET", "/api/auth/me", dc);
  check("xoá tài khoản → cookie cũ ở yêu cầu ĐỌC thành chưa đăng nhập (null)", dl.status === 200 && dl.json?.ok === true && dme.json === null, [dl.status, dl.json, dme.text.slice(0, 120)]);

  section("Script dữ liệu scripts/scl-an-lop-cong-khai.ts (xem trước / --apply)");
  const oldC = await mkCourse(T.id, { name: "Lớp cũ lỡ công khai" });
  await prisma.course.update({ where: { id: oldC.id }, data: { status: true, joinPolicy: null, instructor: "KiN" } });
  const centre = await mkCourse(SA.id, { name: "Khoá trung tâm cũ" });
  await prisma.course.update({ where: { id: centre.id }, data: { status: true, joinPolicy: null, instructor: "KiN" } });
  const run = (...a: string[]) => { const r = spawnSync("npx", ["tsx", "scripts/scl-an-lop-cong-khai.ts", ...a], { encoding: "utf8", env: process.env }); return { code: r.status, out: r.stdout + r.stderr }; };
  const db = (await prisma.$queryRawUnsafe<{ db: string }[]>(`select current_database()::text as db`))[0].db;
  const pv = run();
  const afterPv = await prisma.course.findUnique({ where: { id: oldC.id } });
  check("mặc định chỉ xem trước: thoát 0, in lớp sẽ đổi, DB KHÔNG đổi", pv.code === 0 && pv.out.includes(oldC.id) && afterPv?.status === true && afterPv.joinPolicy === null, pv.out.slice(0, 300));
  const wrong = run("--apply", "--xac-nhan", "db-khac");
  check("--apply sai tên DB → thoát 1, không ghi", wrong.code === 1 && (await prisma.course.findUnique({ where: { id: oldC.id } }))?.status === true, wrong.out.slice(-200));
  const ap = run("--apply", "--xac-nhan", db);
  const fixed = await prisma.course.findUnique({ where: { id: oldC.id } });
  const mo = await prisma.course.findUnique({ where: { id: "scl-a-mo" } });
  const cen = await prisma.course.findUnique({ where: { id: centre.id } });
  check("--apply KHÔNG đụng khoá trung tâm (chủ admin_super): giữ công khai, joinPolicy null, tên KiN", cen?.status === true && cen.joinPolicy === null && cen.instructor === "KiN" && !pv.out.includes(centre.id), [cen?.status, cen?.joinPolicy, cen?.instructor]);
  check("--apply đúng tên DB → lớp cũ: approve, ẩn, tên chủ lớp; lớp 'open' giữ công khai", ap.code === 0 && fixed?.joinPolicy === "approve" && fixed.status === false && fixed.instructor === "Cô Lan Chủ Lớp" && mo?.status === true, [ap.code, fixed?.joinPolicy, fixed?.status, fixed?.instructor, mo?.status]);

  await done();
}
main().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
