// Trang một em (man-hoc-sinh §6–§8). Ghi danh luôn đủ 4 môn (T30) — giáo viên chỉ thấy môn mình (máy chủ lọc).
// Nút gia hạn / chuyển chính thức / cho nghỉ chỉ dựng cho chủ lớp (máy chủ vẫn chặn).
import Link from "next/link";
import type { ReactNode } from "react";
import { chiTietHocSinh } from "@/server/hoc-sinh";
import { congNgay } from "@/lib/ngay";
import { layNguoiQuanLy, tai } from "@/components/khung/nguoi";
import { DauTrang, NoiDung } from "@/components/khung/dau-trang";
import { Chip } from "@/components/ui/chip";
import { ddmm, gio, sdt } from "@/components/dinh-dang";
import { NutAnHoSo, NutChinhHs, NutMon, ThaoTacHs, type MonHs } from "@/components/quan-ly/thao-tac-hs";
import { SaoChep } from "@/components/quan-ly/sao-chep";
import { GhiChuHs } from "@/components/quan-ly/ghi-chu-hs";

type D = Awaited<ReturnType<typeof chiTietHocSinh>>;
type MonD = D["mon"][number];

const HANH_DONG: Record<string, string> = {
  tao_tu_don: "Ghi danh từ đơn", them_mon: "Thêm môn", gia_han_thu: "Gia hạn thử", hoan_tac_gia_han: "Hoàn tác gia hạn", chuyen_chinh_thuc: "Chuyển chính thức",
  hoan_tac_chuyen_chinh_thuc: "Hoàn tác chuyển chính thức", nghi_mon: "Cho nghỉ", an_hoc_sinh: "Ẩn hồ sơ", bo_an_hoc_sinh: "Bỏ ẩn hồ sơ", chuyen_tu_sheet: "Chuyển từ sheet",
};

export async function generateMetadata({ params }: { params: Promise<{ maHs: string }> }) {
  return { title: `Học sinh ${(await params).maHs}` };
}

export default async function TrangMotEm({ params }: { params: Promise<{ maHs: string }> }) {
  const { maHs } = await params;
  const u = await layNguoiQuanLy();
  const d = await tai(() => chiTietHocSinh(u, maHs));
  const chu = u.vai === "chu";
  const hs = d.hoc_sinh as typeof d.hoc_sinh & Partial<Record<"sdt_hs" | "sdt_ph" | "gmail" | "ho_ten_ph" | "truong" | "khoi" | "muc_tieu" | "nguon" | "ghi_chu" | "ghi_chu_rieng", string | null>> & { ngay_tao?: Date; dong_y_vinh_danh?: boolean };
  const het = d.tinh_trang.startsWith("Hết thử") ? (d.mon.flatMap((m) => m.ghi_danh).filter((g) => g.loai === "thu" && !g.huy).map((g) => g.den_ngay ?? "").sort().at(-1) ?? null) : null;
  const monHs: MonHs[] = d.mon.map((m) => ({ ma: m.ma, ten: m.ten, o: m.o, macDinhCT: "mac_dinh_chinh_thuc" in m ? (m.mac_dinh_chinh_thuc as string) : undefined, vuaHetThu: !!het && m.ghi_danh.some((g) => !g.huy && g.loai === "thu" && g.den_ngay === het) }));
  const thu = d.thu;

  const noiDung = (
    <>
      <DauTrang tieuDe="Học sinh" quayLai={{ href: "/quan-ly/hoc-sinh", nhan: "Quay lại danh sách học sinh" }}>{chu && !hs.an_luc ? <NutAnHoSo /> : null}</DauTrang>
      <NoiDung>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="grid content-start gap-6 lg:col-span-2">
            <section className="rounded-[20px] bg-raised p-4 sm:p-6">
              <div className="flex flex-wrap items-start gap-x-6 gap-y-4">
                <div className="min-w-0 flex-1">
                  <h1 className="text-[22px] font-extrabold leading-tight lg:text-[28px]" translate="no">{hs.ho_ten}</h1>
                  <p className="so mt-1 text-text-2"><span translate="no">{hs.ma_hs}</span>{hs.lua ? ` · ${hs.lua.ten}` : ""} · {d.tinh_trang}{hs.an_luc ? " · Đã ẩn hồ sơ" : ""}</p>
                </div>
                {chu ? <NutChinhHs khoa /> : null}
              </div>
              {thu ? (
                <div className="mt-4">
                  <div role="progressbar" aria-valuemin={0} aria-valuenow={thu.ngay_thu} aria-valuemax={thu.tong_ngay} aria-valuetext={`Ngày ${thu.ngay_thu} trên ${thu.tong_ngay}, còn ${thu.con_ngay} ngày`} aria-label="Thời gian học thử" className="h-2 overflow-hidden rounded-full bg-border">
                    <div className={`h-full rounded-full ${thu.con_ngay <= 3 ? "bg-warn" : "bg-trial-fg"}`} style={{ width: `${Math.min(100, (thu.ngay_thu / thu.tong_ngay) * 100)}%` }} />
                  </div>
                  <p className="so mt-1.5 text-[14px] text-text-2">Ngày {thu.ngay_thu}/{thu.tong_ngay} · còn {thu.con_ngay} ngày · hết {ddmm(thu.den)}</p>
                </div>
              ) : null}
              {het ? (
                <p className="mt-4 rounded-[14px] bg-danger-bg px-3 py-2">Hết thử {ddmm(het)} — em đang không vào được lớp, record, điểm.</p>
              ) : null}
            </section>

            <section aria-labelledby="ghi-danh" className="grid gap-3">
              <h2 id="ghi-danh" className="text-lg font-semibold">Ghi danh</h2>
              <ul className="rounded-[14px] border border-border bg-surface">
                {d.mon.map((m) => <HangMon key={m.ma} m={m} homNay={d.hom_nay} chu={chu} />)}
              </ul>
            </section>

            <section aria-labelledby="chuyen-can" className="grid gap-3">
              <h2 id="chuyen-can" className="text-lg font-semibold">Chuyên cần tháng {Number(d.hom_nay.slice(5, 7))}</h2>
              <ul className="rounded-[14px] border border-border bg-surface">
                {d.mon.filter((m) => m.chuyen_can.buoi.some((b) => b.co_ten)).map((m) => {
                  const c = m.chuyen_can;
                  const bs = c.buoi.filter((b) => b.co_ten && !b.huy && b.ngay <= d.hom_nay);
                  return (
                    <li key={m.ma} className="border-b border-border last:border-b-0">
                      <Link href={`/quan-ly/diem-danh/thang?mon=${m.ma}&thang=${c.thang}`} className="flex min-h-14 flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 hover:bg-row-hover">
                        <span className="w-12 font-semibold">{m.ten}</span>
                        <span className="so flex flex-1 flex-wrap gap-1.5 font-semibold" aria-label={bs.map((b) => `${ddmm(b.ngay)}: ${b.trang_thai === "co" ? "có mặt" : b.trang_thai === "phep" ? "vắng có phép" : b.trang_thai === "vang" ? "vắng không phép" : "chưa điểm"}`).join(", ")}>
                          {bs.map((b) => (
                            <span key={b.buoi_id} aria-hidden="true" className={b.trang_thai === "co" ? "text-ok" : b.trang_thai === "phep" ? "text-excused" : b.trang_thai === "vang" ? "text-danger" : "text-text-3"}>
                              {b.trang_thai === "co" ? "✓" : b.trang_thai === "phep" ? "P" : b.trang_thai === "vang" ? "K" : "·"}
                            </span>
                          ))}
                        </span>
                        <span className="so text-[14px] text-text-2">{c.co}/{c.co + c.phep + c.vang} có mặt · chuỗi {c.chuoi}</span>
                      </Link>
                    </li>
                  );
                })}
                {!d.mon.some((m) => m.chuyen_can.buoi.some((b) => b.co_ten)) ? <li className="px-4 py-4 text-text-2">Tháng này em chưa có buổi nào.</li> : null}
              </ul>
            </section>
          </div>

          <div className="grid content-start gap-4">
            {chu ? (
              <Khoi tieuDe="Liên hệ" mo>
                <Dong nhan="SĐT học sinh">{hs.sdt_hs ? <a href={`tel:${hs.sdt_hs}`} className="so inline-flex min-h-11 items-center hover:underline" translate="no">{sdt(hs.sdt_hs)}</a> : "—"}</Dong>
                <Dong nhan="Gmail">{hs.gmail ? <span className="flex flex-wrap items-center gap-2"><span translate="no" className="min-w-0 [overflow-wrap:anywhere]">{hs.gmail}</span><SaoChep chu={hs.gmail} /></span> : "—"}</Dong>
                <Dong nhan="Phụ huynh">{hs.ho_ten_ph ?? "—"}</Dong>
                <Dong nhan="SĐT phụ huynh">{hs.sdt_ph ? <a href={`tel:${hs.sdt_ph}`} className="so inline-flex min-h-11 items-center hover:underline" translate="no">{sdt(hs.sdt_ph)}</a> : "—"}</Dong>
              </Khoi>
            ) : null}
            <Khoi tieuDe="Thông tin đăng ký" mo={!chu}>
              {chu ? (
                <>
                  <Dong nhan="Trường">{hs.truong ?? "—"}</Dong>
                  <Dong nhan="Khối">{hs.khoi ?? "—"}</Dong>
                  <Dong nhan="Mục tiêu">{hs.muc_tieu ?? "—"}</Dong>
                  <Dong nhan="Nguồn">{hs.nguon ?? "—"}</Dong>
                  <Dong nhan="Ngày tạo">{hs.ngay_tao ? ddmm(hs.ngay_tao.toISOString().slice(0, 10)) : "—"}</Dong>
                  <Dong nhan="Đồng ý vinh danh">{hs.dong_y_vinh_danh ? "Có" : "Không"}</Dong>
                </>
              ) : null}
              <Dong nhan="Lứa">{hs.lua?.ten ?? "—"}</Dong>
              <Dong nhan="Username Azota"><span translate="no">{hs.username_azota ?? "—"}</span></Dong>
              {"don" in d && Array.isArray(d.don) && d.don.length ? <Dong nhan="Đơn đăng ký">{d.don.map((x) => `${ddmm(new Date(x.thoi_gian.getTime() + 7 * 3600_000).toISOString().slice(0, 10))} ${x.loai ?? ""}`).join(" · ")}</Dong> : null}
            </Khoi>
            {chu ? (
              <Khoi tieuDe="Ghi chú" mo={!!(hs.ghi_chu || hs.ghi_chu_rieng)}>
                <GhiChuHs ma={hs.ma_hs} ghiChu={hs.ghi_chu ?? null} ghiChuRieng={hs.ghi_chu_rieng ?? null} />
              </Khoi>
            ) : null}
          </div>
        </div>
      </NoiDung>
    </>
  );

  return chu ? (
    <ThaoTacHs gia={"caiDat" in d && d.caiDat ? d.caiDat : undefined} ma={hs.ma_hs} ten={hs.ho_ten} mon={monHs} thuDen={thu?.den ?? null} het={het} homNay={d.hom_nay} macDinhNghi={"mac_dinh_nghi" in d ? String(d.mac_dinh_nghi) : congNgay(d.hom_nay, -1)}>
      {noiDung}
    </ThaoTacHs>
  ) : noiDung;
}

function HangMon({ m, homNay, chu }: { m: MonD; homNay: string; chu: boolean }) {
  const gds = m.ghi_danh.filter((g) => !g.huy);
  const moi = gds.at(-1);
  let moTa: ReactNode;
  if (!m.o || !moi) moTa = <span className="text-text-3">Chưa ghi danh</span>;
  else if (m.o === "thu") {
    const g = gds.filter((x) => x.loai === "thu" && (x.den_ngay ?? "") >= homNay).at(-1) ?? moi;
    moTa = <><Chip mau="thu">Học thử</Chip> <span className="so">{ddmm(g.tu_ngay)} → {g.den_ngay ? ddmm(g.den_ngay) : "…"}</span>{g.den_ngay ? <span className={`so ${g.den_ngay <= congNgay(homNay, 3) ? "text-warn" : "text-text-3"}`}> · còn {Math.round((Date.parse(g.den_ngay) - Date.parse(homNay)) / 86400_000)} ngày</span> : null}</>;
  } else if (m.o === "hoc") {
    const g = gds.filter((x) => x.loai === "chinh_thuc").at(-1) ?? moi;
    moTa = <><Chip mau="ok">Chính thức</Chip> <span className="so">từ {ddmm(g.tu_ngay)}{g.den_ngay ? ` đến ${ddmm(g.den_ngay)}` : ""}</span></>;
  } else {
    moTa = <><Chip mau="mo">Nghỉ</Chip> <span className="so text-text-2">từ {moi.den_ngay ? ddmm(congNgay(moi.den_ngay, 1)) : "—"}{moi.loai === "thu" ? ` (học thử ${ddmm(moi.tu_ngay)} → ${moi.den_ngay ? ddmm(moi.den_ngay) : "…"})` : ""}</span></>;
  }
  return (
    <li className="border-b border-border px-4 py-2 last:border-b-0">
      <div className="flex min-h-12 flex-wrap items-center gap-x-3 gap-y-1">
        <span className="w-12 font-semibold">{m.ten}</span>
        <span className="min-w-0 flex-1">{moTa}</span>
        {chu ? <NutMon ma={m.ma} /> : null}
      </div>
      {m.lich_su.length ? (
        <details className="ml-15 text-[14px]">
          <summary className="inline-flex min-h-11 cursor-pointer items-center text-text-2 hover:text-text">Lịch sử ({m.lich_su.length})</summary>
          <ul className="so grid gap-1 pb-2 text-text-2">
            {m.lich_su.map((l, i) => (
              <li key={i}>{ddmm(new Date(new Date(l.luc).getTime() + 7 * 3600_000).toISOString().slice(0, 10))} {gio(l.luc)} · {HANH_DONG[l.hanh_dong] ?? l.hanh_dong}{chiTiet(l.sau)} <span className="text-text-3">({l.ai})</span></li>
            ))}
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

function Khoi({ tieuDe, mo = false, children }: { tieuDe: string; mo?: boolean; children: ReactNode }) {
  return (
    <details open={mo} className="rounded-[14px] border border-border bg-surface px-4 lg:open:pb-3">
      <summary className="flex min-h-12 cursor-pointer items-center font-semibold">{tieuDe}</summary>
      <div className="pb-3">{children}</div>
    </details>
  );
}

function Dong({ nhan, children }: { nhan: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-2 border-t border-border py-1.5 text-[14px] first:border-t-0">
      <span className="text-text-3">{nhan}</span>
      <span className="min-w-0">{children}</span>
    </div>
  );
}
