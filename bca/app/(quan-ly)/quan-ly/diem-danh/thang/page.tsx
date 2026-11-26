// Ma trận điểm danh tháng (man-diem-danh §7). Bộ lọc trên URL: ?mon=toan&thang=2026-11&dang=1
import Link from "next/link";
import { maTranThang } from "@/server/diem-danh";
import { napMon } from "@/server/du-lieu";
import { congNgay, ngayVN } from "@/lib/ngay";
import { layNguoiQuanLy, tai } from "@/components/khung/nguoi";
import { DauTrang, NoiDung } from "@/components/khung/dau-trang";
import { IconDau, IconQuayLai, IconTiep } from "@/components/bieu-tuong";
import { nutBieuTuong } from "@/components/ui/nut";
import { MaTran } from "@/components/quan-ly/ma-tran";

export const metadata = { title: "Ma trận điểm danh" };

export default async function TrangMaTran({ searchParams }: { searchParams: Promise<{ mon?: string; thang?: string; dang?: string }> }) {
  const [u, sp] = await Promise.all([layNguoiQuanLy(), searchParams]);
  const mons = (await napMon()).filter((m) => u.vai === "chu" || u.monIds.includes(m.id));
  const mon = mons.find((m) => m.ma === sp.mon)?.ma ?? sp.mon ?? mons[0]?.ma ?? "toan";
  const thang = /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.thang ?? "") ? sp.thang! : ngayVN(new Date()).slice(0, 7);
  const r = { d: await tai(() => maTranThang(u, mon, thang)) };
  const dang = sp.dang === "1";
  const url = (p: { mon?: string; thang?: string; dang?: boolean }) => {
    const q = new URLSearchParams({ mon: p.mon ?? mon, thang: p.thang ?? thang });
    if (p.dang ?? dang) q.set("dang", "1");
    return `/quan-ly/diem-danh/thang?${q}`;
  };
  const truoc = congNgay(`${thang}-01`, -1).slice(0, 7);
  const sau = congNgay(`${thang}-28`, 7).slice(0, 7);
  const chip = (bat: boolean) => `nhan inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 font-semibold ${bat ? "border-gold bg-nav-active text-gold" : "border-border bg-surface text-text-2 hover:bg-row-hover"}`;
  return (
    <>
      <DauTrang tieuDe="Ma trận điểm danh" quayLai={{ href: "/quan-ly/diem-danh", nhan: "Quay lại danh mục điểm danh" }} />
      <NoiDung>
        <h1 className="sr-only">Ma trận điểm danh {r.d.mon.ten} tháng {Number(thang.slice(5))}/{thang.slice(0, 4)}</h1>
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          {mons.length > 1 ? (
            <ul className="flex flex-wrap gap-2" aria-label="Môn">
              {mons.map((m) => (
                <li key={m.ma}><Link href={url({ mon: m.ma })} aria-current={m.ma === mon ? "page" : undefined} className={chip(m.ma === mon)}>{m.ma === mon ? <IconDau size={14} /> : null}{m.ten_ngan}</Link></li>
              ))}
            </ul>
          ) : null}
          <div className="flex items-center gap-1">
            <Link href={url({ thang: truoc })} className={nutBieuTuong} aria-label="Tháng trước"><IconQuayLai /></Link>
            <span className="so min-w-32 text-center font-semibold">Tháng {Number(thang.slice(5))}/{thang.slice(0, 4)}</span>
            <Link href={url({ thang: sau })} className={nutBieuTuong} aria-label="Tháng sau"><IconTiep /></Link>
          </div>
          <Link href={url({ dang: !dang })} className="inline-flex min-h-11 items-center gap-2 text-text-2 hover:text-text">
            <span aria-hidden="true" className={`flex size-5 items-center justify-center rounded-[6px] border ${dang ? "border-gold bg-gold text-on-gold" : "border-border-input"}`}>{dang ? <IconDau size={14} strokeWidth={3} /> : null}</span>
            Chỉ em đang học<span className="sr-only">{dang ? " (đang bật, bấm để tắt)" : " (đang tắt, bấm để bật)"}</span>
          </Link>
        </div>
        <MaTran key={`${mon}-${thang}`} d={r.d} chiDangHoc={dang} />
      </NoiDung>
    </>
  );
}
