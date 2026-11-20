// ADM-xoa-tk (API + DB thật) — xoá tài khoản (ẩn danh hoá) học sinh / gia sư và chuyển học sinh thành gia sư.
// Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-adm-xoa-tk.ts  (máy chủ dev đang chạy ở $BASE)
//
// CA PHÁ CỐ Ý (chạy tay, mỗi lần một thứ, rồi hoàn lại):
//   - Đổi requirePermission(DELETE_ACCOUNTS) thành MANAGE_TUTORS ở route xoá → ca 1 đỏ (admin_content xoá được).
//   - Đổi anonymizeUser thành prisma.user.delete → ca 5 đỏ (User cũ mất, Enrollment/hoá đơn cascade).
//   - Bỏ pickBlocker khỏi route xoá → các ca 409 đỏ.
//   - Bỏ kiểm ageOnKey ở len-gia-su → ca underage đỏ.
//   - Bỏ logAction ở route xoá → ca audit đỏ.
//   - Thay anonymizeUser bằng prisma.user.delete (cả hai route xoá) → ca 5 / 13b đỏ.
//   - Bỏ kiểm ageOnKey ở len-gia-su (hoặc ở tim-hoc-sinh) → ca 17b / 23d / 22e đỏ.
//   - Bỏ logAction ở tim-hoc-sinh → ca 22g đỏ; thêm email vào metadata → ca 22g đỏ.
//   - Bỏ `deletedAt` khỏi PUT /api/users/[id]/role → ca 27 đỏ.
//   - Bỏ kiểm DELETE_REASONS ở readDeleteReason → ca 25b đỏ.
//   - Bỏ unusedCredits / bankPending khỏi countBlockers → ca 28 / 29 đỏ.
//   - Bỏ `status: "active"` hoặc `classStatus: { not: "closed" }` khỏi nhánh courseTeacher.count → ca 30c / 30d đỏ; bỏ `isTutor ?` → ca 30e đỏ.
//   - Bỏ logAction "account.delete_blocked" ở route xoá → ca 30b đỏ.
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
  await prisma.studentReminder.create({ data: { userId: S.id, title: "ghi chú riêng của em", note: "nội dung riêng", tags: ["rieng"] } });
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
  check("5c. StudentReminder của học sinh đã xoá (ẩn danh không chạy Cascade)", (await prisma.studentReminder.count({ where: { userId: S.id } })) === 0);
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

  r = await api("POST", PROMO(P.id), { as: SA, body: { subjects: ["Anh"], confirmAge18: true } }); // P chưa khai ngày sinh → cần cờ (11.2)
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
  r = await api("POST", PROMO(applied.id), { as: SA, body: { ...body, confirmAge18: true } });
  const apu = await prisma.user.findUnique({ where: { id: applied.id } });
  check("21. HS từng nộp đơn và bị từ chối → chuyển được, giữ tutorAppliedAt, xoá tutorRejectedAt/Reason; audit hadApplication true",
    r.status === 200 && apu?.tutorAppliedAt?.getTime() === when.getTime() && apu.tutorRejectedAt === null && apu.tutorRejectReason === null && (await audits({ action: "student.promote_tutor", resourceId: applied.id }))[0]?.metadata != null && ((await audits({ action: "student.promote_tutor", resourceId: applied.id }))[0].metadata as { hadApplication?: boolean }).hadApplication === true);

  // ================= VÒNG 2 (11.1–11.5) =================
  const LOOK = "/api/admin/gia-su/tim-hoc-sinh";
  const FOUND_SHAPE = ["activeEnrollments", "candidateId", "dobKnown", "found", "shortName"];

  section("22. tim-hoc-sinh: quyền");
  const LA = await mkUser({ name: "Biên tập Lộc", role: "admin", adminRole: "admin_content" });
  const LB = await mkUser({ name: "Biên tập Bảo", role: "admin", adminRole: "admin_content" }), LC = await mkUser({ name: "Biên tập Cúc", role: "admin", adminRole: "admin_content" }); // mỗi người ≤10 lần tìm (giới hạn theo người)
  const cand = await mkUser({ name: "Nguyễn Văn Tuấn" });
  await prisma.user.update({ where: { id: cand.id }, data: { phone: "0911222333", school: "THPT Kín", parentName: "PH Kín", dateOfBirth: new Date("2000-03-03T00:00:00Z") } });
  await prisma.enrollment.create({ data: { userId: cand.id, courseId: C3.id, status: "active" } });
  const lk = [await api("POST", LOOK, { as: T, body: { email: cand.email } }), await api("POST", LOOK, { as: sv, body: { email: cand.email } })];
  check("22a. teacher / student → 403", lk.every(x => x.status === 403), lk.map(x => x.status));
  check("22b. khách → 401", (await api("POST", LOOK, { body: { email: cand.email } })).status === 401);
  const auditsBeforeLook = await prisma.auditLog.count({ where: { action: "student.lookup_email" } });
  check("22b2. 401/403 không để lại audit lookup", auditsBeforeLook === 0, auditsBeforeLook);

  section("22. tim-hoc-sinh: kết quả");
  r = await api("POST", LOOK, { as: LA, body: { email: cand.email } });
  check("22c. admin_content tìm đúng email → 200 found, candidateId, shortName 'Nguyễn T.', activeEnrollments 1, dobKnown true",
    r.status === 200 && r.json.found === true && r.json.candidateId === cand.id && r.json.shortName === "Nguyễn T." && r.json.activeEnrollments === 1 && r.json.dobKnown === true, r.json);
  check("22d. kết quả CHỈ có 5 khoá, không chứa email / SĐT / ngày sinh / trường / tên đầy đủ", Object.keys(r.json).sort().join() === FOUND_SHAPE.join() && noPII(r.json, cand.email, "0911222333", "2000", "THPT Kín", "PH Kín", "Văn", "Tuấn"), r.json);
  r = await api("POST", LOOK, { as: SA, body: { email: `  ${cand.email.toUpperCase()}  ` } });
  check("22e. email viết hoa + khoảng trắng → khớp (trim + hạ chữ)", r.status === 200 && r.json.found === true && r.json.candidateId === cand.id, r.json);
  const partial = await api("POST", LOOK, { as: SA, body: { email: cand.email.slice(0, 6) } });
  const likeP = await api("POST", LOOK, { as: SA, body: { email: "%" } });
  check("22f. khớp từng phần / ký tự % → {found:false} (không LIKE, không liệt kê)", partial.json?.found === false && likeP.json?.found === false && Object.keys(partial.json).join() === "found", [partial.json, likeP.json]);
  const noDob = await mkUser({ name: "Em Chưa Khai" });
  r = await api("POST", LOOK, { as: LA, body: { email: noDob.email } });
  check("22f2. học sinh chưa khai ngày sinh → found, dobKnown false", r.json?.found === true && r.json.dobKnown === false && r.json.activeEnrollments === 0, r.json);

  section("22. tim-hoc-sinh: mọi lý do loại → MỘT câu trả lời giống hệt");
  const lAdult = new Date("2000-01-01T00:00:00Z");
  const mkLook = async (o: Parameters<typeof mkUser>[0], patch: Record<string, unknown> = {}) => { const x = await mkUser(o); await prisma.user.update({ where: { id: x.id }, data: { dateOfBirth: lAdult, ...patch } }); return x; };
  const hiddenL = await mkLook({ name: "L ẩn" }, { deletedAt: new Date(), banned: true });
  const bannedL = await mkLook({ name: "L khoá" }, { banned: true });
  const unvL = await mkLook({ name: "L chưa xác thực", emailVerified: false });
  const tutorL = await mkLook({ name: "L đã gia sư" }, { tutorVerified: true });
  const minorL = await mkLook({ name: "L 15 tuổi" }, { dateOfBirth: new Date(Date.now() - 15 * 365.25 * 864e5) });
  const adminL = await mkTutor("L là admin");
  const anonL = await mkLook({ name: "L ẩn danh" });
  await prisma.user.update({ where: { id: anonL.id }, data: { email: `deleted+${anonL.id}@invalid` } });
  const rejects = [
    ["không tồn tại", { email: "khong-co-ai@test.local" }], ["ẩn", { email: hiddenL.email }], ["bị khoá", { email: bannedL.email }], ["chưa xác thực", { email: unvL.email }],
    ["đã gia sư", { email: tutorL.email }], ["15 tuổi", { email: minorL.email }], ["là admin/gia sư (role)", { email: adminL.email }], ["đã ẩn danh", { email: `deleted+${anonL.id}@invalid` }],
  ] as const;
  const resp: string[] = [];
  for (const [why, b] of rejects) { const x = await api("POST", LOOK, { as: LB, body: b }); resp.push(`${x.status}|${x.text}`); check(`22g0. ${why} → 200 {"found":false}`, x.status === 200 && x.json?.found === false && Object.keys(x.json).length === 1, x.text); }
  check("22g1. tám lý do → tám phản hồi GIỐNG HỆT từng byte (không lộ lý do/tuổi)", new Set(resp).size === 1, resp);
  const lookRows = await audits({ action: "student.lookup_email" });
  check("22g. mỗi lần tìm có 1 dòng audit student.lookup_email {found} đúng người làm; không dòng nào chứa email/tên",
    lookRows.length >= 12 && lookRows.every(x => [LA.id, LB.id, LC.id, SA.id].includes(x.actorId ?? "")) && lookRows.every(x => noPII(x.metadata, "@test.local", "@invalid", "Nguyễn", "Tuấn") && noPII(x, cand.email, hiddenL.email, "khong-co-ai")) && lookRows.every(x => Object.keys((x.metadata ?? {}) as object).join() === "found"),
    lookRows.map(x => [x.actorId, x.resourceId, x.metadata]));
  check("22g2. dòng found=true gắn resourceId = candidateId, found=false KHÔNG lộ id của TK bị loại",
    lookRows.some(x => (x.metadata as { found?: boolean }).found === true && x.resourceId === cand.id) && lookRows.filter(x => (x.metadata as { found?: boolean }).found === false).every(x => ![hiddenL.id, bannedL.id, unvL.id, tutorL.id, minorL.id].includes(x.resourceId ?? "")), lookRows.map(x => [x.resourceId, x.metadata]));
  const bad400 = [await api("POST", LOOK, { as: LC, body: {} }), await api("POST", LOOK, { as: LC, body: { email: "   " } }), await api("POST", LOOK, { as: LC, body: { email: 5 } }), await api("POST", LOOK, { as: LC, body: { email: "a".repeat(300) } })];
  check("22h. thiếu / trống / không phải chuỗi / >254 ký tự → 400 tiếng Việt", bad400.every(x => x.status === 400 && /[à-ỹ]/.test(x.json.error)), bad400.map(x => [x.status, x.json]));

  section("22. tim-hoc-sinh: giới hạn 10 lần / 10 phút theo người thao tác");
  const RL = await mkUser({ name: "Biên tập đếm", role: "admin", adminRole: "admin_content" });
  const RL2 = await mkUser({ name: "Biên tập khác", role: "admin", adminRole: "admin_content" });
  const codes: number[] = [];
  for (let i = 0; i < 12; i++) codes.push((await api("POST", LOOK, { as: RL, body: { email: `x${i}@test.local` } })).status);
  check("22i. 10 lần đầu 200, lần 11–12 → 429", codes.slice(0, 10).every(c => c === 200) && codes[10] === 429 && codes[11] === 429, codes);
  check("22j. người khác vẫn tìm được (khoá theo actorId, không dùng chung)", (await api("POST", LOOK, { as: RL2, body: { email: cand.email } })).status === 200);
  const rlAudits = await audits({ action: "student.lookup_email", actorId: RL.id });
  check("22k. 429 không ghi audit (đúng 10 dòng)", rlAudits.length === 10, rlAudits.length);

  section("23. len-gia-su: confirmAge18 (11.2)");
  const D0 = await mkUser({ name: "HS không ngày sinh" });
  const before0 = await prisma.auditLog.count({ where: { action: "student.promote_tutor" } });
  const noFlag = [await api("POST", PROMO(D0.id), { as: LA, body: { subjects: ["Toán"] } }), await api("POST", PROMO(D0.id), { as: LA, body: { subjects: ["Toán"], confirmAge18: false } }), await api("POST", PROMO(D0.id), { as: LA, body: { subjects: ["Toán"], confirmAge18: "true" } }), await api("POST", PROMO(D0.id), { as: LA, body: { subjects: ["Toán"], confirmAge18: 1 } })];
  check("23a. DOB null, thiếu/false/'true'/1 → 400 need_age_confirm (chỉ boolean true mới qua)", noFlag.every(x => x.status === 400 && x.json.code === "need_age_confirm" && /[à-ỹ]/.test(x.json.error)), noFlag.map(x => [x.status, x.json]));
  check("23b. 400 không đổi gì: vẫn student, không audit mới", (await prisma.user.findUnique({ where: { id: D0.id } }))?.role === "student" && (await prisma.auditLog.count({ where: { action: "student.promote_tutor" } })) === before0);
  r = await api("POST", PROMO(D0.id), { as: LA, body: { subjects: ["Toán"], confirmAge18: true } });
  const d0u = await prisma.user.findUnique({ where: { id: D0.id } });
  check("23c. DOB null + confirmAge18:true → 200, thành gia sư", r.status === 200 && r.json.ok === true && d0u?.role === "admin" && d0u.adminRole === "teacher" && d0u.tutorVerified === true && d0u.tutorVerifiedBy === LA.id, r.json);
  let pr = (await audits({ action: "student.promote_tutor", resourceId: D0.id }))[0]?.metadata as Record<string, unknown> | undefined;
  check("23d. audit: dobKnown false, ageConfirmedByOperator true", pr?.dobKnown === false && pr?.ageConfirmedByOperator === true, pr);
  const D1 = await mkUser({ name: "HS có ngày sinh" });
  await prisma.user.update({ where: { id: D1.id }, data: { dateOfBirth: new Date("1999-09-09T00:00:00Z") } });
  r = await api("POST", PROMO(D1.id), { as: LA, body: { subjects: ["Toán"], confirmAge18: true } });
  pr = (await audits({ action: "student.promote_tutor", resourceId: D1.id }))[0]?.metadata as Record<string, unknown> | undefined;
  check("23e. DOB đủ tuổi + có cờ → 200; audit dobKnown true, ageConfirmedByOperator false (cờ không thay ngày sinh)", r.status === 200 && pr?.dobKnown === true && pr?.ageConfirmedByOperator === false, [r.json, pr]);
  const D2 = await mkUser({ name: "HS có DOB đủ tuổi không cờ" });
  await prisma.user.update({ where: { id: D2.id }, data: { dateOfBirth: new Date("1999-09-09T00:00:00Z") } });
  check("23f. DOB đủ tuổi, không cờ → 200 (không đòi cờ)", (await api("POST", PROMO(D2.id), { as: LA, body: { subjects: ["Toán"] } })).status === 200);
  const D3 = await mkUser({ name: "HS 15 tuổi có cờ" });
  await prisma.user.update({ where: { id: D3.id }, data: { dateOfBirth: new Date(Date.now() - 15 * 365.25 * 864e5) } });
  r = await api("POST", PROMO(D3.id), { as: LA, body: { subjects: ["Toán"], confirmAge18: true } });
  check("23g. DOB <18 + confirmAge18:true → VẪN 409 underage, không đổi role", r.status === 409 && r.json.code === "underage" && (await prisma.user.findUnique({ where: { id: D3.id } }))?.role === "student", r.json);
  const D4 = await mkUser({ name: "HS đúng 18 tuổi hôm nay" });
  const t18 = new Date(); await prisma.user.update({ where: { id: D4.id }, data: { dateOfBirth: new Date(Date.UTC(t18.getUTCFullYear() - 18, t18.getUTCMonth(), t18.getUTCDate(), 5)) } });
  const D5 = await mkUser({ name: "HS 17 tuổi 364 ngày" });
  await prisma.user.update({ where: { id: D5.id }, data: { dateOfBirth: new Date(Date.UTC(t18.getUTCFullYear() - 18, t18.getUTCMonth(), t18.getUTCDate() + 2, 5)) } });
  const b18 = await api("POST", PROMO(D4.id), { as: LA, body: { subjects: ["Toán"] } }), b17 = await api("POST", PROMO(D5.id), { as: LA, body: { subjects: ["Toán"] } });
  check("23h. biên 18 tuổi: đủ 18 hôm nay → 200; thiếu 2 ngày → 409 underage", b18.status === 200 && b17.status === 409 && b17.json.code === "underage", [b18.status, b17.status, b17.json]);
  const D6 = await mkUser({ name: "HS cờ nhưng chặn khác" });
  const b6 = await prisma.user.update({ where: { id: D6.id }, data: { banned: true } });
  r = await api("POST", PROMO(b6.id), { as: LA, body: { subjects: ["Toán"], confirmAge18: true } });
  check("23i. cờ confirmAge18 không vượt chặn khác: khoá → 409 banned", r.status === 409 && r.json.code === "banned", r.json);
  check("23j. khách / teacher / student có cờ vẫn 401/403", (await api("POST", PROMO(D0.id), { body: { subjects: ["Toán"], confirmAge18: true } })).status === 401 && (await api("POST", PROMO(D0.id), { as: T, body: { subjects: ["Toán"], confirmAge18: true } })).status === 403 && (await api("POST", PROMO(D0.id), { as: sv, body: { subjects: ["Toán"], confirmAge18: true } })).status === 403);

  section("25. Lý do xoá (11.3)");
  const R1 = await mkUser({ name: "HS lý do hợp lệ" });
  r = await api("POST", SX(R1.id), { as: SA, body: { reason: "duplicate" } });
  let ra = (await audits({ action: "account.delete", resourceId: R1.id }))[0]?.metadata as Record<string, unknown> | undefined;
  check("25a. reason hợp lệ → 200, audit metadata.reason = 'duplicate'", r.status === 200 && ra?.reason === "duplicate", [r.json, ra]);
  const R2 = await mkUser({ name: "HS lý do lạ" });
  const badReasons = [await api("POST", SX(R2.id), { as: SA, body: { reason: "vi_ly_do_khac" } }), await api("POST", SX(R2.id), { as: SA, body: { reason: 7 } }), await api("POST", SX(R2.id), { as: SA, body: { reason: "OTHER" } }), await api("POST", SX(R2.id), { as: SA, body: { reason: "Em đòi xoá vì giận" } })];
  const r2u = await prisma.user.findUnique({ where: { id: R2.id } });
  check("25b. mã lạ / không phải chuỗi / sai hoa-thường / văn bản tự do → 400 (tiếng Việt), TK còn nguyên, không audit",
    badReasons.every(x => x.status === 400 && /[à-ỹ]/.test(x.json.error)) && r2u?.deletedAt === null && r2u.email === R2.email && (await audits({ action: "account.delete", resourceId: R2.id })).length === 0, badReasons.map(x => [x.status, x.json]));
  r = await api("POST", SX(R2.id), { as: SA });
  ra = (await audits({ action: "account.delete", resourceId: R2.id }))[0]?.metadata as Record<string, unknown> | undefined;
  check("25c. không body → 200; audit có khoá reason = null (không bỏ khoá)", r.status === 200 && ra !== undefined && "reason" in ra && ra.reason === null, [r.json, ra]);
  const R3 = await mkUser({ name: "HS reason null" });
  const r3 = await api("POST", SX(R3.id), { as: SA, body: { reason: null } });
  const R4 = await mkUser({ name: "HS reason rỗng" });
  const r4 = await api("POST", SX(R4.id), { as: SA, body: { reason: "" } });
  check("25d. reason null / '' → 200, audit reason null", r3.status === 200 && r4.status === 200 && ((await audits({ action: "account.delete", resourceId: R3.id }))[0].metadata as { reason?: unknown }).reason === null && ((await audits({ action: "account.delete", resourceId: R4.id }))[0].metadata as { reason?: unknown }).reason === null);
  const RT = await mkTutor("GS lý do");
  r = await api("POST", TX(RT.id), { as: SA, body: { reason: "spam_or_abuse" } });
  ra = (await audits({ action: "account.delete", resourceId: RT.id }))[0]?.metadata as Record<string, unknown> | undefined;
  check("25e. route gia sư cũng nhận reason hợp lệ; mã lạ → 400", r.status === 200 && ra?.reason === "spam_or_abuse" && (await api("POST", TX((await mkTutor("GS lý do lạ")).id), { as: SA, body: { reason: "x" } })).status === 400, [r.json, ra]);
  const RB = await mkUser({ name: "HS bị chặn kèm reason" }); await prisma.enrollment.create({ data: { userId: RB.id, courseId: C3.id, status: "active" } });
  r = await api("POST", SX(RB.id), { as: SA, body: { reason: "other" } });
  check("25f. xoá bị chặn 409 → KHÔNG audit dù có reason", r.status === 409 && (await audits({ action: "account.delete", resourceId: RB.id })).length === 0, r.json);
  const allDel = await audits({ action: "account.delete" });
  check("25g. quét toàn bộ audit account.delete: không chứa PII, chỉ khoá đếm/cờ/reason", allDel.every(x => noPII(x.metadata, "@test.local", "0911222333", "Bí Mật", "Gia sư", "deleted+")), allDel.map(x => x.metadata).slice(0, 3));

  section("27. PUT /api/users/[id]/role trên TK đã ẩn danh (11.4)");
  const ROLE = (id: string) => `/api/users/${id}/role`;
  const anonT = await mkTutor("GS sẽ ẩn danh");
  await api("POST", TX(anonT.id), { as: SA });
  const snapRole = async (id: string) => JSON.stringify(await prisma.user.findUnique({ where: { id } }));
  const beforeRole = await snapRole(anonT.id);
  const auditBeforeRole = await prisma.auditLog.count();
  r = await api("PUT", ROLE(anonT.id), { as: SA, body: { role: "admin", adminRole: "admin_super" } });
  check("27a. đổi vai TK đã ẩn danh → 409 account_deleted, dữ liệu KHÔNG đổi (so nguyên hàng), không thêm audit", r.status === 409 && r.json.code === "account_deleted" && (await snapRole(anonT.id)) === beforeRole && (await prisma.auditLog.count()) === auditBeforeRole, r.json);
  const anonS = await mkUser({ name: "HS sẽ ẩn danh" }); await api("POST", SX(anonS.id), { as: SA });
  const bs = await snapRole(anonS.id);
  r = await api("PUT", ROLE(anonS.id), { as: SA, body: { role: "admin", adminRole: "admin_content" } });
  check("27b. TK học sinh đã ẩn danh → 409; vẫn student", r.status === 409 && r.json.code === "account_deleted" && (await snapRole(anonS.id)) === bs, r.json);
  const live = await mkUser({ name: "HS còn sống" });
  r = await api("PUT", ROLE(live.id), { as: SA, body: { role: "admin", adminRole: "admin_content" } });
  check("27c. đối chứng: TK còn sống đổi vai được → 200", r.status === 200 && (await prisma.user.findUnique({ where: { id: live.id } }))?.adminRole === "admin_content", [r.status, r.json]);
  check("27d. admin_content / teacher / khách vẫn không gọi được (403/401)", (await api("PUT", ROLE(live.id), { as: CA, body: { role: "student" } })).status === 403 && (await api("PUT", ROLE(live.id), { body: { role: "student" } })).status === 401);

  section("28. TuitionCredit còn dư → unused_credit (11.5)");
  const credStu = await mkUser({ name: "HS có tiền dư" });
  await prisma.tuitionCredit.create({ data: { tutorId: T.id, studentId: credStu.id, amount: 300000, usedAmount: 100000 } });
  r = await api("POST", SX(credStu.id), { as: SA });
  check("28a. học sinh có credit dư 200k → 409 unused_credit + tiếng Việt; TK còn nguyên", r.status === 409 && r.json.code === "unused_credit" && /[à-ỹ]/.test(r.json.error) && (await prisma.user.findUnique({ where: { id: credStu.id } }))?.deletedAt === null, r.json);
  const credTut = await mkTutor("GS giữ tiền dư");
  await prisma.tuitionCredit.create({ data: { tutorId: credTut.id, studentId: sv.id, amount: 50000, usedAmount: 0 } });
  r = await api("POST", TX(credTut.id), { as: SA });
  check("28b. gia sư giữ credit dư → 409 unused_credit", r.status === 409 && r.json.code === "unused_credit", r.json);
  const creditsBefore = JSON.stringify(await prisma.tuitionCredit.findMany({ orderBy: { id: "asc" } }));
  await api("POST", SX(credStu.id), { as: SA });
  check("28c. 409 không đụng TuitionCredit", JSON.stringify(await prisma.tuitionCredit.findMany({ orderBy: { id: "asc" } })) === creditsBefore);
  const zeroStu = await mkUser({ name: "HS credit đã dùng hết" }), zeroTut = await mkTutor("GS credit dùng hết");
  await prisma.tuitionCredit.create({ data: { tutorId: zeroTut.id, studentId: zeroStu.id, amount: 80000, usedAmount: 80000 } });
  const zc1 = await api("POST", SX(zeroStu.id), { as: SA }), zc2 = await api("POST", TX(zeroTut.id), { as: SA });
  check("28d. dư = 0 (đã dùng hết): cả học sinh lẫn gia sư xoá được → 200; dòng credit còn nguyên", zc1.status === 200 && zc2.status === 200 && (await prisma.tuitionCredit.count({ where: { studentId: zeroStu.id } })) === 1, [zc1.json, zc2.json]);
  const exact = await mkUser({ name: "HS credit dư 1đ" });
  await prisma.tuitionCredit.create({ data: { tutorId: T2.id, studentId: exact.id, amount: 1000, usedAmount: 999 } });
  check("28e. biên: dư 1đ → vẫn chặn", (await api("POST", SX(exact.id), { as: SA })).json?.code === "unused_credit");
  const both = await mkUser({ name: "HS credit + lớp active" });
  await prisma.enrollment.create({ data: { userId: both.id, courseId: C3.id, status: "active" } });
  await prisma.tuitionCredit.create({ data: { tutorId: T.id, studentId: both.id, amount: 5, usedAmount: 0 } });
  check("28f. vướng cả lớp active và credit → active_enrollments đứng trước", (await api("POST", SX(both.id), { as: SA })).json?.code === "active_enrollments");

  section("29. BankTransaction pending của gia sư → bank_pending (11.5)");
  let btSeq = 0;
  const bt = (tutorId: string, status: string) => prisma.bankTransaction.create({ data: { tutorId, provider: "sepay", providerTxId: `tx-${++btSeq}-${tutorId.slice(-6)}`, occurredAt: new Date(), amount: 500000, content: "chuyen khoan", kind: "in", status } });
  const bpT = await mkTutor("GS tiền vào chờ");
  const bank = await bt(bpT.id, "pending");
  r = await api("POST", TX(bpT.id), { as: SA });
  check("29a. gia sư có BankTransaction pending → 409 bank_pending + tiếng Việt; TK còn nguyên", r.status === 409 && r.json.code === "bank_pending" && /[à-ỹ]/.test(r.json.error) && (await prisma.user.findUnique({ where: { id: bpT.id } }))?.deletedAt === null, r.json);
  check("29b. 409 không đụng dòng tiền vào (status vẫn pending)", (await prisma.bankTransaction.findUnique({ where: { id: bank.id } }))?.status === "pending");
  await prisma.bankTransaction.update({ where: { id: bank.id }, data: { status: "resolved", resolvedAt: new Date(), resolution: "not_tuition" } });
  r = await api("POST", TX(bpT.id), { as: SA });
  check("29c. đổi sang resolved → xoá được (200); BankTransaction giữ nguyên làm chứng từ", r.status === 200 && (await prisma.bankTransaction.count({ where: { tutorId: bpT.id } })) === 1, r.json);
  const bpT2 = await mkTutor("GS nhiều trạng thái");
  await bt(bpT2.id, "matched"); await bt(bpT2.id, "applied"); await bt(bpT2.id, "resolved");
  check("29d. chỉ các dòng KHÔNG pending (matched/applied/resolved) → KHÔNG chặn", (await api("POST", TX(bpT2.id), { as: SA })).status === 200);
  const bpT3 = await mkTutor("GS pending + credit");
  await bt(bpT3.id, "pending"); await prisma.tuitionCredit.create({ data: { tutorId: bpT3.id, studentId: sv.id, amount: 10, usedAmount: 0 } });
  check("29e. vướng cả credit dư và pending → unused_credit trước, bank_pending sau", (await api("POST", TX(bpT3.id), { as: SA })).json?.code === "unused_credit" && (await prisma.tuitionCredit.deleteMany({ where: { tutorId: bpT3.id } }), (await api("POST", TX(bpT3.id), { as: SA })).json?.code === "bank_pending"));
  const bpStu = await mkUser({ name: "HS khác có pending của GS?" });
  await bt(T.id, "pending");
  check("29f. pending nằm ở gia sư KHÁC không chặn học sinh (bank_pending chỉ tính theo tutorId của chính người bị xoá)", (await api("POST", SX(bpStu.id), { as: SA })).status === 200);
  const bpWal = await mkTutor("GS pending + ví tiền thật");
  await bt(bpWal.id, "pending"); await prisma.wallet.create({ data: { userId: bpWal.id, balance: 9 } }); await prisma.coinTopupRequest.create({ data: { userId: bpWal.id, amountVnd: 9, coinAmount: 9, status: "approved" } });
  check("29g. vướng cả pending và ví từ tiền thật → bank_pending đứng trước wallet_from_money", (await api("POST", TX(bpWal.id), { as: SA })).json?.code === "bank_pending");

  section("30. Đồng giảng active trên lớp chưa đóng → co_teaching_active");
  const owner = await mkTutor("GS chủ lớp");
  const coC = await mkCourse(owner.id, { name: "Lớp chủ" }), coClosed = await mkCourse(owner.id, { name: "Lớp đã đóng", classStatus: "closed" });
  const ct = (courseId: string, userId: string, status: string) => prisma.courseTeacher.create({ data: { courseId, userId, role: "co_teacher", status, invitedBy: owner.id } });
  const coT = await mkTutor("GS đồng giảng");
  await ct(coC.id, coT.id, "active");
  r = await api("POST", TX(coT.id), { as: SA });
  check("30a. đồng giảng active lớp chưa đóng → 409 co_teaching_active, count=1, tiếng Việt; TK còn nguyên", r.status === 409 && r.json.code === "co_teaching_active" && r.json.count === 1 && /đồng giảng/.test(r.json.error) && (await prisma.user.findUnique({ where: { id: coT.id } }))?.deletedAt === null, r.json);
  const bl = await audits({ action: "account.delete_blocked", resourceId: coT.id });
  check("30b. ghi nhật ký account.delete_blocked {kind, code}, actor SA; KHÔNG có account.delete", bl.length === 1 && bl[0].actorId === SA.id && (bl[0].metadata as { code?: string; kind?: string }).code === "co_teaching_active" && (bl[0].metadata as { kind?: string }).kind === "tutor" && (await audits({ action: "account.delete", resourceId: coT.id })).length === 0, bl);
  for (const st of ["invited", "removed", "declined"]) {
    const g = await mkTutor(`GS đồng giảng ${st}`); await ct(coC.id, g.id, st);
    check(`30c. đồng giảng ${st} → KHÔNG chặn (200)`, (await api("POST", TX(g.id), { as: SA })).status === 200);
  }
  const gc = await mkTutor("GS đồng giảng lớp đóng"); await ct(coClosed.id, gc.id, "active");
  check("30d. đồng giảng active nhưng lớp đã đóng → KHÔNG chặn (200)", (await api("POST", TX(gc.id), { as: SA })).status === 200);
  const stuCt = await mkUser({ name: "HS có hàng CourseTeacher" }); await ct(coC.id, stuCt.id, "active");
  check("30e. học sinh không bị đếm co_teaching_active (200)", (await api("POST", SX(stuCt.id), { as: SA })).status === 200);
  await prisma.courseTeacher.updateMany({ where: { userId: coT.id }, data: { status: "removed" } });
  check("30f. chủ lớp gỡ (removed) → xoá được (200)", (await api("POST", TX(coT.id), { as: SA })).status === 200);

  await done();
})().catch(e => { console.error(e); process.exit(1); });
