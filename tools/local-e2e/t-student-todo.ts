// "Việc của tôi" của học sinh: GET /api/student/viec-cua-toi (và ?badge=1) — đúng người, đúng trạng thái, đúng thứ tự, không rò dữ liệu.
import { prisma } from "@/lib/prisma";
import { api, mkTutor, mkUser, mkCourse, wipe, check, section, done } from "./h";

const H = 3_600_000, D = 24 * H;
let n = 0;
const id = (p: string) => `${p}-${Date.now().toString(36)}-${++n}`;
async function mkLesson(courseId: string, o: { azotaDeadline?: string; azotaUrl?: string } = {}) {
  const sid = id("s"), cid = id("c"), lid = id("l");
  await prisma.section.create({ data: { id: sid, title: "P", courseId } });
  await prisma.chapter.create({ data: { id: cid, title: "C", sectionId: sid } });
  await prisma.lesson.create({ data: { id: lid, code: lid, title: "Bài giảng", type: "record", chapterId: cid, azotaDeadline: o.azotaDeadline ?? null, azotaUrl: o.azotaUrl ?? null } });
  return lid;
}
const mkAsg = (lessonId: string, title: string, due: Date | null, extra: Record<string, unknown> = {}) =>
  prisma.assignment.create({ data: { lessonId, title, dueDate: due, ...extra } });
const vnKey = (ms: number) => new Date(ms + 7 * H).toISOString().slice(0, 10);

(async () => {
  await wipe();
  const now = Date.now();
  const T = await mkTutor("Cô Lan");
  const S = await mkUser({ name: "Học sinh Minh" }), S2 = await mkUser({ name: "Bạn Khác Tên Riêng" }), LONE = await mkUser({ name: "Chưa vào lớp nào" });
  const A = await mkCourse(T.id, { name: "Toán 9" }), B = await mkCourse(T.id, { name: "Lớp không ghi danh" });
  for (const u of [S, S2]) await prisma.enrollment.create({ data: { userId: u.id, courseId: A.id, status: "active" } });

  const la = await mkLesson(A.id), lb = await mkLesson(B.id);
  const soon = await mkAsg(la, "Bài sắp hết", new Date(now + 3 * H));
  const twoD = await mkAsg(la, "Bài hai ngày", new Date(now + 2 * D));
  const fiveD = await mkAsg(la, "Bài năm ngày", new Date(now + 5 * D));
  const late = await mkAsg(la, "Bài quá hạn", new Date(now - D));
  await mkAsg(la, "Bài quá hạn lâu", new Date(now - 20 * D));
  await mkAsg(la, "Bài không hạn", null);
  const sent = await mkAsg(la, "Bài đã nộp", new Date(now + D));
  const graded = await mkAsg(la, "Bài đã chấm", new Date(now - 2 * D), { maxPoints: 10 });
  const inter = await mkAsg(la, "Bài làm trên web", new Date(now + 2 * D), { mode: "interactive" });
  await mkAsg(lb, "Bài lớp khác", new Date(now + D));
  const shared = await mkAsg(la, "Bài chỉ bạn kia nộp", new Date(now + 2 * D));

  await prisma.assignmentSubmission.create({ data: { assignmentId: sent.id, userId: S.id, fileUrl: "/u/x.pdf" } });
  await prisma.assignmentSubmission.create({ data: { assignmentId: graded.id, userId: S.id, fileUrl: "/u/y.pdf", score: 8.5, gradedAt: new Date(now - D), comment: "Làm tốt phần hình" } });
  await prisma.assignmentSubmission.create({ data: { assignmentId: shared.id, userId: S2.id, fileUrl: "/u/z.pdf" } });
  const q = await prisma.assignmentQuestion.create({ data: { assignmentId: inter.id, order: 1, text: "1+1=?", type: "ESSAY" } });
  await prisma.assignmentAnswer.create({ data: { questionId: q.id, userId: S.id, textAnswer: "2" } });

  // buổi học ngày mai 20:00 + hạn nộp ngoài (Azota) ngày kia
  const tmr = new Date(now + D + 7 * H);
  await prisma.classSchedule.create({ data: { courseId: A.id, dayOfWeek: tmr.getUTCDay(), startTime: "20:00", endTime: "21:30" } });
  const lz = await mkLesson(A.id, { azotaDeadline: vnKey(now + 2 * D), azotaUrl: "https://azota.vn/de/abc" });

  const get = (as?: typeof S, p = "/api/student/viec-cua-toi") => api("GET", p, { as });
  const byId = (r: any, aid: string) => r.json.items.find((i: any) => i.id === `bai-tap:${aid}`);

  section("Cần đăng nhập");
  check("không cookie → 401", (await get()).status === 401);
  check("không cookie, ?badge=1 → 401", (await get(undefined, "/api/student/viec-cua-toi?badge=1")).status === 401);

  section("Chưa ghi danh lớp nào → trống");
  let r = await get(LONE);
  check("200, items rỗng, badge 0", r.status === 200 && Array.isArray(r.json.items) && r.json.items.length === 0 && r.json.badge === 0, r.json);
  r = await get(T as any);
  check("tài khoản gia sư không có lớp học → trống, không lỗi", r.status === 200 && r.json.items.length === 0);

  section("Bài tập của học sinh S");
  r = await get(S);
  check("200", r.status === 200, r.text.slice(0, 200));
  const items: any[] = r.json.items;
  const it = (aid: string) => byId(r, aid);
  check("sắp hết hạn: 'Sắp hết hạn' + cần ra tay", it(soon.id)?.status.label === "Sắp hết hạn" && it(soon.id)?.needsAction === true, it(soon.id));
  check("còn 2 ngày: 'Cần nộp' + cần ra tay", it(twoD.id)?.status.label === "Cần nộp" && it(twoD.id)?.needsAction === true);
  check("còn 5 ngày: 'Cần nộp' nhưng chưa tính vào việc cần ra tay", it(fiveD.id)?.status.label === "Cần nộp" && it(fiveD.id)?.needsAction === false);
  check("quá hạn 1 ngày: 'Quá hạn', cần ra tay", it(late.id)?.status.label === "Quá hạn" && it(late.id)?.status.tone === "loi" && it(late.id)?.needsAction === true);
  check("quá hạn 20 ngày: ẩn", !items.some(i => i.title.startsWith("Bài quá hạn lâu")));
  check("không có hạn: ẩn", !items.some(i => i.title.startsWith("Bài không hạn")));
  check("lớp không ghi danh: ẩn", !items.some(i => i.title.startsWith("Bài lớp khác")));
  check("đã nộp: 'Đã nộp', không cần ra tay, đánh dấu xong", it(sent.id)?.status.label === "Đã nộp" && it(sent.id)?.needsAction === false && it(sent.id)?.done === true, it(sent.id));
  check("đã chấm: điểm viết dấu phẩy 8,5/10", it(graded.id)?.status.label === "Đã chấm" && it(graded.id)?.subtitle.startsWith("8,5/10"), it(graded.id));
  check("đã chấm: nhận xét của thầy/cô nằm trong khung đọc", JSON.stringify(it(graded.id)?.detail.sections).includes("Làm tốt phần hình"));
  check("bài làm trên web đã trả lời: 'Đã làm'", it(inter.id)?.status.label === "Đã làm" && it(inter.id)?.needsAction === false);
  check("bài người khác nộp, S chưa nộp → S vẫn thấy 'Cần nộp'", it(shared.id)?.status.label === "Cần nộp" && it(shared.id)?.needsAction === true);
  check("nút chính của bài chưa nộp trỏ vào bài giảng", it(soon.id)?.detail.commands[0].href === `/student/bai-giang/${la}` && it(soon.id)?.detail.commands[0].kind === "primary");

  section("Buổi học và hạn nộp ngoài");
  const cls = items.find(i => i.kind === "buoi-hoc");
  check("có buổi học ngày mai", !!cls && cls.status.label === "Sắp tới" && cls.needsAction === false && cls.when === "Ngày mai", cls);
  check("buổi học: nút 'Vào lớp' trỏ vào lớp", cls?.detail.commands[0].label === "Vào lớp" && cls?.detail.commands[0].href.includes(`course=${A.id}`));
  const dl = items.find(i => i.kind === "han-nop");
  check("hạn nộp ngoài trong 3 ngày → cần ra tay", !!dl && dl.needsAction === true, dl);
  check("hạn nộp ngoài: nút mở link Azota, đánh dấu external", dl?.detail.commands[0].href === "https://azota.vn/de/abc" && dl?.detail.commands[0].external === true);
  void lz;

  section("Thứ tự và số đếm");
  const rank = (i: any) => (i.needsAction ? 0 : i.done ? 2 : 1);
  check("cần ra tay → sắp tới → đã xong", items.every((x, k) => k === 0 || rank(items[k - 1]) <= rank(x)), items.map(i => `${rank(i)}:${i.title}`));
  const act = items.filter(i => i.needsAction);
  check("trong nhóm cần ra tay: hạn gần nhất lên trước", act.every((x, k) => k === 0 || act[k - 1].at <= x.at));
  check("badge = số việc cần ra tay", r.json.badge === act.length && act.length >= 5, { badge: r.json.badge, act: act.length });
  const rb = await get(S, "/api/student/viec-cua-toi?badge=1");
  check("?badge=1 chỉ trả { badge }", rb.status === 200 && rb.json.badge === r.json.badge && rb.json.items === undefined, rb.json);
  check("mỗi dòng có id duy nhất", new Set(items.map(i => i.id)).size === items.length);
  check("mỗi dòng có khung đọc đủ: tiêu đề, meta, ít nhất một mục", items.every(i => i.detail.heading && i.detail.meta && i.detail.sections.length >= 1));

  section("Không rò dữ liệu giữa học sinh");
  check("không lộ tên/email học sinh khác", !r.text.includes(S2.name) && !r.text.includes(S2.email) && !r.text.includes(S2.id));
  const r2 = await get(S2);
  check("S2 thấy bài của mình là 'Đã nộp'", byId(r2, shared.id)?.status.label === "Đã nộp");
  check("S2 chưa nộp 'Bài sắp hết' → vẫn là việc cần làm (không dùng chung trạng thái với S)", byId(r2, soon.id)?.needsAction === true && byId(r2, sent.id)?.needsAction === true);

  section("/api/schedule dùng chung nguồn với 'Việc của tôi'");
  const sc = await get(S, "/api/schedule");
  check("/api/schedule vẫn trả { events: [...] } như trước khi tách logic", sc.status === 200 && Array.isArray(sc.json.events), sc.json && Object.keys(sc.json));
  check("có buổi học của lớp A và hạn nộp ngoài (cùng dữ liệu đã hiện ở 'Việc của tôi')", sc.json.events.some((e: any) => e.type === "class" && e.link?.includes(A.id)) && sc.json.events.some((e: any) => e.type === "deadline" && e.link === "https://azota.vn/de/abc"));
  check("không có sự kiện trùng id", new Set(sc.json.events.map((e: any) => e.id)).size === sc.json.events.length);
  check("/api/schedule không cookie → 401", (await get(undefined, "/api/schedule")).status === 401);

  section("Rời lớp thì hết việc");
  await prisma.enrollment.updateMany({ where: { userId: S.id, courseId: A.id }, data: { status: "suspended" } });
  r = await get(S);
  check("ghi danh bị treo → trống, badge 0", r.status === 200 && r.json.items.length === 0 && r.json.badge === 0, r.json);

  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
