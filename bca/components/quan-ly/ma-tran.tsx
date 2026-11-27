"use client";
// Ma trận điểm danh tháng (man-diem-danh §7): ✓ có · P phép · K vắng · "·" chưa điểm · "–" không học ngày này.
// Ký hiệu khác nhau về hình, màu chỉ bổ trợ; mỗi ô có aria-label đầy đủ. Cột tên dính, tự cuộn tới cột hôm nay.
// Chạm ô → tờ trượt (điện thoại) / hộp thoại (máy tính): Có · Phép · Vắng · Về chưa điểm; quá 48 giờ hỏi xác nhận một lần cho cả cột.
// Sửa ô đi qua hàng đợi chung (khoá `dd:${buoiId}:${hsId}`, nhóm `dd:${buoiId}` — cùng khoá với màn một buổi): mất mạng vẫn giữ.
// Bàn phím: role="grid" + roving tabindex — cả bảng một điểm dừng Tab; mũi tên đi giữa ô/ngày/tên, Home/End đầu/cuối hàng,
// 1/2/3 = Có/Phép/Vắng, Delete = về chưa điểm, Enter mở hộp chọn. Cột quá 48 giờ chưa mở: 1/2/3/Delete cũng mở hộp hỏi
// xác nhận như Enter, và lựa chọn vừa bấm được ghi ngay sau "Mở sửa buổi".
import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { dangKyXuLy, datViec, layViec, nap, useHangDoi, viecCuaNhom } from "../khung/hang-doi";
import type { maTranThang } from "@/server/diem-danh";
import { chuoi, demDD, moDiemDanh, qua48Gio } from "@/lib/quy-tac";
import { thuDay, thuNgan, ddmm } from "../dinh-dang";
import { ToTruot } from "../ui/to-truot";
import { nutChinh, nutPhu } from "../ui/nut";
import { NUT_DD } from "./diem-danh-buoi";

type D = Awaited<ReturnType<typeof maTranThang>>;
type O = D["hang"][number]["o"][number];
// nen: tô nền ô theo trạng thái để nhìn ra ngay ai hay vắng (QĐ 27); ký hiệu vẫn là thông tin chính, màu chỉ bổ trợ.
const KY: Record<string, { k: string; mau: string; ten: string; nen: string }> = {
  co: { k: "✓", mau: "text-ok", ten: "có mặt", nen: "bg-ok-bg" },
  phep: { k: "P", mau: "text-excused", ten: "vắng có phép", nen: "bg-excused-bg" },
  vang: { k: "K", mau: "text-danger", ten: "vắng không phép", nen: "bg-danger-bg" },
  null: { k: "·", mau: "text-text-3", ten: "chưa điểm", nen: "" },
  "-": { k: "–", mau: "text-text-3", ten: "không học ngày này", nen: "" },
};

export function MaTran({ d, chiDangHoc, chu }: { d: D; chiDangHoc: boolean; chu: boolean }) {
  const [hang, setHang] = useState(d.hang);
  const [mo, setMo] = useState<{ r: number; c: number; t?: "co" | "phep" | "vang" | null } | null>(null);
  const [moCot, setMoCot] = useState<Set<number>>(new Set());
  const [loi, setLoi] = useState("");
  const [goiY, setGoiY] = useState(false);
  const khung = useRef<HTMLDivElement>(null);
  const luc = Date.now();
  // Cột hôm nay, hoặc buổi gần nhất đã qua.
  const cotNay = d.buoi.reduce((k, b, i) => (b.ngay <= d.hom_nay && b.trang_thai !== "huy" ? i : k), -1);
  const [tieuDiem, setTieuDiem] = useState({ r: 0, c: cotNay });
  useHangDoi(); // vẽ lại chấm "chưa gửi" khi hàng đợi đổi
  const moCotRef = useRef(moCot);
  useEffect(() => { moCotRef.current = moCot; }, [moCot]);

  // Thay đổi còn chờ (từ lần mở trước hoặc màn một buổi) → phủ lên dữ liệu máy chủ; lỗi từ máy chủ → trả ô về giá trị gốc.
  useEffect(() => {
    let huy = false;
    const cot = new Map(d.buoi.map((b, c) => [b.id, c]));
    const dong = new Map(d.hang.map((h, r) => [h.hoc_sinh_id, r]));
    const doiO = (buoiId: number, hsId: number, t: O) => {
      const c = cot.get(buoiId), r = dong.get(hsId);
      if (c === undefined || r === undefined) return;
      setHang((x) => x.map((h, i) => (i === r ? { ...h, o: h.o.map((v, j) => (j === c ? t : v)) } : h)));
    };
    void nap().then(() => {
      if (huy) return;
      for (const b of d.buoi) for (const v of viecCuaNhom(`dd:${b.id}`)) if ("trangThai" in v.body) doiO(b.id, Number(v.body.hocSinhId), v.body.trangThai as O);
    });
    const go = d.buoi.map((b) => dangKyXuLy(`dd:${b.id}`, {
      loi: (v, _s, kq) => {
        const hsId = Number(v.body.hocSinhId), c = cot.get(b.id), r = dong.get(hsId);
        if (c === undefined || r === undefined) return;
        doiO(b.id, hsId, d.hang[r].o[c]);
        if (kq.ma === "can_xac_nhan_48h") setMoCot((s) => { const n = new Set(s); n.delete(c); return n; });
        setLoi(`Không lưu được ô của ${d.hang[r].ho_ten} ngày ${ddmm(b.ngay)}: ${kq.loi ?? "lỗi máy chủ"}. Ô đã trả về như cũ.`);
      },
    }));
    return () => { huy = true; go.forEach((f) => f()); };
  }, [d]);

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

  function dat(r: number, c: number, t: "co" | "phep" | "vang" | null, xn = false) {
    const b = d.buoi[c];
    const hsId = hang[r].hoc_sinh_id;
    setHang((x) => x.map((h, i) => (i === r ? { ...h, o: h.o.map((v, j) => (j === c ? t : v)) } : h)));
    setMo(null);
    setLoi("");
    const khoa = `dd:${b.id}:${hsId}`;
    const body = t === null ? { hocSinhId: hsId, trangThai: null } : { ...layViec(khoa)?.body, hocSinhId: hsId, trangThai: t };
    datViec({ khoa, nhom: `dd:${b.id}`, url: `/api/diem-danh/${b.id}`, method: "PUT", body: { ...body, ...(xn || moCotRef.current.has(c) ? { xacNhan: true } : {}) } });
  }

  // Toạ độ roving: hàng -1 = đầu bảng (ngày), cột -1 = tên học sinh. Ô không có phần tử (lớp nghỉ, góc) bị bỏ qua.
  const td = { r: Math.min(tieuDiem.r, hienThi.length - 1), c: tieuDiem.c };
  const roving = (r: number, c: number) => ({
    "data-o": `${r}:${c}`,
    tabIndex: td.r === r && td.c === c ? 0 : -1,
    onFocus: () => setTieuDiem({ r, c }),
    onKeyDown: (e: KeyboardEvent) => phim(e, r, c),
  });
  function phim(e: KeyboardEvent, vr: number, c: number) {
    const toi = (r: number, cc: number, dr: number, dc: number) => {
      for (let i = 0; i < 80; i++, r += dr, cc += dc) {
        if (r < -1 || r >= hienThi.length || cc < -1 || cc >= d.buoi.length) return;
        const o = khung.current?.querySelector<HTMLElement>(`[data-o="${r}:${cc}"]`);
        if (o) { e.preventDefault(); setTieuDiem({ r, c: cc }); o.focus(); return; }
      }
    };
    if (e.key === "ArrowRight") toi(vr, c + 1, 0, 1);
    else if (e.key === "ArrowLeft") toi(vr, c - 1, 0, -1);
    else if (e.key === "ArrowDown") toi(vr + 1, c, 1, 0);
    else if (e.key === "ArrowUp") toi(vr - 1, c, -1, 0);
    else if (e.key === "Home") toi(vr, -1, 0, 1);
    else if (e.key === "End") toi(vr, d.buoi.length - 1, 0, -1);
    if (vr < 0 || c < 0) return;
    const { r } = hienThi[vr];
    if (!suaDuoc(c, hang[r].o[c])) return;
    const t = ["1", "2", "3"].includes(e.key) ? NUT_DD[Number(e.key) - 1].v : e.key === "Delete" || e.key === "Backspace" ? null : undefined;
    if (t === undefined) return;
    e.preventDefault();
    if (can48(c)) setMo({ r, c, t }); // hỏi xác nhận như Enter; ghi lựa chọn sau khi mở sửa
    else dat(r, c, t);
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
        <div ref={khung} className="max-h-[calc(100dvh-220px)] w-fit max-w-full overflow-auto rounded-[14px] border border-border bg-surface">
          <table role="grid" className="border-separate border-spacing-0 text-[15px]">
            <caption className="sr-only">Ma trận điểm danh {d.mon.ten} tháng {d.thang.slice(5)}/{d.thang.slice(0, 4)}</caption>
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 top-0 z-20 w-32 min-w-32 border-b border-r border-border bg-surface px-3 text-left text-[13px] font-semibold text-text-2 lg:w-[220px] lg:min-w-[220px]">Học sinh</th>
                {d.buoi.map((b, c) => {
                  const nay = b.ngay === d.hom_nay; // chỉ tô vàng khi buổi đúng là hôm nay (cột gần nhất vẫn được cuộn tới)
                  if (b.trang_thai === "huy") {
                    return <th key={b.id} scope="col" data-cot={c} aria-label={`Lớp nghỉ ${thuDay(b.ngay)} ${ddmm(b.ngay)}`} className="sticky top-0 z-10 w-7 min-w-7 border-b border-border bg-surface text-[11px] font-semibold text-text-3"><span aria-hidden="true">Nghỉ</span></th>;
                  }
                  return (
                    <th key={b.id} scope="col" data-cot={c} className={`sticky top-0 z-10 min-w-11 border-b border-border p-0 text-[12px] font-semibold ${nay ? "bg-today-col text-gold" : "bg-surface text-text-2"}`}>
                      <Link {...roving(-1, c)} href={`/quan-ly/diem-danh/${b.id}`} className="so flex min-h-12 flex-col items-center justify-center leading-tight hover:underline" aria-label={`Điểm danh buổi ${thuDay(b.ngay)} ${ddmm(b.ngay)}${b.loai === "hoc_bu" ? ", học bù" : ""}`}>
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
                      <Link {...roving(vr, -1)} href={`/quan-ly/hoc-sinh/${h.ma_hs}`} className="block leading-snug hover:underline" translate="no">{h.ho_ten}</Link>
                      {h.loai === "thu" ? <span className="text-[12px] font-semibold text-trial-fg">· thử</span> : null}
                      {!h.dang_hoc ? <span className="text-[12px] text-text-3"> · đã nghỉ</span> : null}
                    </th>
                    {h.o.map((v, col) => {
                      const b = d.buoi[col];
                      if (v === "huy") return <td key={b.id} aria-label="Lớp nghỉ" className="border-b border-border bg-[repeating-linear-gradient(135deg,transparent_0_6px,var(--border)_6px_7px)]" />;
                      const ky = KY[String(v)];
                      const nhanO = `${h.ho_ten}, ${thuDay(b.ngay)} ${ddmm(b.ngay)}: ${ky.ten}`;
                      const sua = suaDuoc(col, v);
                      const choGui = !!layViec(`dd:${b.id}:${h.hoc_sinh_id}`);
                      return (
                        <td key={b.id} className={`border-b border-r border-border p-0 text-center ${ky.nen || (b.ngay === d.hom_nay ? "bg-today-col" : "")}`}>
                          {sua ? (
                            <button type="button" {...roving(vr, col)} aria-label={`${nhanO}${choGui ? ", chưa gửi" : ""}`} onClick={() => setMo({ r, c: col })} className={`so relative flex h-12 w-11 items-center justify-center font-semibold hover:brightness-95 lg:h-11 ${ky.mau}`}>
                              <span aria-hidden="true">{ky.k}</span>
                              {choGui ? <span aria-hidden="true" className="absolute right-1 top-1 size-1.5 rounded-full border border-text-3" /> : null}
                            </button>
                          ) : (
                            <span role="img" {...roving(vr, col)} aria-label={nhanO} className={`so flex h-12 w-11 items-center justify-center font-semibold lg:h-11 ${ky.mau}`}>{ky.k}</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="so border-b border-border px-2 text-center leading-tight">{c.co}/{c.co + c.phep + c.vang}{c.co + c.phep + c.vang ? <span className={`block text-[12px] font-semibold ${c.vang >= 2 ? "text-danger" : "text-text-3"}`}>{Math.round((c.co / (c.co + c.phep + c.vang)) * 100)}%</span> : null}</td>
                    <td className="so border-b border-border px-2 text-center">{chuoi(tt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-text-2">
        {(["co", "phep", "vang"] as const).map((k) => <span key={k} className="inline-flex items-center gap-1.5"><span aria-hidden="true" className={`inline-flex size-5 items-center justify-center rounded-[4px] font-semibold ${KY[k].nen} ${KY[k].mau}`}>{KY[k].k}</span>{KY[k].ten}</span>)}
        <span>· chưa điểm</span><span>– không học ngày này</span><span>% đỏ: vắng từ 2 buổi</span>
      </p>

      <ToTruot mo={!!oMo} dong={() => setMo(null)} tieuDe={oMo ? <><span translate="no">{oMo.h.ho_ten}</span> · <span className="so">{thuNgan(oMo.b.ngay)} {ddmm(oMo.b.ngay)}</span></> : ""}>
        {oMo && mo ? (
          can48(mo.c) ? (
            <div className="grid gap-3">
              <p className="rounded-[14px] bg-warn-bg px-3 py-2">Buổi đã qua 48 giờ. Sửa sẽ đổi {chu ? "chuyên cần và học phí" : "chuyên cần"}; chỉ hỏi một lần cho cả cột này.{mo.t !== undefined ? ` Mở sửa sẽ ghi luôn “${mo.t ? NUT_DD.find((n) => n.v === mo.t)!.nhan : "Về chưa điểm"}”.` : ""}</p>
              <button type="button" className={nutChinh} onClick={() => { setMoCot((s) => new Set(s).add(mo.c)); if (mo.t !== undefined) dat(mo.r, mo.c, mo.t, true); }}>Mở sửa buổi {ddmm(oMo.b.ngay)}</button>
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
