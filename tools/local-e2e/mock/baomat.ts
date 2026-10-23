// Dữ liệu GIẢ cho MD-03 / MD-09 / MD-16 / QZ-14 (bảo mật học liệu và mật khẩu thi). Chạy lặp lại được (tìm-trước-tạo-sau).
// Một lớp của gia sư chính có 1 bài trả phí (2 link Azota, hạn 20:00 hai ngày nữa, 1 tài liệu) + 1 bài miễn phí; học sinh chính ĐÃ ghi danh,
// một học sinh khác CHƯA; một đề có mật khẩu BĂM ("matkhau-thi") và một đề cũ còn mật khẩu thô ("cu-123").
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { addDaysKey, vnDateKeyOf } from "@/lib/classSessions";
import { mkCourse, mkUser } from "../h";
import type { MockCtx } from "../mock-seed";

const TITLE = "Lớp thử bảo mật học liệu (thử MD-03)";
const pre = (pw: string) => createHash("sha256").update(pw, "utf8").digest("base64");

export default async function mock(ctx: MockCtx): Promise<string[]> {
  const { prisma, tutor, student } = ctx;
  let c = await prisma.course.findFirst({ where: { ownerId: tutor.id, name: TITLE } });
  if (!c) c = await mkCourse(tutor.id, { name: TITLE });
  const tag = c.id.slice(-8);
  const sec = await prisma.section.upsert({ where: { id: `s-bm-${tag}` }, update: {}, create: { id: `s-bm-${tag}`, title: "Phần 1", courseId: c.id, order: 0 } });
  const ch = await prisma.chapter.upsert({ where: { id: `ch-bm-${tag}` }, update: {}, create: { id: `ch-bm-${tag}`, title: "Chương 1", sectionId: sec.id, order: 0 } });
  const due = `${addDaysKey(vnDateKeyOf(new Date()), 2)}T20:00`;
  const common = { type: "record", chapterId: ch.id, videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" };
  await prisma.lesson.upsert({ where: { id: `l-bm-paid-${tag}` }, update: { azotaDeadline: due }, create: {
    ...common, id: `l-bm-paid-${tag}`, code: "BM1", title: "Bài trả phí (2 link Azota)", order: 0, isFree: false, isLocked: true,
    azotaUrl: JSON.stringify(["https://azota.vn/mock-bai-1", "https://azota.vn/mock-bai-2"]), azotaDeadline: due,
    documents: JSON.stringify([{ name: "Tài liệu mẫu", url: "/api/files/mau.pdf" }]),
  } });
  await prisma.lesson.upsert({ where: { id: `l-bm-free-${tag}` }, update: {}, create: {
    ...common, id: `l-bm-free-${tag}`, code: "BM2", title: "Bài học thử miễn phí", order: 1, isFree: true, isLocked: false, documents: "[]",
  } });
  await prisma.enrollment.upsert({ where: { userId_courseId: { userId: student.id, courseId: c.id } }, update: { status: "active" }, create: { userId: student.id, courseId: c.id, status: "active" } });

  let outsider = await prisma.user.findUnique({ where: { email: "hocsinh-chua-ghi-danh@kin.local" } });
  if (!outsider) { const u = await mkUser({ name: "Học sinh chưa ghi danh" }); outsider = await prisma.user.update({ where: { id: u.id }, data: { email: "hocsinh-chua-ghi-danh@kin.local" } }); }

  const exam = async (id: string, title: string, secret: { password: string | null; passwordHash: string | null }) => {
    const data = { title, category: "toan", date: "2026-12-01", time: "08:00", duration: "45 phút", questions: 1, status: "available", createdAt: new Date().toISOString(), ownerId: tutor.id, ...secret };
    await prisma.exam.upsert({ where: { id }, update: secret, create: { id, code: id.toUpperCase().slice(0, 24), ...data } });
    const q = `q-${id}`;
    if (!(await prisma.examQuestion.findUnique({ where: { id: q } }))) {
      await prisma.examQuestion.create({ data: { id: q, examId: id, text: "1 + 1 = ?", type: "MC" } });
      await prisma.examOption.createMany({ data: [{ id: `${q}-a`, questionId: q, text: "2", isCorrect: true, order: 0 }, { id: `${q}-b`, questionId: q, text: "3", isCorrect: false, order: 1 }] });
    }
  };
  await exam(`bm-de-bam-${tag}`, "Đề thử: mật khẩu đã băm", { password: null, passwordHash: await bcrypt.hash(pre("matkhau-thi"), 10) });
  await exam(`bm-de-cu-${tag}`, "Đề thử: mật khẩu thô cũ", { password: "cu-123", passwordHash: null });

  return [
    `Đăng nhập hocsinh@kin.local (ĐÃ ghi danh), mở /student/bai-giang/l-bm-paid-${tag}: tab Bài tập có HAI nút "Làm bài 1 →" / "Làm bài 2 →" trỏ đúng 2 link Azota, hạn hiện "20:00 dd/mm/yyyy"; /student/lich-hoc có hạn đúng 20:00.`,
    `Đăng nhập hocsinh-chua-ghi-danh@kin.local (CHƯA ghi danh): GET /api/courses/${c.id} thấy tên bài nhưng videoUrl/azotaUrl/documents của bài trả phí rỗng; bài miễn phí vẫn có link.`,
    `Mở /xem-tai-lieu?url=javascript:alert(1) và ?url=https://evil.example/a.docx → "Không mở được tài liệu" (tiếng Việt); ?url=/api/files/mau.pdf → khung xem PDF.`,
    `Đề "mật khẩu đã băm": vào thi bằng mật khẩu matkhau-thi. Đề "mật khẩu thô cũ": vào bằng cu-123 — sau lần đầu đúng, cột password tự chuyển thành băm. GET /api/exams/<id> không bao giờ trả mật khẩu/băm.`,
  ];
}
