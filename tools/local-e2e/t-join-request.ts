// BU-01 — API: cách vào lớp (joinPolicy), mã cá nhân gắn tài khoản, xin vào lớp / duyệt / từ chối / huỷ, cô lập giữa hai gia sư, không rò rỉ.
// Cần máy chủ Next ở cổng 3100 + Postgres demo (COO chạy tuần tự). Mẫu: h.ts, t-invites.ts.
import { api, mkTutor, mkUser, mkCourse, wipe, check, section, done, type TUser } from "./h";
import { prisma } from "@/lib/prisma";
import { enrollInTx } from "@/lib/enrollServer";
import { loadTutorInboxRaw } from "@/lib/tutorInboxServer";

const FORM = { "content-type": "application/x-www-form-urlencoded" };
const form = (path: string, as: TUser | undefined, pairs: [string, string][] = []) => api("POST", path, { as, raw: new URLSearchParams(pairs), headers: FORM });
const loc = (r: { headers: Headers }) => { const h = r.headers.get("location") ?? ""; if (!h) return ""; const u = new URL(h, "http://x"); return u.pathname + u.search; };
const codeOf = (r: { headers: Headers }) => new URL(loc(r), "http://x").searchParams.get("code") ?? "";

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan");
  const T2 = await mkTutor("Thầy Khác");
  const A = await mkUser({ name: "Em An Xin Lop" });
  const B = await mkUser({ name: "Em Binh Xin Lop" });
  const C = await mkUser({ name: "Em Chi Xin Lop" });

  // Lớp duyệt (approve), lớp miễn phí mở (open), lớp cũ (joinPolicy null), lớp của gia sư khác
  const AP = await mkCourse(T.id, { name: "Toán Duyệt" });
  await prisma.course.update({ where: { id: AP.id }, data: { joinPolicy: "approve", zaloGroupLink: "https://zalo.me/g/secret", classJoinUrl: "https://meet.example/secret" } });
  const OP = await mkCourse(T.id, { name: "Lý Miễn Phí" });
  await prisma.course.update({ where: { id: OP.id }, data: { joinPolicy: "open", tag: "Miễn phí", price: 0 } });
  const OLD = await mkCourse(T.id, { name: "Lớp Cũ" });
  const OTHER = await mkCourse(T2.id, { name: "Lớp Người Khác" });
  await prisma.course.update({ where: { id: OTHER.id }, data: { joinPolicy: "approve" } });

  // ── (1) /join hai lần song song → đúng một mã cá nhân ─────────────────────────
  section("(1) POST /join song song → một mã cá nhân duy nhất");
  const [j1, j2] = await Promise.all([form(`/api/courses/${AP.id}/join`, A), form(`/api/courses/${AP.id}/join`, A)]);
  check("cả hai 303 sang /student/nhap-ma-lop?code=", j1.status === 303 && j2.status === 303 && loc(j1).startsWith("/student/nhap-ma-lop?code="), [j1.status, loc(j1)]);
  const personal = await prisma.classInvite.findMany({ where: { courseId: AP.id, boundUserId: A.id, kind: "personal" } });
  check("đúng 1 ClassInvite personal cho cặp (A, lớp)", personal.length === 1, personal.length);
  check("hai lần trả CÙNG mã", codeOf(j1) === codeOf(j2) && codeOf(j1) === personal[0]?.code, [codeOf(j1), codeOf(j2)]);
  check("mã: maxUses 1, createdBy = A, hạn ~30 ngày", personal[0]?.maxUses === 1 && personal[0]?.createdBy === A.id && personal[0].expiresAt !== null && personal[0].expiresAt.getTime() - Date.now() > 29 * 86_400_000);
  const codeA = personal[0].code;
  check("chưa đăng nhập → 303 /dang-nhap?redirect=", (await form(`/api/courses/${AP.id}/join`, undefined)).status === 303 && loc(await form(`/api/courses/${AP.id}/join`, undefined)).startsWith("/dang-nhap?redirect="));
  const jNo = await form(`/api/courses/khong-co-lop/join`, A);
  check("lớp không có (học sinh) → 303 ?join=khong-co", jNo.status === 303 && loc(jNo) === "/khoa-hoc/khong-co-lop?join=khong-co", [jNo.status, loc(jNo)]);

  // ── (2) Mã cá nhân của A, B dùng ─────────────────────────────────────────────
  section("(2) Mã cá nhân của người khác");
  const pvB = await api("GET", `/api/invites/by-code/${codeA}`, { as: B });
  check("by-code của B → invalid 403", pvB.status === 200 && pvB.json?.status === "invalid" && pvB.json?.reason === 403, pvB);
  check("JSON không chứa tên lớp / gia sư", !/Toán Duyệt|Cô Lan/.test(pvB.text), pvB.text);
  const rdB = await api("POST", `/api/invites/${codeA}/redeem`, { as: B });
  check("B redeem mã của A → 403", rdB.status === 403 && /gắn với tài khoản khác/.test(rdB.json?.error ?? ""), rdB);
  check("usedCount KHÔNG tăng", (await prisma.classInvite.findUnique({ where: { code: codeA } }))?.usedCount === 0);
  check("không có ClassJoinRequest của B", (await prisma.classJoinRequest.count({ where: { userId: B.id } })) === 0);
  check("không có Enrollment của B", (await prisma.enrollment.count({ where: { userId: B.id } })) === 0);

  // ── (3) Lớp approve: A nhập mã → chờ duyệt ──────────────────────────────────
  section("(3) Lớp approve: A nhập mã → pending, chưa vào lớp");
  const pvA = await api("GET", `/api/invites/by-code/${codeA}`, { as: A });
  check("by-code của A: ok, joinPolicy approve, boundToMe, chưa có pendingRequest", pvA.json?.status === "ok" && pvA.json?.joinPolicy === "approve" && pvA.json?.boundToMe === true && pvA.json?.pendingRequest === null, pvA.json);
  const rdA = await api("POST", `/api/invites/${codeA}/redeem`, { as: A });
  check("redeem → { pending: true }", rdA.status === 200 && rdA.json?.pending === true && !!rdA.json?.requestId, rdA);
  check("KHÔNG có Enrollment", (await prisma.enrollment.count({ where: { userId: A.id, courseId: AP.id } })) === 0);
  const reqA = await prisma.classJoinRequest.findUnique({ where: { userId_courseId: { userId: A.id, courseId: AP.id } } });
  check("ClassJoinRequest pending, usedCount = 1", reqA?.status === "pending" && (await prisma.classInvite.findUnique({ where: { code: codeA } }))?.usedCount === 1);
  const open1 = await api("GET", `/api/courses/${AP.id}`, { as: A });
  check("A chưa mở được dữ liệu lớp: link Zalo / học online bị bỏ", open1.status === 200 && !/zalo\.me\/g\/secret|meet\.example\/secret/.test(open1.text), open1.text.slice(0, 200));
  const pg = await api("GET", `/lop-cua-toi/${AP.id}`, { as: A });
  check("GET /lop-cua-toi/<id> của A không phải 200 (404 / chuyển hướng)", pg.status !== 200, pg.status);
  const nt1 = await prisma.notification.findMany({ where: { userId: T.id, type: "join_request_new" } });
  check("gia sư nhận đúng 1 thông báo join_request_new, trỏ tab Học sinh", nt1.length === 1 && nt1[0].link === `/lop-cua-toi/${AP.id}?tab=hoc-sinh`, nt1);
  check("thông báo: có tên lớp, KHÔNG tên em, KHÔNG số tiền", nt1[0].message.includes("Toán Duyệt") && !/Em An|Xin Lop/.test(nt1[0].title + nt1[0].message) && !/\d{4,}|\d\s*(đ|₫|vnd)/i.test(nt1[0].message));
  const rdA2 = await api("POST", `/api/invites/${codeA}/redeem`, { as: A });
  check("nhập lại khi đang pending → pending, KHÔNG tăng lượt, KHÔNG báo lại", rdA2.json?.pending === true && (await prisma.classInvite.findUnique({ where: { code: codeA } }))?.usedCount === 1 && (await prisma.notification.count({ where: { userId: T.id, type: "join_request_new" } })) === 1 && (await prisma.notification.findFirst({ where: { userId: T.id, type: "join_request_new" } }))?.count === 1);
  const jA3 = await form(`/api/courses/${AP.id}/join`, A);
  check("/join lần nữa vẫn trả đúng mã cũ", codeOf(jA3) === codeA);

  // B xin tiếp → thông báo gộp
  const jB = await form(`/api/courses/${AP.id}/join`, B); const codeB = codeOf(jB);
  const rdB2 = await api("POST", `/api/invites/${codeB}/redeem`, { as: B });
  check("B xin → pending; thông báo gia sư gộp (count 2)", rdB2.json?.pending === true && (await prisma.notification.count({ where: { userId: T.id, type: "join_request_new" } })) === 1 && (await prisma.notification.findFirst({ where: { userId: T.id, type: "join_request_new" } }))?.count === 2);

  // ── (4) Cô lập gia sư / quyền ───────────────────────────────────────────────
  section("(4) Quyền: gia sư khác 403, không có 404, học sinh 403, chưa đăng nhập 401");
  const reqB = await prisma.classJoinRequest.findUnique({ where: { userId_courseId: { userId: B.id, courseId: AP.id } } });
  const base = `/api/tutor/lop/${AP.id}/yeu-cau`;
  const probes: [string, () => Promise<{ status: number }>][] = [
    ["R6 GET", () => api("GET", base, { as: T2 })],
    ["R7 duyệt", () => form(`${base}/${reqA!.id}/duyet`, T2)],
    ["R8 từ chối", () => form(`${base}/${reqA!.id}/tu-choi`, T2)],
    ["R9 hàng loạt", () => form(`${base}/hang-loat`, T2, [["action", "duyet"], ["id", reqA!.id]])],
  ];
  for (const [n, f] of probes) check(`gia sư KHÁC lớp gọi ${n} → 403`, (await f()).status === 403);
  check("lớp không có → 404 (R6, R7)", (await api("GET", "/api/tutor/lop/khong-co/yeu-cau", { as: T })).status === 404 && (await form(`/api/tutor/lop/khong-co/yeu-cau/${reqA!.id}/duyet`, T)).status === 404);
  check("học sinh gọi R7 / R6 → 403", (await form(`${base}/${reqA!.id}/duyet`, A)).status === 403 && (await api("GET", base, { as: A })).status === 403);
  check("chưa đăng nhập → 401", (await api("GET", base)).status === 401 && (await form(`${base}/${reqA!.id}/duyet`, undefined)).status === 401);
  const reqOther = await prisma.classJoinRequest.create({ data: { courseId: OTHER.id, userId: C.id } });
  check("yêu cầu của lớp KHÁC đưa vào URL lớp này → 404", (await form(`${base}/${reqOther.id}/duyet`, T)).status === 404);
  check("…và yêu cầu đó vẫn pending", (await prisma.classJoinRequest.findUnique({ where: { id: reqOther.id } }))?.status === "pending");
  await prisma.classJoinRequest.delete({ where: { id: reqOther.id } });

  // ── (5) Người nộp đơn gia sư ─────────────────────────────────────────────────
  section("(5) Gia sư CHỜ DUYỆT không vào lớp bằng mã / nút, không duyệt ai");
  const P = await mkUser({ name: "Ứng viên gia sư" });
  await prisma.user.update({ where: { id: P.id }, data: { tutorAppliedAt: new Date() } });
  const invOld = await api("POST", `/api/courses/${OLD.id}/invites`, { as: T, body: { maxUses: 5 } });
  check("gia sư tạo mã lớp cũ → 201", invOld.status === 201, invOld);
  const rdP = await api("POST", `/api/invites/${invOld.json.code}/redeem`, { as: P });
  check("ứng viên redeem → 403", rdP.status === 403, rdP);
  const jP = await form(`/api/courses/${OP.id}/join`, P);
  check("ứng viên /join (lớp open) → 403, không Enrollment", jP.status === 403 && (await prisma.enrollment.count({ where: { userId: P.id } })) === 0, jP.status);
  check("ứng viên không tạo yêu cầu", (await prisma.classJoinRequest.count({ where: { userId: P.id } })) === 0);
  check("ứng viên gọi R7 → 403", (await form(`${base}/${reqA!.id}/duyet`, P)).status === 403);
  check("ứng viên gọi R6 / R8 / R9 → 403", (await api("GET", base, { as: P })).status === 403 && (await form(`${base}/${reqA!.id}/tu-choi`, P)).status === 403 && (await form(`${base}/hang-loat`, P, [["action", "duyet"], ["id", reqA!.id]])).status === 403);
  check("ứng viên GET my-requests → 403", (await api("GET", "/api/invites/my-requests", { as: P })).status === 403);
  const pvP = await api("GET", `/api/invites/by-code/${codeA}`, { as: P });
  check("ứng viên GET by-code → 403, không lộ tên lớp", pvP.status === 403 && !/Toán Duyệt|Cô Lan/.test(pvP.text), pvP.status);

  // ── (6) Duyệt ───────────────────────────────────────────────────────────────
  section("(6) Chủ lớp duyệt");
  const r6 = await api("GET", base, { as: T });
  check("R6: 200, pending = 2, có tên em (chủ lớp)", r6.status === 200 && r6.json?.pending === 2 && r6.json.items.some((i: any) => i.studentName === A.name), r6.json);
  check("R6: không rò email / phone / dateOfBirth / userId", !/email|phone|dateOfBirth|userId|@test\.local/i.test(r6.text), r6.text.slice(0, 300));
  const ap = await form(`${base}/${reqA!.id}/duyet`, T);
  check("duyệt → 303 …?tab=hoc-sinh&duyet=ok", ap.status === 303 && loc(ap) === `/lop-cua-toi/${AP.id}?tab=hoc-sinh&duyet=ok`, [ap.status, loc(ap)]);
  const enA = await prisma.enrollment.findMany({ where: { userId: A.id, courseId: AP.id } });
  check("Enrollment active, request approved + decidedBy/At", enA.length === 1 && enA[0].status === "active" && (await prisma.classJoinRequest.findUnique({ where: { id: reqA!.id } }))?.status === "approved" && (await prisma.classJoinRequest.findUnique({ where: { id: reqA!.id } }))?.decidedBy === T.id);
  const nA = await prisma.notification.findMany({ where: { userId: A.id, type: "join_request_approved" } });
  check("em nhận join_request_approved, link /student/hoc-tap?course=, không tên em", nA.length === 1 && nA[0].link === `/student/hoc-tap?course=${AP.id}` && nA[0].message.includes("Toán Duyệt") && !/Em An/.test(nA[0].message));
  const apAgain = await form(`${base}/${reqA!.id}/duyet`, T);
  check("duyệt lại → 303 duyet=da-xu-ly", apAgain.status === 303 && loc(apAgain).endsWith("duyet=da-xu-ly"), loc(apAgain));
  check("vẫn 1 Enrollment, 1 thông báo", (await prisma.enrollment.count({ where: { userId: A.id, courseId: AP.id } })) === 1 && (await prisma.notification.count({ where: { userId: A.id, type: "join_request_approved" } })) === 1);
  const rdAafter = await api("POST", `/api/invites/${codeA}/redeem`, { as: A });
  check("A (đã vào lớp) nhập lại mã → alreadyEnrolled", rdAafter.json?.alreadyEnrolled === true);
  const joinAafter = await form(`/api/courses/${AP.id}/join`, A);
  check("A bấm /join khi đã là thành viên → 303 /student/hoc-tap", joinAafter.status === 303 && loc(joinAafter).startsWith("/student/hoc-tap"));

  // ── (7) Từ chối + cooldown ──────────────────────────────────────────────────
  section("(7) Từ chối + chờ 24 giờ");
  const NOTE = "Lớp đã đủ người tháng này ZZQ";
  const rj = await form(`${base}/${reqB!.id}/tu-choi`, T, [["note", NOTE]]);
  check("từ chối → 303 …duyet=tuchoi", rj.status === 303 && loc(rj).endsWith("duyet=tuchoi"), loc(rj));
  const rjRow = await prisma.classJoinRequest.findUnique({ where: { id: reqB!.id } });
  check("status rejected, lưu note, hoàn lượt mã", rjRow?.status === "rejected" && rjRow.note === NOTE && (await prisma.classInvite.findUnique({ where: { code: codeB } }))?.usedCount === 0);
  const nB = await prisma.notification.findMany({ where: { userId: B.id, type: "join_request_rejected" } });
  check("thông báo từ chối KHÔNG chứa lời nhắn, không tên em, không tiền", nB.length === 1 && !nB[0].message.includes("ZZQ") && !/Em Binh/.test(nB[0].message) && !/\d{4,}/.test(nB[0].message) && nB[0].link === "/student/nhap-ma-lop");
  const pvRej = await api("GET", `/api/invites/by-code/${codeB}`, { as: B });
  check("by-code của B hiện rejection.note", pvRej.json?.rejection?.note === NOTE, pvRej.json);
  const reB = await api("POST", `/api/invites/${codeB}/redeem`, { as: B });
  check("xin lại < 24h → 409 COOLDOWN", reB.status === 409 && reB.json?.code === "COOLDOWN", reB);
  check("…usedCount vẫn 0, vẫn rejected", (await prisma.classInvite.findUnique({ where: { code: codeB } }))?.usedCount === 0 && (await prisma.classJoinRequest.findUnique({ where: { id: reqB!.id } }))?.status === "rejected");
  await prisma.classJoinRequest.update({ where: { id: reqB!.id }, data: { decidedAt: new Date(Date.now() - 25 * 3600_000) } });
  const reB2 = await api("POST", `/api/invites/${codeB}/redeem`, { as: B });
  check("sau 25h xin lại → pending, mã dùng lại (usedCount 0→1)", reB2.json?.pending === true && (await prisma.classInvite.findUnique({ where: { code: codeB } }))?.usedCount === 1 && (await prisma.classJoinRequest.findUnique({ where: { id: reqB!.id } }))?.status === "pending");
  const bigNote = await form(`${base}/${reqB!.id}/tu-choi`, T, [["note", "x".repeat(201)]]);
  check("ghi chú 201 ký tự → 303 duyet=loi-ghi-chu, KHÔNG đổi trạng thái", loc(bigNote).endsWith("duyet=loi-ghi-chu") && (await prisma.classJoinRequest.findUnique({ where: { id: reqB!.id } }))?.status === "pending");

  // ── (8) Sức chứa 1 ───────────────────────────────────────────────────────────
  section("(8) capacity 1, hai đơn");
  const CAP = await mkCourse(T.id, { name: "Lớp Nhỏ", capacity: 1 });
  await prisma.course.update({ where: { id: CAP.id }, data: { joinPolicy: "approve" } });
  const codes: string[] = [];
  for (const u of [A, B]) { codes.push(codeOf(await form(`/api/courses/${CAP.id}/join`, u))); }
  const rA = await api("POST", `/api/invites/${codes[0]}/redeem`, { as: A }); const rB = await api("POST", `/api/invites/${codes[1]}/redeem`, { as: B });
  check("cả hai gửi được khi lớp còn trống", rA.json?.pending === true && rB.json?.pending === true, [rA.json, rB.json]);
  const capReqs = await prisma.classJoinRequest.findMany({ where: { courseId: CAP.id }, orderBy: { createdAt: "asc" } });
  const capBase = `/api/tutor/lop/${CAP.id}/yeu-cau`;
  const d1 = await form(`${capBase}/${capReqs[0].id}/duyet`, T); const d2 = await form(`${capBase}/${capReqs[1].id}/duyet`, T);
  check("đơn 1 duyệt ok; đơn 2 → duyet=day", loc(d1).endsWith("duyet=ok") && loc(d2).endsWith("duyet=day"), [loc(d1), loc(d2)]);
  check("đơn 2 VẪN pending, đúng 1 Enrollment", (await prisma.classJoinRequest.findUnique({ where: { id: capReqs[1].id } }))?.status === "pending" && (await prisma.enrollment.count({ where: { courseId: CAP.id } })) === 1);
  const bulk = await form(`${capBase}/hang-loat`, T, [["action", "duyet"], ["id", capReqs[1].id], ["id", "id-la-khong-co"]]);
  check("hàng loạt khi đầy → duyet=day&n=0, không vượt sức chứa", loc(bulk).includes("duyet=day") && loc(bulk).includes("n=0") && (await prisma.enrollment.count({ where: { courseId: CAP.id } })) === 1, loc(bulk));
  const bulkRej = await form(`${capBase}/hang-loat`, T, [["action", "tu-choi"], ["id", capReqs[1].id], ["note", "Hẹn kỳ sau"]]);
  check("hàng loạt từ chối → duyet=tuchoi&n=1", loc(bulkRej).includes("duyet=tuchoi") && loc(bulkRej).includes("n=1"), loc(bulkRej));

  // ── (9) Cổng đồng ý (trong tiến trình) ──────────────────────────────────────
  section("(9) enrollInTx + KIN_ENROLL_CONSENT_GATE");
  const kid = await mkUser({ name: "Em Nhỏ Tuổi" });
  await prisma.user.update({ where: { id: kid.id }, data: { dateOfBirth: new Date(Date.now() - 10 * 365 * 86_400_000) } });
  const GC = await mkCourse(T.id, { name: "Lớp Cổng" });
  const prev = process.env.KIN_ENROLL_CONSENT_GATE;
  process.env.KIN_ENROLL_CONSENT_GATE = "1";
  const gOn = await prisma.$transaction((tx) => enrollInTx(tx, { userId: kid.id, course: GC, source: "join_approved" }));
  check("cổng BẬT, em ~10 tuổi → pending_consent", gOn.ok && gOn.status === "pending_consent" && gOn.created, gOn);
  const kid2 = await mkUser({ name: "Em Nhỏ Hai" });
  await prisma.user.update({ where: { id: kid2.id }, data: { dateOfBirth: new Date(Date.now() - 10 * 365 * 86_400_000) } });
  process.env.KIN_ENROLL_CONSENT_GATE = "0";
  const gOff = await prisma.$transaction((tx) => enrollInTx(tx, { userId: kid2.id, course: GC, source: "join_approved" }));
  check("cổng TẮT → active", gOff.ok && gOff.status === "active", gOff);
  if (prev === undefined) delete process.env.KIN_ENROLL_CONSENT_GATE; else process.env.KIN_ENROLL_CONSENT_GATE = prev;
  const again = await prisma.$transaction((tx) => enrollInTx(tx, { userId: kid2.id, course: GC, source: "join_open" }));
  check("gọi lần hai → created:false, không tạo thêm", again.ok && !again.created && (await prisma.enrollment.count({ where: { courseId: GC.id, userId: kid2.id } })) === 1);

  // ── (10) open + miễn phí ─────────────────────────────────────────────────────
  section("(10) open + miễn phí");
  const jo = await form(`/api/courses/${OP.id}/join`, C);
  check("POST /join lớp open → 303 /student/hoc-tap?course=, có Enrollment", jo.status === 303 && loc(jo) === `/student/hoc-tap?course=${OP.id}` && (await prisma.enrollment.count({ where: { userId: C.id, courseId: OP.id } })) === 1, loc(jo));
  const paid = await mkCourse(T.id, { name: "Lớp Thu Phí" });
  const pOpen = await api("PATCH", `/api/courses/${paid.id}`, { as: T, body: { joinPolicy: "open" } });
  check("PATCH open trên lớp KHÔNG miễn phí → 400", pOpen.status === 400 && /miễn phí/.test(pOpen.json?.error ?? ""), pOpen);
  await prisma.courseFeeRate.create({ data: { courseId: OP.id, mode: "per_session", rate: 100000, effectiveFrom: "2026-01-01", createdBy: T.id } });
  const D = await mkUser({ name: "Em Dũng" });
  const joD = await form(`/api/courses/${OP.id}/join`, D);
  check("lớp open nhưng gia sư đã nhập đơn giá → /join 409, không Enrollment", joD.status === 409 && (await prisma.enrollment.count({ where: { userId: D.id, courseId: OP.id } })) === 0, joD.status);
  await prisma.courseFeeRate.deleteMany({ where: { courseId: OP.id } });
  const pFree = await api("PATCH", `/api/courses/${paid.id}`, { as: T, body: { tag: "Miễn phí", joinPolicy: "open" } });
  check("PATCH tag Miễn phí + open cùng lúc → 200", pFree.status === 200 && pFree.json?.joinPolicy === "open", pFree);
  const lst = await api("GET", "/api/courses");
  check("GET /api/courses có isFree", Array.isArray(lst.json) && lst.json.find((c: any) => c.id === OP.id)?.isFree === true && lst.json.find((c: any) => c.id === OLD.id)?.isFree === false);

  // ── (11) joinPolicy null ─────────────────────────────────────────────────────
  section("(11) joinPolicy null = như trước BU-01");
  const E = await mkUser({ name: "Em Hoa" });
  const jn = await form(`/api/courses/${OLD.id}/join`, E);
  check("/join lớp null → 409", jn.status === 409, jn.status);
  const rdE = await api("POST", `/api/invites/${invOld.json.code}/redeem`, { as: E });
  check("mã lớp vào ngay như cũ", rdE.status === 200 && rdE.json?.status === "active" && !rdE.json?.pending, rdE);

  // ── (12) PATCH joinPolicy ────────────────────────────────────────────────────
  section("(12) PATCH joinPolicy");
  check("giá trị lạ → 400", (await api("PATCH", `/api/courses/${OLD.id}`, { as: T, body: { joinPolicy: "xyz" } })).status === 400);
  check("'Open' viết hoa → 400", (await api("PATCH", `/api/courses/${OLD.id}`, { as: T, body: { joinPolicy: "Open" } })).status === 400);
  check("lớp người khác → 403", (await api("PATCH", `/api/courses/${OTHER.id}`, { as: T, body: { joinPolicy: "approve" } })).status === 403);
  check("lớp không có → 404", (await api("PATCH", `/api/courses/khong-co`, { as: T, body: { joinPolicy: "approve" } })).status === 404);
  const okp = await api("PATCH", `/api/courses/${OLD.id}`, { as: T, body: { joinPolicy: "approve" } });
  check("approve hợp lệ → 200", okp.status === 200 && okp.json?.joinPolicy === "approve");
  check("null hợp lệ (về mặc định)", (await api("PATCH", `/api/courses/${OLD.id}`, { as: T, body: { joinPolicy: null } })).json?.joinPolicy === null);

  // ── (13) Huỷ ────────────────────────────────────────────────────────────────
  section("(13) Huỷ yêu cầu (R5)");
  const myB = await api("GET", "/api/invites/my-requests", { as: B });
  const bPending = myB.json?.items?.find((i: any) => i.status === "pending");
  check("R4: B thấy yêu cầu đang chờ của mình, kèm mã riêng", !!bPending && !!bPending.personalCode, myB.json);
  check("R5: A huỷ yêu cầu của B → 403", (await form(`/api/invites/my-requests/${reqB!.id}/cancel`, A)).status === 403);
  check("R5: id lạ → 403 (cùng mã với của người khác)", (await form(`/api/invites/my-requests/khong-co/cancel`, B)).status === 403);
  const usedBefore = (await prisma.classInvite.findUnique({ where: { code: codeB } }))!.usedCount;
  const cn = await form(`/api/invites/my-requests/${reqB!.id}/cancel`, B);
  check("B huỷ của mình → 303 ?huy=ok, status cancelled, hoàn lượt", cn.status === 303 && loc(cn).endsWith("huy=ok") && (await prisma.classJoinRequest.findUnique({ where: { id: reqB!.id } }))?.status === "cancelled" && (await prisma.classInvite.findUnique({ where: { code: codeB } }))!.usedCount === usedBefore - 1);
  const cn2 = await form(`/api/invites/my-requests/${reqB!.id}/cancel`, B);
  check("huỷ lần nữa → huy=da-xu-ly, lượt không âm", loc(cn2).endsWith("huy=da-xu-ly") && (await prisma.classInvite.findUnique({ where: { code: codeB } }))!.usedCount >= 0);
  const myB2 = await api("GET", "/api/invites/my-requests", { as: B });
  check("R4 sau huỷ: không còn yêu cầu đang chờ của lớp Duyệt", !(myB2.json?.items ?? []).some((i: any) => i.course.id === AP.id && i.status === "pending"));

  // ── (14) Không rò rỉ ─────────────────────────────────────────────────────────
  section("(14) Không rò rỉ");
  const myA = await api("GET", "/api/invites/my-requests", { as: A });
  check("R4 của A không chứa tên / id của B", !myA.text.includes(B.name) && !myA.text.includes(B.id));
  const invList = await api("GET", `/api/courses/${AP.id}/invites`, { as: T });
  check("GET invites của gia sư KHÔNG có mã cá nhân / boundUserId", invList.status === 200 && !invList.text.includes(codeA) && !invList.text.includes(codeB) && !/boundUserId|personal/.test(invList.text), invList.text.slice(0, 200));
  const forged = await api("POST", `/api/courses/${AP.id}/invites`, { as: T, body: { maxUses: 3, kind: "personal", boundUserId: A.id } });
  const forgedRow = await prisma.classInvite.findUnique({ where: { id: forged.json?.id } });
  check("POST invites bỏ qua kind / boundUserId do client gửi", forged.status === 201 && forgedRow?.kind === "class" && forgedRow.boundUserId === null, forgedRow);
  const inbox = JSON.stringify(await loadTutorInboxRaw(T.id));
  check("Hộp việc: có dòng joinRequests nhưng KHÔNG tên em", !/Em An|Em Binh|Em Chi|Xin Lop/.test(inbox));

  // ── (15) Lớp đóng ───────────────────────────────────────────────────────────
  section("(15) Lớp đóng");
  const CL = await mkCourse(T.id, { name: "Lớp Đóng", classStatus: "closed" });
  await prisma.course.update({ where: { id: CL.id }, data: { joinPolicy: "approve" } });
  const jc = await form(`/api/courses/${CL.id}/join`, E);
  check("/join lớp đóng → 303 ?join=dong", jc.status === 303 && loc(jc) === `/khoa-hoc/${CL.id}?join=dong`, loc(jc));
  const clInv = await prisma.classInvite.create({ data: { courseId: CL.id, code: "CLOSED22", maxUses: 3, createdBy: T.id } });
  const rcl = await api("POST", `/api/invites/${clInv.code}/redeem`, { as: E });
  check("redeem lớp đóng → 409, không tạo yêu cầu, không tăng lượt", rcl.status === 409 && (await prisma.classJoinRequest.count({ where: { courseId: CL.id } })) === 0 && (await prisma.classInvite.findUnique({ where: { id: clInv.id } }))?.usedCount === 0, rcl);

  // ── (17) P2/P3 rà soát ───────────────────────────────────────────────────────
  section("(17) /join chỉ-mã → 303 ?join=chi-ma; duyệt lớp đóng → dong; chờ đồng ý; mã revoked; pending → approved khi redeem vào ngay");
  await prisma.course.update({ where: { id: OLD.id }, data: { joinPolicy: null } });
  const jOld2 = await form(`/api/courses/${OLD.id}/join`, D);
  check("/join lớp chỉ-mã → 303 ?join=chi-ma (không JSON 409)", jOld2.status === 303 && loc(jOld2) === `/khoa-hoc/${OLD.id}?join=chi-ma`, [jOld2.status, loc(jOld2)]);
  // duyệt khi lớp đã đóng ⇒ dong, yêu cầu vẫn pending
  const XC = await mkCourse(T.id, { name: "Lớp Sắp Đóng" });
  await prisma.course.update({ where: { id: XC.id }, data: { joinPolicy: "approve" } });
  const xcode = codeOf(await form(`/api/courses/${XC.id}/join`, E));
  await api("POST", `/api/invites/${xcode}/redeem`, { as: E });
  const xReq = await prisma.classJoinRequest.findUnique({ where: { userId_courseId: { userId: E.id, courseId: XC.id } } });
  await prisma.course.update({ where: { id: XC.id }, data: { classStatus: "closed" } });
  const xd = await form(`/api/tutor/lop/${XC.id}/yeu-cau/${xReq!.id}/duyet`, T);
  check("duyệt lớp đóng → duyet=dong, vẫn pending", loc(xd).endsWith("duyet=dong") && (await prisma.classJoinRequest.findUnique({ where: { id: xReq!.id } }))?.status === "pending", loc(xd));
  const xb = await form(`/api/tutor/lop/${XC.id}/yeu-cau/hang-loat`, T, [["action", "duyet"], ["id", xReq!.id]]);
  check("hàng loạt lớp đóng → duyet=dong&n=0", loc(xb).includes("duyet=dong") && loc(xb).includes("n=0"), loc(xb));
  // duyệt em nhỏ khi cổng đồng ý bật ⇒ thông báo chờ phụ huynh
  const kid3 = await mkUser({ name: "Em Nhỏ Ba" });
  await prisma.user.update({ where: { id: kid3.id }, data: { dateOfBirth: new Date(Date.now() - 10 * 365 * 86_400_000) } });
  const KC = await mkCourse(T.id, { name: "Lớp Chờ Phụ Huynh" });
  await prisma.course.update({ where: { id: KC.id }, data: { joinPolicy: "approve" } });
  const kcode = codeOf(await form(`/api/courses/${KC.id}/join`, kid3));
  await api("POST", `/api/invites/${kcode}/redeem`, { as: kid3 });
  const kReq = await prisma.classJoinRequest.findUnique({ where: { userId_courseId: { userId: kid3.id, courseId: KC.id } } });
  const prevG = process.env.KIN_ENROLL_CONSENT_GATE;
  process.env.KIN_ENROLL_CONSENT_GATE = "1"; // chỉ có hiệu lực nếu máy chủ test cùng môi trường; nếu không thì ca dưới tự kiểm theo trạng thái thật
  const kd = await form(`/api/tutor/lop/${KC.id}/yeu-cau/${kReq!.id}/duyet`, T);
  if (prevG === undefined) delete process.env.KIN_ENROLL_CONSENT_GATE; else process.env.KIN_ENROLL_CONSENT_GATE = prevG;
  const kEnr = await prisma.enrollment.findFirst({ where: { userId: kid3.id, courseId: KC.id } });
  const kNote = await prisma.notification.findFirst({ where: { userId: kid3.id, type: "join_request_approved" } });
  check("duyệt → 303 ok, thông báo khớp trạng thái Enrollment (chờ đồng ý ⇒ không nói 'đã vào lớp'; không tên em, không tiền)",
    loc(kd).endsWith("duyet=ok") && !!kEnr && !!kNote && !/Em Nhỏ|\d{4,}/.test(kNote.message) &&
    (kEnr.status === "pending_consent" ? kNote.message === "Gia sư đã duyệt, đang chờ phụ huynh đồng ý" && !/đã vào lớp/i.test(kNote.title + kNote.message) : /vào lớp/.test(kNote.message)), [kEnr?.status, kNote]);
  // mã cá nhân đã thu hồi không sống lại
  const RV = await mkCourse(T.id, { name: "Lớp Mã Thu Hồi" });
  await prisma.course.update({ where: { id: RV.id }, data: { joinPolicy: "approve" } });
  const rvCode = codeOf(await form(`/api/courses/${RV.id}/join`, C));
  await prisma.classInvite.update({ where: { code: rvCode }, data: { revoked: true } });
  const rvCode2 = codeOf(await form(`/api/courses/${RV.id}/join`, C));
  const rvOld = await prisma.classInvite.findUnique({ where: { code: rvCode } });
  check("mã đã thu hồi KHÔNG sống lại; em nhận mã mới dùng được", rvCode2 !== rvCode && rvOld?.revoked === true && (await prisma.classInvite.findUnique({ where: { code: rvCode2 } }))?.revoked === false, [rvCode, rvCode2]);
  const rvRd = await api("POST", `/api/invites/${rvCode}/redeem`, { as: C });
  check("redeem mã thu hồi → bị từ chối", rvRd.status >= 400, rvRd.status);
  // pending cũ + vào lớp ngay bằng mã lớp ⇒ yêu cầu thành approved
  const PN = await mkCourse(T.id, { name: "Lớp Pending Rồi Vào" });
  await prisma.course.update({ where: { id: PN.id }, data: { joinPolicy: "approve" } });
  const pnCode = codeOf(await form(`/api/courses/${PN.id}/join`, C));
  await api("POST", `/api/invites/${pnCode}/redeem`, { as: C });
  await prisma.course.update({ where: { id: PN.id }, data: { joinPolicy: null } });
  const pnClass = await api("POST", `/api/courses/${PN.id}/invites`, { as: T, body: { maxUses: 5 } });
  const pnRd = await api("POST", `/api/invites/${pnClass.json.code}/redeem`, { as: C });
  const pnReq = await prisma.classJoinRequest.findUnique({ where: { userId_courseId: { userId: C.id, courseId: PN.id } } });
  check("vào lớp ngay bằng mã lớp → yêu cầu pending cũ thành approved, có Enrollment", pnRd.status === 200 && pnReq?.status === "approved" && (await prisma.enrollment.count({ where: { userId: C.id, courseId: PN.id } })) === 1, [pnRd.json, pnReq?.status]);

  // ── (16) Audit ───────────────────────────────────────────────────────────────
  section("(16) Audit");
  for (const act of ["class_join_request.create", "class_join_request.approve", "class_join_request.reject", "class_join_request.cancel", "class_invite.personal_issue", "enrollment.create"]) {
    check(`có audit ${act}`, (await prisma.auditLog.count({ where: { action: act } })) > 0);
  }
  const enrAudit = await prisma.auditLog.findFirst({ where: { action: "enrollment.create", resourceId: enA[0].id } });
  check("enrollment.create từ duyệt ghi source join_approved", (enrAudit?.metadata as any)?.source === "join_approved", enrAudit?.metadata);

  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
