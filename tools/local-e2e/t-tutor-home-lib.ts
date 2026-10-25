// Trang chủ gia sư (24/10/2026): checklist thiết lập HV-10, Đã thu / Chưa thu HV-06, lịch gần nhất HV-08, luật kiểm tra tại chỗ HT-02.
// Bài thuần (không máy chủ, không DB).
import { check, section, done } from "./h";
import { buildHopViecOverview, buildSetupChecklist, countMonthSessions, type SetupCounts } from "@/lib/tutorOverview";
import { OPEN_STATUSES } from "@/lib/tuitionInvoice";
import { STUDENT_FIELD_RULES } from "@/lib/studentFieldRules";
import { email, firstError, matches, maxLength, minLength, phoneVn, required, validateAll } from "@/lib/fieldRules";

const NOW = new Date("2026-10-14T03:30:00Z"); // 10:30 giờ VN, thứ Tư 14/10/2026
const ZERO: SetupCounts = { payoutAccount: false, classes: 0, students: 0, schedules: 0, attendanceRecords: 0, invoices: 0, parentLinks: 0, taughtSessions: 0 };

section("HV-10 checklist thiết lập 8 bước, tự tick theo dữ liệu thật");
const c0 = buildSetupChecklist(ZERO);
check("chưa có gì: 8 bước, 0 xong, không bước nào tick", c0.total === 8 && c0.doneCount === 0 && !c0.allDone && c0.steps.every(s => !s.done), c0);
check("8 bước đúng thứ tự: tài khoản, lớp, học sinh, lịch, điểm danh, phiếu, phụ huynh, chốt buổi", c0.steps.map(s => s.key).join() === "tai-khoan,lop,hoc-sinh,lich,diem-danh,phieu,phu-huynh,chot-buoi");
check("mọi bước có liên kết nội bộ (không đường chết) và câu gợi ý", c0.steps.every(s => s.href.startsWith("/") && s.hint.length > 5));
const c1 = buildSetupChecklist({ ...ZERO, payoutAccount: true, classes: 2 });
check("có tài khoản + 2 lớp → chỉ hai bước đó tick", c1.doneCount === 2 && c1.steps.filter(s => s.done).map(s => s.key).join() === "tai-khoan,lop", c1.steps.map(s => [s.key, s.done]));
const one = (k: keyof SetupCounts) => buildSetupChecklist({ ...ZERO, [k]: k === "payoutAccount" ? true : 1 } as SetupCounts).steps.filter(s => s.done).map(s => s.key).join();
check("mỗi số đếm chỉ làm đúng MỘT bước tick (không tick lẫn)", ([["payoutAccount", "tai-khoan"], ["classes", "lop"], ["students", "hoc-sinh"], ["schedules", "lich"], ["attendanceRecords", "diem-danh"], ["invoices", "phieu"], ["parentLinks", "phu-huynh"], ["taughtSessions", "chot-buoi"]] as const).every(([k, s]) => one(k) === s));
const all = buildSetupChecklist({ payoutAccount: true, classes: 1, students: 3, schedules: 1, attendanceRecords: 4, invoices: 2, parentLinks: 1, taughtSessions: 2 });
check("đủ cả 8 → allDone (banner sẽ không hiện nữa)", all.allDone && all.doneCount === 8);
const ovNoSetup = buildHopViecOverview({ now: NOW, invoices: [], classes: [], totalStudents: 0, occurrences: [] });
check("không truyền số đếm → setup = null (không bịa tiến độ)", ovNoSetup.setup === null);

section("HV-06 Đã thu / Chưa thu: chưa thu = công thức trang Doanh thu (phiếu ĐÃ GỬI chưa đóng đủ)");
const inv = [
  { amountDue: 500000, paidAmount: 500000, status: "paid" },
  { amountDue: 600000, paidAmount: 200000, status: "partial" },     // còn 400.000
  { amountDue: 700000, paidAmount: 0, status: "sent" },             // còn 700.000
  { amountDue: 300000, paidAmount: 0, status: "parent_reported" },  // còn 300.000
  { amountDue: 900000, paidAmount: 0, status: "draft" },            // nháp: KHÔNG tính vào chưa thu
  { amountDue: 800000, paidAmount: 0, status: "cancelled" },        // huỷ: bỏ
];
const ov = buildHopViecOverview({ now: NOW, invoices: inv, classes: [], totalStudents: 0, occurrences: [] });
// So khớp với công thức trong src/app/api/users/me/revenue/route.ts: open.reduce(max(0, amountDue - paidAmount)) trên OPEN_STATUSES
const routeFormula = inv.filter(i => (OPEN_STATUSES as string[]).includes(i.status)).reduce((s, i) => s + Math.max(0, i.amountDue - i.paidAmount), 0);
check("chưa thu = 1.400.000đ, khớp công thức của route Doanh thu (0 sai lệch)", routeFormula === 1_400_000 && /^1[.,\s]?400[.,\s]?000đ$/.test(ov.month.receivable), [routeFormula, ov.month.receivable]);
check("đã thu = 700.000đ (tổng paidAmount, bỏ phiếu huỷ)", /^700[.,\s]?000đ$/.test(ov.month.collected), ov.month.collected);
check("dòng phụ: 3 phiếu đã gửi chưa đóng đủ (không đếm nháp, phiếu đã trả đủ)", ov.month.receivableHint === "3 phiếu đã gửi chưa đóng đủ", ov.month.receivableHint);
const over = buildHopViecOverview({ now: NOW, invoices: [{ amountDue: 100000, paidAmount: 150000, status: "partial" }], classes: [], totalStudents: 0, occurrences: [] });
check("đóng dư không làm 'chưa thu' âm (max 0)", /^0đ$/.test(over.month.receivable), over.month.receivable);
check("không có phiếu: 0đ và câu nói thẳng, không số bịa", ovNoSetup.month.receivable === "0đ" && /Không có phiếu đã gửi/.test(ovNoSetup.month.receivableHint));

section("HV-08 lịch dạy gần nhất");
const occ = (courseId: string, dateKey: string, s: string, e: string, status = "scheduled") => ({ courseId, courseName: `Lớp ${courseId}`, dateKey, startAt: s, endAt: e, status, studentCount: 2, pendingAbsences: 0 });
const ov2 = buildHopViecOverview({ now: NOW, invoices: [], classes: [], totalStudents: 0, occurrences: [
  occ("a", "2026-10-14", "2026-10-14T01:00:00Z", "2026-10-14T02:00:00Z"),            // đã kết thúc lúc 09:00 giờ VN → bỏ
  occ("b", "2026-10-14", "2026-10-14T12:00:00Z", "2026-10-14T13:30:00Z"),            // 19:00 hôm nay
  occ("c", "2026-10-15", "2026-10-15T02:00:00Z", "2026-10-15T03:00:00Z"),
  occ("d", "2026-10-16", "2026-10-16T02:00:00Z", "2026-10-16T03:00:00Z", "cancelled"), // huỷ → bỏ
  occ("e", "2026-10-17", "2026-10-17T02:00:00Z", "2026-10-17T03:00:00Z"),
  occ("f", "2026-10-18", "2026-10-18T02:00:00Z", "2026-10-18T03:00:00Z"),            // thứ 4 → không lấy
] });
check("đúng 3 buổi, theo thứ tự thời gian, bỏ buổi đã qua và buổi huỷ", ov2.upcoming.map(u => u.courseName).join() === "Lớp b,Lớp c,Lớp e", ov2.upcoming.map(u => u.courseName));
check("buổi hôm nay ghi 'Hôm nay', buổi sau ghi thứ + dd/mm", ov2.upcoming[0].when === "Hôm nay" && ov2.upcoming[1].when === "Thứ Năm 15/10" && ov2.upcoming[0].time === "19:00 – 20:30", ov2.upcoming);
check("không có buổi → danh sách rỗng (giao diện nói 'chưa có buổi')", ovNoSetup.upcoming.length === 0);

section("HT-02 luật kiểm tra tại chỗ");
check("required: rỗng và toàn dấu cách → báo; có chữ → ổn", required("x")("") === "x" && required("x")("   ") === "x" && required("x")("a") === null);
check("email: ô trống bỏ qua (để required báo); sai dạng → báo; đúng → ổn", email()("") === null && !!email()("abc") && !!email()("a@b") && email()("ten@gmail.com") === null);
check("phoneVn: 0901 234 567 ổn; 123 và đầu 02 → báo; trống bỏ qua", phoneVn()("0901 234 567") === null && !!phoneVn()("123") && !!phoneVn()("0201234567") && phoneVn()("") === null);
check("minLength/maxLength/matches", minLength(8)("1234567") !== null && minLength(8)("12345678") === null && maxLength(3)("abcd") !== null && matches(() => "a", "lệch")("b") === "lệch" && matches(() => "a", "lệch")("a") === null);
check("firstError lấy luật đầu tiên báo lỗi", firstError("", [required("A"), email("B")]) === "A" && firstError("x", [required("A"), email("B")]) === "B" && firstError("a@b.vn", [required("A"), email("B")]) === null);
check("validateAll chỉ trả ô có lỗi", JSON.stringify(validateAll({ e: "", p: "123" }, { e: [required("thiếu")], p: [phoneVn("sai")], z: [required("thiếu z")] })) === JSON.stringify({ e: "thiếu", p: "sai", z: "thiếu z" }));
check("câu báo lỗi không chứa nội dung người dùng nhập (không lộ mật khẩu/SĐT)", !String(phoneVn()("0999999999x")).includes("0999999999x") && !String(minLength(8)("matkhau1")).includes("matkhau1"));
section("HV-04 số buổi trong tháng + HV-05 yêu cầu mới");
const mo = [
  { status: "scheduled", sessionState: "closed" as const }, { status: "scheduled", sessionState: "closed" as const },
  { status: "scheduled", sessionState: "open" as const }, { status: "scheduled", sessionState: null },
  { status: "moved", sessionState: null }, { status: "cancelled", sessionState: null },
  { status: "cancelled", sessionState: "closed" as const }, // huỷ thì không bao giờ là hoàn thành
];
const mc = countMonthSessions(mo);
check("2 đã chốt → hoàn thành 2; 2 huỷ → đã nghỉ 2; còn lại 3 → đã lên lịch 3", mc.completed === 2 && mc.cancelled === 2 && mc.scheduled === 3, mc);
check("ba ô cộng lại = tổng buổi (mỗi buổi đúng một ô)", mc.completed + mc.cancelled + mc.scheduled === mo.length);
check("[phá cố ý] buổi huỷ có bản ghi chốt KHÔNG được tính hoàn thành", countMonthSessions([{ status: "cancelled", sessionState: "closed" }]).completed === 0);
check("buổi đã chốt không khớp lịch (extraClosed) vẫn tính hoàn thành, số âm/lẻ bị chặn", countMonthSessions([], 2).completed === 2 && countMonthSessions([{ status: "scheduled", sessionState: null }], 1).completed === 1 && countMonthSessions([], -3).completed === 0 && countMonthSessions([], 2.9).completed === 2);
check("tháng trống → 0/0/0", JSON.stringify(countMonthSessions([])) === JSON.stringify({ scheduled: 0, completed: 0, cancelled: 0 }));
const ovM = buildHopViecOverview({ now: NOW, invoices: [], classes: [], totalStudents: 0, occurrences: [], monthOccurrences: mo, newRequests: 3 });
check("overview mang đủ sessions + requests (đếm, có liên kết trang yêu cầu)", ovM.sessions.completed === 2 && ovM.requests.newCount === 3 && ovM.requests.href === "/lop-cua-toi/yeu-cau", [ovM.sessions, ovM.requests]);
check("không truyền số → 0, không bịa; số âm/lẻ bị chặn", ovNoSetup.requests.newCount === 0 && ovNoSetup.sessions.scheduled === 0 && buildHopViecOverview({ now: NOW, invoices: [], classes: [], totalStudents: 0, occurrences: [], newRequests: -4 }).requests.newCount === 0);
section("HT-02 luật hồ sơ học sinh (thêm học sinh / sửa hồ sơ)");
const sv = validateAll({ name: "  ", guardianPhone: "12345", phone: "+84 901 234 567", phoneExtra: "", email: "khong-hop-le", emailExtra: "a@b.vn", birthDate: "31/02/2014", startDate: "01/11/2026" }, STUDENT_FIELD_RULES);
check("tên trống, SĐT 5 số, email sai, ngày 31/02 → báo đúng 4 ô; +84 và ngày thật thì ổn", Object.keys(sv).sort().join() === "birthDate,email,guardianPhone,name", sv);
check("[phá cố ý] mọi câu báo KHÔNG chứa nội dung đã nhập", Object.values(validateAll({ name: "", guardianPhone: "0999SDT-LA", email: "bi-mat@@x", birthDate: "NGAY-SINH-LA" }, STUDENT_FIELD_RULES)).every(m => !/SDT-LA|bi-mat|NGAY-SINH-LA/.test(m)));
check("ô trống (không bắt buộc) thì bỏ qua; chỉ 'tên em' là bắt buộc", Object.keys(validateAll({ name: "Minh" }, STUDENT_FIELD_RULES)).length === 0 && validateAll({}, STUDENT_FIELD_RULES).name === "Nhập tên em");
done();
