"use client";
// Phần tương tác của màn Buổi học (man-buoi-hoc.md): dán link record + nội dung buổi (chủ + GV môn, qua hàng đợi),
// huỷ / bỏ huỷ / xoá buổi và thêm học bù (chỉ chủ, lý do bắt buộc, Hoàn tác 5 giây).
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { chuanHoaLink } from "@/lib/quy-tac";
import { congNgay } from "@/lib/ngay";
import { ddmm, thuNgay } from "../dinh-dang";
import { IconCong, IconMoNgoai } from "../bieu-tuong";
import { ToTruot } from "../ui/to-truot";
import { nhan, nutChinh, nutNguy, nutPhu, oNhap } from "../ui/nut";
import { useHoanTac } from "../khung/hoan-tac";
import { datViec, dangKyXuLy, useHangDoi, viecCuaNhom } from "../khung/hang-doi";

const MIEN_QUEN = ["drive.google.com", "docs.google.com", "youtube.com", "www.youtube.com", "youtu.be", "m.youtube.com"];

/** Tự cuộn tức thì tới tuần có hôm nay khi mở trang (không trượt). */
export function CuonToi({ id }: { id: string }) {
  useEffect(() => {
    document.getElementById(id)?.scrollIntoView({ block: "start" });
  }, [id]);
  return null;
}

export function SuaBuoi({ id, linkRecord, noiDung, dan }: { id: number; linkRecord: string | null; noiDung: string | null; dan: boolean }) {
  const nhom = `buoi:${id}`;
  const [link, setLink] = useState(linkRecord ?? "");
  const [daLuu, setDaLuu] = useState(linkRecord);
  const [loi, setLoi] = useState("");
  const [nd, setNd] = useState(noiDung ?? "");
  const [coDan, setCoDan] = useState(false);
  const router = useRouter();
  useHangDoi();
  const cho = viecCuaNhom(nhom);
  const idLink = useId(), idNd = useId();
  const o = useRef<HTMLInputElement>(null);

  useEffect(() => { setCoDan(typeof navigator !== "undefined" && !!navigator.clipboard?.readText); }, []);
  useEffect(() => { if (dan) o.current?.focus(); }, [dan]);
  useEffect(() => dangKyXuLy(nhom, {
    ok: (v, kq) => {
      const k = kq as { link_record?: string | null };
      if ("linkRecord" in v.body) { setDaLuu(k.link_record ?? null); setLink(k.link_record ?? ""); }
      router.refresh();
    },
    loi: (_v, _s, kq) => setLoi(kq.loi ?? "Không lưu được"),
  }), [nhom, router]);

  function luuLink(v: string) {
    const s = v.trim();
    if (s === (daLuu ?? "")) return setLoi("");
    if (s && !chuanHoaLink(s)) return setLoi("Đây không phải link. Dán link chia sẻ của video (bắt đầu bằng https://).");
    const chuan = s ? chuanHoaLink(s)! : null;
    setLoi("");
    setLink(chuan ?? "");
    datViec({ khoa: `buoi:${id}:record`, nhom, url: `/api/buoi-hoc/${id}`, method: "PATCH", body: { linkRecord: chuan } });
  }
  function luuNd(v: string) {
    if (v.trim() === (noiDung ?? "")) return;
    datViec({ khoa: `buoi:${id}:noi-dung`, nhom, url: `/api/buoi-hoc/${id}`, method: "PATCH", body: { noiDung: v.trim() || null } });
  }
  const host = (() => { try { return link ? new URL(link).hostname : ""; } catch { return ""; } })();
  const lacMien = !!host && !loi && !MIEN_QUEN.includes(host);
  const choLink = cho.some((v) => v.khoa.endsWith(":record"));

  return (
    <div className="grid gap-4">
      <div>
        <label htmlFor={idLink} className={nhan}>Link record</label>
        <div className="mt-1 flex gap-2">
          <input
            ref={o}
            id={idLink}
            type="url"
            inputMode="url"
            name="record"
            autoComplete="off"
            spellCheck={false}
            value={link}
            placeholder="https://drive.google.com/…"
            onChange={(e) => setLink(e.target.value)}
            onPaste={(e) => { const s = e.clipboardData.getData("text"); e.preventDefault(); setLink(s); luuLink(s); }}
            onBlur={(e) => luuLink(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); luuLink(e.currentTarget.value); } }}
            aria-invalid={!!loi}
            aria-describedby={`${idLink}-tt`}
            className={`${oNhap} min-w-0 flex-1`}
          />
          {coDan ? (
            <button type="button" className={`${nutPhu} min-h-12 w-16 shrink-0 px-2`} onClick={async () => { try { const s = await navigator.clipboard.readText(); setLink(s); luuLink(s); } catch { o.current?.focus(); } }}>Dán</button>
          ) : null}
        </div>
        <p id={`${idLink}-tt`} className="mt-1 min-h-5 text-[13px]" aria-live="polite">
          {loi ? <span className="text-danger">{loi}</span> : choLink ? <span className="text-text-3">Đang lưu…</span> : daLuu ? (
            <span className="text-text-3">Đã lưu · <a href={daLuu} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 font-semibold text-gold hover:underline">Mở link <IconMoNgoai size={14} /></a></span>
          ) : null}
          {lacMien ? <span className="block text-warn">Link không phải Drive/YouTube — kiểm tra học sinh mở được không.</span> : null}
        </p>
      </div>
      <div>
        <label htmlFor={idNd} className={nhan}>Nội dung buổi</label>
        <textarea id={idNd} rows={3} maxLength={2000} value={nd} onChange={(e) => setNd(e.target.value)} onBlur={(e) => luuNd(e.target.value)} className={`${oNhap} mt-1 py-2`} placeholder="Ví dụ: Hàm số lượng giác — phần 2" />
        <p className="text-[13px] text-text-3">
          {cho.some((v) => v.khoa.endsWith(":noi-dung")) ? "Đang lưu…" : "Lưu khi rời ô. Học sinh thấy nội dung ngay khi ghi."}
          {2000 - nd.length < 200 ? <span className="so ml-2 text-warn">còn {2000 - nd.length} ký tự</span> : null}
        </p>
      </div>
    </div>
  );
}

type BuoiNho = { id: number; ngay: string; gio: string; mon: { ma: string; ten: string }; trang_thai: string; loai: string };
type Mon = { ma: string; ten: string };

/** Huỷ / bỏ huỷ / xoá buổi (chỉ chủ). */
export function HanhDongBuoi({ b, daDiem, coDuLieu, mon, ds, homNay }: { b: BuoiNho & { ly_do_huy: string | null }; daDiem: number; coDuLieu: boolean; mon: Mon[]; ds: BuoiNho[]; homNay: string }) {
  const [mo, setMo] = useState<"huy" | "bu" | null>(null);
  const [lyDo, setLyDo] = useState("");
  const [buNgay, setBuNgay] = useState(false);
  const [loi, setLoi] = useState("");
  const [dang, setDang] = useState(false);
  const router = useRouter();
  const { hien } = useHoanTac();
  const mang = useHangDoi().matMang;
  const id = useId();
  const ten = `${b.mon.ten} ${thuNgay(b.ngay)}`;

  async function goi(url: string, method = "POST", body?: unknown) {
    const r = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const kq = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(kq.loi ?? `Lỗi ${r.status}`);
    return kq;
  }
  async function huy() {
    if (!lyDo.trim()) return setLoi("Cần ghi lý do huỷ (học sinh sẽ thấy dòng “Lớp nghỉ” kèm lý do).");
    setDang(true);
    try {
      await goi(`/api/buoi-hoc/${b.id}/huy`, "POST", { lyDo: lyDo.trim(), xacNhan: true });
      setMo(buNgay ? "bu" : null);
      router.refresh();
      hien({ thongDiep: `Đã huỷ buổi ${b.mon.ten} ${ddmm(b.ngay)}`, hoanTac: async () => { await goi(`/api/buoi-hoc/${b.id}/bo-huy`); router.refresh(); hien({ thongDiep: "Đã đổi về Có học" }); } });
      setLyDo("");
    } catch (e) { setLoi((e as Error).message); } finally { setDang(false); }
  }
  async function boHuy() {
    try { await goi(`/api/buoi-hoc/${b.id}/bo-huy`); router.refresh(); hien({ thongDiep: "Đã bỏ huỷ — buổi về Có học, điểm danh cũ hiện lại" }); } catch (e) { hien({ thongDiep: (e as Error).message }); }
  }
  async function xoa() {
    try { await goi(`/api/buoi-hoc/${b.id}`, "DELETE"); router.replace(`/quan-ly/buoi-hoc?thang=${b.ngay.slice(0, 7)}`); hien({ thongDiep: `Đã xoá buổi ${b.mon.ten} ${ddmm(b.ngay)}` }); } catch (e) { hien({ thongDiep: (e as Error).message }); }
  }

  if (mang) return <p className="text-[14px] text-warn">Cần có mạng để thêm hoặc huỷ buổi.</p>;
  return (
    <div className="flex flex-wrap gap-3">
      {b.trang_thai === "huy" ? (
        <button type="button" className={nutPhu} onClick={boHuy}>Bỏ huỷ buổi</button>
      ) : (
        <button type="button" className={`${nutNguy} min-h-11`} onClick={() => { setLoi(""); setMo("huy"); }}>Huỷ buổi…</button>
      )}
      {b.trang_thai === "huy" ? <button type="button" className={nutPhu} onClick={() => setMo("bu")}>Thêm học bù cho buổi này</button> : null}
      {!coDuLieu ? <button type="button" className={nutPhu} onClick={xoa}>Xoá buổi</button> : null}

      <ToTruot
        mo={mo === "huy"}
        dong={() => setMo(null)}
        tieuDe={`Huỷ buổi ${ten}?`}
        chan={
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" autoFocus className={nutPhu} onClick={() => setMo(null)}>Giữ buổi</button>
            <button type="button" className={nutNguy} onClick={huy} disabled={dang}>{dang ? "Đang huỷ…" : "Huỷ buổi"}</button>
          </div>
        }
      >
        <p className="text-text-2">Buổi nghỉ không tính học phí và chuyên cần.</p>
        {daDiem > 0 ? <p className="mt-2 text-text-2">Buổi đã có <span className="so">{daDiem}</span> lượt điểm danh. Điểm danh được giữ lại và hiện lại nếu đổi về Có học.</p> : null}
        <label className="mt-4 block" htmlFor={id}><span className={nhan}>Lý do (bắt buộc)</span></label>
        <input id={id} value={lyDo} onChange={(e) => { setLyDo(e.target.value); setLoi(""); }} placeholder="GV ốm, Nghỉ lễ…" className={`${oNhap} mt-1`} aria-invalid={!!loi} autoComplete="off" />
        <label className="mt-3 flex min-h-11 items-center gap-3">
          <input type="checkbox" className="size-5 accent-gold" checked={buNgay} onChange={(e) => setBuNgay(e.target.checked)} />
          Thêm buổi học bù ngay
        </label>
        {loi ? <p role="alert" className="mt-2 text-danger">{loi}</p> : null}
      </ToTruot>
      {mo === "bu" ? <HocBu mon={mon} ds={ds} homNay={homNay} buCho={b} dong={() => setMo(null)} /> : null}
    </div>
  );
}

/** Nút "+ Học bù" ở đầu trang (chỉ chủ). */
export function NutHocBu({ mon, ds, homNay }: { mon: Mon[]; ds: BuoiNho[]; homNay: string }) {
  const [mo, setMo] = useState(false);
  return (
    <>
      <button type="button" className={`${nutPhu} px-3`} onClick={() => setMo(true)}><IconCong size={20} />Học bù</button>
      {mo ? <HocBu mon={mon} ds={ds} homNay={homNay} dong={() => setMo(false)} /> : null}
    </>
  );
}

function HocBu({ mon, ds, homNay, buCho, dong }: { mon: Mon[]; ds: BuoiNho[]; homNay: string; buCho?: BuoiNho; dong: () => void }) {
  const [monMa, setMonMa] = useState(buCho?.mon.ma ?? mon[0]?.ma ?? "");
  const [ngay, setNgay] = useState(buCho ? congNgay(buCho.ngay, 1) : homNay);
  const [gio, setGio] = useState("22:15");
  const [soPhut, setSoPhut] = useState(90);
  const [buChoId, setBuChoId] = useState<number | "">(buCho?.id ?? "");
  const [ghiChu, setGhiChu] = useState("");
  const [loi, setLoi] = useState("");
  const [dang, setDang] = useState(false);
  const router = useRouter();
  const { hien } = useHoanTac();
  const trung = ds.find((b) => b.mon.ma === monMa && b.ngay === ngay && b.gio === gio && b.trang_thai !== "huy");
  const cungGio = ds.filter((b) => b.mon.ma !== monMa && b.ngay === ngay && b.gio === gio && b.trang_thai !== "huy");
  const huyCuaMon = ds.filter((b) => b.mon.ma === monMa && b.trang_thai === "huy");
  const tenMon = mon.find((m) => m.ma === monMa)?.ten ?? "";

  async function gui() {
    if (trung) return setLoi(`${tenMon} đã có buổi ${gio} ngày ${ddmm(ngay)}. Chọn giờ hoặc ngày khác.`);
    setDang(true);
    setLoi("");
    try {
      const r = await fetch("/api/buoi-hoc/hoc-bu", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mon: monMa, ngay, gio, soPhut, ...(buChoId ? { buChoBuoiId: buChoId } : {}), ...(ghiChu.trim() ? { ghiChu: ghiChu.trim() } : {}) }) });
      const kq = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(kq.loi ?? `Lỗi ${r.status}`);
      dong();
      router.push(`/quan-ly/buoi-hoc?thang=${ngay.slice(0, 7)}&buoi=${kq.id}`);
      hien({
        thongDiep: `Đã thêm buổi học bù ${tenMon} ${ddmm(ngay)}${kq.canh_bao?.length ? ` · ${kq.canh_bao.join("; ")}` : ""}`,
        hoanTac: async () => {
          const x = await fetch(`/api/buoi-hoc/${kq.id}`, { method: "DELETE" });
          hien({ thongDiep: x.ok ? "Đã bỏ buổi học bù vừa thêm" : ((await x.json().catch(() => ({}))).loi ?? "Không bỏ được buổi") });
          router.replace(`/quan-ly/buoi-hoc?thang=${ngay.slice(0, 7)}`);
        },
      });
    } catch (e) { setLoi((e as Error).message); } finally { setDang(false); }
  }

  return (
    <ToTruot
      mo
      dong={dong}
      tieuDe="Thêm buổi học bù"
      chan={
        <>
          <p className="mb-3 text-[13px] text-text-3">Buổi học bù được tính vào học phí như buổi thường.</p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" className={nutPhu} onClick={dong}>Huỷ</button>
            <button type="button" className={nutChinh} onClick={gui} disabled={dang || !!trung}>{dang ? "Đang thêm…" : "Thêm buổi"}</button>
          </div>
        </>
      }
    >
      <fieldset>
        <legend className={nhan}>Môn</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {mon.map((m) => (
            <button key={m.ma} type="button" aria-pressed={monMa === m.ma} onClick={() => { setMonMa(m.ma); setBuChoId(""); }} className={`nhan min-h-11 rounded-[10px] border px-4 font-semibold ${monMa === m.ma ? "border-gold bg-nav-active text-gold" : "border-border-input text-text-2"}`}>{m.ten}</button>
          ))}
        </div>
      </fieldset>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="block"><span className={nhan}>Ngày</span><input type="date" value={ngay} onChange={(e) => setNgay(e.target.value)} className={`${oNhap} mt-1 so`} /></label>
        <label className="block"><span className={nhan}>Giờ</span><input type="time" value={gio} onChange={(e) => setGio(e.target.value)} className={`${oNhap} mt-1 so`} /></label>
      </div>
      <label className="mt-3 block"><span className={nhan}>Thời lượng (phút)</span><input type="number" min={15} max={300} step={15} value={soPhut} onChange={(e) => setSoPhut(Number(e.target.value))} className={`${oNhap} mt-1 so`} /></label>
      {huyCuaMon.length ? (
        <label className="mt-3 block">
          <span className={nhan}>Bù cho buổi (tuỳ chọn)</span>
          <select value={buChoId} onChange={(e) => setBuChoId(e.target.value ? Number(e.target.value) : "")} className={`${oNhap} mt-1`}>
            <option value="">Không gắn</option>
            {huyCuaMon.map((b) => <option key={b.id} value={b.id}>Lớp nghỉ {thuNgay(b.ngay)}</option>)}
          </select>
        </label>
      ) : null}
      <label className="mt-3 block"><span className={nhan}>Ghi chú / nội dung</span><input value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} className={`${oNhap} mt-1`} autoComplete="off" /></label>
      <div aria-live="polite" className="mt-2 text-[14px]">
        {trung ? <p className="text-danger">{tenMon} đã có buổi {gio} ngày {ddmm(ngay)}. Chọn giờ hoặc ngày khác.</p> : null}
        {cungGio.length ? <p className="text-warn">Cùng giờ với {cungGio.map((b) => `${b.mon.ten} ${b.gio}`).join(", ")} — em học cả hai môn sẽ bị trùng.</p> : null}
        {loi && !trung ? <p role="alert" className="text-danger">{loi}</p> : null}
      </div>
    </ToTruot>
  );
}

/** Tháng chưa có lịch: chủ sinh buổi theo lịch môn (lặp lại an toàn, không tạo trùng). */
export function SinhBuoi({ thang }: { thang: string }) {
  const [dang, setDang] = useState(false);
  const [kq, setKq] = useState("");
  const router = useRouter();
  return (
    <div className="mt-3">
      <button type="button" className={nutChinh} disabled={dang} onClick={async () => {
        setDang(true);
        const r = await fetch("/api/buoi-hoc/sinh", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ thang }) });
        const k = await r.json().catch(() => ({}));
        setKq(r.ok ? `Đã sinh ${k.tao_moi} buổi theo lịch.` : (k.loi ?? "Không sinh được"));
        setDang(false);
        router.refresh();
      }}>{dang ? "Đang sinh…" : `Sinh buổi tháng ${Number(thang.slice(5))}`}</button>
      {kq ? <p className="mt-2 text-text-2" aria-live="polite">{kq}</p> : null}
    </div>
  );
}
