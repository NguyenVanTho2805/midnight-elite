// Lớp ôn · khu HỌC SINH (KiN lớp bước 7, Figma FyUkgGJHrhXo0u4gnREyfk 9:146 / 9:283 / 9:365 / 9:511). Sau cờ LOP_ON, trong vỏ học sinh của KiN.
// Chép bố cục bca/app/(hoc-sinh)/hoc/page.tsx: thẻ "Tối nay" nền đêm với MỘT nút vàng, học thử, màn khoá, tuần này theo màu môn, chuỗi dạng chấm, môn của em, buổi (3 dòng + "Xem tất cả").
// Chỉ dữ liệu của chính em: máy chủ (server/hs.cuaToi) kiểm vai và quyết link nào được hiện. Không mã máy, không SĐT, không ghi chú nội bộ.
// Điện thoại một cột; từ 1024px hai cột (trái: tối nay + buổi; phải: tuần, chuỗi, môn).
import { notFound } from "next/navigation";
import { KinPanel, KinEmptyState, kinButtonClass } from "@/components/kin";
import { LOP_ON } from "@/lib/features";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { nguoiTuPhien } from "@/lib/lop/phien";
import { cuaToi, noiHoSoLop } from "@/lib/lop/server/hs";
import { congNgay, ddmm, thuISO } from "@/lib/lop/ngay";
import { tenMonDayDu, thuNgay, thuNganNgay } from "@/lib/lop/dinh-dang";
import { KhoiLoi, MonCham, Nhan, thuTai } from "@/components/lop/hien-thi";
import { NutToiNay } from "@/components/lop/NutToiNay";

export const metadata = { title: "Lớp ôn của em" };
export const dynamic = "force-dynamic";

const GOC = "/student/lop-on";
type D = Awaited<ReturnType<typeof cuaToi>>;
type Buoi = D["buoi"][number];
const THU_ISO = ["", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ nhật"];
const THU_TAT = ["", "T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const DD: Record<string, { chu: string; tone: "xong" | "phep" | "loi" }> = { co: { chu: "Có mặt", tone: "xong" }, phep: { chu: "Có phép", tone: "phep" }, vang: { chu: "Vắng", tone: "loi" } };
const ngoai = { target: "_blank", rel: "noopener noreferrer" } as const;
const tieuDe = "text-[length:var(--kin-co-tieu-de)] leading-6 font-semibold text-[var(--kin-chu-chinh)]";
const phu = "text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-phu)]";
const trang = "mx-auto w-full max-w-[1040px]";

function ChuaCoHoSo({ tieuDe: td, children }: { tieuDe: string; children: React.ReactNode }) {
  return (
    <div className={`${trang} max-w-2xl`}>
      <h1 className="pb-4 text-[length:var(--kin-co-h1)] leading-[var(--kin-dong-h1)] font-medium text-[var(--kin-chu-chinh)]">Lớp ôn</h1>
      <KinPanel><KinEmptyState title={td}>{children}</KinEmptyState></KinPanel>
    </div>
  );
}

function chipMon(m: D["mon"][number], d: D) {
  if (m.o === "hoc") return <Nhan tone="thu">Chính thức</Nhan>;
  if (m.o === "thu") return <Nhan tone="cho">Học thử</Nhan>;
  if (m.dang_mo) return <Nhan tone="mo">Sắp học</Nhan>;
  return d.trang_thai === "het_thu" ? <Nhan tone="loi">Hết thử</Nhan> : <Nhan tone="mo">Đã nghỉ</Nhan>;
}

function DongBuoi({ b, d, bayGio }: { b: Buoi; d: D; bayGio: number }) {
  const m = d.mon.find((x) => x.ma === b.mon);
  const daQua = Date.parse(b.bat_dau) + b.so_phut * 60_000 <= bayGio;
  const tt = b.trang_thai === "huy" ? <Nhan tone="mo">Lớp nghỉ</Nhan> : b.diem_danh ? <Nhan tone={DD[b.diem_danh].tone}>{DD[b.diem_danh].chu}</Nhan>
    : daQua ? <span className="text-[var(--kin-chu-mo)]" aria-label="Chưa có điểm danh">—</span> : <Nhan tone="mo">Sắp học</Nhan>;
  return (
    <li className="border-b border-[var(--kin-vien-nhat)] py-3 last:border-b-0">
      <div className="flex items-center gap-3">
        <MonCham ma={b.mon} />
        <div className="min-w-0 flex-1">
          <p className="text-[length:var(--kin-co-body)] font-semibold tabular-nums text-[var(--kin-chu-chinh)] [overflow-wrap:anywhere]">{thuNganNgay(b.ngay)} · {tenMonDayDu(b.mon, m?.ten)}</p>
          <p className={`${phu} tabular-nums`}>
            {b.gio}{b.loai === "hoc_bu" ? " · học bù" : ""}{b.link_record ? " · Có record" : ""}{b.khoa && daQua && b.trang_thai !== "huy" ? " · Tài liệu đã khoá" : ""}
          </p>
        </div>
        {tt}
        {b.link_record ? (
          <a href={b.link_record} {...ngoai} aria-label={`Xem record buổi ${tenMonDayDu(b.mon, m?.ten)} ${thuNganNgay(b.ngay)}`}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--kin-nhan-nen-nhat)] text-[var(--kin-nhan-link)] hover:bg-[var(--kin-nen-re-chuot)] focus-visible:outline-2 focus-visible:outline-[var(--kin-nhan-link)]">
            <svg aria-hidden width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M3 1.5v11l9-5.5z" /></svg>
          </a>
        ) : null}
      </div>
      {b.trang_thai === "huy" && b.ly_do_huy ? <p className={`${phu} mt-1 pl-5 [overflow-wrap:anywhere]`}>{b.ly_do_huy}</p> : null}
      {b.noi_dung ? <p className={`${phu} mt-1 line-clamp-2 pl-5 [overflow-wrap:anywhere]`}>{b.noi_dung}</p> : null}
    </li>
  );
}

/** Danh sách buổi: hiện 3 dòng, phần còn lại gập trong "Xem tất cả" (không cần JS). */
function DanhSachBuoi({ id, ten, ds, d, bayGio }: { id: string; ten: string; ds: Buoi[]; d: D; bayGio: number }) {
  if (!ds.length) return null;
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className={tieuDe}>{ten}</h2>
      <KinPanel className="mt-2 !py-1">
        <ul>{ds.slice(0, 3).map((b) => <DongBuoi key={b.id} b={b} d={d} bayGio={bayGio} />)}</ul>
        {ds.length > 3 ? (
          // flex-col-reverse: mở ra thì "Thu gọn" nằm CUỐI danh sách (trình duyệt cũ không hỗ trợ thì nút vẫn ở giữa như trước).
          <details className="group flex flex-col-reverse border-t border-[var(--kin-vien-nhat)]">
            <summary className="flex min-h-11 group-open:border-t group-open:border-[var(--kin-vien-nhat)] cursor-pointer list-none items-center justify-center text-[length:var(--kin-co-goc)] font-semibold text-[var(--kin-nhan-link)] hover:underline [&::-webkit-details-marker]:hidden">
              <span className="group-open:hidden">Xem tất cả <span className="tabular-nums">{ds.length}</span> buổi</span><span className="hidden group-open:inline">Thu gọn</span>
            </summary>
            <ul>{ds.slice(3).map((b) => <DongBuoi key={b.id} b={b} d={d} bayGio={bayGio} />)}</ul>
          </details>
        ) : null}
      </KinPanel>
    </section>
  );
}

export default async function LopOnHocSinh() {
  if (!LOP_ON) notFound();
  const p = await getSession();
  const noi = await noiHoSoLop(p);
  const u = await nguoiTuPhien(p);
  if (noi === "nhieu") return <ChuaCoHoSo tieuDe="Gmail này khớp nhiều hồ sơ, nhắn chủ lớp">Lớp ôn có hơn một hồ sơ dùng Gmail của tài khoản này nên web chưa biết hồ sơ nào là của em. Em nhắn chủ lớp để sửa lại Gmail trên hồ sơ, rồi mở lại trang này.</ChuaCoHoSo>;
  if (u?.vai !== "hoc_sinh") {
    const tk = p ? await prisma.user.findUnique({ where: { id: p.userId }, select: { emailVerified: true } }).catch(() => null) : null;
    return tk && !tk.emailVerified
      ? <ChuaCoHoSo tieuDe="Xác minh email để mở lớp ôn">Lớp ôn nhận em theo Gmail đã đăng ký với chủ lớp. Em bấm đường dẫn trong thư xác minh KiN đã gửi, rồi mở lại trang này.</ChuaCoHoSo>
      : <ChuaCoHoSo tieuDe="Tài khoản này chưa có hồ sơ lớp ôn">Lớp ôn nhận em theo Gmail đã đăng ký với chủ lớp. Em kiểm tra đang đăng nhập đúng Gmail đó; nếu vẫn chưa thấy lớp, nhắn chủ lớp để được thêm vào.</ChuaCoHoSo>;
  }

  const bayGio = Date.now();
  const d = await thuTai("lớp ôn của em", () => cuaToi(u, new Date(bayGio)));
  if (!d) return <div className={`${trang} max-w-2xl`}><KhoiLoi ten="lớp ôn của em" href={GOC} /></div>;

  const het = (b: Buoi) => Date.parse(b.bat_dau) + b.so_phut * 60_000;
  const homNay = d.buoi.filter((b) => b.ngay === d.hom_nay);
  const homNayHoc = homNay.filter((b) => b.trang_thai !== "huy");
  const toiNay = homNayHoc.find((b) => het(b) > bayGio) ?? homNayHoc.at(-1);
  const nghiToiNay = !homNayHoc.length ? homNay.find((b) => b.trang_thai === "huy") : undefined;
  const toi = d.buoi.find((b) => b.trang_thai !== "huy" && Date.parse(b.bat_dau) > bayGio && b.ngay !== d.hom_nay);
  const monToiNay = toiNay ? d.mon.find((m) => m.ma === toiNay.mon) : undefined;
  const khoa = d.trang_thai === "het_thu" || d.trang_thai === "da_nghi";
  const lienHe = d.lien_he.zalo_chung ?? d.lien_he.zalo_hoc_thu;
  const sapToi = d.buoi.filter((b) => het(b) > bayGio && b !== toiNay);
  const daQua = d.buoi.filter((b) => het(b) <= bayGio && b !== toiNay).reverse();
  const monDangHoc = d.mon.filter((m) => m.o === "hoc" || m.o === "thu" || m.dang_mo);
  const ganDay = daQua.filter((b) => b.trang_thai !== "huy").slice(0, 5).reverse(); // 5 buổi gần nhất, cũ → mới
  const thuHomNay = thuISO(d.hom_nay);
  const sapHet = !!d.thu && d.thu.con_ngay <= 3;

  return (
    <div className={`${trang} grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start lg:gap-x-5`}>
      <div className="grid min-w-0 gap-4 lg:col-start-1 lg:row-start-1">
        <section aria-labelledby="toi-nay" className="rounded-[var(--kin-bo-the)] bg-[var(--kin-lop-dem-nen)] p-5 text-[var(--kin-lop-dem-chu)]">
          {khoa ? <svg aria-hidden className="mb-3" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></svg> : null}
          <p className="text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-lop-dem-chu-phu)] [overflow-wrap:anywhere]">Chào {d.hoc_sinh.ho_ten} · <span className="whitespace-nowrap tabular-nums">{thuNgay(d.hom_nay)}</span></p>
          <h1 id="toi-nay" className="mt-1 text-balance text-[length:var(--kin-co-h1)] leading-[var(--kin-dong-h1)] font-bold">
            {toiNay ? <>Tối nay học {tenMonDayDu(toiNay.mon, monToiNay?.ten)} lúc <span className="tabular-nums">{toiNay.gio}</span></>
              : nghiToiNay ? <>Tối nay lớp {tenMonDayDu(nghiToiNay.mon)} nghỉ</>
              : khoa ? <>Lớp của em đang tạm khoá</>
              : <>Tối nay em không có lớp</>}
          </h1>
          {nghiToiNay?.ly_do_huy ? <p className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-lop-dem-chu-phu)] [overflow-wrap:anywhere]">{nghiToiNay.ly_do_huy}</p> : null}
          {toiNay ? (
            <div className="mt-2">
              <NutToiNay batDau={toiNay.bat_dau} soPhut={toiNay.so_phut} meet={monToiNay?.link_meet ?? null} record={toiNay.link_record} zalo={monToiNay?.link_zalo ?? null} luc={bayGio} />
              {toiNay.noi_dung ? <p className="mt-3 line-clamp-3 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-lop-dem-chu-phu)] [overflow-wrap:anywhere]"><span className="font-semibold text-[var(--kin-lop-dem-chu)]">Nội dung buổi: </span>{toiNay.noi_dung}</p> : null}
            </div>
          ) : null}
          {!toiNay && khoa ? <p className="mt-2 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-lop-dem-chu-phu)]">Gia hạn để vào lại lớp Meet và xem record.</p> : null}
          {!toiNay && !khoa && toi ? <p className="mt-2 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-lop-dem-chu-phu)]">Buổi tới: <span className="font-semibold text-[var(--kin-lop-dem-chu)]">{tenMonDayDu(toi.mon)}</span> · <span className="tabular-nums">{thuNgay(toi.ngay)} · {toi.gio}</span></p> : null}
          {d.trang_thai === "sap_bat_dau" && d.bat_dau ? <p className="mt-2 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-lop-dem-chu-phu)]">Lớp của em bắt đầu từ <span className="font-semibold tabular-nums text-[var(--kin-lop-dem-chu)]">{ddmm(d.bat_dau)}</span>.</p> : null}
          {d.trang_thai === "chua_ghi_danh" ? <p className="mt-2 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-lop-dem-chu-phu)]">Em chưa được ghi danh môn nào. Nhắn chủ lớp để được xếp lớp.</p> : null}
        </section>

        {d.thu ? (
          <KinPanel as="section" aria-labelledby="hoc-thu" variant={sapHet ? "canh-bao" : "mac-dinh"}>
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <h2 id="hoc-thu" className={tieuDe}>Học thử ngày <span className="tabular-nums">{Math.min(d.thu.ngay_thu, d.thu.tong_ngay)}/{d.thu.tong_ngay}</span></h2>
              <Nhan tone={sapHet ? "cho" : "thu"}>{d.thu.con_ngay === 0 ? "Hôm nay là ngày cuối" : `Còn ${d.thu.con_ngay} ngày`}</Nhan>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--kin-nen-re-chuot)]" role="progressbar" aria-label="Tiến độ học thử" aria-valuemin={0} aria-valuemax={d.thu.tong_ngay} aria-valuenow={Math.min(d.thu.ngay_thu, d.thu.tong_ngay)}>
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, (d.thu.ngay_thu / d.thu.tong_ngay) * 100)}%`, background: sapHet ? "var(--kin-tt-cham-cho)" : "var(--kin-nhan-nen)" }} />
            </div>
            <p className={`${phu} mt-3`}>Hết hạn <span className="tabular-nums">{ddmm(d.thu.den)}</span>.{sapHet ? (d.thu.con_ngay === 0 ? " Nhắn chủ lớp ngay hôm nay để học tiếp không gián đoạn." : " Nhắn chủ lớp trước ngày đó để học tiếp không gián đoạn.") : ""}</p>
            {/* Sắp hết thử: việc bấm được là nhắn chủ lớp (cùng link với màn khoá, T56); nhóm học thử là nút phụ. */}
            {sapHet && lienHe ? <a href={lienHe} {...ngoai} className={`${kinButtonClass("primary", "lg")} mt-3 min-h-14 w-full !whitespace-normal text-center`}>Nhắn chủ lớp để học tiếp</a> : null}
            {sapHet && !lienHe ? <p className="mt-2 text-[length:var(--kin-co-goc)] font-semibold text-[var(--kin-chu-chinh)]">Em nhắn chủ lớp trong nhóm Zalo của lớp để học tiếp.</p> : null}
            {d.lien_he.zalo_hoc_thu ? <a href={d.lien_he.zalo_hoc_thu} {...ngoai} className={`${kinButtonClass("secondary")} mt-3 w-full`}>Nhóm Zalo học thử</a> : null}
          </KinPanel>
        ) : null}

        {khoa ? (
          <KinPanel as="section" aria-labelledby="khoa">
            <div role="alert" className="rounded-[var(--kin-bo-md)] bg-[var(--kin-tt-nen-loi)] p-3">
              <h2 id="khoa" className="text-[length:var(--kin-co-body)] font-semibold text-[var(--kin-tt-chu-loi-dam)]">
                {d.trang_thai === "het_thu" && d.het_thu ? <>Thời gian học thử đã hết từ <span className="tabular-nums">{ddmm(d.het_thu)}</span></> : "Em đã nghỉ các môn"}
              </h2>
              <p className={`${phu} mt-1`}>Lịch học, nội dung buổi và record đã khoá. Gia hạn xong là mở lại ngay.</p>
            </div>
            {lienHe
              ? <a href={lienHe} {...ngoai} className={`${kinButtonClass("primary", "lg")} mt-3 min-h-14 w-full`}>Liên hệ gia hạn</a>
              : <p className="mt-3 text-[length:var(--kin-co-body)] font-semibold text-[var(--kin-chu-chinh)]">Nhắn chủ lớp qua Zalo để gia hạn.</p>}
          </KinPanel>
        ) : null}
      </div>

      <div className="grid min-w-0 gap-6 lg:col-start-2 lg:row-span-2 lg:row-start-1">
        {!khoa && monDangHoc.length ? (
          <section aria-labelledby="tuan-nay">
            <h2 id="tuan-nay" className={tieuDe}>Tuần này</h2>
            <ol className="mt-2 grid grid-cols-7 gap-1.5 text-center">
              {[1, 2, 3, 4, 5, 6, 7].map((t) => {
                const mon = monDangHoc.filter((m) => m.thu.includes(t));
                const nay = t === thuHomNay;
                return (
                  <li key={t} aria-current={nay ? "date" : undefined}
                    className={`min-w-0 rounded-[var(--kin-bo-md)] border bg-[var(--kin-nen-bang)] py-2 ${nay ? "border-2 border-[var(--kin-lop-dem-nut)] font-bold text-[var(--kin-chu-chinh)]" : "border-[var(--kin-vien-nhat)] text-[var(--kin-chu-phu)]"}`}>
                    <span className="block text-[length:var(--kin-co-phu)]">{THU_TAT[t]}</span>
                    <span className="block text-[length:var(--kin-co-body)] tabular-nums text-[var(--kin-chu-chinh)]">{Number(congNgay(d.hom_nay, t - thuHomNay).slice(8))}</span>
                    <span className="mt-1 flex min-h-2 justify-center gap-0.5">{mon.map((m) => <MonCham key={m.ma} ma={m.ma} />)}</span>
                    <span className="sr-only">{mon.length ? mon.map((m) => m.ten).join(", ") : "không có lớp"}</span>
                  </li>
                );
              })}
            </ol>
            <ul aria-hidden className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[length:var(--kin-co-phu)] text-[var(--kin-chu-phu)]">
              {monDangHoc.map((m) => <li key={m.ma} className="inline-flex items-center gap-1.5"><MonCham ma={m.ma} />{m.ten}</li>)}
            </ul>
          </section>
        ) : null}

        {!khoa ? (
          <KinPanel as="section" aria-labelledby="chuoi">
            {d.chuoi ? (
              <>
                <div className="flex items-center gap-4">
                  <p aria-hidden className="text-[length:var(--kin-co-h1)] leading-none font-bold tabular-nums text-[var(--kin-chu-chinh)]">{d.chuoi}</p>
                  <div className="min-w-0">
                    <h2 id="chuoi" className="text-[length:var(--kin-co-body)] font-semibold text-[var(--kin-chu-chinh)]"><span className="sr-only">{d.chuoi} </span>buổi đi học liên tiếp</h2>
                    {ganDay.length ? (
                      <p className="mt-1.5 flex gap-1.5" role="img" aria-label={`${ganDay.length} buổi gần nhất: ${ganDay.map((b) => (b.diem_danh ? DD[b.diem_danh].chu : "chưa có dấu")).join(", ")}`}>
                        {ganDay.map((b) => <span key={b.id} className="size-3 rounded-full border border-[var(--kin-vien-o-nhap)]" style={b.diem_danh ? { background: `var(--kin-lop-dd-${b.diem_danh})`, borderColor: `var(--kin-lop-dd-${b.diem_danh})` } : undefined} />)}
                      </p>
                    ) : null}
                  </div>
                </div>
                <p className={`${phu} mt-3`}>Buổi có phép không làm đứt chuỗi.</p>
              </>
            ) : (
              // Chuỗi 0: lời mời, không hiện số 0, không bày dãy chấm đỏ (đọc như bị phạt).
              <>
                <h2 id="chuoi" className="text-[length:var(--kin-co-body)] font-semibold text-[var(--kin-chu-chinh)]">{toiNay && het(toiNay) > bayGio ? "Đi buổi tối nay để bắt đầu chuỗi" : toi ? `Đi buổi ${thuNganNgay(toi.ngay)} để bắt đầu chuỗi` : "Bắt đầu chuỗi mới từ buổi tới"}</h2>
                <p className={`${phu} mt-1`}>Mỗi buổi em có mặt sẽ nối dài chuỗi.</p>
              </>
            )}
          </KinPanel>
        ) : null}

        {d.mon.length ? (
          <section aria-labelledby="mon">
            <h2 id="mon" className={tieuDe}>{khoa ? (d.trang_thai === "het_thu" ? "Môn đã thử" : "Môn đã học") : "Môn của em"}</h2>
            <KinPanel className="mt-2 !py-1">
              <ul>
                {d.mon.map((m) => (
                  <li key={m.ma} className="border-b border-[var(--kin-vien-nhat)] py-3 last:border-b-0">
                    <div className="flex items-center gap-3">
                      <MonCham ma={m.ma} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[length:var(--kin-co-body)] font-semibold text-[var(--kin-chu-chinh)]">{m.ten_day_du}</p>
                        <p className={`${phu} tabular-nums`}>{m.thu.map((t) => THU_ISO[t]).join(", ")} · {m.gio}</p>
                      </div>
                      {chipMon(m, d)}
                    </div>
                    {m.link_zalo ? <a href={m.link_zalo} {...ngoai} className="ml-5 inline-flex min-h-11 items-center text-[length:var(--kin-co-goc)] font-medium text-[var(--kin-nhan-link)] hover:underline">Nhóm Zalo môn {m.ten}</a> : null}
                  </li>
                ))}
              </ul>
            </KinPanel>
          </section>
        ) : null}
      </div>

      <div className="grid min-w-0 gap-6 lg:col-start-1 lg:row-start-2">
        <DanhSachBuoi id="sap-toi" ten="Buổi sắp tới" ds={sapToi} d={d} bayGio={bayGio} />
        {!khoa && !daQua.length && !sapToi.length && !toiNay ? <KinPanel><p className={phu}>Chưa có buổi học nào trong thời gian em học trên web. Buổi mới sẽ hiện ở đây khi lớp có lịch.</p></KinPanel> : null}
        <DanhSachBuoi id="da-hoc" ten={khoa ? "Điểm danh của em" : "Buổi gần đây"} ds={daQua} d={d} bayGio={bayGio} />
      </div>
    </div>
  );
}
