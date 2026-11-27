"use client";
// Nút chính của thẻ "Tối nay" ở khu học sinh (chép từ bca/components/hoc-sinh/nut-toi-nay.tsx): MỘT nút vàng 56px đổi theo giờ —
// còn N phút → "Vào lớp ngay" từ 15 phút trước giờ → "Xem record" sau buổi. Tự đổi mỗi 30 giây theo giờ máy.
// Máy chủ đã quyết link nào được hiện (chỉ môn còn hạn); thiếu link thì luôn có câu hướng dẫn, không để trống.
import { useEffect, useState } from "react";
import { khoangThoiGian } from "@/lib/lop/dinh-dang";

const SOM_PHUT = 15;
const nut = "flex min-h-14 w-full items-center justify-center rounded-[var(--kin-bo-md)] bg-[var(--kin-lop-dem-nut)] px-5 text-center text-[length:var(--kin-co-body)] font-semibold text-[var(--kin-lop-dem-chu-tren-nut)] hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--kin-lop-dem-chu)] lg:inline-flex lg:w-auto lg:min-w-48";
const phu = "text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-lop-dem-chu-phu)]";
const ngoai = { target: "_blank", rel: "noopener noreferrer" } as const;

/** `luc`: giờ máy chủ lúc dựng trang — lần vẽ đầu ở máy chủ và máy khách dùng cùng một mốc (không nháy, không lệch hydrate). */
export function NutToiNay({ batDau, soPhut, meet, record, zalo, luc }: { batDau: string; soPhut: number; meet: string | null; record: string | null; zalo: string | null; luc: number }) {
  const [now, setNow] = useState(luc);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const bd = Date.parse(batDau), kt = bd + soPhut * 60_000;
  if (now >= kt) {
    return record
      ? <><p className={phu}>Buổi học đã xong.</p><a href={record} {...ngoai} className={`${nut} mt-3`}>Xem record buổi tối nay</a></>
      : <p className={phu}>Buổi học đã xong. Record sẽ có sau buổi học — em quay lại xem sau nhé.</p>;
  }
  const con = now >= bd ? "Lớp đang học" : bd - now > SOM_PHUT * 60_000 ? `Còn ${khoangThoiGian(bd - now)}` : "Sắp vào lớp";
  if (!meet) {
    return zalo
      ? <><p className={phu}><span className="tabular-nums">{con}</span> · Link Meet gửi trong nhóm Zalo của môn.</p><a href={zalo} {...ngoai} className={`${nut} mt-3`}>Mở nhóm Zalo môn</a></>
      : <p className={phu}><span className="tabular-nums">{con}</span> · Môn này chưa có link vào lớp trên web. Em nhắn chủ lớp để nhận link Meet trước giờ học.</p>;
  }
  return (
    <>
      <p className={`${phu} tabular-nums`} aria-live="polite">{con}</p>
      <a href={meet} {...ngoai} className={`${nut} mt-3`}>{bd - now > SOM_PHUT * 60_000 ? "Vào lớp Meet" : "Vào lớp ngay"}</a>
    </>
  );
}
