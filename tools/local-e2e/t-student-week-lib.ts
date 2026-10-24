// Lịch tuần của học sinh — phần thuần (src/lib/studentWeek.ts): tuần thứ Hai → Chủ nhật, gộp buổi học / thi / hạn nộp / hạn bài tập.
import { check, section, done } from "./h";
import { buildWeekItems, gridHours, mondayOf, weekKeys } from "@/lib/studentWeek";
import { buildStudentTodo, type TodoAssignment } from "@/lib/studentTodo";
import type { ScheduleEvent } from "@/lib/studentSchedule";

section("Tuần");
check("thứ Sáu 23/10/2026 → thứ Hai 19/10", mondayOf("2026-10-23") === "2026-10-19");
check("Chủ nhật 25/10 vẫn thuộc tuần 19/10 (không nhảy sang tuần sau)", mondayOf("2026-10-25") === "2026-10-19");
check("thứ Hai chính nó; qua tháng: thứ Tư 01/10/2026 → thứ Hai 28/09", mondayOf("2026-10-19") === "2026-10-19" && mondayOf("2026-10-01") === "2026-09-28");
check("7 ngày liền nhau, kết thúc Chủ nhật", JSON.stringify(weekKeys("2026-10-19")) === JSON.stringify(["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25"]));

section("Gộp mục");
const NOW = new Date("2026-10-23T05:00:00Z"); // 12:00 thứ Sáu giờ VN
const vn = (k: string, hm: string) => new Date(`${k}T${hm}:00+07:00`);
const ev = (o: Partial<ScheduleEvent>): ScheduleEvent => ({ id: "class-1-2026-10-23", type: "class", subject: "toan", topic: "Toán 9 — Học qua Meet", time: "19:00", endTime: "20:30", isoDate: "2026-10-23", link: "/student/hoc-tap?course=c1", ...o });
const asg: TodoAssignment = { id: "a1", title: "Phương trình bậc hai", instructions: null, fileUrl: null, maxPoints: 10, dueDate: vn("2026-10-23", "23:59"), mode: "interactive", createdAt: vn("2026-10-20", "09:00"), lessonId: "l1", courseName: "Toán 9", teacher: "Cô Lan", submission: null, answeredCount: 0 };
const todo = buildStudentTodo({ assignments: [asg, { ...asg, id: "a2", title: "Đã nộp rồi", submission: { submittedAt: vn("2026-10-22", "20:40"), score: null, gradedAt: null, comment: null } }], events: [], now: NOW }).items;
const items = buildWeekItems([
  ev({}),
  ev({ id: "class-1-2026-10-24", isoDate: "2026-10-24", topic: "[ĐÃ HUỶ] Toán 9", endTime: undefined }),
  ev({ id: "exam-e1", type: "exam", topic: "Thi giữa kỳ", time: "19:00", isoDate: "2026-10-26", link: undefined, meta: "10 câu · 15 phút", endTime: undefined }),
  ev({ id: "deadline-l9", type: "deadline", topic: "Phiếu Azota", time: "21:00", isoDate: "2026-10-25", link: "https://azota.vn/x", endTime: undefined }),
  ev({ id: "bad", time: "giờ hỏng" }),
], todo);
const by = (id: string) => items.find(i => i.id === id);
check("giờ hỏng bị bỏ, không làm hỏng cả tuần", !by("bad") && items.length === 5, items.map(i => i.id));
check("buổi học: khoảng 19:00–20:30 (1140–1230 phút), tên lớp tách ghi chú", by("class-1-2026-10-23")!.start === 1140 && by("class-1-2026-10-23")!.end === 1230 && by("class-1-2026-10-23")!.title === "Toán 9" && by("class-1-2026-10-23")!.sub === "Học qua Meet");
check("buổi huỷ có cờ cancelled và không dính '[ĐÃ HUỶ]'", by("class-1-2026-10-24")!.cancelled && !by("class-1-2026-10-24")!.title.includes("["));
check("buổi thi không có link ngoài → vào màn thi trong KiN /student/thi-thu/e1", by("exam-e1")!.href === "/student/thi-thu/e1" && !by("exam-e1")!.external);
check("hạn nộp ngoài (Azota) mở tab ngoài", by("deadline-l9")!.external === true && by("deadline-l9")!.kind === "deadline");
const task = by("bai-tap:a1")!;
check("hạn bài tập trên KiN: kind task, 23:59 giờ VN, ngày 23/10, chưa nộp, bài làm trên web", task.kind === "task" && task.dateKey === "2026-10-23" && task.start === 23 * 60 + 59 && task.unsent && task.interactive, task);
check("bài ĐÃ nộp không thành hạn nộp trên lịch", !by("bai-tap:a2"));
check("thứ tự: buổi 19:00 trước hạn 23:59 cùng ngày", items.filter(i => i.dateKey === "2026-10-23").map(i => i.id).join() === "class-1-2026-10-23,bai-tap:a1");

section("Khoảng giờ của lưới");
check("không có mục → 08:00–21:00", JSON.stringify(gridHours([])) === JSON.stringify({ from: 8, to: 21 }));
check("hạn 23:59 nới lưới tới 24:00; buổi 06:30 nới từ 06:00", gridHours(items).to === 24 && gridHours([{ ...items[0], start: 390, end: 450 }]).from === 6);
done();
