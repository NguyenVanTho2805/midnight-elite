// PH-07 — trang THEO DÕI yêu cầu tìm gia sư của khách (vào bằng mã trong link). Hai người nói khác nhau về cùng một việc: ở đây là giọng phụ huynh.
// Có nút RÚT yêu cầu (xoá số liên hệ). Đủ trạng thái đang tải / lỗi (Thử lại) / không tìm thấy.
"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { kinButtonClass } from "@/components/kin/Button";
import { KinCallout } from "@/components/kin/Callout";
import { KinStatus } from "@/components/kin/Status";
import { useKinConfirm } from "@/components/kin/useConfirm";
import { MODE_LABEL, type TeachingMode } from "@/lib/tutorArea";
import { jfetch, fmtVnDate } from "@/components/tutor/studentUi";

interface Data {
  status: "new" | "accepted" | "declined" | "closed"; title: string; detail: string; canWithdraw: boolean;
  request: { level: string; subject: string; mode: string | null; slots: string | null; createdAt: string; decidedAt: string | null };
  tutor: { id: string; name: string } | null;
}
const TONE = { new: "cho", accepted: "xong", declined: "mo", closed: "mo" } as const;

export default function YeuCauTheoDoi({ token }: { token: string }) {
  const { ask, dialog } = useKinConfirm();
  const [d, setD] = useState<Data | null>(null);
  const [state, setState] = useState<"load" | "ok" | "err" | "404">("load");
  const [msg, setMsg] = useState("");
  const fetchIt = useCallback(() => jfetch(`/api/yeu-cau/${token}`), [token]);
  const apply = useCallback((r: Awaited<ReturnType<typeof jfetch>>) => {
    if (r.status === 404) { setState("404"); return; }
    if (!r.ok) { setState("err"); return; }
    setD(r.json); setState("ok");
  }, []);
  const reload = useCallback(() => { fetchIt().then(apply); }, [fetchIt, apply]);
  const retry = useCallback(() => { setState("load"); reload(); }, [reload]);
  useEffect(() => { let alive = true; fetchIt().then(r => { if (alive) apply(r); }); return () => { alive = false; }; }, [fetchIt, apply]);

  async function withdraw() {
    const ok = await ask({ title: "Rút yêu cầu này?", message: "Yêu cầu được đóng và số liên hệ của anh/chị bị xoá khỏi yêu cầu. Gia sư sẽ không liên hệ nữa. Không hoàn tác được; anh/chị có thể gửi yêu cầu mới.", confirmLabel: "Rút yêu cầu" });
    if (!ok) return;
    const r = await jfetch(`/api/yeu-cau/${token}/rut`, { method: "POST" });
    if (r.ok) { setMsg("Đã rút yêu cầu và xoá số liên hệ."); reload(); } else setMsg(r.json?.error ?? "Chưa rút được, thử lại nhé.");
  }

  if (state === "load") return <p aria-busy="true" className="py-10 text-[var(--kin-chu-mo)]">Đang tải trạng thái yêu cầu…</p>;
  if (state === "404") return (
    <div className="py-10 space-y-3"><h2 className="text-[length:var(--kin-co-tieu-de)] font-medium">Không tìm thấy yêu cầu</h2>
      <p className="text-[var(--kin-chu-mo)]">Link có thể sai hoặc yêu cầu không còn. Anh/chị có thể xem gia sư khác trên KiN.</p>
      <Link href="/giang-vien" className={kinButtonClass("secondary")}>Xem danh sách gia sư</Link></div>
  );
  if (state === "err" || !d) return (
    <div role="alert" className="py-10 space-y-3"><p className="text-[var(--kin-tt-chu-loi)]">Không tải được trạng thái yêu cầu.</p>
      <button type="button" onClick={retry} className={kinButtonClass("secondary")}>Thử lại</button></div>
  );
  const r = d.request;
  return (
    <div className="max-w-[640px] space-y-5">
      {dialog}
      <p data-track-status><KinStatus tone={TONE[d.status]}>{d.title}</KinStatus></p>
      <KinCallout title={d.title}>{d.detail}</KinCallout>
      {msg && <p role="status" className="text-[var(--kin-tt-chu-xong)]">{msg}</p>}
      <section aria-label="Yêu cầu đã gửi">
        <h2 className="text-[length:var(--kin-co-tieu-de)] font-medium">Anh/chị đã gửi</h2>
        <dl className="mt-2 grid gap-1 text-[length:var(--kin-co-goc)]">
          {d.tutor && <div className="flex gap-2"><dt className="w-36 text-[var(--kin-chu-mo)]">Gửi tới</dt><dd><Link href={`/mentor/${d.tutor.id}`} className="inline-flex items-center min-h-11 underline text-[var(--kin-nhan-link)]">{d.tutor.name}</Link></dd></div>}
          <div className="flex gap-2"><dt className="w-36 text-[var(--kin-chu-mo)]">Cấp học</dt><dd>{r.level}</dd></div>
          <div className="flex gap-2"><dt className="w-36 text-[var(--kin-chu-mo)]">Môn</dt><dd className="break-words min-w-0">{r.subject}</dd></div>
          {r.mode && <div className="flex gap-2"><dt className="w-36 text-[var(--kin-chu-mo)]">Hình thức</dt><dd>{MODE_LABEL[r.mode as TeachingMode] ?? r.mode}</dd></div>}
          {r.slots && <div className="flex gap-2"><dt className="w-36 text-[var(--kin-chu-mo)]">Khung giờ</dt><dd className="break-words min-w-0">{r.slots}</dd></div>}
          <div className="flex gap-2"><dt className="w-36 text-[var(--kin-chu-mo)]">Gửi lúc</dt><dd>{fmtVnDate(r.createdAt)}</dd></div>
        </dl>
      </section>
      <div className="flex flex-wrap gap-3">
        {d.canWithdraw && <button type="button" data-withdraw onClick={withdraw} className={kinButtonClass("secondary")}>Rút yêu cầu</button>}
        {d.tutor && <Link href={`/mentor/${d.tutor.id}`} className={kinButtonClass("ghost")}>Xem hồ sơ gia sư</Link>}
      </div>
      <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Anh/chị tự thoả thuận lịch học và học phí trực tiếp với gia sư. Không chuyển khoản trước buổi học thử. KiN không thu phí kết nối.</p>
    </div>
  );
}
