// Số liệu trang Hộp việc của gia sư (Figma "Gia sư · Hộp việc" 299:111821 / mobile 299:116033): dải 4 số, buổi học sắp tới, lớp thường dùng.
// Thuần (không Prisma) để test; truy vấn nằm ở tutorOverviewServer.ts. KHÔNG tính tiền mới: chỉ cộng lại số trên phiếu/khoản đã có.
// Không số bịa: ô nào chưa có nguồn thật thì trả giá trị rỗng để giao diện nói thẳng "chưa có".
import { dayOfWeekOfKey, hmOf, vnDateKeyOf, vnMinutesOfDay } from "@/lib/classSessions";
import { OPEN_STATUSES } from "@/lib/tuitionInvoice";

export const WEEKDAY_LONG = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
const vnd = (n: number) => `${Math.round(n).toLocaleString("vi-VN")}đ`;
const vnHm = (iso: string) => hmOf(vnMinutesOfDay(new Date(iso)));

export interface OverviewInvoice { amountDue: number; paidAmount: number; status: string }
export interface OverviewClass { id: string; name: string; students: number; classStatus: string }
export interface OverviewOccurrence {
  courseId: string; courseName: string; dateKey: string; startAt: string; endAt: string; status: string;
  studentCount: number; pendingAbsences: number;
}

/** HV-10 — số đếm THẬT từ dữ liệu của gia sư, để tự tick checklist. Không có số nào ở đây do người dùng khai. */
export interface SetupCounts {
  payoutAccount: boolean;
  classes: number;
  students: number;
  schedules: number;
  attendanceRecords: number;
  invoices: number;
  parentLinks: number;
  taughtSessions: number;
}
export interface SetupStep { key: string; label: string; hint: string; done: boolean; href: string }
export interface SetupChecklist { steps: SetupStep[]; doneCount: number; total: number; allDone: boolean }

/** 8 bước thiết lập theo thứ tự nên làm. Mỗi bước chỉ "xong" khi dữ liệu thật đã có; không có bước nào tick tay. */
export function buildSetupChecklist(c: SetupCounts): SetupChecklist {
  const steps: SetupStep[] = [
    { key: "tai-khoan", label: "Thêm tài khoản nhận học phí", hint: "Để phiếu có mã QR chuyển thẳng vào tài khoản của cô.", done: c.payoutAccount, href: "/lop-cua-toi/hoc-phi?tab=nhan-tien" },
    { key: "lop", label: "Tạo lớp đầu tiên", hint: "Tên lớp, môn và mức học phí.", done: c.classes > 0, href: "/admin/khoa-hoc?tao=1" },
    { key: "hoc-sinh", label: "Thêm học sinh vào lớp", hint: "Thêm tay hoặc gửi mã mời cho học sinh.", done: c.students > 0, href: "/lop-cua-toi/hoc-sinh/them" },
    { key: "lich", label: "Đặt lịch học cho lớp", hint: "Khung giờ lặp lại hằng tuần.", done: c.schedules > 0, href: "/lop-cua-toi/lich" },
    { key: "diem-danh", label: "Điểm danh một buổi", hint: "Mở lớp, chọn ngày, ghi có mặt hoặc vắng.", done: c.attendanceRecords > 0, href: "/lop-cua-toi/lop" },
    { key: "phieu", label: "Lập phiếu học phí đầu tiên", hint: "Phiếu lập từ các buổi đã dạy trong tháng.", done: c.invoices > 0, href: "/lop-cua-toi/hoc-phi" },
    { key: "phu-huynh", label: "Mời phụ huynh xem sổ của con", hint: "Phụ huynh xem được điểm danh và phiếu của con mình.", done: c.parentLinks > 0, href: "/lop-cua-toi/hoc-sinh" },
    { key: "chot-buoi", label: "Chốt một buổi đã dạy", hint: "Buổi có ít nhất một em có mặt hoặc đi muộn.", done: c.taughtSessions > 0, href: "/lop-cua-toi/lich" },
  ];
  const doneCount = steps.filter(s => s.done).length;
  return { steps, doneCount, total: steps.length, allDone: doneCount === steps.length };
}

export interface UpcomingRow { time: string; when: string; courseName: string; meta: string; href: string }

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
  /** HV-06 — Đã thu / Chưa thu của tháng này. Chưa thu = công thức trang Doanh thu: phần còn lại của phiếu ĐÃ GỬI chưa đóng đủ. */
  month: { collected: string; receivable: string; receivableHint: string };
  /** HV-08 — tối đa 3 buổi gần nhất sắp diễn ra (trong 7 ngày tới), bỏ buổi đã huỷ. */
  upcoming: UpcomingRow[];
  /** HV-10 — checklist thiết lập; null khi chưa nạp số đếm. */
  setup: SetupChecklist | null;
  next: null | {
    time: string; courseName: string; meta: string; note: string | null; attendanceHref: string; following: string | null;
  };
  classes: { total: number; rows: { id: string; name: string; students: number; href: string }[] };
}

export function buildHopViecOverview(input: {
  now: Date; invoices: OverviewInvoice[]; classes: OverviewClass[]; totalStudents: number; occurrences: OverviewOccurrence[]; setup?: SetupCounts;
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

  const openInv = live.filter(i => (OPEN_STATUSES as string[]).includes(i.status));
  const receivable = openInv.reduce((n, i) => n + Math.max(0, i.amountDue - i.paidAmount), 0);
  const openUnpaid = openInv.filter(i => i.amountDue - i.paidAmount > 0).length;

  const when = (o: OverviewOccurrence) => `${WEEKDAY_LONG[dayOfWeekOfKey(o.dateKey)]}, ${vnHm(o.startAt)}`;
  const sorted = [...input.classes].sort((a, b) => b.students - a.students || a.name.localeCompare(b.name, "vi"));

  return {
    dateLine: `${WEEKDAY_LONG[dayOfWeekOfKey(todayKey)]}, ${Number(todayKey.slice(8, 10))} tháng ${monthNumber}`,
    monthNumber,
    month: {
      collected: vnd(confirmed),
      receivable: vnd(receivable),
      receivableHint: openUnpaid > 0 ? `${openUnpaid} phiếu đã gửi chưa đóng đủ` : "Không có phiếu đã gửi nào còn thiếu",
    },
    upcoming: upcoming.slice(0, 3).map(o => ({
      time: `${vnHm(o.startAt)} – ${vnHm(o.endAt)}`,
      when: o.dateKey === todayKey ? "Hôm nay" : `${WEEKDAY_LONG[dayOfWeekOfKey(o.dateKey)]} ${o.dateKey.slice(8, 10)}/${o.dateKey.slice(5, 7)}`,
      courseName: o.courseName,
      meta: `${o.studentCount} học sinh`,
      href: "/lop-cua-toi/lich",
    })),
    setup: input.setup ? buildSetupChecklist(input.setup) : null,
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
