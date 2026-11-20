// LOI-04 — dữ liệu GIẢ cho "Nhắc học" (/student/nhac-hoc) của học sinh chính (hocsinh@kin.local).
// Chạy SAU mock/loi-03.ts (mock-seed.ts sắp theo tên tệp): dùng lại bài lớp `l-loi03-toan-1` (hôm nay 19:30 VN) làm mục tự động theo lớp,
// và gắn một nhắc việc vào `l-loi03-van-1`. Chạy lặp lại được: upsert theo id cố định `nh-loi04-*`, `update` dời mọi mốc về NGÀY CHẠY (giờ VN).
// Chỉ chữ giả: không tên người thật, không số điện thoại, không mật khẩu.
import { addDaysKey, vnDateKeyOf } from "@/lib/classSessions";
import { dueOf } from "@/lib/nhacHoc";
import type { MockFn } from "../mock-seed";

const mock: MockFn = async ({ prisma, student }) => {
  const today = vnDateKeyOf(new Date());
  const lines: string[] = [];

  const toan1 = await prisma.lesson.findUnique({ where: { id: "l-loi03-toan-1" }, select: { id: true } });
  const van1 = await prisma.lesson.findUnique({ where: { id: "l-loi03-van-1" }, select: { id: true, chapter: { select: { section: { select: { courseId: true } } } } } });
  if (!toan1 || !van1) lines.push("LOI-04 · thiếu bài của LOI-03 — chạy mock loi-03 trước (mục tự động theo lớp và mục gắn bài Làng sẽ không có).");

  type M = { id: string; title: string; tags: string[]; note?: string | null; date: string | null; time?: string | null; doneAt?: Date | null; lessonId?: string | null; courseId?: string | null };
  const put = (m: M) => {
    const due = m.date ? dueOf(m.date, m.time ?? null) : { dueAt: null, dueHasTime: false };
    const data = {
      title: m.title, tags: m.tags, note: m.note ?? null, dueAt: due.dueAt, dueHasTime: due.dueHasTime,
      doneAt: m.doneAt ?? null, notifiedAt: null, lessonId: m.lessonId ?? null, courseId: m.courseId ?? null,
    };
    // update cũng gán lại userId: học sinh chính có id mới (nạp lại không wipe) thì mục giả theo sang, không kẹt ở tài khoản cũ.
    return prisma.studentReminder.upsert({ where: { id: m.id }, update: { userId: student.id, ...data }, create: { id: m.id, userId: student.id, ...data } });
  };

  await put({ id: "nh-loi04-luong-giac", title: "Ôn công thức lượng giác", tags: ["toan", "on-thi"], date: today, time: "15:00",
    note: "Ôn sin, cos, tan của các góc đặc biệt.\nLàm lại 5 câu sai tuần trước." });
  await put({ id: "nh-loi04-khao-sat", title: "Nộp phiếu khảo sát", tags: ["viec-nha"], date: addDaysKey(today, -1) }); // quá hạn, chỉ ngày
  await put({ id: "nh-loi04-lang", title: "Đọc trước bài Làng", tags: ["van"], date: addDaysKey(today, 2), time: "19:00",
    lessonId: van1?.id ?? null, courseId: van1?.chapter.section.courseId ?? null });
  await put({ id: "nh-loi04-but-chi", title: "Mua bút chì 2B", tags: [], date: null,
    note: "Xem mẫu ở https://vi.wikipedia.org/wiki/B%C3%BAt_ch%C3%AC (dữ liệu giả)." });
  await put({ id: "nh-loi04-de-thu", title: "Làm đề thử số 1", tags: ["toan"], date: addDaysKey(today, -1),
    doneAt: new Date(Date.now() - 24 * 3_600_000) }); // đã xong hôm qua

  lines.push(
    `LOI-04 · hocsinh@kin.local → xem ở /student/nhac-hoc : "Hôm nay" có "Nộp phiếu khảo sát" (Quá hạn) rồi "Ôn công thức lượng giác" 15:00 #toan #on-thi` +
      `${toan1 ? ' và khối "Buổi học" Bài 1 · 19:30 (Mở ↗ / Bài Azota ↗ / Làm bài tập)' : ""}; "Đã hẹn" có "Đọc trước bài Làng" gắn Văn 9; "Tất cả" có "Mua bút chì 2B" (ghi chú có link); "Đã xong" có "Làm đề thử số 1".`,
  );
  return lines;
};

export default mock;
