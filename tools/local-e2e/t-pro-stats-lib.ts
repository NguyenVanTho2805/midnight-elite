// KiN Pro F4 + F5 + F6 — công thức thuần: thống kê chuyên cần nâng cao (src/lib/attendanceInsights.ts), hỗ trợ ưu tiên (src/lib/supportDesk.ts)
// + quét tĩnh mã (cổng Pro ở API, ô "còn N lượt" ở mọi chỗ tải đề, lời hứa không vượt khả năng). Không cần DB hay máy chủ.
// Chạy: DATABASE_URL=postgresql://x:x@localhost/x npx tsx tools/local-e2e/t-pro-stats-lib.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  COMPARE_DAYS, INSIGHT_MIN_SAMPLE, STREAK_MIN, absenceStreaks, compareClasses, lastMonthKeys, lastWeekKeys, monthKeyOf, rateOf, trendBy, weekKeyOf,
  type InsRecord, type InsSession, type InsStudent,
} from "@/lib/attendanceInsights";
import { computeAttendanceStats } from "@/lib/attendance";
import { dayOfWeekOfKey } from "@/lib/classSessions";
import {
  FREE_PROMISE, MAX_OPEN_PER_USER, PRO_PROMISE, SERIOUS_PROMISE, laneOf, parseReplyInput, parseSupportInput, promiseFor, sortQueue,
} from "@/lib/supportDesk";
import { check, section, done } from "./h";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf-8");
const noComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const rep = (status: string, n: number) => Array.from({ length: n }, () => ({ status }));

(async () => {
  section("F4 · chuyên cần = đúng hệ số của attendance.ts, làm tròn %, dưới 10 mẫu thì KHÔNG có phần trăm");
  check("hằng số: mẫu tối thiểu 10, báo từ 3 buổi liên tiếp, so sánh 90 ngày", INSIGHT_MIN_SAMPLE === 10 && STREAK_MIN === 3 && COMPARE_DAYS === 90);
  const ten = [...rep("present", 6), ...rep("late", 2), ...rep("excused", 1), ...rep("absent", 1)];
  check("6 có mặt + 2 muộn + 1 có phép + 1 vắng = (6+1,8+0,8+0,5)/10 = 91%", rateOf(ten).rate === 91 && rateOf(ten).n === 10);
  check("khớp từng chữ số với computeAttendanceStats (không công thức riêng)", rateOf(ten).rate === Math.round(computeAttendanceStats(ten).ratio! * 100));
  check("9 mẫu → rate null (chưa đủ dữ liệu), nhưng n vẫn là 9", rateOf(ten.slice(0, 9)).rate === null && rateOf(ten.slice(0, 9)).n === 9);
  check("trạng thái lạ bị bỏ, không làm lệch mẫu số", rateOf([...ten, { status: "unknown" }, { status: "" }]).n === 10 && rateOf([...ten, { status: "unknown" }]).rate === 91);
  check("không có bản ghi → n 0, rate null (không NaN)", rateOf([]).rate === null && rateOf([]).n === 0);

  section("F4 · mốc tuần / tháng (giờ VN, tuần bắt đầu Thứ Hai)");
  check("Chủ nhật 25/10/2026 thuộc tuần bắt đầu Thứ Hai 19/10 (không nhảy sang tuần sau)", weekKeyOf("2026-10-25") === "2026-10-19" && weekKeyOf("2026-10-19") === "2026-10-19" && weekKeyOf("2026-10-26") === "2026-10-26");
  const wk = lastWeekKeys("2026-10-23", 8);
  check("8 mốc tuần, cũ → mới, mốc cuối là tuần của hôm nay, mọi mốc là Thứ Hai cách nhau 7 ngày", wk.length === 8 && wk[7] === "2026-10-19" && wk.every(k => dayOfWeekOfKey(k) === 1) && wk[0] === "2026-08-31");
  check("tuần cách nhau đúng 7 ngày", wk.slice(1).every((k, i) => (Date.parse(k) - Date.parse(wk[i])) / 86_400_000 === 7));
  check("6 mốc tháng qua đổi năm: 02/2026 lùi 4 tháng = 11/2025, 12/2025, 01/2026, 02/2026", JSON.stringify(lastMonthKeys("2026-02-10", 4)) === JSON.stringify(["2025-11", "2025-12", "2026-01", "2026-02"]));
  check("monthKeyOf cắt đúng YYYY-MM", monthKeyOf("2026-10-05") === "2026-10");

  section("F4 · xu hướng tuần/tháng gộp từ bản ghi, tính tay");
  const mk = (id: string, courseId: string, dateKey: string): InsSession => ({ id, courseId, dateKey });
  const students5 = ["a", "b", "c", "d", "e"];
  const S: InsSession[] = [mk("s1", "C1", "2026-10-19"), mk("s2", "C1", "2026-10-21"), mk("s3", "C1", "2026-10-12"), mk("s0", "C1", "2026-08-03")];
  const R: InsRecord[] = [
    ...students5.flatMap(u => [{ sessionId: "s1", userId: u, status: "present" }, { sessionId: "s2", userId: u, status: "present" }]), // tuần 19/10: 10 lượt, 100%
    ...students5.map((u, i) => ({ sessionId: "s3", userId: u, status: i === 0 ? "absent" : "present" })), // tuần 12/10: 5 lượt → chưa đủ
    { sessionId: "s0", userId: "a", status: "present" }, // ngoài mốc tuần
    { sessionId: "nope", userId: "a", status: "absent" }, // phiên lạ bị bỏ
  ];
  const wTrend = trendBy("week", lastWeekKeys("2026-10-23", 8), S, R);
  const w19 = wTrend.find(p => p.key === "2026-10-19")!, w12 = wTrend.find(p => p.key === "2026-10-12")!;
  check("tuần 19/10: 10 lượt, 100%", w19.n === 10 && w19.rate === 100);
  check("tuần 12/10: 5 lượt (4 có mặt, 1 vắng) → CHƯA ĐỦ dữ liệu, không hiện 90%", w12.n === 5 && w12.rate === null);
  check("tuần không có buổi: n 0, rate null", wTrend.filter(p => p.n === 0).every(p => p.rate === null) && wTrend.filter(p => p.n === 0).length === 6);
  const mTrend = trendBy("month", lastMonthKeys("2026-10-23", 6), S, R);
  const m10 = mTrend.find(p => p.key === "2026-10")!, m08 = mTrend.find(p => p.key === "2026-08")!;
  check("tháng 10: 15 lượt (14 có mặt + 1 vắng) = (14+0,5)/15 = 97%", m10.n === 15 && m10.rate === Math.round((14.5 / 15) * 100));
  check("tháng 8: 1 lượt → chưa đủ dữ liệu", m08.n === 1 && m08.rate === null);
  check("nhãn tuần/tháng tiếng Việt", w19.label === "Tuần 19/10" && m10.label === "Tháng 10/2026");

  section("F4 · em vắng liên tiếp: ô trống KHÔNG phải vắng, nghỉ có phép tính, muộn là có mặt");
  const sess: InsSession[] = ["2026-10-01", "2026-10-05", "2026-10-08", "2026-10-12", "2026-10-15"].map((d, i) => mk(`k${i}`, "C1", d)); // k4 mới nhất
  const st = (id: string, name: string, enrolledKey = "2026-01-01", active = true): InsStudent => ({ id, name, courseId: "C1", enrolledKey, active });
  const rec = (u: string, arr: (string | null)[]): InsRecord[] => arr.flatMap((s, i) => (s === null ? [] : [{ sessionId: `k${i}`, userId: u, status: s }]));
  // thứ tự mảng = k0..k4 (cũ → mới)
  const recs = [
    ...rec("x", ["present", "present", "absent", "excused", "absent"]), // mới → cũ: vắng, có phép, vắng, rồi có mặt → 3
    ...rec("y", ["absent", "absent", "absent", null, "absent"]), // mới nhất vắng, k3 để trống → dừng → 1
    ...rec("z", ["absent", "absent", "absent", "absent", "late"]), // muộn là có mặt → 0
    ...rec("w", ["absent", "absent", "absent", "absent", "absent"]), // đã nghỉ học
    ...rec("v", ["absent", "absent", "absent", "absent", "absent"]), // vừa vào lớp 10/10: 2 buổi cuối vắng
    ...rec("u", ["absent", "absent", "absent", "absent", "absent"]), // vắng 5 buổi
  ];
  const studs = [st("x", "Em X"), st("y", "Em Y"), st("z", "Em Z"), st("w", "Em W", "2026-01-01", false), st("v", "Em V", "2026-10-10"), st("u", "Em U")];
  const out = absenceStreaks(studs, [{ id: "C1", name: "Lớp 1" }], sess, recs, 3);
  check("chỉ X (3) và U (5) vào danh sách; U đứng trước X", out.length === 2 && out[0].studentId === "u" && out[0].streak === 5 && out[1].studentId === "x" && out[1].streak === 3, out);
  check("Y: ô trống cắt chuỗi → không báo; Z: muộn không phải vắng; W đã nghỉ học không báo", !out.some(o => ["y", "z", "w"].includes(o.studentId)));
  check("V vừa vào lớp 10/10 chỉ có 2 buổi sau ngày ghi danh → 2 < 3 không báo, các buổi trước khi vào không bị tính", !out.some(o => o.studentId === "v"));
  check("hạ ngưỡng xuống 2 thì V được báo với đúng 2 buổi", absenceStreaks(studs, [{ id: "C1", name: "Lớp 1" }], sess, recs, 2).find(o => o.studentId === "v")?.streak === 2);
  check("buổi vắng gần nhất và tên lớp đi kèm", out[1].lastAbsentKey === "2026-10-15" && out[1].courseName === "Lớp 1");
  check("không có buổi nào → không ai bị báo", absenceStreaks(studs, [], [], recs, 3).length === 0);

  section("F4 · so sánh lớp trong cửa sổ ngày");
  const cs: InsSession[] = [mk("p1", "A", "2026-10-10"), mk("p2", "B", "2026-10-10"), mk("pOld", "A", "2026-05-01")];
  const cr: InsRecord[] = [
    ...rep("present", 12).map((r, i) => ({ sessionId: "p1", userId: `a${i}`, status: r.status })),
    ...[...rep("present", 5), ...rep("absent", 5)].map((r, i) => ({ sessionId: "p2", userId: `b${i}`, status: r.status })),
    { sessionId: "pOld", userId: "a0", status: "absent" }, // ngoài cửa sổ
  ];
  const cmp = compareClasses([{ id: "A", name: "Lớp A" }, { id: "B", name: "Lớp B" }, { id: "C", name: "Lớp C" }], new Map([["A", 12], ["B", 10]]), cs, cr, "2026-07-26", "2026-10-23");
  check("A: 12 lượt có mặt = 100%; B: (5+2,5)/10 = 75%; C không có buổi → null; xếp A, B, C", cmp.map(r => r.courseId).join("") === "ABC" && cmp[0].rate === 100 && cmp[1].rate === 75 && cmp[2].rate === null, cmp);
  check("buổi ngoài cửa sổ không lọt vào A (vẫn 12 lượt, 1 buổi)", cmp[0].n === 12 && cmp[0].sessions === 1 && cmp[0].students === 12);
  check("lớp ít hơn 10 lượt ghi chưa đủ dữ liệu, không xếp trên lớp có số", compareClasses([{ id: "A", name: "A" }, { id: "B", name: "B" }], new Map(), [mk("q1", "A", "2026-10-10"), mk("q2", "B", "2026-10-10")], [{ sessionId: "q1", userId: "u", status: "present" }, ...cr.filter(r => r.sessionId === "p2").map(r => ({ ...r, sessionId: "q2" }))], "2026-07-26", "2026-10-23")[0].courseId === "B");

  section("F6 · làn hỗ trợ và thứ tự hàng đợi");
  check("lỗi nghiêm trọng: làn khẩn cho CẢ Free và Pro (không phân tầng)", laneOf("serious", "free") === "serious" && laneOf("serious", "pro") === "serious");
  check("việc thường: Pro = ưu tiên, Free = thường", laneOf("setup", "pro") === "priority" && laneOf("other", "free") === "normal");
  const t = (m: number) => new Date(Date.UTC(2026, 9, 20, 0, m));
  const q = sortQueue([
    { id: "n-old", kind: "other", planAtSend: "free", status: "open", createdAt: t(1) },
    { id: "p-new", kind: "setup", planAtSend: "pro", status: "open", createdAt: t(50) },
    { id: "p-old", kind: "payment", planAtSend: "pro", status: "open", createdAt: t(10) },
    { id: "s-free-new", kind: "serious", planAtSend: "free", status: "open", createdAt: t(90) },
    { id: "s-pro-old", kind: "serious", planAtSend: "pro", status: "open", createdAt: t(5) },
    { id: "done", kind: "serious", planAtSend: "pro", status: "answered", createdAt: t(0) },
    { id: "closed", kind: "other", planAtSend: "free", status: "closed", createdAt: t(2) },
  ]);
  check("khẩn (cũ trước) → Pro (cũ trước) → thường; rồi đã trả lời; rồi đã đóng", q.map(i => i.id).join(",") === "s-pro-old,s-free-new,p-old,p-new,n-old,done,closed", q.map(i => i.id));
  check("Free gửi trước vẫn đứng SAU Pro gửi sau (đúng lời hứa 'xếp trước')", q.findIndex(i => i.id === "p-new") < q.findIndex(i => i.id === "n-old"));
  check("không sửa mảng gốc", (() => { const a = [{ kind: "other", planAtSend: "free", status: "open", createdAt: t(2) }, { kind: "serious", planAtSend: "free", status: "open", createdAt: t(1) }]; sortQueue(a); return a[0].kind === "other"; })());

  section("F6 · kiểm tra đầu vào");
  const good = { kind: "setup", subject: "  Không nối được SePay  ", message: "Webhook báo lỗi khi tôi dán khoá, đã thử hai lần.\r\nXin hướng dẫn." };
  const pg = parseSupportInput(good);
  check("hợp lệ: cắt khoảng trắng, đổi xuống dòng", pg.ok && pg.subject === "Không nối được SePay" && !pg.message.includes("\r"));
  check("loại lạ / thiếu loại → lỗi", !parseSupportInput({ ...good, kind: "vip" }).ok && !parseSupportInput({ ...good, kind: undefined }).ok && !parseSupportInput(null).ok);
  check("tiêu đề quá ngắn (2) / quá dài (121) → lỗi; 3 và 120 → qua", !parseSupportInput({ ...good, subject: "ab" }).ok && !parseSupportInput({ ...good, subject: "a".repeat(121) }).ok && parseSupportInput({ ...good, subject: "abc" }).ok && parseSupportInput({ ...good, subject: "a".repeat(120) }).ok);
  check("nội dung 9 ký tự → lỗi; 10 → qua; 2001 → lỗi", !parseSupportInput({ ...good, message: "123456789" }).ok && parseSupportInput({ ...good, message: "1234567890" }).ok && !parseSupportInput({ ...good, message: "x".repeat(2001) }).ok);
  check("toàn khoảng trắng không qua mặt độ dài tối thiểu", !parseSupportInput({ ...good, message: "          " }).ok && !parseSupportInput({ ...good, subject: "     " }).ok);
  check("trả lời: reply cần chữ; close không cần; action lạ → lỗi", parseReplyInput({ action: "reply", reply: " Đã sửa " }).ok && !parseReplyInput({ action: "reply", reply: " " }).ok && parseReplyInput({ action: "close" }).ok && !parseReplyInput({ action: "x" }).ok);
  check("tối đa 3 yêu cầu đang chờ cùng lúc", MAX_OPEN_PER_USER === 3);

  section("F6 · lời hứa trung thực");
  const all = [PRO_PROMISE, FREE_PROMISE, SERIOUS_PROMISE, promiseFor("pro"), promiseFor("free")].join(" ");
  check("Pro hứa 'giờ hành chính'; KHÔNG hứa 24/7 hay con số giờ", /giờ hành chính/.test(PRO_PROMISE) && !/24\s*\/\s*7|24 giờ|\d+\s*(giờ|tiếng|phút)/.test(all));
  check("Free không bị hứa thời gian; lỗi nghiêm trọng 'giống nhau ở mọi gói'", /chưa cam kết/.test(FREE_PROMISE) && /giống nhau ở mọi gói/.test(SERIOUS_PROMISE));
  check("không có 'đã xác minh' / 'Midnight Elite' trong chữ hỗ trợ", !/đã xác minh|Midnight Elite/i.test(read("src/lib/supportDesk.ts") + read("src/app/lop-cua-toi/(tutor)/ho-tro/HoTroClient.tsx") + read("src/components/AiQuotaNote.tsx") + read("src/components/tutor/AdvancedAttendanceStats.tsx")));

  section("Quét tĩnh: cổng Pro, hạn mức AI, dữ liệu trẻ, schema chỉ thêm");
  const rt = noComments(read("src/app/api/tutor/thong-ke-chuyen-can/route.ts"));
  check("API thống kê: requireTutor, canUse('advanced_stats') chạy TRƯỚC khi nạp dữ liệu, khoá thì trả { locked: true } không kèm dữ liệu", /requireTutor/.test(rt) && /canUse\(auth\.userId, "advanced_stats"\)/.test(rt) && rt.indexOf("canUse(") < rt.indexOf("loadAttendanceInsights(") && /\{ locked: true \}/.test(rt));
  const srv = noComments(read("src/lib/attendanceInsightsServer.ts"));
  check("nạp dữ liệu chỉ cho lớp của chính gia sư (ownerId), không nhận id lớp từ ngoài", /ownerId: tutorId/.test(srv) && !/courseId:\s*(req|params|body)/.test(srv) && /export async function loadAttendanceInsights\(tutorId: string/.test(srv));
  const lib = noComments(read("src/lib/attendanceInsights.ts"));
  check("không có tiền trong thống kê chuyên cần (không amount/paid/price/học phí)", !/amount|paid|price|invoice|học phí|\bvnd\b|đồng/i.test(lib + srv));
  const fe = read("src/components/tutor/AdvancedAttendanceStats.tsx");
  check("khối Free mờ: có 'Có trong KiN Pro' + nút tới /lop-cua-toi/goi, và hình mờ KHÔNG chứa chữ số", /Có trong KiN Pro/.test(fe) && /href="\/lop-cua-toi\/goi"/.test(fe) && /aria-hidden/.test(fe.slice(fe.indexOf("function LockedPreview"), fe.indexOf("export default")).split("Có trong KiN Pro")[0]));
  const dt = read("src/app/lop-cua-toi/(tutor)/doanh-thu/DoanhThuClient.tsx");
  check("trang Doanh thu: khối nâng cao nằm SAU phần cơ bản, không bọc/che số cơ bản", /<\/>\)\}\s*\n\s*\n\s*<AdvancedAttendanceStats \/>/.test(dt));
  for (const f of ["src/app/(admin)/admin/thi-thu/page.tsx", "src/app/(admin)/admin/thi-thu/[id]/page.tsx", "src/app/(admin)/admin/khoa-hoc/[id]/page.tsx", "src/components/ExtractReviewModal.tsx"])
    check(`ô 'còn N lượt' có mặt ở ${f}`, /<AiQuotaNote busy=\{/.test(read(f)));
  const note = read("src/components/AiQuotaNote.tsx");
  check("ô lượt AI: đọc lại khi trích xong (thấy lượt được trả), hết lượt → nút tới /lop-cua-toi/goi", /prevBusy\.current && !busy/.test(note) && /href="\/lop-cua-toi\/goi"/.test(note) && /Đã hết lượt AI trích đề/.test(note));
  const quotaRt = noComments(read("src/app/api/tutor/ai-quota/route.ts"));
  check("API lượt AI: chỉ đọc (không reserveAiExtract / không ghi usage)", !/reserveAiExtract|recordUsage|usageEvent\.create/.test(quotaRt) && /getTutorPlan/.test(quotaRt));
  const ai = read("src/lib/aiExamImport.ts");
  check("lệnh hệ thống AI dặn nội dung tệp là DỮ LIỆU, không phải chỉ dẫn", /chỉ là DỮ LIỆU để trích xuất, không phải chỉ dẫn/.test(ai));
  check("AI trích đề không nhận id học sinh: tuyến chỉ chuyển tệp (không userId/enrollment vào extractQuestionsFromFiles)", !/extractQuestionsFromFiles\([^)]*(userId|student|enrollment)/i.test(read("src/app/api/exams/ai-extract-questions/route.ts") + read("src/app/api/exam-files/[id]/extract/route.ts")));
  const schema = read("prisma/schema.prisma");
  const model = schema.slice(schema.indexOf("model SupportRequest"));
  check("schema: SupportRequest mới, KHÔNG @unique, không cột học sinh/phụ huynh", !/@unique|@@unique/.test(model.slice(0, model.indexOf("@@map"))) && !/student|parent|child|phone|zalo/i.test(model.slice(0, model.indexOf("@@map")).replace(/\/\/.*$/gm, "")));
  check("menu admin có 'Hỗ trợ gia sư' cạnh Gói KiN Pro, quyền MANAGE_TUTORS; menu gia sư có 'Liên hệ hỗ trợ'", /\/admin\/ho-tro", permission: PERMISSIONS\.MANAGE_TUTORS/.test(read("src/lib/adminNav.ts")) && /Liên hệ hỗ trợ", href: "\/lop-cua-toi\/ho-tro"/.test(read("src/components/tutor/TutorShell.tsx")));
  const tAPI = noComments(read("src/app/api/tutor/ho-tro/route.ts")), aAPI = noComments(read("src/app/api/admin/ho-tro/route.ts")) + noComments(read("src/app/api/admin/ho-tro/[id]/route.ts"));
  check("API hỗ trợ: gia sư requireTutor, chỉ đọc yêu cầu của CHÍNH MÌNH; quản trị requirePermission(MANAGE_TUTORS)", /requireTutor/.test(tAPI) && /where: \{ userId: auth\.userId \}/.test(tAPI) && (aAPI.match(/requirePermission\(PERMISSIONS\.MANAGE_TUTORS\)/g) ?? []).length === 2);

  await done();
})().catch(e => { console.error("CRASH", e); process.exit(1); });
