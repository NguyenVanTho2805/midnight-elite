// ĐX-04 (NC1-054) — GET /api/admin/health-metrics với dữ liệu thật: quyền, số đo tính tay, các nhiễu phải bị loại, không lộ tên.
// Cần Postgres + Next dev (xem README). Phần công thức thuần đã có ở t-health-metrics-lib.ts.
import { api, mkUser, mkTutor, mkSuper, mkCourse, mkAttendanceSession, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { generateInvoiceCode } from "@/lib/tuitionInvoice";
import { generatePortalToken } from "@/lib/parentPortal";
import { vnDateKeyOf } from "@/lib/classSessions";

const DAY = 86_400_000, HOUR = 3_600_000;
const URL = (q = "") => `/api/admin/health-metrics${q}`;
const ago = (ms: number) => new Date(Date.now() - ms);
const dateOf = (daysAgo: number) => new Date(`${vnDateKeyOf(ago(daysAgo * DAY))}T00:00:00Z`);

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan Riêng Tư"), T2 = await mkTutor("Thầy Khang Kín"), SA = await mkSuper("Quản trị"), AC = await mkUser({ name: "Biên tập", role: "admin", adminRole: "admin_content" });
  const T3 = await mkUser({ name: "Gia sư chưa duyệt", role: "admin", adminRole: "teacher", tutorVerified: false });
  const TL = await mkTutor("Gia sư bị khoá hồ sơ"), TB = await mkTutor("Gia sư bị cấm");
  await prisma.user.update({ where: { id: TL.id }, data: { profileLockedAt: new Date() } });
  await prisma.user.update({ where: { id: TB.id }, data: { banned: true } });
  const students = [];
  for (let i = 0; i < 14; i++) students.push(await mkUser({ name: `Học sinh Bí Mật ${i}` }));

  // ── Phiếu: 12 phiếu gửi 3 ngày trước (8 mở Zalo chat riêng có link, trong đó 4 phụ huynh đã xem · 2 mở Zalo nhóm không link · 2 chưa mở)
  const recent = ago(3 * DAY);
  const mkInv = (studentId: string, ym: string, o: Record<string, unknown>) => prisma.tuitionInvoice.create({ data: { code: generateInvoiceCode(), tutorId: T.id, studentId, yearMonth: ym, amountDue: 1_200_000, ...o } as never });
  for (let i = 0; i < 12; i++) {
    const priv = i < 8, group = i >= 8 && i < 10;
    await mkInv(students[i].id, "2026-10", {
      status: "sent", sentAt: recent, zaloOpenedAt: priv || group ? recent : null,
      ...(priv ? { viewToken: generatePortalToken(), viewTokenExpiresAt: ago(-20 * DAY), parentViewedAt: i < 4 ? recent : null } : {}),
    });
  }
  await mkInv(students[12].id, "2026-10", { status: "cancelled", sentAt: recent, zaloOpenedAt: recent, viewToken: generatePortalToken(), viewTokenExpiresAt: ago(-20 * DAY), parentViewedAt: recent }); // huỷ: bị loại
  await mkInv(students[13].id, "2026-10", { status: "draft", sentAt: null });                                                                                                                              // nháp: bị loại
  // lứa 20 ngày trước (đủ 14 ngày): 10 phiếu, 6 đóng sau 5 ngày, 4 chưa đóng
  const old = ago(20 * DAY);
  for (let i = 0; i < 10; i++) await mkInv(students[i].id, "2026-09", i < 6 ? { status: "paid", sentAt: old, paidAt: new Date(old.getTime() + 5 * DAY), paidAmount: 1_200_000 } : { status: "sent", sentAt: old });

  // ── Khoản tiền: trong khoảng 6 tự gạch · 3 chờ · 2 đã xử lý · 2 ghi tay; thêm 1 khoản chờ từ 60 ngày trước (ngoài khoảng, nhưng là khoản chờ lâu nhất)
  let seq = 0;
  const tx = (provider: string, status: string, occurredAt: Date) => prisma.bankTransaction.create({ data: { tutorId: T.id, provider, providerTxId: `hm-${++seq}`, occurredAt, amount: 100000, content: "ND bí mật KINABCDE", kind: "exact", status } });
  const two = ago(2 * DAY);
  for (let i = 0; i < 6; i++) await tx("sepay", "matched", two);
  for (let i = 0; i < 3; i++) await tx("sepay", "pending", two);
  for (let i = 0; i < 2; i++) await tx("sepay", "resolved", two);
  for (let i = 0; i < 2; i++) await tx("manual", "resolved", two);
  await tx("sepay", "pending", ago(60 * DAY));

  // ── Điểm danh: lớp của T có 12 buổi (9 điểm danh trong ngày, 3 điểm danh sau 60 giờ) + 2 buổi chỉ có "Có phép" tự sinh + 1 buổi ở tương lai
  const c1 = await mkCourse(T.id, { name: "Toán 9" });
  const s0 = students[0];
  const sess = async (courseId: string, createdBy: string, date: Date, records: { status: string; createdAt: Date; updatedBy: string | null }[]) => {
    const s = await prisma.attendanceSession.create({ data: { courseId, date, createdBy } });
    for (const r of records) await prisma.attendanceRecord.create({ data: { sessionId: s.id, userId: s0.id, ...r } });
  };
  for (let i = 1; i <= 12; i++) {
    const d = dateOf(i);
    await sess(c1.id, T.id, d, [{ status: "present", createdAt: new Date(d.getTime() + (i <= 9 ? 10 : 60) * HOUR), updatedBy: T.id }]);
  }
  for (const i of [13, 14]) await sess(c1.id, T.id, dateOf(i), [{ status: "excused", createdAt: new Date(dateOf(i).getTime() - 5 * DAY), updatedBy: null }]);
  await sess(c1.id, T.id, dateOf(-1), [{ status: "present", createdAt: new Date(), updatedBy: T.id }]); // ngày mai: không tính
  // các gia sư khác: T2 có 1 buổi đã dạy (tính), T3 chưa duyệt / TL bị khoá / TB bị cấm có buổi (KHÔNG tính vào số gia sư đang dùng)
  for (const [u, nm] of [[T2, "Văn 9"], [T3, "Lý 9"], [TL, "Hoá 9"], [TB, "Anh 9"]] as const) {
    const c = await mkCourse(u.id, { name: nm });
    const d = dateOf(2);
    await sess(c.id, u.id, d, [{ status: "present", createdAt: new Date(d.getTime() + 5 * HOUR), updatedBy: u.id }]);
  }

  section("Quyền");
  check("chưa đăng nhập → 401", (await api("GET", URL())).status === 401);
  check("học sinh → 403", [401, 403].includes((await api("GET", URL(), { as: students[0] })).status));
  check("gia sư → 403 (kể cả gia sư đã duyệt)", (await api("GET", URL(), { as: T })).status === 403);
  check("quản trị viên trung tâm (admin_super và admin_content) → 200", (await api("GET", URL(), { as: SA })).status === 200 && (await api("GET", URL(), { as: AC })).status === 200);
  const res = await api("GET", URL("?days=30"), { as: SA });
  check("không cache", /no-store/.test(res.headers.get("cache-control") ?? ""));

  section("Tham số days");
  check("thiếu / sai / ngoài 1–365 → 30; hợp lệ giữ nguyên", (await api("GET", URL(), { as: SA })).json.days === 30 && (await api("GET", URL("?days=abc"), { as: SA })).json.days === 30
    && (await api("GET", URL("?days=0"), { as: SA })).json.days === 30 && (await api("GET", URL("?days=400"), { as: SA })).json.days === 30 && (await api("GET", URL("?days=7"), { as: SA })).json.days === 7);

  section("Số đo trong 30 ngày");
  const j = res.json;
  check("minSample = 10", j.minSample === 10);
  check("chỉ số 1: 10/22 phiếu đã mở Zalo (12 phiếu gần + 10 phiếu lứa cũ; loại phiếu huỷ và nháp)", j.invoices.sent === 22 && j.invoices.zaloOpened.n === 10 && j.invoices.zaloOpened.d === 22 && j.invoices.zaloOpened.enough, j.invoices.zaloOpened);
  check("chỉ số 2: mẫu số 8 phiếu có link riêng (không tính 2 phiếu gửi nhóm) → chưa đủ dữ liệu, không có tỉ lệ", j.invoices.parentViewed.d === 8 && j.invoices.parentViewed.n === 4 && !j.invoices.parentViewed.enough && j.invoices.parentViewed.rate === null, j.invoices.parentViewed);
  check("chỉ số 3: 6/10 phiếu đóng đủ trong 14 ngày (lứa gửi 20 ngày trước)", j.invoices.paidIn14.n === 6 && j.invoices.paidIn14.d === 10 && j.invoices.paidIn14.enough && j.invoices.paidIn14.rate === 0.6, j.invoices.paidIn14);
  check("chỉ số 3 ghi rõ lứa phiếu đã dùng (ISO)", typeof j.invoices.paidCohort.from === "string" && typeof j.invoices.paidCohort.to === "string" && new Date(j.invoices.paidCohort.to).getTime() < Date.now() - 13 * DAY);
  check("chỉ số 4: 13 khoản trong khoảng = 6 tự gạch · 3 chờ · 2 đã xử lý · 2 ghi tay (khoản chờ cũ 60 ngày nằm ngoài khoảng)", j.bank.total === 13 && j.bank.auto === 6 && j.bank.pending === 3 && j.bank.resolved === 2 && j.bank.manual === 2, j.bank);
  check("chỉ số 4: tỉ lệ tự gạch 6/11 (không tính 2 khoản ghi tay); khoản chờ lâu nhất 60 ngày dù ngoài khoảng", j.bank.autoRate.n === 6 && j.bank.autoRate.d === 11 && j.bank.autoRate.enough && j.bank.oldestPendingDays === 60, [j.bank.autoRate, j.bank.oldestPendingDays]);
  // Chỉ số 5 đo MỌI buổi đã điểm danh, không lọc theo tập gia sư: 12 buổi của T (9 kịp) + 4 buổi của T2, T3, TL, TB (đều kịp) = 13/16.
  check("chỉ số 5: 13/16 buổi điểm danh kịp thời; 2 buổi chỉ có “Có phép” tự sinh là không đo; buổi ngày mai không tính", j.timeliness.n === 13 && j.timeliness.d === 16 && j.timeliness.unmeasured === 2 && j.timeliness.enough, j.timeliness);
  check("chỉ số 6: 2 gia sư (chưa duyệt, bị khoá, bị cấm không nằm trong mẫu số), 2 có buổi đã dạy, 1 gửi phiếu", j.tutors.tutors === 2 && j.tutors.teaching === 2 && j.tutors.invoicing === 1, j.tutors);

  section("Khoảng 7 ngày");
  const w = (await api("GET", URL("?days=7"), { as: SA })).json;
  check("phiếu gửi 3 ngày trước vẫn trong khoảng; lứa phiếu 20 ngày trước nằm trong lứa [now-21d, now-14d] nên chỉ số 3 vẫn 6/10", w.invoices.sent === 12 && w.invoices.zaloOpened.n === 10 && w.invoices.zaloOpened.d === 12 && w.invoices.paidIn14.n === 6 && w.invoices.paidIn14.d === 10, [w.invoices.zaloOpened, w.invoices.paidIn14]);
  check("khoản chờ lâu nhất không đổi theo khoảng (60 ngày)", w.bank.oldestPendingDays === 60);

  section("Không lộ thông tin cá nhân");
  const text = JSON.stringify(res.json);
  check("không có tên học sinh / gia sư / email / nội dung giao dịch / mã phiếu / token trong phản hồi",
    ![T.name, T2.name, "Học sinh Bí Mật", "Gia sư chưa duyệt", T.email, "ND bí mật", "KINABCDE"].some(x => text.includes(x)) && !/"(name|email|phone|content|code|viewToken|studentId|tutorId)"/.test(text), text.slice(0, 200));

  section("Gia sư mới vào — chỉ số 7, 8, 9 (NC2-020), số tính tay");
  // 12 gia sư N0..N11 đăng ký đúng 10 ngày trước (đủ tuổi 24h và 7 ngày). Giờ lớp đầu ghi dạng ISO nên chính xác tới từng giờ.
  const REG = ago(10 * DAY);
  const at = (ms: number) => new Date(REG.getTime() + ms).toISOString();
  const N: Awaited<ReturnType<typeof mkTutor>>[] = [];
  for (let i = 0; i < 12; i++) {
    const u = await mkTutor(`Gia sư mới Kín ${String(i).padStart(2, "0")}`);
    await prisma.user.update({ where: { id: u.id }, data: { createdAt: REG, ...(i === 11 ? { tutorVerified: false } : {}) } }); // N11 chưa được duyệt: vẫn nằm trong mẫu số
    N.push(u);
  }
  const firstClass = [3 * HOUR, 3 * HOUR, 3 * HOUR, 3 * HOUR, 3 * HOUR, 23 * HOUR, 25 * HOUR, 72 * HOUR]; // N0–N4 trong 24h; N5 23h kịp; N6 25h trễ; N7 3 ngày; N8–N11 chưa có lớp
  const cs: Awaited<ReturnType<typeof mkCourse>>[] = [];
  for (let i = 0; i < firstClass.length; i++) {
    const c = await mkCourse(N[i].id, { name: `Lớp thử mới ${i}` });
    await prisma.course.update({ where: { id: c.id }, data: { createdAt: at(firstClass[i]) } });
    cs.push(c);
  }
  // Buổi đã dạy đầu: N0–N3 và N7 sau 2 ngày (kịp); N4 sau 8 ngày (trễ); N5 chỉ có "Có phép" (không phải buổi đã dạy)
  for (const i of [0, 1, 2, 3, 7]) await mkAttendanceSession(cs[i].id, N[i].id, dateOf(8));
  await mkAttendanceSession(cs[4].id, N[4].id, dateOf(2));
  await mkAttendanceSession(cs[5].id, N[5].id, dateOf(8), ["excused"]);
  // Nhiễu: gia sư đăng ký 10 ngày trước nhưng bị cấm / khoá hồ sơ KHÔNG nằm trong mẫu số
  for (const f of [{ banned: true }, { profileLockedAt: new Date() }]) {
    const x = await mkTutor("Gia sư loại khỏi mẫu");
    await prisma.user.update({ where: { id: x.id }, data: { createdAt: REG, ...f } });
    await mkCourse(x.id, { name: "Lớp nhiễu" });
  }
  const a = (await api("GET", URL("?days=30"), { as: SA })).json.activation;
  // Mẫu số: 12 gia sư đủ tuổi (N0–N11); gia sư T, T2, T3 (đăng ký vừa xong) CHƯA đủ 24h nên không vào mẫu số.
  check("đăng ký trong 30 ngày = 15 (12 gia sư thử + T, T2, T3 vừa tạo; gia sư bị cấm / khoá không tính)", a.registered === 15, a.registered);
  check("chỉ số 7: 6/12 tạo lớp đầu trong 24h (N0–N4, N5 ở 23h; N6 ở 25h không kịp) — gia sư chưa duyệt vẫn trong mẫu số", a.classIn24h.n === 6 && a.classIn24h.d === 12 && a.classIn24h.enough, a.classIn24h);
  check("chỉ số 8: 5/12 có buổi đã dạy đầu trong 7 ngày (N0–N3, N7; N4 sau 8 ngày và N5 chỉ “Có phép” không tính)", a.taughtIn7d.n === 5 && a.taughtIn7d.d === 12 && a.taughtIn7d.enough, a.taughtIn7d);
  // Giờ lớp đầu: 3 giờ ×5, 23, 25, 72 (N0–N7) + 3 lớp vừa tạo của T, T2, T3 (gần 0 giờ) = 11 giá trị; sắp xếp: 0,0,0,3,3,3,3,3,23,25,72 → trung vị = giá trị thứ 6 = 3
  check("chỉ số 9: trung vị 3 giờ trên 11 gia sư đã có lớp; người chưa có lớp không nằm trong con số", a.firstClassHours.n === 11 && a.firstClassHours.enough && a.firstClassHours.hours === 3, a.firstClassHours);
  const a7 = (await api("GET", URL("?days=7"), { as: SA })).json.activation;
  check("cột 7 ngày: 12 gia sư thử đăng ký 10 ngày trước nằm ngoài → mẫu số 0 / chưa đủ dữ liệu ở cả ba chỉ số (hai trạng thái cùng hiện được)", a7.registered === 3 && !a7.classIn24h.enough && a7.classIn24h.d === 0 && !a7.taughtIn7d.enough && !a7.firstClassHours.enough, a7);
  const text2 = JSON.stringify((await api("GET", URL("?days=30"), { as: SA })).json);
  check("phản hồi mới không lộ tên / email / id gia sư", !N.some(u => text2.includes(u.name) || text2.includes(u.email) || text2.includes(u.id)) && !text2.includes("Gia sư mới Kín") && !/"(ownerId|userId|id)"/.test(JSON.stringify(a)), JSON.stringify(a).slice(0, 200));
  check("trường cũ còn nguyên (invoices, bank, timeliness, tutors, minSample)", ["invoices", "bank", "timeliness", "tutors", "minSample", "days", "since", "generatedAt"].every(k => k in JSON.parse(text2)));

  done();
})().catch(e => { console.error("CRASH", e); process.exit(1); });
