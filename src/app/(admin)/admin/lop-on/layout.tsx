// Lớp ôn (KiN lớp bước 6): chỉ thêm vùng báo "đã làm xong + Hoàn tác" dùng chung. Cửa vào (cờ, vai) vẫn do TỪNG TRANG gọi chuLop() — layout không chạy lại mỗi request.
import type { ReactNode } from "react";
import { LopThongBao } from "@/components/lop/goi";

export default function LopOnLayout({ children }: { children: ReactNode }) {
  return <>{children}<LopThongBao /></>;
}
