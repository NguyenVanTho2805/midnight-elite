import { ACTIVITY_KEYS, ACTIVITY_LABEL, emptyActivities, readActivities, parsePlanInput, isDateKey, totalMinutes, filledCount, renderTutorPlanText, renderStudentSheetText, TITLE_MAX, MAX_QUESTIONS, NOTES_MAX, type PlanContent } from "@/lib/sessionPlan";
import { check, section, done } from "./h";
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

section("Khung 4 hoạt động");
check("đúng 4 hoạt động theo thứ tự: Mở đầu, Hình thành kiến thức, Luyện tập, Vận dụng", eq(ACTIVITY_KEYS, ["mo-dau", "hinh-thanh", "luyen-tap", "van-dung"]) && eq(ACTIVITY_KEYS.map(k => ACTIVITY_LABEL[k]), ["Mở đầu", "Hình thành kiến thức", "Luyện tập", "Vận dụng"]));
const empty = emptyActivities();
check("kế hoạch trống: 4 phần tử rỗng, đủ khoá", empty.length === 4 && empty.every((a, i) => a.key === ACTIVITY_KEYS[i] && a.minutes === null && a.teacherNotes === "" && a.questions.length === 0 && a.product === ""));
check("emptyActivities trả bản mới mỗi lần (không dùng chung tham chiếu)", emptyActivities()[0] !== empty[0] && emptyActivities()[0].questions !== empty[0].questions);

section("Ngày dạy");
check("YYYY-MM-DD thật", isDateKey("2026-09-17") && isDateKey("2028-02-29") && !isDateKey("2027-02-29") && !isDateKey("2026-13-01") && !isDateKey("2026-9-1") && !isDateKey("17/09/2026") && !isDateKey(20260917) && !isDateKey(null));

section("Đọc dữ liệu trong DB: khoan dung, luôn đủ 4");
check("null / rác / không phải mảng → 4 hoạt động rỗng", eq(readActivities(null), empty) && eq(readActivities("x"), empty) && eq(readActivities({}), empty));
const dirty = readActivities([
  { key: "luyen-tap", minutes: 20, teacherNotes: "  ghi chú  ", questions: [{ q: "Câu 1", answer: "A" }, { q: "", answer: "bỏ" }, "rác", null, { q: "Câu 2" }], product: " bài làm " },
  { key: "khong-co", minutes: 5 }, "rác", { key: "mo-dau", minutes: -5 }, { key: "van-dung", minutes: 999 },
]);
check("đúng thứ tự cố định dù dữ liệu xáo trộn; khoá lạ bị bỏ", eq(dirty.map(a => a.key), ACTIVITY_KEYS));
check("phút ngoài 0–180 / âm → null; trong khoảng giữ nguyên", dirty[0].minutes === null && dirty[3].minutes === null && dirty[2].minutes === 20);
check("câu hỏi rỗng và phần tử rác bị bỏ; thiếu đáp án → ''", eq(dirty[2].questions, [{ q: "Câu 1", answer: "A" }, { q: "Câu 2", answer: "" }]) && dirty[2].teacherNotes === "ghi chú" && dirty[2].product === "bài làm");
check("cắt theo giới hạn khi đọc", readActivities([{ key: "mo-dau", teacherNotes: "x".repeat(NOTES_MAX + 50) }])[0].teacherNotes.length === NOTES_MAX && readActivities([{ key: "mo-dau", questions: Array.from({ length: 20 }, (_, i) => ({ q: "q" + i, answer: "" })) }])[0].questions.length === MAX_QUESTIONS);

section("Kiểm dữ liệu khi lưu: nghiêm");
const good = (over: Record<string, unknown> = {}) => ({ title: "Hàm số bậc nhất", goal: "Vẽ được đồ thị", dateKey: "2026-09-17", activities: emptyActivities(), ...over });
const setAct = (i: number, patch: Record<string, unknown>) => emptyActivities().map((a, j) => (j === i ? { ...a, ...patch } : a));
let r = parsePlanInput(good());
check("hợp lệ: chuẩn hoá tên, mục tiêu, ngày", r.ok && r.value.title === "Hàm số bậc nhất" && r.value.goal === "Vẽ được đồ thị" && r.value.dateKey === "2026-09-17");
check("ngày trống / null / bỏ → null", [good({ dateKey: "" }), good({ dateKey: null }), (() => { const g: any = good(); delete g.dateKey; return g; })()].every(b => { const x = parsePlanInput(b); return x.ok && x.value.dateKey === null; }));
check("mục tiêu bỏ / null → ''", (() => { const g: any = good(); delete g.goal; const x = parsePlanInput(g), y = parsePlanInput(good({ goal: null })); return x.ok && x.value.goal === "" && y.ok && y.value.goal === ""; })());
const bad: [string, unknown][] = [
  ["không phải object", "x"], ["thiếu tên", good({ title: "" })], ["tên toàn khoảng trắng", good({ title: "   " })], ["tên quá dài", good({ title: "x".repeat(TITLE_MAX + 1) })],
  ["mục tiêu sai kiểu", good({ goal: 5 })], ["mục tiêu quá dài", good({ goal: "x".repeat(501) })], ["ngày sai", good({ dateKey: "2026-02-30" })],
  ["thiếu hoạt động", good({ activities: emptyActivities().slice(0, 3) })], ["thừa hoạt động", good({ activities: [...emptyActivities(), emptyActivities()[0]] })],
  ["sai thứ tự", good({ activities: [...emptyActivities()].reverse() })], ["khoá lạ", good({ activities: emptyActivities().map((a, i) => (i === 1 ? { ...a, key: "khac" } : a)) })],
  ["phút âm", good({ activities: setAct(0, { minutes: -1 }) })], ["phút > 180", good({ activities: setAct(0, { minutes: 181 }) })], ["phút lẻ", good({ activities: setAct(0, { minutes: 2.5 }) })], ["phút là chữ", good({ activities: setAct(0, { minutes: "20" }) })],
  ["ghi chú sai kiểu", good({ activities: setAct(1, { teacherNotes: 5 }) })], ["ghi chú quá dài", good({ activities: setAct(1, { teacherNotes: "x".repeat(2001) }) })],
  ["sản phẩm quá dài", good({ activities: setAct(2, { product: "x".repeat(501) }) })], ["câu hỏi không phải danh sách", good({ activities: setAct(2, { questions: "x" }) })],
  ["quá 10 câu", good({ activities: setAct(2, { questions: Array.from({ length: 11 }, () => ({ q: "q", answer: "" })) }) })],
  ["câu hỏi quá dài", good({ activities: setAct(2, { questions: [{ q: "x".repeat(301), answer: "" }] }) })], ["đáp án quá dài", good({ activities: setAct(2, { questions: [{ q: "q", answer: "x".repeat(501) }] }) })],
  ["đáp án sai kiểu", good({ activities: setAct(2, { questions: [{ q: "q", answer: 5 }] }) })], ["câu hỏi sai kiểu", good({ activities: setAct(2, { questions: [{ q: 5, answer: "" }] }) })],
  ["có đáp án mà không có câu hỏi", good({ activities: setAct(2, { questions: [{ q: "  ", answer: "7" }] }) })],
];
for (const [name, body] of bad) check(`từ chối: ${name}`, !parsePlanInput(body).ok, parsePlanInput(body));
r = parsePlanInput(good({ activities: setAct(2, { questions: [{ q: "Câu 1", answer: "A" }, { q: " ", answer: " " }, { q: "Câu 2" }], minutes: 15, product: "  vở  ", teacherNotes: " gợi ý " }) }));
check("dòng câu hỏi trống hoàn toàn bị bỏ; còn lại được cắt khoảng trắng", r.ok && eq(r.value.activities[2], { key: "luyen-tap", minutes: 15, teacherNotes: "gợi ý", questions: [{ q: "Câu 1", answer: "A" }, { q: "Câu 2", answer: "" }], product: "vở" }), r);

section("Hai bản: gia sư thấy đủ, học sinh KHÔNG thấy đáp án và ghi chú");
const plan: PlanContent = { title: "Hàm số bậc nhất", goal: "Vẽ được đồ thị y = ax + b", dateKey: "2026-09-17", activities: [
  { key: "mo-dau", minutes: 5, teacherNotes: "GHI_CHU_MO_DAU_BI_MAT", questions: [], product: "" },
  { key: "hinh-thanh", minutes: 20, teacherNotes: "GHI_CHU_HINH_THANH_BI_MAT", questions: [{ q: "Khi x tăng 1, y tăng bao nhiêu?", answer: "DAP_AN_BI_MAT_1" }, { q: "Hệ số a cho biết điều gì?", answer: "DAP_AN_BI_MAT_2" }], product: "Bảng giá trị" },
  { key: "luyen-tap", minutes: 20, teacherNotes: "", questions: [{ q: "Vẽ đồ thị y = 2x + 1", answer: "DAP_AN_BI_MAT_3" }], product: "" },
  { key: "van-dung", minutes: 15, teacherNotes: "GHI_CHU_VAN_DUNG_BI_MAT", questions: [], product: "" },
] };
const tutor = renderTutorPlanText(plan, { courseName: "Toán 9" });
check("bản gia sư có đủ: tên, lớp, ngày, 60 phút, mục tiêu, ghi chú, đáp án, sản phẩm", tutor.includes("KẾ HOẠCH BUỔI — Hàm số bậc nhất") && tutor.includes("Toán 9 · 17/09/2026 · 60 phút") && tutor.includes("Mục tiêu: Vẽ được đồ thị") && tutor.includes("GHI_CHU_MO_DAU_BI_MAT") && tutor.includes("Đáp án: DAP_AN_BI_MAT_1") && tutor.includes("Đáp án: DAP_AN_BI_MAT_3") && tutor.includes("Sản phẩm: Bảng giá trị") && tutor.includes("2. Hình thành kiến thức (20 phút)"), tutor);
const stu = renderStudentSheetText(plan, { courseName: "Toán 9" });
check("phiếu học sinh KHÔNG chứa đáp án nào", !/DAP_AN_BI_MAT|Đáp án/.test(stu), stu);
check("phiếu học sinh KHÔNG chứa ghi chú của gia sư (kể cả hoạt động chỉ có ghi chú)", !/GHI_CHU|Gia sư:/.test(stu), stu);
check("phiếu học sinh có câu hỏi dẫn đường, đánh số liên tục qua các hoạt động, và sản phẩm", stu.includes("1. Khi x tăng 1, y tăng bao nhiêu?") && stu.includes("2. Hệ số a cho biết điều gì?") && stu.includes("3. Vẽ đồ thị y = 2x + 1") && stu.includes("Sản phẩm của em: Bảng giá trị") && stu.includes("Hôm nay mình học để: Vẽ được đồ thị"));
check("hoạt động chỉ có ghi chú (Mở đầu, Vận dụng) không xuất hiện trên phiếu học sinh", !stu.includes("Mở đầu") && !stu.includes("Vận dụng") && stu.includes("Hình thành kiến thức") && stu.includes("Luyện tập"));
check("phiếu học sinh không lộ phân bổ số phút của gia sư", !/phút/.test(stu));
const bare = renderStudentSheetText({ title: "Buổi mới", goal: "", dateKey: null, activities: emptyActivities() });
check("kế hoạch trống: phiếu chỉ có tên buổi (không dòng thừa)", bare === "PHIẾU HỌC SINH — Buổi mới", bare);
check("tổng phút và đếm hoạt động đã soạn", totalMinutes(plan.activities) === 60 && filledCount(plan.activities) === 4 && filledCount(emptyActivities()) === 0 && filledCount([{ ...emptyActivities()[0], product: "x" }]) === 1);
done();
