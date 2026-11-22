// SCL đợt 5 — logic thuần mới của màn học sinh (src/lib/studentClassPage.ts, src/lib/trial.ts): chuỗi giữ nhịp, buổi kế tiếp, mốc hết học thử,
// nhãn vào phòng, "Mở từ", bậc thang trang bài. Không cần máy chủ.
// Có CA PHÁ CỐ Ý chạy ngay trong bài: bản nhipLien đảo điều kiện "vang" phải trượt ít nhất một ca — nếu bộ ca không bắt được bản hỏng thì bài đỏ.
// Ca phá trên mã THẬT (đã chạy 23/11/2026): đổi `!== "vang"` thành `=== "vang"` trong nhipLien của studentClassPage.ts ⇒ 6 đỏ / 25 xanh; trả lại ⇒ 31 xanh.
// Chạy: TZ=Asia/Ho_Chi_Minh npx tsx tools/local-e2e/t-scl5-lib.ts (kết quả không phụ thuộc TZ máy: thử thêm TZ=UTC).
import { check, section, done } from "./h";
import { joinLabel, lessonSteps, nextClass, nhatKyStatus, nhipLien, opensLine, trialEndLine, vnWeekdayDate, type NhatKyStatus } from "@/lib/studentClassPage";
import { trialView } from "@/lib/trial";
import type { ScheduleEvent } from "@/lib/studentSchedule";

const vn = (key: string, hm: string) => new Date(`${key}T${hm}:00+07:00`);
const NOW = vn("2026-11-23", "20:00"); // Thứ Hai 23/11/2026, 20:00 giờ VN
const s = (...xs: NhatKyStatus[]) => xs.map(status => ({ status }));

// ── nhipLien: bộ ca dùng cho cả hàm thật lẫn bản phá cố ý ──
const NHIP_CASES: [string, { status: NhatKyStatus }[], number][] = [
  ["rỗng ⇒ 0", [], 0],
  ["vắng ở giữa: chỉ đếm sau buổi vắng cuối (vắng, có mặt, nghỉ báo, có mặt ⇒ 3)", s("vang", "co-mat", "nghi-bao", "co-mat"), 3],
  ["toàn nghỉ có báo ⇒ vẫn giữ nhịp cả 4 buổi", s("nghi-bao", "nghi-bao", "nghi-bao", "nghi-bao"), 4],
  ["buổi mới nhất vắng ⇒ 0 (dù trước đó có mặt nhiều)", s("co-mat", "co-mat", "co-mat", "vang"), 0],
  ["toàn có mặt ⇒ đếm hết", s("co-mat", "co-mat"), 2],
  ["hai buổi vắng xen kẽ ⇒ chỉ đếm đoạn cuối", s("co-mat", "vang", "co-mat", "vang", "nghi-bao"), 1],
];
const passes = (f: (x: { status: NhatKyStatus }[]) => number) => NHIP_CASES.filter(([, xs, want]) => f(xs) === want).length;

section("nhipLien — chuỗi giữ nhịp (nghỉ có báo vẫn giữ, gặp vắng thì dừng)");
for (const [name, xs, want] of NHIP_CASES) check(name, nhipLien(xs) === want, { got: nhipLien(xs), want });
check("nhatKyStatus: present/late ⇒ có mặt, excused ⇒ nghỉ có báo, absent ⇒ vắng, lạ ⇒ null (không đoán)",
  nhatKyStatus("present") === "co-mat" && nhatKyStatus("late") === "co-mat" && nhatKyStatus("excused") === "nghi-bao" && nhatKyStatus("absent") === "vang" && nhatKyStatus("x") === null);

section("CA PHÁ CỐ Ý: nhipLien đảo điều kiện 'vang' phải bị bắt");
const broken = (items: { status: NhatKyStatus }[]) => { let n = 0; for (let i = items.length - 1; i >= 0 && items[i].status === "vang"; i--) n++; return n; }; // đảo !== thành ===
const brokenSkip = (items: { status: NhatKyStatus }[]) => items.filter(i => i.status !== "vang").length; // đếm tổng, quên dừng ở buổi vắng
check("bản đảo 'vang' trượt ít nhất 1 ca", passes(broken) < NHIP_CASES.length, { pass: passes(broken), of: NHIP_CASES.length });
check("bản quên dừng ở buổi vắng trượt ít nhất 1 ca", passes(brokenSkip) < NHIP_CASES.length, { pass: passes(brokenSkip), of: NHIP_CASES.length });
check("hàm thật qua đủ mọi ca", passes(nhipLien) === NHIP_CASES.length);

section("nextClass — buổi học kế tiếp");
const ev = (id: string, isoDate: string, time: string, o: Partial<ScheduleEvent> = {}): ScheduleEvent => ({ id, type: "class", subject: "Toán 12", topic: "Toán 12", time, isoDate, ...o });
const events = [
  ev("huy", "2026-11-23", "20:30", { topic: "[ĐÃ HUỶ] Toán 12", courseId: "A" }),
  ev("dang", "2026-11-23", "19:30", { endTime: "21:00", courseId: "A" }),
  ev("xong", "2026-11-23", "17:00", { endTime: "18:30", courseId: "A" }),
  ev("mai-B", "2026-11-24", "18:00", { courseId: "B" }),
  ev("mai-A", "2026-11-24", "21:00", { courseId: "A" }),
  ev("thi", "2026-11-23", "20:10", { type: "exam", courseId: "A" }),
];
const n1 = nextClass(events, NOW);
check("buổi đang diễn ra (19:30–21:00, bây giờ 20:00) vẫn là buổi kế tiếp, today = true", n1?.event.id === "dang" && n1.today === true, n1?.event.id);
check("buổi đã huỷ và buổi đã kết thúc bị bỏ; buổi thi không tính", !events.filter(e => ["huy", "xong", "thi"].includes(e.id)).some(e => e.id === n1?.event.id));
check("lọc courseId=B ⇒ buổi của B ngày mai, today = false", nextClass(events, NOW, "B")?.event.id === "mai-B" && nextClass(events, NOW, "B")?.today === false);
check("buổi không ghi giờ kết thúc: coi như dài 2 giờ (19:00 bắt đầu, 20:00 vẫn tính)", nextClass([ev("k", "2026-11-23", "19:00")], NOW)?.event.id === "k" && nextClass([ev("k", "2026-11-23", "17:59")], NOW) === null);
check("chỉ còn buổi huỷ ⇒ null", nextClass([events[0]], NOW) === null);

section("trialView — hình dạng gửi giao diện");
const D = 86_400_000;
check("hết hạn ⇒ null (máy chủ không gửi băng, chỉ cờ khoá)", trialView({ trialDays: 14, trialStartedAt: new Date(NOW.getTime() - 15 * D) }, NOW) === null);
check("chính thức (trialDays null) ⇒ null", trialView({ trialDays: null, trialStartedAt: new Date(NOW.getTime() - 3 * D) }, NOW) === null);
const tv = trialView({ trialDays: 10, trialStartedAt: new Date(NOW.getTime() - 3 * D) }, NOW);
check("đang thử: mang trialDays THẬT (10, không ghi cứng 14) + endsAt ISO + còn 7 ngày", tv?.kind === "dang_thu" && tv.trialDays === 10 && tv.daysLeft === 7 && tv.endsAt === new Date(NOW.getTime() + 7 * D).toISOString(), tv);
const cb = trialView({ trialDays: 7, trialStartedAt: null }, NOW);
check("chưa bắt đầu: kind chua_bat_dau + trialDays 7", cb?.kind === "chua_bat_dau" && cb.trialDays === 7, cb);

section("trialEndLine — mốc hết học thử (không bao giờ hứa thêm giờ)");
check("21:40 Thứ Tư 25/11 giữ nguyên giờ", trialEndLine(vn("2026-11-25", "21:40").toISOString()) === "21:40 Thứ Tư 25/11", trialEndLine(vn("2026-11-25", "21:40").toISOString()));
check("00:04 Thứ Năm 26/11 ⇒ '23:59 Thứ Tư 25/11' (đêm trước, sớm hơn mốc thật)", trialEndLine(vn("2026-11-26", "00:04").toISOString()) === "23:59 Thứ Tư 25/11", trialEndLine(vn("2026-11-26", "00:04").toISOString()));
check("05:59 vẫn quy về đêm trước; 06:00 giữ giờ thật", trialEndLine(vn("2026-11-26", "05:59").toISOString()) === "23:59 Thứ Tư 25/11" && trialEndLine(vn("2026-11-26", "06:00").toISOString()) === "06:00 Thứ Năm 26/11");
check("chuỗi hỏng ⇒ ''", trialEndLine("khong-phai-ngay") === "");
check("vnWeekdayDate: 'Chủ nhật 29/11', 'Thứ Hai 30/11' (D18, chữ đầu hoa)", vnWeekdayDate(vn("2026-11-29", "10:00")) === "Chủ nhật 29/11" && vnWeekdayDate(vn("2026-11-30", "10:00")) === "Thứ Hai 30/11");

section("joinLabel / opensLine");
check("Meet: 'Vào Google Meet · từ 21:45' (30 phút trước 22:15)", joinLabel("https://meet.google.com/abc-defg-hij", "22:15") === "Vào Google Meet · từ 21:45");
check("link khác: 'Vào phòng học online · từ 23:40' qua nửa đêm đúng", joinLabel("https://zoom.us/j/1", "00:10") === "Vào phòng học online · từ 23:40");
check("giờ hỏng / link hỏng: chỉ tên, không bịa giờ", joinLabel("khong-phai-link", "??") === "Vào phòng học online");
check("opensLine: ngày mai ⇒ 'Mở từ 24/11'; hôm nay / đã qua / null ⇒ ''", opensLine(vn("2026-11-24", "08:00"), NOW) === "Mở từ 24/11" && opensLine(vn("2026-11-23", "23:00"), NOW) === "" && opensLine(vn("2026-11-01", "08:00"), NOW) === "" && opensLine(null, NOW) === "");

section("lessonSteps — bậc thang chỉ gồm phần bài thật có");
const a = lessonSteps({ video: true, docs: 1, assignments: [{ submitted: true }], azota: null, completed: false });
check("video + 1 tài liệu + 1 bài nộp + bước cuối ⇒ 4 bước, xong 1 (chỉ bài đã nộp)", a.steps.map(x => x.key).join(",") === "video,tai-lieu,bai-tap,xong" && a.done === 1, a);
const b = lessonSteps({ video: true, docs: 0, assignments: [], azota: null, completed: false });
check("bài không tài liệu, không bài tập ⇒ không có bước rỗng (chỉ video + xong)", b.steps.map(x => x.key).join(",") === "video,xong" && b.done === 0, b.steps);
const c = lessonSteps({ video: false, docs: 2, assignments: [{ submitted: true }, { submitted: false }], azota: { done: true }, completed: true });
check("đã đánh dấu xong: tài liệu + bước cuối xong; 2 bài tập nộp 1 ⇒ bước bài tập CHƯA xong; Azota đã làm ⇒ xong", c.done === 3 && c.steps.find(x => x.key === "bai-tap")?.done === false && /1\/2/.test(c.steps.find(x => x.key === "bai-tap")?.label ?? ""), c);

done();
