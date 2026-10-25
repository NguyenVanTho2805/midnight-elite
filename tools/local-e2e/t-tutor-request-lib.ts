// KH-04 / PH-07 "Yêu cầu tìm gia sư" của khách: kiểm dữ liệu vào, chống spam, chữ đồng ý trung thực. Hàm THUẦN (src/lib/tutorRequest.ts), không cần máy chủ.
// Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-tutor-request-lib.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MIN_FILL_MS, MAX_FILL_MS, NOTE_MAX, PARENT_STATUS_TEXT, REQUEST_CONSENT_NOTE, REQUEST_CONSENT_TEXT, REQUEST_EXPIRE_DAYS, REQUEST_STATUSES, SLOTS_MAX, SUBJECT_MAX, TUTOR_STATUS_TEXT,
  isTrackToken, parseRequestInput, requestExpireCutoff, spamVerdict, trackUrl,
} from "@/lib/tutorRequest";
import { check, section, done } from "./h";

const good = { level: "thcs", subject: "Toán 9", mode: "online", slots: "tối thứ 3, 5", note: "Con hơi yếu hình học", contactName: "Chị Hoa", contactPhone: "0912 345 678", role: "guardian" };
const P = (o: Record<string, unknown> = {}) => parseRequestInput({ ...good, ...o });
const err = (o: Record<string, unknown>) => Object.keys(P(o).errors).join();

(async () => {
  section("Thân yêu cầu hợp lệ");
  const ok = P();
  check("đủ trường → hợp lệ, SĐT chuẩn hoá 10 số", !!ok.data && Object.keys(ok.errors).length === 0 && ok.data.contactPhone === "0912345678" && ok.data.level === "thcs" && ok.data.role === "guardian");
  check("chỉ cần: cấp học, môn, SĐT, vai (còn lại tuỳ chọn)", !!parseRequestInput({ level: "khac", subject: "IELTS", contactPhone: "0912345678", role: "self" }).data);
  check("trường không bắt buộc để trống → null", (() => { const r = parseRequestInput({ level: "thpt", subject: "Lý", contactPhone: "0912345678", role: "guardian", mode: "", slots: "", note: "", contactName: "" }).data!; return r.mode === null && r.slots === null && r.note === null && r.contactName === null; })());

  section("Từng lỗi nêu đúng ô");
  check("thiếu cấp học / cấp học lạ → level", err({ level: undefined }) === "level" && err({ level: "dai-hoc-xa" }) === "level");
  check("thiếu môn → subject; môn quá dài → subject", err({ subject: "" }) === "subject" && err({ subject: "x".repeat(SUBJECT_MAX + 1) }) === "subject" && err({ subject: "x".repeat(SUBJECT_MAX) }) === "");
  check("SĐT thiếu / ngắn / chữ → contactPhone", err({ contactPhone: undefined }) === "contactPhone" && err({ contactPhone: "0912" }) === "contactPhone" && err({ contactPhone: "gọi tôi" }) === "contactPhone");
  check("vai thiếu / lạ → role", err({ role: undefined }) === "role" && err({ role: "teacher" }) === "role");
  check("hình thức lạ → mode", err({ mode: "hologram" }) === "mode");
  check(`khung giờ > ${SLOTS_MAX}, ghi chú > ${NOTE_MAX}, tên > 60 → báo`, err({ slots: "x".repeat(SLOTS_MAX + 1) }) === "slots" && err({ note: "x".repeat(NOTE_MAX + 1) }) === "note" && err({ contactName: "x".repeat(61) }) === "contactName");
  check("trường không phải chữ (số, đối tượng) → báo, không ném lỗi", err({ slots: 5 }) === "slots" && err({ note: {} }) === "note");
  check("nhiều lỗi cùng lúc: trả đủ các ô", err({ level: undefined, subject: "", contactPhone: "1" }).split(",").sort().join() === "contactPhone,level,subject");

  section("Chỉ thu tối thiểu: ô lạ (tên / ngày sinh / trường của trẻ) KHÔNG lọt vào dữ liệu");
  const sneaky = parseRequestInput({ ...good, childName: "Nguyễn Văn Bé", birthDate: "2014-05-01", school: "THCS Thử", address: "1 Lê Lợi", idNumber: "123" }).data!;
  check("kết quả chỉ có đúng 8 trường đã định", Object.keys(sneaky).sort().join() === "contactName,contactPhone,level,mode,note,role,slots,subject");
  check("không chữ nào của ô lạ xuất hiện trong kết quả", !JSON.stringify(sneaky).includes("Nguyễn Văn Bé") && !JSON.stringify(sneaky).includes("2014-05-01") && !JSON.stringify(sneaky).includes("THCS Thử"));
  check("ký tự vô hình / đổi chiều chữ trong môn bị làm sạch", parseRequestInput({ ...good, subject: "To‮​án" }).data?.subject === "To án");

  section("Chống spam");
  const now = 1_700_000_000_000;
  check("ô bẫy có chữ → bot (kể cả khoảng trắng + chữ)", spamVerdict({ website: "http://x", startedAt: now - 10_000, now }) === "bot" && spamVerdict({ website: " a ", startedAt: now - 10_000, now }) === "bot");
  check("ô bẫy trống / khoảng trắng / vắng → không phải bot", spamVerdict({ website: "", startedAt: now - 10_000, now }) === "ok" && spamVerdict({ website: "   ", startedAt: now - 10_000, now }) === "ok" && spamVerdict({ website: undefined, startedAt: now - 10_000, now }) === "ok");
  check("ô bẫy là số / đối tượng (không phải chuỗi rỗng) → bot", spamVerdict({ website: 1, startedAt: now - 10_000, now }) === "bot" && spamVerdict({ website: {}, startedAt: now - 10_000, now }) === "bot");
  check(`gửi dưới ${MIN_FILL_MS} ms → quá nhanh; đúng ${MIN_FILL_MS} ms → được`, spamVerdict({ website: "", startedAt: now - (MIN_FILL_MS - 1), now }) === "too-fast" && spamVerdict({ website: "", startedAt: now - MIN_FILL_MS, now }) === "ok");
  check("thiếu / sai kiểu / ở tương lai / quá 6 giờ → stale", spamVerdict({ website: "", startedAt: undefined, now }) === "stale" && spamVerdict({ website: "", startedAt: "123", now }) === "stale" && spamVerdict({ website: "", startedAt: now + 5000, now }) === "stale" && spamVerdict({ website: "", startedAt: now - MAX_FILL_MS - 1, now }) === "stale" && spamVerdict({ website: "", startedAt: NaN, now }) === "stale");

  section("Mã theo dõi, hết hạn, đường dẫn");
  check("mã theo dõi: đúng 32 ký tự hex thường", isTrackToken("0123456789abcdef0123456789abcdef") && !isTrackToken("0123456789ABCDEF0123456789abcdef") && !isTrackToken("abc") && !isTrackToken(null) && !isTrackToken("x".repeat(32)));
  const n = new Date("2026-10-23T00:00:00Z");
  check(`mốc hết hạn = ${REQUEST_EXPIRE_DAYS} ngày trước`, requestExpireCutoff(n).toISOString() === "2026-09-23T00:00:00.000Z");
  check("link theo dõi bỏ dấu / thừa ở cuối gốc", trackUrl("https://kin.vn/", "ab") === "https://kin.vn/yeu-cau/ab");

  section("Chữ trung thực");
  const texts = [REQUEST_CONSENT_TEXT.guardian, REQUEST_CONSENT_TEXT.self, REQUEST_CONSENT_NOTE, ...REQUEST_STATUSES.flatMap(s => [PARENT_STATUS_TEXT[s].title, PARENT_STATUS_TEXT[s].detail, TUTOR_STATUS_TEXT[s]])];
  const claims = (t: string) => /đã xác minh|được xác minh|xác thực|KiN xác nhận|cam kết/i.test(t.replace(/không phải KiN đã xác minh/gi, ""));
  check("không chữ nào khẳng định KiN đã xác minh / cam kết", texts.every(t => !claims(t)));
  check("hộp đồng ý nói rõ KiN không kiểm tra người bấm", /KiN không kiểm tra/.test(REQUEST_CONSENT_NOTE) && /không phải KiN đã xác minh/.test(REQUEST_CONSENT_NOTE));
  check("hộp đồng ý nêu rút lại được và số liên hệ bị xoá khi rút", /rút lại/.test(REQUEST_CONSENT_NOTE) && /xoá khỏi yêu cầu/.test(REQUEST_CONSENT_NOTE));
  check("đồng ý nói rõ gia sư có thể ghi tên con vào sổ lớp NẾU nhận (và chỉ để dạy học)", /nếu gia sư nhận yêu cầu/i.test(REQUEST_CONSENT_TEXT.guardian) && /dạy học và liên lạc/.test(REQUEST_CONSENT_TEXT.guardian));
  check("người học 16+ tự đồng ý bằng chữ riêng, nêu rõ 'đủ 16 tuổi'", /đủ 16 tuổi/.test(REQUEST_CONSENT_TEXT.self));
  check("trạng thái 'đang chờ' không hứa thời gian phản hồi; 'đã nhận' nói KiN không thu hộ học phí", /không đảm bảo thời gian/.test(PARENT_STATUS_TEXT.new.detail) && /không thu hộ/.test(PARENT_STATUS_TEXT.accepted.detail));
  check("mọi trạng thái đều có chữ (màu không nói một mình)", REQUEST_STATUSES.every(s => PARENT_STATUS_TEXT[s].title.length > 5 && TUTOR_STATUS_TEXT[s].length > 3));

  section("Quét tĩnh: trang theo dõi của khách không trả số liên hệ / ghi chú");
  const track = readFileSync(join(process.cwd(), "src/app/api/yeu-cau/[token]/route.ts"), "utf8").replace(/\/\/.*$/gm, "");
  check("API theo dõi không select contactPhone / contactName / note / phoneKey", !/contactPhone|contactName|\bnote\b|phoneKey/.test(track));
  const libSrc = readFileSync(join(process.cwd(), "src/lib/tutorRequest.ts"), "utf8");
  check("lib thuần: không nạp Prisma / node:crypto (dùng được cả ở trình duyệt)", !/@\/lib\/prisma|node:crypto/.test(libSrc));

  await done();
})();
