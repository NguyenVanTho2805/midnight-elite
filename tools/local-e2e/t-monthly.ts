import { api, mkTutor, mkUser, mkCourse, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";

const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const RUN = Date.now().toString(16).padStart(16, "0").slice(-16);
const tok = (n: number) => (RUN + n.toString(16).padStart(16, "0")).slice(-32);
let seq = 0;
const id = (p: string) => `${p}-${Date.now().toString(36)}-${++seq}`;
const YM = "2026-09";
const vn = (day: string, hm = "12:00") => new Date(`${day}T${hm}:00+07:00`);

async function mkLesson(courseId: string) {
  const sid = id("s"), cid = id("c"), lid = id("l");
  await prisma.section.create({ data: { id: sid, title: "P", courseId } });
  await prisma.chapter.create({ data: { id: cid, title: "C", sectionId: sid } });
  await prisma.lesson.create({ data: { id: lid, code: lid, title: "B", type: "record", chapterId: cid } });
  return lid;
}
async function mkAssignment(lessonId: string, dueIso: Date | null, title = "BTVN") {
  return prisma.assignment.create({ data: { lessonId, title, dueDate: dueIso } });
}
async function mkExamResult(userId: string, courseId: string, score: number, total: number, day: string) {
  const eid = id("ex");
  await prisma.exam.create({ data: { id: eid, code: eid, title: "KT", category: "Toán", date: "01/01/2020", time: "08:00", duration: "45 phút", questions: 0, status: "available", createdAt: "2020", courseId } });
  return prisma.examResult.create({ data: { userId, examId: eid, score, totalPoints: total, completedAt: vn(day) } });
}
async function mkSession(courseId: string, date: string, createdBy: string, recs: Record<string, string>) {
  const s = await prisma.attendanceSession.create({ data: { courseId, date: new Date(`${date}T00:00:00Z`), createdBy } });
  for (const [uid, st] of Object.entries(recs)) await prisma.attendanceRecord.create({ data: { sessionId: s.id, userId: uid, status: st } });
}

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan"), T2 = await mkTutor("Thầy Khác");
  const A = await mkUser({ name: "Minh Anh" }), B = await mkUser({ name: "Bảo Bình" }), C = await mkUser({ name: "Chi Chi" });
  await prisma.user.update({ where: { id: A.id }, data: { parentName: "Hoa", parentPhone: "0901234567" } });
  const toan = await mkCourse(T.id, { name: "Toán 9" }), van = await mkCourse(T.id, { name: "Văn 9" }), ly = await mkCourse(T2.id, { name: "Lý 9 (thầy khác)" });
  for (const [u, c] of [[A, toan], [A, van], [A, ly], [B, toan]] as const) await prisma.enrollment.create({ data: { userId: u.id, courseId: c.id, status: "active" } });
  // C: học lớp của gia sư khác; học sinh đã rời lớp (suspended) vẫn có báo cáo
  await prisma.enrollment.create({ data: { userId: C.id, courseId: ly.id, status: "active" } });

  // Toán / tháng 9: chuyên cần A = (1+1+1+0.9+0.5)/5 = 0.88 ; Văn: chưa điểm danh
  await mkSession(toan.id, "2026-09-03", T.id, { [A.id]: "present", [B.id]: "present" });
  await mkSession(toan.id, "2026-09-10", T.id, { [A.id]: "present", [B.id]: "absent" });
  await mkSession(toan.id, "2026-09-17", T.id, { [A.id]: "present", [B.id]: "present" });
  await mkSession(toan.id, "2026-09-24", T.id, { [A.id]: "late", [B.id]: "present" });
  await mkSession(toan.id, "2026-09-30", T.id, { [A.id]: "absent", [B.id]: "present" });
  await mkSession(ly.id, "2026-09-05", T2.id, { [A.id]: "present" }); // lớp của gia sư khác: không được lọt vào báo cáo của T
  // Bài về nhà tháng 9: 4 bài có hạn trong tháng (A nộp đúng hạn 1/4), 1 bài hạn tháng 10, 1 bài không đặt hạn
  const lt = await mkLesson(toan.id);
  const a1 = await mkAssignment(lt, vn("2026-09-05")), a2 = await mkAssignment(lt, vn("2026-09-12")), a3 = await mkAssignment(lt, vn("2026-09-19")), a4 = await mkAssignment(lt, vn("2026-09-26"));
  await mkAssignment(lt, vn("2026-10-03")); await mkAssignment(lt, null);
  await prisma.assignmentSubmission.create({ data: { assignmentId: a1.id, userId: A.id, fileUrl: "x", submittedAt: vn("2026-09-05", "11:00") } });  // đúng hạn
  await prisma.assignmentSubmission.create({ data: { assignmentId: a2.id, userId: A.id, fileUrl: "x", submittedAt: vn("2026-09-14") } });          // trễ
  await prisma.assignmentSubmission.create({ data: { assignmentId: a3.id, userId: A.id, fileUrl: "x", submittedAt: vn("2026-09-25") } });          // trễ
  // a4: không nộp. Bài tháng 10 và bài không hạn: không tính
  // Năng lực Toán: tháng 8 ba bài 9 (đạt), tháng 9 ba bài 7 / 6,5 / 6 (điểm 10 → quy thang 10)
  for (const [d, sc] of [["2026-08-05", 9], ["2026-08-12", 9], ["2026-08-20", 9], ["2026-09-05", 7], ["2026-09-15", 6.5], ["2026-09-25", 6]] as const) await mkExamResult(A.id, toan.id, sc * 15, 150, d);
  await mkExamResult(A.id, toan.id, 1, 150, "2026-10-05"); // sau tháng báo cáo: không tính vào tháng 9
  await mkExamResult(A.id, ly.id, 10, 10, "2026-09-05");  // đề của lớp gia sư khác

  const list = (as?: any, ym = YM) => api("GET", `/api/tutor/monthly-reports?yearMonth=${ym}`, { as });
  const det = (sid: string, as: any = T, ym = YM) => api("GET", `/api/tutor/monthly-reports/${sid}?yearMonth=${ym}`, { as });
  const put = (sid: string, items: unknown, as: any = T, ym = YM) => api("PUT", `/api/tutor/monthly-reports/${sid}?yearMonth=${ym}`, { as, body: { items } });
  const approve = (sid: string, items: unknown, as: any = T, ym = YM) => api("POST", `/api/tutor/monthly-reports/${sid}/approve?yearMonth=${ym}`, { as, body: { items } });

  section("Quyền + kiểm tra đầu vào");
  check("chưa đăng nhập → 401; học viên → 403", (await list(undefined)).status === 401 && (await list(A)).status === 403 && (await det(A.id, A)).status === 403);
  check("yearMonth sai định dạng → 400; tháng chưa tới → 400", (await list(T, "2026-13")).status === 400 && (await list(T, "tháng-9")).status === 400 && (await list(T, "2099-01")).status === 400 && (await det(A.id, T, "2099-01")).status === 400);
  check("mặc định = tháng hiện tại", (await api("GET", "/api/tutor/monthly-reports", { as: T })).json.yearMonth === new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 7));

  section("Danh sách học sinh của gia sư");
  let l = await list(T);
  check("chỉ học sinh học lớp của T: Minh Anh + Bảo Bình (không có Chi Chi của thầy khác)", l.status === 200 && eq(l.json.items.map((x: any) => x.name), ["Bảo Bình", "Minh Anh"]), l.json.items?.map((x: any) => x.name));
  const rowA = l.json.items.find((x: any) => x.studentId === A.id);
  check("môn: chỉ lớp của T (Toán 9 + Văn 9), không lộ lớp của thầy khác", eq(rowA.courses.sort(), ["Toán 9", "Văn 9"]) && l.json.items.every((x: any) => x.status === "none") && eq(l.json.summary, { total: 2, approved: 0, draft: 0, none: 2 }));

  section("Số liệu thật của một học sinh");
  let d = await det(A.id);
  check("200 + thông tin phụ huynh", d.status === 200 && d.json.student.parentName === "Hoa" && d.json.student.parentPhone === "0901234567", d.json?.student);
  const toanM = d.json.subjects.find((s: any) => s.courseName === "Toán 9"), vanM = d.json.subjects.find((s: any) => s.courseName === "Văn 9");
  check("chỉ 2 môn của T (không có Lý của thầy khác)", d.json.subjects.length === 2 && !d.json.subjects.some((s: any) => s.courseName.includes("thầy khác")));
  check("chuyên cần Toán = (1+1+1+0,9+0,5)/5 = 88%, 5 buổi; chỉ buổi trong tháng", Math.abs(toanM.attendance.ratio - 0.88) < 1e-9 && toanM.attendance.sessions === 5, toanM.attendance);
  check("bài về nhà: 4 bài hạn trong tháng, đúng hạn 1 (bài hạn tháng 10 và bài không đặt hạn không tính)", eq(toanM.homework, { assigned: 4, onTime: 1, ratio: 0.25 }), toanM.homework);
  check("nỗ lực = 10×(0,5×0,88 + 0,5×0,25) = 5,65 → 6", toanM.effort === 6, toanM.effort);
  check("năng lực: 3 bài gần nhất tới hết tháng 9 = 7 · 6,5 · 6 (bài tháng 10 không tính), TB 6,5", eq(toanM.mastery.scores, [7, 6.5, 6]) && toanM.mastery.value === 6.5, toanM.mastery);
  check("nhãn: 'Đang tụt · tháng 8 đã đạt', màu 'chờ' (không đỏ)", toanM.mastery.code === "tut" && toanM.mastery.text === "Đang tụt · tháng 8 đã đạt" && toanM.mastery.tone === "cho");
  check("môn chưa điểm danh/chưa bài: không ghi 0 — null và 'Chưa đủ 3 bài'", vanM.attendance.ratio === null && vanM.effort === null && vanM.mastery.value === null && vanM.mastery.code === "chua-du");
  const sug = d.json.suggested as any[];
  check("gợi ý 1: môn đang tụt — kèm điểm đầu & cuối (7,0 → 6,0)", sug.some(x => x.kind === "tut" && x.text.includes("Toán 9") && x.text.includes("từ 7,0 xuống 6,0")), sug);
  check("gợi ý 2: bài về nhà 1/4 = 25% < 70%", sug.some(x => x.kind === "btvn" && x.text.includes("1/4 bài (25%)")), sug);
  check("gợi ý 3 chưa có (Nỗ lực 6 < 8)", !sug.some(x => x.kind === "cach-day"));
  check("chưa lưu nháp → items = gợi ý của KiN, hasDraft=false", d.json.hasDraft === false && eq(d.json.items, d.json.suggested));
  check("văn bản soạn sẵn có mục cố định + xưng hô + hai dòng riêng", d.json.text.startsWith("Kính gửi anh/chị Hoa,") && d.json.text.includes("Điều chưa đạt tháng này:") && /- Nỗ lực: 6\/10/.test(d.json.text) && /- Năng lực: 6,5\/10 \(7,0 · 6,5 · 6,0\)/.test(d.json.text) && d.json.text.trim().endsWith("Cô Lan"), d.json.text);
  check("học sinh của thầy khác / không tồn tại → 404 (không lộ)", (await det(C.id)).status === 404 && (await det("khong-co")).status === 404 && (await det(B.id, T2)).status === 404 && (await det(A.id, T2)).status === 200);

  section("Gia sư sửa nháp");
  check("gửi sai kiểu / quá dài / quá nhiều dòng → 400", (await put(A.id, "x")).status === 400 && (await put(A.id, [{ text: "a".repeat(301) }])).status === 400 && (await put(A.id, Array.from({ length: 13 }, (_, i) => ({ text: `d${i}` })))).status === 400);
  check("thầy khác (không dạy em này) / học viên không sửa được", (await put(B.id, [], T2)).status === 404 && (await put(A.id, [], A)).status === 403);
  let r = await put(A.id, [{ text: "  Toán 9 đang tụt, cô sẽ phụ đạo thêm  ", kind: "tut" }, { text: "   " }, { text: "Văn 9: cần nộp bài đúng hạn hơn" }]);
  check("lưu: cắt khoảng trắng, bỏ dòng trống, dòng tự viết = 'tu-viet'", r.status === 200 && eq(r.json.items, [{ text: "Toán 9 đang tụt, cô sẽ phụ đạo thêm", kind: "tut" }, { text: "Văn 9: cần nộp bài đúng hạn hơn", kind: "tu-viet" }]), r.json);
  d = await det(A.id);
  check("mở lại: dùng bản nháp của gia sư (không phải gợi ý), vẫn trả gợi ý gốc để khôi phục", d.json.hasDraft === true && d.json.items.length === 2 && d.json.suggested.length >= 2 && d.json.text.includes("- Toán 9 đang tụt, cô sẽ phụ đạo thêm"));
  l = await list(T);
  check("danh sách: Minh Anh = 'draft'", l.json.items.find((x: any) => x.studentId === A.id).status === "draft" && eq(l.json.summary, { total: 2, approved: 0, draft: 1, none: 1 }));
  r = await put(A.id, []);
  check("nháp rỗng cũng lưu được (không rơi về gợi ý)", r.status === 200 && (await det(A.id)).json.hasDraft === true && eq((await det(A.id)).json.items, []));
  const portalTok = tok(0xa1);
  await prisma.parentLink.create({ data: { parentId: (await mkUser({ name: "Chị Hoa" })).id, studentId: A.id, status: "verified", verifiedAt: new Date(), portalToken: portalTok } });
  const portal = () => api("GET", `/api/parent-portal/${portalTok}?yearMonth=${YM}`);
  check("TRƯỚC khi duyệt: phụ huynh KHÔNG thấy báo cáo nào", (await portal()).json.reports.length === 0);

  section("Duyệt → phụ huynh thấy");
  const items = [{ text: "Toán 9 đang tụt, cô sẽ phụ đạo thêm", kind: "tut" }, { text: "Văn 9: cần nộp bài đúng hạn hơn", kind: "tu-viet" }];
  check("thầy khác (không dạy em này) / học viên không duyệt được; sai dữ liệu → 400", (await approve(B.id, items, T2)).status === 404 && (await approve(A.id, items, A)).status === 403 && (await approve(A.id, "x")).status === 400 && (await prisma.monthlyReport.count({ where: { studentId: B.id } })) === 0);
  r = await approve(A.id, items);
  check("duyệt → 200 + văn bản", r.status === 200 && !!r.json.approvedAt && r.json.text.includes("Điều chưa đạt tháng này:"), r.json);
  let pr = (await portal()).json.reports as any[];
  check("phụ huynh thấy đúng 1 báo cáo T9 của gia sư Cô Lan, kèm 2 môn và các dòng đã duyệt", pr.length === 1 && pr[0].yearMonth === YM && pr[0].tutorName === "Cô Lan" && pr[0].subjects.length === 2 && eq(pr[0].items.map((i: any) => [i.text, i.kind]), items.map(i => [i.text, i.kind])), { n: pr.length, ym: pr[0]?.yearMonth, tutor: pr[0]?.tutorName, subj: pr[0]?.subjects.length, items: pr[0]?.items });
  check("phụ huynh KHÔNG thấy lớp của thầy khác", !JSON.stringify(pr).includes("thầy khác"));
  check("số liệu đóng băng: Nỗ lực 6, Năng lực 6,5 (7 · 6,5 · 6)", pr[0].subjects.find((s: any) => s.courseName === "Toán 9").effort === 6 && eq(pr[0].subjects.find((s: any) => s.courseName === "Toán 9").mastery.scores, [7, 6.5, 6]));
  // dữ liệu đổi sau khi duyệt → phiếu phụ huynh không đổi
  await mkExamResult(A.id, toan.id, 150, 150, "2026-09-28");
  pr = (await portal()).json.reports;
  check("sau khi duyệt, dữ liệu mới (bài thi thêm) KHÔNG làm đổi phiếu phụ huynh", eq(pr[0].subjects.find((s: any) => s.courseName === "Toán 9").mastery.scores, [7, 6.5, 6]));
  check("còn gia sư thì số liệu của gia sư tính lại theo dữ liệu mới", eq((await det(A.id)).json.subjects.find((s: any) => s.courseName === "Toán 9").mastery.scores, [6.5, 6, 10]));
  l = await list(T);
  check("danh sách: 'approved'", l.json.items.find((x: any) => x.studentId === A.id).status === "approved" && l.json.summary.approved === 1);

  section("Sửa sau khi duyệt: phụ huynh vẫn thấy bản cũ cho tới khi duyệt lại");
  await put(A.id, [{ text: "Bản mới chưa duyệt", kind: "tu-viet" }]);
  l = await list(T);
  check("danh sách báo 'đã sửa sau khi duyệt'", l.json.items.find((x: any) => x.studentId === A.id).changedSinceApproval === true);
  check("phụ huynh vẫn thấy bản đã duyệt cũ", (await portal()).json.reports[0].items.length === 2);
  await approve(A.id, [{ text: "Bản mới đã duyệt", kind: "tu-viet" }]);
  check("duyệt lại → phụ huynh thấy bản mới", eq((await portal()).json.reports[0].items.map((i: any) => i.text), ["Bản mới đã duyệt"]));

  section("Mục 'Điều chưa đạt' LUÔN có, kể cả rỗng");
  await approve(A.id, []);
  pr = (await portal()).json.reports;
  check("duyệt với danh sách rỗng → items = [] (giao diện in câu cố định)", pr.length === 1 && eq(pr[0].items, []));
  const empty = await det(A.id);
  check("văn bản soạn sẵn khi rỗng có đúng câu 'Tháng này không có mục nào chưa đạt.'", empty.json.text.includes("Điều chưa đạt tháng này:\nTháng này không có mục nào chưa đạt."), empty.json.text);

  section("Zalo: chỉ ghi 'đã mở', chỉ khi đã duyệt");
  const z = (sid: string, as: any = T) => api("POST", `/api/tutor/monthly-reports/${sid}/zalo?yearMonth=${YM}`, { as });
  check("chưa duyệt (Bảo Bình) → 409", (await z(B.id)).status === 409);
  check("thầy khác (chưa có báo cáo của họ cho em này) → 409; học viên → 403", (await z(A.id, T2)).status === 409 && (await z(A.id, A)).status === 403);
  r = await z(A.id);
  check("đã duyệt → 200 + openedAt", r.status === 200 && !!r.json.openedAt);
  check("danh sách hiện 'đã mở Zalo lúc'", !!(await list(T)).json.items.find((x: any) => x.studentId === A.id).zaloOpenedAt && !JSON.stringify((await list(T)).json).includes('"sent"'));
  await approve(A.id, [{ text: "bản khác", kind: "tu-viet" }]);
  check("duyệt lại → xoá dấu 'đã mở Zalo' (bản mới chưa gửi)", (await list(T)).json.items.find((x: any) => x.studentId === A.id).zaloOpenedAt === null);

  section("Gỡ khỏi Sổ của con");
  r = await api("DELETE", `/api/tutor/monthly-reports/${A.id}/approve?yearMonth=${YM}`, { as: T });
  check("gỡ → 200; phụ huynh không còn thấy; nháp giữ nguyên", r.status === 200 && (await portal()).json.reports.length === 0 && (await det(A.id)).json.hasDraft === true);
  check("gỡ lần 2 → 404; thầy khác gỡ → 404", (await api("DELETE", `/api/tutor/monthly-reports/${A.id}/approve?yearMonth=${YM}`, { as: T })).status === 404 && (await api("DELETE", `/api/tutor/monthly-reports/${A.id}/approve?yearMonth=${YM}`, { as: T2 })).status === 404);

  section("Báo cáo tách theo gia sư + tháng");
  await approve(A.id, [{ text: "T9 của cô Lan", kind: "tu-viet" }]);
  const rep2 = await api("POST", `/api/tutor/monthly-reports/${A.id}/approve?yearMonth=2026-08`, { as: T, body: { items: [] } });
  check("duyệt tháng 8 → phụ huynh xem tháng 9 thấy cả báo cáo tháng 8 (tháng trước) và 9", rep2.status === 200 && eq((await portal()).json.reports.map((x: any) => x.yearMonth), ["2026-09", "2026-08"]));
  // Thầy khác cũng có lớp của A → báo cáo riêng
  await api("POST", `/api/tutor/monthly-reports/${A.id}/approve?yearMonth=${YM}`, { as: T2, body: { items: [{ text: "Lý: nhắc cô", kind: "tu-viet" }] } });
  pr = (await portal()).json.reports;
  const t9 = pr.filter((x: any) => x.yearMonth === YM);
  check("hai gia sư dạy cùng em → hai báo cáo riêng, mỗi cái chỉ có môn của mình", t9.length === 2 && t9.every((x: any) => x.subjects.every((s: any) => (x.tutorName === "Cô Lan" ? !s.courseName.includes("Lý") : s.courseName.includes("Lý")))), t9.map((x: any) => [x.tutorName, x.subjects.map((s: any) => s.courseName)]));

  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
