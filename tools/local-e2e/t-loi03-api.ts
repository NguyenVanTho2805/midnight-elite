// LOI-03 — GET /api/student/lop và GET /api/student/hom-nay: cổng vai, đúng người đúng lớp, ranh giới ngày VN, KHÔNG lộ dữ liệu.
// Cần máy chủ thử ở BASE. KHÔNG gọi wipe(): mọi dữ liệu mang hậu tố `stamp` riêng của lượt chạy, nên chạy chung DB với dữ liệu mẫu được.
//   source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-loi03-api.ts
// Chạy sát 00:00 giờ VN có thể đỏ giả (bài "hôm nay" thành "hôm qua" giữa lúc tạo và lúc gọi) — bài in giờ VN lúc chạy; chạy lại.
//
// CA PHÁ (đỏ nếu máy chủ làm sai):
//   • JSON lộ: thân MỌI lượt gọi không khớp LEAK_RE (đáp án, lời giải, điểm, bài nộp, giá, bg/strip/tagColor, ownerId, email, link học liệu thô…), không mã hex,
//     không tên người (học sinh / gia sư / quản trị) — bài tập kèm AssignmentQuestion có explanation + AssignmentOption.isCorrect để bắt lộ.
//   • Gọi trùng: hai lượt GET liền nhau trả thân y hệt (trừ "now") — chỉ đọc, không ghi gì; tiến độ trong DB không đổi sau nhiều lượt gọi.
//   • Bài NHÁP / Ẩn hẹn hôm nay, bài lớp khác, lớp đã nghỉ / chờ phụ huynh không bao giờ lọt.
import { prisma } from "@/lib/prisma";
import { addDaysKey, instantOf, vnDateKeyOf } from "@/lib/classSessions";
import { api, mkUser, mkTutor, mkSuper, mkCourse, check, section, done, type TUser } from "./h";

const stamp = Date.now().toString(36);
const LEAK_RE = /adminNote|videoUrl|zoomUrl|"documents"|"status"|isLocked|statsViews|ownerId|email|phone|price|feeMode|"bg"|"strip"|tagColor|correct|explanation|loiGiai|options|answer|score|submission|storageKey/i;
const HEX_RE = /#[0-9a-f]{3,8}\b/i;
const EP = ["/api/student/hom-nay", "/api/student/lop"] as const;

let seq = 0;
const lid = (p: string) => `l-loi03t-${p}-${stamp}-${++seq}`;
async function mkTree(courseId: string) {
  const sid = `s-loi03t-${stamp}-${++seq}`, cid = `c-loi03t-${stamp}-${++seq}`;
  await prisma.section.create({ data: { id: sid, title: "Phần 1", courseId, order: 0 } });
  await prisma.chapter.create({ data: { id: cid, title: "Chương 1", sectionId: sid, order: 0 } });
  return cid;
}
async function mkLesson(chapterId: string, o: { title: string; order: number; scheduledAt: Date | null; status?: string; documents?: string; azotaUrl?: string; videoUrl?: string; adminNote?: string }) {
  const id = lid(o.title.slice(0, 6).replace(/[^a-z]/gi, "x"));
  await prisma.lesson.create({ data: {
    id, code: id.slice(-12), title: o.title, type: "record", chapterId, order: o.order, isLocked: true, status: o.status ?? "published",
    scheduledAt: o.scheduledAt, documents: o.documents ?? "[]", azotaUrl: o.azotaUrl ?? null, videoUrl: o.videoUrl ?? null, adminNote: o.adminNote ?? null,
  } });
  return id;
}

(async () => {
  const now0 = new Date();
  const today = vnDateKeyOf(now0);
  const at = (d: number, h: number, m: number) => instantOf(addDaysKey(today, d), h * 60 + m);
  console.log(`Giờ VN lúc chạy: ${today} ${new Date(now0.getTime() + 7 * 3_600_000).toISOString().slice(11, 16)} · BASE=${process.env.BASE}`);

  // ── Dữ liệu ──
  const T = await mkTutor(`GiaSuT-${stamp}`);
  const S = await mkSuper(`QuanTriS-${stamp}`);
  const A = await mkUser({ name: `HocSinhA-${stamp}` }), B = await mkUser({ name: `HocSinhB-${stamp}` });
  const C = await mkUser({ name: `HocSinhC-${stamp}` }), D = await mkUser({ name: `HocSinhD-${stamp}` });
  const people = [T, S, A, B, C, D];

  const X = await mkCourse(T.id, { name: `Lop X ${stamp}` });
  const Y = await mkCourse(T.id, { name: `Lop Y ${stamp}` });
  const Z = await mkCourse(T.id, { name: `Lop Z rieng ${stamp}` });
  await prisma.course.update({ where: { id: X.id }, data: { bg: `url("https://picsum.photos/seed/${stamp}/640/360")`, instructor: "Cô Lan", category: "Toán", price: 123456, tag: "PRO" } });
  await prisma.course.update({ where: { id: Z.id }, data: { status: false } }); // lớp riêng, ẩn khỏi danh mục công khai — A VẪN phải thấy (Q2)

  const cx = await mkTree(X.id), cy = await mkTree(Y.id), cz = await mkTree(Z.id);
  const X1930 = await mkLesson(cx, { title: `Bai X toi nay ${stamp}`, order: 0, scheduledAt: at(0, 19, 30),
    documents: JSON.stringify([{ name: "De cuong.pdf", url: "https://res.cloudinary.com/demo/raw/upload/de-cuong.pdf" }, { name: "Xau", url: "javascript:alert(1)" }]),
    azotaUrl: "https://azota.vn/de-thi/loi03-api", videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", adminNote: `GHICHU-${stamp}` });
  const XNHAP = await mkLesson(cx, { title: `NHAP-BI-MAT-${stamp}`, order: 1, scheduledAt: at(0, 20, 0), status: "draft" });
  const XAN = await mkLesson(cx, { title: `LOP-AN-${stamp}`, order: 2, scheduledAt: at(0, 21, 0), status: "hidden" });
  const X0030 = await mkLesson(cx, { title: `Bai X ngay mai ${stamp}`, order: 3, scheduledAt: at(1, 0, 30) });
  const YK = await mkLesson(cy, { title: `LOP-KHAC-${stamp}`, order: 0, scheduledAt: at(0, 19, 0) });
  const ZR = await mkLesson(cz, { title: `LOP-RIENG-${stamp}`, order: 0, scheduledAt: at(0, 18, 0) });
  const XFAR = await mkLesson(cx, { title: `Bai X qua 7 ngay ${stamp}`, order: 4, scheduledAt: at(8, 9, 0) });
  const XOLD = await mkLesson(cx, { title: `Bai X hom qua ${stamp}`, order: 5, scheduledAt: at(-1, 19, 30) });

  const asg = await prisma.assignment.create({ data: { lessonId: X1930, title: `Phieu X ${stamp}`, instructions: "Lam bai", maxPoints: 10, ownerId: T.id, mode: "quiz" } });
  const q = await prisma.assignmentQuestion.create({ data: { assignmentId: asg.id, order: 1, text: `CAUHOI-${stamp}`, type: "MC", explanation: `LOIGIAI-${stamp}` } });
  await prisma.assignmentOption.createMany({ data: [{ questionId: q.id, order: 1, text: `DAPANDUNG-${stamp}`, isCorrect: true }, { questionId: q.id, order: 2, text: `DAPANSAI-${stamp}`, isCorrect: false }] });

  await prisma.enrollment.create({ data: { userId: A.id, courseId: X.id, status: "active" } });
  await prisma.enrollment.create({ data: { userId: A.id, courseId: Z.id, status: "active" } });
  await prisma.enrollment.create({ data: { userId: B.id, courseId: Y.id, status: "active" } });
  await prisma.enrollment.create({ data: { userId: C.id, courseId: X.id, status: "suspended" } });
  await prisma.enrollment.create({ data: { userId: D.id, courseId: X.id, status: "pending_consent" } });

  // Tiến độ của A: xong bài 19:30 + BÀI NHÁP (không được đếm) + bài lớp Y (không phải lớp của A); xem dở bài ẨN (không được thành "Học tiếp").
  await prisma.lessonProgress.createMany({ data: [
    { userId: A.id, lessonId: X1930, completed: true, watchedSeconds: 0 },
    { userId: A.id, lessonId: XNHAP, completed: true, watchedSeconds: 0 },
    { userId: A.id, lessonId: YK, completed: true, watchedSeconds: 0 },
    { userId: A.id, lessonId: XAN, completed: false, watchedSeconds: 300 },
  ] });

  const bodies: { who: string; path: string; text: string }[] = [];
  const call = async (method: string, path: string, as?: TUser, who = as ? people.find(p => p.id === as.id)?.name ?? "?" : "khach") => {
    const r = await api(method, path, { as });
    bodies.push({ who, path, text: r.text });
    return r;
  };

  section("Cổng vai: khách 401, gia sư / quản trị 403, POST 405, no-store");
  for (const p of EP) {
    const g = await call("GET", p);
    check(`${p} khách ⇒ 401`, g.status === 401, g.status);
    const t = await call("GET", p, T);
    check(`${p} gia sư ⇒ 403`, t.status === 403, t.status);
    const s = await call("GET", p, S);
    check(`${p} quản trị ⇒ 403`, s.status === 403, s.status);
    const post = await api("POST", p, { as: A, body: {} });
    check(`${p} POST ⇒ 405`, post.status === 405, post.status);
    const ok = await call("GET", p, A);
    check(`${p} học sinh ⇒ 200 + Cache-Control no-store`, ok.status === 200 && /no-store/.test(ok.headers.get("cache-control") ?? ""), [ok.status, ok.headers.get("cache-control")]);
    check(`${p} 401 cũng no-store`, /no-store/.test(g.headers.get("cache-control") ?? ""), g.headers.get("cache-control"));
  }

  section("/api/student/hom-nay — học sinh A");
  const ra = await call("GET", "/api/student/hom-nay", A);
  const ha = ra.json as { now: string; todayKey: string; today: Record<string, any>[]; upcoming: Record<string, any>[] };
  check("có now (ISO) + todayKey = ngày VN của now máy chủ = ngày VN lúc chạy", typeof ha?.now === "string" && ha.todayKey === vnDateKeyOf(new Date(ha.now)) && ha.todayKey === today, [ha?.now, ha?.todayKey, today]);
  const t1930 = ha.today.find(x => x.lessonId === X1930);
  check("today có bài 19:30 của X", !!t1930, ha.today.map(x => x.lessonTitle));
  check("bài 19:30: time '19:30', dateKey hôm nay, dayTitle 'Hôm nay', đúng lớp", t1930?.time === "19:30" && t1930?.dateKey === today && t1930?.dayTitle === "Hôm nay" && t1930?.courseId === X.id && t1930?.courseName === X.name, t1930);
  check("bài 19:30: scheduledAt ISO đúng, past đúng theo giờ máy chủ", t1930?.scheduledAt === at(0, 19, 30).toISOString() && t1930?.past === (at(0, 19, 30).getTime() < new Date(ha.now).getTime()), t1930);
  check("bài 19:30: href bài, baiTapHref ?tab=bai-tap", t1930?.href === `/student/bai-giang/${X1930}` && t1930?.baiTapHref === `/student/bai-giang/${X1930}?tab=bai-tap`, t1930);
  check("bài 19:30: docs 1 mục (bỏ javascript:), href /xem-tai-lieu", Array.isArray(t1930?.docs) && t1930.docs.length === 1 && t1930.docs[0].name === "De cuong.pdf" && String(t1930.docs[0].href).startsWith("/xem-tai-lieu?url="), t1930?.docs);
  check("bài 19:30: azota 1 link 'Bài Azota'", Array.isArray(t1930?.azota) && t1930.azota.length === 1 && t1930.azota[0].label === "Bài Azota" && t1930.azota[0].url === "https://azota.vn/de-thi/loi03-api", t1930?.azota);
  check("lớp riêng Z (Course.status=false): A VẪN thấy LOP-RIENG (Q2)", ha.today.some(x => x.lessonId === ZR), ha.today.map(x => x.lessonTitle));
  const u0030 = ha.upcoming.find(x => x.lessonId === X0030);
  check("upcoming có bài ngày mai 00:30: dayTitle 'Ngày mai', time '00:30', past=false", u0030?.dayTitle === "Ngày mai" && u0030?.time === "00:30" && u0030?.past === false && u0030?.dateKey === addDaysKey(today, 1), u0030);
  check("upcoming gọn: không có docs / azota", u0030 && !("docs" in u0030) && !("azota" in u0030), u0030 && Object.keys(u0030));
  check("upcoming bài không có bài tập ⇒ baiTapHref null", u0030?.baiTapHref === null);
  check("bài 00:30 ngày mai KHÔNG nằm trong today", !ha.today.some(x => x.lessonId === X0030));
  check("today sắp theo giờ tăng", ha.today.every((x, i, a) => i === 0 || a[i - 1].scheduledAt <= x.scheduledAt), ha.today.map(x => x.time));
  for (const [name, needle] of [["NHAP-BI-MAT", `NHAP-BI-MAT-${stamp}`], ["bài hidden LOP-AN", `LOP-AN-${stamp}`], ["LOP-KHAC (lớp Y)", `LOP-KHAC-${stamp}`], ["bài quá 7 ngày", `Bai X qua 7 ngay ${stamp}`], ["bài hôm qua", `Bai X hom qua ${stamp}`]] as const) {
    check(`không có ${name}`, !ra.text.includes(needle));
  }
  check("không có id bài nháp / ẩn / quá hạn cửa sổ", ![XNHAP, XAN, YK, XFAR, XOLD].some(id => ra.text.includes(id)));

  section("/api/student/hom-nay — B (lớp Y), C (X suspended), D (X pending_consent)");
  const rb = await call("GET", "/api/student/hom-nay", B);
  check("B thấy bài của lớp Y", rb.json?.today?.some((x: { lessonId: string }) => x.lessonId === YK), rb.json);
  const xNeedles = [`Bai X toi nay ${stamp}`, `Bai X ngay mai ${stamp}`, X1930, X0030, X.id, X.name, at(0, 19, 30).toISOString(), at(1, 0, 30).toISOString(), `LOP-RIENG-${stamp}`];
  check("B không thấy bất kỳ tên bài / id / ngày giờ / tên lớp nào của X hay Z", !xNeedles.some(n => rb.text.includes(n)), xNeedles.filter(n => rb.text.includes(n)));
  for (const [who, u] of [["C (đã nghỉ lớp X)", C], ["D (chờ phụ huynh lớp X)", D]] as const) {
    const r = await call("GET", "/api/student/hom-nay", u);
    check(`${who}: 200, today/upcoming rỗng`, r.status === 200 && Array.isArray(r.json?.today) && r.json.today.length === 0 && Array.isArray(r.json?.upcoming) && r.json.upcoming.length === 0, r.json);
  }

  section("/api/student/lop — học sinh A");
  const la = await call("GET", "/api/student/lop", A);
  const classes = (la.json?.classes ?? []) as Record<string, any>[];
  check("A có đúng 2 lớp X, Z theo thứ tự ghi danh", classes.length === 2 && classes[0].id === X.id && classes[1].id === Z.id, classes.map(c => c.id));
  const cX = classes.find(c => c.id === X.id), cZ = classes.find(c => c.id === Z.id);
  // X có 4 bài Đã đăng: 19:30, ngày mai 00:30, quá 7 ngày, hôm qua. Nháp + ẩn không đếm.
  check("X: total 4 (không đếm nháp / ẩn), done 1 (tiến độ bài nháp + bài lớp Y không đếm), pct 25", cX?.total === 4 && cX?.done === 1 && cX?.pct === 25, cX);
  check("X: trangThai dang-hoc, giaSu 'Gia sư: Cô Lan', category 'Toán'", cX?.trangThai === "dang-hoc" && cX?.giaSu === "Gia sư: Cô Lan" && cX?.category === "Toán", cX);
  check("X: cover là https (từ url(\"https://…\"))", cX?.cover === `https://picsum.photos/seed/${stamp}/640/360`, cX?.cover);
  check("Z: cover null (bg không phải url https)", cZ?.cover === null, cZ?.cover);
  check("X: hocTiep không bao giờ là bài nháp / ẩn; = bài chưa xong đầu (00:30) 'chua-hoc'", cX?.hocTiep?.lessonId === X0030 && cX?.hocTiep?.reason === "chua-hoc" && cX?.hocTiep?.title === `Bai X ngay mai ${stamp}`, cX?.hocTiep);
  check("Z: 1 bài, 0 xong, hocTiep = LOP-RIENG", cZ?.total === 1 && cZ?.done === 0 && cZ?.hocTiep?.lessonId === ZR, cZ);
  check("không có lớp Y (không ghi danh)", !la.text.includes(Y.id));
  check("không có tên / id bài nháp hay ẩn", ![XNHAP, XAN, `NHAP-BI-MAT-${stamp}`, `LOP-AN-${stamp}`].some(n => la.text.includes(n)));
  check("không có giá (123456) / tag PRO", !la.text.includes("123456") && !/"PRO"/.test(la.text));
  const lc = await call("GET", "/api/student/lop", C);
  check("C (đã nghỉ X): classes rỗng", lc.status === 200 && Array.isArray(lc.json?.classes) && lc.json.classes.length === 0, lc.json);
  const ld = await call("GET", "/api/student/lop", D);
  check("D (chờ phụ huynh X): classes rỗng", ld.status === 200 && Array.isArray(ld.json?.classes) && ld.json.classes.length === 0, ld.json);
  const lb = await call("GET", "/api/student/lop", B);
  check("B: chỉ lớp Y, không có X", lb.json?.classes?.length === 1 && lb.json.classes[0].id === Y.id && !lb.text.includes(X.id), lb.json);

  section("Gọi trùng — chỉ đọc, không đổi gì");
  const progBefore = JSON.stringify(await prisma.lessonProgress.findMany({ where: { userId: A.id }, orderBy: { lessonId: "asc" }, select: { lessonId: true, completed: true, watchedSeconds: true } }));
  const [h1, h2] = await Promise.all([call("GET", "/api/student/hom-nay", A), call("GET", "/api/student/hom-nay", A)]);
  const strip = (j: Record<string, unknown>) => JSON.stringify({ ...j, now: null, today: (j.today as Record<string, unknown>[]).map(x => ({ ...x, past: null })) });
  check("hom-nay gọi song song 2 lần ⇒ thân như nhau (trừ now / past)", h1.status === 200 && h2.status === 200 && strip(h1.json) === strip(h2.json));
  const [l1, l2] = await Promise.all([call("GET", "/api/student/lop", A), call("GET", "/api/student/lop", A)]);
  check("lop gọi song song 2 lần ⇒ thân y hệt", l1.status === 200 && l1.text === l2.text && l1.text === la.text);
  const progAfter = JSON.stringify(await prisma.lessonProgress.findMany({ where: { userId: A.id }, orderBy: { lessonId: "asc" }, select: { lessonId: true, completed: true, watchedSeconds: true } }));
  check("LessonProgress của A không đổi sau các lượt gọi", progBefore === progAfter);

  // ── stu-test (vòng 1) bổ sung theo mô hình kẻ tấn công. Mỗi ca ĐỎ nếu máy chủ: tin tham số của trình duyệt, coi "xin vào lớp" là ghi danh,
  //    tin vai trong token thay vì DB, nhận token của tài khoản đã xoá / cookie giả, hoặc nhúng lời giải / bài nháp vào HTML trang học sinh.
  section("stu-test: kẻ tấn công — tham số giả, xin vào lớp chưa duyệt, vai trong token, token chết, HTML trang");
  const baseHn = strip(h1.json);
  for (const qs of [`?userId=${B.id}`, `?userId=${B.id}&now=2030-01-01T00:00:00Z&days=365`, `?courseId=${Y.id}&from=2000-01-01&until=2100-01-01&status=draft`]) {
    const r = await call("GET", `/api/student/hom-nay${qs}`, A, `A (tham số ${qs.slice(0, 20)}…)`);
    check(`hom-nay ${qs}: bỏ qua tham số — thân như gọi trơn của A, không có bài lớp Y / nháp / quá 7 ngày`, r.status === 200 && strip(r.json) === baseHn && ![YK, XNHAP, XFAR].some(id => r.text.includes(id)), r.json && { today: r.json.today?.map((x: { lessonTitle: string }) => x.lessonTitle), todayKey: r.json.todayKey });
    const l = await call("GET", `/api/student/lop${qs}`, A, `A (tham số ${qs.slice(0, 20)}…)`);
    check(`lop ${qs}: bỏ qua tham số — thân y hệt gọi trơn của A`, l.status === 200 && l.text === la.text);
  }
  // A xin vào lớp Y (pending) + lớp W bị từ chối: chưa phải ghi danh ⇒ Y, W không lọt.
  const W = await mkCourse(T.id, { name: `Lop W tu choi ${stamp}` });
  const WK = await mkLesson(await mkTree(W.id), { title: `LOP-TU-CHOI-${stamp}`, order: 0, scheduledAt: at(0, 17, 0) });
  await prisma.classJoinRequest.create({ data: { courseId: Y.id, userId: A.id, status: "pending" } });
  await prisma.classJoinRequest.create({ data: { courseId: W.id, userId: A.id, status: "rejected" } });
  const ja = await call("GET", "/api/student/hom-nay", A), jl = await call("GET", "/api/student/lop", A);
  check("A xin vào Y (pending) / bị từ chối W ⇒ hom-nay không có bài Y, W; thân không đổi", strip(ja.json) === baseHn && ![YK, WK, `LOP-KHAC-${stamp}`, `LOP-TU-CHOI-${stamp}`].some(n => ja.text.includes(n)));
  check("A xin vào Y / bị từ chối W ⇒ lop vẫn chỉ X, Z", jl.text === la.text && !jl.text.includes(Y.id) && !jl.text.includes(W.id));
  // Vai đọc lại từ DB: token vẫn ghi "student" nhưng DB đã đổi lên gia sư ⇒ 403 (Enrollment cũ giữ nguyên không được mở cửa).
  const E = await mkUser({ name: `HocSinhE-${stamp}` });
  people.push(E);
  await prisma.enrollment.create({ data: { userId: E.id, courseId: X.id, status: "active" } });
  const eOk = await call("GET", "/api/student/hom-nay", E, "E (học sinh)");
  check("E (học sinh lớp X) trước khi đổi vai: 200, thấy bài 19:30", eOk.status === 200 && eOk.text.includes(X1930));
  await prisma.user.update({ where: { id: E.id }, data: { role: "admin", adminRole: "teacher", tutorVerified: true } });
  for (const p of EP) {
    const r = await call("GET", p, E, "E (token student, DB gia sư)");
    check(`${p}: token ghi student nhưng DB đã là gia sư ⇒ 403, không dữ liệu lớp`, r.status === 403 && !r.text.includes(X1930) && !r.text.includes(X.id), [r.status, r.text.slice(0, 120)]);
  }
  // Token của tài khoản đã xoá + cookie giả.
  const F = await mkUser({ name: `HocSinhF-${stamp}` });
  people.push(F);
  await prisma.enrollment.create({ data: { userId: F.id, courseId: X.id, status: "active" } });
  await prisma.user.delete({ where: { id: F.id } });
  for (const p of EP) {
    const r = await call("GET", p, F, "F (đã xoá)");
    check(`${p}: token của tài khoản đã xoá ⇒ 401/403, không dữ liệu`, (r.status === 401 || r.status === 403) && !r.text.includes(X1930), [r.status, r.text.slice(0, 120)]);
    const g = await api("GET", p, { headers: { cookie: "midnight_session=eyJhbGciOiJub25lIn0.eyJ1c2VySWQiOiJ4Iiwicm9sZSI6InN0dWRlbnQifQ." } });
    bodies.push({ who: "cookie giả", path: p, text: g.text });
    check(`${p}: cookie giả (alg none) ⇒ 401`, g.status === 401, [g.status, g.text.slice(0, 120)]);
  }
  // HTML do máy chủ trả cho trang học sinh (A đang làm bài): không nhúng lời giải / cờ đáp án / ghi chú quản trị / bài nháp.
  const htmlNeedles = [`LOIGIAI-${stamp}`, `GHICHU-${stamp}`, `NHAP-BI-MAT-${stamp}`, `LOP-AN-${stamp}`, `LOP-KHAC-${stamp}`];
  for (const path of ["/student/viec-cua-toi", "/student/hoc-tap", `/student/hoc-tap?course=${X.id}`, `/student/bai-giang/${X1930}?tab=bai-tap`, "/lop-cua-toi"]) {
    const r = await api("GET", path, { as: A });
    const hit = htmlNeedles.filter(n => r.text.includes(n));
    check(`HTML ${path} (A): ${r.status} — không lời giải / ghi chú / bài nháp, ẩn, lớp khác; không isCorrect`, r.status < 500 && hit.length === 0 && !/isCorrect|"explanation"\s*:/.test(r.text), [r.status, hit, /isCorrect|"explanation"\s*:/.exec(r.text)?.[0]]);
  }

  section("CA PHÁ: JSON không chứa đáp án / lời giải / dữ liệu thừa / mã hex / tên người");
  const secretNeedles = [`CAUHOI-${stamp}`, `LOIGIAI-${stamp}`, `DAPANDUNG-${stamp}`, `DAPANSAI-${stamp}`, `GHICHU-${stamp}`, "dQw4w9WgXcQ"];
  for (const b of bodies) {
    const leak = LEAK_RE.exec(b.text);
    check(`[${b.who} ${b.path}] không khớp LEAK_RE`, !leak, leak?.[0]);
    check(`[${b.who} ${b.path}] không có mã hex`, !HEX_RE.test(b.text), HEX_RE.exec(b.text)?.[0]);
    check(`[${b.who} ${b.path}] không có câu hỏi / đáp án / lời giải / ghi chú / video`, !secretNeedles.some(n => b.text.includes(n)), secretNeedles.filter(n => b.text.includes(n)));
    check(`[${b.who} ${b.path}] không có tên người (kể cả chính em)`, !people.some(p => b.text.includes(p.name)), people.filter(p => b.text.includes(p.name)).map(p => p.name));
  }

  section("Ghi nhận (CẢNH BÁO, không đỏ — chờ Q3): /api/courses/<X> có trả scheduledAt cho người ngoài lớp?");
  for (const [who, u] of [["B (lớp khác)", B], ["khách", undefined]] as const) {
    const r = await api("GET", `/api/courses/${X.id}`, { as: u });
    console.log(`  ! ${who}: HTTP ${r.status} · ${/"scheduledAt"\s*:\s*"/.test(r.text) ? "CÓ scheduledAt (ISO) trong cây" : "không thấy scheduledAt có giá trị"}`);
  }

  await done();
})().catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1); });
