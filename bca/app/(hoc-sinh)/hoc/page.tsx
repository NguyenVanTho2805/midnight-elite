// Khu học sinh (Đợt 2, BCA-D2-HS) — đặc tả docs/bca/thiet-ke/man-khu-hoc-sinh.md. Điện thoại trước, một cột.
// Chỉ dữ liệu của chính em (server/hs.cuaToi kiểm vai + hạn ở máy chủ). Không mã máy, không câu "hỏi em".
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { nguoiHienTai } from "@/server/phien";
import { cuaToi } from "@/server/hs";
import { DangXuat } from "@/app/dang-nhap/dang-xuat";
import { ddmm, thuDay, thuNganNgay, tenMonDayDu } from "@/components/dinh-dang";
import { Chip } from "@/components/ui/chip";
import { nutChinhTo, nutPhu } from "@/components/ui/nut";
import { NutToiNay } from "@/components/hoc-sinh/nut-toi-nay";

export const metadata: Metadata = { title: "Lớp của em" };

type D = Awaited<ReturnType<typeof cuaToi>>;
type Buoi = D["buoi"][number];
const THU_ISO = ["", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ nhật"];
const DD: Record<string, { chu: string; mau: "ok" | "phep" | "danger" }> = { co: { chu: "Có mặt", mau: "ok" }, phep: { chu: "Có phép", mau: "phep" }, vang: { chu: "Vắng", mau: "danger" } };
const ngoai = { target: "_blank", rel: "noopener noreferrer" } as const;

function chipMon(m: D["mon"][number], d: D) {
  if (m.o === "hoc") return <Chip mau="ok">Chính thức</Chip>;
  if (m.o === "thu") return <Chip mau={d.thu && d.thu.con_ngay <= 3 ? "warn" : "thu"}>Học thử{d.thu ? ` · còn ${d.thu.con_ngay === 0 ? "hôm nay" : `${d.thu.con_ngay} ngày`}` : ""}</Chip>;
  if (m.dang_mo) return <Chip mau="trung">Sắp học</Chip>;
  return <Chip mau="mo">{d.trang_thai === "het_thu" ? "Hết thử" : "Đã nghỉ"}</Chip>;
}

function DongBuoi({ b, d, bayGio }: { b: Buoi; d: D; bayGio: number }) {
  const m = d.mon.find((x) => x.ma === b.mon);
  const daQua = Date.parse(b.bat_dau) + b.so_phut * 60_000 <= bayGio;
  const tt = b.trang_thai === "huy" ? <Chip mau="mo">Lớp nghỉ</Chip> : b.diem_danh ? <Chip mau={DD[b.diem_danh].mau}>{DD[b.diem_danh].chu}</Chip> : daQua ? <span className="text-text-3" aria-label="Chưa có điểm danh">—</span> : <Chip mau="trung">Sắp học</Chip>;
  return (
    <li className="border-t border-border py-3 first:border-t-0">
      <div className="flex items-center gap-3">
        <p className="min-w-0 flex-1">
          <span className="so font-semibold">{thuNganNgay(b.ngay)}</span> · {m?.ten ?? b.mon} <span className="so text-text-3">· {b.gio}</span>
          {b.loai === "hoc_bu" ? <span className="text-text-3"> · học bù</span> : null}
        </p>
        {tt}
      </div>
      {b.trang_thai === "huy" && b.ly_do_huy ? <p className="mt-1 text-[14px] text-text-2">{b.ly_do_huy}</p> : null}
      {b.khoa ? (
        daQua && b.trang_thai !== "huy" ? <p className="mt-1 text-[14px] text-text-3">Tài liệu đã khoá</p> : null
      ) : (
        <>
          {b.noi_dung ? <p className="mt-1 line-clamp-3 text-[15px] text-text-2">{b.noi_dung}</p> : null}
          {b.link_record ? <a href={b.link_record} {...ngoai} className="nhan mt-1 inline-flex min-h-11 items-center font-semibold text-gold hover:underline">Xem record</a> : null}
        </>
      )}
    </li>
  );
}

export default async function Hoc() {
  const u = await nguoiHienTai();
  if (!u) redirect("/dang-nhap");
  if (u.vai !== "hoc_sinh") redirect("/quan-ly");
  const bayGio = Date.now();
  const d = await cuaToi(u, new Date(bayGio));
  const tenGoi = d.hoc_sinh.ho_ten.trim().split(/\s+/).at(-1);
  const homNay = d.buoi.filter((b) => b.ngay === d.hom_nay);
  const homNayHoc = homNay.filter((b) => b.trang_thai !== "huy");
  const toiNay = homNayHoc.find((b) => Date.parse(b.bat_dau) + b.so_phut * 60_000 > bayGio) ?? homNayHoc.at(-1);
  const nghiToiNay = !homNayHoc.length ? homNay.find((b) => b.trang_thai === "huy") : undefined;
  const toi = d.buoi.find((b) => b.trang_thai !== "huy" && Date.parse(b.bat_dau) > bayGio && b.ngay !== d.hom_nay);
  const monToiNay = toiNay ? d.mon.find((m) => m.ma === toiNay.mon) : undefined;
  const khoa = d.trang_thai === "het_thu" || d.trang_thai === "da_nghi";
  const lienHe = d.lien_he.zalo_chung ?? d.lien_he.zalo_hoc_thu;
  const sapToi = d.buoi.filter((b) => Date.parse(b.bat_dau) + b.so_phut * 60_000 > bayGio && b !== toiNay);
  const daQua = d.buoi.filter((b) => Date.parse(b.bat_dau) + b.so_phut * 60_000 <= bayGio && b !== toiNay).reverse();

  return (
    <main className="mx-auto min-h-dvh max-w-[560px] pb-10">
      <header className="flex h-14 items-center justify-between px-4">
        <p className="font-extrabold">BCA Midnight</p>
        <DangXuat />
      </header>

      <section aria-labelledby="toi-nay" className="hien-nhanh px-4 pt-2">
        <p className="text-text-2">Chào {tenGoi},</p>
        <h1 id="toi-nay" className="mt-1 text-[26px] font-extrabold leading-tight text-balance">
          {toiNay ? (
            <>Tối nay học <span className="text-gold">{tenMonDayDu(toiNay.mon, monToiNay?.ten)}</span> lúc <span className="so">{toiNay.gio}</span></>
          ) : nghiToiNay ? (
            <>Tối nay lớp <span className="text-gold">{tenMonDayDu(nghiToiNay.mon)}</span> nghỉ</>
          ) : khoa ? (
            <>Lớp của em đang tạm khoá</>
          ) : (
            <>Tối nay em không có lớp</>
          )}
        </h1>
        {nghiToiNay?.ly_do_huy ? <p className="mt-1 text-text-2">{nghiToiNay.ly_do_huy}</p> : null}
        {toiNay ? (
          <div className="mt-4">
            <NutToiNay batDau={toiNay.bat_dau} soPhut={toiNay.so_phut} meet={monToiNay?.link_meet ?? null} record={toiNay.link_record} zalo={monToiNay?.link_zalo ?? null} />
            {toiNay.noi_dung ? <p className="mt-3 text-[15px] text-text-2"><span className="font-semibold text-text">Nội dung buổi: </span>{toiNay.noi_dung}</p> : null}
          </div>
        ) : null}
        {!toiNay && toi ? (
          <p className="mt-2 text-text-2">Buổi tới: <span className="font-semibold text-text">{tenMonDayDu(toi.mon)}</span> · {thuDay(toi.ngay)} <span className="so">{ddmm(toi.ngay)} · {toi.gio}</span></p>
        ) : null}
        {d.trang_thai === "sap_bat_dau" && d.bat_dau ? <p className="mt-2 text-text-2">Lớp của em bắt đầu từ <span className="so font-semibold text-text">{ddmm(d.bat_dau)}</span>.</p> : null}
      </section>

      {d.thu ? (
        <section aria-labelledby="hoc-thu" className="mx-4 mt-6 rounded-[14px] border border-border bg-surface p-4">
          <h2 id="hoc-thu" className="font-semibold">
            Học thử ngày <span className="so">{Math.min(d.thu.ngay_thu, d.thu.tong_ngay)}/{d.thu.tong_ngay}</span>
          </h2>
          <p className={`mt-1 text-[15px] ${d.thu.con_ngay <= 3 ? "text-warn" : "text-text-2"}`}>
            {d.thu.con_ngay === 0 ? "Hôm nay là ngày cuối" : <>Còn <span className="so">{d.thu.con_ngay}</span> ngày</>} · hết <span className="so">{ddmm(d.thu.den)}</span>
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-raised" role="progressbar" aria-label="Tiến độ học thử" aria-valuemin={0} aria-valuemax={d.thu.tong_ngay} aria-valuenow={Math.min(d.thu.ngay_thu, d.thu.tong_ngay)}>
            <div className={`h-full rounded-full ${d.thu.con_ngay <= 3 ? "bg-warn" : "bg-gold"}`} style={{ width: `${Math.min(100, (d.thu.ngay_thu / d.thu.tong_ngay) * 100)}%` }} />
          </div>
          {d.lien_he.zalo_hoc_thu ? <a href={d.lien_he.zalo_hoc_thu} {...ngoai} className={`${nutPhu} mt-4 w-full`}>Nhóm Zalo học thử</a> : null}
        </section>
      ) : null}

      {khoa ? (
        <section aria-labelledby="khoa" className="mx-4 mt-6 rounded-[14px] border border-danger bg-danger-bg p-4">
          <h2 id="khoa" className="font-semibold">
            {d.trang_thai === "het_thu" && d.het_thu ? <>Thời gian học thử đã hết từ <span className="so">{ddmm(d.het_thu)}</span></> : "Em đã nghỉ các môn"}
          </h2>
          <p className="mt-1 text-[15px] text-text-2">Em vẫn xem được điểm danh của mình. Nội dung buổi và record đã khoá.</p>
          {lienHe ? (
            <a href={lienHe} {...ngoai} className={`${nutChinhTo} mt-4 w-full`}>Liên hệ gia hạn</a>
          ) : (
            <p className="mt-3 font-semibold">Nhắn chủ lớp qua Zalo để gia hạn.</p>
          )}
        </section>
      ) : null}

      <section aria-labelledby="chuoi" className="mx-4 mt-6 flex items-center gap-4 rounded-[14px] border border-border bg-surface p-4">
        <p className="so text-[40px] font-extrabold leading-none text-gold" aria-hidden="true">{d.chuoi}</p>
        <div>
          <h2 id="chuoi" className="font-semibold">{d.chuoi ? `${d.chuoi} buổi đi học liên tiếp` : "Chuỗi đi học"}</h2>
          <p className="text-[14px] text-text-2">{d.chuoi ? "Nghỉ có phép không làm đứt chuỗi." : "Bắt đầu chuỗi mới từ buổi tới."}</p>
        </div>
      </section>

      {d.mon.length ? (
        <section aria-labelledby="mon" className="mx-4 mt-6">
          <h2 id="mon" className="text-[15px] font-semibold text-text-2">Môn của em</h2>
          <ul className="mt-2 rounded-[14px] border border-border bg-surface px-4">
            {d.mon.map((m) => (
              <li key={m.ma} className="border-t border-border py-3 first:border-t-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="flex-1 font-semibold">{m.ten_day_du}</p>
                  {chipMon(m, d)}
                </div>
                <p className="mt-0.5 text-[14px] text-text-2">{m.thu.map((t) => THU_ISO[t]).join(", ")} · <span className="so">{m.gio}</span></p>
                {m.link_zalo ? <a href={m.link_zalo} {...ngoai} className="nhan inline-flex min-h-11 items-center text-[15px] font-semibold text-gold hover:underline">Nhóm Zalo môn</a> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {sapToi.length ? (
        <section aria-labelledby="sap-toi" className="mx-4 mt-6">
          <h2 id="sap-toi" className="text-[15px] font-semibold text-text-2">Sắp tới</h2>
          <ul className="mt-2 rounded-[14px] border border-border bg-surface px-4">
            {sapToi.map((b) => <DongBuoi key={b.id} b={b} d={d} bayGio={bayGio} />)}
          </ul>
        </section>
      ) : null}

      {!daQua.length && !sapToi.length && !toiNay ? (
        <p className="mx-4 mt-6 rounded-[14px] border border-border bg-surface p-4 text-text-2">Chưa có buổi học nào trong thời gian em học trên web.</p>
      ) : null}

      {daQua.length ? (
        <section aria-labelledby="da-hoc" className="mx-4 mt-6">
          <h2 id="da-hoc" className="text-[15px] font-semibold text-text-2">Buổi đã học</h2>
          <ul className="mt-2 rounded-[14px] border border-border bg-surface px-4">
            {daQua.slice(0, 14).map((b) => <DongBuoi key={b.id} b={b} d={d} bayGio={bayGio} />)}
          </ul>
          {daQua.length > 14 ? (
            <details className="mt-2">
              <summary className="nhan flex min-h-11 cursor-pointer items-center font-semibold text-gold">Xem thêm {daQua.length - 14} buổi</summary>
              <ul className="mt-2 rounded-[14px] border border-border bg-surface px-4">
                {daQua.slice(14).map((b) => <DongBuoi key={b.id} b={b} d={d} bayGio={bayGio} />)}
              </ul>
            </details>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
