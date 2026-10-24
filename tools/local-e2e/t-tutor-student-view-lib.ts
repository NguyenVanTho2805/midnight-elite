// Hồ sơ học sinh của gia sư, phần trình bày thuần (HS-01/06/08/09, DD-07, LO-03): src/lib/tutorStudentView.ts. Không cần máy chủ hay DB.
// Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-tutor-student-view-lib.ts
import { readFileSync } from "node:fs";
import {
  ATTENDANCE_WINDOW_DAYS, absenceStreakOf, alertsOf, attendanceWindow, checkStatusChange, createButtonLabel, filterStudents, learnedSessions, previewSessionCount,
  reportLinkOf, reportPath, validateSlots, type StudentSignals,
} from "@/lib/tutorStudentView";
import { check, done, section } from "./h";

const TOKEN = "0123456789abcdef0123456789abcdef";

section("Link báo cáo riêng: trạng thái");
check("không có liên kết phụ huynh → no_parent", reportLinkOf([]) === "no_parent");
check("liên kết CHƯA xác nhận không tính (kể cả có token) → no_parent", reportLinkOf([{ status: "pending", portalToken: TOKEN }, { status: "revoked", portalToken: TOKEN }]) === "no_parent");
check("đã xác nhận, chưa token → off", reportLinkOf([{ status: "verified", portalToken: null }]) === "off");
check("đã xác nhận, có token đúng dạng → on", reportLinkOf([{ status: "verified", portalToken: TOKEN }]) === "on");
check("token sai dạng (rác) không tính là đang bật", reportLinkOf([{ status: "verified", portalToken: "abc" }]) === "off");
check("hai phụ huynh, một người có link → on", reportLinkOf([{ status: "verified", portalToken: null }, { status: "verified", portalToken: TOKEN }]) === "on");
check("đường dẫn chỉ có token, không có chữ nào khác", reportPath(TOKEN) === `/so-cua-con/${TOKEN}` && !/[A-Za-z]{3,}\/.*[A-Za-z]{3,}/.test(reportPath(TOKEN).replace("/so-cua-con/", "")));

section("Cảnh báo ở danh sách");
check("không gì → không cảnh báo", alertsOf({ unpaidCount: 0, absentStreak: 0, makeupLeft: 0 }).length === 0);
check("vắng 2 buổi chưa báo, vắng 3 thì báo (STREAK_MIN)", alertsOf({ unpaidCount: 0, absentStreak: 2, makeupLeft: 0 }).length === 0 && alertsOf({ unpaidCount: 0, absentStreak: 3, makeupLeft: 0 }).join() === "absent_streak");
check("đủ ba loại", alertsOf({ unpaidCount: 1, absentStreak: 4, makeupLeft: 2 }).join() === "unpaid,absent_streak,makeup");
check("chuỗi vắng: absent+excused tính, có mặt/muộn/ô trống dừng",
  absenceStreakOf(["absent", "excused", "absent", "present", "absent"]) === 3 && absenceStreakOf(["late", "absent"]) === 0 && absenceStreakOf([undefined, "absent"]) === 0 && absenceStreakOf([]) === 0);

section("Lọc danh sách (trạng thái / lớp / cảnh báo / từ khoá)");
const R = (userId: string, name: string, courseId: string, status: "active" | "suspended") => ({ userId, name, email: `${userId}@x.vn`, phone: null, school: null, courseId, status });
const rows = [R("u1", "An", "c1", "active"), R("u2", "Bình", "c1", "active"), R("u3", "Chi", "c2", "active"), R("u4", "Dũng", "c1", "suspended")];
const sig = new Map<string, StudentSignals>([
  ["u1", { userId: "u1", unpaidCount: 1, absentStreak: 0, makeupLeft: 0, reportLink: "on" }],
  ["u2", { userId: "u2", unpaidCount: 0, absentStreak: 3, makeupLeft: 0, reportLink: "off" }],
  ["u4", { userId: "u4", unpaidCount: 2, absentStreak: 0, makeupLeft: 0, reportLink: "no_parent" }],
]);
const F = { status: "active" as const, courseId: "", alert: "" as const, q: "" };
const names = (f: Partial<typeof F> & { alert?: "" | "unpaid" | "absent_streak" | "makeup" }) => filterStudents(rows, sig, { ...F, ...f }).map(r => r.name).join();
check("đang học: An, Bình, Chi (Dũng đã nghỉ không lẫn vào)", names({}) === "An,Bình,Chi");
check("đã nghỉ: chỉ Dũng", names({ status: "suspended" as never }) === "Dũng");
check("lọc lớp c2", names({ courseId: "c2" }) === "Chi");
check("cảnh báo còn phiếu: chỉ An (Dũng có phiếu nhưng đã nghỉ)", names({ alert: "unpaid" }) === "An");
check("cảnh báo vắng liên tiếp: Bình", names({ alert: "absent_streak" }) === "Bình");
check("em không có tín hiệu (Chi) KHÔNG dính cảnh báo nào", names({ alert: "makeup" }) === "");
check("từ khoá không phân biệt hoa thường", names({ q: " bÌNH " }) === "Bình");

section("Đổi trạng thái học (Đã nghỉ giữ dữ liệu)");
check("đang học → đã nghỉ: được", JSON.stringify(checkStatusChange("active", "suspended")) === JSON.stringify({ ok: true, noop: false }));
check("đã nghỉ → học lại: được", JSON.stringify(checkStatusChange("suspended", "active")) === JSON.stringify({ ok: true, noop: false }));
check("đã đúng trạng thái → noop", JSON.stringify(checkStatusChange("active", "active")) === JSON.stringify({ ok: true, noop: true }));
const pend = checkStatusChange("pending_consent", "active");
check("chờ phụ huynh đồng ý: KHÔNG tự bật được", !pend.ok && /phụ huynh/.test(pend.error));
check("trạng thái lạ bị từ chối", !checkStatusChange("deleted", "active").ok);

section("Điểm danh 90 ngày và buổi đã học");
const T = "2026-10-24";
const att = [
  { dateKey: "2026-10-23", status: "present", courseName: "Toán 9" }, { dateKey: "2026-10-16", status: "late", courseName: "Toán 9" },
  { dateKey: "2026-10-09", status: "absent", courseName: "Toán 9" }, { dateKey: "2026-07-27", status: "present", courseName: "Toán 9" }, // đúng ngày đầu cửa sổ (24/10 lùi 89 ngày)
  { dateKey: "2026-07-26", status: "present", courseName: "Toán 9" },  // ngoài cửa sổ 1 ngày
  { dateKey: "2026-10-30", status: "excused", courseName: "Toán 9" },  // tương lai (báo nghỉ trước)
  { dateKey: "2026-10-02", status: "xyz", courseName: "Toán 9" },      // trạng thái rác
];
const w = attendanceWindow(att, T);
check("cửa sổ 90 ngày: từ 27/07 đến 24/10", w.fromKey === "2026-07-27" && w.toKey === T && w.days === ATTENDANCE_WINDOW_DAYS);
check("đếm đúng: 4 bản ghi (ngày đầu cửa sổ tính; ngoài 1 ngày, tương lai, rác thì không)", w.n === 4 && w.rows.length === 4, w.n);
check("đếm theo trạng thái", w.counts.present === 2 && w.counts.late === 1 && w.counts.absent === 1 && w.counts.excused === 0, w.counts);
check("dưới 10 bản ghi → KHÔNG có phần trăm (chưa đủ dữ liệu)", w.rate === null);
const many = Array.from({ length: 12 }, (_, i) => ({ dateKey: `2026-10-${String(i + 1).padStart(2, "0")}`, status: i < 10 ? "present" : "absent", courseName: "Lý 8" }));
const w2 = attendanceWindow(many, T);
check("12 bản ghi (10 có mặt, 2 vắng): (10 + 2×0,5)/12 = 91,67% → 92", w2.n === 12 && w2.rate === 92, w2.rate);
check("mới → cũ", w.rows[0].dateKey === "2026-10-23" && w.rows.at(-1)!.dateKey === "2026-07-27");
let threw = false; try { attendanceWindow(att, "2026-02-31"); } catch { threw = true; }
check("ngày hôm nay không tồn tại → ném lỗi, không đoán", threw);
check("buổi đã học = có mặt/muộn, không tương lai, mới → cũ", learnedSessions(att, T).map(r => r.dateKey).join() === "2026-10-23,2026-10-16,2026-07-27,2026-07-26");

section("Wizard tạo lớp: 'Tạo lớp + N buổi'");
const T2 = { dayOfWeek: 2, startTime: "19:00", endTime: "20:30" }; // Thứ Ba
check("thứ Ba hằng tuần, 4 tuần từ thứ Hai 26/10/2026 → 4 buổi", previewSessionCount([T2], "2026-10-26", 4) === 4);
check("hai khung/tuần, 2 tuần → 4 buổi", previewSessionCount([T2, { dayOfWeek: 5, startTime: "19:00", endTime: "20:30" }], "2026-10-26", 2) === 4);
check("không có khung giờ → 0 buổi, nút chỉ ghi 'Tạo lớp'", previewSessionCount([], "2026-10-26", 4) === 0 && createButtonLabel(0) === "Tạo lớp");
check("nút ghi đúng số", createButtonLabel(8) === "Tạo lớp + 8 buổi");
check("số tuần quá lớn bị kẹp ở 8 (không ném lỗi cửa sổ 62 ngày)", previewSessionCount([T2], "2026-10-26", 999) === 8);
check("ngày đầu sai → 0", previewSessionCount([T2], "2026-13-01", 4) === 0);
check("khung giờ hợp lệ → null", validateSlots([T2]) === null);
check("giờ kết thúc ≤ bắt đầu → lỗi", validateSlots([{ ...T2, endTime: "19:00" }]) !== null && validateSlots([{ ...T2, endTime: "18:00" }]) !== null);
check("khung trùng → lỗi; ngày ngoài 0..6 → lỗi", validateSlots([T2, T2]) !== null && validateSlots([{ ...T2, dayOfWeek: 7 }]) !== null);

section("Mã nguồn: không kéo thư viện máy chủ vào gói trình duyệt, không dùng giờ thô");
const src = readFileSync("src/lib/tutorStudentView.ts", "utf8");
check("tutorStudentView.ts không import node:crypto / prisma / parentPortal", !/from "(node:|@\/lib\/prisma|@\/lib\/parentPortal)/.test(src));
check("tutorStudentView.ts không dùng new Date() thô", !/new Date\(\)/.test(src));

done();
