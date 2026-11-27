"use client";
// Xử lý một đơn đăng ký chờ duyệt (T43, chỉ chủ lớp; máy chủ vẫn chặn) — KiN lớp bước 6, theo bca/components/quan-ly/xu-ly-don.tsx.
// "Tạo hồ sơ": xem trước hồ sơ điền sẵn + môn + khoảng thử. Trùng Gmail / SĐT với hồ sơ cũ ⇒ chủ chọn gắn hay tạo mới (không tự đoán).
// Em cũ hết thử / đã nghỉ đăng ký lại, hoặc đơn quá 14 ngày ⇒ máy chủ trả "can_chu_quyet", hộp hỏi chủ có cấp thử không (T2: không tự cấp).
// "Bỏ qua": lý do bắt buộc. Cả hai xong thì có Hoàn tác 10 giây ở thanh dưới màn hình.
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { KinDialog, KIN_FIELD, KIN_LABEL, kinButtonClass } from "@/components/kin";
import { ddmm } from "@/lib/lop/ngay";
import { baoLop, goi, Loi } from "./goi";

type Khoang = { tu: string; den: string; ly_do?: string | null };
type Trung = { ma_hs: string; ho_ten: string; an: boolean; ten_giong: boolean; khop: string[]; thu_du_kien?: Khoang };
type Xem = { ho_so: Record<string, string | boolean | undefined>; mon: (string | undefined)[]; muon_chinh_thuc: boolean; ngay_dang_ky: string; thu_du_kien: Khoang; trung: Trung[]; da_xu_ly: boolean };
const KHOP: Record<string, string> = { gmail: "trùng Gmail", sdt: "trùng SĐT", don_da_gan: "đơn đã gắn sẵn" };
const HOI: Record<string, string> = { het_thu_dang_ky_lai: "Em đã hết thử trước đây và nay đăng ký lại.", da_nghi_dang_ky_lai: "Em đã nghỉ hết các môn và nay đăng ký lại.", don_qua_han: "Đơn gửi đã quá 14 ngày học thử." };

export function XuLyDon({ id, ten, tenMon }: { id: number; ten: string; tenMon: Record<string, string> }) {
  const router = useRouter();
  const [mo, setMo] = useState<"tao" | "bo" | null>(null);
  const [xem, setXem] = useState<Xem | null>(null);
  const [chon, setChon] = useState<string | null>(null); // mã hồ sơ cũ để gắn, "moi" = tạo hồ sơ mới
  const [hoi, setHoi] = useState<string | null>(null); // lý do máy chủ cần chủ quyết
  const [dang, setDang] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);
  const mon = (ds: (string | undefined)[]) => ds.map((m) => tenMon[m ?? ""] ?? m ?? "").filter(Boolean).join(", ");
  const dong = () => setMo(null);
  const xong = (chu: string, nhatKyId: unknown) => {
    dong(); router.refresh();
    baoLop({ chu, hoanTac: () => goi("POST", `/api/lop/don/${id}/hoan-tac`, { nhatKyId }), sauHoanTac: () => router.refresh() });
  };

  async function moTao() {
    setMo("tao"); setXem(null); setChon(null); setHoi(null); setLoi(null);
    const k = await goi("GET", `/api/lop/don/${id}/tao-ho-so`);
    if (!k.ok) return setLoi(k.d.error ?? "Không đọc được đơn");
    setXem(k.d as unknown as Xem);
  }
  const trung = xem?.trung ?? [];
  const trungGmail = trung.some((t) => t.khop.includes("gmail"));
  const canChon = trung.length > 0 && !chon;
  const khoang = (chon && chon !== "moi" ? trung.find((t) => t.ma_hs === chon)?.thu_du_kien : undefined) ?? xem?.thu_du_kien;

  async function tao(capThuMoi = false) {
    if (canChon) return setLoi(trungGmail ? "Chọn hồ sơ để gắn đơn vào. Không phải cùng một em thì đóng hộp và bấm “Bỏ qua”." : "Chọn gắn đơn vào hồ sơ cũ hay tạo hồ sơ mới.");
    setDang(true); setLoi(null);
    const k = await goi("POST", `/api/lop/don/${id}/tao-ho-so`, { ...(chon && chon !== "moi" ? { maHs: chon } : { taoMoi: true }), ...(capThuMoi ? { capThuMoi: true } : {}) });
    setDang(false);
    // Gmail là duy nhất: không tạo được hồ sơ mới trùng Gmail ⇒ nói rõ hai lối đi.
    if (!k.ok) return setLoi(`${k.d.error ?? "Không tạo được hồ sơ"}${k.d.ma === "trung_gmail" ? ". Mỗi Gmail chỉ thuộc một hồ sơ: chọn “Gắn vào …” ở trên nếu là cùng một em, hoặc đóng hộp và bấm “Bỏ qua” nếu đơn gửi nhầm." : ""}`);
    const d = k.d as Record<string, unknown> & { thu?: { den: string } | null; mon?: string[]; bo_qua?: { mon?: string }[]; khac_ho_so?: string[]; trung_sdt?: string[] };
    if (d.ket_qua === "trung_ho_so") { setXem((x) => (x ? { ...x, trung: d.goi_y as Trung[] } : x)); setChon(null); return setLoi("Vừa có hồ sơ trùng với đơn này — chọn lại bên dưới."); }
    if (d.ket_qua === "can_chu_quyet") return setHoi(String(d.ly_do));
    xong([
      `${d.ket_qua === "da_tao" ? "Đã tạo hồ sơ" : "Đã gắn đơn vào"} ${d.ma_hs}`,
      d.thu ? `thử ${mon(d.mon ?? [])} tới ${ddmm(d.thu.den)}` : "", d.bo_qua?.length ? `${mon(d.bo_qua.map((b) => b.mon))} đang học sẵn` : "", d.muon_chinh_thuc ? "em muốn lên chính thức" : "",
      d.trung_gmail ? `Gmail thuộc ${d.trung_gmail}, không điền` : "", d.khac_ho_so?.length ? "SĐT trong đơn khác hồ sơ (giữ số cũ)" : "", d.trung_sdt?.length ? `SĐT trùng ${d.trung_sdt.join(", ")}` : "",
    ].filter(Boolean).join(" · "), d.nhatKyId);
  }
  async function boQua(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const lyDo = String(new FormData(e.currentTarget).get("lyDo") ?? "").trim();
    if (!lyDo) return setLoi("Cần ghi lý do bỏ qua đơn — ví dụ “Đơn trùng”.");
    setDang(true); setLoi(null);
    const k = await goi("POST", `/api/lop/don/${id}/bo-qua`, { lyDo });
    setDang(false);
    if (!k.ok) return setLoi(k.d.error ?? "Không lưu được");
    xong(`Đã bỏ qua đơn của ${ten}`, k.d.nhatKyId);
  }

  const h = xem?.ho_so;
  const dong2 = (nhan: string, v: unknown) => (v ? <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2 py-1 text-[length:var(--kin-co-goc)]"><dt className="text-[var(--kin-chu-mo)]">{nhan}</dt><dd translate="no" className="[overflow-wrap:anywhere]">{String(v)}</dd></div> : null);
  const phu = kinButtonClass("secondary");
  return (
    <span className="flex flex-wrap gap-2">
      <button type="button" data-kin-nut className={phu} onClick={() => void moTao()}>Tạo hồ sơ</button>
      <button type="button" data-kin-nut className={kinButtonClass("ghost")} onClick={() => { setLoi(null); setMo("bo"); }}>Bỏ qua</button>

      <KinDialog open={mo === "tao"} onClose={dong} size="lg" title={`Tạo hồ sơ từ đơn · ${ten}`}
        footer={hoi ? (
          <><button type="button" data-kin-nut className={phu} onClick={dong}>Để chờ, chưa cấp</button>
            <button type="button" disabled={dang} data-kin-nut className={kinButtonClass("primary")} onClick={() => void tao(true)}>{dang ? "Đang cấp…" : `Cấp thử${khoang ? ` tới ${ddmm(khoang.den)}` : ""}`}</button></>
        ) : (
          <><button type="button" data-kin-nut className={phu} onClick={dong}>Huỷ</button>
            <button type="button" disabled={dang || !xem || xem.da_xu_ly || canChon} data-kin-nut className={kinButtonClass("primary")} onClick={() => void tao()}>{dang ? "Đang tạo…" : chon && chon !== "moi" ? `Gắn vào ${chon}` : "Tạo hồ sơ"}</button></>
        )}>
        {!xem ? (loi ? <Loi chu={`${loi} Đóng hộp rồi thử lại.`} /> : <p role="status" className="text-[var(--kin-chu-mo)]">Đang đọc đơn…</p>) : (
          <div className="grid gap-4">
            {xem.da_xu_ly ? <p role="alert" className="rounded-[var(--kin-bo-lg)] bg-[var(--kin-nen-bang)] px-3 py-2 text-[length:var(--kin-co-goc)]">Đơn này đã được xử lý. Tải lại trang để thấy trạng thái mới.</p> : null}
            {hoi ? (
              <div role="alert" className="rounded-[var(--kin-bo-lg)] bg-[var(--kin-tt-nen-cho)] px-3 py-3 text-[length:var(--kin-co-goc)]">
                <p className="font-medium text-[var(--kin-tt-chu-cho)]">{HOI[hoi] ?? "Đơn này cần chủ lớp quyết định."}</p>
                <p className="mt-1 text-[var(--kin-chu-phu)]">Hệ thống không tự cấp học thử lại. Chủ lớp quyết: cấp thử{khoang ? ` từ ${ddmm(khoang.tu)} tới ${ddmm(khoang.den)}` : ""}, hoặc để đơn chờ.</p>
              </div>
            ) : null}
            <dl>
              {dong2("Họ tên", h?.hoTen)}{dong2("SĐT học sinh", h?.sdtHs)}{dong2("Gmail", h?.gmail)}{dong2("Phụ huynh", h?.hoTenPh)}{dong2("SĐT phụ huynh", h?.sdtPh)}{dong2("Trường", h?.truong)}{dong2("Khối", h?.khoi)}{dong2("Mục tiêu", h?.mucTieu)}
              {dong2("Môn đăng ký", mon(xem.mon))}{dong2("Ngày gửi đơn", ddmm(xem.ngay_dang_ky))}
              {khoang && !hoi ? dong2("Học thử", `${ddmm(khoang.tu)} → ${ddmm(khoang.den)}${khoang.ly_do ? " (cần chủ quyết trước khi cấp)" : ""}`) : null}
            </dl>
            {xem.muon_chinh_thuc ? <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]">Đơn ghi “Chính thức”: em vẫn được ghi danh học thử trước; muốn lên chính thức ngay thì bấm “Lên chính thức” ở hồ sơ em sau khi tạo.</p> : null}
            {trung.length ? (
              <fieldset className="rounded-[var(--kin-bo-lg)] border border-[var(--kin-vien-thuong)] px-3 py-2">
                <legend className="px-1 text-[length:var(--kin-co-goc)] font-medium text-[var(--kin-tt-chu-cho)]">Đơn này có thể là của em đã có hồ sơ — chọn một cách</legend>
                {trung.map((t) => (
                  <label key={t.ma_hs} className="flex min-h-11 items-center gap-3 text-[length:var(--kin-co-goc)]"><input type="radio" name={`don-${id}`} disabled={t.an} checked={chon === t.ma_hs} onChange={() => { setChon(t.ma_hs); setLoi(null); }} className="size-5 shrink-0" />
                    <span className="min-w-0 [overflow-wrap:anywhere]">Gắn vào <span translate="no" className="font-medium">{t.ma_hs} · {t.ho_ten}</span> <span className="text-[var(--kin-chu-mo)]">({[...t.khop.map((k) => KHOP[k] ?? k), t.ten_giong ? "tên giống" : "tên khác", t.an ? "hồ sơ đang ẩn — bỏ ẩn trước" : ""].filter(Boolean).join(", ")})</span></span></label>
                ))}
                {/* Gmail là duy nhất: đơn trùng Gmail thì "tạo hồ sơ mới" luôn bị 409 ⇒ không bày lựa chọn đó, chỉ còn gắn hoặc bỏ qua. */}
                {trungGmail
                  ? <p className="py-2 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]">Gmail của đơn đã thuộc hồ sơ trên, và mỗi Gmail chỉ thuộc một hồ sơ nên không tạo hồ sơ mới được. Nếu đây là em khác hoặc đơn gửi nhầm: đóng hộp này rồi bấm “Bỏ qua”.</p>
                  : <label className="flex min-h-11 items-center gap-3 text-[length:var(--kin-co-goc)]"><input type="radio" name={`don-${id}`} checked={chon === "moi"} onChange={() => { setChon("moi"); setLoi(null); }} className="size-5 shrink-0" /><span>Tạo hồ sơ mới (đây là em khác)</span></label>}
              </fieldset>
            ) : null}
            <Loi chu={loi} />
          </div>
        )}
      </KinDialog>

      <KinDialog open={mo === "bo"} onClose={dong} title={`Bỏ qua đơn · ${ten}`}
        footer={<><button type="button" data-kin-nut className={phu} onClick={dong}>Huỷ</button><button type="submit" form={`lop-bo-qua-${id}`} disabled={dang} data-kin-nut className={kinButtonClass("danger-solid")}>{dang ? "Đang lưu…" : "Bỏ qua đơn"}</button></>}>
        <form id={`lop-bo-qua-${id}`} onSubmit={(e) => void boQua(e)} noValidate className="grid gap-3">
          <label className={KIN_LABEL}>Lý do <span className="text-[var(--kin-chu-mo)]">(bắt buộc)</span>
            <input name="lyDo" maxLength={500} autoComplete="off" list={`lop-ly-do-${id}`} placeholder="Ví dụ: Đơn trùng" className={`${KIN_FIELD} mt-1`} /></label>
          <datalist id={`lop-ly-do-${id}`}><option value="Đơn trùng" /><option value="Gửi nhầm / thử form" /><option value="Không liên lạc được" /></datalist>
          <p className="text-[length:var(--kin-co-phu)] text-[var(--kin-chu-mo)]">Đơn vẫn được giữ ở tab “Tất cả”, không bị xoá.</p>
          <Loi chu={loi} />
        </form>
      </KinDialog>
    </span>
  );
}
