// Lớp ôn · hồ sơ một em (KiN lớp bước 4). CHỈ ĐỌC, chỉ chủ lớp, sau cờ LOP_ON. Chép bố cục bca/app/(quan-ly)/quan-ly/hoc-sinh/[maHs]/page.tsx,
// bỏ mọi nút ghi (gia hạn, chuyển chính thức, cho nghỉ, ẩn hồ sơ, sửa ghi chú, đăng xuất em) và phần đơn giá — để bước sau.
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { KinPanel, KinPageHeader } from "@/components/kin";
import { chuLop } from "@/lib/lop/server/cua";
import { chiTietHocSinh } from "@/lib/lop/server/hoc-sinh";
import { LoiDuLieu } from "@/lib/lop/quyen";
import { congNgay, ddmm, gioVN, ngayVN, soNgayGiua } from "@/lib/lop/ngay";
import { ngayDayDu, sdt } from "@/lib/lop/dinh-dang";
import { KhoiLoi, LOP_GOC, MonCham, Nhan, NhanTinhTrang } from "@/components/lop/hien-thi";

export const dynamic = "force-dynamic";
type D = Awaited<ReturnType<typeof chiTietHocSinh>>;
type MonD = D["mon"][number];

const GOC = `${LOP_GOC}/hoc-sinh`;
const HANH_DONG: Record<string, string> = {
  tao_tu_don: "Ghi danh từ đơn", them_mon: "Thêm môn", gia_han_thu: "Gia hạn thử", hoan_tac_gia_han: "Hoàn tác gia hạn", chuyen_chinh_thuc: "Chuyển chính thức",
  hoan_tac_chuyen_chinh_thuc: "Hoàn tác chuyển chính thức", nghi_mon: "Cho nghỉ", an_hoc_sinh: "Ẩn hồ sơ", bo_an_hoc_sinh: "Bỏ ẩn hồ sơ", chuyen_tu_sheet: "Chuyển từ sheet",
};
const DD = {
  co: { chu: "✓", doc: "có mặt", style: { background: "var(--kin-tt-nen-xong)", color: "var(--kin-tt-chu-xong)" } },
  phep: { chu: "P", doc: "vắng có phép", style: { background: "var(--kin-lop-tt-nen-phep)", color: "var(--kin-lop-tt-chu-phep)" } },
  vang: { chu: "K", doc: "vắng không phép", style: { background: "var(--kin-tt-nen-loi)", color: "var(--kin-tt-chu-loi-dam)" } },
  chua: { chu: "·", doc: "chưa điểm", style: { background: "var(--kin-nen-re-chuot)", color: "var(--kin-chu-mo)" } },
} as const;
const h2 = "text-[length:var(--kin-co-tieu-de)] leading-6 font-medium text-[var(--kin-chu-chinh)]";

export async function generateMetadata({ params }: { params: Promise<{ maHs: string }> }) {
  return { title: `Lớp ôn · Học sinh ${(await params).maHs}` };
}

export default async function LopOnMotEm({ params }: { params: Promise<{ maHs: string }> }) {
  const u = await chuLop();
  const maHs = decodeURIComponent((await params).maHs);
  let d: D;
  try {
    d = await chiTietHocSinh(u, maHs);
  } catch (e) {
    if (e instanceof LoiDuLieu && e.status === 404) notFound();
    console.error(`lop-on: không tải được hồ sơ ${maHs}`, e);
    return <div className="max-w-5xl"><KinPageHeader title="Học sinh" back={{ href: GOC, label: "‹ Danh sách học sinh" }} /><KhoiLoi ten="hồ sơ học sinh" href={`${GOC}/${encodeURIComponent(maHs)}`} /></div>;
  }
  const hs = d.hoc_sinh as typeof d.hoc_sinh & Partial<Record<"sdt_hs" | "sdt_ph" | "gmail" | "ho_ten_ph" | "truong" | "khoi" | "muc_tieu" | "nguon" | "ghi_chu" | "ghi_chu_rieng", string | null>> & { ngay_tao?: Date; dong_y_vinh_danh?: boolean };
  const het = d.tinh_trang.startsWith("Hết thử") ? (d.mon.flatMap((m) => m.ghi_danh).filter((g) => g.loai === "thu" && !g.huy).map((g) => g.den_ngay ?? "").sort().at(-1) ?? null) : null;
  const thu = d.thu;
  const coBuoi = d.mon.filter((m) => m.chuyen_can.buoi.some((b) => b.co_ten));

  return (
    <div className="max-w-6xl">
      <KinPageHeader title={<span translate="no" className="[overflow-wrap:anywhere]">{hs.ho_ten}</span>} back={{ href: GOC, label: "‹ Danh sách học sinh" }}
        sub={<span className="tabular-nums"><span translate="no">{hs.ma_hs}</span>{hs.lua ? ` · ${hs.lua.ten}` : ""}{hs.an_luc ? " · Đã ẩn hồ sơ" : ""}</span>}
        actions={<NhanTinhTrang tinhTrang={d.tinh_trang} thu={thu} />} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="grid min-w-0 content-start gap-6 lg:col-span-2">
          {thu ? (
            <KinPanel variant={thu.con_ngay <= 3 ? "canh-bao" : "nhan"}>
              <div role="progressbar" aria-valuemin={0} aria-valuenow={thu.ngay_thu} aria-valuemax={thu.tong_ngay} aria-valuetext={`Ngày ${thu.ngay_thu} trên ${thu.tong_ngay}, còn ${thu.con_ngay} ngày`} aria-label="Thời gian học thử" className="h-2 overflow-hidden rounded-full bg-[var(--kin-vien-thuong)]">
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, (thu.ngay_thu / thu.tong_ngay) * 100)}%`, background: thu.con_ngay <= 3 ? "var(--kin-tt-cham-cho)" : "var(--kin-nhan-link)" }} />
              </div>
              <p className="mt-2 text-[length:var(--kin-co-goc)] tabular-nums text-[var(--kin-chu-phu)]">Học thử ngày {thu.ngay_thu}/{thu.tong_ngay} · còn {thu.con_ngay} ngày · hết {ddmm(thu.den)}</p>
            </KinPanel>
          ) : null}
          {het ? <KinPanel variant="loi"><p className="text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi-dam)]">Hết thử {ddmm(het)} — em đang không vào được lớp, record, điểm.</p></KinPanel> : null}

          <section aria-labelledby="ghi-danh" className="grid gap-3">
            <h2 id="ghi-danh" className={h2}>Ghi danh</h2>
            <KinPanel flush as="ul">{d.mon.map((m) => <HangMon key={m.ma} m={m} homNay={d.hom_nay} />)}</KinPanel>
          </section>

          <section aria-labelledby="chuyen-can" className="grid gap-3">
            <h2 id="chuyen-can" className={h2}>Chuyên cần tháng {Number(d.hom_nay.slice(5, 7))}</h2>
            <KinPanel flush as="ul">
              {coBuoi.map((m) => {
                const c = m.chuyen_can;
                const bs = c.buoi.filter((b) => b.co_ten && !b.huy && b.ngay <= d.hom_nay);
                return (
                  <li key={m.ma} className="flex min-h-14 flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--kin-vien-nhat)] px-[var(--kin-kc-6)] py-3 text-[length:var(--kin-co-goc)] last:border-b-0">
                    <span className="flex w-16 items-center gap-2 font-medium text-[var(--kin-chu-chinh)]"><MonCham ma={m.ma} />{m.ten}</span>
                    <span className="flex min-w-0 flex-1 flex-wrap gap-1" role="img" aria-label={bs.length ? bs.map((b) => `${ddmm(b.ngay)}: ${DD[b.trang_thai ?? "chua"].doc}`).join(", ") : "chưa có buổi nào đã qua"}>
                      {bs.map((b) => <span key={b.buoi_id} aria-hidden title={`${ddmm(b.ngay)}: ${DD[b.trang_thai ?? "chua"].doc}`} className="inline-flex size-6 items-center justify-center rounded text-[length:var(--kin-co-phu)] font-semibold" style={DD[b.trang_thai ?? "chua"].style}>{DD[b.trang_thai ?? "chua"].chu}</span>)}
                    </span>
                    <span className="tabular-nums text-[var(--kin-chu-phu)]">{c.co + c.phep + c.vang ? `${c.co}/${c.co + c.phep + c.vang} có mặt · chuỗi ${c.chuoi}` : "Chưa điểm buổi nào"}</span>
                  </li>
                );
              })}
              {!coBuoi.length ? <li className="px-[var(--kin-kc-6)] py-4 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Tháng này em chưa có buổi nào.</li> : null}
            </KinPanel>
            {coBuoi.length ? <p className="text-[length:var(--kin-co-phu)] text-[var(--kin-chu-mo)]">✓ có mặt · P vắng có phép · K vắng không phép · “·” chưa điểm</p> : null}
          </section>
        </div>

        <div className="grid min-w-0 content-start gap-4">
          <Khoi tieuDe="Liên hệ">
            <Dong nhan="SĐT học sinh">{hs.sdt_hs ? <a href={`tel:${hs.sdt_hs}`} className="inline-flex min-h-11 items-center tabular-nums text-[var(--kin-nhan-link)] hover:underline" translate="no">{sdt(hs.sdt_hs)}</a> : "—"}</Dong>
            <Dong nhan="Gmail"><span translate="no" className="[overflow-wrap:anywhere]">{hs.gmail ?? "—"}</span></Dong>
            <Dong nhan="Phụ huynh">{hs.ho_ten_ph ?? "—"}</Dong>
            <Dong nhan="SĐT phụ huynh">{hs.sdt_ph ? <a href={`tel:${hs.sdt_ph}`} className="inline-flex min-h-11 items-center tabular-nums text-[var(--kin-nhan-link)] hover:underline" translate="no">{sdt(hs.sdt_ph)}</a> : "—"}</Dong>
          </Khoi>
          <Khoi tieuDe="Thông tin đăng ký">
            <Dong nhan="Trường">{hs.truong ?? "—"}</Dong>
            <Dong nhan="Khối">{hs.khoi ?? "—"}</Dong>
            <Dong nhan="Mục tiêu">{hs.muc_tieu ?? "—"}</Dong>
            <Dong nhan="Nguồn">{hs.nguon ?? "—"}</Dong>
            <Dong nhan="Ngày tạo">{hs.ngay_tao ? ngayDayDu(hs.ngay_tao.toISOString().slice(0, 10)) : "—"}</Dong>
            <Dong nhan="Vinh danh">{hs.dong_y_vinh_danh ? "Đồng ý" : "Không"}</Dong>
            <Dong nhan="Lứa">{hs.lua?.ten ?? "—"}</Dong>
            <Dong nhan="Azota"><span translate="no" className="[overflow-wrap:anywhere]">{hs.username_azota ?? "—"}</span></Dong>
            {"don" in d && Array.isArray(d.don) && d.don.length ? <Dong nhan="Đơn đăng ký">{d.don.map((x) => `${ddmm(ngayVN(x.thoi_gian))} ${x.loai ?? ""}`.trim()).join(" · ")}</Dong> : null}
          </Khoi>
          <Khoi tieuDe="Ghi chú">
            <Dong nhan="Chung"><span className="whitespace-pre-wrap [overflow-wrap:anywhere]">{hs.ghi_chu ?? "—"}</span></Dong>
            <Dong nhan="Riêng của chủ"><span className="whitespace-pre-wrap [overflow-wrap:anywhere]">{hs.ghi_chu_rieng ?? "—"}</span></Dong>
          </Khoi>
        </div>
      </div>
    </div>
  );
}

function HangMon({ m, homNay }: { m: MonD; homNay: string }) {
  const gds = m.ghi_danh.filter((g) => !g.huy);
  const moi = gds.at(-1);
  let moTa: ReactNode;
  if (!m.o || !moi) moTa = <span className="text-[var(--kin-chu-mo)]">Chưa ghi danh</span>;
  else if (m.o === "thu") {
    const g = gds.filter((x) => x.loai === "thu" && (x.den_ngay ?? "") >= homNay).at(-1) ?? moi;
    moTa = <><Nhan tone="thu">Học thử</Nhan> <span className="tabular-nums">{ddmm(g.tu_ngay)} → {g.den_ngay ? ddmm(g.den_ngay) : "…"}</span>{g.den_ngay ? <span className={`tabular-nums ${g.den_ngay <= congNgay(homNay, 3) ? "text-[var(--kin-tt-chu-cho)]" : "text-[var(--kin-chu-mo)]"}`}> · còn {soNgayGiua(homNay, g.den_ngay)} ngày</span> : null}</>;
  } else if (m.o === "hoc") {
    const g = gds.filter((x) => x.loai === "chinh_thuc").at(-1) ?? moi;
    moTa = <><Nhan tone="xong">Chính thức</Nhan> <span className="tabular-nums">từ {ddmm(g.tu_ngay)}{g.den_ngay ? ` đến ${ddmm(g.den_ngay)}` : ""}</span></>;
  } else {
    moTa = <><Nhan tone="mo">Nghỉ</Nhan> <span className="tabular-nums text-[var(--kin-chu-phu)]">từ {moi.den_ngay ? ddmm(congNgay(moi.den_ngay, 1)) : "—"}{moi.loai === "thu" ? ` (học thử ${ddmm(moi.tu_ngay)} → ${moi.den_ngay ? ddmm(moi.den_ngay) : "…"})` : ""}</span></>;
  }
  return (
    <li className="border-b border-[var(--kin-vien-nhat)] px-[var(--kin-kc-6)] py-2 text-[length:var(--kin-co-goc)] last:border-b-0">
      <div className="flex min-h-12 flex-wrap items-center gap-x-3 gap-y-1">
        <span className="flex w-16 items-center gap-2 font-medium text-[var(--kin-chu-chinh)]"><MonCham ma={m.ma} />{m.ten}</span>
        <span className="min-w-0 flex-1 text-[var(--kin-chu-chinh)]">{moTa}</span>
      </div>
      {m.lich_su.length ? (
        <details className="sm:ml-[4.75rem]">
          <summary className="inline-flex min-h-11 cursor-pointer items-center text-[var(--kin-chu-phu)] hover:text-[var(--kin-chu-chinh)]">Lịch sử ({m.lich_su.length})</summary>
          <ul className="grid gap-1 pb-2 tabular-nums text-[var(--kin-chu-phu)]">
            {m.lich_su.map((l, i) => <li key={i}>{ddmm(ngayVN(new Date(l.luc)))} {gioVN(new Date(l.luc))} · {HANH_DONG[l.hanh_dong] ?? l.hanh_dong}{chiTiet(l.sau)} <span className="text-[var(--kin-chu-mo)]">({l.ai})</span></li>)}
          </ul>
        </details>
      ) : null}
    </li>
  );
}

function chiTiet(sau: unknown) {
  const s = sau as { den_ngay?: string | null; ly_do?: string | null } | null;
  if (!s) return "";
  return `${s.den_ngay ? ` → hết ${ddmm(s.den_ngay)}` : ""}${s.ly_do ? ` · “${s.ly_do}”` : ""}`;
}

function Khoi({ tieuDe, children }: { tieuDe: string; children: ReactNode }) {
  return (
    <KinPanel as="section">
      <h2 className="pb-1 font-medium text-[var(--kin-chu-chinh)]">{tieuDe}</h2>
      {children}
    </KinPanel>
  );
}

function Dong({ nhan, children }: { nhan: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-2 border-t border-[var(--kin-vien-nhat)] py-1.5 text-[length:var(--kin-co-goc)]">
      <span className="text-[var(--kin-chu-mo)]">{nhan}</span>
      <span className="min-w-0 text-[var(--kin-chu-chinh)]">{children}</span>
    </div>
  );
}
