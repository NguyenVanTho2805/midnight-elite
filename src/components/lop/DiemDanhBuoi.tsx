"use client";
// Điểm danh một buổi (KiN lớp bước 5, Figma FyUkgGJHrhXo0u4gnREyfk 9:762 / mất mạng 9:883). Chép cơ chế từ bca/components/quan-ly/diem-danh-buoi.tsx:
// lưu ngay mỗi lần bấm qua hàng đợi (rớt mạng thì giữ trên máy, tự gửi lại), "Đánh tất cả có mặt" + Hoàn tác 5 giây, buổi quá 48 giờ hỏi một lần cho cả buổi.
// Một bố cục cho cả điện thoại (giáo viên) lẫn máy tính (chủ lớp): tên dòng trên, ba nút Có · Phép · Vắng cao 48px chia đều dòng dưới.
// Chưa chép: ghi chú từng em (T25), ô tìm tên, phím tắt bảng, tự làm mới 15 giây.
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { kinButtonClass, useKinConfirm } from "@/components/kin";
import type { chiTietDiemDanh } from "@/lib/lop/server/diem-danh";
import { gioVN } from "@/lib/lop/ngay";
import { tenMonDayDu, thuNgay, thuNganNgay } from "@/lib/lop/dinh-dang";
import { boViec, dangKyXuLy, datViec, khoiDongHangDoi, layViec, nap, thuLai, useHangDoi, viecCuaNhom } from "./hang-doi";

type D = Awaited<ReturnType<typeof chiTietDiemDanh>>;
type TT = "co" | "phep" | "vang";
type Loc = "tat" | "chua" | TT;
type TatCa = { khoa: string; doi: number[]; tay: Set<number>; huy: boolean; ids: number[] | null; luc: string | null };

const NUT: { v: TT; nhan: string; mau: string }[] = [
  { v: "co", nhan: "Có", mau: "var(--kin-lop-dd-co)" },
  { v: "phep", nhan: "Phép", mau: "var(--kin-lop-dd-phep)" },
  { v: "vang", nhan: "Vắng", mau: "var(--kin-lop-dd-vang)" },
];
const CHAM: Record<Loc, string> = { tat: "", chua: "var(--kin-tt-cham-cho)", co: "var(--kin-tt-cham-xong)", phep: "var(--kin-lop-tt-chu-phep)", vang: "var(--kin-tt-chu-loi)" };
const Dau = () => <svg aria-hidden width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8.5l3.2 3.2L13 4.8" /></svg>;
const HOAN_TAC_MS = 5000;

/** `day`: lớp Tailwind đặt mép dưới của thanh dính đáy — tuỳ vỏ (vỏ quản trị cuộn trong khung riêng ⇒ bottom-0; vỏ gia sư cuộn cả trang, có thanh tab dưới ở điện thoại). */
export function DiemDanhBuoi({ d, chu, nguoi, veHref, day = "bottom-0" }: { d: D; chu: boolean; nguoi: string; veHref: string; day?: string }) {
  const b = d.buoi, buoiId = b.id, nhom = `dd:${buoiId}`, api = `/api/lop/diem-danh/${buoiId}`;
  const [hang, setHang] = useState<Record<number, TT | null>>(() => Object.fromEntries(d.em.map((e) => [e.hoc_sinh_id, e.trang_thai])));
  const [moSua, setMoSua] = useState(false);
  const [loc, setLoc] = useState<Loc>("tat");
  const [chup, setChup] = useState<Set<number> | null>(null);
  const [loiHang, setLoiHang] = useState<Record<number, string>>({});
  const [bao, setBao] = useState<{ chu: string; hoanTac: boolean } | null>(null);
  const tatCa = useRef<TatCa | null>(null);
  const { ask, dialog } = useKinConfirm();
  const hd = useHangDoi(); // vẽ lại khi hàng đợi đổi ("Chờ gửi", "Đã lưu", khoá "Xong")
  const cho = viecCuaNhom(nhom).length;
  const qua48 = d.trang_thai_ghi === "qua_48h";
  const ghiDuoc = d.trang_thai_ghi === "mo" || (qua48 && moSua);
  const batDau = new Date(b.bat_dau_luc).getTime();
  const tenMon = tenMonDayDu(b.mon.ma, b.mon.ten);

  useEffect(() => { khoiDongHangDoi(nguoi); }, [nguoi]);
  // Thay đổi còn chờ từ lần mở trước → phủ lên dữ liệu máy chủ.
  useEffect(() => {
    let huy = false;
    void nap().then(() => {
      const vs = viecCuaNhom(nhom);
      if (huy || !vs.length) return;
      setHang((h) => {
        const n = { ...h };
        for (const v of vs) { const id = Number(v.body.hocSinhId); if (id && id in n && "trangThai" in v.body) n[id] = v.body.trangThai as TT | null; }
        return n;
      });
    });
    return () => { huy = true; };
  }, [nhom]);
  // Thanh báo / Hoàn tác tự đóng sau 5 giây.
  useEffect(() => { if (!bao) return; const t = setTimeout(() => setBao(null), HOAN_TAC_MS); return () => clearTimeout(t); }, [bao]);

  const guiHoanTac = useCallback((t: TatCa) => {
    if (!t.ids?.length || !t.luc) return; // máy chủ lấy danh sách em từ nhật ký của chính người đó, chỉ cần `luc`
    datViec({ khoa: `hoantac:${buoiId}:${t.luc}`, nhom, url: `${api}/hoan-tac`, method: "POST", body: { luc: t.luc } });
  }, [buoiId, nhom, api]);

  // Kết quả gửi từ hàng đợi.
  useEffect(() => dangKyXuLy(nhom, {
    ok: (v, kq) => {
      if (!v.khoa.startsWith("tatca:")) return;
      const k = kq as { ids?: number[]; luc?: string };
      const t = tatCa.current?.khoa === v.khoa ? tatCa.current : null;
      if (t) { t.ids = k.ids ?? []; t.luc = k.luc ?? null; if (t.huy) guiHoanTac(t); }
    },
    loi: (v, _s, kq) => {
      const id = Number(v.body.hocSinhId);
      if (id) setLoiHang((l) => ({ ...l, [id]: kq.error ?? "Không lưu được" }));
      else setBao({ chu: kq.error ?? "Không lưu được", hoanTac: false });
      if (kq.ma === "can_xac_nhan_48h") setMoSua(false);
    },
  }), [nhom, guiHoanTac]);

  /** Buổi quá 48 giờ: hỏi MỘT lần cho cả buổi; đồng ý thì lựa chọn vừa chạm được ghi ngay. */
  async function duocGhi() {
    if (ghiDuoc) return true;
    if (!qua48) return false;
    const ngayQua = Math.floor((Date.now() - batDau) / 86400_000);
    // GV không thấy học phí — câu cảnh báo 48 giờ không nhắc học phí.
    const ok = await ask({
      title: "Sửa điểm danh buổi đã qua 48 giờ?", tone: "thuong", confirmLabel: "Mở sửa cả buổi", cancelLabel: "Để nguyên",
      message: `Buổi ${tenMon} ${thuNgay(b.ngay)} đã qua ${ngayQua} ngày. Sửa điểm danh sẽ đổi ${chu ? "chuyên cần và học phí" : "chuyên cần"}; mọi lần sửa đều ghi nhật ký. Chỉ hỏi một lần cho cả buổi.`,
    });
    if (ok) setMoSua(true);
    return ok;
  }
  const xn = qua48 ? { xacNhan: true } : {};

  async function danh(id: number, t: TT) {
    if (hang[id] === t || !(await duocGhi())) return; // chạm nút đang chọn: không làm gì
    setHang((h) => ({ ...h, [id]: t }));
    tatCa.current?.tay.add(id);
    setLoiHang((l) => { if (!(id in l)) return l; const n = { ...l }; delete n[id]; return n; });
    datViec({ khoa: `dd:${buoiId}:${id}`, nhom, url: api, method: "PUT", body: { hocSinhId: id, trangThai: t, ...xn } });
  }
  function thuLaiHang(id: number) {
    setLoiHang((l) => { const n = { ...l }; delete n[id]; return n; });
    datViec({ khoa: `dd:${buoiId}:${id}`, nhom, url: api, method: "PUT", body: { hocSinhId: id, trangThai: hang[id] ?? null, ...xn } });
  }
  function hoanTac() {
    const t = tatCa.current;
    if (!t || t.huy) return;
    t.huy = true;
    const tra = t.doi.filter((id) => !t.tay.has(id));
    setHang((h) => { const n = { ...h }; for (const id of tra) if (n[id] === "co") n[id] = null; return n; });
    if (!boViec(t.khoa) && t.ids) guiHoanTac(t); // đã gửi xong → gửi hoàn tác; đang gửi dở → chờ kết quả rồi hoàn tác
    setBao({ chu: `Đã hoàn tác, ${tra.length} em về chưa điểm`, hoanTac: false });
  }
  async function danhTatCa() {
    if (!(await duocGhi())) return;
    const ids = d.em.filter((e) => !hang[e.hoc_sinh_id]).map((e) => e.hoc_sinh_id);
    if (!ids.length) return;
    setHang((h) => { const n = { ...h }; for (const id of ids) n[id] = "co"; return n; });
    const khoa = `tatca:${buoiId}:${Date.now()}`;
    tatCa.current = { khoa, doi: ids, tay: new Set(), huy: false, ids: null, luc: null };
    datViec({ khoa, nhom, url: `${api}/tat-ca`, method: "POST", body: { ...xn } });
    setBao({ chu: `Đã đánh ${ids.length} em có mặt`, hoanTac: true });
  }

  // Đếm + lọc (lọc giữ hàng vừa điểm tới khi bấm lại bộ lọc — không để hàng biến mất dưới ngón tay).
  const dem = { chua: 0, co: 0, phep: 0, vang: 0 };
  for (const e of d.em) dem[hang[e.hoc_sinh_id] ?? "chua"]++;
  const tong = d.em.length, daDiem = tong - dem.chua;
  function chonLoc(l: Loc) {
    setLoc(l);
    setChup(l === "tat" ? null : new Set(d.em.filter((e) => (l === "chua" ? !hang[e.hoc_sinh_id] : hang[e.hoc_sinh_id] === l)).map((e) => e.hoc_sinh_id)));
  }
  const hienThi = d.em.filter((e) => !chup || chup.has(e.hoc_sinh_id));
  const loiGui = hd.matMang || hd.hetPhien || hd.loiMayChu;
  const dangHoanTac = !!bao?.hoanTac;

  return (
    <div className="mx-auto max-w-2xl" data-lop-diem-danh>
      {loiGui ? (
        <div role="alert" className="mb-3 rounded-[var(--kin-bo-the)] bg-[var(--kin-tt-nen-cho)] px-4 py-3 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]">
          <p className="font-semibold text-[var(--kin-tt-chu-cho)]">{hd.matMang ? "Mất mạng" : hd.hetPhien ? "Phiên đăng nhập đã hết" : "Máy chủ gặp lỗi"}</p>
          <p className="mt-0.5 tabular-nums">
            {cho ? `${cho} thay đổi chưa gửi` : "Chưa có thay đổi nào chờ gửi"}{hd.matMang ? ", sẽ tự gửi khi có mạng." : hd.hetPhien ? ". Đăng nhập lại ở thẻ khác rồi bấm Thử lại." : ", thay đổi vẫn được giữ trên máy."}
            {!hd.matMang ? <button type="button" onClick={thuLai} className="ml-2 inline-flex min-h-11 items-center font-semibold underline">Thử lại</button> : null}
          </p>
        </div>
      ) : null}

      <header className="flex items-center gap-2">
        <Link href={veHref} aria-label="Quay lại danh sách buổi" className="-ml-2 inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--kin-bo-md)] text-[var(--kin-chu-chinh)] hover:bg-[var(--kin-nen-re-chuot)]">
          <svg aria-hidden width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.5 4.5L7 10l5.5 5.5" /></svg>
        </Link>
        <div className="min-w-0">
          <h1 className="text-[length:var(--kin-co-tieu-de)] font-semibold leading-6 tabular-nums text-[var(--kin-chu-chinh)] [overflow-wrap:anywhere]">{tenMon} · {thuNganNgay(b.ngay)} · {gioVN(new Date(b.bat_dau_luc))}</h1>
          <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Điểm danh · {tong} học sinh{b.loai === "hoc_bu" ? " · học bù" : ""}</p>
        </div>
      </header>

      {d.trang_thai_ghi === "huy" ? (
        <p className="mt-4 rounded-[var(--kin-bo-the)] bg-[var(--kin-nen-bang)] px-4 py-4 text-[var(--kin-chu-phu)]">Buổi này lớp nghỉ{b.ly_do_huy ? ` (${b.ly_do_huy})` : ""} — không điểm danh.</p>
      ) : (
        <>
          {qua48 && !moSua ? <p className="mt-3 rounded-[var(--kin-bo-the)] bg-[var(--kin-tt-nen-cho)] px-4 py-3 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]">Buổi đã qua 48 giờ. Bấm một nút bất kỳ để mở sửa — máy sẽ hỏi lại một lần cho cả buổi.</p> : null}
          {d.trang_thai_ghi === "chua_mo" ? <p className="mt-3 rounded-[var(--kin-bo-the)] bg-[var(--kin-nen-bang)] px-4 py-3 text-[length:var(--kin-co-goc)] tabular-nums text-[var(--kin-chu-phu)]">Điểm danh mở lúc {gioVN(new Date(batDau - 30 * 60_000))}. Danh sách dưới đây chỉ để xem trước.</p> : null}
          {d.trang_thai_ghi === "tuong_lai" ? <p className="mt-3 rounded-[var(--kin-bo-the)] bg-[var(--kin-nen-bang)] px-4 py-3 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]">Buổi chưa diễn ra. Danh sách dưới đây chỉ để xem trước.</p> : null}

          <div className="mt-4 flex items-baseline justify-between gap-3 text-[length:var(--kin-co-goc)] tabular-nums">
            <p className="font-semibold text-[var(--kin-chu-chinh)]" aria-live="polite">Đã điểm {daDiem}/{tong}</p>
            <p className="text-[var(--kin-chu-mo)]">{dem.chua ? `Còn ${dem.chua} em` : tong ? "Đã đủ" : ""}</p>
          </div>
          <div aria-hidden className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--kin-nen-dang-chon)]"><div className="h-full rounded-full bg-[var(--kin-nhan-nen)] transition-[width]" style={{ width: `${tong ? (daDiem / tong) * 100 : 0}%` }} /></div>

          {/* Chip lọc: cho xuống hàng khi hẹp hơn 390 (không cuộn ngang). */}
          <div role="group" aria-label="Lọc theo trạng thái" className="mt-3 flex flex-wrap gap-1">
            {([["tat", "Tất cả", null], ["chua", "Chưa", dem.chua], ["co", "Có", dem.co], ["phep", "Phép", dem.phep], ["vang", "Vắng", dem.vang]] as const).map(([k, t, n]) => (
              <button key={k} type="button" aria-pressed={loc === k} onClick={() => chonLoc(k)}
                className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-2 text-[length:var(--kin-co-phu)] font-semibold tabular-nums ${loc === k ? "border-[var(--kin-nhan-nen)] bg-[var(--kin-nen-dang-chon)] text-[var(--kin-nhan-chu-tren-nhat)]" : "border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-trang)] text-[var(--kin-chu-chinh)]"}`}>
                {k !== "tat" ? <span aria-hidden className="size-2 rounded-full" style={{ background: CHAM[k] }} /> : null}{t}{n === null ? "" : ` ${n}`}
              </button>
            ))}
          </div>

          {!tong ? (
            <p className="mt-4 rounded-[var(--kin-bo-the)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-trang)] px-4 py-6 text-[var(--kin-chu-phu)]">Buổi này chưa có em nào ghi danh {b.mon.ten}.</p>
          ) : !hienThi.length ? (
            <p className="mt-4 rounded-[var(--kin-bo-the)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-trang)] px-4 py-6 text-[var(--kin-chu-phu)]">Không có em nào ở mục này.</p>
          ) : (
            <ul className="mt-3 rounded-[var(--kin-bo-the)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-trang)] px-3.5">
              {hienThi.map((e) => {
                const id = e.hoc_sinh_id, loi = loiHang[id], choGui = loiGui && !!layViec(`dd:${buoiId}:${id}`);
                return (
                  <li key={id} className="border-b border-[var(--kin-vien-nhat)] py-3.5 last:border-b-0">
                    <div className="flex items-start justify-between gap-2">
                      <p translate="no" className="min-w-0 text-[length:var(--kin-co-body)] font-semibold leading-6 text-[var(--kin-chu-chinh)] [overflow-wrap:anywhere]">{e.ho_ten}</p>
                      {choGui ? <span className="shrink-0 pt-0.5 text-[length:var(--kin-co-phu)] font-medium text-[var(--kin-tt-chu-cho)]">Chờ gửi</span>
                        : e.loai === "thu" ? <span className="shrink-0 whitespace-nowrap rounded-full bg-[var(--kin-tt-nen-cho)] px-2.5 py-0.5 text-[length:var(--kin-co-phu)] font-medium tabular-nums text-[var(--kin-tt-chu-cho)]">Thử{e.thu_con_ngay !== null && e.thu_con_ngay >= 0 ? ` · còn ${e.thu_con_ngay} ngày` : ""}</span> : null}
                    </div>
                    <div role="group" aria-label={`Điểm danh ${e.ho_ten}`} className="mt-2 grid grid-cols-3 gap-2">
                      {NUT.map((n) => {
                        const chon = hang[id] === n.v;
                        return (
                          <button key={n.v} type="button" aria-pressed={chon} aria-disabled={(!ghiDuoc && !qua48) || undefined} onClick={() => void danh(id, n.v)}
                            className={`inline-flex h-12 min-w-0 items-center justify-center gap-1.5 rounded-[var(--kin-bo-lg)] border text-[length:var(--kin-co-body)] font-semibold focus-visible:outline-2 focus-visible:outline-[var(--kin-nhan-link)] ${chon ? "border-transparent text-[var(--kin-lop-dd-chu)]" : "border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-trang)] text-[var(--kin-chu-chinh)]"} ${ghiDuoc || qua48 ? "" : "opacity-60"}`}
                            style={chon ? { background: n.mau } : undefined}>
                            {chon ? <Dau /> : null}{n.nhan}
                          </button>
                        );
                      })}
                    </div>
                    {loi ? <p role="alert" className="mt-1.5 text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi-dam)]">Không lưu được ({loi}) · <button type="button" className="inline-flex min-h-11 items-center font-semibold underline" onClick={() => thuLaiHang(id)}>Thử lại</button></p> : null}
                  </li>
                );
              })}
            </ul>
          )}
          {tong && hienThi.length < tong ? <p className="mt-3 text-center text-[length:var(--kin-co-phu)] tabular-nums text-[var(--kin-chu-mo)]">Đang hiện {hienThi.length}/{tong} học sinh</p> : null}
          {d.het_thu_khong_co_ten.so_em > 0 ? <p className="mt-3 text-[length:var(--kin-co-goc)] tabular-nums text-[var(--kin-chu-phu)]">{d.het_thu_khong_co_ten.so_em} em đã hết thử nên không có tên trong buổi này.</p> : null}

          {tong && (ghiDuoc || qua48) ? (
            <div className={`sticky ${day} z-10 -mx-1 mt-4 border-t border-[var(--kin-vien-nhat)] bg-[var(--kin-nen-trang)] px-1 pb-3 pt-3 shadow-[0_2rem_0_0_var(--kin-nen-trang)]`}>
              {bao ? (
                <div role="status" className="mb-2 flex items-center justify-between gap-3 rounded-[var(--kin-bo-lg)] bg-[var(--kin-nen-dang-chon)] py-1 pl-4 pr-1 text-[length:var(--kin-co-goc)] tabular-nums text-[var(--kin-chu-chinh)]">
                  <span>{bao.chu}</span>
                  {bao.hoanTac ? <button type="button" onClick={hoanTac} className="inline-flex min-h-11 items-center rounded-[var(--kin-bo-md)] px-3 font-semibold text-[var(--kin-nhan-link)] hover:underline">Hoàn tác</button>
                    : <button type="button" onClick={() => setBao(null)} className="inline-flex min-h-11 items-center px-3 text-[var(--kin-chu-mo)]">Đóng</button>}
                </div>
              ) : null}
              {dem.chua > 0 && !(cho && loiGui) ? (
                <button type="button" data-kin-nut onClick={() => void danhTatCa()} className={`${kinButtonClass("primary", "lg")} min-h-14 w-full font-semibold`}>Đánh tất cả có mặt</button>
              ) : cho || dangHoanTac || loiGui ? (
                // Còn thay đổi chưa gửi / đang trong 5 giây Hoàn tác / mất mạng: khoá "Xong" (không rời trang), nói rõ lý do ở dưới.
                <button type="button" data-kin-nut disabled className={`${kinButtonClass("primary", "lg")} min-h-14 w-full font-semibold`}>Xong</button>
              ) : (
                <Link href={veHref} className={`${kinButtonClass("primary", "lg")} min-h-14 w-full font-semibold`}>Xong</Link>
              )}
              <p className="mt-2 text-center text-[length:var(--kin-co-phu)] tabular-nums text-[var(--kin-chu-mo)]" aria-live="polite">
                {cho && loiGui ? `Chưa bấm Xong được vì còn ${cho} thay đổi chưa gửi. Giữ trang này mở, có mạng là máy tự gửi.`
                  : cho ? "Đang lưu…"
                  : hd.daLuuLuc ? <span className="inline-flex items-center gap-1 text-[var(--kin-tt-chu-xong)]"><Dau /> Đã lưu {gioVN(new Date(hd.daLuuLuc))}</span>
                  : "Mỗi lần bấm được lưu ngay."}
              </p>
            </div>
          ) : null}
        </>
      )}
      {dialog}
    </div>
  );
}
