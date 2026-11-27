"use client";
// Ma trận điểm danh tháng một môn (KiN lớp bước 5, Figma FyUkgGJHrhXo0u4gnREyfk 9:1322). Ô tô nền theo trạng thái; cột "Có mặt" = có/đã điểm · %.
// Bấm một ô để sửa: thanh chọn Có · Phép · Vắng · Chưa điểm hiện ở đáy (lưu ngay; buổi quá 48 giờ hỏi xác nhận). Hai công tắc sắp / lọc chỉ đổi cách xem.
import Link from "next/link";
import { useState } from "react";
import { useKinConfirm } from "@/components/kin";
import type { maTranThang } from "@/lib/lop/server/diem-danh";
import { ddmm } from "@/lib/lop/ngay";
import { thuNganNgay } from "@/lib/lop/dinh-dang";

type D = Awaited<ReturnType<typeof maTranThang>>;
type O = D["hang"][number]["o"][number];
type TT = "co" | "phep" | "vang";
const TEN: Record<TT, string> = { co: "Có mặt", phep: "Vắng có phép", vang: "Vắng không phép" };
const KY: Record<TT, string> = { co: "✓", phep: "P", vang: "K" };
const NEN: Record<TT, { background: string; color: string }> = {
  co: { background: "var(--kin-tt-nen-xong)", color: "var(--kin-tt-chu-xong)" },
  phep: { background: "var(--kin-lop-tt-nen-phep)", color: "var(--kin-lop-tt-chu-phep)" },
  vang: { background: "var(--kin-tt-nen-loi)", color: "var(--kin-tt-chu-loi-dam)" },
};
const O_CHUNG = "inline-flex size-9 items-center justify-center rounded-[var(--kin-bo-sm)] text-[length:var(--kin-co-goc)] font-semibold";
const dem = (o: O[]) => ({ co: o.filter((x) => x === "co").length, phep: o.filter((x) => x === "phep").length, vang: o.filter((x) => x === "vang").length });

export function MaTran({ d, gocDiemDanh }: { d: D; gocDiemDanh: string }) {
  const [o, setO] = useState<Record<number, O[]>>(() => Object.fromEntries(d.hang.map((h) => [h.hoc_sinh_id, h.o])));
  const [vangDau, setVangDau] = useState(false);
  const [chiVang, setChiVang] = useState(false);
  const [mo, setMo] = useState<{ hs: number; c: number } | null>(null);
  const [dang, setDang] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);
  const { ask, dialog } = useKinConfirm();

  let hang = d.hang.map((h) => ({ ...h, o: o[h.hoc_sinh_id], ...dem(o[h.hoc_sinh_id]) }));
  if (chiVang) hang = hang.filter((h) => h.vang >= 2);
  if (vangDau) hang = [...hang].sort((a, b) => b.vang - a.vang); // sort ổn định: cùng số vắng giữ thứ tự tên
  const emMo = mo ? d.hang.find((h) => h.hoc_sinh_id === mo.hs) : null;

  async function dat(tt: TT | null, xacNhan = false) {
    if (!mo) return;
    setDang(true); setLoi(null);
    try {
      const r = await fetch(`/api/lop/diem-danh/${d.buoi[mo.c].id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ hocSinhId: mo.hs, trangThai: tt, ...(xacNhan ? { xacNhan: true } : {}) }) });
      const kq = await r.json().catch(() => ({}));
      if (r.status === 409 && kq.ma === "can_xac_nhan_48h" && !xacNhan) {
        setDang(false);
        if (await ask({ title: "Sửa điểm danh buổi đã qua 48 giờ?", message: `Buổi ${thuNganNgay(d.buoi[mo.c].ngay)} đã qua 48 giờ. Sửa sẽ đổi chuyên cần và học phí; lần sửa được ghi nhật ký.`, confirmLabel: "Vẫn sửa", cancelLabel: "Để nguyên", tone: "thuong" })) return dat(tt, true);
        return;
      }
      if (!r.ok) return setLoi(kq.error ?? "Không lưu được");
      setO((cu) => ({ ...cu, [mo.hs]: cu[mo.hs].map((x, i) => (i === mo.c ? tt : x)) }));
      setMo(null);
    } catch { setLoi("Mất mạng — chưa lưu được, thử lại khi có mạng."); } finally { setDang(false); }
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
        <button type="button" aria-pressed={vangDau} onClick={() => setVangDau(!vangDau)}
          className={`inline-flex min-h-11 items-center rounded-[var(--kin-bo-md)] border px-4 text-[length:var(--kin-co-goc)] font-medium ${vangDau ? "border-[var(--kin-nhan-nen)] bg-[var(--kin-nen-dang-chon)] text-[var(--kin-nhan-chu-tren-nhat)]" : "border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-trang)] text-[var(--kin-chu-chinh)]"}`}>Vắng nhiều lên đầu</button>
        <label className="inline-flex min-h-11 items-center gap-2 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]"><input type="checkbox" className="size-4" checked={chiVang} onChange={(e) => setChiVang(e.target.checked)} />Chỉ em vắng từ 2 buổi</label>
      </div>

      {!d.buoi.length ? <p className="mt-4 rounded-[var(--kin-bo-the)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-trang)] px-4 py-8 text-center text-[var(--kin-chu-phu)]">Tháng này chưa có buổi {d.mon.ten} nào.</p>
        : !hang.length ? <p className="mt-4 rounded-[var(--kin-bo-the)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-trang)] px-4 py-8 text-center text-[var(--kin-chu-phu)]">{chiVang ? "Không có em nào vắng không phép từ 2 buổi." : "Chưa có em nào học môn này trong tháng."}</p>
        : (
          <div className="mt-4 overflow-x-auto rounded-[var(--kin-bo-the)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-trang)]">
            <table className="w-full border-collapse text-[length:var(--kin-co-goc)]">
              <caption className="sr-only">Điểm danh {d.mon.ten} tháng {d.thang.slice(5)}/{d.thang.slice(0, 4)}</caption>
              <thead>
                <tr className="bg-[var(--kin-nen-bang)] text-[var(--kin-chu-mo)]">
                  <th scope="col" className="sticky left-0 z-10 min-w-44 bg-[var(--kin-nen-bang)] px-3 py-2 text-left font-medium">Học sinh</th>
                  {d.buoi.map((b) => (
                    <th key={b.id} scope="col" className="px-1 py-1 text-center font-medium tabular-nums">
                      <Link href={`${gocDiemDanh}/${b.id}`} className="inline-flex min-h-11 min-w-11 flex-col items-center justify-center rounded-[var(--kin-bo-sm)] leading-4 hover:bg-[var(--kin-nen-re-chuot)]" title="Mở điểm danh buổi này">
                        <span>{thuNganNgay(b.ngay).slice(0, 2)}</span><span>{ddmm(b.ngay)}</span><span className="sr-only">{b.trang_thai === "huy" ? " (lớp nghỉ)" : ""} — mở điểm danh buổi</span>
                      </Link>
                    </th>
                  ))}
                  <th scope="col" className="px-3 py-2 text-right font-medium">Có mặt</th>
                </tr>
              </thead>
              <tbody>
                {hang.map((h) => {
                  const tong = h.co + h.phep + h.vang;
                  return (
                    <tr key={h.hoc_sinh_id} className="border-t border-[var(--kin-vien-nhat)]">
                      <th scope="row" className="sticky left-0 z-10 bg-[var(--kin-nen-trang)] px-3 py-1.5 text-left font-semibold text-[var(--kin-chu-chinh)]"><span translate="no">{h.ho_ten}</span>{h.loai === "thu" ? <span className="ml-2 font-normal text-[var(--kin-chu-mo)]">thử</span> : null}</th>
                      {h.o.map((x, c) => (
                        <td key={c} className="px-1 py-1 text-center">
                          {x === "-" || x === "huy" ? <span className={`${O_CHUNG} text-[var(--kin-chu-mo)]`} title={x === "huy" ? "Lớp nghỉ" : "Không học buổi này"}><span aria-hidden>{x === "huy" ? "N" : "–"}</span><span className="sr-only">{x === "huy" ? "Lớp nghỉ" : "Không học buổi này"}</span></span> : (
                            <button type="button" onClick={() => { setMo({ hs: h.hoc_sinh_id, c }); setLoi(null); }} aria-pressed={mo?.hs === h.hoc_sinh_id && mo.c === c}
                              aria-label={`${h.ho_ten}, ${thuNganNgay(d.buoi[c].ngay)}: ${x ? TEN[x] : "Chưa điểm danh"} — bấm để sửa`}
                              className={`${O_CHUNG} size-11 border border-transparent focus-visible:outline-2 focus-visible:outline-[var(--kin-nhan-link)] aria-pressed:border-[var(--kin-nhan-nen)]`}
                              style={x ? NEN[x] : { background: "var(--kin-nen-bang)", color: "var(--kin-chu-mo)" }}>{x ? KY[x] : "·"}</button>
                          )}
                        </td>
                      ))}
                      <td className={`whitespace-nowrap px-3 text-right font-medium tabular-nums ${h.vang >= 2 ? "text-[var(--kin-tt-chu-loi-dam)]" : "text-[var(--kin-chu-chinh)]"}`}>{tong ? `${h.co}/${tong} · ${Math.round((h.co / tong) * 100)}%` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      <ul className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[length:var(--kin-co-phu)] text-[var(--kin-chu-phu)]">
        {(["co", "phep", "vang"] as const).map((k) => <li key={k} className="flex items-center gap-2"><span aria-hidden className={O_CHUNG} style={NEN[k]}>{KY[k]}</span>{TEN[k]}</li>)}
        <li className="flex items-center gap-2"><span aria-hidden className={O_CHUNG} style={{ background: "var(--kin-nen-bang)", color: "var(--kin-chu-mo)" }}>·</span>Chưa điểm danh</li>
        <li className="text-[var(--kin-tt-chu-loi-dam)]">Số đỏ ở cột Có mặt = vắng không phép từ 2 buổi</li>
      </ul>

      {mo && emMo ? (
        <div role="group" aria-label={`Sửa điểm danh ${emMo.ho_ten}`} className="sticky bottom-2 z-20 mt-4 rounded-[var(--kin-bo-the)] border border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-trang)] p-3 shadow-[var(--kin-bong-hop)]">
          <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]"><span translate="no" className="font-semibold">{emMo.ho_ten}</span> · <span className="tabular-nums">{thuNganNgay(d.buoi[mo.c].ngay)}</span></p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["co", "phep", "vang"] as const).map((k) => <button key={k} type="button" disabled={dang} aria-pressed={o[mo.hs][mo.c] === k} onClick={() => void dat(k)} className={`${O_CHUNG} h-11 w-auto min-w-20 border border-transparent px-3 aria-pressed:border-current`} style={NEN[k]}>{k === "co" ? "Có" : k === "phep" ? "Phép" : "Vắng"}</button>)}
            <button type="button" disabled={dang} onClick={() => void dat(null)} className={`${O_CHUNG} h-11 w-auto border border-[var(--kin-vien-o-nhap)] px-3 text-[var(--kin-chu-phu)]`}>Chưa điểm</button>
            <button type="button" onClick={() => setMo(null)} className={`${O_CHUNG} ml-auto h-11 w-auto px-3 text-[var(--kin-chu-mo)]`}>Đóng</button>
          </div>
          {loi ? <p role="alert" className="mt-2 text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi-dam)]">{loi}</p> : null}
        </div>
      ) : null}
      {dialog}
    </>
  );
}
