// "Thế giới gia sư" cho các bài rà soát (15/10/2026): đủ dữ liệu để MỌI trang của gia sư có nút / liên kết thật để bấm — lớp, lịch, học viên (có cả "chờ phụ huynh"),
// buổi báo nghỉ chờ xử lý, buổi dời/huỷ, buổi điểm danh, phiếu học phí (nháp + đã gửi + đã gạch), khoản chuyển khoản chờ đối soát, báo cáo cộng đồng,
// bài tập chưa chấm, kế hoạch buổi, mã mời lớp, đề thi + ngân hàng câu hỏi, bài giảng. Dựng bằng chính các API thật khi có thể (đồng thời kiểm API),
// còn lại ghi thẳng cơ sở dữ liệu thử. Chỉ dùng trên DB thử cục bộ.
import { api, mkUser, mkTutor, mkCourse } from "./h";
import { prisma } from "@/lib/prisma";

const vnDateKey = (offsetDays: number) => new Date(Date.now() + 7 * 3600_000 + offsetDays * 86400_000).toISOString().slice(0, 10);
let seq = 9000;

// BU-00 (31/10/2026): cấu hình MẶC ĐỊNH (chưa chọn module nào) nay là ĐỦ module. `compact: true` = ghi TƯỜNG MINH `{ modules: [] }` → "chế độ gọn":
// thanh chỉ có Lịch + Học phí, các mục còn lại nằm trong «Khác» — là cái gia sư đã tự tắt hết module thấy. Mặc định của bài rà: bật đủ 4 module tuỳ chọn
// (ghi rõ danh sách để không phụ thuộc vào mặc định của mã).
const ALL_MODULES = { modules: ["hop-viec", "lop", "bai-kt", "thu-vien"] };
const COMPACT_MODULES = { modules: [] as string[] };

// Dấu hiệu dữ liệu của gia sư THỨ HAI: bài rà dùng để chắc chắn chúng không lọt vào trang của gia sư chính.
export const OTHER = { tutor: "Thầy Khác (không liên quan)", course: "Lớp của gia sư khác", plan: "Kế hoạch của gia sư khác", exam: "Đề của gia sư khác", applicant: "Ứng Viên Gia Sư Chờ Duyệt" };

// `empty: true` = gia sư MỚI TINH (chưa có lớp, chưa có học viên, chưa có tài khoản nhận tiền): trang trống hiện các nút hướng dẫn ("Tạo lớp", "Thiết lập…")
// mà người dùng thấy đầu tiên — phải dẫn đúng chỗ như các trang đầy dữ liệu. Gia sư thứ hai luôn có dữ liệu để kiểm cô lập.
export async function seedTutorWorld(opts: { empty?: boolean; compact?: boolean } = {}) {
  const T = await mkTutor(opts.empty ? "Cô Mới (chưa có lớp)" : "Cô Lan (rà liên kết)");
  const T2 = await mkTutor(OTHER.tutor); // gia sư thứ hai: dữ liệu của người khác không được lẫn vào
  const s1 = await mkUser({ name: "Trần Gia Bảo" }), s2 = await mkUser({ name: "Đỗ Hà" }), s3 = await mkUser({ name: "Lê Minh" });
  const waiting = await mkUser({ name: "Chờ Phụ Huynh" }), rep = await mkUser({ name: "Người Báo Cáo" });
  // bật đủ 4 module tuỳ chọn (Hộp việc, Lớp, Bài KT, Thư viện) hoặc, khi `compact`, ghi tường minh `modules: []`; Lịch + Học phí luôn có
  await prisma.user.update({
    where: { id: T.id },
    data: { preferences: opts.compact ? COMPACT_MODULES : ALL_MODULES, bio: "Gia sư Toán 9 – 12 với 8 năm kinh nghiệm luyện thi vào 10 và THPT.", subjects: ["Toán"] },
  });

  // một đơn xin làm gia sư đang chờ duyệt: chỉ quản trị trung tâm được thấy, gia sư thường mở "Chờ kiểm duyệt" không được thấy tên người này
  const applicant = await mkUser({ name: OTHER.applicant });
  await prisma.user.update({ where: { id: applicant.id }, data: { tutorAppliedAt: new Date(), bio: "Xin làm gia sư Toán.", subjects: ["Toán"] } });
  // dữ liệu của gia sư thứ hai (cả hai chế độ): một lớp, một kế hoạch buổi, một đề thi
  const c3 = await mkCourse(T2.id, { name: OTHER.course });
  const tomorrow2 = vnDateKey(1);
  const plan2 = await api("POST", "/api/tutor/session-plans", { as: T2, body: { courseId: c3.id, title: OTHER.plan, dateKey: tomorrow2 } });
  const stamp2 = Date.now();
  const exam2 = await prisma.exam.create({ data: { id: `exam-o-${stamp2}`, code: `DE-O-${stamp2.toString(36).toUpperCase().slice(-5)}`, title: OTHER.exam, category: "toan", date: vnDateKey(6), time: "19:00", duration: "15", questions: 0, status: "upcoming", createdAt: new Date().toISOString(), ownerId: T2.id, courseId: c3.id } });
  if (opts.empty) {
    await prisma.user.update({ where: { id: T.id }, data: { preferences: opts.compact ? COMPACT_MODULES : ALL_MODULES } });
    const stud = await mkUser({ name: "Học viên bất kỳ" });
    return { empty: true as const, T, T2, s1: stud, c3, plan2Id: plan2.json?.id as string | undefined, exam2Id: exam2.id };
  }

  const c1 = await mkCourse(T.id, { name: "Toán 9 (rà liên kết)", capacity: 2 });
  const c2 = await mkCourse(T.id, { name: "Lý 9 (rà liên kết)", classStatus: "closed" });
  for (const [u, c] of [[s1, c1], [s2, c1], [s1, c2], [s3, c2]] as const) await prisma.enrollment.create({ data: { userId: u.id, courseId: c.id, status: "active" } });
  await prisma.enrollment.create({ data: { userId: waiting.id, courseId: c1.id, status: "pending_consent" } });

  // Lịch tuần: một buổi MAI, một buổi sau mai — để Lịch / Hộp việc có buổi sắp tới
  const dow = (offset: number) => new Date(Date.now() + 7 * 3600_000 + offset * 86400_000).getUTCDay();
  const sch1 = await prisma.classSchedule.create({ data: { courseId: c1.id, dayOfWeek: dow(1), startTime: "19:00", endTime: "20:30", note: "Học qua Meet", joinUrl: "https://meet.example.com/toan9" } });
  const sch2 = await prisma.classSchedule.create({ data: { courseId: c1.id, dayOfWeek: dow(3), startTime: "18:00", endTime: "19:30" } });
  const tomorrow = vnDateKey(1);
  // báo nghỉ sát giờ đang chờ gia sư xử lý (hiện ở Hộp việc)
  await prisma.classAbsence.create({ data: { courseId: c1.id, scheduleId: sch1.id, dateKey: tomorrow, startAt: new Date(`${tomorrow}T19:00:00+07:00`), studentId: s2.id, reportedBy: "parent", leadMinutes: 60, reason: "Con ốm", status: "pending" } });
  // một buổi bị huỷ (Lịch hiện "đã huỷ") và một buổi điểm danh hôm qua
  await prisma.classSessionChange.create({ data: { courseId: c1.id, scheduleId: sch2.id, dateKey: vnDateKey(3), kind: "cancel", reason: "Gia sư bận", changedBy: T.id } });
  const att = await prisma.attendanceSession.create({ data: { courseId: c1.id, date: new Date(`${vnDateKey(-1)}T00:00:00Z`), createdBy: T.id } });
  await prisma.attendanceRecord.create({ data: { sessionId: att.id, userId: s1.id, status: "present", updatedBy: T.id } });
  await prisma.attendanceRecord.create({ data: { sessionId: att.id, userId: s2.id, status: "absent", updatedBy: T.id } });

  // Học phí: tài khoản nhận + khoá webhook + phiếu nháp / đã gửi / đã gạch + khoản chuyển khoản chờ đối soát
  const YM = vnDateKey(0).slice(0, 7);
  await prisma.monthlyCourseFee.create({ data: { courseId: c1.id, yearMonth: YM, sessionCount: 8, updatedBy: T.id } });
  await api("PUT", "/api/tutor/payout-account", { as: T, body: { bankBin: "970436", accountNo: "0123456789", accountName: "Lan" } });
  const key = (await api("POST", "/api/tutor/payout-account/webhook-key", { as: T })).json?.key;
  const iss = await api("POST", "/api/tutor/invoices", { as: T, body: { yearMonth: YM, studentIds: [s1.id, s2.id] } });
  const invA = iss.json?.created?.find((c: { studentId: string }) => c.studentId === s1.id);
  if (invA && key) {
    await api("PATCH", `/api/tutor/invoices/${invA.id}`, { as: T, body: { action: "send" } });
    await api("POST", `/api/webhooks/sepay/${T.id}`, { headers: { authorization: `Apikey ${key}` }, body: { id: ++seq, transferType: "in", transferAmount: invA.amountDue, content: invA.code, code: invA.code } });
    await api("POST", `/api/webhooks/sepay/${T.id}`, { headers: { authorization: `Apikey ${key}` }, body: { id: ++seq, transferType: "in", transferAmount: 12345, content: "khong ma" } });
  }

  // Cộng đồng trong lớp: hai bài bị báo cáo → "Kiểm duyệt cộng đồng"
  const th = await prisma.thread.create({ data: { content: "Nội dung cần kiểm duyệt trong lớp Toán 9. ".repeat(3), authorId: s2.id, courseId: c1.id } });
  const th2 = await prisma.thread.create({ data: { content: "Bài bị báo cáo oan", authorId: s3.id, courseId: c1.id } });
  await prisma.threadReport.create({ data: { threadId: th.id, reporterId: rep.id, reason: "Spam quảng cáo" } });
  await prisma.threadReport.create({ data: { threadId: th2.id, reporterId: rep.id, reason: "Không phù hợp" } });

  // Bài giảng + bài tập chưa chấm (Hộp việc → trang chấm)
  const stamp = Date.now();
  const sec = await prisma.section.create({ data: { id: `sec-w-${stamp}`, title: "Chương 1", courseId: c1.id } });
  const chap = await prisma.chapter.create({ data: { id: `chap-w-${stamp}`, title: "Bài 1", sectionId: sec.id } });
  const les = await prisma.lesson.create({ data: { id: `les-w-${stamp}`, code: "L1", title: "Bài học 1", type: "record", chapterId: chap.id, isLocked: false } });
  const asg = await prisma.assignment.create({ data: { lessonId: les.id, title: "BTVN 1", ownerId: T.id, mode: "file" } });
  await prisma.assignmentSubmission.create({ data: { assignmentId: asg.id, userId: s1.id, fileUrl: "x" } });

  // Kế hoạch buổi (API thật) + mã mời lớp + báo cáo tháng nháp
  const plan = await api("POST", "/api/tutor/session-plans", { as: T, body: { courseId: c1.id, title: "Buổi ôn hàm số", dateKey: tomorrow } });
  await prisma.classInvite.create({ data: { courseId: c1.id, code: `LINK${stamp.toString(36).toUpperCase().slice(-6)}`, maxUses: 5, createdBy: T.id } });

  // Đề thi + ngân hàng câu hỏi (trang /admin/thi-thu của gia sư)
  const exam = await prisma.exam.create({ data: { id: `exam-w-${stamp}`, code: `DE-W-${stamp.toString(36).toUpperCase().slice(-5)}`, title: "Đề kiểm tra 15 phút", category: "toan", date: vnDateKey(5), time: "19:00", duration: "15", questions: 0, status: "upcoming", createdAt: new Date().toISOString(), ownerId: T.id, courseId: c1.id } });
  const cat = await prisma.questionCategory.create({ data: { name: "Hàm số", sortOrder: 1 } });
  const qb = await prisma.questionBankItem.create({ data: { type: "MC", text: "Hàm số y = 2x + 1 đồng biến hay nghịch biến?", categoryId: cat.id, difficulty: "NB", status: "approved", ownerId: T.id, options: { create: [{ order: 1, text: "Đồng biến", isCorrect: true }, { order: 2, text: "Nghịch biến", isCorrect: false }] } } });

  return { empty: false as const, T, T2, s1, s2, s3, c1, c2, c3, sch1, sch2, invA, planId: plan.json?.id as string | undefined, plan2Id: plan2.json?.id as string | undefined, examId: exam.id, exam2Id: exam2.id, qbId: qb.id, lessonId: les.id, threadId: th.id };
}
