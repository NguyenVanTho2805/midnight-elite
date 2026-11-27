"use client";
// Nút chính của thẻ "Tối nay" (huong-chon: nút vàng 56px, đổi theo giờ): còn N phút → Vào lớp ngay → Xem record.
// Tự đổi mỗi 30 giây theo giờ máy; máy chủ đã quyết link nào được hiện (chỉ môn còn hạn).
import { useEffect, useState } from "react";
import { nutChinhTo, nutPhu } from "../ui/nut";

const SOM_PHUT = 15;

export function NutToiNay({ batDau, soPhut, meet, record, zalo }: { batDau: string; soPhut: number; meet: string | null; record: string | null; zalo: string | null }) {
  const [bayGio, setBayGio] = useState<number | null>(null);
  useEffect(() => {
    setBayGio(Date.now());
    const t = setInterval(() => setBayGio(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const bd = Date.parse(batDau), kt = bd + soPhut * 60_000;
  const now = bayGio ?? bd - 60 * 60_000; // trước khi hydrate: coi như còn sớm (không nháy "Xem record")
  const chu = (s: string) => <span className="text-[17px]">{s}</span>;
  if (now >= kt) {
    return record ? (
      <a href={record} target="_blank" rel="noopener noreferrer" className={`${nutChinhTo} w-full`}>{chu("Xem record buổi tối nay")}</a>
    ) : (
      <p className="text-text-2">Buổi học đã xong. Record sẽ có sau buổi học.</p>
    );
  }
  if (!meet) {
    return (
      <div className="grid gap-2">
        <p className="text-text-2">Link Meet gửi trong nhóm Zalo của môn.</p>
        {zalo ? <a href={zalo} target="_blank" rel="noopener noreferrer" className={`${nutPhu} min-h-14 w-full`}>Mở nhóm Zalo môn</a> : null}
      </div>
    );
  }
  const con = Math.ceil((bd - now) / 60_000);
  return (
    <a href={meet} target="_blank" rel="noopener noreferrer" className={`${nutChinhTo} w-full`} aria-live="polite">
      {con > SOM_PHUT ? chu(`Vào lớp Meet · còn ${con >= 120 ? `${Math.floor(con / 60)} giờ` : `${con} phút`}`) : chu("Vào lớp ngay")}
    </a>
  );
}
