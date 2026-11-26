"use client";
// Hộp thoại Gia hạn thử một hoặc nhiều em (man-hoc-sinh §9.1, T4, T29). Chỉ chủ lớp (máy chủ vẫn chặn).
// Lý do bắt buộc; xong thì thanh Hoàn tác 5 giây. Cần có mạng (không xếp hàng đợi).
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { congNgay } from "@/lib/ngay";
import { ddmm } from "../dinh-dang";
import { ToTruot } from "../ui/to-truot";
import { nhan, nutChinh, nutPhu, oNhap } from "../ui/nut";
import { useHoanTac } from "../khung/hoan-tac";
import { useHangDoi } from "../khung/hang-doi";
import { NgayDoc } from "../ui/ngay-doc";

export type EmGiaHan = { ma_hs: string; ho_ten: string; mon: string[]; den: string | null; het?: string | null };
const CHON = [3, 7, 14] as const;

export function GiaHan({ em, homNay, mo, dong, xong }: { em: EmGiaHan[]; homNay: string; mo: boolean; dong: () => void; xong?: () => void }) {
  const [kieu, setKieu] = useState<(typeof CHON)[number] | "ngay">(7);
  const [ngay, setNgay] = useState("");
  const [lyDo, setLyDo] = useState("");
  const [loi, setLoi] = useState("");
  const [dang, setDang] = useState(false);
  const router = useRouter();
  const { hien } = useHoanTac();
  const mang = useHangDoi();
  const id = useId();

  const denMoi = (e: EmGiaHan) => (kieu === "ngay" ? ngay : e.den ? congNgay(e.den, kieu) : congNgay(homNay, kieu - 1));
  const nhom = new Map<string, number>();
  for (const e of em) nhom.set(denMoi(e), (nhom.get(denMoi(e)) ?? 0) + 1);

  async function gui() {
    if (!lyDo.trim()) return setLoi("Cần ghi lý do gia hạn (ví dụ: Em bận thi giữa kỳ).");
    if (kieu === "ngay" && (!ngay || ngay < homNay)) return setLoi("Chọn ngày hết từ hôm nay trở đi.");
    setLoi("");
    setDang(true);
    try {
      const r = await fetch("/api/gia-han", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ maHs: em.map((e) => e.ma_hs), ...(kieu === "ngay" ? { denNgay: ngay } : { soNgay: kieu }), lyDo: lyDo.trim() }),
      });
      const kq = await r.json().catch(() => ({}));
      if (!r.ok) return setLoi(kq.loi ?? `Không gia hạn được (mã ${r.status}).`);
      const ketQua = kq.ketQua as { ma_hs: string; den_moi: string }[];
      dong();
      setLyDo("");
      xong?.();
      router.refresh();
      hien({
        thongDiep: em.length === 1 ? `Đã gia hạn ${em[0].ho_ten} tới ${ddmm(ketQua[0]?.den_moi ?? denMoi(em[0]))}` : `Đã gia hạn ${em.length} em`,
        hoanTac: async () => {
          const h = await fetch("/api/gia-han/hoan-tac", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ nhatKyId: kq.nhatKyId }) });
          const k = await h.json().catch(() => ({}));
          hien({ thongDiep: h.ok ? `Đã hoàn tác gia hạn${k.boQua ? ` (${k.boQua} dòng đã bị sửa sau đó, giữ nguyên)` : ""}` : (k.loi ?? "Không hoàn tác được") });
          router.refresh();
        },
      });
    } catch {
      setLoi("Không gửi được — kiểm tra mạng rồi thử lại.");
    } finally {
      setDang(false);
    }
  }

  const mot = em.length === 1 ? em[0] : null;
  return (
    <ToTruot
      mo={mo}
      dong={dong}
      tieuDe={mot ? `Gia hạn thử · ${mot.ho_ten}` : `Gia hạn thử · ${em.length} em`}
      chan={
        mang.matMang ? (
          <p className="py-2 text-warn">Cần có mạng để gia hạn.</p>
        ) : (
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" className={nutPhu} onClick={dong}>Huỷ</button>
            <button type="button" className={nutChinh} onClick={gui} disabled={dang}>{dang ? "Đang gia hạn…" : "Gia hạn"}</button>
          </div>
        )
      }
    >
      {mot ? (
        <p className="text-text-2">Áp cho: {mot.mon.join(", ") || "các môn đang thử"} {mot.den ? `(đang hết ${ddmm(mot.den)})` : mot.het ? `(đã hết ${mot.het})` : ""}</p>
      ) : (
        <p className="text-text-2">Áp cho mọi môn đang thử của từng em.</p>
      )}
      <fieldset className="mt-4">
        <legend className={nhan}>Thêm</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {CHON.map((n) => (
            <button key={n} type="button" aria-pressed={kieu === n} onClick={() => setKieu(n)} className={`nhan min-h-11 rounded-[10px] border px-4 font-semibold so ${kieu === n ? "border-gold bg-nav-active text-gold" : "border-border-input text-text-2"}`}>
              +{n} ngày
            </button>
          ))}
          <button type="button" aria-pressed={kieu === "ngay"} onClick={() => setKieu("ngay")} className={`nhan min-h-11 rounded-[10px] border px-4 font-semibold ${kieu === "ngay" ? "border-gold bg-nav-active text-gold" : "border-border-input text-text-2"}`}>
            Chọn ngày hết
          </button>
        </div>
      </fieldset>
      {kieu === "ngay" ? (
        <label className="mt-3 block">
          <span className={nhan}>Ngày hết mới</span>
          <input type="date" min={homNay} value={ngay} onChange={(e) => setNgay(e.target.value)} className={`${oNhap} mt-1 so`} aria-describedby={`${id}-ngay`} />
        </label>
      ) : null}
      {kieu === "ngay" ? <NgayDoc ngay={ngay} id={`${id}-ngay`} /> : null}
      <div className="mt-4 rounded-[14px] bg-raised px-3 py-2 text-[14px] so" aria-live="polite">
        {mot ? (
          mot.den ? `${mot.mon.join(", ") || "Môn thử"}: ${ddmm(mot.den)} → ${denMoi(mot) ? ddmm(denMoi(mot)) : "…"}` : `Thử lại ${ddmm(homNay)} → ${denMoi(mot) ? ddmm(denMoi(mot)) : "…"} (không mở lại các ngày đã qua)`
        ) : (
          <ul>{[...nhom].sort().map(([d, n]) => <li key={d}>{n} em → {d ? ddmm(d) : "…"}</li>)}</ul>
        )}
      </div>
      <label className="mt-4 block" htmlFor={id}>
        <span className={nhan}>Lý do (bắt buộc)</span>
      </label>
      <input id={id} value={lyDo} onChange={(e) => { setLyDo(e.target.value); setLoi(""); }} placeholder="Em bận thi giữa kỳ" className={`${oNhap} mt-1`} aria-invalid={!!loi && !lyDo.trim()} aria-describedby={loi ? `${id}-loi` : undefined} autoComplete="off" />
      {loi ? <p id={`${id}-loi`} role="alert" className="mt-2 text-danger">{loi}</p> : null}
    </ToTruot>
  );
}
