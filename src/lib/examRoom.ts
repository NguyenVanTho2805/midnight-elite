// Phòng thi (Figma 27:2): các chữ hiện trên thanh Navy, đồng hồ, dòng tiến độ và ghi chú chân trang. Thuần để test.
// Mọi chữ lấy từ dữ liệu thật của đề (tên Phần, số câu, giờ còn lại) — không có chữ nào bịa ra cho đẹp.

/** "31:42". Âm / lỗi → "00:00". Quá 59 phút vẫn hiện số phút đầy đủ ("90:00") vì đề thi có thể dài hơn một giờ. */
export function formatClock(totalSec: number): string {
  const s = Number.isFinite(totalSec) ? Math.max(0, Math.floor(totalSec)) : 0;
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** Cho trình đọc màn hình: "31 phút 42 giây". */
export function spokenClock(totalSec: number): string {
  const s = Number.isFinite(totalSec) ? Math.max(0, Math.floor(totalSec)) : 0;
  const m = Math.floor(s / 60), r = s % 60;
  return m > 0 ? `${m} phút ${r} giây` : `${r} giây`;
}

/** Thông báo đọc to khi sắp hết giờ — chỉ đổi chữ ở hai mốc nên không đọc mỗi giây. "" = chưa tới mốc. */
export function lowTimeAnnouncement(remainingSec: number): string {
  if (remainingSec <= 0) return "";
  if (remainingSec <= 60) return "Còn dưới 1 phút.";
  if (remainingSec <= 300) return "Còn dưới 5 phút.";
  return "";
}

/**
 * Dòng đầu thanh Navy. Đề có chia Phần: dùng tên Phần; nếu tên chưa bắt đầu bằng "Phần" thì thêm "PHẦN n · " cho khớp Figma
 * ("PHẦN 1 · TOÁN VÀ XỬ LÝ SỐ LIỆU"). Đề không chia Phần: tên đề. Chữ hoa do CSS (uppercase), không đổi dữ liệu.
 */
export function roomHeading(opts: { examTitle: string; sectionLabel?: string | null; sectionIndex?: number }): string {
  const label = opts.sectionLabel?.trim();
  if (!label) return opts.examTitle.trim();
  if (/^ph[ầa]n\b/i.test(label)) return label;
  return `Phần ${(opts.sectionIndex ?? 0) + 1} · ${label}`;
}

/** "Câu 18 / 50". Số câu nằm ngoài khoảng được ép vào [1, total]. */
export function questionCounter(current: number, total: number): string {
  if (total <= 0) return "Chưa có câu hỏi";
  return `Câu ${Math.min(total, Math.max(1, Math.floor(current)))} / ${total}`;
}

/** "Đã trả lời 17 / 50 câu Phần 1" — trong đề chia Phần thì đếm theo Phần đang làm. */
export function progressLine(answered: number, total: number, sectionName?: string | null): string {
  return `Đã trả lời ${answered} / ${total} câu${sectionName ? ` ${sectionName}` : ""}`;
}

/** Ghi chú chân trang nói đúng điều sẽ xảy ra khi hết giờ (khớp cách phòng thi chạy thật). */
export function timeUpNote(opts: { sectionName?: string | null; nextSectionName?: string | null }): string {
  const cur = opts.sectionName?.trim();
  if (cur && opts.nextSectionName?.trim()) return `Hết giờ ${cur} thì ${cur} khoá lại, tự sang ${opts.nextSectionName.trim()}. Không sửa lại được.`;
  return "Hết giờ hệ thống tự nộp bài.";
}

/** Tên ngắn để nối vào câu ("Phần 1"): lấy hai từ đầu nếu tên bắt đầu bằng "Phần n", không thì dùng nguyên tên. */
export function shortSectionName(label: string | null | undefined, index: number): string | null {
  const t = label?.trim();
  if (!t) return null;
  const m = /^ph[ầa]n\s*(\d+|[ivx]+)/i.exec(t);
  if (m) return `Phần ${m[1]}`;
  return /^ph[ầa]n\b/i.test(t) ? t : `Phần ${index + 1}`;
}

/** Câu đang xem = câu cuối cùng có mép trên nằm trong 30% đầu khung cuộn. `tops` = khoảng cách mép trên mỗi câu so với mép trên khung. */
export function currentQuestionIndex(tops: number[], viewportHeight: number): number {
  if (tops.length === 0) return 0;
  const line = viewportHeight * 0.3;
  let cur = 0;
  for (let i = 0; i < tops.length; i++) if (tops[i] <= line) cur = i;
  return cur;
}
