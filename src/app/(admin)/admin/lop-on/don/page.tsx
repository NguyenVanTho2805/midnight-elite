// Lớp ôn · Đơn đăng ký (KiN lớp bước 6). Chỉ chủ lớp, sau cờ LOP_ON. Hai tab trên URL: Chờ xử lý (mặc định) / ?xem=tat-ca.
// Việc "Đơn chờ duyệt" ở Hôm nay dẫn tới ?don=<id>#don-<id>: hàng đó được tô nền ở máy chủ (:target không chạy khi chuyển trang phía máy khách). Ghi: src/components/lop/XuLyDon.tsx.
import Link from "next/link";
import { KinPanel, KinEmptyState, KIN_TAB_BOX, KinTabInner } from "@/components/kin";
import { chuLop } from "@/lib/lop/server/cua";
import { danhSachDon } from "@/lib/lop/server/don";
import { napMon } from "@/lib/lop/server/du-lieu";
import { ddmm, gioVN, ngayVN } from "@/lib/lop/ngay";
import { sdt } from "@/lib/lop/dinh-dang";
import { KhoiLoi, LOP_GOC, Nhan, lienKet, thuTai } from "@/components/lop/hien-thi";
import { XuLyDon } from "@/components/lop/XuLyDon";

export const metadata = { title: "Lớp ôn · Đơn đăng ký" };
export const dynamic = "force-dynamic";

const GOC = `${LOP_GOC}/don`;
const CHO = ["moi", "cho_duyet"];
const TT: Record<string, { chu: string; tone: "xong" | "cho" | "mo" }> = {
  moi: { chu: "Chờ xử lý", tone: "cho" }, cho_duyet: { chu: "Chờ xử lý", tone: "cho" }, da_nhan: { chu: "Đã nhận", tone: "xong" },
  trung: { chu: "Trùng", tone: "mo" }, bo_qua: { chu: "Đã bỏ qua", tone: "mo" }, lead_cu: { chu: "Đơn cũ", tone: "mo" },
};

export default async function LopOnDon({ searchParams }: { searchParams: Promise<{ xem?: string; don?: string }> }) {
  const u = await chuLop();
  const sp = await searchParams, tatCa = sp.xem === "tat-ca";
  const [d, mons] = await Promise.all([thuTai("đơn đăng ký", () => danhSachDon(u)), thuTai("môn", () => napMon())]);
  const tieuDe = <h1 className="pb-6 text-[length:var(--kin-co-h1)] leading-[var(--kin-dong-h1)] font-medium tracking-[-0.01em] text-[var(--kin-chu-chinh)]">Đơn đăng ký</h1>;
  if (!d || !mons) return <div className="max-w-5xl">{tieuDe}<KhoiLoi ten="đơn đăng ký" href={GOC} /></div>;
  const tenMon = Object.fromEntries(mons.map((m) => [m.ma, m.ten_ngan]));
  const cho = d.don.filter((x) => CHO.includes(x.trang_thai));
  const ds = tatCa ? d.don : cho;
  const tab = (href: string, nhan: string, so: number, bat: boolean) => (
    <Link href={href} aria-current={bat ? "page" : undefined} className={KIN_TAB_BOX}>
      <KinTabInner active={bat}>{nhan} <span className="ml-1 inline-flex min-w-5 justify-center rounded-full bg-[var(--kin-nen-re-chuot)] px-1.5 text-[length:var(--kin-co-phu)] tabular-nums text-[var(--kin-chu-phu)]">{so}</span></KinTabInner>
    </Link>
  );
  return (
    <div className="max-w-5xl">
      {tieuDe}
      <KinPanel flush>
        <nav aria-label="Lọc đơn" className="flex flex-wrap border-b border-[var(--kin-vien-nhat)] px-1">{tab(GOC, "Chờ xử lý", cho.length, !tatCa)}{tab(`${GOC}?xem=tat-ca`, "Tất cả", d.don.length, tatCa)}</nav>
        {!ds.length ? (
          <KinEmptyState title={tatCa ? "Chưa có đơn nào" : "Không có đơn nào chờ xử lý"}>{tatCa ? "Đơn đăng ký học thử gửi từ form sẽ hiện ở đây." : "Đơn mới gửi sẽ hiện ở đây. Xem lại đơn đã xử lý ở tab “Tất cả”."}</KinEmptyState>
        ) : (
          <ul>
            {ds.map((x) => {
              const tt = TT[x.trang_thai] ?? { chu: x.trang_thai, tone: "mo" as const };
              const lienHe = [sdt(x.sdt_hs), x.gmail, x.sdt_ph ? `PH ${sdt(x.sdt_ph)}` : "", [x.truong, x.khoi ? `khối ${x.khoi}` : ""].filter(Boolean).join(", ")].filter(Boolean).join(" · ");
              return (
                <li key={x.id} id={`don-${x.id}`} aria-current={sp.don === String(x.id) ? "true" : undefined} className={`scroll-mt-24 border-b border-[var(--kin-vien-nhat)] px-[var(--kin-kc-6)] py-3 text-[length:var(--kin-co-goc)] last:border-b-0 ${sp.don === String(x.id) ? "bg-[var(--kin-nhan-nen-nhat)]" : ""}`}>
                  <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                    <div className="min-w-56 flex-1">
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1"><span translate="no" className="font-medium text-[var(--kin-chu-chinh)] [overflow-wrap:anywhere]">{x.ho_ten}</span><Nhan tone={tt.tone}>{tt.chu}</Nhan></p>
                      <p className="mt-1 tabular-nums text-[var(--kin-chu-phu)]">{[x.mon.map((m) => tenMon[m ?? ""] ?? m).join(", ") || "Chưa chọn môn", x.loai?.trim() || "", `gửi ${ddmm(ngayVN(x.thoi_gian))} ${gioVN(x.thoi_gian)}`].filter(Boolean).join(" · ")}</p>
                      {lienHe ? <p translate="no" className="mt-0.5 tabular-nums text-[var(--kin-chu-mo)] [overflow-wrap:anywhere]">{lienHe}</p> : null}
                      {x.ghi_chu_xu_ly ? <p className="mt-0.5 text-[var(--kin-chu-mo)] [overflow-wrap:anywhere]">Ghi chú xử lý: {x.ghi_chu_xu_ly}</p> : null}
                    </div>
                    {CHO.includes(x.trang_thai) ? <XuLyDon id={x.id} ten={x.ho_ten} tenMon={tenMon} />
                      : x.ma_hs ? <Link href={`${LOP_GOC}/hoc-sinh/${x.ma_hs}`} className={lienKet} translate="no">Hồ sơ {x.ma_hs} ›</Link> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </KinPanel>
    </div>
  );
}
