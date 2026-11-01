// BU-03 P2 · S3 — Ngân hàng đề của gia sư (/lop-cua-toi/de-thi). Thay bí danh trang quản trị (1.974 dòng, có ô giá + duyệt phí khách mà gia sư không dùng, đã LOẠI P27).
// Một hàng = một ĐỀ GỐC; các mã đề con (101, 102…) gom vào đề gốc (cột Mã đề), không hiện thành đề riêng. Bản cũ (superseded) máy chủ đã bỏ khỏi danh sách.
// 1600px: bảng (Tên đề · Mã đề · Chế độ · Lớp · Trạng thái · Cập nhật · nút). 390px: mỗi đề một thẻ.
// ?lop=<courseId>: chế độ "chọn đề để giao cho lớp" (điểm nối với Quản lớp, BU-02): mỗi đề có thêm nút Giao đề này; hợp đồng link do BU-03 mục 2.
// Dữ liệu: GET /api/tutor/de-thi?lop=&trangThai= (chỉ đề của chính gia sư). Tên lớp lấy từ /api/tutor/bai-tap vì hợp đồng chỉ trả courseId.
"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { KinPage, KinPageHeader, KinPageSkeleton, KIN_FIELD, KIN_LABEL, KIN_TABLE_HEAD, KIN_TABLE_ROW } from "@/components/kin/PageLayout";
import { KinButton, kinButtonClass } from "@/components/kin/Button";
import { KinCallout } from "@/components/kin/Callout";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { KinStateCard } from "@/components/kin/StateCard";
import { KinStatus } from "@/components/kin/Status";
import {
  deThiDetailHref, deThiListHref, deThiSubHref, EXAM_STATUS_LABEL, fetchCourseNames, fetchDeThi, maTranListHref, MODE_LABEL, taoDeHref, tepGocHref, variantCodeOf, variantCountOf,
  type DeThiItem,
} from "./deThiClient";

const GRID = "lg:grid lg:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,1.2fr)_minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,1.3fr)] lg:gap-x-4";
const dmy = (iso: string): string => { const d = new Date(iso); return Number.isNaN(d.getTime()) || d.getFullYear() < 2000 ? "—" : d.toLocaleDateString("vi-VN"); };

function StatusCell({ status }: { status: string }) {
  const s = EXAM_STATUS_LABEL[status];
  return s ? <KinStatus tone={s.tone}>{s.text}</KinStatus> : <span>{status || "—"}</span>;
}
function VariantText({ it }: { it: DeThiItem }) {
  const n = variantCountOf(it);
  return <span>{n > 1 ? `${n} mã đề (${variantCodeOf(1)}–${variantCodeOf(n)})` : "Một mã"}</span>;
}

export default function DeThiList() {
  const params = useSearchParams();
  const lop = params.get("lop");
  const [items, setItems] = useState<DeThiItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [courses, setCourses] = useState<{ id: string; name: string }[]>([]);
  const [reload, setReload] = useState(0);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    let alive = true;
    void fetchDeThi({ lop }).then(r => {
      if (!alive) return;
      if (!r.ok || !r.data) { setErr(r.error ?? "Chưa tải được danh sách đề."); return; }
      setErr(null); setItems(r.data);
    });
    return () => { alive = false; };
  }, [lop, reload]);
  useEffect(() => {
    let alive = true;
    void fetchCourseNames().then(c => { if (alive) setCourses(c); });
    return () => { alive = false; };
  }, []);
  function retry() { setErr(null); setItems(null); setReload(n => n + 1); }

  const courseName = (it: DeThiItem): string => (it.courseId ? it.courseName ?? courses.find(c => c.id === it.courseId)?.name ?? "Một lớp" : "Chưa gắn lớp");
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (items ?? []).filter(it => (!t || it.title.toLowerCase().includes(t)) && (!status || it.status === status));
  }, [items, q, status]);
  const statuses = useMemo(() => [...new Set((items ?? []).map(i => i.status))], [items]);

  const actions = (
    <>
      <Link href={taoDeHref()} className={kinButtonClass("primary")}>Tạo đề mới</Link>
      <Link href={maTranListHref()} className={kinButtonClass("secondary")}>Ma trận đề</Link>
    </>
  );

  if (err) {
    return (
      <KinPage>
        <KinPageHeader title="Đề thi" sub="Ngân hàng đề của cô" actions={actions} />
        <KinStateCard tone="loi" kicker="Lỗi · Có thể thử lại" title="Chưa tải được danh sách đề" actions={<KinButton onClick={retry}>Thử lại</KinButton>}>{err}</KinStateCard>
      </KinPage>
    );
  }
  if (!items) return <KinPageSkeleton label="Đang tải danh sách đề" rows={5} side={false} />;

  const forClass = lop ? courses.find(c => c.id === lop)?.name ?? "lớp này" : null;

  return (
    <KinPage>
      <KinPageHeader title="Đề thi" sub="Ngân hàng đề của cô · mã đề con gom vào đề gốc" actions={actions} />

      {lop && (
        <KinCallout tone="nhan" className="mb-6" title={`Chọn đề để giao cho ${forClass}`}>
          Bấm “Giao đề này” ở đề cô muốn. Đang chỉ hiện đề đã gắn lớp này. <Link href={deThiListHref()} className="underline">Xem tất cả đề</Link>
        </KinCallout>
      )}

      {items.length === 0 ? (
        <KinEmptyState title={lop ? "Lớp này chưa có đề nào" : "Cô chưa có đề thi nào"}
          action={<div className="flex flex-wrap gap-3 justify-center"><Link href={taoDeHref()} className={kinButtonClass("primary")}>Tạo đề đầu tiên</Link>{lop && <Link href={deThiListHref()} className={kinButtonClass("secondary")}>Xem tất cả đề</Link>}</div>}>
          Cô tạo đề từ ma trận (bốc câu từ ngân hàng), từ tệp Word, từ PDF/ảnh hoặc soạn trắng. Đề nào cũng bắt đầu là bản nháp, học sinh chưa thấy.
        </KinEmptyState>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-x-6 gap-y-3 pb-4">
            <div className="min-w-0 w-full sm:w-72">
              <label htmlFor="dt-q" className={`${KIN_LABEL} mb-2`}>Tìm theo tên đề</label>
              <input id="dt-q" type="search" className={KIN_FIELD} value={q} onChange={e => setQ(e.target.value)} placeholder="Ví dụ: Giữa kỳ 1" />
            </div>
            <div className="min-w-0 w-full sm:w-56">
              <label htmlFor="dt-st" className={`${KIN_LABEL} mb-2`}>Trạng thái</label>
              <select id="dt-st" className={KIN_FIELD} value={status} onChange={e => setStatus(e.target.value)}>
                <option value="">Tất cả</option>
                {statuses.map(s => <option key={s} value={s}>{EXAM_STATUS_LABEL[s]?.text ?? s}</option>)}
              </select>
            </div>
            <p role="status" className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)] pb-3">{shown.length}/{items.length} đề</p>
          </div>

          {shown.length === 0 ? (
            <KinEmptyState title="Không có đề nào khớp" action={<KinButton variant="secondary" onClick={() => { setQ(""); setStatus(""); }}>Bỏ lọc</KinButton>}>
              Cô thử tên khác hoặc bỏ bộ lọc trạng thái.
            </KinEmptyState>
          ) : (
            <div className="rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-thuong)] overflow-hidden">
              <div className={`hidden ${GRID} ${KIN_TABLE_HEAD}`} role="presentation" aria-hidden>
                <span>Tên đề</span><span>Mã đề</span><span>Chế độ</span><span>Lớp</span><span>Trạng thái</span><span>Cập nhật</span><span className="text-right">Việc</span>
              </div>
              <ul aria-label="Danh sách đề thi">
                {shown.map(it => (
                  <li key={it.id} data-de-thi={it.id} className={`${GRID} ${KIN_TABLE_ROW} flex flex-col gap-y-2 lg:items-center`}>
                    <div className="min-w-0">
                      <Link href={deThiDetailHref(it.id)} className="flex items-center min-h-11 py-2 font-medium text-[var(--kin-chu-chinh)] hover:underline break-words">{it.title}</Link>
                      <p className="text-[length:var(--kin-co-caption)] text-[var(--kin-chu-mo)]">{it.questionCount} câu{it.extractedFrom ? ` · tách từ ${it.extractedFrom.fileName}` : ""}</p>
                    </div>
                    <div className="min-w-0"><span className="lg:hidden text-[var(--kin-chu-mo)]">Mã đề: </span><VariantText it={it} /></div>
                    <div className="min-w-0"><span className="lg:hidden text-[var(--kin-chu-mo)]">Chế độ: </span>{it.mode ? MODE_LABEL[it.mode] : "Chưa chọn"}</div>
                    <div className="min-w-0 break-words"><span className="lg:hidden text-[var(--kin-chu-mo)]">Lớp: </span>{courseName(it)}</div>
                    <div className="min-w-0"><StatusCell status={it.status} /></div>
                    <div className="min-w-0 text-[var(--kin-chu-mo)]">{dmy(it.updatedAt)}</div>
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      {lop && <Link href={`${deThiSubHref(it.id, "giao")}?lop=${encodeURIComponent(lop)}`} className={kinButtonClass("primary")}>Giao đề này</Link>}
                      <Link href={deThiDetailHref(it.id)} className={kinButtonClass("secondary")}>Mở đề</Link>
                      {!lop && <Link href={deThiSubHref(it.id, "giao")} className={kinButtonClass("secondary")}>Giao đề</Link>}
                      {!lop && it.status !== "draft" && <Link href={deThiSubHref(it.id, "ket-qua")} className={kinButtonClass("secondary")}>Kết quả</Link>}
                      {!lop && <Link href={deThiSubHref(it.id, "ma-de")} className={kinButtonClass("secondary")}>Mã đề</Link>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <p className="mt-8 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">
        Tệp đề gốc (Word/PDF) cô lưu trữ nằm ở <Link href={tepGocHref()} className="underline">Tệp đề gốc</Link>; từ đó tách thành đề được.
      </p>
    </KinPage>
  );
}
