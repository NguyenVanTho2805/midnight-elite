// Chờ tải màn Buổi học (man-buoi-hoc §10): 6 hàng 72px (điện thoại) / 8 hàng 48px + khung chi tiết xám (máy tính).
import { ChoTai, Khoi } from "@/components/ui/trang-thai";

export default function Loading() {
  return (
    <ChoTai>
      <div className="mx-auto max-w-[1120px] px-4 py-4 sm:px-6 lg:px-8">
        <Khoi className="h-8 w-40" />
        <div className="mt-4 grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <div className="flex flex-wrap gap-2">{[0, 1, 2, 3].map((i) => <Khoi key={i} className="h-11 w-24 rounded-full" />)}</div>
            <Khoi className="mt-4 h-5 w-32" />
            <div className="mt-2 rounded-[14px] border border-border lg:hidden">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="flex h-[72px] items-center gap-3 border-b border-border px-3 last:border-b-0">
                  <Khoi className="size-12 rounded-[10px]" />
                  <div className="grid flex-1 gap-2"><Khoi className="h-5 w-[60%]" /><Khoi className="h-4 w-[40%]" /></div>
                </div>
              ))}
            </div>
            <div className="mt-2 hidden rounded-[14px] border border-border lg:block">
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="flex h-12 items-center gap-3 border-b border-border px-3 last:border-b-0">
                  <Khoi className="h-8 w-10 rounded-[10px]" />
                  <Khoi className="h-5 w-[50%]" />
                </div>
              ))}
            </div>
          </div>
          <Khoi className="hidden h-[420px] rounded-[20px] lg:col-span-5 lg:block" />
        </div>
      </div>
    </ChoTai>
  );
}
