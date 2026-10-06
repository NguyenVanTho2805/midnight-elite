// AS-191 (06/10/2026) — hằng số & helper cho điểm danh.
//
// 5 trạng thái, 4 có record + 1 không có:
//   - "present"   → hệ số 1.0 (có mặt đầy đủ)
//   - "late"      → hệ số 0.9 (muộn, GD-05 chốt 01/10/2026)
//   - "excused"   → hệ số 0.8 (nghỉ có phép, GD-06)
//   - "absent"    → hệ số 0.5 (vắng không phép)
//   - (không có record) → không tính vào chuyên cần (GD-06
//     "chưa điểm danh"). Dùng cho buổi gia sư quên hoặc em chuyển lớp
//     giữa chừng — không được coi là vắng mặc định.
//
// Áp dụng cho CHUYÊN CẦN (NV-186), KHÔNG trừ học phí (D01: "vắng không
// trừ tiền" — buổi nào cũng có bản ghi để xem lại).
//
// Prisma client ở môi trường local chưa regen (proxy chặn binaries.
// prisma.sh); Vercel sẽ regen khi build. Helper này không cast Prisma —
// các route API dưới dùng `prisma.attendanceSession/.attendanceRecord`
// trực tiếp qua `as unknown as` để TS compile pass.

export const ATTENDANCE_STATUS = {
  PRESENT: "present",
  LATE:    "late",
  EXCUSED: "excused",
  ABSENT:  "absent",
} as const;

export type AttendanceStatus =
  (typeof ATTENDANCE_STATUS)[keyof typeof ATTENDANCE_STATUS];

const ALL_STATUSES: AttendanceStatus[] = [
  ATTENDANCE_STATUS.PRESENT,
  ATTENDANCE_STATUS.LATE,
  ATTENDANCE_STATUS.EXCUSED,
  ATTENDANCE_STATUS.ABSENT,
];

export function isAttendanceStatus(v: unknown): v is AttendanceStatus {
  return typeof v === "string" && (ALL_STATUSES as string[]).includes(v);
}

// Hệ số chuyên cần cho mỗi trạng thái (1.0 / 0.9 / 0.8 / 0.5).
export const ATTENDANCE_COEFFICIENT: Record<AttendanceStatus, number> = {
  present: 1.0,
  late:    0.9,
  excused: 0.8,
  absent:  0.5,
};

// Nhãn tiếng Việt cho UI (ngắn, dùng trong chip/button).
export const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = {
  present: "Có mặt",
  late:    "Muộn",
  excused: "Có phép",
  absent:  "Vắng",
};

// Tổng hệ số chuyên cần của 1 học viên trên 1 chuỗi record. Buổi không
// có record (không tính) → bỏ qua. Trả về { attended, total, ratio }:
// - attended = Σ hệ số
// - total    = số buổi có record (mẫu số)
// - ratio    = attended / total hoặc null nếu total = 0
export function computeAttendanceStats(
  records: { status: string }[],
): { attended: number; total: number; ratio: number | null } {
  let attended = 0;
  let total = 0;
  for (const r of records) {
    if (!isAttendanceStatus(r.status)) continue;
    attended += ATTENDANCE_COEFFICIENT[r.status];
    total += 1;
  }
  return {
    attended,
    total,
    ratio: total > 0 ? attended / total : null,
  };
}

// Chuẩn hoá ngày — zero hóa giờ/phút/giây để `@@unique([courseId, date])`
// khớp đúng theo "ngày", không bị trùng khi 2 buổi lệch nhau vài giờ do
// timezone client gửi lên.
export function normalizeAttendanceDate(input: string | Date): Date | null {
  const d = typeof input === "string" ? new Date(input) : input;
  if (isNaN(d.getTime())) return null;
  // Giữ ở UTC để nhất quán giữa server và client — frontend hiển thị theo
  // timezone người dùng. Chuyển về đầu ngày UTC.
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
