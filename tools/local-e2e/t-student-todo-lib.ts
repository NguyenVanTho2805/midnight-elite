// "Việc của tôi" của học sinh — quy tắc thuần (src/lib/studentTodo.ts).
import { check, section, done } from "./h";
import { buildStudentTodo, dueTextOf, fmtScore, remainingText, whenLabel, MAX_ITEMS, type TodoAssignment, type TodoEvent } from "@/lib/studentTodo";

// Thứ Ba 13/10/2026 20:00 giờ VN
const NOW = new Date("2026-10-13T13:00:00Z");
const vn = (key: string, hm: string) => new Date(`${key}T${hm}:00+07:00`);
const base = (o: Partial<TodoAssignment>): TodoAssignment => ({
  id: "a1", title: "Bài tập Vi-ét", instructions: null, fileUrl: null, maxPoints: 25, dueDate: vn("2026-10-13", "23:59"), mode: "file",
  createdAt: vn("2026-10-12", "09:00"), lessonId: "l1", courseName: "Toán 9", teacher: "thầy Thanh", submission: null, answeredCount: 0, ...o,
});
const run = (assignments: TodoAssignment[], events: TodoEvent[] = []) => buildStudentTodo({ assignments, events, now: NOW });
const find = (r: ReturnType<typeof run>, id: string) => r.items.find(i => i.id === id);

section("Định dạng");
check("điểm theo cách viết Việt: 18,4 · 25 · 7,25", fmtScore(18.4) === "18,4" && fmtScore(25) === "25" && fmtScore(7.25) === "7,25");
check("còn 3 giờ 50 phút", remainingText(new Date(NOW.getTime() + (3 * 60 + 50) * 60_000), NOW) === "còn 3 giờ 50 phút");
check("còn 2 ngày / còn 2 ngày 5 giờ", remainingText(new Date(NOW.getTime() + 48 * 3_600_000), NOW) === "còn 2 ngày" && remainingText(new Date(NOW.getTime() + 53 * 3_600_000), NOW) === "còn 2 ngày 5 giờ");
check("quá hạn 1 giờ 5 phút", remainingText(new Date(NOW.getTime() - 65 * 60_000), NOW) === "quá hạn 1 giờ 5 phút");
check("dưới 1 phút vẫn báo ≥ 1 phút", remainingText(new Date(NOW.getTime() + 20_000), NOW) === "còn 1 phút");
check("nhãn ngày: Hôm nay / Ngày mai / thứ / dd/mm", whenLabel(vn("2026-10-13", "23:00"), NOW) === "Hôm nay" && whenLabel(vn("2026-10-14", "08:00"), NOW) === "Ngày mai"
  && whenLabel(vn("2026-10-16", "08:00"), NOW) === "Thứ 6" && whenLabel(vn("2026-10-25", "08:00"), NOW) === "25/10" && whenLabel(vn("2026-10-09", "08:00"), NOW) === "09/10");
check("nhãn ngày tính theo giờ VN (23:30 VN = 16:30Z vẫn là hôm nay)", whenLabel(new Date("2026-10-13T16:30:00Z"), NOW) === "Hôm nay" && whenLabel(new Date("2026-10-13T17:30:00Z"), NOW) === "Ngày mai");

section("Bài tập chưa nộp");
const due = run([base({})]).items[0];
check("hạn 23:59 hôm nay, còn 3 giờ 59 phút → 'Sắp hết hạn' (cam), cần ra tay", due.status.label === "Sắp hết hạn" && due.status.tone === "cho" && due.needsAction && !due.done, due.status);
check("tiêu đề ghi rõ hạn như Figma ('hạn 23:59 hôm nay')", due.title === "Bài tập Vi-ét hạn 23:59 hôm nay", due.title);
check("dòng phụ: lớp · thầy giao dd/mm", due.subtitle === "Toán 9 · thầy Thanh giao 12/10", due.subtitle);
check("khung đọc: meta có 'còn 3 giờ 59 phút'", due.detail.meta.includes("còn 3 giờ 59 phút"), due.detail.meta);
check("nút chính 'Nộp bài' trỏ tới bài giảng chứa bài tập", due.detail.commands[0].label === "Nộp bài" && due.detail.commands[0].href === "/student/bai-giang/l1" && due.detail.commands[0].kind === "primary");
check("khung đọc nói rõ 'Chưa nộp lần nào' + 'Nộp lại sẽ ghi đè bản cũ'", due.detail.sections.some(s => s.title === "Chưa nộp lần nào" && s.text.includes("ghi đè")));
check("có file đề → thêm nút 'Xem đề' mở tab ngoài", (() => { const c = run([base({ fileUrl: "https://x.test/de.pdf" })]).items[0].detail.commands; return c.length === 2 && c[1].label === "Xem đề" && c[1].external === true && c[1].href === "https://x.test/de.pdf"; })());
check("hạn sau 2 ngày: 'Cần nộp' và vẫn cần ra tay (≤ 3 ngày)", (() => { const i = run([base({ dueDate: vn("2026-10-15", "12:00") })]).items[0]; return i.status.label === "Cần nộp" && i.needsAction; })());
check("hạn sau 5 ngày: hiện nhưng CHƯA tính vào badge", (() => { const i = run([base({ dueDate: vn("2026-10-18", "12:00") })]).items[0]; return i.status.label === "Cần nộp" && !i.needsAction; })());
check("quá hạn 2 giờ: 'Quá hạn' (đỏ), cần ra tay", (() => { const i = run([base({ dueDate: new Date(NOW.getTime() - 2 * 3_600_000) })]).items[0]; return i.status.label === "Quá hạn" && i.status.tone === "loi" && i.needsAction; })());
check("quá hạn 20 ngày: thôi hiện", run([base({ dueDate: new Date(NOW.getTime() - 20 * 86_400_000) })]).items.length === 0);
check("bài không có hạn: không vào 'Việc của tôi'", run([base({ dueDate: null })]).items.length === 0);
check("bài làm trực tiếp trên web: nút 'Làm bài'", run([base({ mode: "interactive" })]).items[0].detail.commands[0].label === "Làm bài");

section("Bài đã nộp / đã chấm");
const sub = run([base({ submission: { submittedAt: vn("2026-10-13", "19:10"), score: null, gradedAt: null, comment: null } })]).items[0];
check("đã nộp, chưa chấm: 'Đã nộp' (xám), KHÔNG cần ra tay, xếp vào việc xong", sub.status.label === "Đã nộp" && !sub.needsAction && sub.done, sub);
check("khung đọc: 'Đã nộp lúc 19:10 13/10' + đang chờ chấm", sub.detail.sections[0].title === "Đã nộp lúc 19:10 13/10" && sub.detail.sections[0].text.includes("chờ"));
check("còn hạn thì nhắc 'Nộp lại sẽ ghi đè bản cũ'", sub.detail.sections.some(s => s.text.includes("ghi đè")));
const gr = run([base({ submission: { submittedAt: vn("2026-10-12", "10:00"), score: 18.4, gradedAt: vn("2026-10-12", "20:00"), comment: "Làm tốt phần hàm số." } })]).items[0];
check("đã chấm: 'Đã chấm' (xanh), điểm 18,4/25, kèm nhận xét", gr.status.label === "Đã chấm" && gr.status.tone === "xong" && gr.subtitle.startsWith("18,4/25") && gr.detail.sections[0].title === "Điểm 18,4/25" && gr.detail.sections[0].text === "Làm tốt phần hàm số.", gr);
check("chấm xong không có nhận xét → nói rõ 'chưa ghi nhận xét'", run([base({ submission: { submittedAt: vn("2026-10-12", "10:00"), score: 20, gradedAt: vn("2026-10-12", "20:00"), comment: null } })]).items[0].detail.sections[0].text.includes("chưa ghi nhận xét"));
check("đã chấm quá 14 ngày: thôi hiện", run([base({ submission: { submittedAt: vn("2026-09-01", "10:00"), score: 10, gradedAt: new Date(NOW.getTime() - 15 * 86_400_000), comment: null } })]).items.length === 0);
check("bài web đã trả lời ≥ 1 câu: 'Đã làm'", (() => { const i = run([base({ mode: "interactive", answeredCount: 3 })]).items[0]; return i.status.label === "Đã làm" && i.done && !i.needsAction; })());

section("Buổi học & hạn nộp ngoài");
const ev = (o: Partial<TodoEvent>): TodoEvent => ({ id: "class-s1-2026-10-13", type: "class", subject: "toan", topic: "Toán 9 — Ca tối", time: "21:00", isoDate: "2026-10-13", link: "/student/hoc-tap?course=c1", ...o });
const cl = run([], [ev({})]).items[0];
check("buổi 21:00 hôm nay: 'Sắp tới', không tính badge", cl.kind === "buoi-hoc" && cl.status.label === "Sắp tới" && !cl.needsAction && cl.when === "Hôm nay", cl);
check("nút 'Vào lớp' (đường dẫn của lớp) + 'Xem lịch'", cl.detail.commands[0].label === "Vào lớp" && cl.detail.commands[0].href === "/student/hoc-tap?course=c1" && cl.detail.commands[1].label === "Xem lịch");
check("buổi hôm qua: không hiện", run([], [ev({ isoDate: "2026-10-12" })]).items.length === 0);
check("buổi sau 4 ngày: chưa hiện (chỉ 3 ngày tới)", run([], [ev({ isoDate: "2026-10-17" })]).items.length === 0 && run([], [ev({ isoDate: "2026-10-16" })]).items.length === 1);
check("buổi đã bắt đầu 1 giờ trước vẫn hiện (còn vào kịp)", run([], [ev({ time: "19:00" })]).items.length === 1 && run([], [ev({ time: "17:30" })]).items.length === 0);
const cx = run([], [ev({ topic: "[ĐÃ HUỶ] Toán 9 — Ca tối" })]).items[0];
check("buổi bị gia sư huỷ: 'Đã huỷ' (đỏ), chỉ có nút 'Xem lịch', không nút 'Vào lớp'", cx.status.label === "Đã huỷ" && cx.status.tone === "loi" && cx.title.startsWith("Buổi đã huỷ") && cx.detail.commands.length === 1 && cx.detail.commands[0].label === "Xem lịch", cx);
check("tiêu đề buổi huỷ không dính chữ '[ĐÃ HUỶ]'", !cx.subtitle.includes("[") && !cx.detail.heading.includes("["), cx.detail);
const mv = run([], [ev({ topic: "[DỜI từ 12/10] Toán 9 — Ca tối" })]).items[0];
check("buổi dời: 'Đã dời' (cam) và báo giờ là giờ mới", mv.status.label === "Đã dời" && mv.detail.sections[0].title.includes("dời"), mv.status);
check("buổi thi (exam) không vào 'Việc của tôi'", run([], [ev({ type: "exam" })]).items.length === 0);
const dl = run([], [ev({ id: "deadline-l9", type: "deadline", topic: "Phiếu Azota số 4", time: "23:59", isoDate: "2026-10-15", link: "https://azota.vn/x" })]).items[0];
check("hạn nộp ngoài trong 3 ngày: cần ra tay, nút 'Mở bài' mở tab ngoài, nói rõ KiN không biết đã nộp chưa", dl.kind === "han-nop" && dl.needsAction && dl.detail.commands[0].external === true && dl.detail.sections[0].text.includes("không biết"), dl);
check("hạn nộp ngoài sau 10 ngày: chưa hiện", run([], [ev({ id: "deadline-l9", type: "deadline", isoDate: "2026-10-23", time: "23:59" })]).items.length === 0);

section("Sắp xếp + badge");
const mix = run([
  base({ id: "late", title: "Bài trễ", dueDate: new Date(NOW.getTime() - 3_600_000) }),
  base({ id: "today", title: "Bài hôm nay" }),
  base({ id: "later", title: "Bài xa", dueDate: vn("2026-10-20", "12:00") }),
  base({ id: "done1", title: "Bài cũ", submission: { submittedAt: vn("2026-10-10", "10:00"), score: 9, gradedAt: vn("2026-10-11", "10:00"), comment: null } }),
  base({ id: "done2", title: "Bài mới", submission: { submittedAt: vn("2026-10-12", "10:00"), score: 8, gradedAt: vn("2026-10-12", "21:00"), comment: null } }),
], [ev({})]);
const order = mix.items.map(i => i.id);
check("thứ tự: cần ra tay (trễ trước, rồi hôm nay) → buổi sắp tới/hạn xa → việc đã xong (mới nhất trước)", JSON.stringify(order) === JSON.stringify(["bai-tap:late", "bai-tap:today", "buoi-hoc:class-s1-2026-10-13", "bai-tap:later", "bai-tap:done2", "bai-tap:done1"]), order);
check("badge = số việc cần ra tay (2: bài trễ + bài hôm nay), không đếm buổi học/bài đã xong", mix.badge === 2, mix.badge);
check("không có việc → badge 0, danh sách rỗng", (() => { const r = run([]); return r.badge === 0 && r.items.length === 0; })());
check(`tối đa ${MAX_ITEMS} dòng`, run(Array.from({ length: 80 }, (_, i) => base({ id: `x${i}`, dueDate: new Date(NOW.getTime() + (i + 1) * 3_600_000) }))).items.length === MAX_ITEMS);
check("cùng giờ thì thứ tự ổn định theo id (không nhảy giữa các lần tải)", JSON.stringify(run([base({ id: "b" }), base({ id: "a" })]).items.map(i => i.id)) === JSON.stringify(["bai-tap:a", "bai-tap:b"]));

section("Mảnh chữ cho màn Figma Học sinh (task / session)");
check("hạn viết dạng Figma: 'hạn hôm nay, 23:59' / 'ngày mai' / 'Thứ 6 16/10' / '25/10'", dueTextOf(vn("2026-10-13", "23:59"), NOW) === "hạn hôm nay, 23:59" && dueTextOf(vn("2026-10-14", "21:00"), NOW) === "hạn ngày mai, 21:00"
  && dueTextOf(vn("2026-10-16", "08:00"), NOW) === "hạn Thứ 6 16/10, 08:00" && dueTextOf(vn("2026-10-25", "08:00"), NOW) === "hạn 25/10, 08:00");
const tk = run([base({})]).items[0].task!;
check("bài chưa nộp: phase chua-nop, tên trần, dòng lớp 'Toán 9 · thầy Thanh', đường dẫn bài giảng", tk.phase === "chua-nop" && tk.name === "Bài tập Vi-ét" && tk.courseLine === "Toán 9 · thầy Thanh" && tk.href === "/student/bai-giang/l1" && tk.dueText === "hạn hôm nay, 23:59", tk);
const tsub = run([base({ submission: { submittedAt: vn("2026-10-13", "19:10"), score: null, gradedAt: null, comment: null } })]).items[0].task!;
check("bài đã nộp: phase cho-cham, 'Nộp 13/10 lúc 19:10'", tsub.phase === "cho-cham" && tsub.sentText === "Nộp 13/10 lúc 19:10", tsub);
const tgr = run([base({ submission: { submittedAt: vn("2026-10-12", "10:00"), score: 18.4, gradedAt: vn("2026-10-12", "20:00"), comment: "Làm tốt." } })]).items[0].task!;
check("bài đã chấm: phase da-cham, điểm '18,4/25', 'Đã chấm 12/10', nhận xét", tgr.phase === "da-cham" && tgr.scoreText === "18,4/25" && tgr.gradedText === "Đã chấm 12/10" && tgr.comment === "Làm tốt.", tgr);
check("chấm xong không nhận xét → comment null (màn hình không bịa lời)", run([base({ submission: { submittedAt: vn("2026-10-12", "10:00"), score: 20, gradedAt: vn("2026-10-12", "20:00"), comment: "  " } })]).items[0].task!.comment === null);
const ss = run([], [ev({ topic: "Toán 9 — Học live qua Zoom", endTime: "22:30" })]).items[0].session!;
check("buổi học: giờ '21:00–22:30', tên lớp tách khỏi ghi chú, đường dẫn lớp", ss.range === "21:00–22:30" && ss.courseLine === "Toán 9" && ss.topic === "Học live qua Zoom" && ss.href === "/student/hoc-tap?course=c1" && !ss.cancelled, ss);
check("buổi không có giờ kết thúc → chỉ giờ bắt đầu; buổi huỷ có cờ cancelled", run([], [ev({})]).items[0].session!.range === "21:00" && run([], [ev({ topic: "[ĐÃ HUỶ] Toán 9" })]).items[0].session!.cancelled === true);

done();
