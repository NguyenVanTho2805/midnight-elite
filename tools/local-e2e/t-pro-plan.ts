// KiN Pro — NỀN GÓI: API + DB. Cổng hạn mức (409 PLAN_LIMIT khi BẬT, không chặn khi TẮT), đếm bóng, quyền admin, cấu hình không viết cứng,
// yêu cầu mua theo kỳ (QR từ biến môi trường, kích hoạt tay, cộng dồn), tặng Pro, Phase 0 (nạp Coin của gia sư, STK giả).
// Cờ là biến môi trường của MÁY CHỦ nên chạy BA lần, mỗi lần khởi động máy chủ khác nhau (xem tools/local-e2e/pro-plan-run.sh):
//   A: máy chủ mặc định                                  → EXPECT_ENFORCE=0 EXPECT_TRIAL=0 EXPECT_PAY=0
//   B: KIN_PLAN_ENFORCE=1 KIN_TRIAL_MODE=1                → EXPECT_ENFORCE=1 EXPECT_TRIAL=1 EXPECT_PAY=0
//   C: KIN_PLAN_ENFORCE=1 + KINPRO_* + KIN_TOPUP_*        → EXPECT_ENFORCE=1 EXPECT_TRIAL=0 EXPECT_PAY=1
// Bài tự đặt KIN_PLAN_ENFORCE trong tiến trình của nó cho khớp máy chủ (để thử thư viện canUse / getTutorPlan).
import { api, mkCourse, mkSuper, mkTutor, mkUser, wipe, check, section, done, type TUser } from "./h";
import { prisma } from "@/lib/prisma";

const flag = (n: string) => { const v = process.env[n]; if (v !== "0" && v !== "1") throw new Error(`Đặt ${n}=0 hoặc 1 (cờ mà máy chủ đang chạy).`); return v === "1"; };
const ENFORCE = flag("EXPECT_ENFORCE"), TRIAL = flag("EXPECT_TRIAL"), PAY = flag("EXPECT_PAY");
if (ENFORCE) process.env.KIN_PLAN_ENFORCE = "1"; else delete process.env.KIN_PLAN_ENFORCE;

const DAY = 86_400_000;
let seq = 0;

(async () => {
  const { getTutorPlan, canUse, countTutorActiveStudents } = await import("@/lib/planServer");
  const { loadTutorDashboard } = await import("@/lib/tutorDashboard");
  await wipe();
  const T = await mkTutor("Cô Đầy Lớp"), T2 = await mkTutor("Cô Khác"), T3 = await mkTutor("Cô Mua Gói"), T5 = await mkTutor("Cô Mua Sau");
  const A = await mkSuper("Admin Tiền"), C = await mkUser({ name: "Quản trị nội dung", role: "admin", adminRole: "admin_content" });
  const course = await mkCourse(T.id, { name: "Lớp của cô Đầy" }), course2 = await mkCourse(T.id, { name: "Lớp thứ hai" }), courseOther = await mkCourse(T2.id);
  const students: TUser[] = [];
  const enroll = async (courseId: string, n: number) => {
    for (let i = 0; i < n; i++) { const s = await mkUser({ name: `Em ${++seq}` }); students.push(s); await prisma.enrollment.create({ data: { userId: s.id, courseId, status: "active" } }); }
  };
  const invite = (courseId: string, by: string) => prisma.classInvite.create({ data: { courseId, code: `PRO${++seq}XYZ`.slice(0, 8).padEnd(8, "A"), createdBy: by } });
  const usage = (userId: string, kind: string) => prisma.usageEvent.count({ where: { userId, kind } });
  const enrolled = (userId: string, courseId: string) => prisma.enrollment.count({ where: { userId, courseId } });
  const stateOf = async (u: TUser) => (await api("GET", "/api/tutor/goi", { as: u })).json.plan;

  section(`Máy chủ đúng chế độ (cưỡng chế ${ENFORCE ? "BẬT" : "TẮT"}, chạy thử ${TRIAL ? "BẬT" : "TẮT"}, nhận tiền ${PAY ? "ĐÃ cấu hình" : "CHƯA cấu hình"})`);
  const g0 = await api("GET", "/api/tutor/goi", { as: T });
  check("GET /api/tutor/goi → 200, gói Free, enforced đúng chế độ máy chủ", g0.status === 200 && g0.json.plan.code === "free" && g0.json.plan.enforced === ENFORCE, g0.json);
  check("hạn mức mặc định từ cấu hình: 10 học viên, 3 lượt AI; giá Pro 79.000 / 199.000 / 599.000", g0.json.plan.quota.students.limit === 10 && g0.json.plan.quota.aiExtract.limit === 3 && g0.json.configs.pro.priceMonthVnd === 79000 && g0.json.configs.pro.priceQuarterVnd === 199000 && g0.json.configs.pro.priceYearVnd === 599000, g0.json.configs);
  check(PAY ? "đã cấu hình nhận tiền: bán gói mở" : "chưa cấu hình: 'Chưa mở bán', không có tài khoản nào trong phản hồi", PAY ? g0.json.sale.open === true : (g0.json.sale.open === false && g0.json.sale.text === "Chưa mở bán" && !/accountNo|0123456789|CONG TY/.test(g0.text)), g0.json.sale);
  check("quyền: học sinh 403, quản trị 403, chưa đăng nhập 401", (await api("GET", "/api/tutor/goi", { as: await mkUser() })).status === 403 && (await api("GET", "/api/tutor/goi", { as: A })).status === 403 && (await api("GET", "/api/tutor/goi")).status === 401);
  check("mua gói: kỳ lạ → 400; chưa đăng nhập → 401; học sinh → 403", (await api("POST", "/api/tutor/goi/mua", { as: T, body: { period: "week" } })).status === 400 && (await api("POST", "/api/tutor/goi/mua", { body: { period: "month" } })).status === 401 && (await api("POST", "/api/tutor/goi/mua", { as: await mkUser(), body: { period: "month" } })).status === 403);

  section("Phase 0: nạp Coin của gia sư, STK giả");
  const tp = await api("POST", "/api/wallet/topups", { as: T2, body: { amountVnd: 100000, bankRef: "FTPRO1" } });
  if (TRIAL) {
    check("KIN_TRIAL_MODE bật: gia sư gửi yêu cầu nạp → 403 kèm chữ rõ, không tạo bản ghi", tp.status === 403 && tp.json.error === "KiN đang miễn phí trong giai đoạn chạy thử, chưa cần nạp Coin." && (await prisma.coinTopupRequest.count({ where: { userId: T2.id } })) === 0, tp.json);
  } else {
    check("KIN_TRIAL_MODE tắt: gia sư nạp như cũ → 201", tp.status === 201 && (await prisma.coinTopupRequest.count({ where: { userId: T2.id } })) === 1, tp.json);
  }
  const tpS = await api("POST", "/api/wallet/topups", { as: await mkUser(), body: { amountVnd: 100000 } });
  check("học sinh vẫn 403 như cũ (cả hai chế độ)", tpS.status === 403);
  const bank = (await api("GET", "/api/wallet/topups", { as: T2 })).json.bank;
  check(PAY ? "có KIN_TOPUP_*: khối chuyển khoản lấy từ biến môi trường" : "không có KIN_TOPUP_*: bank = null (ẩn), KHÔNG còn Vietcombank 0123456789", PAY ? (bank?.accountNo === "9704360099887" && bank?.accountName === "KIN TOPUP THU" && bank?.bankName === "Ngan hang thu") : bank === null, bank);

  section("Đếm học viên đúng như loadTutorDashboard");
  await enroll(course.id, 5); await enroll(course2.id, 2);
  const d1 = await loadTutorDashboard(T.id);
  check("countTutorActiveStudents = totalStudents của dashboard (7)", (await countTutorActiveStudents(T.id)) === 7 && d1.totalStudents === 7);
  const dup = students[0]; await prisma.enrollment.create({ data: { userId: dup.id, courseId: course2.id, status: "active" } });
  const susp = await mkUser({ name: "Em đã nghỉ" }); await prisma.enrollment.create({ data: { userId: susp.id, courseId: course.id, status: "suspended" } });
  const pend = await mkUser({ name: "Em chờ đồng ý" }); await prisma.enrollment.create({ data: { userId: pend.id, courseId: course.id, status: "pending_consent" } });
  const d2 = await loadTutorDashboard(T.id);
  check("một em học hai lớp của cùng gia sư chỉ đếm 1; em đã nghỉ và chờ đồng ý không đếm → vẫn 7", (await countTutorActiveStudents(T.id)) === 7 && d2.totalStudents === 7);
  check("học viên của gia sư khác không lọt vào", (await countTutorActiveStudents(T2.id)) === 0);

  section("Bốn trạng thái qua API");
  check("7/10 → ok", (await stateOf(T)).state.students === "ok" && (await stateOf(T)).usage.students === 7);
  await enroll(course.id, 1);
  check("8/10 → warn (có chữ x/N trong dữ liệu)", (await stateOf(T)).state.students === "warn" && (await stateOf(T)).quota.students.used === 8);

  section("Cổng mã mời / mời hàng loạt (tạo MỚI)");
  const mk = (as: TUser, cid: string, body: object) => api("POST", `/api/courses/${cid}/invites`, { as, body });
  const i8 = await mk(T, course.id, {});
  check("8/10: tạo mã thường → 201", i8.status === 201, i8.json);
  const b5 = await mk(T, course.id, { maxUses: 5 });
  const b2 = await mk(T, course.id, { maxUses: 2 });
  if (ENFORCE) {
    check("8/10, mời hàng loạt 5 em (chỉ còn 2 chỗ) → 409 PLAN_LIMIT, chữ nói rõ còn mấy chỗ, lớp không đổi", b5.status === 409 && b5.json.code === "PLAN_LIMIT" && /còn chỗ cho 2 học viên/.test(b5.json.error), b5.json);
  } else {
    check("cổng TẮT: mời hàng loạt 5 em khi còn 2 chỗ → vẫn 201 (không ai bị chặn)", b5.status === 201, b5.json);
  }
  check("mời hàng loạt đúng 2 em (đủ chỗ) → 201", b2.status === 201, b2.json);
  const bNoLimit = await mk(T, course.id, {});
  check("mã không giới hạn lượt chỉ cần 1 chỗ → 201", bNoLimit.status === 201);
  await enroll(course.id, 2); // đủ 10
  const at10 = await mk(T, course.id, {});
  check("10/10 → trạng thái blocked", (await stateOf(T)).state.students === "blocked");
  if (ENFORCE) {
    check("10/10: tạo mã mời → 409 PLAN_LIMIT, thông điệp tiếng Việt, kèm quota", at10.status === 409 && at10.json.code === "PLAN_LIMIT" && /tối đa 10 học viên/.test(at10.json.error) && at10.json.quota.state === "blocked", at10.json);
    check("thông điệp cho gia sư nói giữ nguyên dữ liệu và chỉ đường tới Gói của tôi", /giữ nguyên/.test(at10.json.error) && /Gói của tôi/.test(at10.json.error));
    check("gia sư khác (không đầy) vẫn tạo được", (await mk(T2, courseOther.id, {})).status === 201);
    check("quản trị tạo hộ cho lớp của gia sư đầy cũng bị cổng của gia sư đó chặn", (await mk(A, course.id, {})).status === 409);
    check("đã chặn thì ghi nhật ký 'gate_blocked' (không tên học sinh, không tiền)", (await usage(T.id, "gate_blocked")) >= 2 && !JSON.stringify(await prisma.usageEvent.findMany({ where: { userId: T.id, kind: "gate_blocked" } })).match(/Em \d|amount|price/));
  } else {
    check("cổng TẮT: 10/10 vẫn tạo mã → 201 (không ai bị chặn)", at10.status === 201, at10.json);
    check("đếm bóng: ghi 'gate_would_block' để đo, không ghi 'gate_blocked'", (await usage(T.id, "gate_would_block")) >= 1 && (await usage(T.id, "gate_blocked")) === 0);
  }

  section("Cổng ghi danh bằng mã mời (học viên)");
  const inv = await invite(course.id, T.id);
  const S11 = await mkUser({ name: "Em thứ mười một" });
  const used0 = (await prisma.classInvite.findUnique({ where: { id: inv.id } }))!.usedCount;
  const r11 = await api("POST", `/api/invites/${inv.code}/redeem`, { as: S11 });
  if (ENFORCE) {
    check("10/10: em mới nhập mã → 409 'Lớp tạm chưa nhận thêm' (chữ trung tính)", r11.status === 409 && r11.json.error === "Lớp tạm chưa nhận thêm", r11.json);
    check("học viên KHÔNG thấy tên gói / giới hạn / Free / Pro / PLAN_LIMIT trong phản hồi", !/Free|Pro\b|PLAN_LIMIT|hạn mức|gói/i.test(r11.text), r11.text);
    check("không tạo ghi danh, không tăng lượt dùng mã (giao dịch hoàn lại)", (await enrolled(S11.id, course.id)) === 0 && (await prisma.classInvite.findUnique({ where: { id: inv.id } }))!.usedCount === used0);
    const rDup = await api("POST", `/api/invites/${inv.code}/redeem`, { as: students[5] });
    check("em ĐÃ đang học với cô (ở lớp thứ hai) vào thêm lớp này → 200, không đếm hai lần dù đã đủ 10", rDup.status === 200 && rDup.json.alreadyEnrolled !== true && (await enrolled(students[5].id, course.id)) === 1 && (await countTutorActiveStudents(T.id)) === 10, rDup.json);
    check("lớp của gia sư khác không bị ảnh hưởng", (await api("POST", `/api/invites/${(await invite(courseOther.id, T2.id)).code}/redeem`, { as: await mkUser() })).status === 200);
  } else {
    check("cổng TẮT: em thứ 11 vào được → 200, có ghi danh", r11.status === 200 && (await enrolled(S11.id, course.id)) === 1, r11.json);
    check("đếm bóng: ghi 'gate_would_block' cho lần ghi danh vượt trần", (await usage(T.id, "gate_would_block")) >= 2);
    check("quá trần (11) → trạng thái over, mọi học viên vẫn đủ (không ẩn ai)", (await stateOf(T)).state.students === "over" && (await countTutorActiveStudents(T.id)) === 11);
  }

  section("Quota AI trích đề");
  const fd = () => { const f = new FormData(); f.append("examFile", new Blob(["%PDF-1.4 thử"], { type: "application/pdf" }), "de.pdf"); return f; };
  const ai = (as: TUser) => api("POST", "/api/exams/ai-extract-questions", { as, raw: fd() });
  const aiStart = await usage(T2.id, "ai_extract");
  const a1 = await ai(T2);
  check("còn lượt: gọi tới bước AI (máy thử không có khoá Gemini → 500 'chưa được cấu hình'), lượt được TRẢ LẠI khi thất bại", a1.status === 500 && /GEMINI_API_KEY/.test(a1.json?.error ?? "") && (await usage(T2.id, "ai_extract")) === aiStart, a1.json);
  for (let i = 0; i < 3; i++) await prisma.usageEvent.create({ data: { userId: T2.id, kind: "ai_extract", meta: { thu: true } } });
  const a2 = await ai(T2);
  if (ENFORCE) {
    check("hết 3/3 lượt: 409 PLAN_LIMIT, nói rõ hết lượt và tính lại đầu tháng", a2.status === 409 && a2.json.code === "PLAN_LIMIT" && /3 lượt AI/.test(a2.json.error) && /đầu tháng/.test(a2.json.error), a2.json);
    check("bị chặn thì không tốn thêm lượt, ghi 'gate_blocked'", (await usage(T2.id, "ai_extract")) === 3 && (await usage(T2.id, "gate_blocked")) >= 1);
  } else {
    check("cổng TẮT: hết 3/3 vẫn gọi tiếp (→ 500 vì không khoá), KHÔNG chặn; lượt đo được trả lại; 'gate_would_block' ghi để đo", a2.status === 500 && (await usage(T2.id, "ai_extract")) === 3 && (await usage(T2.id, "gate_would_block")) >= 1, a2.json);
  }
  const t2plan = await stateOf(T2);
  check("GET /api/tutor/goi báo đúng lượt AI đã dùng (3/3, blocked)", t2plan.quota.aiExtract.used === 3 && t2plan.quota.aiExtract.remaining === 0 && t2plan.state.aiExtract === "blocked", t2plan);
  const bad = await api("POST", "/api/exams/ai-extract-questions", { as: T2, raw: (() => { const f = new FormData(); f.append("examFile", new Blob(["x"], { type: "text/plain" }), "a.txt"); return f; })() });
  check("tệp sai định dạng → 400 và KHÔNG đụng tới hạn mức", bad.status === 400 && (await usage(T2.id, "ai_extract")) === 3);
  await prisma.usageEvent.create({ data: { userId: T2.id, kind: "ai_extract", createdAt: new Date(Date.now() - 62 * DAY) } });
  check("lượt tháng trước không tính vào tháng này", (await stateOf(T2)).quota.aiExtract.used === 3);
  const adminAi = await ai(A);
  check("quản trị trung tâm không bị đếm lượt AI", adminAi.status === 500 && (await usage(A.id, "ai_extract")) === 0 && (await usage(A.id, "gate_blocked")) === 0);

  section("Hàm dùng chung getTutorPlan / canUse");
  const pl = await getTutorPlan(T.id);
  check("getTutorPlan: {code,isPro,limits,usage,state}", pl.code === "free" && pl.isPro === false && pl.limits.students === 10 && pl.usage.students === (ENFORCE ? 10 : 11) && typeof pl.state.students === "string" && pl.enforced === ENFORCE, pl);
  check("canUse reminder_steps / branded_docs / advanced_stats: " + (ENFORCE ? "Free bị chặn" : "cổng TẮT → ai cũng dùng được"), (await canUse(T.id, "reminder_steps")) === !ENFORCE && (await canUse(T.id, "branded_docs")) === !ENFORCE && (await canUse(T.id, "advanced_stats")) === !ENFORCE);
  check("canUse ai_extract_quota theo lượt còn: T2 hết lượt", (await canUse(T2.id, "ai_extract_quota")) === !ENFORCE && (await canUse(T3.id, "ai_extract_quota")) === true);
  check("canUse với người không tồn tại không ném lỗi", typeof (await canUse("khong-co", "reminder_steps")) === "boolean");

  section("Admin: cấu hình sửa được, không viết cứng");
  const ga = await api("GET", "/api/admin/pro", { as: A });
  check("admin_super xem cấu hình → 200, có số đo, enforced đúng chế độ", ga.status === 200 && ga.json.enforced === ENFORCE && ga.json.measure.tutors === 4 && ga.json.measure.freeLimit === 10, ga.json?.measure);
  check("số đo không có tên người (chỉ tổng hợp)", !/Em \d|Cô /.test(JSON.stringify(ga.json.measure)));
  check("số đo theo trần Free: T (≥10) thuộc blocked/over, các gia sư còn lại ok", ga.json.measure.byState.ok === 3 && ga.json.measure.byState.blocked + ga.json.measure.byState.over === 1, ga.json.measure.byState);
  check("quyền: gia sư 403, quản trị nội dung 403, chưa đăng nhập 401", (await api("GET", "/api/admin/pro", { as: T })).status === 403 && (await api("GET", "/api/admin/pro", { as: C })).status === 403 && (await api("GET", "/api/admin/pro")).status === 401);
  const put = (as: TUser | undefined, body: unknown) => api("PUT", "/api/admin/pro/config", { as, body });
  const cfgNow = ga.json.configs;
  check("PUT cấu hình: gia sư 403, quản trị nội dung 403, chưa đăng nhập 401", (await put(T, { plans: [cfgNow.free] })).status === 403 && (await put(C, { plans: [cfgNow.free] })).status === 403 && (await put(undefined, {})).status === 401);
  check("PHÁ: trần âm → 400; giá lẻ → 400; mã gói lạ → 400; thân rỗng → 400", (await put(A, { plans: [{ ...cfgNow.free, studentLimit: -1 }] })).status === 400 && (await put(A, { plans: [{ ...cfgNow.pro, priceMonthVnd: 79000.5 }] })).status === 400 && (await put(A, { plans: [{ ...cfgNow.pro, code: "vip" }] })).status === 400 && (await put(A, {})).status === 400);
  const before = await prisma.planConfig.count();
  const ok1 = await put(A, { plans: [{ ...cfgNow.free, studentLimit: 12 }, { ...cfgNow.pro, priceMonthVnd: 99_000 }], settings: { foundingSlots: 1 } });
  check("admin_super lưu cấu hình → 200, ghi bảng PlanConfig + audit", ok1.status === 200 && (await prisma.planConfig.count()) === before + 2 && (await prisma.auditLog.count({ where: { action: "pro_config.update", actorId: A.id } })) === 1, ok1.json);
  const p12 = await stateOf(T);
  check("đổi hạn mức Free 10 → 12 có hiệu lực ngay: trần 12 và trạng thái đổi theo (10-11 em trên 12 là warn, không còn blocked/over)", p12.quota.students.limit === 12 && p12.state.students === "warn", p12.quota.students);
  check("giá Pro mới 99.000 hiện ra", (await api("GET", "/api/tutor/goi", { as: T })).json.configs.pro.priceMonthVnd === 99000);
  if (ENFORCE) check("với trần 12, tạo mã mời của T (10/12) → 201 trở lại (cấu hình có tác dụng thật, không viết cứng)", (await mk(T, course.id, {})).status === 201);

  if (PAY) {
    section("Yêu cầu mua Pro: QR theo kỳ, kích hoạt tay, cộng dồn (nhận tiền từ biến môi trường)");
    await put(A, { plans: [{ ...cfgNow.free }, { ...cfgNow.pro, priceMonthVnd: 79_000 }], settings: { foundingSlots: 1, foundingDiscountPct: 30, foundingMonths: 12 } });
    const m1 = await api("POST", "/api/tutor/goi/mua", { as: T3, body: { period: "month" } });
    const o1 = m1.json.pending;
    check("tạo yêu cầu kỳ tháng → 201, giá sáng lập −30% (79.000 → 55.300), mã KINPRO-xxxxxxxx", m1.status === 201 && o1.priceVnd === 55_300 && o1.listPriceVnd === 79_000 && o1.foundingDiscountPct === 30 && /^KINPRO-[2-9A-Z]{8}$/.test(o1.memoCode), m1.json);
    const q = new URL(o1.qrUrl);
    check("QR: đúng số tiền, đúng số tài khoản & BIN từ biến môi trường, nội dung là mã; tên chủ TK chuẩn hoá", q.searchParams.get("amount") === "55300" && q.searchParams.get("addInfo") === o1.memoCode && q.pathname.includes("970436-9704360012345") && o1.account.accountName === "KIN PRO THU" && o1.account.accountNo === "9704360012345", o1);
    const m1b = await api("POST", "/api/tutor/goi/mua", { as: T3, body: { period: "month" } });
    check("bấm lại cùng kỳ → 200, trả đúng yêu cầu cũ (không tạo trùng)", m1b.status === 200 && m1b.json.created === false && m1b.json.pending.memoCode === o1.memoCode && (await prisma.proOrder.count({ where: { userId: T3.id } })) === 1);
    const m2 = await api("POST", "/api/tutor/goi/mua", { as: T3, body: { period: "quarter" } });
    check("đổi sang kỳ quý → yêu cầu tháng bị huỷ, chỉ còn một yêu cầu chờ; giá quý 199.000 −30% = 139.300", m2.status === 201 && m2.json.pending.priceVnd === 139_300 && (await prisma.proOrder.findUnique({ where: { id: o1.id } }))?.status === "cancelled" && (await prisma.proOrder.count({ where: { userId: T3.id, status: "pending" } })) === 1, m2.json.pending);
    const o2 = m2.json.pending;
    check("chưa kích hoạt thì CHƯA là Pro", (await stateOf(T3)).isPro === false && (await canUse(T3.id, "branded_docs")) === false);
    check("kích hoạt: gia sư 403, quản trị nội dung 403, chưa đăng nhập 401", (await api("POST", `/api/admin/pro/orders/${o2.id}/activate`, { as: T3 })).status === 403 && (await api("POST", `/api/admin/pro/orders/${o2.id}/activate`, { as: C })).status === 403 && (await api("POST", `/api/admin/pro/orders/${o2.id}/activate`)).status === 401);
    const lst = await api("GET", "/api/admin/pro", { as: A });
    check("danh sách yêu cầu của admin có tên + email + mã để đối chiếu sao kê", lst.json.orders.some((o: any) => o.memoCode === o2.memoCode && o.userName === "Cô Mua Gói" && o.userEmail === T3.email && o.status === "pending"));
    const act = await api("POST", `/api/admin/pro/orders/${o2.id}/activate`, { as: A, body: { bankRef: "FT-THU-1" } });
    const row2 = await prisma.proOrder.findUnique({ where: { id: o2.id } });
    check("admin kích hoạt → 200, đủ 90 ngày kể từ bây giờ, ghi người kích hoạt + mã giao dịch", act.status === 200 && row2?.status === "active" && row2.activatedBy === A.id && row2.bankRef === "FT-THU-1" && Math.abs((row2.endDate!.getTime() - row2.startDate!.getTime()) - 90 * DAY) < 1000 && Math.abs(row2.startDate!.getTime() - Date.now()) < 60_000, act.json);
    check("ghi audit 'pro_order.activate' có actor", (await prisma.auditLog.count({ where: { action: "pro_order.activate", actorId: A.id, resourceId: o2.id } })) === 1);
    const p3 = await stateOf(T3);
    check("gia sư thấy Pro tới ngày cuối; hạn mức học viên là của Pro; canUse Pro mở", p3.isPro && p3.code === "pro" && Math.abs(new Date(p3.proUntil).getTime() - row2!.endDate!.getTime()) < 1000 && p3.quota.students.limit === 500 && (await canUse(T3.id, "branded_docs")) === true && (await canUse(T3.id, "reminder_steps")) === true);
    const again = await api("POST", `/api/admin/pro/orders/${o2.id}/activate`, { as: A });
    check("bấm kích hoạt lần hai → 409, KHÔNG cộng hai lần", again.status === 409 && (await prisma.proOrder.findUnique({ where: { id: o2.id } }))?.endDate?.getTime() === row2!.endDate!.getTime());
    const m3 = await api("POST", "/api/tutor/goi/mua", { as: T3, body: { period: "month" } });
    check("gia hạn khi đang Pro: giá sáng lập vẫn giữ (trong 12 tháng) 55.300", m3.status === 201 && m3.json.pending.priceVnd === 55_300 && m3.json.pending.foundingDiscountPct === 30);
    const act3 = await api("POST", `/api/admin/pro/orders/${m3.json.pending.id}/activate`, { as: A });
    const row3 = await prisma.proOrder.findUnique({ where: { id: m3.json.pending.id } });
    check("CỘNG DỒN: kỳ mới bắt đầu đúng lúc kỳ cũ hết, dài 30 ngày", act3.status === 200 && row3!.startDate!.getTime() === row2!.endDate!.getTime() && Math.abs(row3!.endDate!.getTime() - row3!.startDate!.getTime() - 30 * DAY) < 1000);
    check("hạn Pro của gia sư = điểm cuối chuỗi (120 ngày)", Math.abs(new Date((await stateOf(T3)).proUntil).getTime() - row3!.endDate!.getTime()) < 1000);
    // Giá chụp lại
    await put(A, { plans: [{ ...cfgNow.free }, { ...cfgNow.pro, priceQuarterVnd: 250_000 }] });
    check("đổi giá sau không đổi yêu cầu đã tạo (giá được chụp)", (await prisma.proOrder.findUnique({ where: { id: o2.id } }))?.priceVnd === 139_300 && (await prisma.proOrder.findUnique({ where: { id: o2.id } }))?.listPriceVnd === 199_000);
    const m5 = await api("POST", "/api/tutor/goi/mua", { as: T5, body: { period: "year" } });
    check("hết suất sáng lập (1 suất, T3 đã giữ) → người mua sau trả giá thường 599.000, không giảm", m5.status === 201 && m5.json.pending.priceVnd === 599_000 && m5.json.pending.foundingDiscountPct === 0, m5.json.pending);
    const cx = await api("POST", `/api/admin/pro/orders/${m5.json.pending.id}/cancel`, { as: A });
    check("admin huỷ yêu cầu chờ → 200; huỷ yêu cầu đã kích hoạt → 409", cx.status === 200 && (await api("POST", `/api/admin/pro/orders/${o2.id}/cancel`, { as: A })).status === 409);
    check("kích hoạt yêu cầu đã huỷ → 409; yêu cầu không tồn tại → 404", (await api("POST", `/api/admin/pro/orders/${m5.json.pending.id}/activate`, { as: A })).status === 409 && (await api("POST", "/api/admin/pro/orders/khong-co/activate", { as: A })).status === 404);
    check("cổng: T3 là Pro nên nhận thêm học viên dù đã quá 10", await (async () => { await enroll((await mkCourse(T3.id)).id, 11); return (await mk(T3, (await prisma.course.findFirst({ where: { ownerId: T3.id } }))!.id, {})).status === 201; })());
    const tBefore = await mk(T, course.id, { maxUses: 99 });
    check("T đang đầy (10/10, trần Free): mời hàng loạt 99 em bị chặn trước khi Pro", tBefore.status === 409, tBefore.json);
    const oT = (await api("POST", "/api/tutor/goi/mua", { as: T, body: { period: "month" } })).json.pending;
    await api("POST", `/api/admin/pro/orders/${oT.id}/activate`, { as: A });
    const tAfter = await mk(T, course.id, { maxUses: 99 });
    check("sau khi admin kích hoạt Pro cho T, cùng yêu cầu đó → 201 (cổng đọc gói Pro, trần 500)", tAfter.status === 201 && (await stateOf(T)).isPro, tAfter.json);
    check("không có đường nào chạm Coin / ví / giao dịch Coin khi mua gói Pro", (await prisma.coinTransaction.count()) === 0);
  } else {
    section("Chưa cấu hình nhận tiền → 'Chưa mở bán', không tạo yêu cầu");
    const m = await api("POST", "/api/tutor/goi/mua", { as: T3, body: { period: "month" } });
    check("POST mua → 409 'Chưa mở bán' (chạy thử bật hay không đều vậy), không tạo bản ghi", m.status === 409 && m.json.error === "Chưa mở bán" && (await prisma.proOrder.count()) === 0, m.json);
    check("phản hồi không chứa số tài khoản", !/accountNo|qrUrl/.test(m.text));
    const act = await api("POST", "/api/admin/pro/orders/khong-co/activate", { as: A });
    check("kích hoạt yêu cầu không tồn tại → 404", act.status === 404);
  }

  section("Tặng Pro cho gia sư hiện có (60 ngày, một lần)");
  const gt = await api("POST", "/api/admin/pro/grant-legacy", { as: T });
  check("gia sư gọi → 403; chưa đăng nhập → 401", gt.status === 403 && (await api("POST", "/api/admin/pro/grant-legacy")).status === 401 && (await api("POST", "/api/admin/pro/grant-legacy", { as: C })).status === 403);
  const gr = await api("POST", "/api/admin/pro/grant-legacy", { as: A });
  const proNow = await prisma.proOrder.findMany({ where: { source: "legacy_grant" } });
  check("tặng → mỗi gia sư chưa được tặng nhận 1 kỳ 60 ngày, giá 0", gr.status === 200 && gr.json.days === 60 && gr.json.granted === 4 && proNow.length === 4 && proNow.every(o => o.priceVnd === 0 && o.durationDays === 60 && o.status === "active"), gr.json);
  const gr2 = await api("POST", "/api/admin/pro/grant-legacy", { as: A });
  check("chạy lại → không tặng thêm lần nào (idempotent)", gr2.status === 200 && gr2.json.granted === 0 && gr2.json.skipped === 4 && (await prisma.proOrder.count({ where: { source: "legacy_grant" } })) === 4);
  const tp1 = await stateOf(T2);
  check("gia sư được tặng thấy Pro và hạn ~60 ngày; học viên của họ không đổi", tp1.isPro && Math.abs(new Date(tp1.proUntil).getTime() - Date.now() - 60 * DAY) < 5 * 60_000);
  if (PAY) check("gia sư đang Pro bằng đơn mua được cộng dồn thêm khi tặng", true);
  check("không đụng tiền: không giao dịch Coin, không ví", (await prisma.coinTransaction.count()) === 0);
  await done();
})().catch(e => { console.error("CRASH", e); process.exit(1); });
