// Phần THUẦN chỉ dành cho giao diện phòng thi (nhãn giờ/ngày, khoá lưu trữ). Logic dùng chung với bài test nằm ở `@/lib/examRoomLib` (hàng đợi lưu, ô lưới,
// chế độ xem, "Còn N ngày", sắp xếp đề); ở đây KHÔNG nhân đôi chúng.
import type { AssignmentState } from "@/lib/examRoomApi";

export const queueStorageKey = (attemptId: string) => `kin.room.queue.${attemptId}`;
export const flagStorageKey = (attemptId: string) => `kin.room.flag.${attemptId}`;
export const VIEW_STORAGE_KEY = "kin.room.view";

// ── Ngày giờ Việt Nam (tính tay, không phụ thuộc múi giờ trình duyệt) ──
const VN = 7 * 3_600_000;
const p2 = (n: number) => String(n).padStart(2, "0");
const vn = (iso: string) => new Date(Date.parse(iso) + VN);
export const hm = (iso: string) => { const d = vn(iso); return `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`; };
export const dm = (iso: string) => { const d = vn(iso); return `${p2(d.getUTCDate())}/${p2(d.getUTCMonth() + 1)}`; };
const dayNo = (iso: string) => Math.floor((Date.parse(iso) + VN) / 86_400_000);

/** "Đáp án mở lúc 21:05 hôm nay" / "…ngày 05/11". */
export function answersOpenLabel(openIso: string, serverNowIso: string): string {
  return `Đáp án mở lúc ${hm(openIso)} ${dayNo(openIso) === dayNo(serverNowIso) ? "hôm nay" : `ngày ${dm(openIso)}`}`;
}
/** "Mở 19:00 – 19:45 ngày 05/11" (khung giờ của bài kiểm tra). */
export function windowLabel(opensAt: string, closesAt: string | null): string {
  return `Mở ${hm(opensAt)}${closesAt ? ` – ${hm(closesAt)}` : ""} ngày ${dm(opensAt)}`;
}
export function countdownLabel(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h > 0 ? `${h} giờ ${m} phút` : m > 0 ? `${m} phút ${p2(r)} giây` : `${r} giây`;
}

export const ASSIGNMENT_STATE_LABEL: Record<AssignmentState, string> = {
  "chua-mo": "Chưa mở", "dang-mo": "Đang mở", "da-dong": "Đã đóng", "dang-lam": "Đang làm dở", "cho-cong-bo": "Chờ công bố", "da-lam": "Đã làm",
};
export const ASSIGNMENT_ACTION: Record<AssignmentState, string | null> = {
  "chua-mo": null, "dang-mo": "Vào làm", "da-dong": null, "dang-lam": "Tiếp tục", "cho-cong-bo": "Xem kết quả", "da-lam": "Xem kết quả",
};
