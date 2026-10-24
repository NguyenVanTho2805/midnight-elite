// Khung dùng chung (chủ dự án 24/10/2026: "một số cái quan trọng đóng thêm khung cho dễ nhìn"). MỘT kiểu khung cho cả KiN; kiểu dáng nằm ở
// .kin-khung trong src/app/kin-site.css, chỉ dùng token --kin-*. Dùng CHỌN LỌC cho khối quan trọng (mỗi màn vài khối); danh sách dài (hàng việc, bảng, lịch)
// vẫn là đường kẻ mảnh — nếu bọc thì bọc CẢ danh sách với `flush`. Không đặt khung trong khung.
//   mac-dinh : viền nhạt + nền mặt + bo --kin-bo-the
//   nhan     : viền màu nhấn nhạt + nền nhấn nhạt (khối chính của màn: "Buổi học sắp tới", ô tóm tắt)
//   canh-bao : nền + viền cam nhạt (lưu ý quan trọng; luôn kèm chữ)
//   loi      : nền + viền đỏ nhạt
//   khoa-pro : viền nét đứt, nền trong (tính năng Pro đang khoá; chữ vẫn đủ tương phản, KHÔNG làm mờ chữ)
import type { ElementType, ReactNode } from "react";

export type KinPanelVariant = "mac-dinh" | "nhan" | "canh-bao" | "loi" | "khoa-pro";

export function KinPanel({ variant = "mac-dinh", flush = false, as: Tag = "div", className = "", children, ...rest }: {
  variant?: KinPanelVariant;
  /** Không đệm: dùng khi bọc cả danh sách/bảng (hàng tự có đệm và kẻ riêng; khung cắt góc bo). */
  flush?: boolean;
  as?: ElementType;
  className?: string;
  children?: ReactNode;
} & Record<string, unknown>) {
  return (
    <Tag data-kin-panel={variant} data-flush={flush ? "" : undefined} className={`kin-khung min-w-0 ${className}`} {...rest}>
      {children}
    </Tag>
  );
}
