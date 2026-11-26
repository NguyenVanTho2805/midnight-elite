"use client";
// Lỗi tải: nói cách sửa + nút Thử lại (khung-quan-ly §4).
import { DaiLoi } from "@/components/ui/trang-thai";
import { nutPhu } from "@/components/ui/nut";

export default function Loi({ unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return (
    <div className="mx-auto max-w-[1120px] px-4 py-6 sm:px-6 lg:px-8">
      <DaiLoi thuLai={<button type="button" className={nutPhu} onClick={() => unstable_retry()}>Thử lại</button>}>
        Không tải được trang này. Kiểm tra mạng rồi bấm Thử lại.
      </DaiLoi>
    </div>
  );
}
