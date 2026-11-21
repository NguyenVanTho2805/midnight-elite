// SCL-G-SD — hộp "bài nộp" của sổ điểm: nội dung do trang máy chủ dựng (form POST + 303 như cũ), đây chỉ là khung KinDialog luôn mở.
// Đóng (nút Đóng, Escape, bấm nền) = về lại sổ điểm không có ?mo=; "Bài tiếp" = sang ô kế.
// §4.2 #7: ô điểm đã gõ mà chưa lưu thì đóng / sang bài kế phải hỏi lại (KinConfirm), không bỏ số đi lặng lẽ.
"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, type MouseEvent, type ReactNode } from "react";
import { KinDialog } from "@/components/kin/Dialog";
import { useKinConfirm } from "@/components/kin/useConfirm";
import { kinButtonClass } from "@/components/kin/buttonClass";

export function SoDiemHop({ title, closeHref, nextHref, children }: { title: string; closeHref: string; nextHref?: string; children: ReactNode }) {
  const router = useRouter();
  const body = useRef<HTMLDivElement>(null);
  const { ask, dialog } = useKinConfirm();
  const dirty = () => [...(body.current?.querySelectorAll<HTMLInputElement>("input[name=score]") ?? [])].some(i => i.value.trim() !== i.defaultValue.trim());
  const leave = async (href: string, question: string) => {
    if (dirty() && !(await ask({ title: question, message: "Số bạn vừa gõ chưa được lưu và sẽ mất.", confirmLabel: "Vẫn rời đi", cancelLabel: "Ở lại", tone: "thuong" }))) return;
    router.push(href, { scroll: false });
  };
  const onNext = (e: MouseEvent) => { if (dirty()) { e.preventDefault(); void leave(nextHref!, "Điểm chưa lưu, vẫn sang bài tiếp?"); } };
  return (
    <>
      <KinDialog open size="lg" title={title} onClose={() => void leave(closeHref, "Điểm chưa lưu, vẫn đóng?")}
        footer={nextHref ? <Link href={nextHref} scroll={false} onClick={onNext} data-so-diem-bai-tiep className={kinButtonClass("secondary")}>Bài tiếp</Link> : undefined}>
        <div ref={body}>{children}</div>
      </KinDialog>
      {dialog}
    </>
  );
}
