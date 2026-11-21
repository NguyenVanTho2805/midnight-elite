// SCL-H (P2-31): MỘT lần gọi /api/student/viec-cua-toi cho cả vỏ (số việc trên thanh module) lẫn trang (việc + lịch). Trước đây mở "Việc của tôi" tính lịch 3 lần:
// vỏ ?badge=1, trang /api/student/viec-cua-toi, trang /api/schedule. Gọi trùng lúc (vỏ + trang cùng lúc mở, cùng sự kiện focus) dùng chung một yêu cầu đang chạy.
// shortcut: chỉ gộp yêu cầu ĐANG CHẠY, không nhớ kết quả — gọi lại sau khi xong luôn hỏi máy chủ mới.
import type { StudentTodoItem } from "@/lib/studentTodo";
import type { ScheduleEvent } from "@/lib/studentSchedule";

export interface StudentWorkResp { items?: StudentTodoItem[]; events?: ScheduleEvent[]; badge?: number }

let inflight: Promise<StudentWorkResp> | null = null;

export function fetchStudentWork(): Promise<StudentWorkResp> {
  inflight ??= fetch("/api/student/viec-cua-toi", { credentials: "same-origin", cache: "no-store" })
    .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<StudentWorkResp>; })
    .finally(() => { inflight = null; });
  return inflight;
}
