// TUT-003 (API + DB thật) — Hộp việc của gia sư: "câu hỏi của học sinh trong lớp chưa trả lời" + gia sư được báo khi có câu hỏi mới trong lớp.
// Định nghĩa ở src/lib/tutorQuestions.ts (một nguồn cho số đỏ và dòng chi tiết). Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-tut-003.ts
//
// CA PHÁ CỐ ý (mỗi lần một thứ rồi hoàn lại):
//   - Bỏ `replies: { none: ... }` khỏi unansweredQuestionWhere → ca "gia sư đã trả lời thì hết tính" đỏ.
//   - Bỏ `acceptedReplyId: null` → ca "đã có câu trả lời được chọn đúng" đỏ.
//   - Đổi `course: { ownerId: tutorId }` thành không lọc → ca "gia sư khác không thấy / không đếm" đỏ.
//   - Bỏ `deletedAt: null` hoặc `status: "published"` → ca "câu hỏi bị xoá / chờ duyệt không tính" đỏ.
import { prisma } from "@/lib/prisma";
import { api, mkUser, mkTutor, mkCourse, wipe, check, section, done } from "./h";
import { loadTutorTodoCounts, loadTutorTodoTotal } from "@/lib/tutorDashboard";
import { loadTutorInboxRaw } from "@/lib/tutorInboxServer";
import { buildInboxItems, inboxTotal } from "@/lib/tutorInbox";

const mkQ = (courseId: string | null, authorId: string, o: Record<string, unknown> = {}) =>
  prisma.thread.create({ data: { content: "Nội dung câu hỏi đủ dài để hiển thị.", authorId, courseId, kind: "question", title: "Cách giải phương trình bậc hai?", category: "hoi-dap", status: "published", ...o } });
const reply = (threadId: string, authorId: string, o: Record<string, unknown> = {}) => prisma.threadReply.create({ data: { content: "Trả lời.", authorId, threadId, ...o } });
const enroll = (userId: string, courseId: string) => prisma.enrollment.create({ data: { userId, courseId, status: "active" } });

async function main() {
  await wipe();
  const T = await mkTutor("Cô Lan"), T2 = await mkTutor("Thầy Khác");
  const C = await mkCourse(T.id, { name: "Toán 9" }), C2 = await mkCourse(T2.id, { name: "Lý 10" });
  const S1 = await mkUser({ name: "Em Một" }), S2 = await mkUser({ name: "Em Hai" });
  await enroll(S1.id, C.id); await enroll(S2.id, C.id); await enroll(S1.id, C2.id);

  section("Không có câu hỏi → không có việc");
  let c = await loadTutorTodoCounts(T.id);
  check("bộ đếm unansweredQuestions = 0 khi chưa có câu hỏi", c.unansweredQuestions === 0, c);
  check("Hộp việc không có dòng 'questions'", !buildInboxItems(await loadTutorInboxRaw(T.id), new Date()).some(i => i.id === "questions"));

  section("Câu hỏi chưa trả lời được tính");
  const q1 = await mkQ(C.id, S1.id, { title: "Câu 1 chưa ai trả lời" });
  const q2 = await mkQ(C.id, S2.id, { title: "Câu 2 chưa ai trả lời" });
  c = await loadTutorTodoCounts(T.id);
  check("2 câu hỏi của 2 em trong lớp của cô → 2", c.unansweredQuestions === 2, c);
  let raw = await loadTutorInboxRaw(T.id);
  let item = buildInboxItems(raw, new Date()).find(i => i.id === "questions");
  check("Hộp việc có dòng 'questions' với tiêu đề '2 câu hỏi của học sinh chưa trả lời'", item?.title === "2 câu hỏi của học sinh chưa trả lời", item?.title);
  check("dòng chi tiết dẫn tới /cong-dong/<id>, có tên lớp, KHÔNG có tên em", item?.detail.rows.length === 2 && item.detail.rows.every(r => /^\/cong-dong\//.test(r.href ?? "") && /Toán 9/.test(r.sub)) && !/Em Một|Em Hai/.test(JSON.stringify(item?.detail)), item?.detail.rows);
  check("câu hỏi cũ nhất đứng trước", item?.detail.rows[0].href === `/cong-dong/${q1.id}`);
  check("số đỏ trên thanh module khớp tổng Hộp việc", (await loadTutorTodoTotal(T.id)) === inboxTotal(raw), { total: await loadTutorTodoTotal(T.id), inbox: inboxTotal(raw) });

  section("Điều kiện loại trừ");
  await reply(q1.id, S2.id);
  c = await loadTutorTodoCounts(T.id);
  check("bạn học trả lời (chưa chọn đúng) → câu hỏi vẫn chờ gia sư (vẫn 2)", c.unansweredQuestions === 2, c);
  const tr = await reply(q1.id, T.id);
  c = await loadTutorTodoCounts(T.id);
  check("gia sư đã trả lời → hết tính (còn 1)", c.unansweredQuestions === 1, c);
  await prisma.threadReply.update({ where: { id: tr.id }, data: { deletedAt: new Date() } });
  c = await loadTutorTodoCounts(T.id);
  check("câu trả lời của gia sư bị xoá mềm → tính lại (2)", c.unansweredQuestions === 2, c);
  const peer = await reply(q2.id, S1.id);
  await prisma.thread.update({ where: { id: q2.id }, data: { acceptedReplyId: peer.id } });
  c = await loadTutorTodoCounts(T.id);
  check("đã có câu trả lời được chọn đúng → hết tính (còn 1)", c.unansweredQuestions === 1, c);
  await prisma.thread.update({ where: { id: q2.id }, data: { acceptedReplyId: null } });
  const del = await mkQ(C.id, S1.id, { deletedAt: new Date() });
  const pend = await mkQ(C.id, S1.id, { status: "pending" });
  const rej = await mkQ(C.id, S1.id, { status: "rejected" });
  c = await loadTutorTodoCounts(T.id);
  check("câu hỏi bị xoá mềm / chờ duyệt / bị từ chối không tính (vẫn 2)", c.unansweredQuestions === 2, c);
  void del; void pend; void rej;
  const mine = await mkQ(C.id, T.id, { title: "Gia sư tự hỏi" });
  c = await loadTutorTodoCounts(T.id);
  check("câu hỏi do chính gia sư đăng không tính", c.unansweredQuestions === 2 && !!mine, c);
  const post = await prisma.thread.create({ data: { content: "Bài thường của học sinh trong lớp", authorId: S1.id, courseId: C.id, kind: "post", category: "hoi-dap" } });
  c = await loadTutorTodoCounts(T.id);
  check("bài thường (kind=post) không tính, chỉ kind=question", c.unansweredQuestions === 2 && !!post, c);
  const gen = await mkQ(null, S1.id, { title: "Câu hỏi cộng đồng chung" });
  c = await loadTutorTodoCounts(T.id);
  check("câu hỏi ở cộng đồng chung (không thuộc lớp) không tính", c.unansweredQuestions === 2 && !!gen, c);

  section("Cô lập giữa gia sư");
  const c2 = await loadTutorTodoCounts(T2.id);
  check("gia sư khác không đếm câu hỏi của lớp cô Lan", c2.unansweredQuestions === 0, c2);
  const other = await mkQ(C2.id, S1.id, { title: "Câu hỏi lớp Lý" });
  check("câu hỏi lớp Lý chỉ tính cho thầy Khác", (await loadTutorTodoCounts(T2.id)).unansweredQuestions === 1 && (await loadTutorTodoCounts(T.id)).unansweredQuestions === 2 && !!other);
  const raw2 = await loadTutorInboxRaw(T2.id);
  check("dòng chi tiết của thầy Khác chỉ có lớp Lý", raw2.questions.rows.length === 1 && /Lý 10/.test(raw2.questions.rows[0].sub) && !/Toán 9/.test(JSON.stringify(raw2.questions.rows)));

  section("Giới hạn dòng chi tiết");
  for (let i = 0; i < 12; i++) await mkQ(C.id, S1.id, { title: `Hàng loạt ${i}` });
  raw = await loadTutorInboxRaw(T.id);
  item = buildInboxItems(raw, new Date()).find(i => i.id === "questions");
  check("đếm đủ (14) nhưng chi tiết chỉ 10 dòng, 'còn 4'", raw.questions.count === 14 && item?.detail.rows.length === 10 && item?.detail.more === 4, { count: raw.questions.count, rows: item?.detail.rows.length, more: item?.detail.more });
  const long = await mkQ(C.id, S1.id, { title: "x".repeat(120) });
  raw = await loadTutorInboxRaw(T.id);
  check("tiêu đề dài bị rút gọn (≤ 80 ký tự) trong dòng chi tiết", raw.questions.rows.every(r => r.title.length <= 80) && !!long);

  section("API Hộp việc");
  const r = await api("GET", "/api/tutor/hop-viec", { as: T });
  const qi = r.json?.items?.find((i: any) => i.id === "questions");
  check("GET /api/tutor/hop-viec trả dòng questions với số đúng", r.status === 200 && !!qi && /^15 câu hỏi/.test(qi.title), r.json?.items?.map((i: any) => i.title));
  const rs = await api("GET", "/api/tutor/hop-viec", { as: S1 });
  check("học sinh không xem được Hộp việc của gia sư (403/401)", rs.status === 403 || rs.status === 401, rs.status);

  section("Thông báo cho gia sư khi có câu hỏi mới trong lớp");
  // Học sinh MỚI cho phần đăng qua API (giới hạn 1 giờ đếm theo số bài của người đăng; S1 đã có nhiều bài dựng sẵn bằng prisma).
  const S3 = await mkUser({ name: "Em Ba" }), S4 = await mkUser({ name: "Em Bốn" });
  await enroll(S3.id, C.id);
  const before = await prisma.notification.count({ where: { userId: T.id, type: "thread_new_class" } });
  const post1 = await api("POST", "/api/community/threads", { as: S3, body: { kind: "question", title: "Em hỏi về hàm số bậc nhất", content: "Làm sao tìm đồ thị đi qua hai điểm cho trước ạ?", courseId: C.id } });
  check("học sinh trong lớp đăng câu hỏi → 201", post1.status === 201, post1);
  const after = await prisma.notification.findMany({ where: { userId: T.id, type: "thread_new_class" }, orderBy: { createdAt: "desc" } });
  check("gia sư nhận đúng 1 thông báo mới, trỏ tới câu hỏi", after.length === before + 1 && after[0].link === `/cong-dong/${post1.json?.id}`, after[0]);
  check("thông báo không chứa tên em, tiêu đề hay nội dung câu hỏi", !/Em Ba|hàm số|đồ thị/.test(`${after[0].title} ${after[0].message}`), after[0]);
  check("người đăng không tự nhận thông báo", (await prisma.notification.count({ where: { userId: S3.id, type: "thread_new_class" } })) === 0);
  const raw3 = await loadTutorInboxRaw(T.id);
  check("câu hỏi mới đã vào Hộp việc (16)", raw3.questions.count === 16, raw3.questions.count);
  const post2 = await api("POST", "/api/community/threads", { as: S4, body: { kind: "question", title: "Em hỏi lớp khác nhé", content: "Em không học lớp này nhưng muốn hỏi thử ạ?", courseId: C2.id } });
  check("học sinh KHÔNG thuộc lớp không đăng được vào lớp đó (403) và không tạo thông báo cho thầy Khác", post2.status === 403 && (await prisma.notification.count({ where: { userId: T2.id, type: "thread_new_class" } })) === 0, post2);
  done();
}
main().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
