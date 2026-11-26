"use client";
// Nhóm "Thử sắp hết" / "Hết thử – hỏi em" ở Hôm nay (man-hom-nay §6, T27, T28): 3 em + Xem tất cả + Gia hạn cả nhóm.
// Điện thoại: mỗi em một nút "Xử lý" mở tờ trượt; máy tính: 3 nút ngay trên hàng. Chỉ chủ lớp thấy khối này.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useHoanTac } from "../khung/hoan-tac";
import { TrialChip } from "../ui/chip";
import { ToTruot } from "../ui/to-truot";
import { nutPhu } from "../ui/nut";
import { GiaHan, type EmGiaHan } from "./gia-han";

export type EmThu = EmGiaHan & { con_ngay?: number | null };

export function NhomThu({ tieuDe, em, xemTatCa, homNay, loai }: { tieuDe: string; em: EmThu[]; xemTatCa: string; homNay: string; loai: "thu_sap_het" | "het_thu" }) {
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
  const nho = "nhan inline-flex min-h-11 items-center justify-center rounded-[10px] border border-border-input px-3 text-[14px] font-semibold text-text hover:bg-row-hover";
  return (
    <div className="rounded-[14px] border border-border bg-surface">
      <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-3">
        <h3 className="flex-1 font-semibold">
          {tieuDe} <span className="so text-text-3">· {em.length} em</span>
        </h3>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={nho} onClick={() => setGiaHan(em)}>Gia hạn cả nhóm</button>
          <Link href={xemTatCa} className={nho}>Xem {em.length} em ›</Link>
        </div>
      </div>
      <ul className="border-t border-border">
        {em.slice(0, 3).map((e) => (
          <li key={e.ma_hs} className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-4 py-2 last:border-b-0">
            <div className="min-w-0 flex-1">
              <Link href={`/quan-ly/hoc-sinh/${e.ma_hs}`} className="font-semibold hover:underline" translate="no">{e.ho_ten}</Link>
              <span className="ml-2 text-[13px] text-text-3">{e.mon.join(", ")}</span>
            </div>
            <TrialChip con={e.con_ngay} het={e.het} tienTo="" />
            <button type="button" className={`${nho} sm:hidden`} onClick={() => setXuLy(e)}>Xử lý</button>
            <span className="hidden gap-2 sm:flex">
              <Link href={`/quan-ly/hoc-sinh/${e.ma_hs}?mo=chinh-thuc`} className={nho}>Lên chính thức</Link>
              <button type="button" className={nho} onClick={() => setGiaHan([e])}>Gia hạn</button>
              <Link href={`/quan-ly/hoc-sinh/${e.ma_hs}?mo=nghi`} className={nho}>Cho nghỉ</Link>
              <button type="button" className={`${nho} border-transparent text-text-2`} onClick={() => an(e)}>Ẩn 3 ngày</button>
            </span>
          </li>
        ))}
        {em.length > 3 ? (
          <li className="px-4 py-2 text-[14px] text-text-3"><Link href={xemTatCa} className="inline-flex min-h-11 items-center hover:text-text hover:underline">+ {em.length - 3} em nữa</Link></li>
        ) : null}
      </ul>
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
