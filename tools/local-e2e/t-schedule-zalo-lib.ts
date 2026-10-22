// NC2-024 — bài thuần: tin "Lịch tuần" gửi Zalo (src/lib/weeklyScheduleMessage.ts)
import { buildWeeklyScheduleMessage, coursesInWeek, occurrencesOfCourse, type WeeklyOccurrence } from "@/lib/weeklyScheduleMessage";
import { instantOf, addDaysKey, weekRangeOf } from "@/lib/classSessions";
import { check, section, done } from "./h";

// \b không hiểu chữ có dấu (đ) nên dùng lookahead Unicode
const MONEY = /\d[\d.,]*\s?(đ|đồng|vnd|k)(?![\p{L}\d])/iu;
const FROM = "2026-10-19"; // thứ Hai
const occ = (courseId: string, name: string, dateKey: string, s: string, e: string, extra: Partial<WeeklyOccurrence> = {}): WeeklyOccurrence => {
  const hm = (x: string) => Number(x.slice(0, 2)) * 60 + Number(x.slice(3));
  return { courseId, courseName: name, dateKey, startAt: instantOf(dateKey, hm(s)).toISOString(), endAt: instantOf(dateKey, hm(e)).toISOString(), status: "scheduled", movedFrom: null, ...extra };
};

section("Buổi thường");
const normal = [occ("c1", "Toán 9", "2026-10-19", "18:00", "19:30"), occ("c1", "Toán 9", "2026-10-21", "18:00", "19:30")];
const m1 = buildWeeklyScheduleMessage({ subject: "Toán 9", from: FROM, occurrences: normal });
check("tiêu đề ghi rõ ngày bắt đầu–kết thúc tuần và tên lớp", m1.split("\n")[0] === "Lịch học tuần 19/10 – 25/10 của lớp Toán 9:", m1);
check("mỗi buổi: thứ + dd/mm + giờ bắt đầu–kết thúc", m1.includes("- Thứ Hai 19/10, 18:00–19:30") && m1.includes("- Thứ Tư 21/10, 18:00–19:30"), m1);
check("kết thúc bằng câu báo nghỉ riêng", m1.endsWith("Cần nghỉ thì báo riêng với thầy/cô trước giờ học nhé."));
check("không có chữ 'nghỉ)' hay 'dời' khi mọi buổi thường", !/\(nghỉ\)|dời/.test(m1));

section("Huỷ / dời (đúng dữ liệu trang Lịch đã tải)");
const mixed = [
  occ("c1", "Toán 9", "2026-10-19", "18:00", "19:30"),
  occ("c1", "Toán 9", "2026-10-21", "18:00", "19:30", { status: "cancelled" }),
  occ("c1", "Toán 9", "2026-10-24", "16:00", "17:30", { status: "moved", movedFrom: { dateKey: "2026-10-23", startAt: instantOf("2026-10-23", 19 * 60).toISOString(), endAt: instantOf("2026-10-23", 20 * 60 + 30).toISOString() } }),
];
const m2 = buildWeeklyScheduleMessage({ subject: "Toán 9", from: FROM, occurrences: mixed });
check("buổi huỷ ghi '(nghỉ)'", m2.includes("- Thứ Tư 21/10, 18:00–19:30 (nghỉ)"), m2);
check("buổi dời ghi ngày/giờ MỚI + nơi dời từ", m2.includes("- Thứ Bảy 24/10, 16:00–17:30 (dời từ Thứ Sáu 23/10 19:00)"), m2);
check("buổi thường không bị gắn chú thích", m2.includes("- Thứ Hai 19/10, 18:00–19:30\n"));
check("giờ cũ của buổi dời không đứng làm giờ chính", !m2.includes("- Thứ Sáu 23/10"));

section("Nhiều buổi cùng ngày, thứ tự");
const same = [occ("c1", "Toán 9", "2026-10-20", "19:00", "20:00"), occ("c1", "Toán 9", "2026-10-20", "08:00", "09:00"), occ("c1", "Toán 9", "2026-10-19", "20:00", "21:00")];
const m3 = buildWeeklyScheduleMessage({ subject: "Toán 9", from: FROM, occurrences: same }).split("\n").filter(l => l.startsWith("- "));
check("xếp theo giờ bắt đầu; cùng ngày có hai dòng", m3.length === 3 && m3[0].includes("19/10") && m3[1].includes("08:00") && m3[2].includes("19:00"), m3);
check("giờ theo giờ Việt Nam (20:00 ICT ở UTC+7)", m3[0].includes("20:00–21:00"));

section("Tuần rỗng / chọn lớp");
check("không buổi nào → tin rỗng (giao diện khoá nút)", buildWeeklyScheduleMessage({ subject: "Toán 9", from: FROM, occurrences: [] }) === "");
const two = [occ("c1", "Toán 9", "2026-10-19", "18:00", "19:30"), occ("c2", "Lý 9", "2026-10-20", "18:00", "19:30"), occ("c1", "Toán 9", "2026-10-22", "18:00", "19:30")];
check("coursesInWeek: mỗi lớp một lần, đúng thứ tự", JSON.stringify(coursesInWeek(two)) === JSON.stringify([{ id: "c1", name: "Toán 9" }, { id: "c2", name: "Lý 9" }]));
check("occurrencesOfCourse: chỉ buổi của lớp đó", occurrencesOfCourse(two, "c1").length === 2 && occurrencesOfCourse(two, "c2").length === 1 && occurrencesOfCourse(two, "c3").length === 0);
const m4 = buildWeeklyScheduleMessage({ subject: "Lý 9", from: FROM, occurrences: occurrencesOfCourse(two, "c2") });
check("tin của lớp chọn không lẫn lớp khác", m4.includes("Lý 9") && !m4.includes("Toán 9") && m4.split("\n").filter(l => l.startsWith("- ")).length === 1);
check("đổi tuần → tiêu đề đổi", buildWeeklyScheduleMessage({ subject: "Toán 9", from: addDaysKey(FROM, 7), occurrences: normal }).includes("tuần 26/10 – 01/11"));
check("qua tháng/năm: tuần 28/12 – 03/01", buildWeeklyScheduleMessage({ subject: "A", from: "2026-12-28", occurrences: normal }).includes("tuần 28/12 – 03/01"));
check("weekRangeOf khớp ngày đầu tuần dùng ở trên", weekRangeOf("2026-10-22").from === FROM);

section("Riêng tư: không tên em/phụ huynh, không tiền, không link");
const all = [m1, m2, m4].join("\n");
check("không có số tiền (đ, đồng, vnd, k, học phí)", !MONEY.test(all) && !/học phí|phiếu/i.test(all), all);
check("không có link", !/https?:|www\.|zalo\.me/i.test(all));
check("không có từ chỉ người nhận dữ liệu cá nhân (em, con, phụ huynh)", !/\b(em|con|phụ huynh|anh\/chị)\b/i.test(all.replace(/Cần nghỉ thì báo riêng/, "")), all);
// Ca phá cố ý: nếu tên lớp bị gắn tên học sinh thì kiểm tra này phải đỏ (chứng minh bài kiểm không rỗng)
const broken = buildWeeklyScheduleMessage({ subject: "Toán 9 — Em An", from: FROM, occurrences: normal });
check("[ca phá cố ý] tin chứa tên 'Em An' bị phát hiện", /\bEm An\b/.test(broken) && !/\bEm An\b/.test(m1));
const broken2 = buildWeeklyScheduleMessage({ subject: "Toán 9 học phí 1.200.000đ", from: FROM, occurrences: normal });
check("[ca phá cố ý] tin chứa tiền bị phát hiện", MONEY.test(broken2) && !MONEY.test(m1));
done();
