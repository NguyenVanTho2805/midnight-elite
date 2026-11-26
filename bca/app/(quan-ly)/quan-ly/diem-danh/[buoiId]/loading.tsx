import { ChoTai, Khoi } from "@/components/ui/trang-thai";

export default function Loading() {
  return (
    <ChoTai>
      <div className="mx-auto max-w-[1120px] px-4 py-3 sm:px-6 lg:px-8">
        <Khoi className="h-10 w-56" />
        <div className="mt-3 flex gap-2">{[0, 1, 2, 3].map((i) => <Khoi key={i} className="h-11 w-24 rounded-full" />)}</div>
        <div className="mt-3 grid gap-2">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex h-[72px] items-center gap-3 border-b border-border">
              <Khoi className="h-5 w-[60%]" />
              <span className="flex-1" />
              {[0, 1, 2].map((j) => <Khoi key={j} className="h-12 w-16 rounded-[10px]" />)}
            </div>
          ))}
        </div>
      </div>
    </ChoTai>
  );
}
