// SCL-G-GS (QUYET-DINH §3.4, gia sư điện thoại) — các mảnh CÓ JS của Hộp việc dạy học: hàng chấm bài mở ra tại chỗ, nút hỏi lại trước khi gửi form, nút dock "Chấm N bài".
// Mọi thao tác ghi vẫn là form POST + 303 sẵn có (/api/tutor/so-diem/cham, /api/tutor/so-diem/duyet, /api/tutor/lop/<lớp>/yeu-cau/<mã>/…) kèm ve=hop-viec.
"use client";
import { useRef, useState, type ReactNode } from "react";
import { KinConfirm } from "@/components/kin/Confirm";
import { KinGradeStatus } from "@/components/kin/Status";
import { kinButtonClass } from "@/components/kin/buttonClass";
import { NopTepStudentFiles } from "@/components/student/nop-tep/NopTepBox";

const FIELD = "w-24 min-h-11 px-3 rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-trang)] text-base text-[var(--kin-chu-chinh)] focus-visible:outline-2 focus-visible:outline-[var(--kin-nhan-link)]";

/** Một bài chờ chấm: bấm hàng thì mở ra (tệp của học sinh tải khi mở, không tải trước cho cả danh sách) + ô điểm "Lưu điểm". */
export function ChamBaiHang({ submissionId, assignmentId, title, sub, maxPoints, fileUrl, kind }: {
  submissionId: string; assignmentId: string; title: string; sub: string; maxPoints: number; fileUrl: string; kind: string;
}) {
  const [open, setOpen] = useState(false);
  const scoreId = `diem-${submissionId}`;
  return (
    <details data-cham-hang onToggle={e => setOpen((e.currentTarget as HTMLDetailsElement).open)} className="group border-b border-[var(--kin-vien-nhat)]">
      <summary className="flex items-start justify-between gap-3 px-[var(--kin-kc-6)] py-[var(--kin-kc-4)] min-h-14 cursor-pointer list-none hover:bg-[var(--kin-nen-re-chuot)] [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block font-medium text-[length:var(--kin-co-body)] leading-6 text-[var(--kin-chu-chinh)] [overflow-wrap:anywhere]">{title}</span>
          <span className="block mt-0.5 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-phu)] [overflow-wrap:anywhere]">{sub}</span>
        </span>
        <span className="flex-shrink-0 self-center"><KinGradeStatus state="cho-cham" /></span>
      </summary>
      {open && (
        <div className="px-[var(--kin-kc-6)] pb-[var(--kin-kc-6)] space-y-4">
          {kind === "done" ? <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]">Học sinh bấm &quot;Em đã làm xong&quot;, không có tệp.</p>
            : fileUrl.startsWith("/api/media/nop-bai/") ? <NopTepStudentFiles assignmentId={assignmentId} submissionId={submissionId} />
            : fileUrl ? <a href={fileUrl} target="_blank" rel="noopener noreferrer" className={kinButtonClass("secondary")}>Mở bài nộp</a>
            : null}
          <form method="post" action="/api/tutor/so-diem/cham" className="flex flex-wrap items-end gap-3" data-cham>
            <input type="hidden" name="submissionId" value={submissionId} />
            <input type="hidden" name="ve" value="hop-viec" />
            <div>
              <label htmlFor={scoreId} className="block mb-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">Điểm (tối đa {maxPoints})</label>
              <input id={scoreId} name="score" inputMode="decimal" required autoComplete="off" className={FIELD} />
            </div>
            <button type="submit" className={kinButtonClass("secondary")}>Lưu điểm</button>
          </form>
        </div>
      )}
    </details>
  );
}

/** Nút gửi form có hỏi lại (KinConfirm thay window.confirm): dùng cho "Từ chối" xin vào lớp. Đặt BÊN TRONG <form>. */
export function HoiLaiGui({ label, title, message, confirmLabel, aria }: { label: string; title: string; message: ReactNode; confirmLabel: string; aria?: string }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  return (
    <>
      <button ref={ref} type="button" aria-label={aria} onClick={() => setOpen(true)} className={kinButtonClass("ghost")}>{label}</button>
      <KinConfirm open={open} tone="nguy-hiem" title={title} message={message} confirmLabel={confirmLabel} loading={sending} loadingLabel="Đang gửi…"
        onCancel={() => setOpen(false)} onConfirm={() => { setSending(true); ref.current?.form?.requestSubmit(); }} />
    </>
  );
}

/** Nút chính của Hộp việc điện thoại (dock đáy, ngay trên thanh dưới 60px của ModuleRail): mở bài chờ chấm đầu tiên và cuộn tới nó. */
export function ChamDock({ n }: { n: number }) {
  const go = () => {
    const d = document.querySelector<HTMLDetailsElement>("[data-hop-viec-dt] details[data-cham-hang]");
    if (!d) return;
    d.open = true;
    d.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    requestAnimationFrame(() => d.querySelector<HTMLElement>("summary")?.focus());
  };
  return (
    <div data-cham-dock className="md:hidden fixed inset-x-0 z-20 px-4 py-3 bg-[var(--kin-nen-trang)] border-t border-[var(--kin-vien-nhat)]" style={{ bottom: 60 }}>
      <button type="button" onClick={go} className={`${kinButtonClass("primary", "lg")} w-full`}>Chấm {n} bài đang chờ</button>
    </div>
  );
}
