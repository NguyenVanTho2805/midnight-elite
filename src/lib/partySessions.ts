// BC-02: "Chi tiết từng buổi" trên Sổ của con (Figma "Báo cáo · Chi tiết buổi và tiến bộ" 464:8775). Hàm THUẦN: chọn và sắp các bản ghi điểm danh của ĐÚNG một em.
// Chỉ TRÌNH BÀY điểm danh gia sư đã ghi trên KiN (ngày, lớp, trạng thái). Không điểm, không ghi chú: điểm từng buổi vẫn ở mục riêng và chỉ khi đồng ý "scores" còn hiệu lực;
// ghi chú của gia sư về em KHÔNG có cờ "cho phụ huynh xem" nên không đưa lên. Buổi ở ngày chưa tới (báo nghỉ trước) bị cắt. Test: tools/local-e2e/t-party-sessions-lib.ts.
import { isAttendanceStatus, ATTENDANCE_LABEL, type AttendanceStatus } from "@/lib/attendance";
import { isValidDateKey } from "@/lib/classSessions";

export const PARTY_SESSIONS_LIMIT = 12;
export interface PartySessionRow { dateKey: string; courseName: string; status: AttendanceStatus; label: string; tone: "xong" | "cho" | "loi" | "mo" }
export interface RawSessionRecord { dateKey: string; courseName: string; status: string }

const TONE: Record<AttendanceStatus, PartySessionRow["tone"]> = { present: "xong", late: "xong", excused: "mo", absent: "loi" };

/** Mới → cũ, bỏ ngày chưa tới (`todayKey` giờ VN), bỏ trạng thái lạ, tối đa `limit`. Cùng ngày: xếp theo tên lớp để ổn định. */
export function partySessionRows(records: readonly RawSessionRecord[], todayKey: string, limit = PARTY_SESSIONS_LIMIT): PartySessionRow[] {
  if (!isValidDateKey(todayKey)) throw new Error(`todayKey không hợp lệ: ${todayKey}`);
  return records
    .filter(r => isValidDateKey(r.dateKey) && r.dateKey <= todayKey && isAttendanceStatus(r.status))
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey) || a.courseName.localeCompare(b.courseName, "vi"))
    .slice(0, Math.max(0, limit))
    .map(r => { const status = r.status as AttendanceStatus; return { dateKey: r.dateKey, courseName: r.courseName, status, label: ATTENDANCE_LABEL[status], tone: TONE[status] }; });
}
