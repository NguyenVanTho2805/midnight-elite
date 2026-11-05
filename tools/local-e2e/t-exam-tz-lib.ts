// 05/11/2026 — mốc giờ phòng thi/đề KHÔNG phụ thuộc múi giờ máy chủ (production chạy UTC). Phần THUẦN, không DB, không mạng.
// Chạy 3 lần, kết quả phải GIỐNG HỆT nhau:  TZ=UTC · TZ=America/Los_Angeles · TZ=Asia/Ho_Chi_Minh   (npx tsx tools/local-e2e/t-exam-tz-lib.ts)
// Ca phá cố ý: trong src/lib/examData.ts đổi examStartInstant về `new Date(+year, +month - 1, +day, +hh, +mm)` → các ca dưới đỏ khi TZ khác +07.
import { computeExamStatus, examStartInstant } from "@/lib/examData";
import { hasExamWindowEnded } from "@/lib/examGrading";
import { effectiveExamPolicy } from "@/lib/examPolicy";
import { examWindowOf, startVerdict } from "@/lib/examWindow";
import { check, section, done } from "./h";

const exam = { date: "05/11/2026", time: "09:00", duration: "90 phút" };
const open = Date.parse("2026-11-05T02:00:00.000Z"); // 09:00 giờ Việt Nam
const close = open + 90 * 60_000;
section(`Múi giờ tiến trình: TZ=${process.env.TZ ?? "(mặc định)"}`);
check("examStartInstant: 05/11/2026 09:00 (VN) = 02:00Z", examStartInstant(exam.date, exam.time).toISOString() === "2026-11-05T02:00:00.000Z", examStartInstant(exam.date, exam.time).toISOString());
check("examWindowOf (mã mới) cùng mốc mở/đóng", examWindowOf(exam).opensAt?.getTime() === open && examWindowOf(exam).closesAt?.getTime() === close);
check("computeExamStatus: 1 ms trước giờ mở = upcoming", computeExamStatus(exam.date, exam.time, true, new Date(open - 1)) === "upcoming");
check("computeExamStatus: đúng giờ mở = available", computeExamStatus(exam.date, exam.time, true, new Date(open)) === "available");
check("computeExamStatus: đề tắt = completed", computeExamStatus(exam.date, exam.time, false, new Date(open)) === "completed");
check("startVerdict khớp computeExamStatus ở biên mở", startVerdict(exam, new Date(open - 1)) === "not_open" && startVerdict(exam, new Date(open)) === "ok");
const realNow = Date.now;
function endedAt(t: number): boolean { Date.now = () => t; try { return hasExamWindowEnded(exam); } finally { Date.now = realNow; } }
check("hasExamWindowEnded: 1 ms trước giờ đóng = chưa hết", endedAt(close - 1) === false);
check("hasExamWindowEnded: đúng giờ đóng = hết", endedAt(close) === true);
check("hasExamWindowEnded: 09:00 VN chưa hết dù đồng hồ máy theo UTC/LA", endedAt(open) === false);
check("date rỗng giữ quy ước cũ: 01/01/2000 → đã hết", hasExamWindowEnded({ date: "", time: "", duration: "60 phút" }) === true);
check("date rác giữ quy ước cũ: không bao giờ hết", hasExamWindowEnded({ date: "abc", time: "x", duration: "60 phút" }) === false);
const pol = (t: number) => effectiveExamPolicy({ ...exam, answerVisibility: "after_exam_ends", mode: "test", classId: "c1" } as never, null, { now: new Date(t) });
check("examPolicy: quyền xem đáp án sau khi đề đóng đổi đúng tại 10:30 VN", JSON.stringify(pol(close - 1)) !== JSON.stringify(pol(close)));
done();
