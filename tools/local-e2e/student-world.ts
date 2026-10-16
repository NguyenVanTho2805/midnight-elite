// "Thế giới học sinh + khách" cho bài rà `ui-role-everything` (16/10/2026): đủ dữ liệu để MỌI trang của học sinh và của khách có nút / liên kết thật để bấm —
// lớp (đang học / chờ phụ huynh / chưa vào), bài giảng đủ 4 loại, bài tập (đã chấm / chưa nộp / quá hạn / trắc nghiệm), đề thi công khai + đề của lớp + đề của lớp khác,
// kết quả thi, lịch học + báo nghỉ, phiếu học phí, ví + giao dịch, thông báo (mỗi cái trỏ một trang), cộng đồng (chung / trong lớp / lớp khác), hỏi đáp, tin tức,
// điểm chuẩn, mã mời, liên kết phụ huynh (+ cổng "Sổ của con" + phiếu học phí qua link riêng). Chỉ dùng trên DB thử cục bộ.
//   - `empty: true` = học sinh MỚI TINH (chưa vào lớp nào, ví 0, chưa có thông báo): trang trống + nút hướng dẫn ("Nhập mã mời", "Tìm lớp"…) phải dẫn đúng chỗ.
//   - Dữ liệu của người KHÔNG liên quan (học sinh lớp khác, lớp / đề / bài viết riêng của gia sư khác) luôn có, để kiểm cô lập.
import { mkUser, mkTutor, mkSuper, mkCourse } from "./h";
import { prisma } from "@/lib/prisma";
import { generateInvoiceCode } from "@/lib/tuitionInvoice";

export const OTHER_S = {
  student: "Bạn Lớp Khác (không liên quan)",
  course: "Lý 9 của gia sư khác (HS)",
  classThread: "Bài riêng trong lớp của gia sư khác",
  exam: "Đề riêng của lớp gia sư khác",
  lesson: "Bài giảng riêng của lớp khác",
  doc: "TL-RIENG-LOP-KHAC",       // tên tệp tài liệu của bài RIÊNG (không miễn phí) — không được lọt vào trang của học sinh không học lớp đó
  video: "other-private",        // mã video YouTube của bài riêng đó
};
const tok = (b: number) => b.toString(16).padStart(2, "0").repeat(16);
export const TOKENS = { invoice: tok(0xc3), invoiceExpired: tok(0xd4), portal: tok(0xa1), consent: tok(0xb2) };
const vnDateKey = (offsetDays: number) => new Date(Date.now() + 7 * 3600_000 + offsetDays * 86400_000).toISOString().slice(0, 10);
const dow = (offset: number) => new Date(Date.now() + 7 * 3600_000 + offset * 86400_000).getUTCDay();
const docs = (n: string) => JSON.stringify([{ name: `${n}.pdf`, url: `https://files.example/${n}.pdf`, type: "pdf" }, { name: `${n} (Google Docs)`, url: "https://docs.google.com/document/d/abc/edit", type: "doc" }]);

export async function seedStudentWorld(opts: { empty?: boolean } = {}) {
  const stamp = Date.now();
  const SA = await mkSuper("Quản trị (HS)");
  const T = await mkTutor("Cô Lan (HS)");
  const T2 = await mkTutor("Thầy Khác (HS)");
  await prisma.user.update({ where: { id: T.id }, data: { bio: "Gia sư Toán 9 – 12 với 8 năm kinh nghiệm luyện thi vào 10 và THPT.", subjects: ["Toán"] } });
  await prisma.user.update({ where: { id: T2.id }, data: { bio: "Gia sư Lý 9.", subjects: ["Vật lý"] } });
  const S = await mkUser({ name: opts.empty ? "Học Sinh Mới Tinh" : "Minh Anh (rà học sinh)" });
  const S2 = await mkUser({ name: "Bạn Cùng Lớp" });                 // học cùng lớp với S: được phép thấy ở cộng đồng lớp / bảng xếp hạng
  const S3 = await mkUser({ name: OTHER_S.student });               // học lớp của gia sư khác: KHÔNG được lọt vào trang riêng của S
  const P = await mkUser({ name: "Chị Hoa (phụ huynh)" });

  // Lớp: C1 (S, S2 đang học) · C2 (gia sư khác; S3 học) · C3 (S chờ phụ huynh) · C4 (chưa vào, có mã mời)
  const C1 = await mkCourse(T.id, { name: "Toán 9 (rà học sinh)" });
  const C2 = await mkCourse(T2.id, { name: OTHER_S.course });
  const C3 = await mkCourse(T.id, { name: "Hoá 9 (chờ phụ huynh)" });
  const C4 = await mkCourse(T.id, { name: "Toán 10 (có mã mời)" });
  await prisma.enrollment.create({ data: { userId: S2.id, courseId: C1.id, status: "active" } });
  await prisma.enrollment.create({ data: { userId: S3.id, courseId: C2.id, status: "active" } });
  const enr1 = opts.empty ? null : await prisma.enrollment.create({ data: { userId: S.id, courseId: C1.id, status: "active" } });
  const enr3 = opts.empty ? null : await prisma.enrollment.create({ data: { userId: S.id, courseId: C3.id, status: "pending_consent" } });
  const invite = await prisma.classInvite.create({ data: { courseId: C4.id, code: `HS${stamp.toString(36).toUpperCase().slice(-6)}`, maxUses: 10, createdBy: T.id } });

  // Bài giảng C1: đủ 4 loại (video có tài liệu · trả phí · trực tiếp · tài liệu) + một bài của lớp khác
  const sec = await prisma.section.create({ data: { id: `sec-s-${stamp}`, title: "Chương 1", order: 1, courseId: C1.id } });
  const chap = await prisma.chapter.create({ data: { id: `chap-s-${stamp}`, title: "Bài 1", order: 1, sectionId: sec.id } });
  const mkLesson = (suffix: string, title: string, order: number, o: Record<string, unknown>, chapterId = chap.id) =>
    prisma.lesson.create({ data: { id: `les-${suffix}-${stamp}`, code: `L${order}`, title, type: "record", order, chapterId, isLocked: false, isFree: true, ...o } as never });
  const lRec = await mkLesson("rec", "Bài 1 Hệ thức Vi-ét (video)", 1, { videoUrl: "https://youtu.be/dQw4w9WgXcQ", duration: "45 phút", documents: docs("TL-VIET") });
  const lPaid = await mkLesson("paid", "Bài 2 Phương trình bậc hai", 2, { isFree: false, videoUrl: "https://youtu.be/dQw4w9WgXcQ", duration: "30 phút" });
  const lLive = await mkLesson("live", "Bài 3 Buổi học trực tiếp", 3, { type: "live", zoomUrl: "https://zoom.example.com/j/123", duration: "90 phút" });
  const lDoc = await mkLesson("doc", "Bài 4 Tài liệu ôn tập", 4, { type: "document", documents: docs("TL-ON-TAP") });
  const secO = await prisma.section.create({ data: { id: `sec-o-${stamp}`, title: "Chương riêng", order: 1, courseId: C2.id } });
  const chapO = await prisma.chapter.create({ data: { id: `chap-o-${stamp}`, title: "Bài riêng", order: 1, sectionId: secO.id } });
  // Bài RIÊNG của lớp khác: KHÔNG miễn phí (bài miễn phí là công khai, ai cũng mở được nên không dùng để thử cô lập).
  const lOther = await mkLesson("other", OTHER_S.lesson, 1, { isFree: false, videoUrl: `https://youtu.be/${OTHER_S.video}`, documents: docs(OTHER_S.doc) }, chapO.id);
  if (!opts.empty) {
    await prisma.lessonProgress.create({ data: { userId: S.id, lessonId: lRec.id, watchedSeconds: 1800 } });
    await prisma.lessonProgress.create({ data: { userId: S.id, lessonId: lPaid.id, watchedSeconds: 300 } });
  }

  // Bài tập: đã chấm · chưa nộp còn hạn (trắc nghiệm) · quá hạn
  const aGraded = await prisma.assignment.create({ data: { lessonId: lRec.id, title: "Phiếu bài tập Vi-ét", instructions: "Làm 5 bài trong phiếu.", maxPoints: 10, dueDate: new Date(Date.now() - 5 * 86400_000), ownerId: T.id, mode: "file" } });
  const aQuiz = await prisma.assignment.create({ data: { lessonId: lPaid.id, title: "Trắc nghiệm bậc hai", maxPoints: 10, dueDate: new Date(Date.now() + 3 * 86400_000), ownerId: T.id, mode: "quiz" } });
  const q1 = await prisma.assignmentQuestion.create({ data: { assignmentId: aQuiz.id, order: 1, text: "Nghiệm của x² − 4 = 0 là?", points: 5, type: "MC" } });
  await prisma.assignmentOption.createMany({ data: [{ questionId: q1.id, order: 1, text: "x = ±2", isCorrect: true }, { questionId: q1.id, order: 2, text: "x = 4", isCorrect: false }] });
  const q2 = await prisma.assignmentQuestion.create({ data: { assignmentId: aQuiz.id, order: 2, text: "Tổng hai nghiệm của x² − 5x + 6 = 0?", points: 5, type: "MC" } });
  await prisma.assignmentOption.createMany({ data: [{ questionId: q2.id, order: 1, text: "5", isCorrect: true }, { questionId: q2.id, order: 2, text: "6", isCorrect: false }] });
  await prisma.assignment.create({ data: { lessonId: lRec.id, title: "Bài về nhà quá hạn", maxPoints: 10, dueDate: new Date(Date.now() - 2 * 86400_000), ownerId: T.id, mode: "file" } });
  if (!opts.empty) {
    await prisma.assignmentSubmission.create({ data: { assignmentId: aGraded.id, userId: S.id, fileUrl: "/u/vi-et.pdf", fileName: "vi-et.pdf", score: 8.5, comment: "Làm tốt, chú ý bài 4.", gradedAt: new Date(), gradedBy: T.id } });
  }

  // Đề thi: E1 công khai (không gắn lớp) · E2 của lớp C1 · E3 của lớp khác. Mỗi đề có 3 câu trắc nghiệm.
  const mkExam = async (key: string, title: string, o: Record<string, unknown>) => {
    const ex = await prisma.exam.create({ data: { id: `exam-${key}-${stamp}`, code: `DE-${key.toUpperCase()}-${stamp.toString(36).toUpperCase().slice(-4)}`, title, category: "toan", date: vnDateKey(3), time: "19:00", duration: "30", questions: 3, status: "available", createdAt: new Date().toISOString(), totalPoints: 30, ...o } as never });
    for (let i = 1; i <= 3; i++) {
      const eq = await prisma.examQuestion.create({ data: { id: `eq-${key}-${i}-${stamp}`, examId: ex.id, order: i, text: `Câu ${i}: 1 + ${i} = ?`, points: 10, type: "MC" } });
      await prisma.examOption.createMany({ data: [{ id: `eo-${key}-${i}a-${stamp}`, questionId: eq.id, order: 1, text: String(1 + i), isCorrect: true }, { id: `eo-${key}-${i}b-${stamp}`, questionId: eq.id, order: 2, text: String(2 + i), isCorrect: false }] });
    }
    return ex;
  };
  const E1 = await mkExam("pub", "Thi thử Toán công khai", { ownerId: SA.id });
  const E2 = await mkExam("cls", "Kiểm tra 15 phút lớp Toán 9", { ownerId: T.id, courseId: C1.id });
  const E3 = await mkExam("oth", OTHER_S.exam, { ownerId: T2.id, courseId: C2.id });
  await prisma.examResult.create({ data: { userId: S2.id, examId: E1.id, score: 27, totalPoints: 30 } });
  if (!opts.empty) {
    await prisma.examResult.create({ data: { userId: S.id, examId: E1.id, score: 24, totalPoints: 30 } });
    await prisma.examAttempt.create({ data: { userId: S.id, examId: E1.id, status: "submitted", submittedAt: new Date(), expiresAt: new Date(Date.now() + 3600_000), score: 24, totalPoints: 30 } });
  }

  // Lịch học + báo nghỉ
  const sch = await prisma.classSchedule.create({ data: { courseId: C1.id, dayOfWeek: dow(1), startTime: "19:00", endTime: "20:30", note: "Học qua Meet", joinUrl: "https://meet.example.com/toan9" } });
  await prisma.classSchedule.create({ data: { courseId: C1.id, dayOfWeek: dow(3), startTime: "18:00", endTime: "19:30" } });
  if (!opts.empty) {
    const tomorrow = vnDateKey(1);
    await prisma.classAbsence.create({ data: { courseId: C1.id, scheduleId: sch.id, dateKey: tomorrow, startAt: new Date(`${tomorrow}T19:00:00+07:00`), studentId: S.id, reportedBy: "student", leadMinutes: 600, reason: "Có việc gia đình", status: "pending" } });
  }

  // Học phí: phiếu đã gửi (link riêng còn hạn) + phiếu hết hạn + phiếu đã đóng; tài khoản nhận của gia sư để có mã QR
  await prisma.tutorPayoutAccount.create({ data: { userId: T.id, bankBin: "970436", accountNo: "0123456789", accountName: "NGUYEN VAN LAN" } });
  const YM = vnDateKey(0).slice(0, 7);
  const mkInv = (studentId: string, viewToken: string | null, ym: string, status: string, expires: Date | null, extra: Record<string, unknown> = {}) =>
    prisma.tuitionInvoice.create({ data: { code: generateInvoiceCode(), tutorId: T.id, studentId, yearMonth: ym, amountDue: 1_200_000, status, sentAt: new Date(), viewToken, viewTokenExpiresAt: expires, ...extra } as never });
  await mkInv(S.id, TOKENS.invoice, YM, "sent", new Date(Date.now() + 20 * 86400_000));
  await mkInv(S.id, TOKENS.invoiceExpired, "2026-08", "sent", new Date(Date.now() - 1000));
  await mkInv(S.id, tok(0xe5), "2026-07", "paid", new Date(Date.now() + 5 * 86400_000), { paidAmount: 1_200_000, paidAt: new Date() });
  await mkInv(S3.id, tok(0xf6), YM, "sent", new Date(Date.now() + 20 * 86400_000));   // phiếu của học sinh KHÁC: không được lọt vào trang của S

  // Ví + giao dịch + yêu cầu nạp
  if (!opts.empty) {
    await prisma.wallet.upsert({ where: { userId: S.id }, update: { balance: 250 }, create: { userId: S.id, balance: 250 } });
    await prisma.coinTransaction.createMany({ data: [{ userId: S.id, amount: 200, reason: "Quà đăng ký" }, { userId: S.id, amount: 50, reason: "Thưởng làm bài" }] });
    await prisma.coinTopupRequest.create({ data: { userId: S.id, amountVnd: 100_000, coinAmount: 100, status: "pending", bankRef: "CK-THU" } });
  }

  // Cộng đồng: chung (S2 đăng, S trả lời) · trong lớp C1 · trong lớp C2 (S không được thấy); hỏi đáp: câu của S có trả lời của gia sư, câu của S2 đã chọn đáp án, câu của S3
  const th1 = await prisma.thread.create({ data: { content: "Cách nhớ hệ thức Vi-ét nhanh nhất là gì? ".repeat(2), authorId: S2.id, category: "hoi-dap" } });
  await prisma.threadReply.create({ data: { content: "Nhớ tổng và tích nghiệm theo a, b, c nhé.", authorId: opts.empty ? T.id : S.id, threadId: th1.id } });
  const th2 = await prisma.thread.create({ data: { content: "Bài đăng trong lớp Toán 9 của bạn cùng lớp.", authorId: S2.id, category: "kinh-nghiem", courseId: C1.id } });
  const th3 = await prisma.thread.create({ data: { content: OTHER_S.classThread, authorId: S3.id, category: "kinh-nghiem", courseId: C2.id } });
  if (!opts.empty) await prisma.threadBookmark.create({ data: { userId: S.id, threadId: th1.id } });
  const qA = await prisma.question.create({ data: { authorId: opts.empty ? S2.id : S.id, title: "Giải phương trình bậc hai như thế nào?", content: "Em chưa hiểu công thức nghiệm.", bountyPaid: 0 } });
  await prisma.answer.create({ data: { questionId: qA.id, authorId: T.id, content: "Dùng biệt thức Δ = b² − 4ac rồi xét dấu." } });
  const qB = await prisma.question.create({ data: { authorId: S3.id, title: "Câu hỏi của bạn lớp khác", content: "Nội dung câu hỏi lớp khác.", bountyPaid: 0 } });

  // Tin tức, điểm chuẩn, đánh giá lớp, lớp đã lưu, huy hiệu
  const article = await prisma.article.create({ data: { slug: "tin-thu-nghiem-hs", title: "Tin thử nghiệm cho học sinh", excerpt: "Tóm tắt tin", content: "Nội dung tin thử nghiệm.", category: "tuyen-sinh", author: "KiN", authorId: SA.id, published: true, publishedAt: new Date() } });
  await prisma.admissionScore.create({ data: { school: "ĐH Bách khoa Hà Nội", major: "Khoa học máy tính", year: 2025, method: "Điểm thi THPT", score: 28.5, scale: 30, sourceUrl: "https://example.org/nguon-diem-chuan", sourceName: "Nguồn thử", published: true, verified: true } });
  await prisma.courseReview.create({ data: { userId: S2.id, courseId: C1.id, rating: 5, comment: "Lớp rất hay, cô dạy dễ hiểu.", status: "approved" } });
  if (!opts.empty) await prisma.cartItem.create({ data: { userId: S.id, courseId: C4.id } });
  await prisma.userBadge.create({ data: { userId: S2.id, badgeId: "chuyen-can", grantedBy: SA.id } });

  // Phụ huynh: liên kết đã xác nhận (+ cổng "Sổ của con" qua link riêng) và một yêu cầu xác nhận vào lớp C3 đang chờ
  const pl = await prisma.parentLink.create({ data: { parentId: P.id, studentId: S.id, status: "verified", verifiedAt: new Date(), portalToken: TOKENS.portal } });
  if (enr3) await prisma.parentConsent.create({ data: { parentLinkId: pl.id, enrollmentId: enr3.id, token: TOKENS.consent, contentVersion: "v1", expiresAt: new Date(Date.now() + 86400_000 * 3) } });

  // Thông báo của S: mỗi cái trỏ một trang khác nhau — bài rà bấm lần lượt từng cái
  const notifs = opts.empty ? [] : [
    { type: "class_reminder", title: "Nhắc lịch học ngày mai", message: "Toán 9 lúc 19:00.", link: `/student/hoc-tap?course=${C1.id}` },
    { type: "thread_reply", title: "Có người trả lời bài của bạn", message: "Bạn Cùng Lớp đã trả lời.", link: `/cong-dong/${th1.id}` },
    { type: "answer", title: "Câu hỏi của bạn có đáp án", message: "Cô Lan đã trả lời.", link: `/student/hoi-dap/${qA.id}` },
    { type: "exam", title: "Đề thi mới", message: "Thi thử Toán công khai.", link: "/thi-thu" },
    { type: "enrollment", title: "Bạn đã được thêm vào lớp", message: "Toán 9.", link: `/student/hoc-tap?course=${C1.id}` },
    { type: "news", title: "Tin mới", message: "Tin thử nghiệm.", link: `/tin-tuc/${article.slug}` },
  ];
  for (const n of notifs) await prisma.notification.create({ data: { userId: S.id, ...n } });

  return {
    empty: !!opts.empty, SA, T, T2, S, S2, S3, P, C1, C2, C3, C4, invite, article, th1, th2, th3, qA, qB, E1, E2, E3,
    lessons: { rec: lRec, paid: lPaid, live: lLive, doc: lDoc, other: lOther }, aGraded, aQuiz, notifs, enr1, enr3,
  };
}
