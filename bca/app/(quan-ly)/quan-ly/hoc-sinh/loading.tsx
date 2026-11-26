// Chờ tải danh sách học sinh (man-hoc-sinh §10): ô tìm + chip lọc, rồi 8 hàng 84px (điện thoại) / 10 hàng 48px (máy tính).
import { ChoTai, Khoi } from "@/components/ui/trang-thai";

export default function Loading() {
  return (
    <ChoTai>
      <div className="mx-auto max-w-[1120px] px-4 py-4 sm:px-6 lg:px-8">
        <Khoi className="h-8 w-40" />
        <Khoi className="mt-4 h-12" />
        <div className="mt-3 flex flex-wrap gap-2">{[0, 1, 2, 3].map((i) => <Khoi key={i} className="h-11 w-32 rounded-full" />)}</div>
        <div className="mt-4 rounded-[14px] border border-border lg:hidden">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="grid h-[84px] content-center gap-2 border-b border-border px-4 last:border-b-0">
              <Khoi className="h-5 w-[55%]" />
              <Khoi className="h-4 w-[35%]" />
              <Khoi className="h-5 w-[70%] rounded-full" />
            </div>
          ))}
        </div>
        <div className="mt-4 hidden rounded-[14px] border border-border lg:block">
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="flex h-12 items-center gap-4 border-b border-border px-4 last:border-b-0">
              <Khoi className="h-5 w-[24%]" />
              <Khoi className="h-5 w-[28%] rounded-full" />
              <Khoi className="h-5 w-[14%]" />
              <Khoi className="h-5 w-[8%]" />
              <Khoi className="h-5 w-[12%]" />
            </div>
          ))}
        </div>
      </div>
    </ChoTai>
  );
}
