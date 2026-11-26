import { ChoTai, Khoi } from "@/components/ui/trang-thai";

export default function Loading() {
  return (
    <ChoTai>
      <div className="mx-auto max-w-[1120px] px-4 py-4 sm:px-6 lg:px-8">
        <Khoi className="h-8 w-48" />
        <Khoi className="mt-4 h-[200px] rounded-[20px]" />
        <div className="mt-6 flex flex-wrap gap-2">{[0, 1, 2, 3].map((i) => <Khoi key={i} className="h-9 w-28 rounded-full" />)}</div>
        <div className="mt-4 grid gap-2">{[0, 1, 2].map((i) => <Khoi key={i} className="h-14" />)}</div>
      </div>
    </ChoTai>
  );
}
