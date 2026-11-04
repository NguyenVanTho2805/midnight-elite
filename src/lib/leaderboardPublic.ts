// Bảng xếp hạng thi thử (GET /api/leaderboard) — hình dạng dữ liệu trả cho TỪNG LOẠI người xem. THUẦN: không DB. Test: tools/local-e2e/t-leaderboard-lib.ts.
//
// Quyết định của Thọ (04/11/2026, "1B"): bảng xếp hạng thi thử vẫn công khai nhưng KHÁCH chỉ thấy tên đã che (maskName), không trường, không mã học sinh, tối đa 10 dòng.
// Người đã đăng nhập thấy như cũ (tên đầy đủ, trường, tối đa 20 dòng). Bảng vinh danh (/api/honor-leaderboard, có tên + trường + GPA + huy hiệu của MỌI học sinh ghi danh) bắt đăng nhập.
import { maskName } from "@/lib/lookupPrivacy";

export const GUEST_LEADERBOARD_LIMIT = 10;
export const MEMBER_LEADERBOARD_LIMIT = 20;

export interface LeaderboardRow { userId: string; name: string; school: string | null; best: number; avg: number; count: number }
/** Dòng trả cho khách: KHÔNG có chỗ cho userId / school (kiểu dữ liệu không cho phép lỡ tay thêm vào). */
export interface GuestLeaderboardRow { name: string; best: number; avg: number; count: number }

/** `rows` đã xếp từ cao xuống thấp. Trả bản cắt + che phù hợp người xem. */
export function shapeLeaderboard(rows: LeaderboardRow[], isMember: boolean): LeaderboardRow[] | GuestLeaderboardRow[] {
  if (isMember) return rows.slice(0, MEMBER_LEADERBOARD_LIMIT);
  return rows.slice(0, GUEST_LEADERBOARD_LIMIT).map(r => ({ name: maskName(r.name), best: r.best, avg: r.avg, count: r.count }));
}
