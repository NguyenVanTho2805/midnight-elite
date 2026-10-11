// TT-200 — logic thuần cho phiếu học phí + đối soát VietQR. Không import Prisma
// để test được và dùng chung server/client.
// Spec: docs/kin/nghiep-vu/doi-soat-vietqr.md (bản 01/10/2026, anh Thanh chốt
// 02/10: giai đoạn đầu KiN chưa thu phí gia sư → dựng được; KiN đứng ngoài dòng
// tiền: không giữ, không thu hộ, chỉ ĐỌC tiền vào).
//
// Hai quy tắc cứng:
//   - Chỉ tự gạch phiếu khi có mã phiếu VÀ đúng số tiền còn lại. Mọi trường
//     hợp khác vào hàng chờ cho gia sư bấm quyết.
//   - Không bao giờ tự ghép theo số tiền (GD-20) — chỉ GỢI Ý.

import { createHash, randomInt, timingSafeEqual, randomBytes } from "node:crypto";

// ─── Mã phiếu ────────────────────────────────────────────────────────────────
// "KIN" + 5 ký tự lấy từ A–Z và 2–9, bỏ O, I, L (dễ nhầm với 0, 1). 31^5 ≈ 28,6 triệu.
export const INVOICE_CODE_PREFIX = "KIN";
export const INVOICE_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // 31 ký tự
export const INVOICE_CODE_RE = /^KIN[A-HJKMNP-Z2-9]{5}$/;

export function generateInvoiceCode(): string {
  let s = INVOICE_CODE_PREFIX;
  // randomInt: chọn đều, không thiên lệch modulo như randomBytes % n.
  for (let i = 0; i < 5; i++) s += INVOICE_CODE_ALPHABET[randomInt(INVOICE_CODE_ALPHABET.length)];
  return s;
}

export function isInvoiceCode(s: unknown): s is string {
  return typeof s === "string" && INVOICE_CODE_RE.test(s);
}

// Bỏ dấu tiếng Việt: NFD rồi bỏ dấu kết hợp; đ/Đ không tách được bằng NFD.
export function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
}

// Nội dung chuyển khoản = mã + " " + tên em không dấu, VIẾT HOA, cắt ≤ 50 ký tự
// (giới hạn addInfo của VietQR, không ký tự đặc biệt). Tên chỉ để gia sư dễ nhìn
// trên sao kê; xoá tên không sao, xoá mã thì giao dịch vào hàng chờ.
export const TRANSFER_CONTENT_MAX = 50;
export function buildTransferContent(code: string, studentName: string): string {
  const name = stripDiacritics(studentName).toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  return (name ? `${code} ${name}` : code).slice(0, TRANSFER_CONTENT_MAX).trimEnd();
}

// Tìm mã phiếu: ưu tiên trường `code` SePay đã tách sẵn; không có thì tìm trong
// nội dung theo mẫu `KIN ?[A-HJKMNP-Z2-9]{5}` (chấp nhận 1 khoảng trắng sau KIN,
// không phân biệt hoa thường). Chỉ cần ranh giới ĐẰNG TRƯỚC (tránh bắt trúng
// giữa một từ như "…HKINH2W2W"): ngân hàng có thể dán liền tên vào sau mã.
const CONTENT_CODE_RE = /(?<![A-Z0-9])KIN ?([A-HJKMNP-Z2-9]{5})/i;
export function extractInvoiceCode(providerCode: string | null | undefined, content: string | null | undefined): string | null {
  if (providerCode) {
    const c = providerCode.trim().toUpperCase().replace(/\s+/g, "");
    if (INVOICE_CODE_RE.test(c)) return c;
  }
  if (content) {
    const m = CONTENT_CODE_RE.exec(content.toUpperCase());
    if (m) return `${INVOICE_CODE_PREFIX}${m[1]}`;
  }
  return null;
}

// ─── Trạng thái & phân loại ──────────────────────────────────────────────────
export const INVOICE_STATUS = {
  DRAFT: "draft", SENT: "sent", PARENT_REPORTED: "parent_reported",
  PARTIAL: "partial", PAID: "paid", CANCELLED: "cancelled",
} as const;
export type InvoiceStatus = (typeof INVOICE_STATUS)[keyof typeof INVOICE_STATUS];

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: "Nháp", sent: "Đã gửi", parent_reported: "Phụ huynh báo đã chuyển",
  partial: "Đóng một phần", paid: "Đã đóng", cancelled: "Đã huỷ",
};

// Phiếu mà phụ huynh/học viên được thấy (nháp và đã huỷ thì không).
export const PARENT_VISIBLE_STATUSES: InvoiceStatus[] = ["sent", "parent_reported", "partial", "paid"];
// Phiếu còn nhận tiền được.
export const OPEN_STATUSES: InvoiceStatus[] = ["sent", "parent_reported", "partial"];
// Phiếu chưa đóng đủ (kể cả nháp) — dùng để GỢI Ý khi tiền vào không có mã.
export const UNPAID_STATUSES: InvoiceStatus[] = ["draft", "sent", "parent_reported", "partial"];

export function remainingOf(inv: { amountDue: number; paidAmount: number }): number {
  return Math.max(0, inv.amountDue - inv.paidAmount);
}

export type TxKind = "exact" | "short" | "over" | "already_paid" | "cancelled" | "unknown_code" | "no_code";

export const TX_KIND_LABEL: Record<TxKind, string> = {
  exact: "Khớp đủ", short: "Đóng thiếu", over: "Đóng dư", already_paid: "Phiếu đã đóng — có thể chuyển trùng",
  cancelled: "Phiếu đã huỷ", unknown_code: "Mã không thuộc gia sư này", no_code: "Không có mã",
};

export interface InvoiceLite { id: string; status: string; amountDue: number; paidAmount: number }

// Phân loại 1 khoản tiền vào. `invoice` = phiếu tìm được theo mã trong phạm vi
// ĐÚNG gia sư (null nếu có mã nhưng không thuộc gia sư này, hoặc không có mã).
export function classifyPayment(opts: { amount: number; code: string | null; invoice: InvoiceLite | null }): TxKind {
  const { amount, code, invoice } = opts;
  if (!code) return "no_code";
  if (!invoice) return "unknown_code";
  if (invoice.status === INVOICE_STATUS.CANCELLED) return "cancelled";
  if (invoice.status === INVOICE_STATUS.PAID) return "already_paid";
  // Nháp: phụ huynh chưa thể có mã hợp lệ → coi như không chắc, để gia sư quyết.
  if (invoice.status === INVOICE_STATUS.DRAFT) return amount === remainingOf(invoice) ? "exact" : amount < remainingOf(invoice) ? "short" : "over";
  const rem = remainingOf(invoice);
  if (rem === 0) return "already_paid";
  if (amount === rem) return "exact";
  return amount < rem ? "short" : "over";
}

// Chỉ tự gạch phiếu khi: đúng mã + đúng số tiền còn lại + phiếu đang mở (đã gửi).
// Phiếu nháp dù khớp số tiền vẫn vào hàng chờ — phụ huynh chưa thể có mã hợp lệ
// nên khoản này đáng để gia sư nhìn lại.
export function canAutoApply(kind: TxKind, invoiceStatus: string | null | undefined): boolean {
  return kind === "exact" && !!invoiceStatus && (OPEN_STATUSES as string[]).includes(invoiceStatus);
}

// Gợi ý phiếu CHƯA ĐÓNG có CÙNG SỐ TIỀN còn phải đóng cho giao dịch không có mã
// (spec mục 3). Chỉ gợi ý — kể cả khi chỉ có một phiếu trùng cũng không tự ghép.
export function suggestInvoices<T extends InvoiceLite>(amount: number, invoices: T[]): T[] {
  return invoices.filter(i => (UNPAID_STATUSES as string[]).includes(i.status) && remainingOf(i) === amount);
}

// Trạng thái phiếu sau khi cộng tiền. Không tự lùi trạng thái "đã gửi".
export function statusAfterPayment(amountDue: number, paidAmount: number, current: InvoiceStatus): InvoiceStatus {
  if (paidAmount >= amountDue) return "paid";
  if (paidAmount > 0) return "partial";
  return current;
}

// ─── SePay ───────────────────────────────────────────────────────────────────
// SePay gửi transactionDate "YYYY-MM-DD HH:mm:ss" theo giờ Việt Nam.
export function parseSepayDate(s: unknown): Date | null {
  if (typeof s !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}+07:00`);
  return isNaN(d.getTime()) ? null : d;
}

export interface SepayTx {
  id: string; amount: number; content: string; code: string | null;
  referenceCode: string | null; gateway: string | null; occurredAt: Date;
}

// Chuẩn hoá & kiểm payload webhook SePay. Trả { error } nếu không dùng được.
// Chỉ nhận tiền VÀO (transferType = "in"); khoản ra trả { ignore: true }.
// KHÔNG đọc `accumulated` (số dư tài khoản của gia sư) — GD-22.
export function parseSepayPayload(body: unknown): { tx: SepayTx } | { ignore: true } | { error: string } {
  if (!body || typeof body !== "object") return { error: "Payload không hợp lệ" };
  const b = body as Record<string, unknown>;
  if (b.transferType !== "in") return { ignore: true };
  const idRaw = b.id;
  if ((typeof idRaw !== "number" && typeof idRaw !== "string") || String(idRaw).trim() === "") return { error: "Thiếu id giao dịch" };
  const id = String(idRaw).trim().slice(0, 64);
  const amt = b.transferAmount;
  if (typeof amt !== "number" || !Number.isInteger(amt) || amt <= 0 || amt > 100_000_000_000) return { error: "Số tiền không hợp lệ" };
  const occurredAt = parseSepayDate(b.transactionDate) ?? new Date();
  const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
  return {
    tx: {
      id, amount: amt, occurredAt,
      content: str(b.content, 500) ?? str(b.description, 500) ?? "",
      code: str(b.code, 64), referenceCode: str(b.referenceCode, 64), gateway: str(b.gateway, 64),
    },
  };
}

// ─── Khoá webhook ────────────────────────────────────────────────────────────
export function generateWebhookKey(): string {
  return `kin_${randomBytes(24).toString("hex")}`;
}
export function hashWebhookKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}
// SePay gửi "Authorization: Apikey <khoá>" (cũng chấp nhận Bearer).
export function extractApiKey(header: string | null): string | null {
  if (!header) return null;
  const m = /^(?:Apikey|Bearer)\s+(\S+)$/i.exec(header.trim());
  return m ? m[1] : null;
}
export function verifyWebhookKey(provided: string | null, storedHash: string | null | undefined): boolean {
  if (!provided || !storedHash) return false;
  const a = Buffer.from(hashWebhookKey(provided), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

// ─── Ngân hàng (BIN VietQR) ──────────────────────────────────────────────────
export const BANKS: Array<{ bin: string; name: string }> = [
  { bin: "970436", name: "Vietcombank" }, { bin: "970415", name: "VietinBank" }, { bin: "970418", name: "BIDV" },
  { bin: "970405", name: "Agribank" }, { bin: "970407", name: "Techcombank" }, { bin: "970422", name: "MB Bank" },
  { bin: "970416", name: "ACB" }, { bin: "970432", name: "VPBank" }, { bin: "970423", name: "TPBank" },
  { bin: "970403", name: "Sacombank" }, { bin: "970437", name: "HDBank" }, { bin: "970441", name: "VIB" },
  { bin: "970443", name: "SHB" }, { bin: "970448", name: "OCB" }, { bin: "970426", name: "MSB" },
  { bin: "970440", name: "SeABank" }, { bin: "970431", name: "Eximbank" }, { bin: "970449", name: "LPBank" },
  { bin: "970428", name: "Nam A Bank" }, { bin: "970409", name: "Bac A Bank" },
];
export const bankName = (bin: string) => BANKS.find(b => b.bin === bin)?.name ?? `Ngân hàng ${bin}`;

export function validatePayoutAccount(input: { bankBin?: unknown; accountNo?: unknown; accountName?: unknown }):
  { ok: true; value: { bankBin: string; accountNo: string; accountName: string } } | { ok: false; error: string } {
  const bankBin = typeof input.bankBin === "string" ? input.bankBin.trim() : "";
  if (!/^\d{6}$/.test(bankBin)) return { ok: false, error: "Mã ngân hàng (BIN) gồm 6 chữ số" };
  const accountNo = typeof input.accountNo === "string" ? input.accountNo.replace(/\s+/g, "") : "";
  if (!/^\d{6,19}$/.test(accountNo)) return { ok: false, error: "Số tài khoản gồm 6–19 chữ số" };
  const nameRaw = typeof input.accountName === "string" ? input.accountName : "";
  const accountName = stripDiacritics(nameRaw).toUpperCase().replace(/[^A-Z ]/g, "").replace(/\s+/g, " ").trim();
  if (accountName.length < 2 || accountName.length > 50) return { ok: false, error: "Tên chủ tài khoản 2–50 chữ cái" };
  return { ok: true, value: { bankBin, accountNo, accountName } };
}

// Link VietQR nhanh (img.vietqr.io). amount = phần còn lại, đúng đến đồng.
export function buildInvoiceQrUrl(acc: { bankBin: string; accountNo: string; accountName: string }, opts: { amount: number; addInfo: string }): string {
  const u = new URL(`https://img.vietqr.io/image/${acc.bankBin}-${acc.accountNo}-compact2.png`);
  u.searchParams.set("amount", String(Math.max(0, Math.floor(opts.amount))));
  u.searchParams.set("addInfo", opts.addInfo.slice(0, TRANSFER_CONTENT_MAX));
  u.searchParams.set("accountName", acc.accountName);
  return u.toString();
}

// SePay gói miễn phí: 50 giao dịch/tháng; KiN báo khi đã dùng 40.
export const SEPAY_FREE_LIMIT = 50;
export const SEPAY_WARN_AT = 40;
