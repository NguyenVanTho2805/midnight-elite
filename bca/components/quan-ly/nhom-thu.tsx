"use client";
// Nhóm "Thử sắp hết" / "Hết thử – hỏi em" ở Hôm nay (man-hom-nay §6, §9, T27, T28): 3 em + Xem tất cả + Gia hạn cả nhóm.
// Chỉ chủ lớp thấy khối này. Bố cục theo bề rộng khối (container query), không theo màn hình:
// - Hẹp (< 560px, điện thoại): tên + môn + chip, một nút "Xử lý" mở tờ trượt.
// - Rộng (≥ 560px): một hàng ≈ 48px trên lưới con chung (cột Học sinh · Lứa · SĐT HS · việc):
//   "Lên chính thức", "Gia hạn" trên hàng; "Cho nghỉ…" và "Ẩn 3 ngày" trong nút "…".
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { useHoanTac } from "../khung/hoan-tac";
import { sdt } from "../dinh-dang";
import { IconThem } from "../bieu-tuong";
import { TrialChip } from "../ui/chip";
import { ToTruot } from "../ui/to-truot";
import { nutPhu } from "../ui/nut";
import { GiaHan, type EmGiaHan } from "./gia-han";

export type EmThu = EmGiaHan & { con_ngay?: number | null; lua?: string | null; sdt?: string | null };

const nho = "nhan inline-flex min-h-11 items-center justify-center rounded-[10px] border border-border-input px-3 text-[14px] font-semibold text-text hover:bg-row-hover";

/** mo: mở sẵn danh sách từng em (nhóm gấp nhất); các nhóm khác gập lại để Hôm nay gọn trong một màn (QĐ 27). */
export function NhomThu({ tieuDe, em, xemTatCa, homNay, loai, mo = false }: { tieuDe: string; em: EmThu[]; xemTatCa: string; homNay: string; loai: "thu_sap_het" | "het_thu"; mo?: boolean }) {
  const [giaHan, setGiaHan] = useState<EmThu[] | null>(null);
  const [xuLy, setXuLy] = useState<EmThu | null>(null);
  const router = useRouter();
  const { hien } = useHoanTac();
  // Đánh dấu xong (T33, hom-nay.md 3.3): việc học thử ẩn 3 ngày; Hoàn tác = bỏ đánh dấu.
  async function an(e: EmThu) {
    setXuLy(null);
    const r = await fetch("/api/hom-nay/xong", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ loai, khoa: e.ma_hs }) });
    if (!r.ok) return hien({ thongDiep: (await r.json().catch(() => ({}))).loi ?? "Không ẩn được — kiểm tra mạng." });
    router.refresh();
    hien({
      thongDiep: `Đã ẩn ${e.ho_ten} 3 ngày`,
      hoanTac: async () => {
        await fetch(`/api/hom-nay/xong?loai=${loai}&khoa=${encodeURIComponent(e.ma_hs)}`, { method: "DELETE" });
        router.refresh();
      },
    });
  }
  return (
    <div className="@container rounded-[14px] border border-border bg-surface">
      <div className={`flex flex-col gap-2 px-4 py-3 @min-[560px]:flex-row @min-[560px]:items-center @min-[560px]:gap-3`}>
        <h3 className="flex-1 font-semibold">
          {tieuDe} <span className="so text-text-3">· {em.length} em</span>
        </h3>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={nho} onClick={() => setGiaHan(em)}>Gia hạn cả nhóm</button>
          <Link href={xemTatCa} className={nho}>Xem {em.length} em ›</Link>
        </div>
      </div>
      <details open={mo} className="border-t border-border">
      <summary className="nhan flex min-h-11 cursor-pointer items-center px-4 text-[14px] font-semibold text-text-2 hover:text-text">Từng em</summary>
      <ul className={`border-t border-border @min-[560px]:grid @min-[560px]:grid-cols-[minmax(0,1fr)_auto_auto_auto] @min-[560px]:gap-x-3`}>
        <li aria-hidden="true" className={`hidden px-4 pt-2 text-[13px] font-semibold text-text-2 @min-[560px]:col-span-4 @min-[560px]:grid @min-[560px]:grid-cols-subgrid`}>
          <span>Học sinh</span><span>Lứa</span><span>SĐT HS</span><span />
        </li>
        {em.slice(0, 3).map((e) => (
          <li key={e.ma_hs} className={`grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 border-b border-border px-4 py-2 last:border-b-0 @min-[560px]:col-span-4 @min-[560px]:min-h-12 @min-[560px]:grid-cols-subgrid @min-[560px]:py-0.5`}>
            <div className="min-w-0 leading-5">
              {/* Vùng chạm 44px (man-hom-nay §14.5), margin âm giữ hàng gọn — phần thừa chỉ chồng lên dòng chữ môn (không bấm được). */}
              <Link href={`/quan-ly/hoc-sinh/${e.ma_hs}`} className="-my-3 inline-flex min-h-11 items-center font-semibold hover:underline" translate="no">{e.ho_ten}</Link>
              <span className="flex flex-wrap items-center gap-x-2 text-[13px] text-text-3">
                {e.mon.join(", ")}
                <TrialChip con={e.con_ngay} het={e.het} tienTo="" lien />
              </span>
            </div>
            <span className={`so hidden text-[14px] text-text-2 @min-[560px]:block`} translate="no"><span className="sr-only">Lứa </span>{e.lua ?? "—"}</span>
            <span className={`so hidden whitespace-nowrap text-[14px] @min-[560px]:block`}>
              {e.sdt ? <a href={`tel:${e.sdt}`} translate="no" className="inline-flex min-h-11 items-center hover:underline" aria-label={`Gọi ${e.ho_ten} ${sdt(e.sdt)}`}>{sdt(e.sdt)}</a> : <span className="text-text-3">—</span>}
            </span>
            <span className="flex justify-end">
              {/* bọc ngoài để `hidden` không đụng `inline-flex` của nút */}
              <span className="@min-[560px]:hidden"><button type="button" className={nho} onClick={() => setXuLy(e)}>Xử lý</button></span>
              <span className="hidden gap-2 @min-[560px]:flex">
                <Link href={`/quan-ly/hoc-sinh/${e.ma_hs}?mo=chinh-thuc`} className={nho}>Lên chính thức</Link>
                <button type="button" className={nho} onClick={() => setGiaHan([e])}>Gia hạn</button>
                <MenuThem e={e} an={an} />
              </span>
            </span>
          </li>
        ))}
        {em.length > 3 ? (
          <li className={`px-4 py-2 text-[14px] text-text-3 @min-[560px]:col-span-4`}><Link href={xemTatCa} className="inline-flex min-h-11 items-center hover:text-text hover:underline">+ {em.length - 3} em nữa</Link></li>
        ) : null}
      </ul>
      </details>
      <ToTruot mo={!!xuLy} dong={() => setXuLy(null)} tieuDe={xuLy ? xuLy.ho_ten : ""}>
        {xuLy ? (
          <div className="grid gap-3">
            <p className="text-text-2">{xuLy.mon.join(", ")} · {xuLy.het ? `hết thử ${xuLy.het}` : `còn ${xuLy.con_ngay} ngày`}</p>
            <Link href={`/quan-ly/hoc-sinh/${xuLy.ma_hs}?mo=chinh-thuc`} className={`${nutPhu} min-h-12`}>Lên chính thức</Link>
            <button type="button" className={`${nutPhu} min-h-12`} onClick={() => { setGiaHan([xuLy]); setXuLy(null); }}>Gia hạn</button>
            <Link href={`/quan-ly/hoc-sinh/${xuLy.ma_hs}?mo=nghi`} className={`${nutPhu} min-h-12`}>Cho nghỉ</Link>
            <button type="button" className={`${nutPhu} min-h-12 border-transparent text-text-2`} onClick={() => an(xuLy)}>Đánh dấu xong (ẩn 3 ngày)</button>
          </div>
        ) : null}
      </ToTruot>
      <GiaHan em={giaHan ?? []} homNay={homNay} mo={!!giaHan} dong={() => setGiaHan(null)} />
    </div>
  );
}

/** Nút "…" (mẫu disclosure): Cho nghỉ… / Ẩn 3 ngày. Esc hoặc chạm ra ngoài thì đóng, Esc trả tiêu điểm về nút. */
function MenuThem({ e, an }: { e: EmThu; an: (e: EmThu) => void }) {
  const [mo, setMo] = useState(false);
  const goc = useRef<HTMLSpanElement>(null);
  const nut = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!mo) return;
    const ngoai = (ev: PointerEvent) => { if (!goc.current?.contains(ev.target as Node)) setMo(false); };
    const phim = (ev: KeyboardEvent) => { if (ev.key === "Escape") { setMo(false); nut.current?.focus(); } };
    document.addEventListener("pointerdown", ngoai);
    document.addEventListener("keydown", phim);
    return () => { document.removeEventListener("pointerdown", ngoai); document.removeEventListener("keydown", phim); };
  }, [mo]);
  const muc = "flex min-h-11 w-full items-center rounded-[10px] px-3 text-left text-[14px] font-semibold hover:bg-row-hover";
  return (
    <span ref={goc} className="relative inline-flex" onBlur={(ev) => { if (!ev.currentTarget.contains(ev.relatedTarget as Node)) setMo(false); }}>
      <button ref={nut} type="button" aria-expanded={mo} aria-controls={id} aria-label={`Việc khác cho ${e.ho_ten}`} className={`${nho} w-11 px-0`} onClick={() => setMo(!mo)}>
        <IconThem size={20} />
      </button>
      {mo ? (
        <span id={id} className="bong-noi absolute right-0 top-full z-40 mt-1 grid w-48 rounded-[14px] bg-raised p-1">
          <Link href={`/quan-ly/hoc-sinh/${e.ma_hs}?mo=nghi`} className={`${muc} text-danger`}>Cho nghỉ…</Link>
          <button type="button" className={`${muc} text-text-2`} onClick={() => { setMo(false); an(e); }}>Ẩn 3 ngày</button>
        </span>
      ) : null}
    </span>
  );
}
