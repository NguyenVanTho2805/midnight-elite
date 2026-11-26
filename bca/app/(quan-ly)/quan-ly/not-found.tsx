import Link from "next/link";
import { nutPhu } from "@/components/ui/nut";

export default function KhongCo() {
  return (
    <div className="mx-auto max-w-[1120px] px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-[22px] font-extrabold lg:text-[28px]">Không tìm thấy</h1>
      <p className="mt-2 text-text-2">Mục này không có hoặc bạn không xem được.</p>
      <Link href="/quan-ly" className={`${nutPhu} mt-4`}>Về Hôm nay</Link>
    </div>
  );
}
