// F2 — Vòng thu học phí (API thật + DB thật): hạn đóng, nhắc bước 2–3 (KiN Pro), lịch sử nhắc, Hộp việc, trang phụ huynh.
// Chạy với ba cấu hình máy chủ (xem invoice-reminder-run.sh):
//   A: cổng gói TẮT (mặc định)  EXPECT_ENFORCE=0 → ai cũng dùng được
//   B: KIN_PLAN_ENFORCE=1        EXPECT_ENFORCE=1 → Free bị chặn bước 2–3/hạn/lịch sử, bước 1 + công nợ vẫn dùng được; Pro hết hạn không có bước mới
//   C: VERCEL_ENV=preview        EXPECT_PREVIEW=1 → mọi đường ghi mới liên quan tiền bị chặn
// Cốt lõi: số tiền/trạng thái của phiếu KHÔNG ĐỔI sau mọi thao tác nhắc/hạn (so với ảnh chụp trước).
import { api, BASE, mkTutor, mkUser, mkCourse, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { generateInvoiceCode } from "@/lib/tuitionInvoice";
import { loadTutorTodoTotal } from "@/lib/tutorDashboard";

const ENF = process.env.EXPECT_ENFORCE === "1", PREVIEW = process.env.EXPECT_PREVIEW === "1";
const DAY = 24 * 3600_000;
const vnKey = (t: Date) => new Date(t.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
const keyPlus = (n: number) => vnKey(new Date(Date.now() + n * DAY));

async function mkInv(tutorId: string, studentId: string, ym: string, status: string, o: { amountDue?: number; paidAmount?: number; dueDate?: string | null; zaloDaysAgo?: number } = {}) {
  return prisma.tuitionInvoice.create({
    data: {
      code: generateInvoiceCode(), tutorId, studentId, yearMonth: ym, amountDue: o.amountDue ?? 1_200_000, paidAmount: o.paidAmount ?? 0, status,
      sentAt: status === "draft" ? null : new Date(), dueDate: o.dueDate ?? null,
      zaloOpenedAt: o.zaloDaysAgo !== undefined ? new Date(Date.now() - o.zaloDaysAgo * DAY) : null,
      viewToken: status === "draft" ? null : `${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`.padEnd(32, "a").slice(0, 32), viewTokenExpiresAt: status === "draft" ? null : new Date(Date.now() + 20 * DAY),
    },
  });
}
let memo = 0;
const grant = (userId: string, startDays: number, endDays: number) => prisma.proOrder.create({ data: {
  userId, period: "month", durationDays: 30, priceVnd: 0, listPriceVnd: 0, source: "admin_grant", memoCode: `KINPRO-T${Date.now().toString(36)}${memo++}`, status: "active",
  startDate: new Date(Date.now() + startDays * DAY), endDate: new Date(Date.now() + endDays * DAY),
} });
const snap = async (ids: string[]) => JSON.stringify((await prisma.tuitionInvoice.findMany({ where: { id: { in: ids } }, orderBy: { id: "asc" }, select: { id: true, code: true, amountDue: true, paidAmount: true, status: true, breakdown: true, tutorId: true, studentId: true, yearMonth: true } })));

(async () => {
  await wipe();
  const P = await mkTutor("Cô Pro"), F = await mkTutor("Cô Free"), X = await mkTutor("Cô Hết Hạn"), O = await mkTutor("Thầy Khác");
  await grant(P.id, -5, 25);
  await grant(X.id, -40, -10);
  const A = await mkUser({ name: "Minh Anh" }), B = await mkUser({ name: "Bảo Bình" }), C = await mkUser({ name: "Chi Chi" }), D = await mkUser({ name: "Dũng" });
  for (const t of [P, F, X, O]) { const c = await mkCourse(t.id, { name: `Lớp ${t.name}` }); for (const u of [A, B]) await prisma.enrollment.create({ data: { userId: u.id, courseId: c.id, status: "active" } }); }
  const YM = vnKey(new Date()).slice(0, 7);
  const patch = (id: string, body: unknown, as = P) => api("PATCH", `/api/tutor/invoices/${id}`, { as, body });
  const zalo = (id: string, body: unknown, as = P) => api("POST", `/api/tutor/invoices/${id}/zalo`, { as, body });
  const hist = (id: string, as = P) => api("GET", `/api/tutor/invoices/${id}/reminders`, { as });
  const proOk = (s: number) => (ENF ? s === 403 : s === 200);

  if (PREVIEW) {
    section("Bản xem trước (VERCEL_ENV=preview): mọi đường ghi mới liên quan tiền bị chặn");
    const i = await mkInv(P.id, A.id, YM, "sent", { zaloDaysAgo: 5 });
    const before = await snap([i.id]);
    const d = await patch(i.id, { action: "set_due_date", dueDate: keyPlus(5) });
    check("đặt hạn đóng → 503", d.status === 503, d.json);
    check("hạn đóng không được ghi", (await prisma.tuitionInvoice.findUnique({ where: { id: i.id } }))?.dueDate === null);
    const s2 = await zalo(i.id, { action: "prepare", target: "private", step: 2 });
    check("chuẩn bị bước 2 → 503", s2.status === 503, s2.json);
    const o1 = await zalo(i.id, { action: "opened", step: 1 });
    check("bước 1 vẫn dùng như cũ (200, ghi 'đã mở Zalo')", o1.status === 200 && !!(await prisma.tuitionInvoice.findUnique({ where: { id: i.id } }))?.zaloOpenedAt);
    check("nhưng KHÔNG ghi dòng lịch sử mới", (await prisma.invoiceReminder.count()) === 0);
    check("số tiền/trạng thái phiếu không đổi", (await snap([i.id])) === before);
    await done();
    return;
  }

  // ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
  const pa = await mkInv(P.id, A.id, YM, "sent", { dueDate: keyPlus(-5), zaloDaysAgo: 4 });           // quá hạn 5 ngày, đã nhắc bước 1 cách 4 ngày → đến lúc bước 2
  const pb = await mkInv(P.id, B.id, YM, "partial", { amountDue: 1_000_000, paidAmount: 400_000 });   // chưa hạn, chưa nhắc
  const pc = await mkInv(P.id, C.id, YM, "paid", { paidAmount: 1_200_000 });
  const pd = await mkInv(P.id, D.id, YM, "cancelled");
  const pe = await mkInv(P.id, D.id, "2026-01", "parent_reported", { zaloDaysAgo: 9 });
  await prisma.tuitionInvoice.update({ where: { id: pe.id }, data: { parentReportedAt: new Date(Date.now() - 2 * 3600_000) } });
  const pf = await mkInv(P.id, C.id, "2026-02", "draft");
  const fa = await mkInv(F.id, A.id, YM, "sent", { zaloDaysAgo: 4 });
  const xa = await mkInv(X.id, A.id, YM, "sent", { zaloDaysAgo: 8 });
  const oa = await mkInv(O.id, A.id, YM, "sent");
  const mine = [pa, pb, pc, pd, pe, pf, fa, xa, oa].map(i => i.id);
  const before = await snap(mine);

  section("Quyền");
  check("chưa đăng nhập → 401 (đặt hạn, lịch sử)", (await api("PATCH", `/api/tutor/invoices/${pa.id}`, { body: { action: "set_due_date", dueDate: keyPlus(3) } })).status === 401 && (await api("GET", `/api/tutor/invoices/${pa.id}/reminders`)).status === 401);
  check("học viên → bị chặn", [401, 403].includes((await patch(pa.id, { action: "set_due_date", dueDate: keyPlus(3) }, A as never)).status) && [401, 403].includes((await hist(pa.id, A as never)).status));
  check("phiếu của gia sư khác → 404 (đặt hạn, lịch sử, nhắc)", (await patch(oa.id, { action: "set_due_date", dueDate: keyPlus(3) })).status === 404 && (await hist(oa.id)).status === 404 && (await zalo(oa.id, { action: "prepare", target: "private", step: 2 })).status === 404);
  check("phiếu không có → 404", (await hist("khong-co")).status === 404);

  section("Đặt hạn đóng: đầu vào");
  for (const [name, v] of [["sai định dạng", "25/11/2026"], ["ngày không tồn tại", "2026-02-30"], ["số", 20261125], ["năm gõ nhầm 2062", "2062-01-01"], ["thiếu", undefined]] as const) {
    const r = await patch(pb.id, { action: "set_due_date", dueDate: v });
    check(`${name} → 400`, r.status === 400, r.json);
  }
  check("phiếu đã đóng đủ → 409", (await patch(pc.id, { action: "set_due_date", dueDate: keyPlus(3) })).status === 409);
  check("phiếu đã huỷ → 409", (await patch(pd.id, { action: "set_due_date", dueDate: keyPlus(3) })).status === 409);

  section(ENF ? "Đặt hạn đóng: gói Pro (cổng BẬT)" : "Đặt hạn đóng (cổng TẮT: ai cũng dùng được)");
  const due = keyPlus(10);
  const setPro = await patch(pb.id, { action: "set_due_date", dueDate: due });
  check("Pro đặt hạn → 200, DB lưu đúng ngày", setPro.status === 200 && setPro.json.dueDate === due && (await prisma.tuitionInvoice.findUnique({ where: { id: pb.id } }))?.dueDate === due, setPro.json);
  const setFree = await patch(fa.id, { action: "set_due_date", dueDate: due }, F);
  check(ENF ? "Free đặt hạn → 403 PRO_REQUIRED, không ghi" : "cổng tắt: Free cũng đặt được", ENF ? setFree.status === 403 && setFree.json.code === "PRO_REQUIRED" && (await prisma.tuitionInvoice.findUnique({ where: { id: fa.id } }))?.dueDate === null : setFree.status === 200, setFree.json);
  const setExp = await patch(xa.id, { action: "set_due_date", dueDate: due }, X);
  check(ENF ? "Pro đã hết hạn đặt hạn mới → 403" : "cổng tắt: đặt được", proOk(setExp.status), setExp.json);
  if (ENF) {
    await prisma.tuitionInvoice.update({ where: { id: fa.id }, data: { dueDate: due } });
    const clr = await patch(fa.id, { action: "set_due_date", dueDate: null }, F);
    check("Free vẫn XOÁ được hạn đang có (dueDate:null)", clr.status === 200 && (await prisma.tuitionInvoice.findUnique({ where: { id: fa.id } }))?.dueDate === null);
  }
  const clearPro = await patch(pb.id, { action: "set_due_date", dueDate: null });
  check("Pro xoá hạn → null", clearPro.status === 200 && (await prisma.tuitionInvoice.findUnique({ where: { id: pb.id } }))?.dueDate === null);
  await patch(pb.id, { action: "set_due_date", dueDate: keyPlus(2) });

  section("Danh sách phiếu: hạn, quá hạn, bước kế, cờ Pro, công nợ luôn hiện");
  const list = await api("GET", `/api/tutor/invoices?yearMonth=${YM}`, { as: P });
  const row = (id: string) => (list.json.items as any[]).find(i => i.id === id);
  check("200 + cờ reminderPro đúng cấu hình", list.status === 200 && list.json.reminderPro === true && /^\d{4}-\d{2}-\d{2}$/.test(list.json.defaultDueDate), [list.status, list.json.reminderPro]);
  check("phiếu quá hạn 5 ngày: overdueDays=5, nextStep=2, lastStep=1", row(pa.id).overdueDays === 5 && row(pa.id).nextStep === 2 && row(pa.id).lastStep === 1 && row(pa.id).dueDate === keyPlus(-5), row(pa.id));
  check("phiếu chưa nhắc: nextStep null, lastStep 0, chưa quá hạn", row(pb.id).nextStep === null && row(pb.id).lastStep === 0 && row(pb.id).overdueDays === 0);
  check("tổng hợp quá hạn: 1 phiếu, đúng số CÒN LẠI của phiếu (không tính thêm đồng nào)", list.json.summary.overdueCount === 1 && list.json.summary.overdueRemaining === 1_200_000, list.json.summary);
  check("công nợ (Còn lại) vẫn là tổng cũ: 1.200.000 + 600.000 (không tính phiếu nháp-chưa lập/huỷ)", list.json.summary.totalRemaining === (await prisma.tuitionInvoice.findMany({ where: { tutorId: P.id, yearMonth: YM, status: { not: "cancelled" } } })).reduce((s, i) => s + i.amountDue - i.paidAmount, 0));
  const listF = await api("GET", `/api/tutor/invoices?yearMonth=${YM}`, { as: F });
  check(ENF ? "Free (cổng bật): reminderPro=false NHƯNG vẫn thấy công nợ và phiếu của mình" : "cổng tắt: reminderPro=true", listF.json.reminderPro === !ENF && (listF.json.items as any[]).length === 1 && listF.json.summary.totalRemaining === 1_200_000, listF.json.reminderPro);

  section("Nhắc nhiều bước: bước 1 miễn phí như cũ");
  const o1 = await zalo(fa.id, { action: "opened" }, F);
  check("Free ghi 'đã mở Zalo' bước 1 (không cần Pro)", o1.status === 200 && o1.json.step === 1 && !!(await prisma.tuitionInvoice.findUnique({ where: { id: fa.id } }))?.zaloOpenedAt);
  check("bước 1 tạo một dòng lịch sử", (await prisma.invoiceReminder.count({ where: { invoiceId: fa.id, step: 1 } })) === 1);
  const o1b = await zalo(fa.id, { action: "opened", step: 1 }, F);
  check("bấm đúp trong 1 phút không tạo dòng thứ hai", o1b.status === 200 && (await prisma.invoiceReminder.count({ where: { invoiceId: fa.id, step: 1 } })) === 1);
  const p1 = await zalo(fa.id, { action: "prepare", target: "private" }, F);
  check("prepare bước 1 trả step 1 và hạn đúng như DB (chưa đặt → null)", p1.status === 200 && p1.json.step === 1 && p1.json.dueDate === (ENF ? null : due), p1.json);

  section("Nhắc bước 2–3");
  check("step lạ → 400", (await zalo(pa.id, { action: "prepare", target: "private", step: 4 })).status === 400 && (await zalo(pa.id, { action: "opened", step: "2" })).status === 400);
  const g2 = await zalo(pa.id, { action: "prepare", target: "group", step: 2 });
  check("bước 2 vào NHÓM → 400 (chỉ chat riêng)", g2.status === 400, g2.json);
  const s2 = await zalo(pa.id, { action: "prepare", target: "private", step: 2 });
  check("Pro chuẩn bị bước 2 → 200, có link, hạn thật, số còn lại", s2.status === 200 && s2.json.step === 2 && s2.json.dueDate === keyPlus(-5) && s2.json.amount === 1_200_000 && /^\/phieu\/[0-9a-f]{32}$/.test(s2.json.path ?? ""), s2.json);
  const s3early = await zalo(pa.id, { action: "prepare", target: "private", step: 3 });
  check("bước 3 khi chưa có bước 2 → 409", s3early.status === 409, s3early.json);
  const s2fr = await zalo(fa.id, { action: "prepare", target: "private", step: 2 }, F);
  check(ENF ? "Free chuẩn bị bước 2 → 403 PRO_REQUIRED" : "cổng tắt: Free cũng dùng được", ENF ? s2fr.status === 403 && s2fr.json.code === "PRO_REQUIRED" : s2fr.status === 200, s2fr.json);
  const o2fr = await zalo(fa.id, { action: "opened", step: 2 }, F);
  check(ENF ? "Free ghi mở Zalo bước 2 → 403 và KHÔNG ghi dòng" : "cổng tắt: ghi được", ENF ? o2fr.status === 403 && (await prisma.invoiceReminder.count({ where: { invoiceId: fa.id, step: 2 } })) === 0 : o2fr.status === 200, o2fr.json);
  const s2exp = await zalo(xa.id, { action: "prepare", target: "private", step: 2 }, X);
  check(ENF ? "Pro đã HẾT HẠN: không có bước 2 mới → 403" : "cổng tắt: dùng được", ENF ? s2exp.status === 403 : s2exp.status === 200, s2exp.json);
  const s2rep = await zalo(pe.id, { action: "prepare", target: "private", step: 2 });
  check("phụ huynh đã báo chuyển → 409, không nhắc thêm", s2rep.status === 409, s2rep.json);
  const s2draft = await zalo(pf.id, { action: "prepare", target: "private", step: 2 });
  check("phiếu nháp → 409 (như bước 1)", s2draft.status === 409);

  const o2 = await zalo(pa.id, { action: "opened", step: 2 });
  check("Pro ghi 'đã mở Zalo' bước 2 → 200 và một dòng lịch sử", o2.status === 200 && o2.json.step === 2 && (await prisma.invoiceReminder.count({ where: { invoiceId: pa.id, step: 2 } })) === 1, o2.json);
  const s3 = await zalo(pa.id, { action: "prepare", target: "private", step: 3 });
  check("giờ bước 3 chuẩn bị được", s3.status === 200 && s3.json.step === 3);
  const o3 = await zalo(pa.id, { action: "opened", step: 3 });
  check("ghi bước 3", o3.status === 200 && (await prisma.invoiceReminder.count({ where: { invoiceId: pa.id, step: 3 } })) === 1);
  const listAfter = await api("GET", `/api/tutor/invoices?yearMonth=${YM}`, { as: P });
  const ra = (listAfter.json.items as any[]).find(i => i.id === pa.id);
  check("sau bước 3: lastStep=3, nextStep=null (không có bước 4)", ra.lastStep === 3 && ra.nextStep === null && ra.proStepsLogged === 2, ra);

  section("Lịch sử nhắc của một phiếu");
  await prisma.tuitionInvoice.update({ where: { id: pa.id }, data: { parentReportedAt: new Date(Date.now() - 3600_000) } });
  const bt = await prisma.bankTransaction.create({ data: { tutorId: P.id, provider: "manual", providerTxId: `m-${Date.now()}`, occurredAt: new Date(), amount: 300_000, content: "x", invoiceId: pa.id, appliedAmount: 300_000, kind: "short", status: "resolved", resolution: "manual_cash", resolvedAt: new Date() } });
  await prisma.invoiceReminder.create({ data: { invoiceId: pa.id, tutorId: P.id, step: 1, openedAt: new Date(Date.now() - 4 * DAY) } });
  const h = await hist(pa.id);
  const kinds = (h.json.events as any[] | undefined)?.map(e => `${e.kind}${e.step ?? ""}`);
  check("200, no-store, đủ 3 lần mở Zalo + phụ huynh báo + tiền ghi vào, đúng thứ tự thời gian", h.status === 200 && /no-store/.test(h.headers.get("cache-control") ?? "") && kinds?.filter(k => k.startsWith("zalo_opened")).length === 3 && kinds.includes("parent_reported") && kinds.includes("matched") && JSON.stringify((h.json.events as any[]).map(e => e.at)) === JSON.stringify((h.json.events as any[]).map(e => e.at).sort()), h.json);
  check("matched=true khi đã có tiền ghi vào; không lộ tên người/số điện thoại", h.json.matched === true && !/Minh Anh|09\d{8}/.test(JSON.stringify(h.json)));
  await prisma.bankTransaction.delete({ where: { id: bt.id } });
  const h2 = await hist(pb.id);
  check("phiếu chưa nhắc → events rỗng, matched=false", h2.status === 200 && h2.json.events.length === 0 && h2.json.matched === false, h2.json);
  const hf = await hist(fa.id, F);
  check(ENF ? "Free chỉ có bước 1: lịch sử là của Pro → 403" : "cổng tắt: xem được", ENF ? hf.status === 403 && hf.json.code === "PRO_REQUIRED" : hf.status === 200, hf.json);
  // Pro hết hạn nhưng từng nhắc bước 2: lịch sử cũ vẫn xem được
  await prisma.invoiceReminder.create({ data: { invoiceId: xa.id, tutorId: X.id, step: 1, openedAt: new Date(Date.now() - 20 * DAY) } });
  await prisma.invoiceReminder.create({ data: { invoiceId: xa.id, tutorId: X.id, step: 2, openedAt: new Date(Date.now() - 15 * DAY) } });
  const hx = await hist(xa.id, X);
  check("Pro hết hạn: lịch sử cũ (có bước 2) VẪN xem được", hx.status === 200 && (hx.json.events as any[]).some(e => e.step === 2), hx.json);

  section("Hộp việc: 'N phiếu đến lúc nhắc bước …'");
  await prisma.tuitionInvoice.update({ where: { id: pa.id }, data: { parentReportedAt: null } });
  await prisma.invoiceReminder.deleteMany({ where: { invoiceId: pa.id } });          // quay lại: chỉ có bước 1 từ 4 ngày trước (zaloOpenedAt)
  await prisma.tuitionInvoice.update({ where: { id: pa.id }, data: { zaloOpenedAt: new Date(Date.now() - 4 * DAY) } });
  const inbox = await api("GET", "/api/tutor/hop-viec", { as: P });
  const it = (inbox.json.items as any[]).find(i => i.id === "invoiceRemind");
  check("Pro: có việc, tiêu đề bắt đầu bằng số, nêu bước 2 và 'quá hạn tới 5 ngày'", inbox.status === 200 && !!it && /^1 phiếu đến lúc nhắc bước 2/.test(it.title) && it.title.includes("quá hạn tới 5 ngày") && it.href === "/lop-cua-toi/hoc-phi", it?.title);
  check("khung đọc có tên em + 'nhắc bước 2' + số còn lại; không tên khác", it.detail.rows.length === 1 && it.detail.rows[0].title === "Minh Anh" && it.detail.rows[0].sub.includes("nhắc bước 2") && it.detail.rows[0].sub.includes("1.200.000đ"), it.detail.rows);
  check("số đỏ = tổng các loại, khớp loadTutorTodoTotal", inbox.json.total === (inbox.json.items as any[]).reduce((n, i) => n + Number(i.title.match(/^\d+/)?.[0] ?? 0), 0) && inbox.json.total === (await loadTutorTodoTotal(P.id)), [inbox.json.total, await loadTutorTodoTotal(P.id)]);
  const inboxF = await api("GET", "/api/tutor/hop-viec", { as: F });
  await prisma.tuitionInvoice.update({ where: { id: fa.id }, data: { zaloOpenedAt: new Date(Date.now() - 4 * DAY) } });
  await prisma.invoiceReminder.deleteMany({ where: { invoiceId: fa.id } });
  const inboxF2 = await api("GET", "/api/tutor/hop-viec", { as: F });
  const itF = (inboxF2.json.items as any[]).find(i => i.id === "invoiceRemind");
  check(ENF ? "Free (cổng bật): KHÔNG có việc bước 2–3 và không vào số đỏ" : "cổng tắt: Free cũng thấy việc", ENF ? !itF && inboxF2.json.total === (await loadTutorTodoTotal(F.id)) : !!itF, [inboxF.json.total, inboxF2.json.total]);
  const inboxX = await api("GET", "/api/tutor/hop-viec", { as: X });
  check(ENF ? "Pro hết hạn: dừng gợi bước mới" : "cổng tắt: vẫn có", ENF ? !(inboxX.json.items as any[]).some(i => i.id === "invoiceRemind") : (inboxX.json.items as any[]).some(i => i.id === "invoiceRemind"));
  const inboxO = await api("GET", "/api/tutor/hop-viec", { as: O });
  check("gia sư khác không thấy việc của người khác", !(inboxO.json.items as any[]).some(i => i.id === "invoiceRemind"));
  await prisma.tuitionInvoice.update({ where: { id: pa.id }, data: { zaloOpenedAt: new Date(Date.now() - 1 * DAY) } });
  check("mới nhắc hôm qua → hết việc (chưa đến lúc)", !((await api("GET", "/api/tutor/hop-viec", { as: P })).json.items as any[]).some(i => i.id === "invoiceRemind"));
  await prisma.tuitionInvoice.update({ where: { id: pa.id }, data: { zaloOpenedAt: new Date(Date.now() - 4 * DAY) } });

  section("Phụ huynh / học viên: thấy hạn đóng, KHÔNG thấy lời mời Pro");
  const pg = await fetch(`${BASE}/phieu/${pa.viewToken}`, { redirect: "manual" });
  const html = await pg.text();
  check("trang phiếu 200, hiện 'Hạn đóng' đúng ngày dd/mm/yyyy", pg.status === 200 && html.includes("Hạn đóng") && html.includes(keyPlus(-5).split("-").reverse().join("/")), pg.status);
  check("không chữ Pro / nâng cấp / gói / bước 2", !/KiN Pro|nâng cấp|Nâng cấp|\/lop-cua-toi\/goi|bước 2/.test(html));
  const noDue = await mkInv(P.id, A.id, "2025-12", "sent");
  const html2 = await (await fetch(`${BASE}/phieu/${noDue.viewToken}`)).text();
  check("phiếu chưa có hạn: không có dòng 'Hạn đóng:'", !html2.includes("Hạn đóng:"));
  const me = await api("GET", "/api/users/me/invoices", { as: A });
  check("API phiếu của học viên có dueDate và không có chữ Pro", me.status === 200 && JSON.stringify(me.json).includes(`"dueDate":"${keyPlus(-5)}"`) && !/KiN Pro/.test(JSON.stringify(me.json)), me.status);

  section("TIỀN: số tiền và trạng thái mọi phiếu KHÔNG đổi sau mọi thao tác nhắc/hạn");
  const after = await snap(mine);
  // pa/pb/xa... không đổi amountDue/paidAmount/status/breakdown; chỉ dueDate/zaloOpenedAt (không nằm trong ảnh chụp)
  check("ảnh chụp (code, amountDue, paidAmount, status, breakdown) trước = sau", before === after);
  check("không tạo giao dịch tiền nào do nhắc/hạn", (await prisma.bankTransaction.count()) === 0);
  check("không tạo khoản phí/trễ hạn nào", (await prisma.feeCharge.count()) === 0);
  await done();
})();
