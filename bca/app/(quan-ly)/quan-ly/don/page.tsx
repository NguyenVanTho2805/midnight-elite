// Đơn đăng ký — danh sách đơn giản, chỉ chủ lớp (Đợt 1 chỉ đọc; nhận đơn tự động là Đợt 4).
import Link from "next/link";
import { danhSachDon } from "@/server/don";
import { layNguoiQuanLy, tai } from "@/components/khung/nguoi";
import { DauTrang, NoiDung } from "@/components/khung/dau-trang";
import { KhongCoQuyen } from "@/components/ui/trang-thai";
import { Chip, type MauChip } from "@/components/ui/chip";
import { ddmm, gio, sdt } from "@/components/dinh-dang";
import { ngayVN } from "@/lib/ngay";

export const metadata = { title: "Đơn đăng ký" };

const TT: Record<string, { nhan: string; mau: MauChip }> = {
  moi: { nhan: "Mới", mau: "warn" }, cho_duyet: { nhan: "Chờ duyệt", mau: "warn" }, da_nhan: { nhan: "Đã nhận", mau: "ok" },
  trung: { nhan: "Trùng", mau: "mo" }, bo_qua: { nhan: "Bỏ qua", mau: "mo" }, lead_cu: { nhan: "Lead cũ", mau: "mo" },
};
const TEN_MON: Record<string, string> = { toan: "Toán", su: "Sử", dia: "Địa", anh: "Anh" };

export default async function TrangDon({ searchParams }: { searchParams: Promise<{ loc?: string }> }) {
  const [u, sp] = await Promise.all([layNguoiQuanLy(), searchParams]);
  const r = await tai(() => danhSachDon(u));
  if (r.cam) return <KhongCoQuyen />;
  const choXuLy = (t: string) => t === "moi" || t === "cho_duyet";
  const tatCa = sp.loc === "tat-ca";
  const ds = r.d.don.filter((d) => tatCa || choXuLy(d.trang_thai));
  const soCho = r.d.don.filter((d) => choXuLy(d.trang_thai)).length;
  const chip = (bat: boolean) => `nhan inline-flex min-h-11 items-center rounded-full border px-4 font-semibold ${bat ? "border-gold bg-nav-active text-gold" : "border-border bg-surface text-text-2 hover:bg-row-hover"}`;
  return (
    <>
      <DauTrang tieuDe="Đơn đăng ký" />
      <NoiDung className="grid gap-4">
        <h1 className="sr-only">Đơn đăng ký</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/quan-ly/don" aria-current={!tatCa ? "page" : undefined} className={chip(!tatCa)}>Chờ xử lý <span className="so ml-1.5">{soCho}</span></Link>
          <Link href="/quan-ly/don?loc=tat-ca" aria-current={tatCa ? "page" : undefined} className={chip(tatCa)}>Tất cả <span className="so ml-1.5">{r.d.don.length}</span></Link>
        </div>
        {!ds.length ? (
          <p className="rounded-[14px] border border-border bg-surface px-4 py-6 text-text-2">Không có đơn nào chờ xử lý. — <Link href="/quan-ly/don?loc=tat-ca" className="font-semibold text-gold hover:underline">Xem tất cả đơn</Link></p>
        ) : (
          <ul className="rounded-[14px] border border-border bg-surface">
            {ds.map((d) => {
              const tt = TT[d.trang_thai] ?? { nhan: d.trang_thai, mau: "mo" as const };
              const ngay = ngayVN(new Date(d.thoi_gian));
              return (
                <li key={d.id} className="hang-dai flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border px-4 py-3 last:border-b-0">
                  <div className="min-w-0 flex-1 basis-60">
                    <p className="font-semibold" translate="no">{d.ho_ten}</p>
                    <p className="so text-[13px] text-text-3">{ddmm(ngay)} {gio(d.thoi_gian)} · {d.loai ?? "—"} · {d.nguon ?? "—"}{d.sdt_hs ? <> · <a href={`tel:${d.sdt_hs}`} className="hover:underline" translate="no">{sdt(d.sdt_hs)}</a></> : null}</p>
                  </div>
                  <span className="flex flex-wrap gap-1.5">{d.mon.map((m) => <Chip key={m}>{TEN_MON[m ?? ""] ?? m}</Chip>)}</span>
                  <Chip mau={tt.mau}>{tt.nhan}</Chip>
                  {d.ma_hs ? <Link href={`/quan-ly/hoc-sinh/${d.ma_hs}`} className="inline-flex min-h-11 items-center font-semibold text-gold hover:underline" translate="no">{d.ma_hs} ›</Link> : null}
                </li>
              );
            })}
          </ul>
        )}
      </NoiDung>
    </>
  );
}
