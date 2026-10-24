// KiN Pro F4 + F5 + F6 — API + DB. Chạy với máy chủ ở hai cấu hình (xem pro-stats-run.sh):
//   EXPECT_ENFORCE=0  cổng TẮT (mặc định): ai cũng thấy khối nâng cao, ô lượt AI nói 'chưa chặn'
//   EXPECT_ENFORCE=1  KIN_PLAN_ENFORCE=1: Free bị khoá khối nâng cao (không có dữ liệu trong phản hồi), Pro thấy đủ
// Số hiển thị được so với truy vấn gốc (bảng điểm danh) bằng phép tính viết riêng trong bài này, 0 sai lệch.
import { api, mkTutor, mkUser, mkSuper, mkCourse, wipe, check, section, done, type TUser } from "./h";
import { prisma } from "@/lib/prisma";
import { vnDateKeyOf, addDaysKey } from "@/lib/classSessions";

const flag = (n: string) => { const v = process.env[n]; if (v !== "0" && v !== "1") throw new Error(`Đặt ${n}=0 hoặc 1`); return v === "1"; };
const ENFORCE = flag("EXPECT_ENFORCE");
const DAY = 86_400_000;
const COEF: Record<string, number> = { present: 1, late: 0.9, excused: 0.8, absent: 0.5 };
const dateOf = (key: string) => new Date(`${key}T00:00:00.000Z`);

(async () => {
  await wipe();
  const T = await mkTutor("Cô Thống Kê"), TF = await mkTutor("Cô Free Hỗ Trợ"), TP = await mkTutor("Cô Có Pro"), T2 = await mkTutor("Cô Khác"), A = await mkSuper("Admin Hỗ Trợ");
  const content = await mkUser({ name: "Quản trị nội dung", role: "admin", adminRole: "admin_content" });
  const stu = await mkUser({ name: "Học sinh thường" });
  await prisma.proOrder.create({ data: { userId: TP.id, period: "month", durationDays: 30, priceVnd: 0, listPriceVnd: 0, source: "admin_grant", memoCode: `THU-${Date.now()}`, status: "active", startDate: new Date(Date.now() - DAY), endDate: new Date(Date.now() + 20 * DAY) } });

  // ── Dữ liệu điểm danh tính tay ─────────────────────────────────────────────
  const today = vnDateKeyOf(new Date());
  const offs = [1, 3, 8, 10, 15, 17, 40, 70];
  const pat = ["present", "present", "late", "absent", "excused", "present"];
  const mkSet = async (owner: TUser, name: string, nStu: number, studentNames: string[] | null, sessionOffs: number[], statusOf: (i: number, j: number) => string) => {
    const course = await mkCourse(owner.id, { name });
    const studs: TUser[] = [];
    for (let i = 0; i < nStu; i++) {
      const s = await mkUser({ name: studentNames?.[i] ?? `${name} em ${i}` }); studs.push(s);
      await prisma.enrollment.create({ data: { userId: s.id, courseId: course.id, status: "active", createdAt: new Date(Date.now() - 120 * DAY) } });
    }
    for (let j = 0; j < sessionOffs.length; j++) {
      const sess = await prisma.attendanceSession.create({ data: { courseId: course.id, date: dateOf(addDaysKey(today, -sessionOffs[j])), createdBy: owner.id } });
      await prisma.attendanceRecord.createMany({ data: studs.map((s, i) => ({ sessionId: sess.id, userId: s.id, status: statusOf(i, j) })) });
    }
    return { course, studs };
  };
  // Lớp A: 6 em; em số 0 vắng/có phép 3 buổi mới nhất (offs 1,3,8) rồi mới đến lịch bình thường
  const A1 = await mkSet(T, "Toán 9A", 6, ["Em Vắng Một", "B", "C", "D", "E", "F"], offs, (i, j) => (i === 0 ? (j === 0 || j === 2 ? "absent" : j === 1 ? "excused" : "present") : pat[(i + j) % 6]));
  const B1 = await mkSet(T, "Lý 8B", 2, null, [2, 9], () => "present"); // 4 lượt → chưa đủ dữ liệu
  const O1 = await mkSet(T2, "Lớp người khác", 3, ["Em Lạ Tên Một", "Em Lạ Hai", "Em Lạ Ba"], [1, 2, 3, 4], () => "absent");

  // ── Phép tính gốc viết riêng (không dùng thư viện của sản phẩm) ───────────
  const raw = await prisma.attendanceRecord.findMany({ where: { session: { courseId: { in: [A1.course.id, B1.course.id] } } }, select: { status: true, userId: true, session: { select: { date: true, courseId: true } } } });
  const keyOf = (d: Date) => d.toISOString().slice(0, 10);
  const mondayOf = (k: string) => { const d = dateOf(k); const dow = d.getUTCDay(); return keyOf(new Date(d.getTime() - ((dow + 6) % 7) * DAY)); };
  const agg = (pred: (k: string, courseId: string) => boolean) => {
    let n = 0, sum = 0;
    for (const r of raw) { if (!pred(keyOf(r.session.date), r.session.courseId)) continue; n++; sum += COEF[r.status]; }
    return { n, rate: n >= 10 ? Math.round((sum / n) * 100) : null };
  };

  section("F4 · quyền và cổng Pro");
  const url = "/api/tutor/thong-ke-chuyen-can";
  check("chưa đăng nhập 401; học sinh 403; quản trị 403 (chỉ gia sư)", (await api("GET", url)).status === 401 && (await api("GET", url, { as: stu })).status === 403 && (await api("GET", url, { as: A })).status === 403 && (await api("GET", url, { as: content })).status === 403);
  const rFree = await api("GET", url, { as: T });
  if (ENFORCE) {
    check("cổng BẬT: gia sư Free → 200 { locked: true }", rFree.status === 200 && rFree.json.locked === true, rFree.json);
    const txt = rFree.text;
    check("phản hồi khoá KHÔNG chứa dữ liệu nào: không weekly/monthly/streaks/compare, không tên em, không tên lớp", Object.keys(rFree.json).join() === "locked" && !/Em Vắng Một|Toán 9A|weekly|streaks/.test(txt), txt);
  } else {
    check("cổng TẮT: gia sư Free vẫn xem được đủ (không chặn ai)", rFree.status === 200 && rFree.json.locked === false && Array.isArray(rFree.json.weekly), rFree.json);
  }

  section("F4 · Pro thấy đủ, số khớp truy vấn gốc");
  const mine = await mkSet(TP, "Lớp Pro", 4, null, [1, 2, 3], (i, j) => (i === 0 ? "absent" : "present")); // 12 lượt/3 buổi, em 0 vắng 3 buổi
  const rPro = await api("GET", url, { as: TP });
  check("Pro → locked false, có đủ weekly/monthly/streaks/compare", rPro.status === 200 && rPro.json.locked === false && ["weekly", "monthly", "streaks", "compare"].every(k => k in rPro.json), rPro.json);
  const perf = rPro.json.compare.rows.find((r: any) => r.courseId === mine.course.id);
  check("Pro: em vắng 3 buổi liên tiếp được báo đúng tên và số buổi", rPro.json.streaks.length === 1 && rPro.json.streaks[0].name === mine.studs[0].name && rPro.json.streaks[0].streak === 3, rPro.json.streaks);
  check("Pro: lớp 12 lượt (9 có mặt + 3 vắng) = (9+1,5)/12 = 88% (so với phép tính gốc)", perf.n === 12 && perf.rate === Math.round((10.5 / 12) * 100), perf);

  // dùng gia sư T cho phép so khớp lớn: nếu cổng bật thì T (Free) bị khoá → tạm cấp Pro để so khớp
  if (ENFORCE) await prisma.proOrder.create({ data: { userId: T.id, period: "month", durationDays: 30, priceVnd: 0, listPriceVnd: 0, source: "admin_grant", memoCode: `THU2-${Date.now()}`, status: "active", startDate: new Date(Date.now() - DAY), endDate: new Date(Date.now() + 20 * DAY) } });
  const r = await api("GET", url, { as: T });
  check("T có số liệu đầy đủ để so khớp", r.status === 200 && r.json.locked === false, r.json);
  const d = r.json;
  let bad = 0, cmpd = 0;
  for (const p of d.weekly) { const g = agg(k => mondayOf(k) === p.key); cmpd++; if (g.n !== p.n || g.rate !== p.rate) { bad++; console.log("  lệch tuần", p, g); } }
  for (const p of d.monthly) { const g = agg(k => k.slice(0, 7) === p.key); cmpd++; if (g.n !== p.n || g.rate !== p.rate) { bad++; console.log("  lệch tháng", p, g); } }
  for (const c of d.compare.rows) { const g = agg((k, cid) => cid === c.courseId && k >= d.compare.fromKey && k <= d.compare.toKey); cmpd++; if (g.n !== c.n || g.rate !== c.rate) { bad++; console.log("  lệch lớp", c, g); } }
  check(`0 sai lệch giữa ${cmpd} con số hiển thị (tuần + tháng + lớp) và truy vấn gốc`, bad === 0 && cmpd === 8 + 6 + 2, { bad, cmpd });
  check("có ít nhất một tuần và một tháng ĐỦ mẫu (có phần trăm) và một mốc chưa đủ (null) để phép so khớp có nghĩa", d.weekly.some((p: any) => p.rate !== null) && d.weekly.some((p: any) => p.n > 0 && p.rate === null) && d.monthly.some((p: any) => p.rate !== null));
  const cB = d.compare.rows.find((r: any) => r.courseId === B1.course.id);
  check("lớp Lý 8B (4 lượt) → 'chưa đủ dữ liệu': rate null, n 4", cB.rate === null && cB.n === 4);
  const sv = d.streaks.find((s: any) => s.studentId === A1.studs[0].id);
  check("em vắng/có phép 3 buổi mới nhất của lớp A được báo: streak 3, buổi gần nhất = hôm qua", sv && sv.streak === 3 && sv.lastAbsentKey === addDaysKey(today, -1), d.streaks);
  check("dữ liệu của gia sư khác KHÔNG lọt vào: không tên em, không tên lớp, không lớp của họ trong so sánh", !/Em Lạ|Lớp người khác/.test(r.text) && !d.compare.rows.some((x: any) => x.courseId === O1.course.id) && !d.streaks.some((s: any) => O1.studs.some(e => e.id === s.studentId)));
  const rOther = await api("GET", url, { as: T2 });
  if (!ENFORCE) check("gia sư khác chỉ thấy lớp mình", rOther.json.compare.rows.length === 1 && rOther.json.streaks.length === 3 && !/Em Vắng Một|Toán 9A/.test(rOther.text));

  section("F4 · số cơ bản KHÔNG bị che (Free, mọi cấu hình)");
  const rev = await api("GET", "/api/users/me/revenue", { as: T2 }); // T2 luôn là Free
  check("doanh thu theo lớp/tháng của gia sư Free vẫn 200 và đủ cấu trúc", rev.status === 200 && "totals" in rev.json && Array.isArray(rev.json.byMonth) && Array.isArray(rev.json.byClass), rev.json);
  const dash = await api("GET", "/api/tutor/goi", { as: T2 });
  check("T2 đúng là gói Free (phép thử Free hợp lệ)", dash.json.plan.code === "free" && dash.json.plan.isPro === false);

  section("F5 · /api/tutor/ai-quota: chỉ đọc, đúng số, đúng gói");
  const q = "/api/tutor/ai-quota";
  check("chưa đăng nhập 401; học sinh 403", (await api("GET", q)).status === 401 && (await api("GET", q, { as: stu })).status === 403);
  const qa = await api("GET", q, { as: A });
  check("quản trị không phải gia sư → applicable false (không hiện ô lượt)", qa.status === 200 && qa.json.applicable === false && Object.keys(qa.json).join() === "applicable", qa.json);
  const used = () => prisma.usageEvent.count({ where: { userId: T2.id, kind: "ai_extract" } });
  const q0 = await api("GET", q, { as: T2 });
  check("Free: còn 3/3, enforced đúng cờ máy chủ", q0.json.applicable === true && q0.json.plan === "free" && q0.json.limit === 3 && q0.json.remaining === 3 && q0.json.used === 0 && q0.json.enforced === ENFORCE, q0.json);
  await api("GET", q, { as: T2 }); await api("GET", q, { as: T2 });
  check("đọc nhiều lần KHÔNG trừ lượt (chỉ đọc)", (await used()) === 0 && (await prisma.usageEvent.count({ where: { userId: T2.id } })) === 0);
  const fd = () => { const f = new FormData(); f.append("examFile", new Blob(["%PDF-1.4 thử"], { type: "application/pdf" }), "de.pdf"); return f; };
  const ex = await api("POST", "/api/exams/ai-extract-questions", { as: T2, raw: fd() });
  check("trích lỗi (máy thử không có khoá) → 500 và lượt được trả lại: ô vẫn 'còn 3'", ex.status === 500 && (await api("GET", q, { as: T2 })).json.remaining === 3);
  for (let i = 0; i < 2; i++) await prisma.usageEvent.create({ data: { userId: T2.id, kind: "ai_extract", meta: { thu: true } } });
  const q2 = await api("GET", q, { as: T2 });
  check("dùng 2 lượt → còn 1, 67% nên vẫn ok (warn từ 80%)", q2.json.remaining === 1 && q2.json.used === 2 && q2.json.state === "ok", q2.json);
  await prisma.usageEvent.create({ data: { userId: T2.id, kind: "ai_extract", meta: { thu: true } } });
  const q3 = await api("GET", q, { as: T2 });
  check("dùng 3 lượt → còn 0, trạng thái blocked", q3.json.remaining === 0 && q3.json.state === "blocked", q3.json);
  const ex2 = await api("POST", "/api/exams/ai-extract-questions", { as: T2, raw: fd() });
  if (ENFORCE) check("cổng BẬT, hết lượt: tuyến trích trả 409 PLAN_LIMIT; ô vẫn 0 và không tốn thêm", ex2.status === 409 && ex2.json.code === "PLAN_LIMIT" && (await api("GET", q, { as: T2 })).json.remaining === 0);
  else check("cổng TẮT, hết lượt: vẫn gọi tiếp (500 vì không khoá), không chặn; ô vẫn nói enforced=0", ex2.status === 500 && (await api("GET", q, { as: T2 })).json.enforced === false);
  const qp = await api("GET", q, { as: TP });
  check("Pro: hạn mức 20 lượt (từ cấu hình)", qp.json.plan === "pro" && qp.json.limit === 20 && qp.json.remaining === 20, qp.json);

  section("F6 · gửi yêu cầu hỗ trợ");
  const sp = "/api/tutor/ho-tro", good = (o: object = {}) => ({ kind: "setup", subject: "Không nối được SePay", message: "Webhook báo lỗi khi tôi dán khoá API, thử hai lần vẫn vậy.", ...o });
  check("chưa đăng nhập 401; học sinh 403; quản trị 403", (await api("POST", sp, { body: good() })).status === 401 && (await api("POST", sp, { as: stu, body: good() })).status === 403 && (await api("POST", sp, { as: A, body: good() })).status === 403);
  check("đầu vào xấu → 400 (loại lạ, tiêu đề ngắn, nội dung ngắn, không body)", (await api("POST", sp, { as: TF, body: good({ kind: "vip" }) })).status === 400 && (await api("POST", sp, { as: TF, body: good({ subject: "ab" }) })).status === 400 && (await api("POST", sp, { as: TF, body: good({ message: "ngắn" }) })).status === 400 && (await api("POST", sp, { as: TF })).status === 400);
  check("sau các lần 400 chưa có bản ghi nào", (await prisma.supportRequest.count()) === 0);
  const nT = await api("POST", sp, { as: TF, body: good({ kind: "other", subject: "Hỏi chung từ Free" }) });
  await new Promise(r => setTimeout(r, 15));
  const pP = await api("POST", sp, { as: TP, body: good({ subject: "Kẹt cuối tháng từ Pro" }) });
  await new Promise(r => setTimeout(r, 15));
  const sF = await api("POST", sp, { as: T2, body: good({ kind: "serious", subject: "Lộ thông tin lớp" }) });
  check("Free gửi → 201, làn 'normal'; Pro → làn 'priority'; nghiêm trọng của Free → làn 'serious'", nT.status === 201 && nT.json.request.lane === "normal" && pP.status === 201 && pP.json.request.lane === "priority" && sF.status === 201 && sF.json.request.lane === "serious", [nT.json, pP.json, sF.json]);
  check("gói lúc gửi được chụp lại trong DB (free / pro / free)", (await prisma.supportRequest.findMany({ orderBy: { createdAt: "asc" }, select: { planAtSend: true } })).map(x => x.planAtSend).join() === "free,pro,free");
  check("lời hứa trả về: Pro có 'giờ hành chính', Free thì 'chưa cam kết'; không 24/7", /giờ hành chính/.test(pP.json.promise) && /chưa cam kết/.test(nT.json.promise) && !/24\s*\/\s*7/.test(pP.text + nT.text));
  const myList = await api("GET", sp, { as: TF });
  check("gia sư chỉ thấy yêu cầu của MÌNH", myList.status === 200 && myList.json.requests.length === 1 && myList.json.requests[0].subject === "Hỏi chung từ Free" && !/Kẹt cuối tháng|Lộ thông tin/.test(myList.text));
  for (let i = 0; i < 2; i++) await api("POST", sp, { as: TF, body: good({ subject: `Thêm lần ${i}` }) });
  const over = await api("POST", sp, { as: TF, body: good({ subject: "Lần thứ tư" }) });
  check("quá 3 yêu cầu đang chờ → 429, chữ rõ, không tạo thêm", over.status === 429 && /3 yêu cầu chưa được trả lời/.test(over.json.error) && (await prisma.supportRequest.count({ where: { userId: TF.id } })) === 3);
  const concurrent = await Promise.all(Array.from({ length: 5 }, (_, i) => api("POST", sp, { as: TP, body: good({ subject: `Song song ${i}` }) })));
  check("5 yêu cầu gửi cùng lúc từ một gia sư: tối đa 3 đang chờ (khoá theo gia sư), không vượt", (await prisma.supportRequest.count({ where: { userId: TP.id, status: "open" } })) === 3 && concurrent.filter(x => x.status === 201).length === 2, concurrent.map(x => x.status));

  section("F6 · hàng đợi quản trị: khẩn → Pro → thường, trả lời, đóng");
  const aq = "/api/admin/ho-tro";
  check("chưa đăng nhập 401; gia sư 403; học sinh 403", (await api("GET", aq)).status === 401 && (await api("GET", aq, { as: TF })).status === 403 && (await api("GET", aq, { as: stu })).status === 403);
  const lq = await api("GET", aq, { as: A });
  const lanes = lq.json.requests.map((x: any) => x.lane);
  const firstNormal = lanes.indexOf("normal"), lastPrio = lanes.lastIndexOf("priority"), lastSerious = lanes.lastIndexOf("serious");
  check("quản trị thấy hàng đợi: mọi 'serious' trước mọi 'priority', mọi 'priority' trước mọi 'normal'", lq.status === 200 && lastSerious < lanes.indexOf("priority") && lastPrio < firstNormal, lanes);
  check("Free gửi SỚM hơn nhưng đứng sau Pro gửi muộn hơn", lq.json.requests.findIndex((x: any) => x.subject === "Kẹt cuối tháng từ Pro") < lq.json.requests.findIndex((x: any) => x.subject === "Hỏi chung từ Free"));
  check("có tên + email gia sư để trả lời; số đang chờ đúng", lq.json.requests.every((x: any) => x.userName && x.userEmail) && lq.json.openCount === (await prisma.supportRequest.count({ where: { status: "open" } })));
  const content2 = await api("GET", aq, { as: content });
  check("quản trị nội dung (có MANAGE_TUTORS) cũng xem được", content2.status === 200);
  const id = (await prisma.supportRequest.findFirst({ where: { userId: TF.id, subject: "Hỏi chung từ Free" } }))!.id;
  const pa = `${aq}/${id}`;
  check("PATCH: chưa đăng nhập 401, gia sư 403, id lạ 404, action lạ 400, trả lời rỗng 400", (await api("PATCH", pa, { body: { action: "close" } })).status === 401 && (await api("PATCH", pa, { as: TF, body: { action: "close" } })).status === 403 && (await api("PATCH", `${aq}/khong-co`, { as: A, body: { action: "close" } })).status === 404 && (await api("PATCH", pa, { as: A, body: { action: "x" } })).status === 400 && (await api("PATCH", pa, { as: A, body: { action: "reply", reply: " " } })).status === 400);
  check("trả lời → 200, trạng thái 'answered'", (await api("PATCH", pa, { as: A, body: { action: "reply", reply: "Cô thử bấm Lưu khoá lần nữa nhé." } })).status === 200 && (await prisma.supportRequest.findUnique({ where: { id } }))!.status === "answered");
  const mine2 = await api("GET", sp, { as: TF });
  const row = mine2.json.requests.find((x: any) => x.id === id);
  check("gia sư thấy câu trả lời và trạng thái 'Đã trả lời'", row.reply === "Cô thử bấm Lưu khoá lần nữa nhé." && row.status === "answered" && row.statusLabel === "Đã trả lời");
  const after = await api("POST", sp, { as: TF, body: good({ subject: "Gửi tiếp sau khi được trả lời" }) });
  check("đã trả lời thì không còn tính 'đang chờ': gia sư gửi thêm được (201)", after.status === 201, after.json);
  check("đóng → 200; trả lời yêu cầu đã đóng → 409", (await api("PATCH", pa, { as: A, body: { action: "close" } })).status === 200 && (await api("PATCH", pa, { as: A, body: { action: "reply", reply: "muộn" } })).status === 409);
  check("tổng số yêu cầu không có cột học sinh nào bị thu: bảng chỉ có chữ do gia sư gõ", Object.keys((await prisma.supportRequest.findFirst())!).join() === "id,userId,kind,subject,message,planAtSend,status,reply,repliedBy,repliedAt,closedAt,createdAt");

  await done();
})().catch(e => { console.error("CRASH", e); process.exit(1); });
