"use client";
// Thao tác của chủ lớp ở trang một em (man-hoc-sinh §6–§9): Gia hạn thử, Chuyển chính thức (có Hoàn tác),
// Cho nghỉ môn, Ghi danh thêm môn, Ẩn hồ sơ. Chỉ dựng khi vai là chủ; máy chủ vẫn chặn mọi vai khác.
// Các thao tác này cần có mạng (liên quan học phí và quyền vào lớp) — không xếp hàng đợi.
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, use, useId, useState, type ReactNode } from "react";
import { congNgay } from "@/lib/ngay";
import { MAC_DINH } from "@/lib/quy-tac";
import { ddmm, tien } from "../dinh-dang";
import { IconThem } from "../bieu-tuong";
import { ToTruot } from "../ui/to-truot";
import { nhan, nutBieuTuong, nutChinh, nutNguy, nutPhu, oNhap } from "../ui/nut";
import { useHoanTac } from "../khung/hoan-tac";
import { useHangDoi } from "../khung/hang-doi";
import { NgayDoc } from "../ui/ngay-doc";
import { GiaHan } from "./gia-han";

export type MonHs = { ma: string; ten: string; o: "hoc" | "thu" | "nghi" | null; macDinhCT?: string; vuaHetThu?: boolean };
/** gia: đơn giá thật (đồng) từ chiTietHocSinh.caiDat — chỉ chủ; thiếu thì dùng mặc định. */
type Props = { ma: string; ten: string; mon: MonHs[]; thuDen: string | null; het: string | null; homNay: string; macDinhNghi: string; gia?: { GIA_1_MON: number; GIA_TU_2_MON: number } };
type Mo = { kieu: "gia-han" } | { kieu: "chinh-thuc"; mon?: string } | { kieu: "nghi"; mon?: string } | { kieu: "them"; mon: string } | { kieu: "menu"; mon: string } | { kieu: "an" } | null;

async function goi(url: string, body: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const kq = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(kq.loi ?? `Không làm được (mã ${r.status}).`);
  return kq;
}

const Ctx = createContext<{ p: Props; mo: (m: Mo) => void } | null>(null);
const useThaoTac = () => {
  const c = use(Ctx);
  if (!c) throw new Error("Cần ThaoTacHs bao ngoài");
  return c;
};

/** Bao trang một em: giữ trạng thái hộp thoại; các nút (NutChinhHs, NutMon, NutAnHoSo) là đảo client nhỏ bên trong. */
export function ThaoTacHs({ children, ...p }: Props & { children: ReactNode }) {
  const sp = useSearchParams();
  const path = usePathname();
  const router = useRouter();
  const banDau = sp.get("mo");
  const [mo, setMo] = useState<Mo>(banDau === "chinh-thuc" ? { kieu: "chinh-thuc" } : banDau === "nghi" ? { kieu: "nghi" } : banDau === "gia-han" ? { kieu: "gia-han" } : null);
  const dong = () => { setMo(null); if (banDau) router.replace(path, { scroll: false }); };
  const dangThu = p.mon.filter((m) => m.o === "thu");
  const monMo = p.mon.filter((m) => m.o === "thu" || m.o === "hoc");
  return (
    <Ctx value={{ p, mo: setMo }}>
      {children}
      <GiaHan
        em={[{ ma_hs: p.ma, ho_ten: p.ten, mon: dangThu.map((m) => m.ten), den: p.thuDen, het: p.het ? ddmm(p.het) : null }]}
        homNay={p.homNay}
        mo={mo?.kieu === "gia-han"}
        dong={dong}
      />
      {mo?.kieu === "chinh-thuc" ? <ChinhThuc {...p} monBatDau={mo.mon} dong={dong} /> : null}
      {mo?.kieu === "nghi" ? <Nghi {...p} monChon={mo.mon ?? monMo[0]?.ma} dong={dong} /> : null}
      {mo?.kieu === "them" ? <Them {...p} monMa={mo.mon} dong={dong} /> : null}
      {mo?.kieu === "an" ? <AnHoSo {...p} dong={dong} /> : null}
      <ToTruot mo={mo?.kieu === "menu"} dong={dong} tieuDe={mo?.kieu === "menu" ? `${p.mon.find((m) => m.ma === mo.mon)?.ten} · ${p.ten}` : ""}>
        {mo?.kieu === "menu" ? (
          <div className="grid gap-3">
            {p.mon.find((m) => m.ma === mo.mon)?.o === "thu" ? (
              <>
                <button type="button" className={`${nutPhu} min-h-12`} onClick={() => setMo({ kieu: "gia-han" })}>Gia hạn thử</button>
                <button type="button" className={`${nutPhu} min-h-12`} onClick={() => setMo({ kieu: "chinh-thuc", mon: mo.mon })}>Chuyển chính thức môn này</button>
              </>
            ) : null}
            <button type="button" className={`${nutPhu} min-h-12 text-danger`} onClick={() => setMo({ kieu: "nghi", mon: mo.mon })}>Cho nghỉ môn này</button>
          </div>
        ) : null}
      </ToTruot>
    </Ctx>
  );
}

/** "Chuyển chính thức" (vàng) + "Gia hạn thử" — chỉ khi em đang thử hoặc vừa hết thử. */
export function NutChinhHs({ khoa = false }: { khoa?: boolean }) {
  const { p, mo } = useThaoTac();
  if (!p.mon.some((m) => m.o === "thu") && !p.het) return null;
  return (
    <div className={`flex gap-3 ${khoa ? "flex-wrap" : "flex-col sm:flex-row"}`}>
      <button type="button" className={`${nutChinh} sm:min-h-11`} onClick={() => mo({ kieu: "chinh-thuc" })}>Chuyển chính thức</button>
      <button type="button" className={`${nutPhu} min-h-12 sm:min-h-11`} onClick={() => mo({ kieu: "gia-han" })}>Gia hạn thử</button>
    </div>
  );
}

/** Nút nhỏ trên từng hàng môn (Ghi danh / ⋯). */
export function NutMon({ ma }: { ma: string }) {
  const { p, mo } = useThaoTac();
  const m = p.mon.find((x) => x.ma === ma);
  if (!m) return null;
  if (m.o === null || m.o === "nghi")
    return <button type="button" className={`${nutPhu} min-h-11 px-3 text-[14px]`} onClick={() => mo({ kieu: "them", mon: m.ma })}>{m.o === null ? "Ghi danh" : "Ghi danh lại"}</button>;
  return <button type="button" className={nutBieuTuong} aria-label={`Thao tác môn ${m.ten}`} onClick={() => mo({ kieu: "menu", mon: m.ma })}><IconThem /></button>;
}

export function NutAnHoSo() {
  const { mo } = useThaoTac();
  return <button type="button" className="min-h-11 px-2 text-[14px] font-semibold text-text-2 hover:text-danger" onClick={() => mo({ kieu: "an" })}>Ẩn hồ sơ…</button>;
}

function ChanNut({ huy, chinh, nguy = false, dang, mang }: { huy: () => void; chinh: { nhan: string; bam: () => void }; nguy?: boolean; dang: boolean; mang: boolean }) {
  if (mang) return <p className="py-2 text-warn">Cần có mạng để làm việc này.</p>;
  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
      <button type="button" className={nutPhu} onClick={huy}>Huỷ</button>
      <button type="button" className={nguy ? nutNguy : nutChinh} onClick={chinh.bam} disabled={dang}>{dang ? "Đang làm…" : chinh.nhan}</button>
    </div>
  );
}

function ChinhThuc({ ma, ten, mon, homNay, gia = MAC_DINH, monBatDau, dong }: Props & { monBatDau?: string; dong: () => void }) {
  const thu = mon.filter((m) => m.o === "thu");
  const chua = mon.filter((m) => m.o === null || m.o === "nghi");
  const [chon, setChon] = useState<Set<string>>(new Set(monBatDau ? [monBatDau] : thu.length ? thu.map((m) => m.ma) : mon.filter((m) => m.vuaHetThu).map((m) => m.ma)));
  const macDinh = (thu.find((m) => chon.has(m.ma)) ?? mon.find((m) => chon.has(m.ma)))?.macDinhCT ?? homNay;
  const [ngay, setNgay] = useState<string | null>(null);
  const [nghiConLai, setNghiConLai] = useState(false);
  const [loi, setLoi] = useState("");
  const [dang, setDang] = useState(false);
  const { hien } = useHoanTac();
  const router = useRouter();
  const mang = useHangDoi().matMang;
  const tu = ngay ?? macDinh;
  const soMon = mon.filter((m) => m.o === "hoc").length + chon.size;
  const conThuKhongChon = thu.filter((m) => !chon.has(m.ma));
  const idNgay = useId();

  async function gui() {
    if (!chon.size) return setLoi("Chọn ít nhất một môn.");
    setDang(true);
    setLoi("");
    try {
      const kq = await goi(`/api/hoc-sinh/${ma}/chuyen-chinh-thuc`, { mon: [...chon], ...(ngay ? { tuNgay: ngay } : {}), nghiMonThuConLai: nghiConLai });
      dong();
      router.refresh();
      hien({
        thongDiep: `Đã chuyển ${ten} lên chính thức ${[...chon].map((x) => mon.find((m) => m.ma === x)?.ten).join(", ")}`,
        hoanTac: async () => {
          try {
            await goi(`/api/hoc-sinh/${ma}/chuyen-chinh-thuc/hoan-tac`, { nhatKyId: kq.nhatKyId });
            hien({ thongDiep: "Đã hoàn tác chuyển chính thức" });
          } catch (e) {
            hien({ thongDiep: (e as Error).message });
          }
          router.refresh();
        },
      });
    } catch (e) {
      setLoi((e as Error).message);
    } finally {
      setDang(false);
    }
  }
  const o = (m: MonHs) => (
    <label key={m.ma} className="flex min-h-11 items-center gap-3">
      <input type="checkbox" className="o-tich size-5" checked={chon.has(m.ma)} onChange={() => setChon((s) => { const n = new Set(s); if (n.has(m.ma)) n.delete(m.ma); else n.add(m.ma); return n; })} />
      <span>{m.ten} <span className="text-text-3">· {m.o === "thu" ? "đang thử" : m.vuaHetThu ? "vừa hết thử" : m.o === "nghi" ? "đã nghỉ" : "chưa ghi danh"}</span></span>
    </label>
  );
  return (
    <ToTruot mo dong={dong} tieuDe={`Chuyển chính thức · ${ten}`} chan={<ChanNut huy={dong} chinh={{ nhan: "Chuyển chính thức", bam: gui }} dang={dang} mang={mang} />}>
      <fieldset>
        <legend className={nhan}>Môn</legend>
        <div className="mt-1">{thu.map(o)}{chua.map(o)}</div>
      </fieldset>
      <label className="mt-3 block">
        <span className={nhan}>Chính thức từ ngày</span>
        <input type="date" value={tu} onChange={(e) => setNgay(e.target.value || null)} className={`${oNhap} mt-1 so`} aria-describedby={idNgay} />
      </label>
      <NgayDoc ngay={tu} id={idNgay} />
      <p className="text-[13px] text-text-3">Buổi Có học/Học bù từ ngày này tính vào học phí.</p>
      {tu < macDinh && thu.some((m) => chon.has(m.ma)) ? <p className="mt-1 text-[13px] text-warn">Lên chính thức sớm — thử cắt còn đến {ddmm(congNgay(tu, -1))}.</p> : null}
      <p className="so mt-3 rounded-[14px] bg-raised px-3 py-2 text-[14px]">
        Từ {ddmm(tu)} học {soMon} môn → {soMon >= 2 ? `${tien(gia.GIA_TU_2_MON)}/buổi/môn` : `${tien(gia.GIA_1_MON)}/buổi`} (dự kiến — tiền thật tính theo số môn có buổi trong kỳ)
      </p>
      {conThuKhongChon.length ? (
        <label className="mt-3 flex min-h-11 items-center gap-3">
          <input type="checkbox" className="o-tich size-5" checked={nghiConLai} onChange={(e) => setNghiConLai(e.target.checked)} />
          <span>Cho nghỉ các môn thử còn lại ({conThuKhongChon.map((m) => m.ten).join(", ")})</span>
        </label>
      ) : null}
      {loi ? <p role="alert" className="mt-2 text-danger">{loi}</p> : null}
    </ToTruot>
  );
}

function Nghi({ ma, ten, mon, macDinhNghi, monChon, dong }: Props & { monChon?: string; dong: () => void }) {
  const mo = mon.filter((m) => m.o === "thu" || m.o === "hoc");
  const [monMa, setMonMa] = useState(monChon ?? mo[0]?.ma ?? "");
  const [ngay, setNgay] = useState(macDinhNghi);
  const [loi, setLoi] = useState("");
  const [dang, setDang] = useState(false);
  const { hien } = useHoanTac();
  const router = useRouter();
  const mang = useHangDoi().matMang;
  const id = useId();
  const tenMon = mon.find((m) => m.ma === monMa)?.ten ?? "";
  async function gui() {
    setDang(true);
    setLoi("");
    try {
      await goi(`/api/hoc-sinh/${ma}/nghi-mon`, { mon: monMa, denNgay: ngay });
      dong();
      router.refresh();
      hien({ thongDiep: `${ten} nghỉ ${tenMon} từ ${ddmm(congNgay(ngay, 1))}` });
    } catch (e) {
      setLoi((e as Error).message);
    } finally {
      setDang(false);
    }
  }
  if (!mo.length) return <ToTruot mo dong={dong} tieuDe="Cho nghỉ môn"><p className="text-text-2">Em không còn môn nào đang học.</p></ToTruot>;
  return (
    <ToTruot mo dong={dong} tieuDe={`Cho nghỉ môn · ${ten}`} chan={<ChanNut huy={dong} nguy chinh={{ nhan: `Cho nghỉ môn ${tenMon}`, bam: gui }} dang={dang} mang={mang} />}>
      <label className="block" htmlFor={id}><span className={nhan}>Môn</span></label>
      <select id={id} value={monMa} onChange={(e) => setMonMa(e.target.value)} className={`${oNhap} mt-1`}>
        {mo.map((m) => <option key={m.ma} value={m.ma}>{m.ten} · {m.o === "thu" ? "đang thử" : "chính thức"}</option>)}
      </select>
      <label className="mt-3 block">
        <span className={nhan}>Học đến hết ngày</span>
        <input type="date" value={ngay} onChange={(e) => setNgay(e.target.value)} className={`${oNhap} mt-1 so`} aria-describedby={`${id}-ngay`} />
      </label>
      <NgayDoc ngay={ngay} id={`${id}-ngay`} />
      <p className="mt-2 text-[14px] text-text-2">Em không có tên trong buổi {tenMon} từ {ddmm(congNgay(ngay, 1))}; điểm danh cũ vẫn giữ.</p>
      {loi ? <p role="alert" className="mt-2 text-danger">{loi}</p> : null}
    </ToTruot>
  );
}

function Them({ ma, ten, mon, homNay, monMa, dong }: Props & { monMa: string; dong: () => void }) {
  const [loi, setLoi] = useState("");
  const [dang, setDang] = useState(false);
  const router = useRouter();
  const { hien } = useHoanTac();
  const mang = useHangDoi().matMang;
  const tenMon = mon.find((m) => m.ma === monMa)?.ten ?? "";
  async function gui(loai: "thu" | "chinh_thuc") {
    setDang(true);
    setLoi("");
    try {
      await goi(`/api/hoc-sinh/${ma}/ghi-danh`, { mon: monMa, loai, ...(loai === "chinh_thuc" ? { tuNgay: homNay } : {}) });
      dong();
      router.refresh();
      hien({ thongDiep: `Đã ghi danh ${ten} ${loai === "thu" ? "học thử" : "chính thức"} ${tenMon}` });
    } catch (e) {
      setLoi((e as Error).message);
    } finally {
      setDang(false);
    }
  }
  return (
    <ToTruot mo dong={dong} tieuDe={`Ghi danh ${tenMon} · ${ten}`}>
      {mang ? <p className="text-warn">Cần có mạng để ghi danh.</p> : (
        <div className="grid gap-3">
          <button type="button" disabled={dang} className={`${nutPhu} min-h-12`} onClick={() => gui("thu")}>Học thử (theo hạn thử chung, mặc định 14 ngày)</button>
          <button type="button" disabled={dang} className={nutChinh} onClick={() => gui("chinh_thuc")}>Chính thức từ hôm nay {ddmm(homNay)}</button>
          <p className="text-[13px] text-text-3">Buổi Có học/Học bù từ ngày chính thức tính vào học phí.</p>
        </div>
      )}
      {loi ? <p role="alert" className="mt-2 text-danger">{loi}</p> : null}
    </ToTruot>
  );
}

function AnHoSo({ ma, ten, macDinhNghi, dong }: Props & { dong: () => void }) {
  const [loi, setLoi] = useState("");
  const [dang, setDang] = useState(false);
  const router = useRouter();
  const mang = useHangDoi().matMang;
  async function gui() {
    setDang(true);
    try {
      await goi(`/api/hoc-sinh/${ma}/an`, {});
      router.push("/quan-ly/hoc-sinh");
    } catch (e) {
      setLoi((e as Error).message);
      setDang(false);
    }
  }
  return (
    <ToTruot mo dong={dong} tieuDe={`Ẩn hồ sơ ${ten}?`} chan={<ChanNut huy={dong} nguy chinh={{ nhan: "Ẩn hồ sơ", bam: gui }} dang={dang} mang={mang} />}>
      <p className="text-text-2">Mọi môn còn mở dừng sau ngày {ddmm(macDinhNghi)}. Hồ sơ không bị xoá (điểm danh cũ vẫn giữ); bỏ ẩn trong hôm nay thì khôi phục lại ghi danh.</p>
      <p className="mt-2"><Link href="/quan-ly/hoc-sinh" className="text-[14px] text-text-3 hover:underline">Danh sách học sinh</Link></p>
      {loi ? <p role="alert" className="mt-2 text-danger">{loi}</p> : null}
    </ToTruot>
  );
}
