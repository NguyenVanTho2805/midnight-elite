// Lớp ôn · Ma trận điểm danh tháng (KiN lớp bước 5, Figma FyUkgGJHrhXo0u4gnREyfk 9:1322). Chỉ chủ lớp, sau cờ LOP_ON. Môn + tháng trên URL (?mon=&thang=YYYY-MM).
import Link from "next/link";
import { kinButtonClass } from "@/components/kin";
import { chuLop } from "@/lib/lop/server/cua";
import { maTranThang } from "@/lib/lop/server/diem-danh";
import { napMon } from "@/lib/lop/server/du-lieu";
import { ngayVN, thangCua } from "@/lib/lop/ngay";
import { MaTran } from "@/components/lop/MaTran";
import { KhoiLoi, LOP_GOC, MonCham, thuTai } from "@/components/lop/hien-thi";

export const metadata = { title: "Lớp ôn · Ma trận tháng" };
export const dynamic = "force-dynamic";

const GOC = `${LOP_GOC}/diem-danh/thang`;
const doiThang = (t: string, n: number) => new Date(Date.UTC(Number(t.slice(0, 4)), Number(t.slice(5)) - 1 + n, 1)).toISOString().slice(0, 7);

export default async function LopOnMaTran({ searchParams }: { searchParams: Promise<{ mon?: string; thang?: string }> }) {
  const u = await chuLop();
  const sp = await searchParams;
  const thang = sp.thang && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.thang) ? sp.thang : thangCua(ngayVN(new Date()));
  const mons = (await thuTai("môn", napMon)) ?? [];
  const mon = mons.find((m) => m.ma === sp.mon) ?? mons[0];
  const href = (m: string, t: string) => `${GOC}?mon=${m}&thang=${t}`;
  const d = mon ? await thuTai("ma trận tháng", () => maTranThang(u, mon.ma, thang)) : null;

  return (
    <div className="max-w-7xl">
      <h1 className="pb-4 text-[length:var(--kin-co-h1)] leading-[var(--kin-dong-h1)] font-medium tracking-[-0.01em] text-[var(--kin-chu-chinh)]">Ma trận tháng</h1>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <nav aria-label="Chọn môn" className="flex flex-wrap gap-2">
          {mons.map((m) => (
            <Link key={m.ma} href={href(m.ma, thang)} aria-current={m.ma === mon?.ma ? "true" : undefined}
              className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-[length:var(--kin-co-goc)] ${m.ma === mon?.ma ? "border-[var(--kin-nhan-link)] bg-[var(--kin-nhan-nen-nhat)] font-medium text-[var(--kin-nhan-chu-tren-nhat)]" : "border-[var(--kin-vien-o-nhap)] text-[var(--kin-chu-chinh)] hover:bg-[var(--kin-nen-re-chuot)]"}`}>
              <MonCham ma={m.ma} />{m.ten_ngan}
            </Link>
          ))}
        </nav>
        {mon ? (
          <nav aria-label="Chọn tháng" className="flex items-center gap-1 tabular-nums">
            <Link href={href(mon.ma, doiThang(thang, -1))} aria-label="Tháng trước" className={`${kinButtonClass("secondary")} min-w-11 px-3`}>‹</Link>
            <span className="px-2 text-[length:var(--kin-co-goc)] font-medium text-[var(--kin-chu-chinh)]">Tháng {thang.slice(5)}/{thang.slice(0, 4)}</span>
            <Link href={href(mon.ma, doiThang(thang, 1))} aria-label="Tháng sau" className={`${kinButtonClass("secondary")} min-w-11 px-3`}>›</Link>
          </nav>
        ) : null}
      </div>
      {/* key: đổi môn / tháng thì bỏ trạng thái sửa dở của bảng cũ. */}
      {d ? <MaTran key={`${d.mon.ma}-${d.thang}`} d={d} gocDiemDanh={`${LOP_GOC}/diem-danh`} /> : <KhoiLoi ten="ma trận tháng" href={mon ? href(mon.ma, thang) : GOC} />}
    </div>
  );
}
