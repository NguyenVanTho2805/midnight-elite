// Chờ tải hồ sơ một em (man-hoc-sinh §10): đầu trang + 4 hàng ghi danh (đủ 4 môn, T30).
import { ChoTai, Khoi } from "@/components/ui/trang-thai";

export default function Loading() {
  return (
    <ChoTai>
      <div className="mx-auto max-w-[1120px] px-4 py-4 sm:px-6 lg:px-8">
        <Khoi className="h-8 w-56" />
        <Khoi className="mt-2 h-5 w-40" />
        <div className="mt-6 rounded-[14px] border border-border">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex h-16 items-center gap-3 border-b border-border px-4 last:border-b-0">
              <Khoi className="h-5 w-12" />
              <Khoi className="h-6 w-[45%] rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </ChoTai>
  );
}
