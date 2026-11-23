// SCL5 — hai khối phụ của màn Hôm nay (phương án C, cột phải ở 1280, dưới thẻ việc ở 390):
//   LopCuaBan     : lưới thẻ lớp nhỏ (dải màu lớp + ảnh bìa nhỏ nếu có + tên + vòng % bài đã học). Số từ /api/student/lop (tiến độ thật). Bấm ⇒ trang lớp.
//   NhatKyDemHoc  : 14 buổi điểm danh gần nhất của CHÍNH em (/api/student/nhat-ky). Mỗi ô có hình riêng + nhãn chữ (không chỉ màu, P2-13); "nghỉ có báo
//                   vẫn giữ nhịp" (P2-16). Chưa có bản ghi điểm danh nào ⇒ KHÔNG hiện khối (không bịa chuỗi). Không bảng xếp hạng, không vinh danh (D17).
"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { KinPanel } from "@/components/kin/Panel";
import { KinProgressRing } from "@/components/kin/ProgressRing";
import { KinStatusIcon, STATUS_DOT, type StatusShape } from "@/components/kin/Status";
import { classAccentFor } from "@/lib/classColor";
import type { ThuVienRow } from "@/lib/studentLop";
import { NHAT_KY_LABEL, nhipLien, type NhatKyStatus } from "@/lib/studentClassPage";
import { dmOfKey } from "@/components/student/shared";

const GOC = "text-[length:var(--kin-co-goc)]";
const H2 = "text-[length:var(--kin-co-tieu-de)] leading-6 font-semibold text-[var(--kin-chu-chinh)]";

export function LopCuaBan({ rows }: { rows: ThuVienRow[] }) {
  if (rows.length === 0) return null;
  return (
    <section aria-labelledby="hn-lop" data-hn-lop>
      <div className="flex items-baseline justify-between gap-3 pb-2">
        <h2 id="hn-lop" className={H2}>Lớp của bạn</h2>
        <Link href="/student/hoc-tap" className={`inline-flex items-center min-h-11 ${GOC} text-[var(--kin-nhan-link)] underline`}>Tất cả lớp</Link>
      </div>
      <ul className="grid grid-cols-2 gap-3">
        {rows.map(r => (
          <li key={r.id} data-hn-lop-the={r.id} className="min-w-0">
            <Link href={`/student/hoc-tap?course=${encodeURIComponent(r.id)}`}
              className="relative flex h-full min-h-[96px] flex-col overflow-hidden rounded-[var(--kin-bo-the)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-trang)] hover:bg-[var(--kin-nen-re-chuot)] transition-colors">
              <span aria-hidden className="h-1 w-full flex-shrink-0" style={{ background: classAccentFor(r.id, r.color) }} />
              {/* Ảnh bìa nhỏ, tĩnh, tải lười (P2-15). */}
              {r.cover && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.cover} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-16 w-full object-cover" />
              )}
              <span className="flex flex-1 items-center gap-2 p-3">
                <span className="min-w-0 flex-1">
                  <span className={`block ${GOC} font-semibold leading-5 text-[var(--kin-chu-chinh)] [overflow-wrap:anywhere] line-clamp-2`}>{r.name}</span>
                  <span className={`block mt-0.5 ${GOC} leading-5 text-[var(--kin-chu-phu)]`}>
                    {r.trialExpired ? "Hết học thử" : r.total > 0 ? `${r.done}/${r.total} bài` : "Chưa có bài"}
                  </span>
                </span>
                {r.total > 0 && <span className="flex-shrink-0"><KinProgressRing done={r.done} total={r.total} size={36} label={`Đã học ở lớp ${r.name}`} /></span>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

type NhatKyItem = { dateKey: string; courseName: string; status: NhatKyStatus };
const SHAPE: Record<NhatKyStatus, { shape: StatusShape; color: string }> = {
  "co-mat": { shape: "kin", color: STATUS_DOT.xong },
  "nghi-bao": { shape: "nua", color: STATUS_DOT.cho },
  vang: { shape: "chua", color: STATUS_DOT.mo },
};

export function NhatKyDemHoc() {
  const [items, setItems] = useState<NhatKyItem[] | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/student/nhat-ky", { credentials: "same-origin", cache: "no-store" }).then(r => (r.ok ? r.json() : null))
      .then((d: { items?: NhatKyItem[] } | null) => { if (live) setItems(d?.items ?? []); }).catch(() => { if (live) setItems([]); });
    return () => { live = false; };
  }, []);
  if (!items || items.length === 0) return null;
  const count = (s: NhatKyStatus) => items.filter(i => i.status === s).length;
  const nhip = nhipLien(items);
  return (
    <KinPanel as="section" aria-labelledby="hn-nhat-ky" data-nhat-ky>
      <h2 id="hn-nhat-ky" className={H2}>Nhật ký đêm học</h2>
      <p className={`mt-0.5 ${GOC} text-[var(--kin-chu-phu)]`}>{items.length} buổi gần nhất, cũ bên trái, mới bên phải</p>
      <ol aria-label="Các buổi đã điểm danh" className="mt-3 flex flex-wrap gap-1.5">
        {items.map((i, k) => (
          <li key={k} data-nhat-ky-o={i.status} title={`${dmOfKey(i.dateKey)} · ${i.courseName}: ${NHAT_KY_LABEL[i.status]}`}
            className="grid place-items-center w-7 h-7 rounded-[var(--kin-bo-md)] bg-[var(--kin-nen-bang)]">
            <KinStatusIcon shape={SHAPE[i.status].shape} color={SHAPE[i.status].color} />
            <span className="sr-only">{dmOfKey(i.dateKey)} · {i.courseName}: {NHAT_KY_LABEL[i.status]}</span>
          </li>
        ))}
      </ol>
      <ul className={`mt-3 flex flex-wrap gap-x-4 gap-y-1 ${GOC} text-[var(--kin-chu-phu)]`}>
        {(["co-mat", "nghi-bao", "vang"] as const).map(s => (
          <li key={s} className="inline-flex items-center gap-1.5"><KinStatusIcon shape={SHAPE[s].shape} color={SHAPE[s].color} />{NHAT_KY_LABEL[s]} <b className="tabular-nums text-[var(--kin-chu-chinh)]">{count(s)}</b></li>
        ))}
      </ul>
      {nhip > 0 && <p data-nhat-ky-nhip className={`mt-3 ${GOC} font-medium text-[var(--kin-chu-chinh)]`}>Giữ nhịp {nhip} buổi liền</p>}
      <p className={`mt-1 ${GOC} text-[var(--kin-chu-phu)]`}>Nghỉ có báo trước giờ học vẫn tính là giữ nhịp. Không có bảng xếp hạng, không so với bạn khác.</p>
    </KinPanel>
  );
}
