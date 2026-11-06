// Con người → Gia sư (BU-08 mục 5.4): LỊCH SỬ đơn gia sư, chỉ đọc. Việc duyệt / từ chối nằm ở Hàng chờ (/admin/kiem-duyet?loai=gia-su),
// nên trang này KHÔNG có nút Duyệt hay Từ chối, kể cả với đơn đang chờ (chỉ có liên kết "Mở trong Hàng chờ").
// Bảng NN/g: cột đầu là định danh (tên gia sư); ≤ 2 nút mỗi hàng; chi tiết mở ở panel bên (không hộp thoại). Dữ liệu tối thiểu: không email, không số điện thoại.
"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { KinButton, kinButtonClass, KinEmptyState, KinStatus, KinTabs } from "@/components/kin";
import PermissionGuard from "@/components/PermissionGuard";
import { PERMISSIONS } from "@/contexts/AuthContext";
import { QueueErrorStrip, QueueSkeleton } from "@/components/admin/queue/shared";

type Status = "approved" | "rejected" | "pending";
interface App { id: string; name: string; city: string | null; subjects: string[]; bio: string | null; emailVerified: boolean; tutorAppliedAt: string | null; tutorVerifiedAt: string | null; tutorRejectedAt: string | null; tutorRejectReason: string | null }

const LABEL: Record<Status, string> = { approved: "Đã duyệt", rejected: "Đã từ chối", pending: "Đang chờ" };
const day = (d: string | null) => (d ? new Date(d).toLocaleDateString("vi-VN") : "—");
const dateOf = (a: App, s: Status) => (s === "approved" ? a.tutorVerifiedAt : s === "rejected" ? a.tutorRejectedAt : a.tutorAppliedAt);

export default function GiaSuPage() {
  return <PermissionGuard required={PERMISSIONS.MANAGE_TUTORS}><Body /></PermissionGuard>;
}

function Body() {
  const [status, setStatus] = useState<Status>("approved");
  const [items, setItems] = useState<App[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const seq = useRef(0);
  const opener = useRef<string | null>(null);

  const load = useCallback(async (s: Status) => {
    await Promise.resolve();
    const my = ++seq.current;
    setItems(null); setFailed(false); setOpenId(null);
    try {
      const r = await fetch(`/api/admin/tutor-applications?status=${s}`, { credentials: "same-origin", cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      const d = await r.json();
      if (my === seq.current) setItems(Array.isArray(d.applications) ? d.applications : []);
    } catch { if (my === seq.current) setFailed(true); }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(status); }, [load, status]);

  const open = items?.find(i => i.id === openId) ?? null;
  const close = useCallback(() => {
    setOpenId(null);
    const id = opener.current;
    if (id) requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-row-open="${CSS.escape(id)}"]`)?.focus());
  }, []);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [open, close]);

  return (
    <div className={`mx-auto flex max-w-5xl flex-col gap-4 ${open ? "xl:pr-[436px]" : ""}`}>
      <header>
        <h1 className="text-[28px] font-medium leading-9 text-[var(--kin-chu-chinh)]">Gia sư</h1>
        <p className="mt-1 max-w-[68ch] text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">
          Lịch sử đơn xin làm gia sư. Đây là nơi xem lại, không phải nơi duyệt đơn mới.
        </p>
      </header>

      <KinTabs label="Trạng thái đơn gia sư" value={status} onChange={setStatus} tabs={(Object.keys(LABEL) as Status[]).map(s => ({ key: s, label: LABEL[s] }))} />
      <p data-dang-loc className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]">Đang lọc: <b className="font-semibold text-[var(--kin-chu-chinh)]">{LABEL[status]}</b></p>

      {failed && <QueueErrorStrip message="Chưa tải được danh sách gia sư." onRetry={() => void load(status)} />}
      {items === null && !failed && <QueueSkeleton rows={4} />}
      {items !== null && items.length === 0 && (
        <KinEmptyState title={`Chưa có đơn ${LABEL[status].toLowerCase()}`} action={status !== "pending" ? <KinButton variant="secondary" onClick={() => setStatus("pending")}>Xem đơn đang chờ</KinButton> : undefined}>
          {status === "pending" ? "Khi có người đăng ký làm gia sư, đơn sẽ hiện ở Hàng chờ để bạn duyệt." : "Đơn sẽ hiện ở đây sau khi được xử lý ở Hàng chờ."}
        </KinEmptyState>
      )}

      {items !== null && items.length > 0 && (
        <div className="overflow-x-auto rounded-[var(--kin-bo-the)] border border-[var(--kin-vien-thuong)]">
          <table data-gia-su-table className="w-full border-collapse text-left text-[length:var(--kin-co-goc)]">
            <thead>
              <tr className="text-[length:var(--kin-co-caption)] uppercase tracking-wide text-[var(--kin-chu-mo)]">
                {["Gia sư", "Môn · thành phố", "Trạng thái", "Ngày", "Hành động"].map(h => <th key={h} scope="col" className="border-b border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-bang)] px-3 py-2 font-semibold">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {items.map(a => (
                <tr key={a.id} className="border-b border-[var(--kin-vien-nhat)] last:border-b-0">
                  <th scope="row" className="px-3 py-3 font-semibold text-[var(--kin-chu-chinh)]">{a.name}</th>
                  <td className="px-3 py-3 text-[var(--kin-chu-phu)]">{[a.subjects.join(", ") || "Chưa ghi môn", a.city].filter(Boolean).join(" · ")}</td>
                  <td className="px-3 py-3">
                    <KinStatus tone={status === "approved" ? "xong" : status === "rejected" ? "loi" : "cho"}>{status === "pending" && !a.emailVerified ? "Chưa xác thực email" : LABEL[status]}</KinStatus>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-[var(--kin-chu-phu)]">{day(dateOf(a, status))}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <KinButton variant="secondary" data-row-open={a.id} aria-label={`Xem: ${a.name}`} onClick={() => { opener.current = a.id; setOpenId(a.id); }}>Xem</KinButton>
                      {status === "pending" && <Link href="/admin/kiem-duyet?loai=gia-su" className={kinButtonClass("secondary")}>Mở trong Hàng chờ</Link>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <aside data-side-panel aria-label={`Chi tiết: ${open.name}`}
          className="fixed inset-x-0 bottom-[60px] top-0 z-40 flex flex-col border-l border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-trang)] shadow-[var(--kin-bong-hop)] md:bottom-0 md:left-auto md:right-0 md:top-[var(--kin-top,0px)] md:w-[420px]">
          <div className="flex items-start gap-2 border-b border-[var(--kin-vien-thuong)] px-4 py-3">
            <div className="min-w-0 flex-1">
              <h2 tabIndex={-1} ref={el => el?.focus()} className="text-[length:var(--kin-co-body)] font-semibold text-[var(--kin-chu-chinh)] outline-none">{open.name}</h2>
              <p className="mt-1 text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)]">{`${LABEL[status]} · nộp đơn ${day(open.tutorAppliedAt)}`}</p>
            </div>
            <button type="button" onClick={close} aria-label="Đóng panel" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--kin-bo-md)] text-[var(--kin-chu-phu)] hover:bg-[var(--kin-nen-re-chuot)]">✕</button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 text-[length:var(--kin-co-goc)] leading-6 text-[var(--kin-chu-chinh)]">
            <h3 className="text-[length:var(--kin-co-small)] font-semibold text-[var(--kin-chu-mo)]">Môn dạy</h3>
            <p className="mb-3">{open.subjects.join(", ") || "Chưa ghi môn dạy."}</p>
            <h3 className="text-[length:var(--kin-co-small)] font-semibold text-[var(--kin-chu-mo)]">Giới thiệu</h3>
            <p className="mb-3 whitespace-pre-wrap break-words">{open.bio?.trim() || "Người nộp đơn chưa viết giới thiệu."}</p>
            {status === "rejected" && open.tutorRejectReason && (<><h3 className="text-[length:var(--kin-co-small)] font-semibold text-[var(--kin-chu-mo)]">Lý do từ chối</h3><p className="whitespace-pre-wrap break-words">{open.tutorRejectReason}</p></>)}
          </div>
          <div className="border-t border-[var(--kin-vien-thuong)] px-4 py-3"><KinButton variant="ghost" onClick={close}>Đóng</KinButton></div>
        </aside>
      )}
    </div>
  );
}
