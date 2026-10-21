// ĐX-03 (NC1-041) — bảng điểm danh THÁNG của một lớp: học sinh × ngày, để xuất CSV / Excel và in ra PDF.
// Thuần (không Prisma, không exceljs) để test; truy vấn ở api/courses/[id]/attendance-export, Excel ở attendanceXlsx.ts.
//
// Cột ngày = các ngày CÓ phiên điểm danh trong tháng (lớp học 2–3 buổi/tuần nên bảng gọn, vừa một trang ngang).
// Hàng = học sinh đang học + học sinh đã rời lớp nhưng có bản ghi trong tháng.
// Ô: ký hiệu theo trạng thái; để TRỐNG = chưa điểm danh (không coi là vắng — quy tắc GD-06 ở attendance.ts);
// "–" = em chưa ghi danh vào lớp ở ngày đó, hoặc đã rời lớp (không đòi điểm danh, không đếm là thiếu).
import { computeAttendanceStats, isAttendanceStatus, type AttendanceStatus } from "@/lib/attendance";
import { vnDateKeyOf } from "@/lib/classSessions";
import { slugifyVi } from "@/lib/funnel";

export const CELL_SYMBOL: Record<AttendanceStatus, string> = { present: "✓", late: "M", excused: "P", absent: "V" };
export const NA_SYMBOL = "–";
export const GRID_LEGEND = "✓ Có mặt · M Muộn · P Có phép · V Vắng · (trống) Chưa điểm danh · – Không thuộc lớp ở ngày đó";
export const SUMMARY_HEADERS = ["Có mặt", "Muộn", "Có phép", "Vắng", "Chưa điểm danh", "Chuyên cần (%)"] as const;
/** Chỉ số hàng tiêu đề trong ma trận xuất (0-based): 2 dòng đầu đề, 1 dòng trống, rồi tiêu đề. */
export const HEADER_ROW_INDEX = 3;

export type GridCell = AttendanceStatus | "na" | null;
export interface GridStudent { id: string; name: string; enrolledAt: Date; active: boolean }
export interface GridSession { id: string; dateKey: string }
export interface GridRecord { sessionId: string; userId: string; status: string }
export interface AttendanceGridInput {
  courseName: string;
  /** YYYY-MM */
  month: string;
  sessions: readonly GridSession[];
  students: readonly GridStudent[];
  records: readonly GridRecord[];
}
export interface GridRow {
  id: string;
  name: string;
  cells: GridCell[];
  counts: { present: number; late: number; excused: number; absent: number; unmarked: number };
  /** Chuyên cần theo hệ số của attendance.ts (1 / 0,9 / 0,8 / 0,5), làm tròn %; null nếu chưa có bản ghi nào. */
  rate: number | null;
}
export interface AttendanceGrid {
  courseName: string;
  month: string;
  monthLabel: string;
  dates: { dateKey: string; label: string }[];
  rows: GridRow[];
}

// ── Tháng ───────────────────────────────────────────────────────────────────────

export const EXPORT_MIN_YEAR = 2020;
export const EXPORT_MAX_YEAR = 2100;
export type ParsedMonth = { ok: true; month: string } | { ok: false };

/** `YYYY-MM` hợp lệ; thiếu / rỗng → tháng hiện tại theo giờ VN; có nhưng sai định dạng → { ok: false }. */
export function parseExportMonth(raw: string | null | undefined, now: Date = new Date()): ParsedMonth {
  const s = raw === null || raw === undefined || raw === "" ? vnDateKeyOf(now).slice(0, 7) : raw;
  const m = /^(\d{4})-(\d{2})$/.exec(s);
  if (!m) return { ok: false };
  const y = Number(m[1]), mo = Number(m[2]);
  if (y < EXPORT_MIN_YEAR || y > EXPORT_MAX_YEAR || mo < 1 || mo > 12) return { ok: false };
  return { ok: true, month: s };
}

/** [đầu tháng, đầu tháng sau) theo 00:00 UTC — `AttendanceSession.date` lưu 00:00 UTC của NGÀY VN. */
export function monthRangeUtc(month: string): { start: Date; endExclusive: Date } {
  const y = Number(month.slice(0, 4)), mo = Number(month.slice(5, 7));
  return { start: new Date(Date.UTC(y, mo - 1, 1)), endExclusive: new Date(Date.UTC(y, mo, 1)) };
}

export const monthLabelOf = (month: string) => `Tháng ${month.slice(5, 7)}/${month.slice(0, 4)}`;
const ddmm = (dateKey: string) => `${dateKey.slice(8, 10)}/${dateKey.slice(5, 7)}`;

// ── Dựng lưới ───────────────────────────────────────────────────────────────────

export function buildAttendanceGrid(i: AttendanceGridInput): AttendanceGrid {
  const sessions = [...i.sessions].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  const dateOfSession = new Map(sessions.map(s => [s.id, s.dateKey]));
  // (học sinh, ngày) → trạng thái. Bản ghi của phiên ngoài tháng bị bỏ.
  const statusAt = new Map<string, string>();
  const withRecord = new Set<string>();
  for (const r of i.records) {
    const dk = dateOfSession.get(r.sessionId);
    if (!dk) continue;
    statusAt.set(`${r.userId}|${dk}`, r.status);
    withRecord.add(r.userId);
  }

  const students = i.students
    .filter(s => s.active || withRecord.has(s.id))
    .sort((a, b) => a.name.localeCompare(b.name, "vi") || a.id.localeCompare(b.id));

  const rows: GridRow[] = students.map(s => {
    const enrolledKey = vnDateKeyOf(s.enrolledAt);
    const counts = { present: 0, late: 0, excused: 0, absent: 0, unmarked: 0 };
    const own: { status: string }[] = [];
    const cells: GridCell[] = sessions.map(sess => {
      const st = statusAt.get(`${s.id}|${sess.dateKey}`);
      if (st !== undefined && isAttendanceStatus(st)) {
        counts[st] += 1;
        own.push({ status: st });
        return st;
      }
      // Chưa ghi danh vào lớp ở ngày đó, hoặc đã rời lớp: không đòi điểm danh.
      if (!s.active || enrolledKey > sess.dateKey) return "na";
      counts.unmarked += 1;
      return null;
    });
    const stats = computeAttendanceStats(own);
    return { id: s.id, name: s.name, cells, counts, rate: stats.ratio === null ? null : Math.round(stats.ratio * 100) };
  });

  return {
    courseName: i.courseName,
    month: i.month,
    monthLabel: monthLabelOf(i.month),
    dates: sessions.map(s => ({ dateKey: s.dateKey, label: ddmm(s.dateKey) })),
    rows,
  };
}

export const cellText = (c: GridCell): string => (c === null ? "" : c === "na" ? NA_SYMBOL : CELL_SYMBOL[c]);

/** Ma trận cho CSV / Excel: 2 dòng đề, 1 dòng trống, tiêu đề (HEADER_ROW_INDEX), mỗi học sinh một dòng, dòng trống, chú giải. */
export function gridToMatrix(g: AttendanceGrid): (string | number)[][] {
  const out: (string | number)[][] = [
    ["Điểm danh", g.courseName],
    ["Tháng", `${g.month.slice(5, 7)}/${g.month.slice(0, 4)}`],
    [],
    ["STT", "Học sinh", ...g.dates.map(d => d.label), ...SUMMARY_HEADERS],
  ];
  g.rows.forEach((r, idx) => {
    out.push([
      idx + 1, r.name, ...r.cells.map(cellText),
      r.counts.present, r.counts.late, r.counts.excused, r.counts.absent, r.counts.unmarked, r.rate === null ? "" : r.rate,
    ]);
  });
  out.push([], [GRID_LEGEND]);
  return out;
}

// ── Tên tệp / tên sheet ─────────────────────────────────────────────────────────

/** `diem-danh-<tên-lớp-không-dấu>-YYYY-MM.<đuôi>` — chỉ ký tự ASCII để đặt thẳng vào Content-Disposition. */
export function exportFileName(courseName: string, month: string, ext: "csv" | "xlsx"): string {
  return `diem-danh-${slugifyVi(courseName, 24) || "lop"}-${month}.${ext}`;
}
/** Tên sheet Excel: ≤ 31 ký tự, không chứa : \ / ? * [ ]. */
export const sheetNameOf = (month: string) => `Điểm danh ${month.slice(5, 7)}-${month.slice(0, 4)}`;
