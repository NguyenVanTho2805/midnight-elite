// ĐX-07 (NC1-082) — "mời cả lớp một lần" (phương án nhẹ): đọc danh sách dán vào, soạn tin Zalo từng phụ huynh (src/lib/bulkInvite.ts)
// + quét tĩnh: số điện thoại không rời trình duyệt, không lưu, không nói "đã gửi". Không cần DB hay máy chủ.
// Chạy: DATABASE_URL=postgresql://x:x@localhost/x npx tsx tools/local-e2e/t-bulk-invite-lib.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BULK_INVITE_DAYS, BULK_MAX_ROWS, BULK_NAME_MAX, BULK_TEXT_MAX, bulkInviteExpiry, bulkInviteLink, composeBulkInviteMessage, parseBulkRoster,
} from "@/lib/bulkInvite";
import { check, section, done } from "./h";

const INVISIBLE = new RegExp("[\\u200b-\\u200f\\u202a-\\u202e\\ufeff]"); // dải ký tự vô hình, dựng từ chuỗi để file không chứa ký tự thật
const ch = (n: number) => String.fromCharCode(n); // ký tự vô hình dựng từ mã, không gõ thẳng vào file
const src = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const rows = (t: string) => parseBulkRoster(t).rows;
const one = (t: string) => { const r = parseBulkRoster(t); return r.rows.length === 1 && r.errors.length === 0 ? r.rows[0] : null; };
const errOf = (t: string) => parseBulkRoster(t).errors.map(e => `${e.line}:${e.message}`).join(" | ");

(async () => {
  section("Các kiểu dòng gia sư hay dán");
  check("'Tên, SĐT' — số có dấu cách được chuẩn hoá về 0912345678", JSON.stringify(rows("Minh Anh, 0912 345 678")) === JSON.stringify([{ name: "Minh Anh", phone: "0912345678" }]));
  check("dấu ; | và TAB (dán từ Excel / Google Sheets) đều tách được", ["Minh Anh;0912345678", "Minh Anh | 0912345678", "Minh Anh\t0912345678", "Minh Anh\t\t0912345678"].every(l => one(l)?.name === "Minh Anh" && one(l)?.phone === "0912345678"));
  check("'SĐT, Tên' (số đứng trước) vẫn nhận đúng", one("0912345678, Minh Anh")?.name === "Minh Anh" && one("0912345678\tMinh Anh")?.phone === "0912345678");
  check("không có dấu tách: 'Tên SĐT', 'SĐT Tên', 'Tên: SĐT', số chấm / gạch", one("Minh Anh 0912345678")?.name === "Minh Anh" && one("0912345678 Minh Anh")?.name === "Minh Anh"
    && one("Minh Anh: 0912.345.678")?.phone === "0912345678" && one("Minh Anh 091-234-5678")?.phone === "0912345678");
  check("+84 / 84 đổi về số 0 đầu", one("Bảo, +84 912 345 678")?.phone === "0912345678" && one("Bảo, 84912345678")?.phone === "0912345678");
  check("số thứ tự gõ sẵn ('1. ', '2) ', '3 - ') bị bỏ, gạch thừa ở đuôi tên bị bỏ", JSON.stringify(rows("1. Minh Anh, 0912345678\n2) Quốc Huy - 0987654321\n3 - Bảo Ngọc, 0905123456").map(r => r.name)) === JSON.stringify(["Minh Anh", "Quốc Huy", "Bảo Ngọc"]));
  check("số thứ tự KHÔNG ăn nhầm số điện thoại đứng đầu dòng", one("0912345678, Minh Anh")?.phone === "0912345678" && one("091-234-5678 Minh Anh")?.phone === "0912345678");
  check("tên có số (lớp 6A) giữ nguyên", one("Minh 6A, 0912345678")?.name === "Minh 6A");
  check("CRLF (Windows) và CR (Mac cũ) đều tách dòng", rows("A An, 0912345678\r\nB Bình, 0987654321").length === 2 && rows("A An, 0912345678\rB Bình, 0987654321").length === 2);
  check("dòng trống bỏ qua, danh sách trống / chỉ khoảng trắng → 0 em, 0 lỗi", rows("\n\nA An, 0912345678\n  \n").length === 1 && parseBulkRoster("").errors.length === 0 && parseBulkRoster("   \n\t\n").rows.length === 0);

  section("Dòng lỗi KHÔNG bị bỏ âm thầm");
  check("thiếu số điện thoại → lỗi nêu đúng số dòng (dòng trống vẫn tính số thứ tự)", errOf("A An, 0912345678\n\nBình") === "3:Không thấy số điện thoại phụ huynh", errOf("A An, 0912345678\n\nBình"));
  check("số ngắn → lỗi nói đang có bao nhiêu chữ số", errOf("An, 0912 345 67") === "1:Số điện thoại phải đủ 10 chữ số (đang có 9)", errOf("An, 0912 345 67"));
  check("dán từ Excel bị mất số 0 đầu (9 chữ số): lỗi nhắc đúng nguyên nhân, KHÔNG tự thêm số 0", errOf("An\t912345678").includes("Excel hay làm mất số 0") && rows("An\t912345678").length === 0 && !errOf("An, 0912 345 67").includes("Excel"), errOf("An\t912345678"));
  check("số không bắt đầu bằng 0 / quá dài → lỗi", errOf("An, 1912345678").startsWith("1:Số điện thoại") && errOf("An, 091234567890123").startsWith("1:Số điện thoại"));
  check("chỉ có số, không tên → 'Thiếu tên em'", errOf("0912345678") === "1:Thiếu tên em" && errOf("0912345678, 0987654321") === "1:Thiếu tên em", errOf("0912345678, 0987654321"));
  check("tên chỉ toàn dấu / số → 'Thiếu tên em'", errOf("-, 0912345678").includes("Thiếu tên em") && errOf("123 , 0912345678").includes("Thiếu tên em"), errOf("123 , 0912345678"));
  check(`tên dài quá ${BULK_NAME_MAX} ký tự → lỗi`, errOf(`${"A".repeat(BULK_NAME_MAX + 1)}, 0912345678`).includes("tối đa") && one(`${"A".repeat(BULK_NAME_MAX)}, 0912345678`) !== null);
  check("một dòng lỗi không làm mất các dòng đúng; lỗi báo từng dòng", (() => { const r = parseBulkRoster("A An, 0912345678\nxxx\nB Bình, 0987654321\nC, 12"); return r.rows.length === 2 && r.errors.length === 2 && r.errors[0].line === 2 && r.errors[1].line === 4; })());
  check("lỗi cắt trích dòng (≤80 ký tự) để không đổ cả đoạn dài ra màn hình", parseBulkRoster("x".repeat(500)).errors[0].text.length <= 80);

  section("Trùng lặp và anh chị em");
  const dup = parseBulkRoster("Minh Anh, 0912345678\nminh anh,0912 345 678\nMinh Anh, 0912345678");
  check("cùng tên + cùng số (kể cả khác hoa thường / cách viết số) → giữ 1, đếm số dòng bỏ", dup.rows.length === 1 && dup.duplicates === 2 && dup.errors.length === 0, dup);
  const sib = parseBulkRoster("Minh Anh, 0912345678\nMinh Khôi, 0912345678");
  check("hai em CÙNG số phụ huynh (anh chị em) là hợp lệ, giữ cả hai", sib.rows.length === 2 && sib.duplicates === 0);
  check("cùng tên khác số (hai bạn trùng tên) cũng giữ cả hai", rows("Minh Anh, 0912345678\nMinh Anh, 0987654321").length === 2);

  section("Giới hạn");
  const mk = (n: number) => Array.from({ length: n }, (_, i) => `Em ${String.fromCharCode(65 + (i % 26))}${Math.floor(i / 26)}, 09${String(10000000 + i)}`).join("\n");
  check(`đúng ${BULK_MAX_ROWS} em → hợp lệ`, (() => { const r = parseBulkRoster(mk(BULK_MAX_ROWS)); return r.rows.length === BULK_MAX_ROWS && r.errors.length === 0 && !r.tooMany; })(), parseBulkRoster(mk(BULK_MAX_ROWS)).errors);
  check(`${BULK_MAX_ROWS + 1} em → tooMany + một lỗi nêu số lượng (UI chặn tạo)`, (() => { const r = parseBulkRoster(mk(BULK_MAX_ROWS + 1)); return r.tooMany && r.errors.length === 1 && r.errors[0].message.includes(String(BULK_MAX_ROWS + 1)); })());
  check("dán quá dài (> BULK_TEXT_MAX) → từ chối ngay, không xử lý từng dòng", (() => { const r = parseBulkRoster("A An, 0912345678\n".repeat(Math.ceil(BULK_TEXT_MAX / 10))); return r.tooMany && r.rows.length === 0 && r.errors.length === 1; })());

  section("Làm sạch chữ trong tên");
  check("ký tự vô hình / đổi chiều chữ trong tên bị bỏ (không lọt vào tin Zalo)", (() => { const n = one(`Minh${ch(0x202e)} An${ch(0x200b)}h, 0912345678`)?.name ?? ""; return !INVISIBLE.test(n) && n.startsWith("Minh"); })());
  check("tên được chuẩn hoá NFC (dấu rời ghép lại)", one(`Tha${ch(0x301)}o, 0912345678`)?.name === ("Tha" + ch(0x301) + "o").normalize("NFC") && one(`Tha${ch(0x301)}o, 0912345678`)?.name.length === 4);

  section("Không bao giờ ném lỗi, kết quả luôn hợp lệ (fuzz)");
  let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const alphabet = ["a", "B", "ê", "Đ", "0", "1", "9", "8", "4", " ", " ", ",", ";", "\t", "|", "\n", "\r", "-", ".", ":", "+", "(", ")", ch(0x200b), ch(0x202e)];
  let crash = 0, badRow = 0;
  for (let n = 0; n < 400; n++) {
    let t = ""; const len = Math.floor(rnd() * 120);
    for (let i = 0; i < len; i++) t += alphabet[Math.floor(rnd() * alphabet.length)];
    try {
      for (const r of parseBulkRoster(t).rows) if (!/^0\d{9,10}$/.test(r.phone) || !r.name || r.name.length > BULK_NAME_MAX || /\s{2,}|^\s|\s$/.test(r.name) || !/\p{L}/u.test(r.name)) badRow++;
    } catch { crash++; }
  }
  check("400 chuỗi ngẫu nhiên: không lần nào ném lỗi", crash === 0, crash);
  check("mọi dòng nhận được đều có số 0xxxxxxxxx, tên có chữ, ≤ giới hạn, không thừa khoảng trắng", badRow === 0, badRow);

  section("Tin Zalo cho phụ huynh");
  const link = bulkInviteLink("https://kin.example/", "ABCD2345");
  check("link chung: mở trang nhập mã với mã điền sẵn, bỏ dấu / thừa ở cuối origin", link === "https://kin.example/student/nhap-ma-lop?code=ABCD2345" && bulkInviteLink("https://kin.example", "ABCD2345") === link);
  const msg = composeBulkInviteMessage({ studentName: "Minh Anh", className: "Toán 9A", link, code: "ABCD2345" });
  check("tin có tên em, tên lớp, link và mã lớp", ["Minh Anh", "Toán 9A", link, "ABCD2345"].every(x => msg.includes(x)), msg);
  const withTutor = composeBulkInviteMessage({ studentName: "Minh Anh", className: "Toán 9A", tutorName: "  Cô  Lan ", link, code: "ABCD2345" });
  check("có tên gia sư: tin TỰ GIỚI THIỆU trước khi mời bấm link (phụ huynh nhận từ số lạ), tên được làm sạch", withTutor.startsWith("Chào anh/chị ạ, đây là Cô Lan, gia sư lớp Toán 9A.") && withTutor.indexOf("đây là") < withTutor.indexOf(link), withTutor);
  check("thiếu tên gia sư (null / rỗng / chỉ khoảng trắng): bỏ câu giới thiệu, KHÔNG in 'null' hay 'undefined', vẫn nêu tên lớp", [null, undefined, "", "   "].every(t => { const m = composeBulkInviteMessage({ studentName: "Minh Anh", className: "Toán 9A", tutorName: t, link, code: "ABCD2345" }); return !/null|undefined|đây là/.test(m) && m.includes("lớp Toán 9A") && m.includes(link); }));
  check("tên gia sư quá dài bị cắt ở giới hạn tên", !composeBulkInviteMessage({ studentName: "Minh Anh", className: "L", tutorName: "x".repeat(200), link, code: "ABCD2345" }).includes("x".repeat(BULK_NAME_MAX + 1)));
  check("tin KHÔNG chứa số điện thoại phụ huynh", !/\d{9,}/.test(msg.replace(link, "").replace("ABCD2345", "")));
  check("tin không hứa 'đã gửi' / không dùng chữ 'bắt buộc' / không doạ", !/đã gửi|bắt buộc|ngay lập tức|khẩn/i.test(msg));
  check("tin là hàm thuần: gọi hai lần cùng kết quả", msg === composeBulkInviteMessage({ studentName: "Minh Anh", className: "Toán 9A", link, code: "ABCD2345" }));
  check("tên em mang ký tự đặc biệt không phá link (tin chỉ ghép chữ, không nhúng vào URL)", composeBulkInviteMessage({ studentName: "A&B=C?", className: "L", link, code: "ABCD2345" }).includes(link));

  section("Hạn dùng");
  const t0 = new Date("2026-10-21T03:00:00Z");
  check(`mã hết hạn sau đúng ${BULK_INVITE_DAYS} ngày và không đổi 'now' đã đưa vào`, bulkInviteExpiry(t0).getTime() === t0.getTime() + BULK_INVITE_DAYS * 86_400_000 && t0.toISOString() === "2026-10-21T03:00:00.000Z");

  section("Quét tĩnh: số điện thoại phụ huynh không rời trình duyệt");
  const ui = src("src/components/tutor/BulkInvite.tsx"), lib = src("src/lib/bulkInvite.ts");
  const stringifies = ui.split("\n").filter(l => l.includes("JSON.stringify"));
  check("giao diện chỉ gọi API một lần (tạo mã), và nội dung gửi chỉ có maxUses + expiresAt", (ui.match(/callApi[<(]/g) ?? []).length === 1 && stringifies.length === 1 && /maxUses: rows\.length, expiresAt:/.test(stringifies[0]) && !/phone|name/i.test(stringifies[0]), stringifies);
  check("không lưu vào localStorage / sessionStorage / IndexedDB / cookie / URL", !/localStorage|sessionStorage|indexedDB|document\.cookie|history\.(push|replace)State|router\.(push|replace)|searchParams/.test(ui));
  check("không ghi số điện thoại ra console", !/console\./.test(ui) && !/console\./.test(lib));
  check("thư viện thuần: không nhập prisma / máy chủ / next", !/@\/lib\/prisma|next\/|server-only/.test(lib));
  check("không có tuyến API riêng nhận danh sách phụ huynh", !/bulk/i.test(src("src/app/api/courses/[id]/invites/route.ts")));
  check("chữ hiển thị nói 'mở Zalo', không bao giờ 'đã gửi'", !/đã gửi/i.test(ui) && !/đã gửi/i.test(lib) && /Đã mở Zalo lúc/.test(ui) && /Chưa mở Zalo/.test(ui));
  check("nhắc rõ trên màn hình: số chỉ nằm trên trình duyệt này, KiN không lưu, mất khi làm đợt mới", /chỉ nằm trên trình duyệt này/.test(ui) && /KiN không lưu/.test(ui));
  check("làm đợt mới khi còn người chưa mở Zalo thì phải hỏi lại (không mất danh sách do lỡ tay)", /notOpened > 0 \? setConfirmReset\(true\) : reset\(\)/.test(ui));
  check("không dùng màu hex trong giao diện mới (t-no-hex)", !/#[0-9a-fA-F]{3,8}\b/.test(ui));
  check("gắn vào tab Mã mời: ClassInvitesPanel nhận courseName và OutlookShell truyền xuống", /BulkInvite courseId=\{courseId\} courseName=\{courseName\} tutorName=\{tutorName\}/.test(src("src/components/tutor/ClassInvites.tsx")) && /<ClassInvitesPanel courseId=\{courseId\} courseName=\{courseName\} tutorName=\{viewerName\} \/>/.test(src("src/app/lop-cua-toi/[courseId]/OutlookShell.tsx")) && /viewerName=\{viewerName\}/.test(src("src/app/lop-cua-toi/[courseId]/page.tsx")));

  done();
})().catch(e => { console.error("CRASH", e); process.exit(1); });
