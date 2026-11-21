// SCL-C — sổ điểm gọn + duyệt điểm tự khai + giao bài thẳng + Kết quả của học sinh (máy chủ dev + DB riêng, wipe() ở đầu).
//   P1-1 GET /api/tutor/so-diem: Chủ nhiệm thấy mọi lớp; gia sư A không thấy lớp B; học sinh 403. GET /api/student/ket-qua: học sinh chỉ thấy điểm của mình.
//   Q5   POST /api/tutor/so-diem/duyet (form, 303): điểm chờ duyệt không vào báo cáo / bảng xếp hạng đề; duyệt xong mới vào. Sửa / Từ chối. Chỉ chủ lớp / Chủ nhiệm.
//   P2-2 POST /api/tutor/bai-tap/giao: bài tập không cần chọn bài học; quiz có sẵn gắn vào lớp. POST /api/tutor/so-diem/cham: nhập điểm bài nộp.
// Chạy: source tools/local-e2e/env.sh && TZ=Asia/Ho_Chi_Minh npx tsx tools/local-e2e/t-so-diem.ts
import { prisma } from "@/lib/prisma";
import { api, mkUser, mkTutor, mkSuper, mkCourse, wipe, check, section, done } from "./h";
import { loadStudentMonth } from "@/lib/monthlyReportServer";
import { vnMonthKey } from "@/lib/revenue";

const form = (o: Record<string, string>) => ({ raw: new URLSearchParams(o).toString(), headers: { "content-type": "application/x-www-form-urlencoded" } });
const loc = (r: { headers: Headers }) => r.headers.get("location") ?? "";
const mkExam = (id: string, o: object) => prisma.exam.create({ data: { id, code: id, title: id, category: "toan", date: "01/01/2030", time: "08:00", duration: "45 phút", questions: 0, status: "available", createdAt: "2026-11-21", totalPoints: 10, ...o } as never });

async function main() {
  await wipe();
  const T = await mkTutor("Cô Lan"), T2 = await mkTutor("Thầy Khác"), SA = await mkSuper("Chủ nhiệm");
  const s1 = await mkUser({ name: "Em Gia Bảo" }), s2 = await mkUser({ name: "Em Đỗ Hà" });
  const c1 = await mkCourse(T.id, { name: "Toán 9" }), x1 = await mkCourse(T2.id, { name: "Hoá 9" });
  for (const [u, c] of [[s1, c1], [s2, c1], [s1, x1]] as const) await prisma.enrollment.create({ data: { userId: u.id, courseId: c.id, status: "active" } });
  await mkExam("az-c1", { ownerId: T.id, courseId: c1.id, azotaUrl: "https://azota.vn/x" });
  await mkExam("az-x1", { ownerId: T2.id, courseId: x1.id, azotaUrl: "https://azota.vn/y" });
  await mkExam("qz-t", { ownerId: T.id, questions: 1 });
  await prisma.examQuestion.create({ data: { id: "qz-t-1", examId: "qz-t", text: "1+1?" } });

  section("P2-2 · + Giao bài thẳng (không chọn bài học)");
  const g0 = await api("GET", "/api/tutor/bai-tap/giao", { as: T });
  check("GET: lớp của mình + quiz đã phát hành của mình", g0.status === 200 && g0.json.courses.map((c: any) => c.id).join() === c1.id && g0.json.quizzes.some((q: any) => q.id === "qz-t"), g0.json);
  check("GET học sinh → 403", (await api("GET", "/api/tutor/bai-tap/giao", { as: s1 })).status === 403);
  const g1 = await api("POST", "/api/tutor/bai-tap/giao", { as: T, body: { kind: "bai-tap", courseId: c1.id, title: "Bài về nhà 1", dueDate: "2030-01-05" } });
  const bt = await prisma.assignment.findFirst({ where: { title: "Bài về nhà 1" }, include: { lesson: { include: { chapter: { include: { section: true } } } } } });
  check("bài tập giao thẳng → 200, href về sổ điểm của lớp", g1.status === 200 && g1.json.href === `/lop-cua-toi/so-diem?lop=${c1.id}&ghi=da-giao`, g1.json);
  check("tạo mục RIÊNG đã đăng trong lớp, hạn 23:59 giờ VN", bt?.lesson.chapter.section.courseId === c1.id && bt.lesson.status === "published" && bt.dueDate?.toISOString() === "2030-01-05T16:59:00.000Z", [bt?.lesson.status, bt?.dueDate]);
  check("gia sư khác giao vào lớp mình → 403", (await api("POST", "/api/tutor/bai-tap/giao", { as: T2, body: { kind: "bai-tap", courseId: c1.id, title: "x" } })).status === 403);
  check("thiếu tiêu đề → 400 có chữ", (await api("POST", "/api/tutor/bai-tap/giao", { as: T, body: { kind: "bai-tap", courseId: c1.id, title: " " } })).status === 400);
  check("tệp đề là link ngoài (Drive) → 400", (await api("POST", "/api/tutor/bai-tap/giao", { as: T, body: { kind: "bai-tap", courseId: c1.id, title: "y", documents: JSON.stringify([{ name: "a", url: "https://drive.google.com/x" }]) } })).status === 400);
  check("quiz người khác giao vào lớp của T2 → 403", (await api("POST", "/api/tutor/bai-tap/giao", { as: T2, body: { kind: "quiz", courseId: x1.id, examId: "qz-t" } })).status === 403);
  const gq = await api("POST", "/api/tutor/bai-tap/giao", { as: T, body: { kind: "quiz", courseId: c1.id, examId: "qz-t" } });
  check("quiz có sẵn → gắn vào lớp", gq.status === 200 && (await prisma.exam.findUnique({ where: { id: "qz-t" } }))?.courseId === c1.id, gq.json);
  await prisma.assignmentSubmission.create({ data: { assignmentId: bt!.id, userId: s1.id, fileUrl: "/api/media/nop-bai/x" } });

  section("P1-1 · Ai thấy sổ điểm lớp nào");
  check("ẩn danh 401", (await api("GET", "/api/tutor/so-diem")).status === 401);
  check("học sinh 403", (await api("GET", "/api/tutor/so-diem", { as: s1 })).status === 403);
  check("gia sư A KHÔNG thấy lớp của gia sư B → 403", (await api("GET", `/api/tutor/so-diem?courseId=${x1.id}`, { as: T })).status === 403);
  check("lớp không có → 404", (await api("GET", "/api/tutor/so-diem?courseId=khong-co", { as: T })).status === 404);
  const mine = await api("GET", "/api/tutor/so-diem", { as: T });
  check("gia sư: chỉ lớp mình trong danh sách lớp", mine.status === 200 && mine.json.courses.length === 1 && mine.json.courseId === c1.id, mine.json.courses);
  const head = await api("GET", `/api/tutor/so-diem?courseId=${x1.id}`, { as: SA });
  check("Chủ nhiệm: thấy MỌI lớp và mở được lớp của gia sư B", head.status === 200 && head.json.courses.length === 2 && head.json.rows.length === 1, [head.status, head.json?.courses]);
  const cols = (mine.json.columns as any[]).map(c => `${c.kind}:${c.id}`);
  check("cột = bài tập + quiz + đề Azota của lớp", cols.includes(`bai-tap:${bt!.id}`) && cols.includes("quiz:qz-t") && cols.includes("azota:az-c1") && !cols.includes("azota:az-x1"), cols);
  const r1 = (mine.json.rows as any[]).find(r => r.studentId === s1.id), r2 = (mine.json.rows as any[]).find(r => r.studentId === s2.id);
  check("s1 bài tập đã nộp ⇒ Chờ chấm (có mã bài nộp); s2 ⇒ Chưa nộp", r1.cells[bt!.id].state === "cho-cham" && !!r1.cells[bt!.id].submissionId && r2.cells[bt!.id].state === "chua-nop");

  section("Q5 · Điểm tự khai chờ duyệt");
  const YM = vnMonthKey(new Date());
  const base = JSON.stringify((await loadStudentMonth(T.id, s1.id, YM))?.subjects.map(s => s.mastery));
  check("s1 tự khai 8/10 → 200, chưa có hạng", (await api("POST", "/api/exam-results", { as: s1, body: { examId: "az-c1", score: 8 } })).json?.rank === null);
  const res = await prisma.examResult.findUniqueOrThrow({ where: { userId_examId: { userId: s1.id, examId: "az-c1" } } });
  check("báo cáo tháng: chưa duyệt ⇒ không vào", JSON.stringify((await loadStudentMonth(T.id, s1.id, YM))?.subjects.map(s => s.mastery)) === base);
  check("bảng xếp hạng của đề: chưa duyệt ⇒ không có dòng", ((await api("GET", "/api/exam-results?examId=az-c1", { as: s1 })).json ?? []).length === 0);
  const mineRes = ((await api("GET", "/api/exam-results?mine=true", { as: s1 })).json as any[]).find(r => r.examId === "az-c1");
  check("kết quả của em: pendingReview=true, rank null", mineRes?.pendingReview === true && mineRes.rank === null, mineRes);
  const book = await api("GET", `/api/tutor/so-diem?courseId=${c1.id}`, { as: T });
  const cell = (book.json.rows as any[]).find(r => r.studentId === s1.id).cells["az-c1"];
  check("sổ điểm: ô Chờ duyệt kèm 8/10 và mã dòng điểm", cell.state === "cho-duyet" && cell.score === 8 && cell.resultId === res.id, cell);
  check("gia sư lớp khác duyệt → 403", (await api("POST", "/api/tutor/so-diem/duyet", { as: T2, ...form({ resultId: res.id, action: "duyet" }) })).status === 403);
  check("học sinh tự duyệt → 403", (await api("POST", "/api/tutor/so-diem/duyet", { as: s1, ...form({ resultId: res.id, action: "duyet" }) })).status === 403);
  check("vẫn chờ duyệt sau hai lần bị từ chối quyền", (await prisma.examResult.findUnique({ where: { id: res.id } }))?.pendingReview === true);
  const ok = await api("POST", "/api/tutor/so-diem/duyet", { as: T, ...form({ resultId: res.id, action: "duyet" }) });
  check("chủ lớp Duyệt → 303 về sổ điểm ?ghi=da-duyet", ok.status === 303 && loc(ok).includes(`/lop-cua-toi/so-diem?lop=${c1.id}&ghi=da-duyet`), [ok.status, loc(ok)]);
  check("duyệt xong ⇒ vào báo cáo tháng", JSON.stringify((await loadStudentMonth(T.id, s1.id, YM))?.subjects.map(s => s.mastery)) !== base);
  check("duyệt xong ⇒ lên bảng xếp hạng của đề", ((await api("GET", "/api/exam-results?examId=az-c1", { as: s1 })).json ?? []).length === 1);
  check("duyệt lại lần hai → 303 ?ghi=khong-co (không lỗi)", loc(await api("POST", "/api/tutor/so-diem/duyet", { as: T, ...form({ resultId: res.id, action: "duyet" }) })).includes("ghi=khong-co"));

  await api("POST", "/api/exam-results", { as: s2, body: { examId: "az-c1", score: 5 } });
  const r2id = (await prisma.examResult.findUniqueOrThrow({ where: { userId_examId: { userId: s2.id, examId: "az-c1" } } })).id;
  check("Sửa điểm vượt tối đa (11) → 303 ?ghi=diem-sai, vẫn chờ duyệt", loc(await api("POST", "/api/tutor/so-diem/duyet", { as: T, ...form({ resultId: r2id, action: "sua", score: "11" }) })).includes("ghi=diem-sai") && (await prisma.examResult.findUnique({ where: { id: r2id } }))?.pendingReview === true);
  const sa = await api("POST", "/api/tutor/so-diem/duyet", { as: SA, ...form({ resultId: r2id, action: "sua", score: "6,5" }) });
  const r2row = await prisma.examResult.findUnique({ where: { id: r2id } });
  check("Chủ nhiệm Sửa điểm 6,5 → 303 ?ghi=da-sua; điểm 6,5 đã duyệt", sa.status === 303 && loc(sa).includes("ghi=da-sua") && r2row?.score === 6.5 && r2row.pendingReview === false, r2row);
  await api("POST", "/api/exam-results", { as: s2, body: { examId: "az-c1", score: 10 } });
  check("khai lại ⇒ quay về chờ duyệt", (await prisma.examResult.findUnique({ where: { id: r2id } }))?.pendingReview === true);
  const tc = await api("POST", "/api/tutor/so-diem/duyet", { as: T, ...form({ resultId: r2id, action: "tu-choi" }) });
  check("Từ chối → 303 ?ghi=da-tu-choi; dòng điểm bị xoá", tc.status === 303 && loc(tc).includes("ghi=da-tu-choi") && (await prisma.examResult.count({ where: { id: r2id } })) === 0);

  section("Nhập điểm bài nộp trong sổ");
  const subId = r1.cells[bt!.id].submissionId as string;
  check("gia sư lớp khác nhập điểm → 403", (await api("POST", "/api/tutor/so-diem/cham", { as: T2, ...form({ submissionId: subId, score: "9" }) })).status === 403);
  const ch = await api("POST", "/api/tutor/so-diem/cham", { as: T, ...form({ submissionId: subId, score: "8,5" }) });
  check("chủ lớp nhập 8,5 → 303 ?ghi=da-cham, điểm 8,5", ch.status === 303 && loc(ch).includes("ghi=da-cham") && (await prisma.assignmentSubmission.findUnique({ where: { id: subId } }))?.score === 8.5);
  check("điểm 'abc' → 303 ?ghi=diem-sai", loc(await api("POST", "/api/tutor/so-diem/cham", { as: T, ...form({ submissionId: subId, score: "abc" }) })).includes("ghi=diem-sai"));

  section("HS4 · Kết quả của học sinh");
  const k = await api("GET", "/api/student/ket-qua", { as: s1 });
  const kc1 = (k.json.classes as any[]).find(c => c.courseId === c1.id);
  check("s1 thấy lớp Toán 9 + lớp Hoá 9 (đang học cả hai)", k.status === 200 && k.json.classes.length === 2, k.json);
  check("bài tập Đã chấm 8,5; đề Azota Đã chấm 8", kc1.items.find((i: any) => i.id === bt!.id)?.state === "da-cham" && kc1.items.find((i: any) => i.id === bt!.id)?.score === 8.5 && kc1.items.find((i: any) => i.id === "az-c1")?.score === 8, kc1.items);
  check("không lộ điểm / tên / mã của học sinh khác", !k.text.includes(s2.id) && !k.text.includes("Đỗ Hà") && !k.text.includes("resultId") && !k.text.includes("submissionId"));
  await api("POST", "/api/exam-results", { as: s1, body: { examId: "az-x1", score: 7 } });
  const kx = (await api("GET", `/api/student/ket-qua?courseId=${x1.id}`, { as: s1 })).json.classes as any[];
  check("?courseId=: chỉ lớp đó; điểm tự khai ghi Chờ duyệt", kx.length === 1 && kx[0].items[0].state === "cho-duyet", kx);
  check("lớp em không học → rỗng", ((await api("GET", `/api/student/ket-qua?courseId=${x1.id}`, { as: s2 })).json.classes as any[]).length === 0);
  check("gia sư gọi API học sinh → 403", (await api("GET", "/api/student/ket-qua", { as: T })).status === 403);

  section("Trang");
  const pg = await api("GET", `/lop-cua-toi/so-diem?lop=${c1.id}`, { as: T });
  check("gia sư mở /lop-cua-toi/so-diem (không cờ) → 200, có bảng", pg.status === 200 && pg.text.includes("data-so-diem"), pg.status);
  const pa = await api("GET", `/lop-cua-toi/so-diem?lop=${x1.id}`, { as: SA });
  check("Chủ nhiệm mở sổ điểm lớp gia sư B → 200, có tên lớp", pa.status === 200 && pa.text.includes("Hoá 9") && pa.text.includes("data-so-diem"), pa.status);
  const pd = await api("GET", "/student/diem", { as: s1 });
  check("/student/diem không còn 404", pd.status === 200, pd.status);
  await done();
}
main().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
