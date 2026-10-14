// Phòng thi — phần thuần (src/lib/examRoom.ts): đồng hồ, tiêu đề Phần, dòng tiến độ, ghi chú hết giờ, câu đang xem.
import { formatClock, spokenClock, lowTimeAnnouncement, roomHeading, questionCounter, progressLine, timeUpNote, shortSectionName, currentQuestionIndex } from "@/lib/examRoom";
import { check, section, done } from "./h";

section("formatClock / spokenClock");
check("1902 giây → 31:42 (đúng Figma)", formatClock(1902) === "31:42", formatClock(1902));
check("0 → 00:00; âm → 00:00; NaN → 00:00", formatClock(0) === "00:00" && formatClock(-5) === "00:00" && formatClock(NaN) === "00:00");
check("9 giây → 00:09 (đệm số 0)", formatClock(9) === "00:09");
check("90 phút → 90:00 (không cắt ở 59)", formatClock(5400) === "90:00", formatClock(5400));
check("số lẻ giây bị làm tròn xuống", formatClock(61.9) === "01:01");
check("đọc to: 31 phút 42 giây / 42 giây", spokenClock(1902) === "31 phút 42 giây" && spokenClock(42) === "42 giây");

section("lowTimeAnnouncement");
check("còn nhiều → không đọc", lowTimeAnnouncement(1800) === "" && lowTimeAnnouncement(301) === "");
check("≤ 5 phút → 'Còn dưới 5 phút.'; ≤ 1 phút → 'Còn dưới 1 phút.'", lowTimeAnnouncement(300) === "Còn dưới 5 phút." && lowTimeAnnouncement(61) === "Còn dưới 5 phút." && lowTimeAnnouncement(60) === "Còn dưới 1 phút.");
check("hết giờ (0) → không đọc thêm", lowTimeAnnouncement(0) === "");
const set = new Set(Array.from({ length: 301 }, (_, i) => lowTimeAnnouncement(i)));
check("chỉ có 3 giá trị khác nhau trong 5 phút cuối (không đọc mỗi giây)", set.size === 3, [...set]);

section("roomHeading");
check("không chia Phần → tên đề", roomHeading({ examTitle: "  Đề thử Toán 9 " }) === "Đề thử Toán 9");
check("tên Phần đã bắt đầu bằng 'Phần' → giữ nguyên", roomHeading({ examTitle: "Đề", sectionLabel: "Phần Trắc nghiệm", sectionIndex: 0 }) === "Phần Trắc nghiệm");
check("'Phần 1: Toán…' giữ nguyên", roomHeading({ examTitle: "Đề", sectionLabel: "Phần 1: Toán và xử lý số liệu", sectionIndex: 0 }) === "Phần 1: Toán và xử lý số liệu");
check("tên Phần không có 'Phần' → thêm 'Phần n · '", roomHeading({ examTitle: "Đề", sectionLabel: "Toán và xử lý số liệu", sectionIndex: 0 }) === "Phần 1 · Toán và xử lý số liệu");
check("Phần thứ 3 → 'Phần 3 · …'", roomHeading({ examTitle: "Đề", sectionLabel: "Khoa học", sectionIndex: 2 }) === "Phần 3 · Khoa học");
check("tên Phần toàn khoảng trắng → coi như không có", roomHeading({ examTitle: "Đề", sectionLabel: "   " }) === "Đề");

section("questionCounter / progressLine");
check("Câu 18 / 50", questionCounter(18, 50) === "Câu 18 / 50");
check("ép trong khoảng: 0 → Câu 1; 99 → Câu 50", questionCounter(0, 50) === "Câu 1 / 50" && questionCounter(99, 50) === "Câu 50 / 50");
check("không có câu → chữ rõ ràng", questionCounter(1, 0) === "Chưa có câu hỏi");
check("tiến độ có tên Phần", progressLine(17, 50, "Phần 1") === "Đã trả lời 17 / 50 câu Phần 1");
check("tiến độ không chia Phần", progressLine(0, 2) === "Đã trả lời 0 / 2 câu");

section("timeUpNote / shortSectionName");
check("Phần giữa → nói rõ khoá và tự sang Phần kế", timeUpNote({ sectionName: "Phần 1", nextSectionName: "Phần 2" }) === "Hết giờ Phần 1 thì Phần 1 khoá lại, tự sang Phần 2. Không sửa lại được.");
check("Phần cuối / không chia Phần → 'tự nộp bài'", timeUpNote({ sectionName: "Phần 2" }) === "Hết giờ hệ thống tự nộp bài." && timeUpNote({}) === "Hết giờ hệ thống tự nộp bài.");
check("shortSectionName: 'Phần 1: Toán…' → 'Phần 1'", shortSectionName("Phần 1: Toán và xử lý số liệu", 0) === "Phần 1");
check("'Phần Trắc nghiệm' (không số) → nguyên tên", shortSectionName("Phần Trắc nghiệm", 0) === "Phần Trắc nghiệm");
check("'Khoa học' ở vị trí 2 → 'Phần 3'", shortSectionName("Khoa học", 2) === "Phần 3");
check("không có tên → null", shortSectionName(null, 0) === null && shortSectionName("  ", 1) === null);

section("currentQuestionIndex");
check("không có câu → 0", currentQuestionIndex([], 600) === 0);
check("đầu trang: câu 1 đang ở mép trên → câu 1", currentQuestionIndex([0, 300, 600], 600) === 0);
check("cuộn tới khi câu 2 vượt vạch 30% (180px) → câu 2", currentQuestionIndex([-250, 120, 420], 600) === 1);
check("câu 2 còn dưới vạch → vẫn câu 1", currentQuestionIndex([-100, 200, 500], 600) === 0);
check("cuộn hết: câu cuối", currentQuestionIndex([-900, -600, -300, 10], 600) === 3);
done();
