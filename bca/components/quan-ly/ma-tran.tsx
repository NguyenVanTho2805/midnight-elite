"use client";
// Ma trận điểm danh tháng (man-diem-danh §7): ✓ có · P phép · K vắng · "·" chưa điểm · "–" không học ngày này.
// Ký hiệu khác nhau về hình, màu chỉ bổ trợ; mỗi ô có aria-label đầy đủ. Cột tên dính, tự cuộn tới cột hôm nay.
// Chạm ô → tờ trượt (điện thoại) / hộp thoại (máy tính): Có · Phép · Vắng · Về chưa điểm; quá 48 giờ hỏi xác nhận một lần cho cả cột.
import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { maTranThang } from "@/server/diem-danh";
import { chuoi, demDD, moDiemDanh, qua48Gio } from "@/lib/quy-tac";
import { thuDay, thuNgan, ddmm } from "../dinh-dang";
import { ToTruot } from "../ui/to-truot";
import { nutChinh, nutPhu } from "../ui/nut";
import { NUT_DD } from "./diem-danh-buoi";

type D = Awaited<ReturnType<typeof maTranThang>>;
type O = D["hang"][number]["o"][number];
const KY: Record<string, { k: string; mau: string; ten: string }> = {
  co: { k: "✓", mau: "text-ok", ten: "có mặt" },
  phep: { k: "P", mau: "text-excused", ten: "vắng có phép" },
  vang: { k: "K", mau: "text-danger", ten: "vắng không phép" },
  null: { k: "·", mau: "text-text-3", ten: "chưa điểm" },
  "-": { k: "–", mau: "text-text-3", ten: "không học ngày này" },
};

export function MaTran({ d, chiDangHoc }: { d: D; chiDangHoc: boolean }) {
  const [hang, setHang] = useState(d.hang);
  const [mo, setMo] = useState<{ r: number; c: number } | null>(null);
  const [moCot, setMoCot] = useState<Set<number>>(new Set());
  const [loi, setLoi] = useState("");
  const [goiY, setGoiY] = useState(false);
  const khung = useRef<HTMLDivElement>(null);
  const luc = Date.now();
  // Cột hôm nay, hoặc buổi gần nhất đã qua.
  const cotNay = d.buoi.reduce((k, b, i) => (b.ngay <= d.hom_nay && b.trang_thai !== "huy" ? i : k), -1);

  useEffect(() => {
    const el = khung.current?.querySelector<HTMLElement>(`[data-cot="${cotNay}"]`);
    const k = khung.current;
    if (el && k) k.scrollLeft = Math.max(0, el.offsetLeft - k.clientWidth / 2);
    if (!localStorage.getItem("bca-goi-y-vuot")) { setGoiY(true); localStorage.setItem("bca-goi-y-vuot", "1"); }
  }, [cotNay]);

  const hienThi = hang.map((h, r) => ({ h, r })).filter(({ h }) => !chiDangHoc || h.dang_hoc);
  const suaDuoc = (c: number, o: O) => {
    const b = d.buoi[c];
    return b.trang_thai !== "huy" && o !== "-" && o !== "huy" && moDiemDanh(new Date(b.bat_dau_luc), new Date(luc));
  };
  const can48 = (c: number) => qua48Gio(new Date(d.buoi[c].bat_dau_luc), new Date(luc)) && !moCot.has(c);

  async function dat(r: number, c: number, t: "co" | "phep" | "vang" | null) {
    const b = d.buoi[c];
    const cu = hang[r].o[c];
    setHang((x) => x.map((h, i) => (i === r ? { ...h, o: h.o.map((v, j) => (j === c ? t : v)) } : h)));
    setMo(null);
    setLoi("");
    try {
      const res = await fetch(`/api/diem-danh/${b.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hocSinhId: hang[r].hoc_sinh_id, trangThai: t, xacNhan: moCot.has(c) }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).loi ?? `Lỗi ${res.status}`);
    } catch (e) {
      setHang((x) => x.map((h, i) => (i === r ? { ...h, o: h.o.map((v, j) => (j === c ? cu : v)) } : h)));
      setLoi(`Không lưu được ô của ${hang[r].ho_ten} ngày ${ddmm(b.ngay)}: ${(e as Error).message}. Kiểm tra mạng rồi thử lại.`);
    }
  }

  function phim(e: KeyboardEvent, vr: number, c: number) {
    const di = (nr: number, nc: number) => {
      const o = khung.current?.querySelector<HTMLElement>(`[data-o="${nr}-${nc}"]`);
      if (o) { e.preventDefault(); o.focus(); }
    };
    const { r } = hienThi[vr];
    if (e.key === "ArrowRight") di(vr, c + 1);
    else if (e.key === "ArrowLeft") di(vr, c - 1);
    else if (e.key === "ArrowDown") di(vr + 1, c);
    else if (e.key === "ArrowUp") di(vr - 1, c);
    else if (suaDuoc(c, hang[r].o[c]) && !can48(c)) {
      if (["1", "2", "3"].includes(e.key)) { e.preventDefault(); void dat(r, c, NUT_DD[Number(e.key) - 1].v); }
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); void dat(r, c, null); }
    }
  }

  const oMo = mo ? { h: hang[mo.r], b: d.buoi[mo.c], v: hang[mo.r].o[mo.c] } : null;
  return (
    <>
      {loi ? <p role="alert" className="mb-3 rounded-[14px] bg-danger-bg px-4 py-3">{loi}</p> : null}
      {goiY ? <p className="mb-2 text-[13px] text-text-3 sm:hidden">Vuốt ngang để xem các buổi khác.</p> : null}
      {!d.buoi.length ? (
        <p className="rounded-[14px] border border-border bg-surface px-4 py-6 text-text-2">Tháng này chưa có buổi {d.mon.ten}. — <Link className="font-semibold text-gold hover:underline" href="/quan-ly/buoi-hoc">Mở Buổi học</Link></p>
      ) : !hienThi.length ? (
        <p className="rounded-[14px] border border-border bg-surface px-4 py-6 text-text-2">Chưa có em nào học {d.mon.ten} trong tháng này.</p>
      ) : (
        <div ref={khung} className="max-h-[calc(100dvh-220px)] overflow-auto rounded-[14px] border border-border bg-surface">
          <table className="border-separate border-spacing-0 text-[15px]">
            <caption className="sr-only">Ma trận điểm danh {d.mon.ten} tháng {d.thang.slice(5)}/{d.thang.slice(0, 4)}</caption>
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 top-0 z-20 w-32 min-w-32 border-b border-r border-border bg-surface px-3 text-left text-[13px] font-semibold text-text-2 lg:w-[220px] lg:min-w-[220px]">Học sinh</th>
                {d.buoi.map((b, c) => {
                  const nay = c === cotNay;
                  if (b.trang_thai === "huy") {
                    return <th key={b.id} scope="col" data-cot={c} aria-label={`Lớp nghỉ ${thuDay(b.ngay)} ${ddmm(b.ngay)}`} className="sticky top-0 z-10 w-7 min-w-7 border-b border-border bg-surface text-[11px] font-semibold text-text-3"><span aria-hidden="true">Nghỉ</span></th>;
                  }
                  return (
                    <th key={b.id} scope="col" data-cot={c} className={`sticky top-0 z-10 min-w-11 border-b border-border p-0 text-[12px] font-semibold ${nay ? "bg-today-col text-gold" : "bg-surface text-text-2"}`}>
                      <Link href={`/quan-ly/diem-danh/${b.id}`} className="so flex min-h-12 flex-col items-center justify-center leading-tight hover:underline" aria-label={`Điểm danh buổi ${thuDay(b.ngay)} ${ddmm(b.ngay)}${b.loai === "hoc_bu" ? ", học bù" : ""}`}>
                        <span>{thuNgan(b.ngay)}{b.loai === "hoc_bu" ? "·bù" : ""}</span>
                        <span>{b.ngay.slice(8)}</span>
                      </Link>
                    </th>
                  );
                })}
                <th scope="col" className="sticky top-0 z-10 border-b border-l border-border bg-surface px-2 text-[13px] font-semibold text-text-2">Có mặt</th>
                <th scope="col" className="sticky top-0 z-10 border-b border-border bg-surface px-2 text-[13px] font-semibold text-text-2">Chuỗi</th>
              </tr>
            </thead>
            <tbody>
              {hienThi.map(({ h, r }, vr) => {
                const tt = h.o.map((v) => (v === "-" || v === "huy" ? null : v));
                const c = demDD(tt);
                return (
                  <tr key={h.hoc_sinh_id} className="hang-dai hover:bg-row-hover">
                    <th scope="row" className="sticky left-0 z-10 border-b border-r border-border bg-surface px-3 py-1 text-left font-semibold">
                      <Link href={`/quan-ly/hoc-sinh/${h.ma_hs}`} className="block leading-snug hover:underline" translate="no">{h.ho_ten}</Link>
                      {h.loai === "thu" ? <span className="text-[12px] font-semibold text-trial-fg">· thử</span> : null}
                      {!h.dang_hoc ? <span className="text-[12px] text-text-3"> · đã nghỉ</span> : null}
                    </th>
                    {h.o.map((v, col) => {
                      const b = d.buoi[col];
                      if (v === "huy") return <td key={b.id} aria-label="Lớp nghỉ" className="border-b border-border bg-[repeating-linear-gradient(135deg,transparent_0_6px,var(--border)_6px_7px)]" />;
                      const ky = KY[String(v)];
                      const nhanO = `${h.ho_ten}, ${thuDay(b.ngay)} ${ddmm(b.ngay)}: ${ky.ten}`;
                      const sua = suaDuoc(col, v);
                      return (
                        <td key={b.id} className={`border-b border-border p-0 text-center ${col === cotNay ? "bg-today-col" : ""}`}>
                          {sua ? (
                            <button type="button" data-o={`${vr}-${col}`} aria-label={nhanO} onKeyDown={(e) => phim(e, vr, col)} onClick={() => setMo({ r, c: col })} className={`so flex h-12 w-11 items-center justify-center font-semibold hover:bg-raised lg:h-11 ${ky.mau}`}>
                              <span aria-hidden="true">{ky.k}</span>
                            </button>
                          ) : (
                            <span role="img" data-o={`${vr}-${col}`} tabIndex={-1} aria-label={nhanO} onKeyDown={(e) => phim(e, vr, col)} className={`so flex h-12 w-11 items-center justify-center font-semibold lg:h-11 ${ky.mau}`}>{ky.k}</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="so border-b border-l border-border px-2 text-center">{c.co}/{c.co + c.phep + c.vang}</td>
                    <td className="so border-b border-border px-2 text-center">{chuoi(tt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-[13px] text-text-2"><span className="text-ok">✓</span> có mặt · <span className="text-excused">P</span> vắng có phép · <span className="text-danger">K</span> vắng không phép · · chưa điểm · – không học ngày này</p>

      <ToTruot mo={!!oMo} dong={() => setMo(null)} tieuDe={oMo ? <><span translate="no">{oMo.h.ho_ten}</span> · <span className="so">{thuNgan(oMo.b.ngay)} {ddmm(oMo.b.ngay)}</span></> : ""}>
        {oMo && mo ? (
          can48(mo.c) ? (
            <div className="grid gap-3">
              <p className="rounded-[14px] bg-warn-bg px-3 py-2">Buổi đã qua 48 giờ. Sửa sẽ đổi chuyên cần và học phí; chỉ hỏi một lần cho cả cột này.</p>
              <button type="button" className={nutChinh} onClick={() => setMoCot((s) => new Set(s).add(mo.c))}>Mở sửa buổi {ddmm(oMo.b.ngay)}</button>
              <button type="button" className={nutPhu} onClick={() => setMo(null)}>Để nguyên</button>
            </div>
          ) : (
            <div className="grid gap-3">
              <div className="grid grid-cols-3 gap-2">
                {NUT_DD.map((n) => (
                  <button key={n.v} type="button" aria-pressed={oMo.v === n.v} onClick={() => dat(mo.r, mo.c, n.v)} className={`nhan h-14 rounded-[14px] border text-base font-semibold ${oMo.v === n.v ? n.chon : "border-border-input text-text-2"}`}>{n.nhan}</button>
                ))}
              </div>
              <button type="button" className={nutPhu} onClick={() => dat(mo.r, mo.c, null)} disabled={oMo.v === null}>Về chưa điểm</button>
            </div>
          )
        ) : null}
      </ToTruot>
    </>
  );
}
