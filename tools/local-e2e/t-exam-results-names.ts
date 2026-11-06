// NO-0511 (API + DB thật + hàm thuần) — GET /api/exam-results?examId= che tên học sinh theo cùng chính sách với bảng xếp hạng (quyết định 1B, maskName).
//   Tên ĐẦY ĐỦ chỉ cho: quản trị (admin_super / admin_content), gia sư là chủ ĐỀ, gia sư là chủ LỚP gắn với đề.
//   Mọi người khác (học sinh cùng lớp, học sinh lớp khác, gia sư lớp khác) → tên che 'Nguyễn V. A.'; khách → 401; không lộ email / trường / ngày sinh.
// Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-exam-results-names.ts
//
// CA PHÁ CỐ ý (mỗi lần một thứ rồi hoàn lại):
//   - exam-results/route.ts: đổi `full ?` thành `true ?` (hoặc bỏ map maskName) → mọi ca "tên che" đỏ.
//   - examBoardPrivacy.ts: bỏ dòng `if (session.role !== "admin") return false` → học sinh có adminRole giả không có; đổi `teacher` thành luôn true → ca "gia sư lớp khác" đỏ.
//   - examBoardPrivacy.ts: bỏ nhánh courseOwnerId → ca "chủ lớp (không phải chủ đề)" đỏ.
import { prisma } from "@/lib/prisma";
import { api, mkUser, mkTutor, mkSuper, mkCourse, wipe, check, section, done } from "./h";
import { canSeeFullStudentNames } from "@/lib/examBoardPrivacy";

async function main() {
  section("Hàm thuần canSeeFullStudentNames");
  const ex = { examOwnerId: "T1", courseOwnerId: "T2" };
  const full = (s: Parameters<typeof canSeeFullStudentNames>[0], e = ex) => canSeeFullStudentNames(s, e);
  check("admin_super / admin_content → đầy đủ", full({ userId: "x", role: "admin", adminRole: "admin_super" }) && full({ userId: "x", role: "admin", adminRole: "admin_content" }));
  check("gia sư chủ đề (T1) và chủ lớp (T2) → đầy đủ", full({ userId: "T1", role: "admin", adminRole: "teacher" }) && full({ userId: "T2", role: "admin", adminRole: "teacher" }));
  check("gia sư khác (T3) → che", !full({ userId: "T3", role: "admin", adminRole: "teacher" }));
  check("học sinh (kể cả trùng id chủ đề) → che", !full({ userId: "T1", role: "student" }));
  check("đề không chủ, không lớp: gia sư → che; quản trị → đầy đủ", !full({ userId: "T1", role: "admin", adminRole: "teacher" }, { examOwnerId: null, courseOwnerId: null }) && full({ userId: "x", role: "admin", adminRole: "admin_super" }, { examOwnerId: null, courseOwnerId: null }));

  await wipe();
  const T1 = await mkTutor("Cô Chủ Đề"), T2 = await mkTutor("Thầy Chủ Lớp"), T3 = await mkTutor("Cô Lớp Khác"), SA = await mkSuper("Quản trị");
  const C = await mkCourse(T2.id, { name: "Toán 9" }), C2 = await mkCourse(T3.id, { name: "Lý 9" });
  const mkExam = (id: string, o: object) => prisma.exam.create({ data: { id, code: id, title: id, category: "toan", date: "01/01/2030", time: "08:00", duration: "15 phút", questions: 1, status: "available", totalPoints: 150, createdAt: "2026-10-24", ...o } as never });
  await mkExam("e-nm", { ownerId: T1.id, courseId: C.id });
  const names = ["Nguyễn Văn An", "Trần Thị Bình", "Lê Hoàng Cường"];
  const S: Awaited<ReturnType<typeof mkUser>>[] = [];
  for (let i = 0; i < 3; i++) {
    const u = await mkUser({ name: names[i] });
    await prisma.user.update({ where: { id: u.id }, data: { school: `THPT Bí Mật ${i}`, dateOfBirth: new Date("2009-05-05") } });
    await prisma.examResult.create({ data: { userId: u.id, examId: "e-nm", score: 100 - i, totalPoints: 150 } });
    S.push(u);
  }
  await prisma.enrollment.create({ data: { userId: S[0].id, courseId: C.id, status: "active" } });
  const other = await mkUser({ name: "Phạm Lớp Khác" }); await prisma.enrollment.create({ data: { userId: other.id, courseId: C2.id, status: "active" } });
  const URL = "/api/exam-results?examId=e-nm";
  const leaks = (t: string) => /Văn An|Thị Bình|Hoàng Cường|THPT|Bí Mật|2009|@test\.local/.test(t);
  const fullOk = (r: { json: any }) => r.json?.map((x: any) => x.user?.name).join("|") === names.join("|");
  const maskOk = (r: { json: any; text: string }) => r.json?.map((x: any) => x.user?.name).join("|") === "Nguyễn V. A.|Trần T. B.|Lê H. C." && !leaks(r.text);

  section("Che tên");
  const g = await api("GET", URL);
  check("khách → 401, không lộ gì", g.status === 401 && !leaks(g.text), g.status);
  const a = await api("GET", URL, { as: S[0] });
  check("học sinh cùng lớp (cả dòng của chính em): 200, 3 dòng, tên che, không trường / email / ngày sinh", a.status === 200 && a.json?.length === 3 && maskOk(a), a.text.slice(0, 300));
  const b = await api("GET", URL, { as: other });
  check("học sinh lớp khác: tên che", b.status === 200 && maskOk(b), b.text.slice(0, 300));
  const t3 = await api("GET", URL, { as: T3 });
  check("gia sư lớp khác: tên che", t3.status === 200 && maskOk(t3), t3.text.slice(0, 300));
  check("điểm vẫn đúng thứ tự 100, 99, 98 (giao diện phòng thi chỉ cần điểm)", [a, b, t3].every(r => r.json?.map((x: any) => x.score).join() === "100,99,98"));

  section("Tên đầy đủ cho người có quyền");
  const t1 = await api("GET", URL, { as: T1 });
  check("gia sư chủ đề → tên đầy đủ", t1.status === 200 && fullOk(t1), t1.text.slice(0, 200));
  const t2 = await api("GET", URL, { as: T2 });
  check("gia sư chủ lớp (không phải chủ đề) → tên đầy đủ", t2.status === 200 && fullOk(t2), t2.text.slice(0, 200));
  const sa = await api("GET", URL, { as: SA });
  check("quản trị → tên đầy đủ", sa.status === 200 && fullOk(sa), sa.text.slice(0, 200));
  check("kể cả người có quyền, không lộ trường / email / ngày sinh", ![t1, t2, sa].some(r => /THPT|Bí Mật|2009|@test\.local/.test(r.text)));

  section("Đề không gắn lớp / không chủ");
  await mkExam("e-free", {}); await prisma.examResult.create({ data: { userId: S[1].id, examId: "e-free", score: 90, totalPoints: 150 } });
  const f1 = await api("GET", "/api/exam-results?examId=e-free", { as: T1 });
  const f2 = await api("GET", "/api/exam-results?examId=e-free", { as: SA });
  check("đề không chủ: gia sư → tên che; quản trị → đầy đủ", f1.json?.[0]?.user?.name === "Trần T. B." && f2.json?.[0]?.user?.name === "Trần Thị Bình", [f1.json, f2.json]);
  const none = await api("GET", "/api/exam-results?examId=khong-co", { as: S[0] });
  check("đề không tồn tại → 200 mảng rỗng (không lỗi 500)", none.status === 200 && Array.isArray(none.json) && none.json.length === 0, none.status);
  done();
}
main().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
