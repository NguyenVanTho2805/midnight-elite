import {
  generateInvoiceCode, isInvoiceCode, INVOICE_CODE_ALPHABET, stripDiacritics, buildTransferContent, extractInvoiceCode,
  classifyPayment, canAutoApply, suggestInvoices, statusAfterPayment, remainingOf, parseSepayDate, parseSepayPayload,
  generateWebhookKey, hashWebhookKey, extractApiKey, verifyWebhookKey, validatePayoutAccount, buildInvoiceQrUrl,
} from "@/lib/tuitionInvoice";
import { check, section, done } from "./h";

section("Mã phiếu");
const codes = new Set<string>();
for (let i = 0; i < 5000; i++) codes.add(generateInvoiceCode());
check("5000 mã đều hợp lệ KIN + 5 ký tự", [...codes].every(isInvoiceCode));
check("không bao giờ chứa O, I, L, 0, 1", ![...codes].some(c => /[OIL01]/.test(c.slice(3))));
check("alphabet đúng 31 ký tự (23 chữ + 8 số)", INVOICE_CODE_ALPHABET.length === 31 && new Set(INVOICE_CODE_ALPHABET).size === 31);
check("5000 mã gần như không trùng (≥ 4990 duy nhất)", codes.size >= 4990, codes.size);
check("isInvoiceCode loại mã sai", !isInvoiceCode("KIN7B2K") && !isInvoiceCode("KIN7B2KO") && !isInvoiceCode("kin7b2k9") && !isInvoiceCode(null));

section("Nội dung chuyển khoản");
check("bỏ dấu + hoa + giữ mã ở đầu", buildTransferContent("KIN7B2K9", "Trần Gia Bảo") === "KIN7B2K9 TRAN GIA BAO");
check("đ/Đ → D", buildTransferContent("KIN7B2K9", "Đỗ Hà") === "KIN7B2K9 DO HA", buildTransferContent("KIN7B2K9", "Đỗ Hà"));
check("ký tự đặc biệt bị bỏ", buildTransferContent("KIN7B2K9", "Nguyễn O'Brien-Lê (lớp 9)") === "KIN7B2K9 NGUYEN O BRIEN LE LOP 9");
const long = buildTransferContent("KIN7B2K9", "Nguyễn Thị Phương Anh Thư Khánh Linh Bảo Châu Ngọc Hà Vy");
check("cắt ≤ 50 ký tự, không kết thúc bằng khoảng trắng", long.length <= 50 && !long.endsWith(" ") && long.startsWith("KIN7B2K9 "), long);
check("tên rỗng → chỉ có mã", buildTransferContent("KIN7B2K9", "   ") === "KIN7B2K9");

section("Trích mã từ SePay");
check("ưu tiên trường code của SePay", extractInvoiceCode("KIN7B2K9", "CK linh tinh") === "KIN7B2K9");
check("code SePay sai định dạng → rơi về content", extractInvoiceCode("ABC", "KIN7B2K9 TRAN GIA BAO") === "KIN7B2K9");
check("content: có khoảng trắng sau KIN", extractInvoiceCode(null, "chuyen khoan KIN 7B2K9 hoc phi") === "KIN7B2K9");
check("content: không phân biệt hoa/thường", extractInvoiceCode(null, "kin7b2k9 tran gia bao") === "KIN7B2K9");
check("content: tên dán liền sau mã vẫn lấy đúng 5 ký tự", extractInvoiceCode(null, "KIN7B2K9TRANGIABAO") === "KIN7B2K9");
check("không bắt trúng giữa một từ (…HKINH2W2W)", extractInvoiceCode(null, "THANHKINH2W2W") === null);
check("không có mã → null", extractInvoiceCode(null, "CK HOC PHI CHO CON") === null && extractInvoiceCode(null, "") === null && extractInvoiceCode(undefined, undefined) === null);
check("ký tự O/I/L/0/1 không phải mã (KIN10OIL)", extractInvoiceCode(null, "KIN10OIL") === null);
check("'KIN DUNG' (từ thường) không bị nhận nhầm", extractInvoiceCode(null, "KIN DUNG HOC PHI") === null);

section("Phân loại giao dịch (bảng mục 3 của spec)");
const inv = (status: string, due = 336_000, paid = 0) => ({ id: "i", status, amountDue: due, paidAmount: paid });
check("khớp đủ → exact", classifyPayment({ amount: 336_000, code: "KINX", invoice: inv("sent") }) === "exact");
check("thiếu → short", classifyPayment({ amount: 300_000, code: "KINX", invoice: inv("sent") }) === "short");
check("dư → over", classifyPayment({ amount: 1_100_000, code: "KINX", invoice: inv("sent", 1_055_000) }) === "over");
check("phiếu đã đóng → already_paid", classifyPayment({ amount: 336_000, code: "KINX", invoice: inv("paid", 336_000, 336_000) }) === "already_paid");
check("phiếu huỷ → cancelled", classifyPayment({ amount: 336_000, code: "KINX", invoice: inv("cancelled") }) === "cancelled");
check("có mã nhưng không thuộc gia sư (invoice=null) → unknown_code", classifyPayment({ amount: 1, code: "KINX", invoice: null }) === "unknown_code");
check("không mã → no_code", classifyPayment({ amount: 434_000, code: null, invoice: null }) === "no_code");
check("đóng một phần: phần còn lại 36.000 → exact với 36.000", classifyPayment({ amount: 36_000, code: "K", invoice: inv("partial", 336_000, 300_000) }) === "exact");
check("còn lại = 0 dù status chưa đổi → already_paid", classifyPayment({ amount: 10, code: "K", invoice: inv("partial", 100, 100) }) === "already_paid");

section("Chỉ tự gạch khi chắc chắn");
check("exact + sent → tự gạch", canAutoApply("exact", "sent"));
check("exact + partial/parent_reported → tự gạch", canAutoApply("exact", "partial") && canAutoApply("exact", "parent_reported"));
check("exact + draft → KHÔNG tự gạch", !canAutoApply("exact", "draft"));
check("short/over/no_code/unknown_code/already_paid/cancelled → KHÔNG", (["short", "over", "no_code", "unknown_code", "already_paid", "cancelled"] as const).every(k => !canAutoApply(k, "sent")));
check("exact nhưng không có phiếu → KHÔNG", !canAutoApply("exact", null));

section("Gợi ý (không tự ghép)");
const open = [inv("sent", 434_000), { ...inv("partial", 500_000, 66_000), id: "j" }, { ...inv("paid", 434_000, 434_000), id: "k" }, { ...inv("draft", 434_000), id: "d" }];
const sug = suggestInvoices(434_000, open);
check("gợi ý mọi phiếu CHƯA ĐÓNG cùng số còn lại (cả nháp); bỏ phiếu đã đóng", sug.length === 3 && sug.map(x => x.id).sort().join() === "d,i,j", sug);
check("phiếu đã huỷ không được gợi ý", suggestInvoices(1, [{ id: "c", status: "cancelled", amountDue: 1, paidAmount: 0 }]).length === 0);
check("không có phiếu cùng số tiền → rỗng", suggestInvoices(999, open).length === 0);

section("Trạng thái sau khi nhận tiền");
check("đủ → paid", statusAfterPayment(100, 100, "sent") === "paid");
check("thiếu → partial", statusAfterPayment(100, 30, "sent") === "partial");
check("chưa nhận → giữ trạng thái", statusAfterPayment(100, 0, "parent_reported") === "parent_reported");
check("remainingOf không âm", remainingOf({ amountDue: 100, paidAmount: 150 }) === 0);

section("SePay payload");
check("giờ VN: 2026-10-01 20:14:00 = 13:14 UTC", parseSepayDate("2026-10-01 20:14:00")?.toISOString() === "2026-10-01T13:14:00.000Z");
check("định dạng sai → null", parseSepayDate("01/10/2026") === null && parseSepayDate(5) === null);
const okP = parseSepayPayload({ id: 92704, gateway: "MBBank", transactionDate: "2026-10-01 20:14:00", accountNumber: "0123", code: "KIN7B2K9", content: "KIN7B2K9 TRAN GIA BAO", transferType: "in", transferAmount: 300000, accumulated: 19077000, referenceCode: "FT26", description: "x" }) as any;
check("hợp lệ: lấy đủ trường, id thành chuỗi", okP.tx?.id === "92704" && okP.tx.amount === 300000 && okP.tx.code === "KIN7B2K9" && okP.tx.gateway === "MBBank", okP);
check("KHÔNG mang theo số dư (accumulated)", !JSON.stringify(okP).includes("19077000"));
check("tiền ra (out) → bỏ qua", (parseSepayPayload({ id: 1, transferType: "out", transferAmount: 5 }) as any).ignore === true);
check("thiếu id → lỗi", "error" in (parseSepayPayload({ transferType: "in", transferAmount: 5 }) as any));
check("số tiền 0 / âm / lẻ / chuỗi → lỗi", [0, -5, 10.5, "300000"].every(v => "error" in (parseSepayPayload({ id: 1, transferType: "in", transferAmount: v }) as any)));
check("payload không phải object → lỗi", "error" in (parseSepayPayload(null) as any) && "error" in (parseSepayPayload("x") as any));
check("content rỗng nhưng có description → dùng description", (parseSepayPayload({ id: 1, transferType: "in", transferAmount: 5, description: "KIN7B2K9" }) as any).tx.content === "KIN7B2K9");

section("Khoá webhook");
const key = generateWebhookKey(), h = hashWebhookKey(key);
check("khoá có tiền tố kin_ + 48 hex; băm sha256 64 hex", /^kin_[0-9a-f]{48}$/.test(key) && /^[0-9a-f]{64}$/.test(h));
check("băm không chứa khoá gốc", !h.includes(key));
check("Apikey/Bearer đều đọc được", extractApiKey(`Apikey ${key}`) === key && extractApiKey(`Bearer ${key}`) === key && extractApiKey(`apikey ${key}`) === key);
check("header rác → null", extractApiKey("Basic abc") === null && extractApiKey("") === null && extractApiKey(null) === null);
check("đúng khoá → true", verifyWebhookKey(key, h));
check("sai khoá / thiếu / hash rỗng → false", !verifyWebhookKey("kin_sai", h) && !verifyWebhookKey(null, h) && !verifyWebhookKey(key, null) && !verifyWebhookKey(key, "zz"));

section("Tài khoản nhận tiền + QR");
const v = validatePayoutAccount({ bankBin: "970436", accountNo: " 0123 456 789 ", accountName: "Nguyễn Thị Lan" }) as any;
check("hợp lệ: bỏ khoảng trắng số TK, tên in hoa không dấu", v.ok && v.value.accountNo === "0123456789" && v.value.accountName === "NGUYEN THI LAN", v);
check("BIN sai → lỗi", !(validatePayoutAccount({ bankBin: "97043", accountNo: "123456", accountName: "AB" }) as any).ok);
check("số TK có chữ → lỗi", !(validatePayoutAccount({ bankBin: "970436", accountNo: "12ab56", accountName: "AB" }) as any).ok);
check("tên 1 ký tự → lỗi", !(validatePayoutAccount({ bankBin: "970436", accountNo: "123456", accountName: "A" }) as any).ok);
const qr = buildInvoiceQrUrl(v.value, { amount: 36_000.9, addInfo: "KIN7B2K9 TRAN GIA BAO" });
check("QR: số tiền đúng đến đồng (cắt phần lẻ), addInfo + tên chủ TK", qr.includes("/970436-0123456789-compact2.png") && qr.includes("amount=36000") && qr.includes("addInfo=KIN7B2K9+TRAN+GIA+BAO") && qr.includes("accountName=NGUYEN+THI+LAN"), qr);
check("QR: số tiền âm → 0", buildInvoiceQrUrl(v.value, { amount: -5, addInfo: "X" }).includes("amount=0"));
check("stripDiacritics cơ bản", stripDiacritics("Phạm Minh Đức") === "Pham Minh Duc");
done();
