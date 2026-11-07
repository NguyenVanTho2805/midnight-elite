// ADM-xoa-tk (API + DB thật) — xoá tài khoản (ẩn danh hoá) học sinh / gia sư và chuyển học sinh thành gia sư.
// Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-adm-xoa-tk.ts  (máy chủ dev đang chạy ở $BASE)
//
// CA PHÁ CỐ Ý (chạy tay, mỗi lần một thứ, rồi hoàn lại):
//   - Đổi requirePermission(DELETE_ACCOUNTS) thành MANAGE_TUTORS ở route xoá → ca 1 đỏ (admin_content xoá được).
//   - Đổi anonymizeUser thành prisma.user.delete → ca 5 đỏ (User cũ mất, Enrollment/hoá đơn cascade).
//   - Bỏ pickBlocker khỏi route xoá → các ca 409 đỏ.
//   - Bỏ kiểm ageOnKey ở len-gia-su → ca underage đỏ.
//   - Bỏ logAction ở route xoá → ca audit đỏ.
import { prisma } from "@/lib/prisma";
import { api, mkUser, mkTutor, mkSuper, mkCourse, wipe, check, section, done } from "./h";

const SX = (id: string) => `/api/admin/students/${id}/xoa-tai-khoan`;
const TX = (id: string) => `/api/admin/tutors/${id}/xoa-tai-khoan`;
const PROMO = (id: string) => `/api/admin/students/${id}/len-gia-su`;
const audits = (where: Record<string, unknown> = {}) => prisma.auditLog.findMany({ where, orderBy: { createdAt: "asc" } });
const noPII = (meta: unknown, ...needles: string[]) => { const s = JSON.stringify(meta ?? {}); return !needles.some(n => n && s.includes(n)); };
let seq = 0;
const code = () => `KIN${String(++seq).padStart(5, "0")}`;

(async () => {
  await wipe();
  const SA = await mkSuper("Quản trị Hà"), SA2 = await mkSuper("Quản trị Hai");
  const CA = await mkUser({ name: "Biên tập Bình", role: "admin", adminRole: "admin_content" });
  const T = await mkTutor("Cô Lan"), T2 = await mkTutor("Thầy Minh");
  const S = await mkUser({ name: "Nguyễn Bé Bí Mật" });
  const C = await mkCourse(T.id, { name: "Toán 9 Lan" });

  section("Leo quyền");
  const sv = await mkUser({ name: "HS khác" });
  const denyDel = [
    await api("POST", SX(S.id), { as: T }), await api("POST", SX(S.id), { as: sv }), await api("POST", SX(S.id), { as: CA }),
    await api("POST", TX(T2.id), { as: T }), await api("POST", TX(T2.id), { as: sv }), await api("POST", TX(T2.id), { as: CA }),
  ];
  check("1a. teacher / student / admin_content gọi hai route xoá → 403", denyDel.every(x => x.status === 403), denyDel.map(x => x.status));
  const anon = [await api("POST", SX(S.id)), await api("POST", TX(T2.id)), await api("POST", PROMO(S.id), { body: { subjects: ["Toán"] } })];
  check("1b. khách → 401", anon.every(x => x.status === 401), anon.map(x => x.status));
  const denyPromo = [await api("POST", PROMO(S.id), { as: T, body: { subjects: ["Toán"] } }), await api("POST", PROMO(S.id), { as: sv, body: { subjects: ["Toán"] } })];
  check("1c. len-gia-su với teacher / student → 403", denyPromo.every(x => x.status === 403), denyPromo.map(x => x.status));
  check("1d. không có gì đổi: S còn nguyên, không dòng audit", (await prisma.user.findUnique({ where: { id: S.id } }))?.email === S.email && (await prisma.auditLog.count()) === 0);

  section("Xoá học sinh: ẩn danh hoá, giữ chứng từ");
  await prisma.user.update({ where: { id: S.id }, data: { phone: "0912345678", school: "THPT Bí Mật", city: "Hà Nội", parentName: "Phụ huynh X", parentPhone: "0987654321", bio: "bio", avatarBase64: "AAAA", dateOfBirth: new Date("2012-05-05T00:00:00Z") } });
  await prisma.wallet.create({ data: { userId: S.id, balance: 700 } });
  await prisma.coinTransaction.create({ data: { userId: S.id, amount: 700, reason: "signup_bonus" } });
  await prisma.enrollment.create({ data: { userId: S.id, courseId: C.id, status: "suspended" } });
  await prisma.tuitionInvoice.create({ data: { code: code(), tutorId: T.id, studentId: S.id, yearMonth: "2026-10", amountDue: 500000, paidAmount: 500000, status: "paid" } });
  await prisma.feeCharge.create({ data: { tutorId: T.id, courseId: C.id, studentId: S.id, kind: "extra", dateKey: "2026-10-05", yearMonth: "2026-10", amount: 50000, mode: "per_session", invoiceId: "inv-x" } });
  await prisma.pushSubscription.create({ data: { userId: S.id, endpoint: "https://push.example/s1", p256dh: "k", auth: "a" } });
  await prisma.verifyToken.create({ data: { token: "vt-" + S.id, userId: S.id, expiresAt: new Date(Date.now() + 1e7) } });
  await prisma.passwordResetToken.create({ data: { token: "pr-" + S.id, userId: S.id, expiresAt: new Date(Date.now() + 1e7) } });
  const snap = async () => JSON.stringify({
    wallet: await prisma.wallet.findUnique({ where: { userId: S.id } }),
    inv: await prisma.tuitionInvoice.findMany({ where: { studentId: S.id }, orderBy: { id: "asc" } }),
    fee: await prisma.feeCharge.findMany({ where: { studentId: S.id }, orderBy: { id: "asc" } }),
    enr: await prisma.enrollment.findMany({ where: { userId: S.id }, orderBy: { id: "asc" } }),
    coin: await prisma.coinTransaction.findMany({ where: { userId: S.id }, orderBy: { id: "asc" } }),
  });
  const before = await snap();
  let r = await api("POST", SX(S.id), { as: SA });
  const u = await prisma.user.findUnique({ where: { id: S.id } });
  check("2. xoá → 200 { ok }", r.status === 200 && r.json.ok === true && !r.json.alreadyDeleted, r.json);
  check("3. email = deleted+<id>@invalid, tên 'Tài khoản đã xóa', deletedAt, banned", u?.email === `deleted+${S.id}@invalid` && u?.name === "Tài khoản đã xóa" && u?.deletedAt !== null && u?.banned === true, u && { e: u.email, n: u.name });
  check("4. PII sạch: phone/trường học/thành phố/phụ huynh/bio/ảnh/ngày sinh = null; mật khẩu không còn bcrypt cũ",
    u && [u.phone, u.school, u.city, u.parentName, u.parentPhone, u.bio, u.avatarBase64, u.dateOfBirth, u.phoneE164].every(x => x === null) && u.subjects.length === 0 && !u.password.startsWith("$2"), u);
  check("4b. role vẫn 'student'", u?.role === "student");
  check("5. User cũ VẪN tồn tại; Wallet / TuitionInvoice / FeeCharge / Enrollment / CoinTransaction nguyên vẹn (so trước-sau)", (await snap()) === before);
  check("5b. PushSubscription / VerifyToken / PasswordResetToken đã xoá",
    (await prisma.pushSubscription.count({ where: { userId: S.id } })) === 0 && (await prisma.verifyToken.count({ where: { userId: S.id } })) === 0 && (await prisma.passwordResetToken.count({ where: { userId: S.id } })) === 0);
  let rows = await audits({ action: "account.delete" });
  check("6. đúng 1 dòng account.delete: actor SA, User, resourceId S, không chứa tên/email/SĐT",
    rows.length === 1 && rows[0].actorId === SA.id && rows[0].resourceType === "User" && rows[0].resourceId === S.id && noPII(rows[0].metadata, S.name, S.email, "0912345678", "Bí Mật", "THPT"), rows);
  r = await api("POST", SX(S.id), { as: SA });
  check("7. xoá lần hai → 200 alreadyDeleted, KHÔNG thêm audit", r.status === 200 && r.json.alreadyDeleted === true && (await audits({ action: "account.delete" })).length === 1, r.json);
  r = await api("POST", `/api/admin/students/${S.id}/restore`, { as: SA });
  check("8. restore TK đã ẩn danh → 409 account_deleted; TK vẫn khoá", r.status === 409 && r.json.code === "account_deleted" && (await prisma.user.findUnique({ where: { id: S.id } }))?.banned === true, r.json);
  const list = await api("GET", "/api/admin/students?includeHidden=1", { as: SA });
  check("9. GET students (kể cả includeHidden) không liệt kê TK đã ẩn danh", list.status === 200 && !list.json.some((x: { id: string }) => x.id === S.id), list.json.length);
  r = await api("POST", "/api/auth/login", { body: { identifier: S.email, password: "Passw0rd!" } });
  check("10. đăng nhập bằng email/mật khẩu cũ thất bại", r.status >= 400, r.status);
  r = await api("POST", "/api/auth/register", { body: { name: "Em Mới", email: S.email, password: "MatKhau-moi-123" } });
  const reborn = await prisma.user.findUnique({ where: { email: S.email } });
  check("11. đăng ký lại cùng email → thành công, ra User MỚI (id khác); User cũ vẫn có email deleted+...", r.status === 200 && reborn && reborn.id !== S.id && (await prisma.user.findUnique({ where: { id: S.id } }))?.email.startsWith("deleted+"), [r.status, r.json]);
  check("11b. xoá/đếm: id không tồn tại → 404; admin làm mục tiêu học sinh → 403 not_student",
    (await api("POST", SX("khong-co"), { as: SA })).status === 404 && (await api("POST", SX(T.id), { as: SA })).json?.code === "not_student");

  section("Học sinh: từng mã 409 (dừng ở lỗi đầu)");
  const mk409 = async (name: string, setup: (id: string) => Promise<void>, want: string) => {
    const x = await mkUser({ name });
    await setup(x.id);
    const rr = await api("POST", SX(x.id), { as: SA });
    const still = await prisma.user.findUnique({ where: { id: x.id } });
    check(`12. ${want} → 409 + câu tiếng Việt + code; TK còn nguyên`, rr.status === 409 && rr.json.code === want && /[à-ỹ]/.test(rr.json.error) && still?.email === x.email && still?.deletedAt === null, rr.json);
    return x;
  };
  const C3 = await mkCourse(T.id, { name: "Lý 9" });
  await mk409("HS lớp active", async id => { await prisma.enrollment.create({ data: { userId: id, courseId: C3.id, status: "active" } }); }, "active_enrollments");
  for (const st of ["draft", "sent", "parent_reported", "partial"]) {
    await mk409(`HS phiếu ${st}`, async id => { await prisma.tuitionInvoice.create({ data: { code: code(), tutorId: T.id, studentId: id, yearMonth: "2026-10", amountDue: 1000, status: st } }); }, "open_invoices");
  }
  const sCancelled = await mkUser({ name: "HS phiếu paid/cancelled" });
  await prisma.tuitionInvoice.create({ data: { code: code(), tutorId: T.id, studentId: sCancelled.id, yearMonth: "2026-09", amountDue: 1000, paidAmount: 1000, status: "paid" } });
  await prisma.tuitionInvoice.create({ data: { code: code(), tutorId: T.id, studentId: sCancelled.id, yearMonth: "2026-08", amountDue: 1000, status: "cancelled" } });
  check("12b. phiếu paid / cancelled KHÔNG chặn", (await api("POST", SX(sCancelled.id), { as: SA })).status === 200);
  await mk409("HS khoản phí chưa vào phiếu", async id => { await prisma.feeCharge.create({ data: { tutorId: T.id, courseId: C3.id, studentId: id, kind: "session", dateKey: "2026-10-01", yearMonth: "2026-10", amount: 100000, mode: "per_session" } }); }, "uninvoiced_fees");
  const sZeroFee = await mkUser({ name: "HS khoản phí 0đ" });
  await prisma.feeCharge.create({ data: { tutorId: T.id, courseId: C3.id, studentId: sZeroFee.id, kind: "session", dateKey: "2026-10-01", yearMonth: "2026-10", amount: 0, mode: "per_session" } });
  check("12c. khoản phí 0đ chưa vào phiếu KHÔNG chặn", (await api("POST", SX(sZeroFee.id), { as: SA })).status === 200);
  await mk409("HS gói buổi", async id => { await prisma.sessionPackage.create({ data: { tutorId: T.id, courseId: C3.id, studentId: id, sessions: 10, unitPrice: 1000, totalPrice: 10000, createdBy: T.id } }); }, "active_packages");
  await mk409("HS đơn nạp chờ", async id => { await prisma.coinTopupRequest.create({ data: { userId: id, amountVnd: 1000, coinAmount: 1000, status: "pending" } }); }, "pending_money");
  await mk409("HS đơn Pro chờ", async id => { await prisma.proOrder.create({ data: { userId: id, period: "month", durationDays: 30, priceVnd: 1000, listPriceVnd: 1000, memoCode: "KINPRO-" + id.slice(-8), status: "pending" } }); }, "pending_money");
  await mk409("HS ví từ tiền thật", async id => { await prisma.wallet.create({ data: { userId: id, balance: 500 } }); await prisma.coinTopupRequest.create({ data: { userId: id, amountVnd: 500, coinAmount: 500, status: "approved" } }); }, "wallet_from_money");
  const sBonus = await mkUser({ name: "HS ví thưởng" });
  await prisma.wallet.create({ data: { userId: sBonus.id, balance: 300 } });
  check("12d. ví còn Coin thưởng (chưa nạp tiền thật) KHÔNG chặn, ví giữ nguyên", (await api("POST", SX(sBonus.id), { as: SA })).status === 200 && (await prisma.wallet.findUnique({ where: { userId: sBonus.id } }))?.balance === 300);
  const sOrder = await mkUser({ name: "HS nhiều lỗi" });
  await prisma.enrollment.create({ data: { userId: sOrder.id, courseId: C3.id, status: "active" } });
  await prisma.tuitionInvoice.create({ data: { code: code(), tutorId: T.id, studentId: sOrder.id, yearMonth: "2026-10", amountDue: 1, status: "sent" } });
  check("12e. vướng cả lớp active lẫn phiếu → báo active_enrollments trước", (await api("POST", SX(sOrder.id), { as: SA })).json?.code === "active_enrollments");

  section("Xoá gia sư");
  const TT = await mkTutor("Gia sư sạch");
  await prisma.tutorPayoutAccount.create({ data: { userId: TT.id, bankBin: "970436", accountNo: "123456789", accountName: "NGUYEN VAN A" } });
  await prisma.user.update({ where: { id: TT.id }, data: { phone: "0900000001", bio: "Tôi dạy Toán", subjects: ["Toán"], tutorVerified: true } });
  await prisma.tuitionInvoice.create({ data: { code: code(), tutorId: TT.id, studentId: sv.id, yearMonth: "2026-09", amountDue: 1000, paidAmount: 1000, status: "paid" } });
  const invBefore = JSON.stringify(await prisma.tuitionInvoice.findMany({ where: { tutorId: TT.id } }));
  r = await api("POST", TX(TT.id), { as: SA });
  const tu = await prisma.user.findUnique({ where: { id: TT.id } });
  check("13a. xoá gia sư sạch → 200; email deleted+, tutorVerified false, profileLockedAt, PII sạch, role admin/teacher giữ", r.status === 200 && tu?.email === `deleted+${TT.id}@invalid` && tu.tutorVerified === false && tu.profileLockedAt !== null && tu.bio === null && tu.phone === null && tu.subjects.length === 0 && tu.role === "admin" && tu.adminRole === "teacher", r.json);
  check("13b. TutorPayoutAccount đã xoá; phiếu thu của gia sư nguyên vẹn", (await prisma.tutorPayoutAccount.count({ where: { userId: TT.id } })) === 0 && JSON.stringify(await prisma.tuitionInvoice.findMany({ where: { tutorId: TT.id } })) === invBefore);
  rows = await audits({ action: "account.delete", resourceId: TT.id });
  check("13c. 1 dòng audit kind=tutor, không tên/email", rows.length === 1 && (rows[0].metadata as { kind?: string })?.kind === "tutor" && noPII(rows[0].metadata, "Gia sư sạch", TT.email, "0900000001"), rows);
  r = await api("POST", TX(TT.id), { as: SA });
  check("13d. xoá lại → alreadyDeleted, không thêm audit", r.json?.alreadyDeleted === true && (await audits({ action: "account.delete", resourceId: TT.id })).length === 1);
  const tl = await api("GET", "/api/admin/tutor-applications?status=approved", { as: SA });
  check("13e. tutor-applications?status=approved không liệt kê gia sư đã ẩn danh", tl.status === 200 && !tl.json.applications.some((x: { id: string }) => x.id === TT.id), tl.json);
  r = await api("POST", `/api/admin/students/${TT.id}/len-gia-su`, { as: SA, body: { subjects: ["Toán"] } });
  check("13f. len-gia-su trên TK đã ẩn danh → không qua (403/409)", r.status === 403 || r.status === 409, r.json);

  section("Gia sư: từng mã chặn");
  check("14a. tự xoá mình → 400 self", await (async () => { const x = await api("POST", TX(SA.id), { as: SA }); return x.status === 400 && x.json.code === "self"; })());
  const bad = [await api("POST", TX(CA.id), { as: SA }), await api("POST", TX(SA2.id), { as: SA }), await api("POST", TX(sv.id), { as: SA })];
  check("14b. admin_content / admin_super / học sinh qua route gia sư → 403 not_tutor", bad.every(x => x.status === 403 && x.json.code === "not_tutor"), bad.map(x => [x.status, x.json]));
  check("14c. admin_content và admin_super còn nguyên", (await prisma.user.findUnique({ where: { id: CA.id } }))?.deletedAt === null && (await prisma.user.findUnique({ where: { id: SA2.id } }))?.deletedAt === null);
  check("14d. gia sư không có → 404", (await api("POST", TX("khong-co"), { as: SA })).status === 404);
  // last_super: admin_super thứ hai bị ẩn danh trực tiếp trong DB, rồi SA2 thử xoá SA... SA2 đã ẩn danh nên dùng SA: mục tiêu là SA2 (cuối cùng khác SA)?
  // Kiểm tra theo đặc tả: nếu mục tiêu là admin_super duy nhất còn lại thì 409 last_super. Tạo tình huống: mục tiêu SA3 là admin_super, SA và SA2 đã ẩn danh trừ SA3 (người gọi là SA, phiên còn hiệu lực).
  const SA3 = await mkSuper("Quản trị Ba");
  await prisma.user.update({ where: { id: SA.id }, data: { email: "deleted+tmp1@invalid" } }); // chỉ để dựng ca; trả lại ngay dưới
  await prisma.user.update({ where: { id: SA2.id }, data: { email: "deleted+tmp2@invalid" } });
  r = await api("POST", TX(SA3.id), { as: SA });
  await prisma.user.update({ where: { id: SA.id }, data: { email: SA.email } });
  await prisma.user.update({ where: { id: SA2.id }, data: { email: SA2.email } });
  check("14e. admin_super cuối cùng → 409 last_super (không xoá)", r.status === 409 && r.json.code === "last_super" && (await prisma.user.findUnique({ where: { id: SA3.id } }))?.deletedAt === null, [r.status, r.json]);

  const tut = async (name: string, setup: (id: string) => Promise<void>, want: string) => {
    const x = await mkTutor(name); await setup(x.id);
    const rr = await api("POST", TX(x.id), { as: SA });
    check(`15. gia sư: ${want} → 409 + câu tiếng Việt; TK còn nguyên`, rr.status === 409 && rr.json.code === want && /[à-ỹ]/.test(rr.json.error) && (await prisma.user.findUnique({ where: { id: x.id } }))?.deletedAt === null, rr.json);
    return x;
  };
  const stuA = await mkUser({ name: "HS của lớp" });
  const tA = await tut("GS lớp có học viên active", async id => { const c = await mkCourse(id, { classStatus: "closed" }); await prisma.course.update({ where: { id: c.id }, data: { status: false } }); await prisma.enrollment.create({ data: { userId: stuA.id, courseId: c.id, status: "active" } }); }, "owned_courses_active");
  await tut("GS lớp còn mở (status true, chưa đóng)", async id => { await mkCourse(id, { classStatus: "open" }); }, "owned_courses_active");
  const tClosed = await mkTutor("GS lớp đã đóng, không học viên");
  const cc = await mkCourse(tClosed.id, { classStatus: "closed" }); await prisma.course.update({ where: { id: cc.id }, data: { status: false } });
  check("15b. lớp đã đóng + ẩn, không học viên active → KHÔNG chặn", (await api("POST", TX(tClosed.id), { as: SA })).status === 200);
  await tut("GS phiếu draft (vai tutorId)", async id => { await prisma.tuitionInvoice.create({ data: { code: code(), tutorId: id, studentId: stuA.id, yearMonth: "2026-10", amountDue: 1, status: "draft" } }); }, "open_invoices");
  await tut("GS khoản phí chưa vào phiếu", async id => { const c = await mkCourse(id, { classStatus: "closed" }); await prisma.course.update({ where: { id: c.id }, data: { status: false } }); await prisma.feeCharge.create({ data: { tutorId: id, courseId: c.id, studentId: stuA.id, kind: "extra", dateKey: "2026-10-01", yearMonth: "2026-10", amount: 5000, mode: "per_session" } }); }, "uninvoiced_fees");
  await tut("GS đơn Pro chờ", async id => { await prisma.proOrder.create({ data: { userId: id, period: "month", durationDays: 30, priceVnd: 1, listPriceVnd: 1, memoCode: "KINPRO-" + id.slice(-8), status: "pending" } }); }, "pending_money");
  await tut("GS gói VIP đang hiệu lực", async id => { await prisma.tutorSubscription.create({ data: { userId: id, planCode: "monthly", priceCoinPaid: 1, durationDays: 30, endDate: new Date(Date.now() + 1e9), status: "active" } }); }, "active_subscription");
  check("15c. thứ tự: tA vướng lớp, xoá hết lớp/enrollment rồi mới xoá được", (await (async () => { await prisma.enrollment.deleteMany({ where: { userId: stuA.id } }); await prisma.course.updateMany({ where: { ownerId: tA.id }, data: { classStatus: "closed", status: false } }); return api("POST", TX(tA.id), { as: SA }); })()).status === 200);

  section("Chuyển học sinh thành gia sư");
  const P = await mkUser({ name: "HS muốn dạy" });
  await prisma.enrollment.create({ data: { userId: P.id, courseId: C3.id, status: "active" } });
  const enrBefore = JSON.stringify(await prisma.enrollment.findMany({ where: { userId: P.id } }));
  const bodyBad = [
    await api("POST", PROMO(P.id), { as: SA, body: { subjects: [] } }), await api("POST", PROMO(P.id), { as: SA, body: { subjects: ["  ", ""] } }),
    await api("POST", PROMO(P.id), { as: SA, body: {} }), await api("POST", PROMO(P.id), { as: SA, body: { subjects: ["x".repeat(61)] } }),
    await api("POST", PROMO(P.id), { as: SA, body: { subjects: Array.from({ length: 11 }, (_, i) => "Môn " + i) } }),
    await api("POST", PROMO(P.id), { as: SA, body: { subjects: ["Toán"], bio: "b".repeat(1001) } }),
  ];
  check("16a. subjects rỗng / trống / thiếu / môn >60 ký tự / >10 môn / bio >1000 → 400 tiếng Việt", bodyBad.every(x => x.status === 400 && /[à-ỹ]/.test(x.json.error)), bodyBad.map(x => [x.status, x.json]));
  check("16b. 400 không đổi gì", (await prisma.user.findUnique({ where: { id: P.id } }))?.role === "student" && (await prisma.auditLog.count({ where: { action: "student.promote_tutor" } })) === 0);

  const unv = await mkUser({ name: "HS chưa xác thực", emailVerified: false });
  const minor = await mkUser({ name: "HS 15 tuổi" });
  await prisma.user.update({ where: { id: minor.id }, data: { dateOfBirth: new Date(Date.now() - 15 * 365.25 * 864e5) } });
  const banned = await mkUser({ name: "HS bị khoá" }); await prisma.user.update({ where: { id: banned.id }, data: { banned: true } });
  const hidden = await mkUser({ name: "HS ẩn" }); await prisma.user.update({ where: { id: hidden.id }, data: { deletedAt: new Date(), banned: true } });
  const body = { subjects: ["Toán"] };
  check("17a. chưa xác thực email → 409 email_unverified", (await api("POST", PROMO(unv.id), { as: SA, body })).json?.code === "email_unverified");
  const rm = await api("POST", PROMO(minor.id), { as: SA, body });
  check("17b. dưới 18 tuổi → 409 underage, không đổi role", rm.status === 409 && rm.json.code === "underage" && (await prisma.user.findUnique({ where: { id: minor.id } }))?.role === "student", rm.json);
  check("17c. bị khoá → 409 banned; đã ẩn → 409 hidden", (await api("POST", PROMO(banned.id), { as: SA, body })).json?.code === "banned" && (await api("POST", PROMO(hidden.id), { as: SA, body })).json?.code === "hidden");
  check("17d. không có → 404; admin làm mục tiêu → 403 not_student", (await api("POST", PROMO("khong-co"), { as: SA, body })).status === 404 && (await api("POST", PROMO(CA.id), { as: SA, body })).json?.code === "not_student");

  const adult = await mkUser({ name: "HS đủ tuổi" });
  await prisma.user.update({ where: { id: adult.id }, data: { dateOfBirth: new Date("2000-01-01T00:00:00Z") } });
  r = await api("POST", PROMO(adult.id), { as: CA, body: { subjects: [" Toán ", "Toán", "Lý"], bio: " Giới thiệu " } });
  const ad = await prisma.user.findUnique({ where: { id: adult.id } });
  check("18a. admin_content chuyển được → 200 { ok, activeEnrollments:0 }", r.status === 200 && r.json.ok === true && r.json.activeEnrollments === 0, r.json);
  check("18b. role admin / adminRole teacher / tutorVerified / người duyệt = CA / subjects trim+dedupe / bio", ad?.role === "admin" && ad.adminRole === "teacher" && ad.tutorVerified === true && ad.tutorVerifiedBy === CA.id && ad.tutorVerifiedAt !== null && ad.tutorAppliedAt !== null && ad.subjects.join() === "Toán,Lý" && ad.bio === "Giới thiệu", ad);

  r = await api("POST", PROMO(P.id), { as: SA, body: { subjects: ["Anh"] } });
  const pu = await prisma.user.findUnique({ where: { id: P.id } });
  check("19a. HS có lớp active → 200, activeEnrollments 1", r.status === 200 && r.json.activeEnrollments === 1, r.json);
  check("19b. Enrollment KHÔNG đổi; bio không gửi thì không ghi", JSON.stringify(await prisma.enrollment.findMany({ where: { userId: P.id } })) === enrBefore && pu?.bio === null && pu?.role === "admin" && pu?.adminRole === "teacher");
  const pn = await prisma.notification.findMany({ where: { userId: P.id, type: "tutor_approved" } });
  check("19c. thông báo tutor_approved tạo cho em, link /lop-cua-toi, không tên/tiền", pn.length === 1 && pn[0].link === "/lop-cua-toi" && noPII(pn[0], P.name), pn);
  const pa = await audits({ action: "student.promote_tutor" });
  check("19d. đúng 2 dòng audit (adult + P), mỗi dòng đúng người làm, metadata activeEnrollments + hadApplication, không tên/email",
    pa.length === 2 && pa.every(x => x.resourceType === "User") && (() => { const m = pa.find(x => x.resourceId === P.id); return m?.actorId === SA.id && (m.metadata as { activeEnrollments?: number })?.activeEnrollments === 1 && (m.metadata as { hadApplication?: boolean })?.hadApplication === false && noPII(m.metadata, P.name, P.email); })(), pa);
  r = await api("POST", PROMO(P.id), { as: SA, body: { subjects: ["Anh"] } });
  check("20. đã là gia sư → 409 already_tutor, không thêm audit", r.status === 409 && r.json.code === "already_tutor" && (await audits({ action: "student.promote_tutor" })).length === 2, r.json);

  // Đơn gia sư đã nộp trước đó: giữ tutorAppliedAt, xoá dấu từ chối
  const applied = await mkUser({ name: "HS đã nộp đơn" });
  const when = new Date("2026-10-01T00:00:00Z");
  await prisma.user.update({ where: { id: applied.id }, data: { tutorAppliedAt: when, tutorRejectedAt: new Date(), tutorRejectReason: "thiếu" } });
  r = await api("POST", PROMO(applied.id), { as: SA, body });
  const apu = await prisma.user.findUnique({ where: { id: applied.id } });
  check("21. HS từng nộp đơn và bị từ chối → chuyển được, giữ tutorAppliedAt, xoá tutorRejectedAt/Reason; audit hadApplication true",
    r.status === 200 && apu?.tutorAppliedAt?.getTime() === when.getTime() && apu.tutorRejectedAt === null && apu.tutorRejectReason === null && (await audits({ action: "student.promote_tutor", resourceId: applied.id }))[0]?.metadata != null && ((await audits({ action: "student.promote_tutor", resourceId: applied.id }))[0].metadata as { hadApplication?: boolean }).hadApplication === true);

  await done();
})().catch(e => { console.error(e); process.exit(1); });
