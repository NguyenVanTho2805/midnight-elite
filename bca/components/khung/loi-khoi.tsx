"use client";
// Ranh giới lỗi cho từng khối trong trang (man-hom-nay §10 "Lỗi một khối"): chỉ khối hỏng báo lỗi + Thử lại,
// khối khác (nhất là thẻ Điểm danh) vẫn dùng được. unstable_catchError: Thử lại tải lại cả Server Component con.
import { unstable_catchError, type ErrorInfo } from "next/error";
import { DaiLoi } from "../ui/trang-thai";
import { nutPhu } from "../ui/nut";

function BaoLoi({ ten }: { ten: string }, { unstable_retry }: ErrorInfo) {
  return (
    <DaiLoi thuLai={<button type="button" className={nutPhu} onClick={() => unstable_retry()}>Thử lại</button>}>
      Không tải được {ten}. Kiểm tra mạng rồi bấm Thử lại.
    </DaiLoi>
  );
}

export default unstable_catchError(BaoLoi);
