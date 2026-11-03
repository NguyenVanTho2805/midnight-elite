// Đánh giá khoá học — LỊCH SỬ + xoá (BU-08). Đánh giá đang chờ duyệt/từ chối nằm ở Hàng chờ (/admin/kiem-duyet?loai=danh-gia), không còn ở đây.
// Bảng: cột đầu là định danh (khoá học · người viết rút gọn); ≤ 1 nút mỗi hàng (Xoá, xác nhận NỘI DÒNG — không hộp thoại); học sinh chỉ hiện tên rút gọn, không email.
"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { KinButton, KinCallout, KinEmptyState, KinStatus } from "@/components/kin";
import PermissionGuard from "@/components/PermissionGuard";
import { PERMISSIONS } from "@/contexts/AuthContext";
import { QueueErrorStrip, QueueSkeleton } from "@/components/admin/queue/shared";

interface Review { id: string; rating: number; comment: string; status: string; createdAt: string; user: { name: string }; course: { name: string } }
type Tab = "approved" | "rejected" | "all";

const TABS: { key: Tab; label: string }[] = [{ key: "approved", label: "Đã duyệt" }, { key: "rejected", label: "Đã từ chối" }, { key: "all", label: "Tất cả" }];
const STATUS: Record<string, { label: string; tone: "xong" | "loi" | "cho" }> = { approved: { label: "Đã duyệt", tone: "xong" }, rejected: { label: "Đã từ chối", tone: "loi" }, pending: { label: "Đang chờ ở Hàng chờ", tone: "cho" } };

/** "Trần Thị Bích" → "Bích T."; một từ giữ nguyên. */
function shortName(full: string): string {
  const w = full.trim().split(/\s+/).filter(Boolean);
  return w.length < 2 ? (w[0] ?? "Học viên") : `${w[w.length - 1]} ${w[0][0].toUpperCase()}.`;
}

function Stars({ value }: { value: number }) {
  return <span aria-label={`${value} trên 5 sao`} className="whitespace-nowrap tabular-nums text-[var(--kin-tt-chu-cho)]">{"★".repeat(value)}<span className="text-[var(--kin-chu-mo)]">{"☆".repeat(Math.max(0, 5 - value))}</span><span className="sr-only">{` ${value} sao`}</span></span>;
}

function Content() {
  const [tab, setTab] = useState<Tab>("approved");
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    await Promise.resolve();
    setReviews(null); setFailed(false);
    try {
      const r = await fetch(`/api/admin/reviews?status=${tab}`, { credentials: "same-origin", cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      const d = await r.json();
      setReviews(Array.isArray(d.reviews) ? d.reviews : []);
    } catch { setFailed(true); }
  }, [tab]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  async function del(id: string) {
    setBusyId(id); setNote(null);
    try {
      const res = await fetch(`/api/admin/reviews/${id}`, { method: "DELETE", credentials: "same-origin" });
      setNote(res.ok ? { ok: true, text: "Đã xoá đánh giá." } : { ok: false, text: "Chưa xoá được. Thử lại." });
      setConfirmId(null);
      if (res.ok) await load();
    } catch { setNote({ ok: false, text: "Không kết nối được. Thử lại." }); } finally { setBusyId(null); }
  }

  const list = reviews ?? [];
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <header>
        <h1 className="text-[28px] font-medium leading-9 text-[var(--kin-chu-chinh)]">Đánh giá khoá học</h1>
        <p className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Lịch sử các đánh giá đã xử lý. Có thể xoá một đánh giá không phù hợp.</p>
      </header>
      <KinCallout title="Đánh giá mới chờ duyệt ở Hàng chờ">
        Duyệt hoặc từ chối ở <Link href="/admin/kiem-duyet?loai=danh-gia" className="font-medium underline text-[var(--kin-nhan-link)]">Hàng chờ, loại Đánh giá khoá</Link>.
      </KinCallout>

      <nav aria-label="Lọc theo trạng thái" className="flex flex-wrap gap-2">
        {TABS.map(t => (
          <button key={t.key} type="button" aria-pressed={tab === t.key} onClick={() => setTab(t.key)}
            className={`inline-flex min-h-11 items-center rounded-full border px-4 text-[length:var(--kin-co-goc)] font-medium ${tab === t.key ? "border-[var(--kin-nhan-nen)] bg-[var(--kin-nhan-nen-nhat)] text-[var(--kin-nhan-link)]" : "border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-trang)] text-[var(--kin-chu-phu)]"}`}>{t.label}</button>
        ))}
      </nav>
      <p data-dang-loc className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]">Đang lọc: <b className="font-semibold text-[var(--kin-chu-chinh)]">{TABS.find(t => t.key === tab)!.label}</b></p>
      {note && <p role="status" data-loi={note.ok ? undefined : ""} className={`text-[length:var(--kin-co-goc)] font-medium ${note.ok ? "text-[var(--kin-tt-chu-xong)]" : "text-[var(--kin-tt-chu-loi)]"}`}>{note.text}</p>}

      {failed && <QueueErrorStrip message="Chưa tải được đánh giá." onRetry={() => void load()} />}
      {reviews === null && !failed && <QueueSkeleton rows={4} />}
      {reviews !== null && list.length === 0 && <KinEmptyState title="Chưa có đánh giá nào ở mục này">Đánh giá đã duyệt hoặc đã từ chối sẽ hiện ở đây.</KinEmptyState>}
      {reviews !== null && list.length > 0 && (
        <div className="overflow-x-auto rounded-[var(--kin-bo-the)] border border-[var(--kin-vien-thuong)]">
          <table data-danh-gia-table className="w-full min-w-[640px] border-collapse text-left text-[length:var(--kin-co-goc)]">
            <thead>
              <tr className="text-[length:var(--kin-co-caption)] uppercase tracking-wide text-[var(--kin-chu-mo)]">
                {["Khoá học · người viết", "Sao", "Nhận xét", "Ngày", "Trạng thái", "Hành động"].map(h => <th key={h} scope="col" className="border-b border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-bang)] px-3 py-2 font-semibold">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {list.map(r => {
                const st = STATUS[r.status] ?? { label: r.status, tone: "cho" as const };
                return (
                  <tr key={r.id} className="border-b border-[var(--kin-vien-nhat)] last:border-b-0">
                    <th scope="row" className="px-3 py-3 font-normal">
                      <p className="font-semibold text-[var(--kin-chu-chinh)]">{r.course.name}</p>
                      <p className="text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)]">{shortName(r.user.name)}</p>
                    </th>
                    <td className="px-3 py-3"><Stars value={r.rating} /></td>
                    <td className="max-w-[260px] px-3 py-3 text-[var(--kin-chu-phu)]"><p className="line-clamp-2">{r.comment}</p></td>
                    <td className="whitespace-nowrap px-3 py-3 text-[var(--kin-chu-phu)]">{new Date(r.createdAt).toLocaleDateString("vi-VN")}</td>
                    <td className="px-3 py-3"><KinStatus tone={st.tone}>{st.label}</KinStatus></td>
                    <td className="px-3 py-2">
                      {confirmId === r.id ? (
                        <div className="flex items-center gap-2">
                          <KinButton variant="danger-solid" loading={busyId === r.id} loadingLabel="Đang xoá…" onClick={() => void del(r.id)}>Xác nhận xoá</KinButton>
                          <KinButton variant="secondary" disabled={busyId === r.id} onClick={() => setConfirmId(null)}>Huỷ</KinButton>
                        </div>
                      ) : (
                        <KinButton variant="danger" onClick={() => { setConfirmId(r.id); setNote(null); }} aria-label={`Xoá đánh giá khoá ${r.course.name}`}>Xoá</KinButton>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)]">Xoá đánh giá không hoàn tác được.</p>
    </div>
  );
}

export default function DanhGiaPage() {
  return <PermissionGuard required={PERMISSIONS.MANAGE_COURSES}><Content /></PermissionGuard>;
}
