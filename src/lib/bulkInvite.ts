// ĐX-07 (NC1-082) — "mời hàng loạt" vào lớp, phương án NHẸ. Hàm THUẦN: đọc danh sách gia sư dán vào, soạn tin Zalo từng phụ huynh.
//
// Thọ chốt Q5 (21/10): KHÔNG làm học sinh không tài khoản (đổi nền, dính dữ liệu trẻ em). Phương án nhẹ dùng đúng cơ chế mã mời của lớp đã có:
//  • MỘT mã mời của lớp, số lượt = số em dán, hiệu lực BULK_INVITE_DAYS ngày (qua POST /api/courses/[id]/invites như mã thường).
//  • Mỗi em vẫn tự tạo tài khoản và vào lớp bằng mã / link (/student/nhap-ma-lop?code=…).
//  • Tin Zalo soạn sẵn cho TỪNG phụ huynh; gia sư tự bấm "Mở Zalo" và tự gửi. KiN chỉ biết "đã mở Zalo", không biết tin có đi thật hay không.
//  • Số điện thoại phụ huynh là dữ liệu cá nhân: danh sách chỉ nằm trong trình duyệt của gia sư, KHÔNG gửi lên máy chủ và KHÔNG lưu.
import { normalizeZaloPhone } from "@/lib/zaloShare";
import { cleanText } from "@/lib/tutorArea";

export const BULK_MAX_ROWS = 50;
export const BULK_INVITE_DAYS = 14;
export const BULK_NAME_MAX = 60;
/** Chặn dán cả file khổng lồ: 50 dòng × ~100 ký tự còn xa mới tới ngưỡng này. */
export const BULK_TEXT_MAX = 20_000;

export interface BulkRow { name: string; phone: string }
export interface BulkLineError { line: number; text: string; message: string }
export interface BulkParse {
  rows: BulkRow[];
  errors: BulkLineError[];
  /** Dòng trùng hệt (cùng tên và cùng số) đã bỏ. Hai em CÙNG số (anh chị em) là hợp lệ và được giữ. */
  duplicates: number;
  tooMany: boolean;
}

const digitsOf = (s: string) => s.replace(/\D/g, "");
const phoneLike = (s: string) => /^[+(]?\d[\d\s.\-()]{6,}$/.test(s.trim());
/** Bỏ số thứ tự gõ sẵn ở đầu dòng: "1. Minh Anh", "2) Quốc Huy", "3 - Bảo Ngọc". */
const stripNumbering = (s: string) => s.replace(/^\s*\d{1,3}\s*[.)\-]\s+/, "");
/** Bỏ dấu gạch / hai chấm thừa ở hai đầu tên ("Minh Anh -" khi gõ "Minh Anh - 0912..."). */
const trimNameEdges = (s: string) => s.replace(/^[\s\-\u2013\u2014:]+|[\s\-\u2013\u2014:]+$/g, "");

/** Tách một dòng thành tên + số điện thoại thô. Nhận: "Tên, SĐT", "Tên;SĐT", "Tên<tab>SĐT" (dán từ Excel), "SĐT, Tên", "Tên SĐT". */
function splitLine(line: string): { name: string; phone: string } | { error: string } {
  const parts = line.split(/[,;\t|]/).map(s => s.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const pi = parts.findIndex(phoneLike);
    if (pi < 0) return { error: "Không thấy số điện thoại phụ huynh" };
    const name = parts.filter((_, i) => i !== pi).join(" ");
    return { name, phone: parts[pi] };
  }
  const one = parts[0] ?? "";
  const tail = one.match(/^(.*?)[\s:]*([+(]?(?:84|0)[\d\s.\-()]{8,})$/);
  if (tail && tail[1].trim()) return { name: tail[1], phone: tail[2] };
  const head = one.match(/^([+(]?(?:84|0)[\d\s.\-()]{8,})[\s:]+(.+)$/);
  if (head) return { name: head[2], phone: head[1] };
  return { error: phoneLike(one) ? "Thiếu tên em" : "Không thấy số điện thoại phụ huynh" };
}

/**
 * Đọc danh sách gia sư dán vào, mỗi dòng một em. Dòng trống bỏ qua (nhưng vẫn tính vào số thứ tự dòng khi báo lỗi).
 * Dòng LỖI không bị bỏ âm thầm: trả về trong `errors` để gia sư sửa rồi bấm lại (UI không cho tạo khi còn lỗi).
 */
export function parseBulkRoster(text: string): BulkParse {
  const rows: BulkRow[] = [], errors: BulkLineError[] = [], seen = new Set<string>();
  let duplicates = 0;
  if (text.length > BULK_TEXT_MAX) return { rows, errors: [{ line: 0, text: "", message: "Danh sách quá dài. Chỉ dán tên em và số điện thoại, tối đa 50 em một lần." }], duplicates, tooMany: true };
  const lines = text.split(/\r\n|\r|\n/);
  lines.forEach((raw, i) => {
    // Dán từ Excel / Google Sheets thì cột cách nhau bằng TAB; cleanText sẽ đổi tab thành dấu cách nên đổi tab thành dấu phẩy trước.
    const line = cleanText(stripNumbering(raw.replace(/\t+/g, ",")));
    if (!line) return;
    const s = splitLine(line);
    const fail = (message: string) => errors.push({ line: i + 1, text: line.slice(0, 80), message });
    if ("error" in s) return fail(s.error);
    const name = trimNameEdges(cleanText(s.name));
    if (!/\p{L}/u.test(name)) return fail("Thiếu tên em");
    if (name.length > BULK_NAME_MAX) return fail(`Tên em tối đa ${BULK_NAME_MAX} ký tự`);
    const phone = normalizeZaloPhone(s.phone);
    if (!phone) {
      const n = digitsOf(s.phone);
      // Excel / Sheets hay cắt số 0 đầu của số điện thoại dán vào dạng số: nhắc thẳng thay vì đoán rồi tự thêm.
      return fail(`Số điện thoại phải đủ 10 chữ số (đang có ${n.length})${n.length === 9 && !n.startsWith("0") ? ". Excel hay làm mất số 0 ở đầu, hãy thêm lại" : ""}`);
    }
    const key = `${name.toLocaleLowerCase("vi")}|${phone}`;
    if (seen.has(key)) { duplicates++; return; }
    seen.add(key);
    rows.push({ name, phone });
  });
  const tooMany = rows.length > BULK_MAX_ROWS;
  if (tooMany) errors.push({ line: 0, text: "", message: `Tối đa ${BULK_MAX_ROWS} em một lần (đang có ${rows.length}). Chia thành hai lần.` });
  return { rows, errors, duplicates, tooMany };
}

/** Link vào lớp: mở thẳng trang nhập mã với mã điền sẵn (đã có sẵn ở ClassInvites "Sao chép link"). */
export const bulkInviteLink = (origin: string, code: string) => `${origin.replace(/\/+$/, "")}/student/nhap-ma-lop?code=${code}`;

/**
 * Tin vào CHAT RIÊNG với từng phụ huynh (giọng của các tin Zalo khác, xem invoiceZalo.ts). Có tên em và link vì là chat riêng;
 * tin gửi vào NHÓM Zalo thì không được có tên em hay link riêng — ở đây không soạn tin nhóm.
 * Phụ huynh thường nhận tin từ một số chưa lưu danh bạ, nên tin PHẢI tự giới thiệu gia sư và lớp trước khi mời bấm link.
 * `tutorName` lấy từ tên tài khoản (đã có "Thầy"/"Cô" nếu gia sư tự ghi); thiếu thì bỏ câu giới thiệu chứ không điền chữ giả.
 */
export function composeBulkInviteMessage(o: { studentName: string; className: string; tutorName?: string | null; link: string; code: string }): string {
  const tutor = cleanText(o.tutorName ?? "").slice(0, BULK_NAME_MAX);
  const intro = tutor ? `Chào anh/chị ạ, đây là ${tutor}, gia sư lớp ${o.className}. ` : "Chào anh/chị ạ. ";
  return `${intro}Mời con ${o.studentName} vào lớp${tutor ? "" : ` ${o.className}`} trên KiN. ` +
    `Anh/chị bấm link này rồi tạo tài khoản cho con để vào lớp giúp nhé: ${o.link}\n(Mã lớp: ${o.code})`;
}

/** Hạn dùng của mã tạo hàng loạt. */
export const bulkInviteExpiry = (now: Date) => new Date(now.getTime() + BULK_INVITE_DAYS * 86_400_000);
