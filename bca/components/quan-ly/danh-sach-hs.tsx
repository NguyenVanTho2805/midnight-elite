"use client";
// Danh sách học sinh (man-hoc-sinh §3–§5). ~70 em: tìm/lọc ở máy, mọi bộ lọc nằm trên URL
// (?mon=&loai=&lua=&het=&het_ngay=&q=&sap=; het_ngay=YYYY-MM-DD = nhóm "Thử sắp hết · Hết <ngày>" ở Hôm nay). Chủ lớp: chọn nhiều em → Gia hạn thử (T29) kèm Hoàn tác.
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { boDau } from "@/lib/chuan-hoa";
import { ddmm, sdt } from "../dinh-dang";
import { IconDau, IconDong, IconLoc, IconTim } from "../bieu-tuong";
import { MonChip, TrialChip } from "../ui/chip";
import { ToTruot } from "../ui/to-truot";
import { nutChinh, nutChinhTo, nutPhu, oNhap } from "../ui/nut";
import { GiaHan, type EmGiaHan } from "./gia-han";

export type HsDong = {
  ma: string;
  ten: string;
  lua: string | null;
  mon: { ma: string; ten: string; o: "hoc" | "thu" | "nghi" }[];
  tinhTrang: string;
  thu: { den: string; con: number } | null;
  dangKy: string | null;
  sdt?: string | null;
  gmail?: string | null;
};
type Mon = { ma: string; ten: string };
const LOAI = { thu: "thu", "chinh-thuc": "hoc", nghi: "nghi" } as const;
const TEN_LOAI = { thu: "Học thử", "chinh-thuc": "Chính thức", nghi: "Nghỉ" } as const;
const hetThu = (x: HsDong) => x.tinhTrang.startsWith("Hết thử");
const sapHet = (x: HsDong) => !!x.thu && x.thu.con <= 3 && !x.mon.some((m) => m.o === "hoc");

export function DanhSachHs({ ds, mon, chu, homNay }: { ds: HsDong[]; mon: Mon[]; chu: boolean; homNay: string }) {
  const sp = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [chonMo, setChonMo] = useState(false);
  const [chon, setChon] = useState<Set<string>>(new Set());
  const [loc, setLoc] = useState(false);
  const [giaHan, setGiaHan] = useState(false);
  const tre = useRef<ReturnType<typeof setTimeout>>(undefined);

  const hetNgay = /^\d{4}-\d{2}-\d{2}$/.test(sp.get("het_ngay") ?? "") ? sp.get("het_ngay") : null;
  const p = { mon: sp.get("mon"), loai: sp.get("loai") as keyof typeof LOAI | null, lua: sp.get("lua"), het: sp.get("het"), hetNgay, sap: sp.get("sap") ?? "ten" };
  const href = (k: string, v: string | null) => {
    const n = new URLSearchParams(sp);
    if (v === null || n.get(k) === v) n.delete(k);
    else n.set(k, v);
    const s = n.toString();
    return s ? `${path}?${s}` : path;
  };
  useEffect(() => () => clearTimeout(tre.current), []);
  function doiQ(v: string) {
    setQ(v);
    clearTimeout(tre.current);
    tre.current = setTimeout(() => {
      const n = new URLSearchParams(sp);
      if (v.trim()) n.set("q", v.trim()); else n.delete("q");
      router.replace(n.toString() ? `${path}?${n}` : path, { scroll: false });
    }, 300);
  }

  const qq = boDau(q.trim());
  const so = qq.replace(/\D/g, "");
  const khop = (x: HsDong) => {
    if (p.mon || p.loai) {
      const o = p.loai ? LOAI[p.loai] : null;
      if (!x.mon.some((m) => (!p.mon || m.ma === p.mon) && (!o || m.o === o))) return false;
    }
    if (p.lua && x.lua !== p.lua) return false;
    if (p.het === "3" && !sapHet(x)) return false;
    if (p.het === "da-het" && !hetThu(x)) return false;
    // Cùng quy tắc nhóm ở Hôm nay (thuSapHet): hạn thử chung đúng ngày đó, chưa có môn chính thức.
    if (p.hetNgay && !(x.thu?.den === p.hetNgay && !x.mon.some((m) => m.o === "hoc"))) return false;
    if (qq && !(boDau(x.ten).includes(qq) || x.ma.toLowerCase().includes(qq) || (so.length >= 3 && x.sdt?.includes(so)) || x.gmail?.includes(q.trim().toLowerCase()))) return false;
    return true;
  };
  let hien = ds.filter(khop);
  if (p.sap === "moi") hien = [...hien].sort((a, b) => (b.dangKy ?? "").localeCompare(a.dangKy ?? ""));
  if (p.sap === "het") hien = [...hien].sort((a, b) => (a.thu?.den ?? "9").localeCompare(b.thu?.den ?? "9"));
  const soLoc = [p.mon, p.loai, p.lua, p.het, p.hetNgay].filter(Boolean).length;

  const chipNhanh = [
    { k: "het", v: "3", nhan: "Hết thử ≤ 3 ngày", n: ds.filter(sapHet).length },
    { k: "het", v: "da-het", nhan: "Đã hết, chưa quyết", n: ds.filter(hetThu).length },
    { k: "loai", v: "thu", nhan: "Học thử", n: ds.filter((x) => x.mon.some((m) => m.o === "thu")).length },
    { k: "loai", v: "chinh-thuc", nhan: "Chính thức", n: ds.filter((x) => x.mon.some((m) => m.o === "hoc")).length },
  ];
  const chip = (bat: boolean) => `nhan inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-[14px] font-semibold ${bat ? "border-gold bg-nav-active text-gold" : "border-border bg-surface text-text-2 hover:bg-row-hover"}`;
  const chipLoc = (k: string, v: string, children: React.ReactNode) => {
    const bat = sp.get(k) === v;
    return <Link key={`${k}-${v}`} href={href(k, v)} replace scroll={false} aria-current={bat ? "true" : undefined} className={chip(bat)}>{bat ? <IconDau size={14} /> : null}{children}</Link>;
  };

  const doiChon = (ma: string) => setChon((s) => { const n = new Set(s); if (n.has(ma)) n.delete(ma); else n.add(ma); return n; });
  const daChon = ds.filter((x) => chon.has(x.ma));
  const coTheGiaHan = daChon.filter((x) => x.thu || hetThu(x));
  const emGiaHan: EmGiaHan[] = coTheGiaHan.map((x) => ({ ma_hs: x.ma, ho_ten: x.ten, mon: x.mon.filter((m) => m.o === "thu").map((m) => m.ten), den: x.thu?.den ?? null, het: hetThu(x) ? x.tinhTrang.match(/\d\d\/\d\d/)?.[0] ?? null : null }));
  const khongThu = daChon.length - coTheGiaHan.length;
  const tenMon = (ma: string | null) => mon.find((m) => m.ma === ma)?.ten;

  const hanThu = (x: HsDong, lien = false) => (hetThu(x) ? <TrialChip lien={lien} het={x.tinhTrang.match(/\d\d\/\d\d/)?.[0] ?? ""} /> : x.thu ? <TrialChip lien={lien} con={x.thu.con} tienTo="" /> : null);

  return (
    <>
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative min-w-0 flex-1 basis-64">
            <span className="sr-only">Tìm học sinh</span>
            <IconTim className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-3" size={20} />
            <input type="search" value={q} onChange={(e) => doiQ(e.target.value)} placeholder={chu ? "Tìm tên, mã HS, SĐT, Gmail…" : "Tìm tên, mã HS…"} className={`${oNhap} pl-10`} autoComplete="off" spellCheck={false} enterKeyHint="search" />
          </label>
          <button type="button" className={`${nutPhu} lg:hidden`} onClick={() => setLoc(true)}><IconLoc size={20} />Lọc{soLoc ? <span className="so"> · {soLoc}</span> : null}</button>
          {chu ? (
            <button type="button" className={`${nutPhu} lg:hidden`} onClick={() => { setChonMo(!chonMo); setChon(new Set()); }} aria-pressed={chonMo}>{chonMo ? "Thôi chọn" : "Chọn"}</button>
          ) : null}
        </div>
        <ul className="flex flex-wrap gap-2" aria-label="Lọc nhanh">
          {chipNhanh.filter((c) => chu || c.k !== "het").map((c) => <li key={c.v}>{chipLoc(c.k, c.v, <>{c.nhan} <span className="so">{c.n}</span></>)}</li>)}
        </ul>
        <div className="hidden flex-wrap items-center gap-x-4 gap-y-2 lg:flex">
          {mon.length > 1 ? (
            <div className="flex flex-wrap items-center gap-2"><span className="text-[13px] font-semibold text-text-2">Môn:</span>{mon.map((m) => chipLoc("mon", m.ma, <>{m.ten}</>))}</div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2"><span className="text-[13px] font-semibold text-text-2">Lứa:</span>{["L1", "L2"].map((l) => chipLoc("lua", l, <>{l}</>))}</div>
          <div className="flex flex-wrap items-center gap-2"><span className="text-[13px] font-semibold text-text-2">Loại:</span>{chipLoc("loai", "nghi", "Nghỉ")}</div>
        </div>
        <p className="flex min-h-11 flex-wrap items-center gap-2 text-[14px] text-text-2" aria-live="polite">
          {p.mon ? <Link href={href("mon", null)} replace scroll={false} className="inline-flex min-h-11 items-center gap-1 rounded-full bg-raised px-3 font-semibold text-text" aria-label={`Bỏ lọc môn ${tenMon(p.mon)}`}>{tenMon(p.mon)} <IconDong size={16} /></Link> : null}
          {p.hetNgay ? <Link href={href("het_ngay", null)} replace scroll={false} className="so inline-flex min-h-11 items-center gap-1 rounded-full bg-raised px-3 font-semibold text-text" aria-label={`Bỏ lọc hết thử ngày ${ddmm(p.hetNgay)}`}>Hết thử {ddmm(p.hetNgay)} <IconDong size={16} /></Link> : null}
          {p.lua ? <Link href={href("lua", null)} replace scroll={false} className="inline-flex min-h-11 items-center gap-1 rounded-full bg-raised px-3 font-semibold text-text" aria-label={`Bỏ lọc lứa ${p.lua}`}>{p.lua} <IconDong size={16} /></Link> : null}
          <span className="so">{hien.length} em</span>
          {soLoc || q ? <Link href={path} className="ml-1 inline-flex min-h-11 items-center font-semibold text-gold hover:underline" onClick={() => setQ("")}>Bỏ lọc</Link> : null}
        </p>
      </div>

      {!ds.length ? (
        <p className="rounded-[14px] border border-border bg-surface px-4 py-6 text-text-2">Chưa có học sinh. Dữ liệu sẽ có sau khi chuyển từ sheet.</p>
      ) : !hien.length ? (
        <p className="rounded-[14px] border border-border bg-surface px-4 py-6 text-text-2">
          Không có em nào khớp{q ? ` “${q}”` : ""}{p.mon ? ` trong ${tenMon(p.mon)}` : ""}{p.loai ? ` · ${TEN_LOAI[p.loai]}` : ""}. — <Link href={path} onClick={() => setQ("")} className="font-semibold text-gold hover:underline">Bỏ lọc</Link>
        </p>
      ) : (
        <>
          {/* Điện thoại / máy tính bảng: danh sách thẻ */}
          <ul className="rounded-[14px] border border-border bg-surface lg:hidden">
            {hien.map((x) => {
              const noi = (
                <>
                  <span className="flex items-start justify-between gap-2">
                    <span className="font-semibold leading-snug" translate="no">{x.ten}</span>
                    {!chonMo ? <span aria-hidden="true" className="text-text-3">›</span> : null}
                  </span>
                  <span className="so block text-[13px] text-text-3" translate="no">{x.ma}{x.lua ? ` · Lứa ${x.lua.slice(1)}` : ""}</span>
                  <span className="mt-1 flex flex-wrap gap-1.5">{x.mon.map((m) => <MonChip key={m.ma} ten={m.ten} o={m.o} />)}{hanThu(x)}</span>
                </>
              );
              return (
                <li key={x.ma} className="hang-dai border-b border-border last:border-b-0">
                  {chonMo ? (
                    <label className="flex min-h-16 cursor-pointer items-start gap-3 px-4 py-3">
                      <input type="checkbox" checked={chon.has(x.ma)} onChange={() => doiChon(x.ma)} className="o-tich mt-0.5 size-6" aria-label={`Chọn ${x.ten}`} />
                      <span className="min-w-0 flex-1">{noi}</span>
                    </label>
                  ) : (
                    <Link href={`/quan-ly/hoc-sinh/${x.ma}`} className="block min-h-16 px-4 py-3 hover:bg-row-hover">{noi}</Link>
                  )}
                </li>
              );
            })}
          </ul>

          {/* Máy tính: bảng */}
          <div className="hidden rounded-[14px] border border-border bg-surface lg:block">
            {/* table-fixed + colgroup: cột không nhảy khi lọc; hàng 48px (56 khi chip môn xuống dòng). */}
            <table className="w-full table-fixed text-left text-sm">
              <caption className="sr-only">Danh sách học sinh</caption>
              <colgroup>
                {chu ? <col className="w-12" /> : null}
                <col className={chu ? "w-[27%]" : "w-[33%]"} />
                <col className={chu ? "w-[30%]" : "w-[36%]"} />
                <col className={chu ? "w-[17%]" : "w-[19%]"} />
                <col className={chu ? "w-[8%]" : "w-[9%]"} />
                {chu ? <col className="w-[13%]" /> : null}
                <col className="w-8" />
              </colgroup>
              <thead className="bong-dinh sticky top-16 z-10 whitespace-nowrap bg-surface text-[13px] font-semibold text-text-2">
                <tr className="border-b border-border">
                  {chu ? (
                    <th scope="col" className="px-0.5 py-0">
                      <label className="flex size-11 cursor-pointer items-center justify-center">
                        <span className="sr-only">Chọn tất cả em đang hiện</span>
                        <input type="checkbox" className="o-tich size-5" checked={hien.length > 0 && hien.every((x) => chon.has(x.ma))} onChange={(e) => setChon(e.target.checked ? new Set(hien.map((x) => x.ma)) : new Set())} />
                      </label>
                    </th>
                  ) : null}
                  <ThSap k="ten" sap={p.sap} href={href("sap", "ten")}>Học sinh</ThSap>
                  <th scope="col" className="px-3 py-1">Môn</th>
                  <ThSap k="het" sap={p.sap} href={href("sap", "het")}>Hạn thử</ThSap>
                  <ThSap k="moi" sap={p.sap} href={href("sap", "moi")}>Đăng ký</ThSap>
                  {chu ? <th scope="col" className="px-3 py-1">SĐT HS</th> : null}
                  <th scope="col"><span className="sr-only">Mở</span></th>
                </tr>
              </thead>
              <tbody>
                {hien.map((x) => (
                  <tr key={x.ma} className="hang-dai relative h-12 border-b border-border last:border-b-0 hover:bg-row-hover">
                    {chu ? (
                      <td className="relative z-[1] px-0.5 py-0">
                        <label className="flex size-11 cursor-pointer items-center justify-center">
                          <span className="sr-only">Chọn {x.ten}</span>
                          <input type="checkbox" className="o-tich size-5" checked={chon.has(x.ma)} onChange={() => doiChon(x.ma)} />
                        </label>
                      </td>
                    ) : null}
                    <td className="px-3 py-1.5">
                      <Link href={`/quan-ly/hoc-sinh/${x.ma}`} className="font-semibold after:absolute after:inset-0 hover:underline" translate="no">{x.ten}</Link>
                      <span className="so ml-2 whitespace-nowrap text-[13px] text-text-3" translate="no">{x.ma}{x.lua ? ` · ${x.lua}` : ""}</span>
                    </td>
                    <td className="px-3 py-1"><span className="flex flex-wrap gap-x-1.5 gap-y-1">{x.mon.map((m) => <MonChip key={m.ma} ten={m.ten} o={m.o} gon />)}</span></td>
                    <td className="so px-3 py-1.5">{hetThu(x) || x.thu ? <span className="flex flex-nowrap items-center gap-1.5 whitespace-nowrap">{hanThu(x, true)}{x.thu ? <span className="text-text-3">{ddmm(x.thu.den)}</span> : null}</span> : <span className="text-text-3">—</span>}</td>
                    <td className="so px-3 py-1.5 text-text-2">{x.dangKy ? ddmm(x.dangKy) : "—"}</td>
                    {chu ? <td className="so relative z-[1] whitespace-nowrap px-3 py-0">{x.sdt ? <a href={`tel:${x.sdt}`} translate="no" className="inline-flex min-h-11 items-center hover:underline">{sdt(x.sdt)}</a> : <span className="text-text-3">—</span>}</td> : null}
                    <td aria-hidden="true" className="px-2 text-text-3">›</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {chu && chon.size > 0 ? (
        <div className="day-an-toan fixed inset-x-0 bottom-0 z-[35] border-t border-border bg-sidebar px-4 pt-3 sm:left-[72px] lg:left-60 lg:bottom-6 lg:mx-auto lg:max-w-[560px] lg:rounded-[14px] lg:border lg:pb-3 bong-noi">
          <div className="flex flex-wrap items-center gap-3 pb-3 lg:pb-0">
            <p className="so flex-1 font-semibold">{chon.size} em đã chọn</p>
            <button type="button" className="min-h-11 px-2 font-semibold text-text-2 hover:text-text" onClick={() => setChon(new Set())}>Bỏ chọn</button>
            <button type="button" disabled={!coTheGiaHan.length} className={`${nutChinhTo} w-full sm:w-auto lg:min-h-12 lg:text-base`} onClick={() => setGiaHan(true)}>
              Gia hạn thử ({coTheGiaHan.length}){khongThu ? <span className="font-normal"> · {khongThu} em không đang thử</span> : null}
            </button>
          </div>
        </div>
      ) : null}

      <GiaHan em={emGiaHan} homNay={homNay} mo={giaHan} dong={() => setGiaHan(false)} xong={() => { setChon(new Set()); setChonMo(false); }} />

      <ToTruot mo={loc} dong={() => setLoc(false)} tieuDe="Lọc học sinh" chan={<button type="button" className={`${nutChinh} w-full`} onClick={() => setLoc(false)}>Xem {hien.length} em</button>}>
        <div className="grid gap-4">
          {mon.length > 1 ? <NhomLoc ten="Môn">{mon.map((m) => chipLoc("mon", m.ma, <>{m.ten}</>))}</NhomLoc> : null}
          <NhomLoc ten="Loại">{(Object.keys(TEN_LOAI) as (keyof typeof TEN_LOAI)[]).map((k) => chipLoc("loai", k, <>{TEN_LOAI[k]}</>))}</NhomLoc>
          <NhomLoc ten="Lứa">{["L1", "L2"].map((l) => chipLoc("lua", l, <>{l}</>))}</NhomLoc>
          {chu ? <NhomLoc ten="Hạn thử">{chipLoc("het", "3", "≤ 3 ngày")}{chipLoc("het", "da-het", "Đã hết")}</NhomLoc> : null}
          <NhomLoc ten="Sắp xếp">{chipLoc("sap", "ten", "Tên A–Z")}{chipLoc("sap", "moi", "Mới đăng ký")}{chipLoc("sap", "het", "Hết thử sớm nhất")}</NhomLoc>
          {soLoc ? <Link href={path} className="inline-flex min-h-11 items-center font-semibold text-gold" onClick={() => setQ("")}>Bỏ lọc</Link> : null}
        </div>
      </ToTruot>
    </>
  );
}

function NhomLoc({ ten, children }: { ten: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="text-[13px] font-semibold text-text-2">{ten}</legend>
      <div className="mt-2 flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

function ThSap({ k, sap, href, children }: { k: string; sap: string; href: string; children: React.ReactNode }) {
  const bat = sap === k;
  return (
    <th scope="col" aria-sort={bat ? "ascending" : undefined} className="px-3 py-1">
      <Link href={href} replace scroll={false} className={`inline-flex min-h-11 items-center gap-1 hover:text-text ${bat ? "text-text" : ""}`}>{children}{bat ? <span aria-hidden="true">↑</span> : null}</Link>
    </th>
  );
}

