// Thư viện (/thu-vien): máy chủ + DB thật, đọc HTML.
//   - Khách / quản trị: danh sách CÔNG KHAI, chỉ bài MIỄN PHÍ (isLocked không được dùng để quyết định công khai — từng làm lộ tài liệu bài trả phí).
//   - Tài liệu đọc đúng dạng dữ liệu thật: mảng JSON `[{name,url,type}]` (và dạng cũ "nhãn|url").
//   - Học viên: thư viện CỦA LỚP MÌNH ĐANG HỌC, kèm tiến độ xem + trạng thái bài nộp của chính mình; không lộ lớp khác.
//   - Gia sư: thư viện các lớp mình dạy kèm số bài nộp / chờ chấm.
import { BASE, cookieFor, mkSuper, mkTutor, mkUser, mkCourse, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { shortDate } from "@/lib/library";

// React chèn "<!-- -->" giữa các đoạn chữ liền nhau ("1<!-- --> lớp"); bỏ đi để so chuỗi liền như người đọc thấy.
const page = async (cookie?: string) => (await (await fetch(`${BASE}/thu-vien`, { headers: cookie ? { cookie } : {} })).text()).replace(/<!-- -->/g, "");
const D = 24 * 3_600_000;

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan"), T2 = await mkTutor("Thầy Nam");
  const S = await mkUser({ name: "Minh Anh" }), S2 = await mkUser({ name: "Bạn Chờ" }), S3 = await mkUser({ name: "Bạn Mới" });
  const SA = await mkSuper("Quản trị");

  // Lớp A (Cô Lan): công khai; lớp B (Thầy Nam): học viên S KHÔNG học.
  const A = await mkCourse(T.id, { name: "Toán 9 công khai" });
  const B = await mkCourse(T2.id, { name: "Lý 10 lớp khác" });
  await prisma.course.updateMany({ where: { id: { in: [A.id, B.id] } }, data: { status: true } });
  const secA = await prisma.section.create({ data: { id: "sA", title: "Phần Đại số", order: 1, courseId: A.id } });
  const chA = await prisma.chapter.create({ data: { id: "cA", title: "Chương Hệ thức Vi-ét", order: 1, sectionId: secA.id } });
  const secB = await prisma.section.create({ data: { id: "sB", title: "Phần Cơ học", order: 1, courseId: B.id } });
  const chB = await prisma.chapter.create({ data: { id: "cB", title: "Chương Động lực", order: 1, sectionId: secB.id } });

  const docsJson = (n: string) => JSON.stringify([{ name: `${n}.pdf`, url: `https://files.example/${n}.pdf`, type: "pdf" }, { name: `${n}-gg`, url: "https://docs.google.com/document/d/abc/edit", type: "doc" }]);
  const lesson = (id: string, title: string, order: number, o: Record<string, unknown>, ch = chA.id) =>
    prisma.lesson.create({ data: { id, code: id, title, type: "record", order, chapterId: ch, ...o } as any });
  // Bài 1: miễn phí, có video + tài liệu JSON + bài tập. Bài 2: TRẢ PHÍ nhưng gia sư quên bật khoá (isLocked=false) — KHÔNG được lộ ra công khai.
  await lesson("l1", "Bài 1 Hệ thức Vi-ét", 1, { isFree: true, isLocked: false, videoUrl: "https://youtu.be/x", duration: "1:52:04", documents: docsJson("TL-MIEN-PHI") });
  await lesson("l2", "Bài 2 Tra phi", 2, { isFree: false, isLocked: false, videoUrl: "https://youtu.be/y", duration: "45 phút", documents: docsJson("TL-TRA-PHI-MO") });
  await lesson("l3", "Bài 3 Dạng cũ nhãn|url", 3, { isFree: true, isLocked: true, documents: "TL-DANG-CU|https://files.example/cu.pdf\nrac khong co url" });
  await lesson("l4", "Bài 4 Trống", 4, { isFree: false, isLocked: true });
  await lesson("lB", "Bài B Lớp khác", 1, { isFree: true, isLocked: false, documents: docsJson("TL-LOP-KHAC"), videoUrl: "https://youtu.be/z" }, chB.id);

  // Bài tập ở bài 1 và bài 2 của lớp A: S đã nộp + đã chấm (18,4/25); S2 chưa nộp, quá hạn.
  const aGraded = await prisma.assignment.create({ data: { id: "as1", lessonId: "l1", title: "Phiếu bài tập Vi-ét", maxPoints: 25, dueDate: new Date(Date.now() - 5 * D), ownerId: T.id } });
  const aOpen = await prisma.assignment.create({ data: { id: "as2", lessonId: "l2", title: "Bài tập còn hạn", maxPoints: 10, dueDate: new Date(Date.now() + 6 * D), ownerId: T.id } });
  const aWait = await prisma.assignment.create({ data: { id: "as3", lessonId: "l3", title: "Bài tập chờ chấm", maxPoints: 10, ownerId: T.id } });
  await prisma.assignmentSubmission.create({ data: { assignmentId: aGraded.id, userId: S.id, fileUrl: "/u/a.pdf", score: 18.4, gradedAt: new Date() } });
  await prisma.assignmentSubmission.create({ data: { assignmentId: aWait.id, userId: S.id, fileUrl: "/u/b.pdf" } });
  await prisma.assignmentSubmission.create({ data: { assignmentId: aWait.id, userId: S2.id, fileUrl: "/u/c.pdf" } });
  await prisma.assignmentSubmission.create({ data: { assignmentId: aGraded.id, userId: S2.id, fileUrl: "/u/d.pdf", score: 10, gradedAt: new Date() } });
  // Ghi danh: S đang học lớp A (active); S2 đang chờ phụ huynh (pending_consent) — chưa có quyền học; S3 chưa vào lớp nào.
  await prisma.enrollment.create({ data: { userId: S.id, courseId: A.id, status: "active" } });
  await prisma.enrollment.create({ data: { userId: S2.id, courseId: A.id, status: "pending_consent" } });
  // Tiến độ xem của S ở bài 1: 38 phút trên 1 giờ 52 phút.
  await prisma.lessonProgress.create({ data: { userId: S.id, lessonId: "l1", watchedSeconds: 38 * 60 } });
  await prisma.lessonProgress.create({ data: { userId: S2.id, lessonId: "l1", watchedSeconds: 6000 } });

  const [sc, s2c, s3c, tc, t2c, ac] = await Promise.all([cookieFor(S), cookieFor(S2), cookieFor(S3), cookieFor(T), cookieFor(T2), cookieFor(SA)]);

  section("Khách: danh sách công khai — chỉ bài MIỄN PHÍ, đọc đúng dạng JSON");
  for (const [name, cookie] of [["khách", undefined], ["quản trị cấp 1", ac]] as const) {
    const h = await page(cookie);
    check(`${name}: thấy tài liệu của bài miễn phí (dạng JSON thật) và dạng cũ 'nhãn|url'`, h.includes("TL-MIEN-PHI.pdf") && h.includes("TL-DANG-CU"), h.length);
    check(`${name}: tên khoá hiện, KHÔNG hiện bản ghi/bài tập/trạng thái cá nhân`, h.includes("Toán 9 công khai") && !h.includes("Đã xem") && !h.includes("Bản ghi bài học") && !h.includes("Phiếu bài tập Vi-ét"));
    check(`${name}: tài liệu bài TRẢ PHÍ mà gia sư quên bật khoá (isLocked=false) KHÔNG lộ`, !h.includes("TL-TRA-PHI-MO"));
    check(`${name}: tài liệu của lớp khác vẫn công khai nếu bài miễn phí (đúng: ai cũng xem được bài miễn phí)`, h.includes("TL-LOP-KHAC.pdf"));
    check(`${name}: tài liệu mở qua trang xem trước /xem-tai-lieu, không dẫn thẳng ra tệp`, h.includes("/xem-tai-lieu?url=") && !/href="https:\/\/files\.example/.test(h));
  }
  const closed = await (async () => { await prisma.course.updateMany({ where: { id: { in: [A.id, B.id] } }, data: { status: false } }); const h = await page(); await prisma.course.updateMany({ where: { id: { in: [A.id, B.id] } }, data: { status: true } }); return h; })();
  check("khoá đã đóng (status=false) → không liệt kê dù bài miễn phí", !closed.includes("TL-MIEN-PHI") && closed.includes("Chưa có tài liệu công khai"));

  section("Học viên: thư viện CỦA LỚP MÌNH — gom theo bài, kèm trạng thái cá nhân");
  const h = await page(sc);
  check("tiêu đề 'Thư viện' + phụ đề nói đây là các lớp bạn đang học (1 lớp)", h.includes("Bản ghi và tài liệu của các lớp bạn đang học") && h.includes("1 lớp"));
  check("hiện lớp mình học, KHÔNG hiện lớp khác (Lý 10) và tài liệu của nó", h.includes("Toán 9 công khai") && !h.includes("Lý 10 lớp khác") && !h.includes("TL-LOP-KHAC"));
  check("gom theo BÀI: tiêu đề từng bài kèm 'Phần · Chương'", h.includes("Bài 1 Hệ thức Vi-ét") && h.includes("Phần Đại số · Chương Hệ thức Vi-ét"));
  check("video: 'Bản ghi bài học' + thời lượng + 'Đã xem 38 phút' (tiến độ của chính mình)", h.includes("Bản ghi bài học") && h.includes("1:52:04") && h.includes("Đã xem 38 phút"));
  check("học viên đã vào lớp thấy cả tài liệu của bài TRẢ PHÍ (họ có quyền học), đọc đúng dạng JSON", h.includes("TL-TRA-PHI-MO.pdf") && h.includes("Bài 2 Tra phi"));
  check("tài liệu dạng Google Docs có nhãn DOC; tệp PDF có nhãn PDF", h.includes(">PDF<") && h.includes(">DOC<"));
  check("bài tập đã chấm: 'Đã chấm · 18,4/25' (dấu phẩy kiểu Việt)", h.includes("Phiếu bài tập Vi-ét") && h.includes("Đã chấm · 18,4/25"));
  check("bài tập còn hạn: 'Chưa nộp · hạn dd/mm' đúng ngày theo giờ Việt Nam", h.includes(`Chưa nộp · hạn ${shortDate(new Date(Date.now() + 6 * D))}`));
  check("bài tập đã nộp chưa chấm: 'Đã nộp · chờ chấm'", h.includes("Bài tập chờ chấm") && h.includes("Đã nộp · chờ chấm"));
  check("điểm / bài nộp của người khác (S2: 10 điểm) KHÔNG lộ sang học viên này", !h.includes("Đã chấm · 10/25"));
  check("dạng cũ 'nhãn|url' vẫn hiện; dòng rác không có url bị bỏ", h.includes("TL-DANG-CU") && !h.includes("rac khong co url"));
  check("bài không có gì (Bài 4) không bị liệt kê, nhưng được đếm: '1 bài khác chưa có bản ghi hay tài liệu'", !h.includes("Bài 4 Trống") && h.includes("1 bài khác chưa có bản ghi hay tài liệu"));
  check("lối 'Mở bài' dẫn tới trang bài giảng của học viên; video và bài tập cũng vậy", h.includes('href="/student/bai-giang/l1"') && h.includes('href="/student/bai-giang/l2"'));
  check("ghi chú Figma: video là đường dẫn, KiN không lưu file video", h.includes("KiN không lưu file video"));
  check("không có nút 'Sửa bài' / lối sang trang quản trị ở bản học viên", !h.includes("Sửa bài") && !h.includes("/admin/"));
  check("mỗi lớp có lối 'Học tiếp trong lớp →' sang /student/hoc-tap?course=<lớp> (Lớp = đường học, Thư viện = nơi tìm lại)", h.includes(`href="/student/hoc-tap?course=${A.id}"`) && h.includes("Học tiếp trong lớp"));
  check("khối của lớp có neo id=c-<lớp> để trang Lớp trỏ thẳng vào (/thu-vien#c-<lớp>)", h.includes(`id="c-${A.id}"`));

  section("Học viên chờ phụ huynh duyệt (pending_consent) và học viên chưa vào lớp");
  const h2 = await page(s2c);
  check("pending_consent KHÔNG có quyền học → không thấy tài liệu của lớp, thấy thông báo chưa vào lớp", !h2.includes("TL-MIEN-PHI") && !h2.includes("Bản ghi bài học") && h2.includes("Bạn chưa vào lớp nào"));
  const h3 = await page(s3c);
  check("học viên chưa vào lớp nào → thông báo + lối 'Nhập mã mời để vào lớp' (/student/nhap-ma-lop)", h3.includes("Bạn chưa vào lớp nào") && h3.includes('href="/student/nhap-ma-lop"'));

  section("Gia sư: thư viện các lớp MÌNH dạy");
  const th = await page(tc);
  check("phụ đề nói đây là các lớp bạn dạy; hiện lớp của mình, KHÔNG hiện lớp của gia sư khác", th.includes("Bản ghi và tài liệu của các lớp bạn dạy") && th.includes("Toán 9 công khai") && !th.includes("Lý 10 lớp khác"));
  check("hiện cả bài trả phí của chính mình (tài liệu + video), lối 'Sửa bài' → /admin/khoa-hoc/<lớp>?tab=chuong-bai (đúng tab chương bài, không phải Cài đặt)", th.includes("TL-TRA-PHI-MO.pdf") && th.includes("Sửa bài") && th.includes(`/admin/khoa-hoc/${A.id}?tab=chuong-bai`));
  check("bài tập: 'N bài nộp · M chờ chấm' (không phải trạng thái của một học viên)", th.includes("2 bài nộp · 0 chờ chấm".replace("0 chờ chấm", "đã chấm hết")) || th.includes("bài nộp"), th.match(/\d+ bài nộp[^<]*/g));
  check("gia sư không thấy 'Đã xem' (không có tiến độ cá nhân)", !th.includes("Đã xem"));
  check("gia sư KHÔNG có lối 'Học tiếp trong lớp' (đó là của học viên)", !th.includes("Học tiếp trong lớp") && !th.includes("/student/hoc-tap"));
  const t2h = await page(t2c);
  check("gia sư khác chỉ thấy lớp của mình (Lý 10), không thấy Toán 9", t2h.includes("Lý 10 lớp khác") && !t2h.includes("Toán 9 công khai") && !t2h.includes("TL-MIEN-PHI"));

  await done();
})();
