// SCL-G-HS — quy tắc thuần của các màn học sinh (src/lib/studentClassPage.ts): nhãn hạn, nhóm tuần, dòng lịch, xếp "Buổi gần đây", tìm bài, điểm thang 10,
// gom thẻ Cần làm (một nút chính, lọc theo lớp). Không cần máy chủ.
// Ca phá cố ý (đã chạy 21/11/2026): đổi `first.primary = true` thành gắn cho MỌI thẻ ⇒ 2 đỏ ("đúng MỘT thẻ…", "kiểm tra không bao giờ…"); trả lại ⇒ xanh.
import { check, section, done } from "./h";
import { average10, buildTodoCards, daysUntil, deadlineLine, matchesQuery, newestFirst, on10, resultDateLine, scheduleLine, submittedLine, todoBucket, vnDayLabel } from "@/lib/studentClassPage";
import type { StudentTodoItem } from "@/lib/studentTodo";
import type { ScheduleEvent } from "@/lib/studentSchedule";

// Thứ Bảy 21/11/2026, 20:00 giờ VN
const NOW = new Date("2026-11-21T13:00:00Z");
const vn = (key: string, hm: string) => new Date(`${key}T${hm}:00+07:00`);

section("Nhãn hạn và mốc nộp (giờ Việt Nam)");
check("Hạn Thứ Ba 24/11, 21:00 · còn 3 ngày", deadlineLine(vn("2026-11-24", "21:00").toISOString(), NOW) === "Hạn Thứ Ba 24/11, 21:00 · còn 3 ngày", deadlineLine(vn("2026-11-24", "21:00").toISOString(), NOW));
check("hôm nay / ngày mai", deadlineLine(vn("2026-11-21", "23:00").toISOString(), NOW).endsWith("· hôm nay") && deadlineLine(vn("2026-11-22", "07:00").toISOString(), NOW).endsWith("· ngày mai"));
check("đã qua giờ ⇒ 'Quá hạn từ Thứ Năm 19/11, 21:00'", deadlineLine(vn("2026-11-19", "21:00").toISOString(), NOW) === "Quá hạn từ Thứ Năm 19/11, 21:00");
check("kiểm tra: 'Mở lúc 19:00 Thứ Năm 26/11 · còn 5 ngày'", deadlineLine(vn("2026-11-26", "19:00").toISOString(), NOW, true) === "Mở lúc 19:00 Thứ Năm 26/11 · còn 5 ngày");
check("01:00 sáng VN của ngày 22 (= 18:00Z ngày 21) vẫn là 'ngày mai'", daysUntil(vn("2026-11-22", "01:00"), NOW) === 1);
check("Đã nộp lúc 20:41 Thứ Sáu 20/11", submittedLine(vn("2026-11-20", "20:41").toISOString()) === "Đã nộp lúc 20:41 Thứ Sáu 20/11");
check("ngày của bài: 'Thứ Ba 17/11'", vnDayLabel(vn("2026-11-17", "19:00")) === "Thứ Ba 17/11");
check("chuỗi ngày hỏng ⇒ chữ rỗng, không 'NaN'", deadlineLine("x", NOW) === "");
check("Điểm: đã chấm ⇒ 'Chấm Thứ Bảy 14/11'", resultDateLine({ state: "da-cham", submittedAt: vn("2026-11-12", "20:00").toISOString(), gradedAt: vn("2026-11-14", "09:00").toISOString() }) === "Chấm Thứ Bảy 14/11");
check("Điểm: chờ chấm ⇒ 'Nộp Thứ Sáu 20/11' (ngày chấm cũ không dùng)", resultDateLine({ state: "cho-cham", submittedAt: vn("2026-11-20", "20:41").toISOString(), gradedAt: vn("2026-11-14", "09:00").toISOString() }) === "Nộp Thứ Sáu 20/11");
check("Điểm: đã chấm nhưng thiếu ngày chấm ⇒ ngày nộp; thiếu cả hai ⇒ ''", resultDateLine({ state: "da-cham", submittedAt: vn("2026-11-20", "20:41").toISOString(), gradedAt: null }) === "Nộp Thứ Sáu 20/11" && resultDateLine({ state: "cho-duyet" }) === "");

section("Nhóm Quá hạn / Tuần này / Tuần sau / Sau đó (tuần thứ Hai → Chủ nhật)");
check("quá hạn theo GIỜ (hôm nay 19:00 khi đã 20:00)", todoBucket(vn("2026-11-21", "19:00").toISOString(), NOW) === "qua-han");
check("Chủ nhật 22/11 vẫn là tuần này", todoBucket(vn("2026-11-22", "23:59").toISOString(), NOW) === "tuan-nay");
check("Thứ Hai 23/11 sang tuần sau; Chủ nhật 29/11 vẫn tuần sau", todoBucket(vn("2026-11-23", "08:00").toISOString(), NOW) === "tuan-sau" && todoBucket(vn("2026-11-29", "08:00").toISOString(), NOW) === "tuan-sau");
check("Thứ Hai 30/11 là 'Sau đó'", todoBucket(vn("2026-11-30", "08:00").toISOString(), NOW) === "sau");

section("Dòng lịch đầu trang lớp");
const ev = (isoDate: string, time: string) => ({ isoDate, time });
check("cùng giờ: 'Thứ Ba, Thứ Năm, 19:00' (Thứ Hai đứng đầu, không lặp)", scheduleLine([ev("2026-11-26", "19:00"), ev("2026-11-24", "19:00"), ev("2026-12-01", "19:00")]) === "Thứ Ba, Thứ Năm, 19:00");
check("khác giờ: 'Thứ Ba 19:00, Thứ Năm 17:30'", scheduleLine([ev("2026-11-24", "19:00"), ev("2026-11-26", "17:30")]) === "Thứ Ba 19:00, Thứ Năm 17:30");
check("Chủ nhật xếp cuối", scheduleLine([ev("2026-11-22", "08:00"), ev("2026-11-23", "08:00")]) === "Thứ Hai, Chủ nhật, 08:00");
check("không có buổi ⇒ rỗng", scheduleLine([]) === "");

section("Buổi gần đây và tìm bài");
const ls = [{ id: "a", scheduledAt: null, createdAt: "2026-11-01T00:00:00Z" }, { id: "b", scheduledAt: "2026-11-17T12:00:00Z", createdAt: "2026-10-01T00:00:00Z" }, { id: "c", scheduledAt: null, createdAt: null }, { id: "d", scheduledAt: "2026-11-10T12:00:00Z" }];
check("mới nhất trước theo ngày học (không có thì ngày tạo); bài không ngày xuống cuối", newestFirst(ls).map(l => l.id).join("") === "bdac", newestFirst(ls).map(l => l.id));
check("tìm không dấu khớp có dấu ('he phuong trinh' ⇒ 'Hệ phương trình bậc nhất')", matchesQuery("Hệ phương trình bậc nhất", "he phuong trinh") && matchesQuery("Đường tròn", "duong") && !matchesQuery("Căn bậc hai", "hệ"));
check("ô tìm rỗng khớp mọi bài", matchesQuery("Bất kỳ", "  "));

section("Điểm thang 10");
check("17/20 ⇒ 8,5; 9/10 ⇒ 9", on10(17, 20) === "8,5" && on10(9, 10) === "9");
check("Trung bình chỉ tính ĐÃ CHẤM (chờ duyệt không tính)", average10([{ state: "da-cham", score: 8, max: 10 }, { state: "da-cham", score: 19, max: 20 }, { state: "cho-duyet", score: 2, max: 10 }]) === "8,8");
check("không bài nào đã chấm ⇒ null", average10([{ state: "cho-duyet", score: 9, max: 10 }, { state: "chua-nop", score: null, max: 10 }]) === null);

section("Gom thẻ Cần làm");
const task = (id: string, due: Date, o: Partial<NonNullable<StudentTodoItem["task"]>> = {}, phase: "chua-nop" | "cho-cham" = "chua-nop"): StudentTodoItem => ({
  id: `bai-tap:${id}`, kind: "bai-tap", title: id, subtitle: "", at: due.toISOString(), when: "", status: { label: "", tone: "mo" }, needsAction: true, done: phase !== "chua-nop",
  detail: { heading: "", meta: "", commands: [], sections: [] },
  task: { phase, name: `Bài ${id}`, courseLine: "Toán 9 · Cô Lan", courseId: "lopA", dueText: "", href: `/student/bai-giang/l-${id}`, interactive: false, ...o },
});
const exam = (id: string, isoDate: string, time: string, courseId?: string): ScheduleEvent => ({ id: `exam-${id}`, type: "exam", subject: "Toán", topic: `Kiểm tra ${id}`, time, isoDate, courseId });
const dl = (id: string, isoDate: string, subject: string, link?: string): ScheduleEvent => ({ id: `deadline-${id}`, type: "deadline", subject, topic: `Azota ${id}`, time: "21:00", isoDate, link });
const items = [task("sau", vn("2026-11-28", "21:00")), task("gan", vn("2026-11-24", "21:00")), task("qh", vn("2026-11-19", "21:00")), task("web", vn("2026-11-25", "21:00"), { interactive: true }),
  task("khac", vn("2026-11-23", "21:00"), { courseId: "lopB" }), task("danop", vn("2026-11-23", "21:00"), {}, "cho-cham")];
const events = [exam("15p", "2026-11-22", "19:00", "lopA"), exam("cu", "2026-11-20", "19:00", "lopA"), dl("az", "2026-11-26", "Toán 9", "https://azota.vn/x"), dl("nolink", "2026-11-26", "Toán 9")];
const name = (id: string) => (id === "lopA" ? "Toán 9" : id === "lopB" ? "Vật lý 9" : "");
const all = buildTodoCards(items, events, NOW, name);
check("xếp theo hạn: quá hạn đầu tiên", all[0]?.key === "bai-tap:qh" && all[0].tone === "qua-han", all.map(c => c.key));
check("bài đã nộp không thành thẻ; kiểm tra đã qua giờ và hạn ngoài không có link bị bỏ", !all.some(c => ["bai-tap:danop", "exam-cu", "deadline-nolink"].includes(c.key)));
check("đúng MỘT thẻ có nút chính, và đó là bài tập hạn gần nhất (bài quá hạn)", all.filter(c => c.primary).length === 1 && all.find(c => c.primary)?.key === "bai-tap:qh");
check("kiểm tra không bao giờ mang nút chính, kể cả khi hạn sớm nhất", buildTodoCards([], [exam("x", "2026-11-22", "08:00", "lopA"), dl("y", "2026-11-26", "Toán 9", "https://azota.vn/y")], NOW, name).filter(c => c.primary).map(c => c.key).join() === "deadline-y");
check("bài nộp tệp ⇒ 'nop' kèm mã bài; làm trên web ⇒ 'lam'; Azota ⇒ 'ngoai'; đề ⇒ 'thi'",
  all.find(c => c.key === "bai-tap:gan")?.action.type === "nop" && (all.find(c => c.key === "bai-tap:gan")?.action as { assignmentId?: string }).assignmentId === "gan"
  && all.find(c => c.key === "bai-tap:web")?.action.type === "lam" && all.find(c => c.key === "deadline-az")?.action.type === "ngoai" && all.find(c => c.key === "exam-15p")?.action.type === "thi");
check("tên lớp tra theo mã lớp", all.find(c => c.key === "bai-tap:khac")?.courseName === "Vật lý 9" && all.find(c => c.key === "exam-15p")?.courseName === "Toán 9");
const onlyA = buildTodoCards(items, events, NOW, name, { id: "lopA", name: "Toán 9" });
check("trang lớp: chỉ việc của lớp đó (bài theo mã lớp, hạn Azota theo tên lớp)", !onlyA.some(c => c.key === "bai-tap:khac") && onlyA.some(c => c.key === "deadline-az") && onlyA.some(c => c.key === "exam-15p"), onlyA.map(c => c.key));
check("lớp khác không thấy hạn Azota của Toán 9", !buildTodoCards(items, events, NOW, name, { id: "lopB", name: "Vật lý 9" }).some(c => c.key === "deadline-az"));

done();
