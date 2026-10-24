// HP-28 — API: gợi ý "phí trễ hạn" trên phiếu quá hạn của gia sư. CHỈ gợi ý hiển thị: không cộng tiền, không dòng phí, không đổi phiếu.
// Cần máy chủ dev đang chạy (BASE).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { api, mkUser, mkTutor, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { addDaysKey, vnDateKeyOf } from "@/lib/classSessions";
import { LATE_FEE_HINT_TEXT, lateFeeHintKey } from "@/lib/lateFeeHint";

const walk = (d: string): string[] => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? (f === "generated" ? [] : walk(p)) : [p]; });

(async () => {
  await wipe();
  const T1 = await mkTutor("Cô Lan"), T2 = await mkTutor("Thầy Minh");
  const S = await mkUser({ name: "Em An" }), S2 = await mkUser({ name: "Em Bình" }), S3 = await mkUser({ name: "Em Chi" }), S4 = await mkUser({ name: "Em Dũng" });
  const today = vnDateKeyOf(new Date());
  const ym = today.slice(0, 7);
  const mkInv = (tutorId: string, studentId: string, o: { status?: string; dueDate?: string | null; paid?: number } = {}) => prisma.tuitionInvoice.create({
    data: { code: `KINT${Math.random().toString(36).slice(2, 7).toUpperCase()}`, tutorId, studentId, yearMonth: ym, amountDue: 800_000, paidAmount: o.paid ?? 0, status: o.status ?? "sent", dueDate: o.dueDate === undefined ? null : o.dueDate },
  });
  const over = await mkInv(T1.id, S.id, { dueDate: addDaysKey(today, -4) });          // quá hạn 4 ngày, còn nợ
  const notYet = await mkInv(T1.id, S2.id, { dueDate: addDaysKey(today, 5) });         // chưa tới hạn
  const noDue = await mkInv(T1.id, S3.id, { dueDate: null });                          // chưa đặt hạn
  const paid = await mkInv(T1.id, S4.id, { status: "paid", paid: 800_000, dueDate: addDaysKey(today, -10) }); // đã thu đủ
  const other = await mkInv(T2.id, S.id, { dueDate: addDaysKey(today, -2) });          // phiếu của gia sư khác
  const snap = async () => JSON.stringify({
    inv: (await prisma.tuitionInvoice.findMany({ orderBy: { code: "asc" } })).map(i => [i.id, i.amountDue, i.paidAmount, i.status, i.dueDate, i.updatedAt.toISOString()]),
    charges: await prisma.feeCharge.count(),
  });
  const list = async (as = T1) => (await api("GET", `/api/tutor/invoices?yearMonth=${ym}`, { as })).json;
  const hint = (j: any, id: string) => j.items.find((i: any) => i.id === id)?.lateFeeHint;

  section("Mặc định (chưa cấu hình) = bật; chỉ phiếu còn nợ và QUÁ HẠN có gợi ý");
  const before = await snap();
  const j0 = await list();
  check("phản hồi báo gợi ý đang bật", j0.lateFeeHintEnabled === true);
  check("phiếu quá hạn còn nợ → có gợi ý", hint(j0, over.id) === true);
  check("chưa tới hạn / chưa đặt hạn / đã thu đủ → KHÔNG gợi ý", hint(j0, notYet.id) === false && hint(j0, noDue.id) === false && hint(j0, paid.id) === false);
  check("số còn lại của phiếu quá hạn vẫn 800.000 (không cộng gì); tóm tắt quá hạn không đổi nghĩa", j0.items.find((i: any) => i.id === over.id).remaining === 800_000 && j0.summary.overdueCount === 1 && j0.summary.overdueRemaining === 800_000);
  check("TIỀN: đọc danh sách không đổi phiếu nào, không tạo dòng phí", (await snap()) === before);
  check("chữ gợi ý đúng câu chủ duyệt và nói rõ KiN không tự cộng", LATE_FEE_HINT_TEXT.includes("KiN không tự cộng tiền") && !/\d/.test(LATE_FEE_HINT_TEXT));

  section("Gia sư tắt/bật; mỗi gia sư một cờ riêng");
  check("GET cờ → bật", (await api("GET", "/api/tutor/late-fee-hint", { as: T1 })).json.enabled === true);
  const off = await api("PUT", "/api/tutor/late-fee-hint", { as: T1, body: { enabled: false } });
  check("tắt → 200, lưu setting_kv đúng khoá của gia sư", off.status === 200 && off.json.enabled === false && (await prisma.settingKV.findUnique({ where: { key: lateFeeHintKey(T1.id) } }))?.value === "0");
  const j1 = await list();
  check("tắt → mọi phiếu không gợi ý, lateFeeHintEnabled=false", j1.lateFeeHintEnabled === false && j1.items.every((i: any) => i.lateFeeHint === false));
  check("gia sư KHÁC không bị ảnh hưởng: phiếu quá hạn của Thầy Minh vẫn có gợi ý", hint(await list(T2), other.id) === true);
  check("TIỀN: bật/tắt không đổi phiếu / dòng phí", (await snap()) === before);
  const on = await api("PUT", "/api/tutor/late-fee-hint", { as: T1, body: { enabled: true } });
  check("bật lại → gợi ý trở lại", on.status === 200 && hint(await list(), over.id) === true);

  section("Quyền và đầu vào xấu");
  check("chưa đăng nhập → 401", (await api("GET", "/api/tutor/late-fee-hint")).status === 401 && (await api("PUT", "/api/tutor/late-fee-hint", { body: { enabled: false } })).status === 401);
  check("học sinh → 403, không ghi cờ", (await api("PUT", "/api/tutor/late-fee-hint", { as: S, body: { enabled: false } })).status === 403 && (await prisma.settingKV.count({ where: { key: lateFeeHintKey(S.id) } })) === 0);
  check("[phá] enabled không phải đúng-sai → 400, cờ không đổi", (await api("PUT", "/api/tutor/late-fee-hint", { as: T1, body: { enabled: "0" } })).status === 400 && (await api("PUT", "/api/tutor/late-fee-hint", { as: T1, body: {} })).status === 400 && hint(await list(), over.id) === true);
  check("nhật ký có, KHÔNG chứa tên em", !!(await prisma.auditLog.findFirst({ where: { action: "invoice.late_fee_hint" } })) && !(await prisma.auditLog.findMany({ where: { action: "invoice.late_fee_hint" } })).some(a => JSON.stringify(a).includes("Em An")));

  section("Chỉ hiện ở màn gia sư: không chữ gợi ý nào ở phía phụ huynh / học sinh / tin Zalo");
  const users = walk("src").filter(f => /\.(ts|tsx)$/.test(f)).filter(f => readFileSync(f, "utf8").includes("lateFeeHint") || readFileSync(f, "utf8").includes("LATE_FEE_HINT_TEXT"));
  const allowed = ["src/lib/lateFeeHint.ts", "src/lib/invoiceReminderServer.ts", "src/app/api/tutor/invoices/route.ts", "src/app/api/tutor/late-fee-hint/route.ts", "src/app/lop-cua-toi/(tutor)/hoc-phi/InvoicesTab.tsx"];
  check("chỉ năm tệp (lib, hai route của gia sư, tab Phiếu của gia sư) dùng gợi ý", users.length === allowed.length && allowed.every(a => users.includes(a)), users);
  check("không câu 'tự cộng/ tự thu phí trễ hạn' nào hứa tiền ngoài câu gợi ý", !walk("src").filter(f => /\.(ts|tsx)$/.test(f)).some(f => /tự (cộng|tính|thu) phí trễ hạn/i.test(readFileSync(f, "utf8"))));
  await done();
})();
