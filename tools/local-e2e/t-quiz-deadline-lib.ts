// QZ — hạn nộp riêng từng học sinh, phần thuần (src/lib/quizDeadline.ts). Không DB, không máy chủ.
// CA PHÁ CỐ Ý: hạn ở quá khứ, ngày không có thật, múi giờ (phải là giờ VN), mốc đúng bằng now, lượt dở không bị cắt, ghi chú quá dài.
import {
  parseDueAt, deadlineState, canStartByDeadline, studentDeadlineText, deadlineRowLabel, deadlineLogNote, normalizeDeadlineNote,
  fmtDue, DEADLINE_PASSED_MESSAGE, DEADLINE_NOTE_MAX, DEADLINE_MAX_DAYS,
} from "@/lib/quizDeadline";
import { check, section, done } from "./h";

const now = new Date("2026-10-25T03:00:00.000Z"); // 10:00 giờ VN, 25/10/2026

section("parseDueAt — giờ Việt Nam, phải ở tương lai");
const ok = parseDueAt("2026-10-25", "20:00", now);
check("25/10 20:00 giờ VN = 13:00 UTC", ok.ok && ok.value.toISOString() === "2026-10-25T13:00:00.000Z", ok);
check("PHÁ múi giờ: không được hiểu là 20:00 UTC", ok.ok && ok.value.toISOString() !== "2026-10-25T20:00:00.000Z");
check("nửa đêm VN: 26/10 00:30 = 25/10 17:30 UTC", (() => { const r = parseDueAt("2026-10-26", "00:30", now); return r.ok && r.value.toISOString() === "2026-10-25T17:30:00.000Z"; })());
check("hạn ở quá khứ → lỗi tiếng Việt", (() => { const r = parseDueAt("2026-10-24", "20:00", now); return !r.ok && /tương lai/.test(r.error); })());
check("PHÁ mốc: đúng bằng bây giờ (10:00 VN) → lỗi (không cho hạn 'đã tới')", !parseDueAt("2026-10-25", "10:00", now).ok);
check("một phút sau bây giờ → hợp lệ", parseDueAt("2026-10-25", "10:01", now).ok);
check("ngày không có thật (31/02) → lỗi", !parseDueAt("2026-02-31", "20:00", now).ok);
check("định dạng ngày sai / không phải chuỗi → lỗi", !parseDueAt("25/10/2026", "20:00", now).ok && !parseDueAt(20261025, "20:00", now).ok && !parseDueAt(undefined, "20:00", now).ok);
check("giờ sai (25:00, rỗng, không phải chuỗi) → lỗi", !parseDueAt("2026-10-26", "25:00", now).ok && !parseDueAt("2026-10-26", "", now).ok && !parseDueAt("2026-10-26", 8, now).ok);
const far = parseDueAt("2028-10-25", "20:00", now);
check("quá xa (hơn 1 năm) → lỗi", !far.ok && /1 năm/.test(far.error));
check(`đúng giới hạn ${DEADLINE_MAX_DAYS} ngày vẫn được`, parseDueAt("2027-10-26", "10:00", now).ok);

section("deadlineState / canStartByDeadline");
const due = new Date("2026-10-25T13:00:00.000Z");
check("không có hạn riêng → none, vào được như cũ", deadlineState(null, now) === "none" && deadlineState(undefined, now) === "none" && canStartByDeadline(null, now, false));
check("còn hạn → open, vào được", deadlineState(due, now) === "open" && canStartByDeadline(due, now, false));
check("quá hạn → passed, KHÔNG bắt đầu lượt mới", deadlineState(due, new Date("2026-10-25T13:00:01.000Z")) === "passed" && !canStartByDeadline(due, new Date("2026-10-25T13:00:01.000Z"), false));
check("PHÁ mốc: đúng mốc hạn = đã quá hạn", deadlineState(due, due) === "passed" && !canStartByDeadline(due, due, false));
check("quá hạn nhưng đang có lượt dở → vẫn làm nốt (không cắt)", canStartByDeadline(due, new Date("2026-10-26T00:00:00.000Z"), true));

section("Chữ cho học sinh / gia sư (nói thật, có giờ VN)");
check("fmtDue theo giờ VN, có năm", fmtDue(due) === "25/10/2026 20:00", fmtDue(due));
check("học sinh thấy hạn riêng còn mở", studentDeadlineText(due, now) === "Hạn nộp riêng của em: 25/10/2026 20:00");
check("học sinh thấy hạn riêng đã qua", /đã qua/.test(studentDeadlineText(due, new Date("2026-10-26T00:00:00Z")) ?? ""));
check("không có hạn riêng → không bịa chữ", studentDeadlineText(null, now) === null);
check("dòng gia sư: hạn đã qua có chữ 'đã qua'", deadlineRowLabel(due, new Date("2026-10-26T00:00:00Z")).endsWith("đã qua") && !deadlineRowLabel(due, now).includes("đã qua"));
check("câu báo chặn không dùng 'đã xác minh' và nói rõ hạn riêng", /hạn nộp riêng/i.test(DEADLINE_PASSED_MESSAGE) && !/xác minh/i.test(DEADLINE_PASSED_MESSAGE));

section("Nhật ký đề: không tên học sinh");
const logSet = deadlineLogNote("set", 3, due), logClr = deadlineLogNote("clear", 2);
check("ghi số lượng và hạn", logSet.includes("3 học sinh") && logSet.includes("25/10/2026 20:00") && logClr.includes("2 học sinh"));

section("Ghi chú");
check("trống/undefined → null", (() => { const a = normalizeDeadlineNote("  "), b = normalizeDeadlineNote(undefined); return a.ok && a.value === null && b.ok && b.value === null; })());
check("cắt khoảng trắng", (() => { const a = normalizeDeadlineNote("  ốm  "); return a.ok && a.value === "ốm"; })());
check(`PHÁ: quá ${DEADLINE_NOTE_MAX} ký tự → lỗi, đúng ${DEADLINE_NOTE_MAX} vẫn được`, !normalizeDeadlineNote("x".repeat(DEADLINE_NOTE_MAX + 1)).ok && normalizeDeadlineNote("x".repeat(DEADLINE_NOTE_MAX)).ok);
check("không phải chuỗi → lỗi", !normalizeDeadlineNote(5).ok);

done();
