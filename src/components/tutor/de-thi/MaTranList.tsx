// BU-03 P2 · S5 (danh sách) — Ma trận đề đã lưu của gia sư (/lop-cua-toi/de-thi/ma-tran). Mở một ma trận để bốc câu, sửa, hoặc dựng ma trận mới.
// Dữ liệu: GET /api/tutor/de-thi/ma-tran (chỉ của mình). Xoá ma trận KHÔNG xoá đề đã tạo từ nó (máy chủ đặt blueprintId = null).
"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { KinPage, KinPageHeader, KinPageSkeleton } from "@/components/kin/PageLayout";
import { KinButton, kinButtonClass } from "@/components/kin/Button";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { KinStateCard } from "@/components/kin/StateCard";
import { useKinConfirm } from "@/components/kin/useConfirm";
import { KinToast } from "@/components/kin/Toast";
import { blueprintTotal, deleteBlueprint, deThiListHref, fetchBlueprints, maTranHref, maTranMoiHref, type Blueprint } from "./deThiClient";

const dmy = (iso?: string): string => { if (!iso) return "—"; const d = new Date(iso); return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("vi-VN"); };

export default function MaTranList() {
  const { ask, dialog } = useKinConfirm();
  const [items, setItems] = useState<Blueprint[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ tone: "xong" | "loi"; title: string; detail?: string } | null>(null);

  useEffect(() => {
    let alive = true;
    void fetchBlueprints().then(r => {
      if (!alive) return;
      if (!r.ok || !r.data) { setErr(r.error ?? "Chưa tải được danh sách ma trận."); return; }
      setErr(null); setItems(r.data);
    });
    return () => { alive = false; };
  }, [reload]);

  async function remove(b: Blueprint) {
    if (!(await ask({ title: `Xoá ma trận “${b.name}”?`, message: "Chỉ xoá ma trận đã lưu. Các đề đã tạo từ ma trận này giữ nguyên.", confirmLabel: "Xoá ma trận", tone: "nguy-hiem" }))) return;
    setBusy(b.id);
    const r = await deleteBlueprint(b.id);
    setBusy(null);
    if (!r.ok) { setToast({ tone: "loi", title: "Chưa xoá được ma trận", detail: r.error ?? undefined }); return; }
    setItems(a => (a ?? []).filter(x => x.id !== b.id));
    setToast({ tone: "xong", title: "Đã xoá ma trận" });
  }

  const actions = <Link href={maTranMoiHref()} className={kinButtonClass("primary")}>Ma trận mới</Link>;
  if (err) {
    return (
      <KinPage>
        <KinPageHeader title="Ma trận đề" back={{ href: deThiListHref(), label: "Đề thi" }} actions={actions} />
        <KinStateCard tone="loi" kicker="Lỗi · Có thể thử lại" title="Chưa tải được ma trận" actions={<KinButton onClick={() => { setErr(null); setItems(null); setReload(n => n + 1); }}>Thử lại</KinButton>}>{err}</KinStateCard>
      </KinPage>
    );
  }
  if (!items) return <KinPageSkeleton label="Đang tải ma trận" rows={4} side={false} />;

  return (
    <KinPage>
      {dialog}
      <KinPageHeader title="Ma trận đề" back={{ href: deThiListHref(), label: "Đề thi" }} sub="Ma trận đã lưu để bốc đề lại nhiều lần" actions={actions} />
      {toast && <div className="mb-4"><KinToast tone={toast.tone} title={toast.title} detail={toast.detail} onClose={() => setToast(null)} /></div>}
      {items.length === 0 ? (
        <KinEmptyState title="Cô chưa lưu ma trận nào" action={<Link href={maTranMoiHref()} className={kinButtonClass("primary")}>Dựng ma trận đầu tiên</Link>}>
          Ma trận ghi số câu cần có ở từng yêu cầu cần đạt và mức NB / TH / VD / VDC. Lưu lại, lần sau cô chỉ cần bốc câu mới.
        </KinEmptyState>
      ) : (
        <ul aria-label="Ma trận đã lưu" className="rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-thuong)] divide-y divide-[var(--kin-vien-nhat)]">
          {items.map(b => (
            <li key={b.id} data-ma-tran={b.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-x-4 gap-y-2">
              <div className="min-w-0 flex-1">
                <Link href={maTranHref(b.id)} className="block min-h-11 sm:min-h-0 py-2 sm:py-0 font-medium text-[var(--kin-chu-chinh)] hover:underline break-words">{b.name}</Link>
                <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">{Array.isArray(b.rows) ? `${blueprintTotal(b.rows)} câu · ${b.rows.length} ô · ` : ""}cập nhật {dmy(b.updatedAt)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={maTranHref(b.id)} className={kinButtonClass("primary")}>Mở và bốc đề</Link>
                <KinButton variant="danger" onClick={() => void remove(b)} loading={busy === b.id} loadingLabel="Đang xoá…" aria-label={`Xoá ma trận ${b.name}`}>Xoá</KinButton>
              </div>
            </li>
          ))}
        </ul>
      )}
    </KinPage>
  );
}
