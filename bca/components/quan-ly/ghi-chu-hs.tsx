"use client";
// Ghi chú hồ sơ (chỉ chủ): ghi chú chung + riêng của chủ. PATCH /api/hoc-sinh/[maHs] qua hàng đợi (mất mạng vẫn giữ),
// mỗi ô một khoá; lưu khi rời ô. Máy chủ chặn GV/học sinh (403).
import { useEffect, useId, useState } from "react";
import { nhan, oNhap } from "../ui/nut";
import { dangKyXuLy, datViec, useHangDoi, viecCuaNhom } from "../khung/hang-doi";

const O = [
  { k: "ghiChu", nhan: "Ghi chú", goiY: "Ví dụ: Em học ca tối, phụ huynh nhắn Zalo" },
  { k: "ghiChuRieng", nhan: "Riêng của chủ (GV không thấy)", goiY: "Chỉ chủ lớp thấy" },
] as const;

export function GhiChuHs({ ma, ghiChu, ghiChuRieng }: { ma: string; ghiChu: string | null; ghiChuRieng: string | null }) {
  const nhom = `hs:${ma}`;
  const [v, setV] = useState({ ghiChu: ghiChu ?? "", ghiChuRieng: ghiChuRieng ?? "" });
  const [daLuu, setDaLuu] = useState({ ghiChu: ghiChu ?? "", ghiChuRieng: ghiChuRieng ?? "" });
  const [loi, setLoi] = useState("");
  const id = useId();
  useHangDoi();
  const cho = viecCuaNhom(nhom);
  useEffect(() => dangKyXuLy(nhom, {
    ok: (_v, kq) => {
      const k = kq as { ghi_chu?: string | null; ghi_chu_rieng?: string | null };
      setDaLuu({ ghiChu: k.ghi_chu ?? "", ghiChuRieng: k.ghi_chu_rieng ?? "" });
      setLoi("");
    },
    loi: (_v, _s, kq) => setLoi(kq.loi ?? "Không lưu được ghi chú"),
  }), [nhom]);

  function luu(k: (typeof O)[number]["k"], s: string) {
    if (s.trim() === daLuu[k].trim()) return;
    datViec({ khoa: `hs:${ma}:${k}`, nhom, url: `/api/hoc-sinh/${ma}`, method: "PATCH", body: { [k]: s.trim() || null } });
  }
  return (
    <div className="grid gap-3">
      {O.map((o) => (
        <div key={o.k}>
          <label htmlFor={`${id}-${o.k}`} className={nhan}>{o.nhan}</label>
          <textarea id={`${id}-${o.k}`} rows={3} maxLength={2000} value={v[o.k]} placeholder={o.goiY} onChange={(e) => setV((x) => ({ ...x, [o.k]: e.target.value }))} onBlur={(e) => luu(o.k, e.target.value)} className={`${oNhap} mt-1 py-2`} />
          <p className="text-[13px] text-text-3" aria-live="polite">{cho.some((x) => x.khoa.endsWith(`:${o.k}`)) ? "Đang lưu…" : "Lưu khi rời ô."}</p>
        </div>
      ))}
      {loi ? <p role="alert" className="text-[14px] text-danger">{loi}</p> : null}
    </div>
  );
}
