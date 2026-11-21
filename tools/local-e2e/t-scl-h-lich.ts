// SCL-H (P2-31): lịch học sinh lọc đề ở SQL (listedToStudentWhere) — học sinh KHÔNG thấy đề lớp khác / đề nháp / đề bị thay / mã con / đề "giao theo link" của gia sư,
// vẫn thấy đề lớp em, thư viện chung của quản trị (kể cả đề không chủ) và đề được cấp quyền. Đối chiếu từng đề với luật thuần isListedToStudent (một nguồn).
// Cần Postgres, KHÔNG cần máy chủ. XOÁ SẠCH DB thử. Chạy: source tools/local-e2e/env.sh && TZ=Asia/Ho_Chi_Minh npx tsx tools/local-e2e/t-scl-h-lich.ts
import { mkTutor, mkSuper, mkUser, mkCourse, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { loadStudentScheduleEvents } from "@/lib/studentSchedule";
import { loadStudentTodo } from "@/lib/studentTodoServer";
import { isListedToStudent, listedToStudentWhere } from "@/lib/examVariantRoute";

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lịch"), SUP = await mkSuper("Quản trị");
  const S = await mkUser({ name: "Em Lịch" }), OTHER = await mkUser({ name: "Em Khác" });
  const A = await mkCourse(T.id, { name: "Lớp em" }), B = await mkCourse(T.id, { name: "Lớp khác" }), C = await mkCourse(T.id, { name: "Lớp đã nghỉ" });
  await prisma.enrollment.createMany({ data: [{ userId: S.id, courseId: A.id, status: "active" }, { userId: S.id, courseId: C.id, status: "suspended" }, { userId: OTHER.id, courseId: B.id, status: "active" }] });
  const d = new Date(Date.now() + 3 * 86_400_000);
  const date = `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
  const mk = (id: string, o: Record<string, unknown>) => prisma.exam.create({ data: { id, code: id, title: id, category: "Toán", date, time: "08:00", duration: "45", questions: 5, status: "available", createdAt: "2020", ...o } });
  // [id, dữ liệu, học sinh S thấy?]
  const cases: [string, Record<string, unknown>, boolean][] = [
    ["lop-em", { courseId: A.id, ownerId: T.id }, true],
    ["lop-khac", { courseId: B.id, ownerId: T.id }, false],
    ["lop-da-nghi", { courseId: C.id, ownerId: T.id }, false],
    ["nhap-lop-em", { courseId: A.id, ownerId: T.id, isDraft: true }, false],
    ["tat-lop-em", { courseId: A.id, ownerId: T.id, active: false }, false],
    ["xong-lop-em", { courseId: A.id, ownerId: T.id, status: "completed" }, false],
    ["chung-quan-tri", { courseId: null, ownerId: SUP.id }, true],
    ["chung-khong-chu", { courseId: null, ownerId: null }, true],
    ["link-gia-su", { courseId: null, ownerId: T.id }, false],
    ["cap-quyen-lop-khac", { courseId: B.id, ownerId: T.id }, true],
  ];
  for (const [id, o] of cases) await mk(id, o);
  await mk("ma-con", { courseId: A.id, ownerId: T.id, variantOfId: "lop-em" });
  await mk("ban-cu", { courseId: A.id, ownerId: T.id, supersededById: "lop-em" });
  cases.push(["ma-con", {}, false], ["ban-cu", {}, false]);
  await prisma.examGuestAccess.create({ data: { userId: S.id, examId: "cap-quyen-lop-khac", grantedBy: T.id } });

  section("Lịch học sinh: đúng tập đề");
  const seen = new Set((await loadStudentScheduleEvents(S.id)).filter(e => e.type === "exam").map(e => e.id.replace(/^exam-/, "")));
  for (const [id, , want] of cases) check(`${want ? "thấy" : "KHÔNG thấy"} đề ${id}`, seen.has(id) === want, [...seen]);

  section("Điều kiện SQL khớp luật thuần isListedToStudent (mọi đề hợp lệ)");
  const all = await prisma.exam.findMany({ where: { active: true, isDraft: false, supersededById: null, status: { not: "completed" } }, select: { id: true, variantOfId: true, courseId: true, owner: { select: { adminRole: true } } } });
  const sql = new Set((await prisma.exam.findMany({ where: { active: true, isDraft: false, supersededById: null, status: { not: "completed" }, ...listedToStudentWhere([A.id], ["cap-quyen-lop-khac"]) }, select: { id: true } })).map(e => e.id));
  const js = new Set(all.filter(e => e.id === "cap-quyen-lop-khac" || isListedToStudent(e, e.owner?.adminRole, new Set([A.id]))).map(e => e.id));
  check("SQL và JS chọn cùng một tập", sql.size === js.size && [...js].every(id => sql.has(id)), { sql: [...sql], js: [...js] });
  const none = (await prisma.exam.findMany({ where: listedToStudentWhere([], []), select: { id: true } })).map(e => e.id).sort();
  check("không lớp, không cấp quyền: chỉ thư viện chung (kể cả đề không chủ), không đề link của gia sư", none.join() === "chung-khong-chu,chung-quan-tri", none);

  section("Một phản hồi cho việc + lịch");
  const todo = await loadStudentTodo(S.id);
  check("loadStudentTodo trả kèm events = loadStudentScheduleEvents", JSON.stringify(todo.events) === JSON.stringify(await loadStudentScheduleEvents(S.id)));
  const LONE = await mkUser({ name: "Em Chưa Vào Lớp" });
  const lone = await loadStudentTodo(LONE.id);
  check("học sinh chưa vào lớp nào: không việc, vẫn có lịch thư viện chung, không đề lớp", lone.items.length === 0 && lone.events.some(e => e.id === "exam-chung-quan-tri") && !lone.events.some(e => e.id === "exam-lop-khac"), lone.events.map(e => e.id));

  await prisma.$disconnect();
  await done();
})().catch(async e => { console.error(e); process.exit(1); });
