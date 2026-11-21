// SCL-C: "Từ chối" xoá dòng điểm tự khai ⇒ hỏi lại bằng KinConfirm trước khi gửi form (form vẫn là POST + 303, nút này chỉ chặn trước).
"use client";
import { useRef, useState } from "react";
import { KinConfirm } from "@/components/kin/Confirm";
import { kinButtonClass } from "@/components/kin/buttonClass";

export function TuChoiButton() {
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  return (
    <>
      <button ref={ref} type="button" data-tu-choi onClick={() => setOpen(true)} className={kinButtonClass("danger")}>Từ chối</button>
      <KinConfirm
        open={open} tone="nguy-hiem" title="Từ chối điểm này?" confirmLabel="Từ chối" loading={sending} loadingLabel="Đang gửi…"
        message="Điểm học sinh tự khai sẽ bị xoá. Học sinh khai lại được và điểm mới lại chờ bạn duyệt."
        onCancel={() => setOpen(false)}
        onConfirm={() => { setSending(true); ref.current?.form?.requestSubmit(); }}
      />
    </>
  );
}
