"use client";
// Chỉ báo lưu ở đầu trang (khung-quan-ly §5). Trình đọc màn hình chỉ được báo khi lỗi
// hoặc khi chuyển từ "chưa gửi" sang "đã lưu" — không báo mỗi lần bấm.
import { useEffect, useRef, useState } from "react";
import { gio } from "../dinh-dang";
import { thuLai, useHangDoi } from "./hang-doi";

export function ChiBaoLuu({ choRieng }: { choRieng?: number }) {
  const t = useHangDoi();
  const cho = choRieng ?? t.cho;
  const [baoDoc, setBaoDoc] = useState("");
  const truoc = useRef(cho);
  useEffect(() => {
    if (truoc.current > 0 && cho === 0 && t.daLuuLuc) setBaoDoc(`Đã lưu ${gio(t.daLuuLuc)}`);
    else if (cho > 0) setBaoDoc("");
    truoc.current = cho;
  }, [cho, t.daLuuLuc]);
  const cham = (mau: string) => <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${mau}`} />;
  let noiDung;
  if (t.loiMayChu) noiDung = <button type="button" onClick={thuLai} className="flex min-h-11 items-center gap-2 text-danger">{cham("bg-danger")}Lưu lỗi · Thử lại</button>;
  else if (cho > 0 && (t.matMang || t.hetPhien)) noiDung = <span className="flex items-center gap-2 text-text-2">{cham("bg-warn")}{cho}<span className="hidden sm:inline"> thay đổi</span> chưa gửi</span>;
  else if (t.dangGui || cho > 0) noiDung = <span className="flex items-center gap-2 text-text-3">{cham("border border-text-3")}Đang lưu…</span>;
  else if (t.daLuuLuc) noiDung = <span className="flex items-center gap-2 text-text-3">{cham("bg-ok")}Đã lưu {gio(t.daLuuLuc)}</span>;
  else noiDung = null;
  return (
    <div className="so shrink-0 text-[13px]">
      {noiDung}
      <span className="sr-only" aria-live="polite">{t.loiMayChu ? "Lưu lỗi" : baoDoc}</span>
    </div>
  );
}
