// Lịch tuần của học sinh — phần thuần (src/lib/studentWeek.ts): tuần thứ Hai → Chủ nhật, gộp buổi học / thi / hạn nộp / hạn bài tập.
import { check, section, done } from "./h";
import { buildWeekItems, gridHours, mergeWeekItems, mondayOf, personalWeekItems, KIND_LABEL, weekKeys } from "@/lib/studentWeek";
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
section("NC2-043 — việc RIÊNG của học sinh trong lịch tuần");
const pe = (o: Partial<{ id: string; title: string; dateKey: string; startTime: string; endTime: string | null; note: string | null }> = {}) => ({ id: "p1", title: "Học thêm Toán", dateKey: "2026-10-23", startTime: "19:00", endTime: "20:30", note: "Mang máy tính", ...o });
const pi = personalWeekItems([pe()]);
check("một việc riêng → mục kind 'personal', giờ 19:00–20:30 (phút), id 'rieng:<id>', mang personalId + ghi chú, không có đường dẫn", pi.length === 1 && pi[0].kind === "personal" && pi[0].start === 1140 && pi[0].end === 1230 && pi[0].id === "rieng:p1" && pi[0].personalId === "p1" && pi[0].note === "Mang máy tính" && pi[0].href === "" && !pi[0].external);
check("nhãn loại là 'Việc riêng'", KIND_LABEL.personal === "Việc riêng");
check("không giờ kết thúc → end null; giờ kết thúc không sau giờ bắt đầu (dữ liệu hỏng) → end null, không ném lỗi", personalWeekItems([pe({ endTime: null })])[0].end === null && personalWeekItems([pe({ endTime: "18:00" })])[0].end === null);
check("giờ bắt đầu hỏng → bỏ qua mục đó, các mục khác vẫn còn", personalWeekItems([pe({ id: "bad", startTime: "xx" }), pe({ id: "ok" })]).map(x => x.personalId).join() === "ok");
check("danh sách rỗng → rỗng", personalWeekItems([]).length === 0);
const merged = mergeWeekItems(items, personalWeekItems([pe({ id: "sang", startTime: "06:00", endTime: null, dateKey: "2026-10-23" }), pe({ id: "toi", startTime: "23:30", endTime: null, dateKey: "2026-10-23" })]));
check("gộp với lịch lớp rồi xếp theo ngày, giờ (việc 06:00 đứng trước, 23:30 đứng sau mục cùng ngày)", merged.length === items.length + 2 && merged.every((m, i) => i === 0 || m.dateKey > merged[i - 1].dateKey || (m.dateKey === merged[i - 1].dateKey && m.start >= merged[i - 1].start)), merged.map(m => `${m.dateKey} ${m.start}`));
const idsBefore = items.map(i => i.id).join();
mergeWeekItems(items, personalWeekItems([pe({ id: "z", startTime: "01:00" })]));
check("gộp không đổi (không xáo, không thêm) mảng đầu vào", items.map(i => i.id).join() === idsBefore && merged !== items);
check("lưới giãn ra cho vừa việc riêng 06:00 và 23:30", gridHours(merged).from <= 6 && gridHours(merged).to >= 24);

done();
