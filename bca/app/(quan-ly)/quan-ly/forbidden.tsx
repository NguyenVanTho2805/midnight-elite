// Giao diện "Không có quyền" của khu quản lý (forbidden() trong components/khung/nguoi.ts). Trang đã stream (có loading.tsx)
// nên mã HTTP vẫn là 200 kèm noindex; route API mới trả 403 thật. Nằm trong khung (thanh bên, thanh dưới).
import Link from "next/link";
import { nutPhu } from "@/components/ui/nut";

export default function KhongCoQuyen() {
  return (
    <div className="mx-auto max-w-[1120px] px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-[22px] font-extrabold leading-tight text-balance lg:text-[28px]">Không có quyền</h1>
      <p className="mt-2 max-w-prose text-text-2">Mục này không thuộc quyền của bạn. Giáo viên chỉ xem được học sinh, buổi học và điểm danh của môn mình dạy; đơn đăng ký chỉ chủ lớp xem.</p>
      <Link href="/quan-ly" className={`${nutPhu} mt-4`}>Về Hôm nay</Link>
    </div>
  );
}
