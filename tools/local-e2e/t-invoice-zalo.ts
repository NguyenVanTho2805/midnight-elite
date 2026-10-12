import { api, BASE, mkTutor, mkUser, mkCourse, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { generateInvoiceCode } from "@/lib/tuitionInvoice";

const DAY = 24 * 3600_000;
async function inv(tutorId: string, studentId: string, ym: string, status: string, o: { amountDue?: number; paidAmount?: number } = {}) {
  return prisma.tuitionInvoice.create({ data: { code: generateInvoiceCode(), tutorId, studentId, yearMonth: ym, amountDue: o.amountDue ?? 1_200_000, paidAmount: o.paidAmount ?? 0, status, sentAt: status === "draft" ? null : new Date() } });
}
// (guest)/loading.tsx làm Next bắt đầu stream trước khi notFound() chạy → mã HTTP vẫn 200, thân là trang 404 (giống /so-cua-con).
const page = async (token: string) => { const r = await fetch(`${BASE}/phieu/${token}`, { redirect: "manual" }); const html = await r.text(); const nf = html.includes("NEXT_HTTP_ERROR_FALLBACK;404"); return { status: nf ? 404 : r.status, html, nf }; };
const hex32 = /^\/phieu\/[0-9a-f]{32}$/;

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan"), T2 = await mkTutor("Thầy Khác");
  const A = await mkUser({ name: "Minh Anh" }), B = await mkUser({ name: "Bảo Bình" }), C = await mkUser({ name: "Chi Chi" });
  await prisma.user.update({ where: { id: A.id }, data: { parentName: "Hoa", parentPhone: "0901234567" } });
  const course = await mkCourse(T.id, { name: "Toán 9" });
  for (const u of [A, B, C]) await prisma.enrollment.create({ data: { userId: u.id, courseId: course.id, status: "active" } });
  await prisma.tutorPayoutAccount.create({ data: { userId: T.id, bankBin: "970436", accountNo: "0123456789", accountName: "NGUYEN VAN LAN" } });

  const sent = await inv(T.id, A.id, "2026-10", "sent");
  const reported = await inv(T.id, A.id, "2026-09", "parent_reported");
  const partial = await inv(T.id, A.id, "2026-08", "partial", { paidAmount: 500_000 });
  const draft = await inv(T.id, B.id, "2026-10", "draft");
  const paid = await inv(T.id, B.id, "2026-09", "paid", { paidAmount: 1_200_000 });
  const cancelled = await inv(T.id, C.id, "2026-10", "cancelled");
  const other = await inv(T2.id, C.id, "2026-09", "sent");
  const zalo = (id: string, body: unknown, as = T) => api("POST", `/api/tutor/invoices/${id}/zalo`, { as, body });

  section("Quyền và đầu vào");
  check("chưa đăng nhập → 401", (await api("POST", `/api/tutor/invoices/${sent.id}/zalo`, { body: { action: "prepare", target: "private" } })).status === 401);
  check("học sinh → bị chặn", [401, 403].includes((await zalo(sent.id, { action: "prepare", target: "private" }, A)).status));
  check("phiếu của gia sư khác → 404", (await zalo(other.id, { action: "prepare", target: "private" })).status === 404);
  check("phiếu không có → 404", (await zalo("khong-co", { action: "prepare", target: "private" })).status === 404);
  check("action lạ → 400", (await zalo(sent.id, { action: "xyz" })).status === 400);
  check("target lạ → 400", (await zalo(sent.id, { action: "prepare", target: "all" })).status === 400);
  check("body rỗng → 400", (await api("POST", `/api/tutor/invoices/${sent.id}/zalo`, { as: T, raw: "không phải json", headers: { "content-type": "application/json" } })).status === 400);

  section("Chỉ gửi được phiếu đã gửi cho phụ huynh");
  for (const [name, row, frag] of [["nháp", draft, "Gửi phiếu"], ["đã đóng đủ", paid, "đã đóng đủ"], ["đã huỷ", cancelled, "huỷ"]] as const) {
    const r = await zalo(row.id, { action: "prepare", target: "private" });
    check(`${name} → 409 kèm lý do`, r.status === 409 && String(r.json?.error).includes(frag), r.json);
    const o = await zalo(row.id, { action: "opened" });
    check(`${name} → không ghi 'đã mở Zalo'`, o.status === 409 && (await prisma.tuitionInvoice.findUnique({ where: { id: row.id } }))?.zaloOpenedAt === null);
    check(`${name} → không cấp link`, (await prisma.tuitionInvoice.findUnique({ where: { id: row.id } }))?.viewToken === null);
  }

  section("Chat riêng: cấp link 30 ngày, dùng lại link còn hạn");
  const t0 = Date.now();
  const p1 = await zalo(sent.id, { action: "prepare", target: "private" });
  check("200 + đường dẫn /phieu/<32 hex>", p1.status === 200 && hex32.test(p1.json?.path), p1.json);
  check("số điện thoại, tên con, tháng, số tiền còn lại", p1.json?.phone === "0901234567" && p1.json?.studentName === "Minh Anh" && p1.json?.yearMonth === "2026-10" && p1.json?.amount === 1_200_000 && p1.json?.parentName === "Hoa");
  const exp1 = new Date(p1.json.expiresAt).getTime();
  check("hạn ≈ 30 ngày", Math.abs(exp1 - (t0 + 30 * DAY)) < 60_000, p1.json?.expiresAt);
  let row = await prisma.tuitionInvoice.findUnique({ where: { id: sent.id } });
  check("DB lưu token + hạn khớp", `/phieu/${row?.viewToken}` === p1.json.path && row?.viewTokenExpiresAt?.getTime() === exp1);
  const p2 = await zalo(sent.id, { action: "prepare", target: "private" });
  check("bấm lại: dùng lại đúng link cũ, hạn không gia hạn", p2.json?.path === p1.json.path && p2.json?.expiresAt === p1.json.expiresAt);
  const pp = await zalo(partial.id, { action: "prepare", target: "private" });
  check("đóng một phần: số tiền = còn lại (700.000)", pp.status === 200 && pp.json?.amount === 700_000, pp.json);
  const pr = await zalo(reported.id, { action: "prepare", target: "private" });
  check("phụ huynh đã báo chuyển: vẫn gửi lại được", pr.status === 200 && hex32.test(pr.json?.path));
  const noPhone = await inv(T.id, C.id, "2026-07", "sent");
  const pn = await zalo(noPhone.id, { action: "prepare", target: "private" });
  check("chưa có SĐT phụ huynh → phone null (giao diện báo chép tin)", pn.status === 200 && pn.json?.phone === null);

  section("Hai lần bấm cùng lúc không làm link vừa cấp bị chết");
  const fresh = await inv(T.id, B.id, "2026-06", "sent");
  const burst = await Promise.all(Array.from({ length: 6 }, () => zalo(fresh.id, { action: "prepare", target: "private" })));
  const paths = new Set(burst.map(b => b.json?.path));
  check("6 yêu cầu song song → cùng một link", burst.every(b => b.status === 200) && paths.size === 1, [...paths]);

  section("Link hết hạn thì cấp link mới");
  const oldTok = row!.viewToken!;
  await prisma.tuitionInvoice.update({ where: { id: sent.id }, data: { viewTokenExpiresAt: new Date(Date.now() - 1000) } });
  const p3 = await zalo(sent.id, { action: "prepare", target: "private" });
  check("hết hạn → link mới khác link cũ, hạn mới 30 ngày", p3.status === 200 && p3.json.path !== `/phieu/${oldTok}` && Math.abs(new Date(p3.json.expiresAt).getTime() - (Date.now() + 30 * DAY)) < 60_000, p3.json);
  check("link cũ không còn tìm thấy", (await page(oldTok)).status === 404);

  section("Nhóm Zalo lớp: không link");
  const g = await zalo(reported.id, { action: "prepare", target: "group" });
  check("nhóm → path null, phone null, hạn null", g.status === 200 && g.json?.path === null && g.json?.phone === null && g.json?.expiresAt === null, g.json);
  const gInv = await inv(T.id, A.id, "2026-05", "sent");
  const g2 = await zalo(gInv.id, { action: "prepare", target: "group" });
  check("nhóm KHÔNG cấp token (ai trong nhóm cũng mở được link)", g2.status === 200 && (await prisma.tuitionInvoice.findUnique({ where: { id: gInv.id } }))?.viewToken === null);

  section("'Đã mở Zalo lúc' (không bao giờ 'đã gửi')");
  check("trước khi mở: zaloOpenedAt rỗng", (await prisma.tuitionInvoice.findUnique({ where: { id: sent.id } }))?.zaloOpenedAt === null);
  const o1 = await zalo(sent.id, { action: "opened" });
  row = await prisma.tuitionInvoice.findUnique({ where: { id: sent.id } });
  check("ghi thời điểm mở", o1.status === 200 && !!o1.json?.openedAt && row?.zaloOpenedAt !== null && Math.abs(row!.zaloOpenedAt!.getTime() - Date.now()) < 10_000);
  check("không đổi trạng thái phiếu (vẫn 'sent')", row?.status === "sent");
  check("gia sư khác không ghi được", (await zalo(other.id, { action: "opened" })).status === 404 && (await prisma.tuitionInvoice.findUnique({ where: { id: other.id } }))?.zaloOpenedAt === null);

  section("Danh sách phiếu trả hai mốc thời gian");
  const list = await api("GET", "/api/tutor/invoices?yearMonth=2026-10", { as: T });
  const li = list.json?.items?.find((x: any) => x.id === sent.id);
  check("zaloOpenedAt có giá trị, parentViewedAt null", !!li?.zaloOpenedAt && li?.parentViewedAt === null, li);
  check("phiếu chưa mở: cả hai null", list.json?.items?.find((x: any) => x.id === draft.id)?.zaloOpenedAt === null);

  section("Trang công khai /phieu/[token]");
  const tok = (await prisma.tuitionInvoice.findUnique({ where: { id: sent.id } }))!.viewToken!;
  const pg = await page(tok);
  check("200, có tên con, mã phiếu và số tiền", pg.status === 200 && pg.html.includes("Minh Anh") && pg.html.includes(sent.code) && /1\.200\.000/.test(pg.html));
  check("QR + STK của GIA SƯ (không phải KiN)", /img\.vietqr\.io/.test(pg.html) && pg.html.includes("0123456789") && pg.html.includes("NGUYEN VAN LAN"));
  const meta = (pg.html.match(/<head>[\s\S]*?<\/head>/)?.[0] ?? "") + (pg.html.match(/<meta[^>]*>/g) ?? []).join("");
  check("noindex", /robots[^>]*noindex|noindex[^>]*robots/.test(meta), meta.slice(0, 300));
  const og = (pg.html.match(/<meta[^>]+(?:property="og:|name="description")[^>]*>/g) ?? []).join(" ");
  check("thẻ xem trước chỉ có chữ chung: có og:title, KHÔNG tên con / số tiền / mã phiếu", /og:title/.test(og) && !/Minh Anh|1\.200|1200000|KIN[A-Z0-9]{5}/.test(og + (pg.html.match(/<title>[^<]*<\/title>/)?.[0] ?? "")), og);
  check("mở trang (kể cả bot xem trước) KHÔNG đánh dấu đã xem", (await prisma.tuitionInvoice.findUnique({ where: { id: sent.id } }))?.parentViewedAt === null);
  check("token sai dạng → 404", (await page("abc")).status === 404 && (await page("g".repeat(32))).status === 404);
  check("token không tồn tại → 404", (await page("0".repeat(32))).status === 404);

  section("'Phụ huynh đã xem' chỉ ghi từ trình duyệt thật");
  const v1 = await api("POST", `/api/phieu/${tok}/viewed`);
  check("lần đầu: first=true", v1.status === 200 && v1.json?.first === true, v1.json);
  const seen = (await prisma.tuitionInvoice.findUnique({ where: { id: sent.id } }))?.parentViewedAt;
  check("ghi mốc xem", !!seen && Math.abs(seen.getTime() - Date.now()) < 10_000);
  const v2 = await api("POST", `/api/phieu/${tok}/viewed`);
  check("lần sau: first=false, mốc đầu giữ nguyên", v2.json?.first === false && (await prisma.tuitionInvoice.findUnique({ where: { id: sent.id } }))?.parentViewedAt?.getTime() === seen!.getTime());
  check("token lạ → 404 / sai dạng → 404", (await api("POST", `/api/phieu/abc/viewed`)).status === 404);
  const listAfter = await api("GET", "/api/tutor/invoices?yearMonth=2026-10", { as: T });
  check("danh sách của gia sư giờ có parentViewedAt", !!listAfter.json?.items?.find((x: any) => x.id === sent.id)?.parentViewedAt);

  section("Phụ huynh bấm 'Tôi đã chuyển' trên trang riêng");
  const rp = await api("POST", `/api/phieu/${tok}/reported`);
  row = await prisma.tuitionInvoice.findUnique({ where: { id: sent.id } });
  check("→ parent_reported + mốc báo", rp.status === 200 && row?.status === "parent_reported" && !!row?.parentReportedAt, rp.json);
  const rp2 = await api("POST", `/api/phieu/${tok}/reported`);
  check("bấm lại: idempotent (alreadyReported)", rp2.status === 200 && rp2.json?.alreadyReported === true);
  check("token sai → 404", (await api("POST", `/api/phieu/abc/reported`)).status === 404 && (await api("POST", `/api/phieu/${"0".repeat(32)}/reported`)).status === 404);

  section("Hết hạn / huỷ / nháp");
  const exInv = await inv(T.id, C.id, "2026-04", "sent");
  const exTok = "e".repeat(32);
  await prisma.tuitionInvoice.update({ where: { id: exInv.id }, data: { viewToken: exTok, viewTokenExpiresAt: new Date(Date.now() - DAY) } });
  const ex = await page(exTok);
  check("hết hạn → trang báo 'Link đã hết hạn', KHÔNG lộ tên con / số tiền", ex.status === 200 && ex.html.includes("Link đã hết hạn") && !ex.html.includes("Chi Chi") && !/1\.200\.000/.test(ex.html));
  const exR = await api("POST", `/api/phieu/${exTok}/reported`);
  check("hết hạn: không báo chuyển được (410) và không đổi phiếu", exR.status === 410 && (await prisma.tuitionInvoice.findUnique({ where: { id: exInv.id } }))?.status === "sent");
  const exV = await api("POST", `/api/phieu/${exTok}/viewed`);
  check("hết hạn: không ghi đã xem", exV.json?.first === false && (await prisma.tuitionInvoice.findUnique({ where: { id: exInv.id } }))?.parentViewedAt === null);
  // gia sư huỷ sau khi đã gửi link
  const cTok = "c".repeat(32);
  await prisma.tuitionInvoice.update({ where: { id: cancelled.id }, data: { viewToken: cTok, viewTokenExpiresAt: new Date(Date.now() + DAY) } });
  const cp = await page(cTok);
  check("đã huỷ → 'Phiếu đã được huỷ', không lộ số tiền", cp.status === 200 && cp.html.includes("Phiếu đã được huỷ") && !/1\.200\.000/.test(cp.html));
  check("đã huỷ: không báo chuyển được (409)", (await api("POST", `/api/phieu/${cTok}/reported`)).status === 409);
  const dTok = "d".repeat(32);
  await prisma.tuitionInvoice.update({ where: { id: draft.id }, data: { viewToken: dTok, viewTokenExpiresAt: new Date(Date.now() + DAY) } });
  check("nháp (chưa gửi cho phụ huynh) → 404", (await page(dTok)).status === 404);

  section("Phiếu đã đóng đủ vẫn xem được trong hạn");
  const paidTok = "a".repeat(32);
  await prisma.tuitionInvoice.update({ where: { id: paid.id }, data: { viewToken: paidTok, viewTokenExpiresAt: new Date(Date.now() + DAY) } });
  const pd = await page(paidTok);
  check("đã đóng → hiện 'Đã đóng', không còn QR", pd.status === 200 && pd.html.includes("Đã đóng") && !/img\.vietqr\.io/.test(pd.html));

  done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
