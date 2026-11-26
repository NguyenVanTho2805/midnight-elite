"use client";
// Điểm danh một buổi (man-diem-danh.md §3–§6). Ưu tiên điện thoại 390px trong buổi Meet:
// danh sách 1 cột, Có / Phép / Vắng 48px cách 8px, chữ đầy đủ; "Đánh tất cả có mặt" + Hoàn tác 5 giây;
// lưu ngay mỗi lần bấm qua hàng đợi (rớt mạng thì giữ trên máy, tự gửi lại). ≥ 1024px thành bảng có phím tắt.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { chiTietDiemDanh } from "@/server/diem-danh";
import { boDau } from "@/lib/chuan-hoa";
import { ddmm, gio, thuNgay, thuNganNgay } from "../dinh-dang";
import { IconDau, IconDong, IconQuayLai, IconTim } from "../bieu-tuong";
import { Chip, TrialChip } from "../ui/chip";
import { ToTruot } from "../ui/to-truot";
import { nhan, nutBieuTuong, nutChinh, nutChinhTo, nutPhu, oNhap } from "../ui/nut";
import { ChiBaoLuu } from "../khung/chi-bao-luu";
import { useHoanTac } from "../khung/hoan-tac";
import { boViec, dangKyXuLy, datViec, layViec, nap, useHangDoi, viecCuaNhom } from "../khung/hang-doi";

type D = Awaited<ReturnType<typeof chiTietDiemDanh>>;
type Em = D["em"][number];
type TT = "co" | "phep" | "vang";
type Hang = { tt: TT | null; ghiChu: string | null; ghiBoi: string | null; ghiLuc: string | null };
type Loc = "tat" | "chua" | TT;
type TatCa = { khoa: string; doi: number[]; tay: Set<number>; huy: boolean; ids: number[] | null; luc: string | null };

export const NUT_DD: { v: TT; nhan: string; chon: string }[] = [
  { v: "co", nhan: "Có", chon: "border-ok bg-ok text-on-ok" },
  { v: "phep", nhan: "Phép", chon: "border-excused bg-excused text-on-excused" },
  { v: "vang", nhan: "Vắng", chon: "border-danger bg-danger text-on-danger" },
];
const TEN_TT: Record<TT, string> = { co: "có mặt", phep: "vắng có phép", vang: "vắng không phép" };

const mot = (e: Em): Hang => ({ tt: e.trang_thai, ghiChu: e.ghi_chu, ghiBoi: e.ghi_boi, ghiLuc: e.ghi_luc ? new Date(e.ghi_luc).toISOString() : null });
const tuMayChu = (em: Em[]) => Object.fromEntries(em.map((e) => [e.hoc_sinh_id, mot(e)])) as Record<number, Hang>;

export function DiemDanhBuoi({ d: d0, toi, chu }: { d: D; toi: string; chu: boolean }) {
  const [d, setD] = useState(d0);
  const b = d.buoi;
  const buoiId = b.id;
  const nhom = `dd:${buoiId}`;
  const [hang, setHang] = useState(() => tuMayChu(d0.em));
  const hangRef = useRef(hang);
  useEffect(() => { hangRef.current = hang; }, [hang]);
  const [moSua, setMoSua] = useState(false);
  const [hoiMoSua, setHoiMoSua] = useState(false);
  const [loc, setLoc] = useState<Loc>("tat");
  const [chup, setChup] = useState<Set<number> | null>(null);
  const [tim, setTim] = useState("");
  const [moTim, setMoTim] = useState(false);
  const [emMo, setEmMo] = useState<number | null>(null);
  const [loiHang, setLoiHang] = useState<Record<number, string>>({});
  const [vuaDoi, setVuaDoi] = useState<Set<number>>(new Set());
  const [dangHoanTac, setDangHoanTac] = useState(false);
  const [tieuDiem, setTieuDiem] = useState({ r: 0, c: 0 });
  const tatCa = useRef<TatCa | null>(null);
  const bang = useRef<HTMLTableSectionElement>(null);
  const router = useRouter();
  const { hien } = useHoanTac();
  useHangDoi(); // vẽ lại khi hàng đợi đổi (chấm "Chưa gửi", chỉ báo lưu)
  const cho = viecCuaNhom(nhom);
  const ghiDuoc = d.trang_thai_ghi === "mo" || (d.trang_thai_ghi === "qua_48h" && moSua);
  const xacNhan = d.trang_thai_ghi === "qua_48h" && moSua ? { xacNhan: true } : {};
  const batDau = new Date(b.bat_dau_luc).getTime();

  // Thay đổi còn chờ từ lần mở trước → phủ lên dữ liệu máy chủ.
  useEffect(() => {
    let huy = false;
    void nap().then(() => {
      const vs = viecCuaNhom(nhom);
      if (huy || !vs.length) return;
      setHang((h) => {
        const n = { ...h };
        for (const v of vs) {
          const id = Number(v.body.hocSinhId);
          if (!id || !n[id]) continue;
          if ("trangThai" in v.body) n[id] = { ...n[id], tt: v.body.trangThai as TT | null };
          if ("ghiChu" in v.body) n[id] = { ...n[id], ghiChu: v.body.ghiChu as string | null };
        }
        return n;
      });
    });
    return () => { huy = true; };
  }, [nhom]);

  const guiHoanTac = useCallback((t: TatCa) => {
    if (!t.ids?.length || !t.luc) return; // máy chủ lấy danh sách em từ nhật ký của chính người đó, chỉ cần `luc`
    datViec({ khoa: `hoantac:${buoiId}:${t.luc}`, nhom, url: `/api/diem-danh/${buoiId}/hoan-tac`, method: "POST", body: { luc: t.luc } });
  }, [buoiId, nhom]);

  // Kết quả gửi từ hàng đợi.
  useEffect(() => dangKyXuLy(nhom, {
    ok: (v, kq) => {
      if (v.khoa.startsWith("tatca:")) {
        const k = kq as { ids?: number[]; luc?: string };
        const t = tatCa.current?.khoa === v.khoa ? tatCa.current : null;
        if (t) {
          t.ids = k.ids ?? [];
          t.luc = k.luc ?? null;
          if (t.huy) return guiHoanTac(t);
        }
        setHang((h) => {
          const n = { ...h };
          for (const id of k.ids ?? []) if (n[id] && !n[id].tt) n[id] = { ...n[id], tt: "co", ghiBoi: toi };
          return n;
        });
      } else if (v.khoa.startsWith("dd:")) {
        const id = Number(v.body.hocSinhId);
        setHang((h) => (h[id] ? { ...h, [id]: { ...h[id], ghiBoi: toi, ghiLuc: new Date().toISOString() } } : h));
      }
    },
    loi: (v, _s, kq) => {
      const id = Number(v.body.hocSinhId);
      if (id) setLoiHang((l) => ({ ...l, [id]: kq.loi ?? "Không lưu được" }));
      else hien({ thongDiep: kq.loi ?? "Không lưu được" });
      if (kq.ma === "can_xac_nhan_48h") setMoSua(false);
    },
  }), [nhom, toi, guiHoanTac, hien]);

  // Làm mới mỗi 15 giây khi trang đang hiện và không còn thay đổi chờ (giáo viên khác cùng môn sửa).
  useEffect(() => {
    const f = async () => {
      if (document.hidden || viecCuaNhom(nhom).length) return;
      try {
        const r = await fetch(`/api/diem-danh/${buoiId}`);
        if (!r.ok || viecCuaNhom(nhom).length) return;
        const moi = (await r.json()) as D;
        const cu = hangRef.current;
        const doi = moi.em.filter((e) => cu[e.hoc_sinh_id] && cu[e.hoc_sinh_id].tt !== e.trang_thai && e.ghi_boi && e.ghi_boi !== toi).map((e) => e.hoc_sinh_id);
        setD(moi);
        setHang(tuMayChu(moi.em));
        if (doi.length) setVuaDoi(new Set(doi));
      } catch { /* mất mạng: giữ dữ liệu cũ */ }
    };
    const t = setInterval(f, 15_000);
    return () => clearInterval(t);
  }, [nhom, buoiId, toi]);

  function danh(id: number, t: TT | null) {
    if (!ghiDuoc) {
      if (d.trang_thai_ghi === "qua_48h") setHoiMoSua(true);
      return;
    }
    const cur = hang[id];
    if (!cur || cur.tt === t) return; // chạm nút đang chọn: không làm gì
    setHang((h) => ({ ...h, [id]: { ...h[id], tt: t, ...(t ? {} : { ghiChu: null }) } }));
    tatCa.current?.tay.add(id);
    setLoiHang((l) => { if (!(id in l)) return l; const n = { ...l }; delete n[id]; return n; });
    const khoa = `dd:${buoiId}:${id}`;
    const body = t === null ? { hocSinhId: id, trangThai: null } : { ...layViec(khoa)?.body, hocSinhId: id, trangThai: t };
    datViec({ khoa, nhom, url: `/api/diem-danh/${buoiId}`, method: "PUT", body: { ...body, ...xacNhan } });
  }

  function thuLaiHang(id: number) {
    const h = hang[id];
    setLoiHang((l) => { const n = { ...l }; delete n[id]; return n; });
    datViec({ khoa: `dd:${buoiId}:${id}`, nhom, url: `/api/diem-danh/${buoiId}`, method: "PUT", body: { hocSinhId: id, trangThai: h?.tt ?? null, ...(h?.tt ? { ghiChu: h.ghiChu } : {}), ...xacNhan } });
  }

  function luuGhiChu(id: number, s: string) {
    const v = s.trim() || null;
    if (!ghiDuoc || !hang[id]?.tt || v === (hang[id].ghiChu ?? null)) return;
    setHang((h) => ({ ...h, [id]: { ...h[id], ghiChu: v } }));
    const khoa = `dd:${buoiId}:${id}`;
    datViec({ khoa, nhom, url: `/api/diem-danh/${buoiId}`, method: "PUT", body: { ...layViec(khoa)?.body, hocSinhId: id, ghiChu: v, ...xacNhan } });
  }

  const hoanTac = useCallback(() => {
    const t = tatCa.current;
    if (!t || t.huy) return;
    t.huy = true;
    setDangHoanTac(false);
    const tra = t.doi.filter((id) => !t.tay.has(id));
    setHang((h) => {
      const n = { ...h };
      for (const id of tra) if (n[id]?.tt === "co") n[id] = { ...n[id], tt: null };
      return n;
    });
    if (!boViec(t.khoa) && t.ids) guiHoanTac(t); // đã gửi xong → gửi hoàn tác; đang gửi dở → chờ kết quả rồi hoàn tác
    hien({ thongDiep: `Đã hoàn tác, ${tra.length} em về chưa điểm` });
  }, [guiHoanTac, hien]);

  function danhTatCa() {
    if (!ghiDuoc) return;
    const ids = d.em.filter((e) => !hang[e.hoc_sinh_id]?.tt).map((e) => e.hoc_sinh_id);
    if (!ids.length) return;
    setHang((h) => {
      const n = { ...h };
      for (const id of ids) n[id] = { ...n[id], tt: "co" };
      return n;
    });
    const khoa = `tatca:${buoiId}:${Date.now()}`;
    tatCa.current = { khoa, doi: ids, tay: new Set(), huy: false, ids: null, luc: null };
    datViec({ khoa, nhom, url: `/api/diem-danh/${buoiId}/tat-ca`, method: "POST", body: { ...xacNhan } });
    setDangHoanTac(true);
    hien({ thongDiep: `Đã đánh ${ids.length} em có mặt`, hoanTac, het: () => setDangHoanTac(false) });
  }

  // Đếm + lọc (lọc giữ hàng vừa điểm tới khi bấm lại bộ lọc — không để hàng biến mất dưới ngón tay).
  const dem = { chua: 0, co: 0, phep: 0, vang: 0 };
  for (const e of d.em) dem[hang[e.hoc_sinh_id]?.tt ?? "chua"]++;
  const khop = (id: number, l: Loc) => (l === "tat" ? true : l === "chua" ? !hang[id]?.tt : hang[id]?.tt === l);
  function chonLoc(l: Loc) {
    const moi = loc === l ? "tat" : l;
    setLoc(moi);
    setChup(moi === "tat" ? null : new Set(d.em.filter((e) => khop(e.hoc_sinh_id, moi)).map((e) => e.hoc_sinh_id)));
    setTieuDiem({ r: 0, c: 0 });
  }
  const q = boDau(tim.trim());
  const hienThi = d.em.filter((e) => (!chup || chup.has(e.hoc_sinh_id)) && (!q || boDau(e.ho_ten).includes(q) || e.ma_hs.toLowerCase().includes(q)));
  const daDiemTrongLoc = loc === "chua" && chup ? [...chup].filter((id) => hang[id]?.tt).length : 0;

  // Bàn phím (≥ 1024px): cả danh sách một điểm dừng Tab; ↑↓ đổi hàng, ←→ đổi nút, 1/2/3 chọn rồi xuống hàng, N ghi chú.
  function phim(e: KeyboardEvent, r: number, c: number) {
    const tiep = (nr: number, nc: number) => {
      const rr = Math.max(0, Math.min(hienThi.length - 1, nr));
      setTieuDiem({ r: rr, c: nc });
      requestAnimationFrame(() => bang.current?.querySelector<HTMLElement>(`[data-o="${rr}-${nc}"]`)?.focus());
    };
    const em = hienThi[r];
    if (e.key === "ArrowDown") { e.preventDefault(); tiep(r + 1, c); }
    else if (e.key === "ArrowUp") { e.preventDefault(); tiep(r - 1, c); }
    else if (e.key === "ArrowRight") { e.preventDefault(); tiep(r, Math.min(2, c + 1)); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); tiep(r, Math.max(0, c - 1)); }
    else if (["1", "2", "3"].includes(e.key) && em) { e.preventDefault(); danh(em.hoc_sinh_id, NUT_DD[Number(e.key) - 1].v); tiep(r + 1, Number(e.key) - 1); }
    else if ((e.key === "n" || e.key === "N") && em) {
      e.preventDefault();
      const o = bang.current?.querySelector<HTMLInputElement>(`[data-ghi-chu="${em.hoc_sinh_id}"]`);
      if (o && o.offsetParent) o.focus();
      else setEmMo(em.hoc_sinh_id);
    }
  }

  const ngayQua = Math.floor((Date.now() - batDau) / 86400_000);
  const tieuDeNgan = `${b.mon.ten} · ${thuNganNgay(b.ngay)}`;
  const emDangMo = emMo !== null ? d.em.find((e) => e.hoc_sinh_id === emMo) : null;
  const du = dem.chua === 0 && d.em.length > 0;
  const xong = du && !dangHoanTac;

  return (
    <>
      <header className="bong-dinh sticky top-0 z-20 bg-bg/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1120px] items-center gap-2 px-4 sm:h-16 sm:px-6 lg:px-8">
          <Link href="/quan-ly/diem-danh" className={`${nutBieuTuong} -ml-3`} aria-label="Quay lại danh mục điểm danh"><IconQuayLai /></Link>
          {moTim ? (
            <label className="flex-1">
              <span className="sr-only">Tìm tên</span>
              <input autoFocus value={tim} onChange={(e) => setTim(e.target.value)} placeholder="Tìm tên…" className={`${oNhap} min-h-11`} autoComplete="off" spellCheck={false} />
            </label>
          ) : (
            <h1 className="min-w-0 flex-1 truncate text-lg font-semibold sm:text-xl">
              <span className="lg:hidden">{tieuDeNgan}</span>
              <span className="hidden lg:inline so">{thuNgay(b.ngay)} · {gio(b.bat_dau_luc)}–{gio(batDau + b.so_phut * 60_000)}</span>
            </h1>
          )}
          <button type="button" className={`${nutBieuTuong} lg:hidden`} onClick={() => { setMoTim(!moTim); setTim(""); }} aria-label={moTim ? "Đóng tìm kiếm" : "Tìm tên"}>
            {moTim ? <IconDong /> : <IconTim />}
          </button>
          <ChiBaoLuu choRieng={cho.length} />
        </div>
      </header>

      <div className="mx-auto max-w-[1120px] px-4 pb-32 pt-3 sm:px-6 lg:px-8 lg:pb-8 lg:pt-5">
        <div className="hidden flex-wrap items-center gap-3 lg:flex">
          <h2 className="text-[28px] font-extrabold leading-tight">{b.mon.ten}{b.noi_dung ? <span className="font-semibold text-text-2"> — {b.noi_dung}</span> : null}</h2>
          {b.loai === "hoc_bu" ? <Chip>Học bù</Chip> : null}
          <span className="flex-1" />
          <Link href={`/quan-ly/buoi-hoc?thang=${b.ngay.slice(0, 7)}&buoi=${buoiId}${b.link_record ? "" : "&dan=1"}`} className={nutPhu}>{b.link_record ? "Xem record" : "Dán link record"}</Link>
        </div>

        {d.trang_thai_ghi === "huy" ? (
          <div className="mt-2 rounded-[14px] bg-raised px-4 py-4">
            <p>Buổi này lớp nghỉ{b.ly_do_huy ? ` (${b.ly_do_huy})` : ""} — không điểm danh.</p>
            {chu ? <BoHuy id={buoiId} xong={() => router.refresh()} /> : null}
          </div>
        ) : (
          <>
            {d.trang_thai_ghi === "qua_48h" && !moSua ? (
              <div className="mt-2 flex flex-wrap items-center gap-3 rounded-[14px] bg-warn-bg px-4 py-3">
                <p className="flex-1">Buổi đã qua {ngayQua} ngày. Sửa điểm danh sẽ đổi chuyên cần và học phí.</p>
                <button type="button" className={nutPhu} onClick={() => setHoiMoSua(true)}>Mở sửa</button>
              </div>
            ) : null}
            {d.trang_thai_ghi === "chua_mo" ? <p className="mt-2 rounded-[14px] bg-raised px-4 py-3 so">Điểm danh mở lúc {gio(batDau - 30 * 60_000)}. Danh sách dưới đây chỉ để xem trước.</p> : null}
            {d.trang_thai_ghi === "tuong_lai" ? <p className="mt-2 rounded-[14px] bg-raised px-4 py-3">Buổi chưa diễn ra. Danh sách dưới đây chỉ để xem trước.</p> : null}

            <div className="dinh-duoi-dau sticky top-14 z-10 -mx-4 mt-2 bg-bg px-4 py-2 sm:top-16 lg:static lg:mx-0 lg:mt-4 lg:flex lg:items-center lg:gap-3 lg:px-0">
              <div role="group" aria-label="Lọc theo trạng thái" className="flex gap-1.5 overflow-x-auto">
                {([["chua", "Chưa điểm", dem.chua], ["co", "Có", dem.co], ["phep", "Phép", dem.phep], ["vang", "Vắng", dem.vang]] as const).map(([k, t, n]) => (
                  <button key={k} type="button" aria-pressed={loc === k} onClick={() => chonLoc(k)} className={`nhan inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[14px] font-semibold ${loc === k ? "border-gold bg-nav-active text-gold" : "border-border bg-surface text-text-2"}`}>
                    {loc === k ? <IconDau size={14} /> : null}{t} <span className={`so ${k === "chua" && n > 0 ? "text-warn" : ""}`}>{n}</span>
                  </button>
                ))}
              </div>
              <label className="hidden w-56 lg:block">
                <span className="sr-only">Tìm tên</span>
                <input value={tim} onChange={(e) => setTim(e.target.value)} placeholder="Tìm tên…" className={`${oNhap} min-h-11`} autoComplete="off" spellCheck={false} />
              </label>
              <span className="hidden flex-1 lg:block" />
              {d.em.length && ghiDuoc ? (
                <div className="day-an-toan fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/95 px-4 pt-3 backdrop-blur sm:left-[72px] lg:static lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
                  <div className="pb-3 lg:pb-0">
                    {du && dangHoanTac ? (
                      // Trong 5 giây Hoàn tác: báo đã đủ nhưng khoá "Xong" để không rời trang khi còn hoàn tác được.
                      <button type="button" disabled className={`${nutPhu} min-h-14 w-full lg:min-h-11 lg:w-auto so`}>Đã điểm đủ {d.em.length}/{d.em.length} · Xong</button>
                    ) : xong ? (
                      <Link href="/quan-ly" className={`${nutPhu} min-h-14 w-full lg:min-h-11 lg:w-auto so`}>Đã điểm đủ {d.em.length}/{d.em.length} · Xong</Link>
                    ) : (
                      <button type="button" onClick={danhTatCa} disabled={dem.chua === 0} className={`${nutChinhTo} w-full lg:min-h-11 lg:w-auto lg:text-base so`}>
                        Đánh tất cả có mặt ({dem.chua})
                      </button>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            {loc !== "tat" && chup ? (
              <p className="mt-1 flex min-h-11 items-center gap-2 text-[14px] text-text-2">
                {loc === "chua" ? <>Đã điểm {daDiemTrongLoc} em trong lọc này</> : <>Đang lọc theo trạng thái</>}
                <button type="button" className="min-h-11 px-2 font-semibold text-gold" onClick={() => setChup(new Set(d.em.filter((e) => khop(e.hoc_sinh_id, loc)).map((e) => e.hoc_sinh_id)))}>Ẩn em đã điểm</button>
                <button type="button" className="min-h-11 px-2 font-semibold text-text" onClick={() => chonLoc(loc)}>Bỏ lọc</button>
              </p>
            ) : null}

            {!d.em.length ? (
              <div className="mt-4 rounded-[14px] border border-border bg-surface px-4 py-6 text-text-2">
                Buổi này chưa có em nào ghi danh {b.mon.ten}. — <Link href={`/quan-ly/hoc-sinh?mon=${b.mon.ma}`} className="font-semibold text-gold hover:underline">Xem danh sách học sinh</Link>
              </div>
            ) : !hienThi.length ? (
              <p className="mt-4 rounded-[14px] border border-border bg-surface px-4 py-6 text-text-2">Không có em nào khớp “{tim}”.</p>
            ) : (
              <table className="mt-1 block w-full lg:mt-3 lg:table lg:rounded-[14px] lg:border lg:border-border lg:bg-surface">
                <caption className="sr-only">Điểm danh {b.mon.ten} {thuNgay(b.ngay)}</caption>
                <thead className="hidden text-left text-[13px] font-semibold text-text-2 lg:table-header-group">
                  <tr className="border-b border-border">
                    <th scope="col" className="w-10 px-3 py-2">#</th>
                    <th scope="col" className="px-3 py-2">Học sinh</th>
                    <th scope="col" className="px-3 py-2">Loại</th>
                    <th scope="col" className="px-3 py-2">Điểm danh</th>
                    <th scope="col" className="px-3 py-2">Ghi chú</th>
                  </tr>
                </thead>
                <tbody ref={bang} className="block lg:table-row-group">
                  {hienThi.map((e, r) => {
                    const h = hang[e.hoc_sinh_id];
                    const id = e.hoc_sinh_id;
                    const choGui = !!layViec(`dd:${buoiId}:${id}`);
                    const loi = loiHang[id];
                    return (
                      <tr key={id} className={`grid grid-cols-[1fr_auto] items-center gap-x-3 border-b border-border py-1.5 max-[339px]:grid-cols-1 max-[339px]:gap-y-2 lg:table-row lg:py-0 lg:hover:bg-row-hover ${loi ? "border-l-[3px] border-l-danger pl-2" : ""} ${vuaDoi.has(id) ? "vua-doi" : ""}`}>
                        <td className="so hidden px-3 text-text-3 lg:table-cell">{r + 1}</td>
                        <td className="min-w-0 lg:px-3 lg:py-1.5">
                          <span className="flex items-center gap-2">
                            {/* Điện thoại: tên + loại gộp một nút ≥ 44px (hàng ≈ 64–72px); máy tính: loại ở cột riêng. */}
                            <button type="button" onClick={() => setEmMo(id)} className="group min-h-11 text-left lg:min-h-0">
                              <span className="block text-base font-semibold leading-5 group-hover:underline" translate="no">{e.ho_ten}</span>
                              <span className="block leading-5 lg:hidden">{e.loai === "thu" ? <TrialChip con={e.thu_con_ngay} gon /> : <span className="text-[13px] text-text-3">Chính thức</span>}</span>
                            </button>
                            {choGui ? <span role="img" aria-label="Chưa gửi" className="inline-block size-2 shrink-0 rounded-full border border-text-3" /> : null}
                            <span className="hidden text-[13px] text-text-3 lg:inline" translate="no">{e.ma_hs}</span>
                          </span>
                          {h?.ghiChu ? <p className="mt-0.5 text-[13px] text-text-2 lg:hidden">{h.ghiChu}</p> : null}
                          {h?.ghiBoi && h.ghiBoi !== toi && h.ghiLuc ? <p className="text-[12px] text-text-3">Lần sửa cuối: {h.ghiBoi} lúc {gio(h.ghiLuc)}</p> : null}
                          {loi ? <p className="text-[13px] text-danger">Không lưu được · <button type="button" className="min-h-11 font-semibold underline" onClick={() => thuLaiHang(id)}>Thử lại</button> <span className="text-text-3">({loi})</span></p> : null}
                        </td>
                        <td className="hidden px-3 lg:table-cell">{e.loai === "thu" ? <TrialChip con={e.thu_con_ngay} /> : <span className="text-[13px] text-text-2">Chính thức</span>}</td>
                        <td className="lg:px-3 lg:py-0.5">
                          <div role="group" aria-label={`Điểm danh ${e.ho_ten}`} className="grid grid-cols-3 gap-2 lg:flex">
                            {NUT_DD.map((n, c) => {
                              const chon = h?.tt === n.v;
                              return (
                                <button
                                  key={n.v}
                                  type="button"
                                  data-o={`${r}-${c}`}
                                  tabIndex={tieuDiem.r === r && tieuDiem.c === c ? 0 : -1}
                                  aria-pressed={chon}
                                  aria-disabled={!ghiDuoc || undefined}
                                  onFocus={() => setTieuDiem({ r, c })}
                                  onKeyDown={(ev) => phim(ev, r, c)}
                                  onClick={() => danh(id, n.v)}
                                  className={`nhan inline-flex h-12 w-16 items-center justify-center gap-1 rounded-[10px] border text-[15px] font-semibold max-[339px]:w-full lg:h-11 ${chon ? n.chon : "border-border-input text-text-2"} ${ghiDuoc ? "" : "opacity-60"}`}
                                >
                                  {chon ? <IconDau size={14} strokeWidth={3} /> : null}
                                  {n.nhan}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                        <td className="hidden px-3 lg:table-cell">
                          {!h?.tt ? <span className="px-2 text-text-3"><span aria-hidden="true">—</span><span className="sr-only">Chưa điểm danh, chưa ghi chú được</span></span> : (
                          <label>
                            <span className="sr-only">Ghi chú cho {e.ho_ten}</span>
                            <input
                              key={`${id}-${h?.ghiChu ?? ""}`}
                              data-ghi-chu={id}
                              defaultValue={h?.ghiChu ?? ""}
                              disabled={!ghiDuoc}
                              placeholder="Thêm ghi chú…"
                              maxLength={500}
                              onBlur={(ev) => luuGhiChu(id, ev.target.value)}
                              onKeyDown={(ev) => { if (ev.key === "Enter") ev.currentTarget.blur(); }}
                              className="min-h-11 w-full rounded-[10px] border border-transparent bg-transparent px-2 text-sm text-text placeholder:text-text-3 hover:border-border-input focus:border-border-input disabled:opacity-60"
                            />
                          </label>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {d.het_thu_khong_co_ten.so_em > 0 ? (
              <p className="mt-3 text-[14px] text-text-2">
                {d.het_thu_khong_co_ten.so_em} em hết thử {d.het_thu_khong_co_ten.ngay.map(ddmm).join(", ")} không có trong buổi này
                {chu ? <> · <Link href="/quan-ly/hoc-sinh?het=da-het" className="inline-flex min-h-11 items-center font-semibold text-gold hover:underline">Gia hạn</Link></> : null}
              </p>
            ) : null}
            <p className="mt-3 hidden text-[13px] text-text-3 lg:block">Phím tắt: ↑↓ chọn em · ←→ chọn nút · 1 Có · 2 Phép · 3 Vắng · N ghi chú · Ctrl+Z hoàn tác (trong 5 giây)</p>
          </>
        )}
      </div>

      <ToTruot mo={!!emDangMo} dong={() => setEmMo(null)} tieuDe={emDangMo ? <span translate="no">{emDangMo.ho_ten}</span> : ""}>
        {emDangMo ? (
          <SheetEm
            key={emDangMo.hoc_sinh_id}
            e={emDangMo}
            h={hang[emDangMo.hoc_sinh_id]}
            ghiDuoc={ghiDuoc}
            danh={(t) => danh(emDangMo.hoc_sinh_id, t)}
            luu={(s) => luuGhiChu(emDangMo.hoc_sinh_id, s)}
          />
        ) : null}
      </ToTruot>
      <ToTruot
        mo={hoiMoSua}
        dong={() => setHoiMoSua(false)}
        tieuDe="Sửa điểm danh buổi đã qua 48 giờ?"
        chan={
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" className={nutPhu} onClick={() => setHoiMoSua(false)}>Để nguyên</button>
            <button type="button" className={nutChinh} onClick={() => { setMoSua(true); setHoiMoSua(false); }}>Mở sửa cả buổi</button>
          </div>
        }
      >
        <p className="text-text-2">Buổi {b.mon.ten} {thuNgay(b.ngay)} đã qua {ngayQua} ngày. Sửa điểm danh sẽ đổi chuyên cần và học phí; mọi lần sửa đều ghi nhật ký. Chỉ hỏi một lần cho cả buổi.</p>
      </ToTruot>
    </>
  );
}

function SheetEm({ e, h, ghiDuoc, danh, luu }: { e: Em; h: Hang | undefined; ghiDuoc: boolean; danh: (t: TT | null) => void; luu: (s: string) => void }) {
  return (
    <div className="grid gap-4">
      <div>{e.loai === "thu" ? <TrialChip con={e.thu_con_ngay} /> : <Chip mau="ok">Chính thức</Chip>} <span className="ml-1 text-[13px] text-text-3" translate="no">{e.ma_hs}</span></div>
      <div role="group" aria-label={`Điểm danh ${e.ho_ten}`} className="grid grid-cols-3 gap-2">
        {NUT_DD.map((n) => {
          const chon = h?.tt === n.v;
          return (
            <button key={n.v} type="button" aria-pressed={chon} aria-disabled={!ghiDuoc || undefined} onClick={() => danh(n.v)} className={`nhan inline-flex h-14 items-center justify-center gap-1 rounded-[14px] border text-base font-semibold ${chon ? n.chon : "border-border-input text-text-2"} ${ghiDuoc ? "" : "opacity-60"}`}>
              {chon ? <IconDau size={16} strokeWidth={3} /> : null}{n.nhan}
            </button>
          );
        })}
      </div>
      <p className="text-[13px] text-text-3">{h?.tt ? `Đang: ${TEN_TT[h.tt]}` : "Chưa điểm"}</p>
      <label className="block">
        <span className={nhan}>Ghi chú buổi này</span>
        <textarea
          key={h?.ghiChu ?? ""}
          defaultValue={h?.ghiChu ?? ""}
          disabled={!ghiDuoc || !h?.tt}
          rows={2}
          maxLength={500}
          placeholder={h?.tt ? "Ví dụ: Ốm, đã báo Zalo" : "Chọn Có / Phép / Vắng trước khi ghi chú"}
          onBlur={(ev) => luu(ev.target.value)}
          className={`${oNhap} mt-1 py-2 disabled:opacity-60`}
        />
      </label>
      <div className="flex flex-wrap gap-3">
        {h?.tt && ghiDuoc ? <button type="button" className={nutPhu} onClick={() => danh(null)}>Về chưa điểm</button> : null}
        <Link href={`/quan-ly/hoc-sinh/${e.ma_hs}`} className={nutPhu}>Xem hồ sơ em</Link>
      </div>
    </div>
  );
}

function BoHuy({ id, xong }: { id: number; xong: () => void }) {
  const [dang, setDang] = useState(false);
  return (
    <button type="button" disabled={dang} className={`${nutPhu} mt-3`} onClick={async () => { setDang(true); await fetch(`/api/buoi-hoc/${id}/bo-huy`, { method: "POST" }); setDang(false); xong(); }}>
      Bỏ huỷ buổi
    </button>
  );
}
