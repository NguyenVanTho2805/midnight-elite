// SCL-C — phần thuần của sổ điểm gọn (src/lib/soDiem.ts): ô điểm / trạng thái, ai được ghi điểm, điểm gõ tay, thân yêu cầu "+ Giao bài". Không cần máy chủ.
import { assignmentCell, examCell, canWriteScore, parseScoreInput, parseGiaoInput, STUDENT_LABEL, CELL_LABEL } from "@/lib/soDiem";
import { isValidDateKey } from "@/lib/classSessions";
import { check, section, done } from "./h";

section("Ô bài tập nộp tệp");
check("không bài nộp ⇒ Chưa nộp, không điểm", assignmentCell(null, 10).state === "chua-nop" && assignmentCell(null, 10).score === null);
check("nộp chưa chấm ⇒ Chờ chấm", assignmentCell({ score: null }, 10).state === "cho-cham");
const g = assignmentCell({ score: 7.5 }, 10);
check("đã chấm ⇒ Đã chấm 7,5/10", g.state === "da-cham" && g.score === 7.5 && g.max === 10 && g.label === "Đã chấm", g);

section("Ô đề (quiz / Azota)");
const pend = examCell({ score: 8, totalPoints: 10, pendingReview: true }, false);
check("điểm tự khai chưa duyệt ⇒ Chờ duyệt (KHÔNG phải Đã chấm)", pend.state === "cho-duyet" && pend.label === "Chờ duyệt", pend);
check("học sinh đọc: 'Chờ gia sư duyệt'", STUDENT_LABEL[pend.state] === "Chờ gia sư duyệt");
check("điểm đã duyệt / máy chấm ⇒ Đã chấm", examCell({ score: 9, totalPoints: 10, pendingReview: false }, true).state === "da-cham");
check("có lượt nộp, chưa có điểm (giữ điểm tự luận) ⇒ Chờ chấm", examCell(null, true).state === "cho-cham");
check("chưa làm ⇒ Chưa nộp", examCell(null, false).state === "chua-nop");
check("mọi trạng thái đều có chữ", Object.values(CELL_LABEL).every(Boolean) && Object.values(STUDENT_LABEL).every(Boolean));

section("Ai được duyệt / chấm trong sổ (score.write)");
check("chủ lớp + Chủ nhiệm được", canWriteScore("owner") && canWriteScore("admin"));
check("đồng giảng / bộ môn / người ngoài KHÔNG", !canWriteScore("co_teacher") && !canWriteScore("subject_teacher") && !canWriteScore("none"));

section("Điểm gõ tay");
check("'8' / '8,5' / '8.5' / '0' / '10'", parseScoreInput("8", 10) === 8 && parseScoreInput("8,5", 10) === 8.5 && parseScoreInput(" 8.5 ", 10) === 8.5 && parseScoreInput("0", 10) === 0 && parseScoreInput("10", 10) === 10);
check("vượt tối đa / âm / chữ / rỗng / không phải chuỗi ⇒ null", [parseScoreInput("10.5", 10), parseScoreInput("-1", 10), parseScoreInput("abc", 10), parseScoreInput("", 10), parseScoreInput(8, 10), parseScoreInput("1e1", 100)].every(x => x === null));

section("Thân yêu cầu + Giao bài");
const ok = parseGiaoInput({ kind: "bai-tap", courseId: "c1", title: "  Bài tuần 3 ", dueDate: "2026-12-01" }, isValidDateKey);
check("bài tập hợp lệ: tiêu đề được cắt khoảng trắng, hạn giữ nguyên ngày", ok.ok && ok.v.kind === "bai-tap" && ok.v.title === "Bài tuần 3" && ok.v.dueKey === "2026-12-01", ok);
const noDue = parseGiaoInput({ kind: "bai-tap", courseId: "c1", title: "A" }, isValidDateKey);
check("không hạn nộp ⇒ dueKey null (KHÔNG bắt gắn vào bài học, không bắt hạn)", noDue.ok && noDue.v.kind === "bai-tap" && noDue.v.dueKey === null);
check("thiếu lớp / thiếu tiêu đề / hạn sai / loại lạ ⇒ lỗi có chữ", [
  parseGiaoInput({ kind: "bai-tap", title: "A" }, isValidDateKey), parseGiaoInput({ kind: "bai-tap", courseId: "c1", title: "  " }, isValidDateKey),
  parseGiaoInput({ kind: "bai-tap", courseId: "c1", title: "A", dueDate: "2026-02-31" }, isValidDateKey), parseGiaoInput({ kind: "khac", courseId: "c1" }, isValidDateKey),
  parseGiaoInput(null, isValidDateKey), parseGiaoInput({ kind: "quiz", courseId: "c1" }, isValidDateKey),
].every(r => !r.ok && r.error.length > 0));
const q = parseGiaoInput({ kind: "quiz", courseId: "c1", examId: "e1" }, isValidDateKey);
check("quiz có sẵn hợp lệ", q.ok && q.v.kind === "quiz" && q.v.examId === "e1");
check("tiêu đề quá 200 ký tự ⇒ lỗi", !parseGiaoInput({ kind: "bai-tap", courseId: "c1", title: "x".repeat(201) }, isValidDateKey).ok);

done();
