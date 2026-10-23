// Số liệu trang Hộp việc của gia sư (Figma "Gia sư · Hộp việc" 299:111821 / mobile 299:116033): dải 4 số, buổi học sắp tới, lớp thường dùng.
// Thuần (không Prisma) để test; truy vấn nằm ở tutorOverviewServer.ts. KHÔNG tính tiền mới: chỉ cộng lại số trên phiếu/khoản đã có.
// Không số bịa: ô nào chưa có nguồn thật thì trả giá trị rỗng để giao diện nói thẳng "chưa có".
import { dayOfWeekOfKey, hmOf, vnDateKeyOf, vnMinutesOfDay } from "@/lib/classSessions";

export const WEEKDAY_LONG = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
const vnd = (n: number) => `${Math.round(n).toLocaleString("vi-VN")}đ`;
const vnHm = (iso: string) => hmOf(vnMinutesOfDay(new Date(iso)));

export interface OverviewInvoice { amountDue: number; paidAmount: number; status: string }
export interface OverviewClass { id: string; name: string; students: number; classStatus: string }
export interface OverviewOccurrence {
  courseId: string; courseName: string; dateKey: string; startAt: string; endAt: string; status: string;
  studentCount: number; pendingAbsences: number;
}

export interface HopViecOverview {
  /** "Thứ Sáu, 23 tháng 10" */
  dateLine: string;
  monthNumber: number;
  stats: {
    confirmed: { value: string; hint: string };
    invoices: { value: string; hint: string };
    classes: { value: string; hint: string };
    today: { value: string; hint: string };
  };
  next: null | {
    time: string; courseName: string; meta: string; note: string | null; attendanceHref: string; following: string | null;
  };
  classes: { total: number; rows: { id: string; name: string; students: number; href: string }[] };
}

export function buildHopViecOverview(input: {
  now: Date; invoices: OverviewInvoice[]; classes: OverviewClass[]; totalStudents: number; occurrences: OverviewOccurrence[];
}): HopViecOverview {
  const { now } = input;
  const todayKey = vnDateKeyOf(now);
  const monthNumber = Number(todayKey.slice(5, 7));
  const live = input.invoices.filter(i => i.status !== "cancelled");
  const confirmed = live.reduce((n, i) => n + Math.max(0, i.paidAmount), 0);
  const paidCount = live.filter(i => i.status === "paid").length;
  const total = live.reduce((n, i) => n + i.amountDue, 0);
  const draftSum = live.filter(i => i.status === "draft").reduce((n, i) => n + i.amountDue, 0);
  const draftCount = live.filter(i => i.status === "draft").length;

  const occ = input.occurrences.filter(o => o.status !== "cancelled").sort((a, b) => a.startAt.localeCompare(b.startAt));
  const nowMs = now.getTime();
  const today = occ.filter(o => o.dateKey === todayKey);
  const todayFirst = today.find(o => new Date(o.endAt).getTime() >= nowMs) ?? today[0];
  const upcoming = occ.filter(o => new Date(o.endAt).getTime() >= nowMs);
  const nextOcc = upcoming[0];
  const after = upcoming[1];

  const when = (o: OverviewOccurrence) => `${WEEKDAY_LONG[dayOfWeekOfKey(o.dateKey)]}, ${vnHm(o.startAt)}`;
  const sorted = [...input.classes].sort((a, b) => b.students - a.students || a.name.localeCompare(b.name, "vi"));

  return {
    dateLine: `${WEEKDAY_LONG[dayOfWeekOfKey(todayKey)]}, ${Number(todayKey.slice(8, 10))} tháng ${monthNumber}`,
    monthNumber,
    stats: {
      confirmed: { value: vnd(confirmed), hint: live.length === 0 ? "Tháng này chưa lập phiếu nào" : paidCount > 0 ? `${paidCount} phiếu đã thanh toán` : "Chưa có phiếu nào thanh toán đủ" },
      invoices: { value: vnd(total), hint: live.length === 0 ? "Chưa có phiếu trong tháng" : draftCount > 0 ? `Gồm ${vnd(draftSum)} bản nháp` : `${live.length} phiếu, không còn bản nháp` },
      classes: { value: `${input.classes.length} lớp`, hint: `${input.totalStudents} học sinh đang học` },
      today: todayFirst
        ? { value: vnHm(todayFirst.startAt), hint: `${todayFirst.courseName} · ${todayFirst.studentCount} học sinh${today.length > 1 ? ` · còn ${today.length - 1} buổi nữa` : ""}` }
        : { value: "Trống", hint: "Hôm nay không có buổi dạy nào" },
    },
    next: nextOcc ? {
      time: `${vnHm(nextOcc.startAt)} – ${vnHm(nextOcc.endAt)}`,
      courseName: nextOcc.courseName,
      meta: `${nextOcc.dateKey === todayKey ? "Hôm nay" : WEEKDAY_LONG[dayOfWeekOfKey(nextOcc.dateKey)]} · ${nextOcc.studentCount} học sinh`,
      note: nextOcc.pendingAbsences > 0 ? `${nextOcc.pendingAbsences} báo nghỉ đang chờ cô quyết định.` : null,
      attendanceHref: `/admin/khoa-hoc/${nextOcc.courseId}/diem-danh?date=${nextOcc.dateKey}`,
      following: after ? `${after.courseName} · ${when(after)}` : null,
    } : null,
    classes: {
      total: sorted.length,
      rows: sorted.slice(0, 3).map(c => ({ id: c.id, name: c.name, students: c.students, href: `/lop-cua-toi/${c.id}` })),
    },
  };
}
