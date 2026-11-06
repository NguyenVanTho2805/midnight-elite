// BU-02-PHẲNG — hai chip của một hàng mục: KIỂU (Video · Tài liệu · Bài tập · Buổi live · Kiểm tra) và TRẠNG THÁI (Nháp · Đã đăng · Ẩn · Đang tải).
// Trạng thái luôn có CHỮ (KinStatus: chấm chỉ để trang trí). "Đang tải" chỉ có ở trình duyệt khi tệp đang lên, không phải trạng thái lưu.
// Chip trạng thái của bài KIỂM TRA (Sắp mở / Đang mở / Đã đóng) là của chính Exam, dựng ở GiaoTrinh bằng KinStatus, không đi qua đây.
import { KinStatus, type StatusTone } from "@/components/kin/Status";
import type { ItemKind } from "@/lib/giaoTrinh";
import type { LessonStatus } from "@/lib/lessonStatus";

export const KIND_LABEL: Record<ItemKind, string> = { video: "Video", document: "Tài liệu", assignment: "Bài tập", live: "Buổi live", exam: "Kiểm tra" };

export const STATUS_LABEL: Record<LessonStatus | "uploading", string> = { draft: "Nháp", published: "Đã đăng", hidden: "Ẩn", uploading: "Đang tải" };
const STATUS_TONE: Record<LessonStatus | "uploading", StatusTone> = { draft: "cho", published: "xong", hidden: "mo", uploading: "cho" };

export function ChipTrangThai({ status, className = "" }: { status: LessonStatus | "uploading"; className?: string }) {
  return <span data-gt-chip-trang-thai={status}><KinStatus tone={STATUS_TONE[status]} className={className}>{STATUS_LABEL[status]}</KinStatus></span>;
}

export function ChipKieu({ kind }: { kind: ItemKind }) {
  return (
    <span data-gt-chip-kieu={kind}
      className="inline-flex items-center min-h-6 px-2 rounded-[var(--kin-bo-tron)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-bang)] text-[length:var(--kin-co-caption)] leading-5 text-[var(--kin-chu-phu)] whitespace-nowrap">
      {KIND_LABEL[kind]}
    </span>
  );
}
