"use client";
// Xử lý một đơn chờ duyệt (T43, chỉ chủ lớp; máy chủ vẫn chặn):
// - "Tạo hồ sơ": tờ trượt xem trước hồ sơ điền sẵn từ đơn + môn + khoảng thử (T1–T3). Đơn trùng Gmail/SĐT với hồ sơ cũ ⇒ chủ chọn
//   gắn vào hồ sơ cũ hay tạo hồ sơ mới (không tự đoán). Em đã hết thử đăng ký lại / đơn quá 14 ngày ⇒ máy chủ trả "can_chu_quyet",
//   tờ trượt hỏi "Cấp thử 14 ngày từ hôm nay" (T2: không tự cấp).
// - "Bỏ qua": lý do bắt buộc.
// Cả hai xong thì thanh Hoàn tác 5 giây. Cần có mạng (không xếp hàng đợi).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { ddmm, sdt } from "../dinh-dang";
import { Chip } from "../ui/chip";
import { ToTruot } from "../ui/to-truot";
import { nhan, nutChinh, nutPhu, oNhap } from "../ui/nut";
import { useHoanTac } from "../khung/hoan-tac";
import { useHangDoi } from "../khung/hang-doi";

type Trung = { ma_hs: string; ho_ten: string; an: boolean; ten_giong: boolean; khop: string[] };
type XemTruoc = {
  ho_so: { hoTen: string; sdtHs?: string; sdtPh?: string; gmail?: string; hoTenPh?: string; truong?: string; khoi?: string; mucTieu?: string; nguon?: string };
  mon: (string | undefined)[];
  muon_chinh_thuc: boolean;
  ngay_dang_ky: string;
  thu_du_kien: { tu: string; den: string };
  trung: Trung[];
  da_xu_ly: boolean;
};
type KetQua =
  | { ket_qua: "trung_ho_so"; goi_y: Trung[] }
  | { ket_qua: "can_chu_quyet"; ly_do: "het_thu_dang_ky_lai" | "don_qua_han"; ma_hs: string | null }
  | { ket_qua: "da_tao" | "da_gan"; nhatKyId: number; ma_hs: string; muon_chinh_thuc: boolean; thu: { tu: string; den: string } | null; mon: string[]; bo_qua: { mon?: string; ly_do: string }[]; trung_sdt?: string[] };

const TEN_MON: Record<string, string> = { toan: "Toán", su: "Sử", dia: "Địa", anh: "Anh" };
const tenMon = (ds: (string | undefined)[]) => ds.map((m) => TEN_MON[m ?? ""] ?? m ?? "").filter(Boolean).join(", ");
const KHOP: Record<string, string> = { gmail: "trùng Gmail", sdt: "trùng SĐT", don_da_gan: "đơn đã gắn" };
const LY_DO_NHANH = ["Đơn trùng", "Gửi nhầm / thử form", "Không liên lạc được"];

async function goi(url: string, body?: unknown) {
  let r: Response;
  try {
    r = await fetch(url, body === undefined ? undefined : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new Error("Không gửi được — kiểm tra mạng rồi thử lại.");
  }
  const kq = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(kq.loi ?? `Lỗi ${r.status}`);
  return kq;
}

export function XuLyDon({ id, ten }: { id: number; ten: string }) {
  const [mo, setMo] = useState<"tao" | "bo" | null>(null);
  const mang = useHangDoi().matMang;
  if (mang) return <p className="text-[14px] text-warn">Cần có mạng để xử lý đơn.</p>;
  return (
    <span className="flex flex-wrap gap-2">
      {/* Vàng chỉ dành cho nút chính trong tờ trượt — danh sách nhiều đơn không thành một cột nút vàng. */}
      <button type="button" className={`${nutPhu} px-4 text-[14px]`} onClick={() => setMo("tao")}>Tạo hồ sơ</button>
      <button type="button" className="nhan inline-flex min-h-11 items-center rounded-[10px] px-3 text-[14px] font-semibold text-text-2 hover:bg-row-hover hover:text-text" onClick={() => setMo("bo")}>Bỏ qua…</button>
      {mo === "tao" ? <TaoHoSo id={id} ten={ten} dong={() => setMo(null)} /> : null}
      {mo === "bo" ? <BoQua id={id} ten={ten} dong={() => setMo(null)} /> : null}
    </span>
  );
}

function useHoanTacDon(id: number) {
  const router = useRouter();
  const { hien } = useHoanTac();
  return (thongDiep: string, nhatKyId: number) => {
    router.refresh();
    hien({
      thongDiep,
      hoanTac: async () => {
        try {
          await goi(`/api/don/${id}/hoan-tac`, { nhatKyId });
          hien({ thongDiep: "Đã hoàn tác — đơn về chờ xử lý" });
        } catch (e) { hien({ thongDiep: (e as Error).message }); }
        router.refresh();
      },
    });
  };
}

function TaoHoSo({ id, ten, dong }: { id: number; ten: string; dong: () => void }) {
  const [xem, setXem] = useState<XemTruoc | null>(null);
  const [loi, setLoi] = useState("");
  const [dang, setDang] = useState(false);
  const [chon, setChon] = useState<string | null>(null); // mã HS cũ để gắn, "moi" = tạo hồ sơ mới
  const [hoi, setHoi] = useState<Extract<KetQua, { ket_qua: "can_chu_quyet" }> | null>(null);
  const xong = useHoanTacDon(id);
  const ten2 = useId();

  useEffect(() => {
    let huy = false;
    goi(`/api/don/${id}/tao-ho-so`).then((k) => { if (!huy) setXem(k); }, (e: Error) => { if (!huy) setLoi(e.message); });
    return () => { huy = true; };
  }, [id]);
  const trung = xem?.trung ?? [];
  const canChon = trung.length > 0 && !chon;

  async function gui(capThuMoi = false) {
    if (canChon) return setLoi("Chọn gắn vào hồ sơ cũ hay tạo hồ sơ mới.");
    setDang(true);
    setLoi("");
    try {
      const body = { ...(chon && chon !== "moi" ? { maHs: chon } : { taoMoi: true }), ...(capThuMoi ? { capThuMoi: true } : {}) };
      const kq = (await goi(`/api/don/${id}/tao-ho-so`, body)) as KetQua;
      if (kq.ket_qua === "trung_ho_so") { setXem((x) => (x ? { ...x, trung: kq.goi_y } : x)); setChon(null); return setLoi("Vừa có hồ sơ trùng — chọn lại."); }
      if (kq.ket_qua === "can_chu_quyet") return setHoi(kq);
      dong();
      const thu = kq.thu ? ` · thử ${tenMon(kq.mon)} tới ${ddmm(kq.thu.den)}` : "";
      const boQua = kq.bo_qua.length ? ` · ${tenMon(kq.bo_qua.map((b) => b.mon))} đang học sẵn` : "";
      xong(`${kq.ket_qua === "da_tao" ? "Đã tạo" : "Đã gắn vào"} ${kq.ma_hs}${thu}${boQua}${kq.muon_chinh_thuc ? " · muốn chính thức" : ""}`, kq.nhatKyId);
    } catch (e) { setLoi((e as Error).message); } finally { setDang(false); }
  }

  const h = xem?.ho_so;
  const quaHan = xem ? xem.thu_du_kien.den < xem.thu_du_kien.tu : false;
  return (
    <ToTruot
      mo
      dong={dong}
      tieuDe={<>Tạo hồ sơ từ đơn · <span translate="no">{ten}</span></>}
      chan={
        hoi ? (
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" className={nutPhu} onClick={dong}>Để chờ, chưa cấp</button>
            <button type="button" className={nutChinh} onClick={() => gui(true)} disabled={dang}>{dang ? "Đang cấp…" : "Cấp thử 14 ngày từ hôm nay"}</button>
          </div>
        ) : (
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" className={nutPhu} onClick={dong}>Huỷ</button>
            <button type="button" className={nutChinh} onClick={() => gui()} disabled={dang || !xem || xem.da_xu_ly || canChon}>
              {dang ? "Đang tạo…" : chon && chon !== "moi" ? `Gắn vào ${chon}` : "Tạo hồ sơ"}
            </button>
          </div>
        )
      }
    >
      {!xem ? (
        <p className={loi ? "text-danger" : "text-text-3"} role={loi ? "alert" : undefined}>{loi || "Đang đọc đơn…"}</p>
      ) : (
        <div className="grid gap-4">
          {xem.da_xu_ly ? <p className="rounded-[14px] bg-raised px-3 py-2">Đơn này đã được xử lý.</p> : null}
          {hoi ? (
            <div role="alert" className="rounded-[14px] bg-warn-bg px-3 py-3">
              <p className="font-semibold">{hoi.ly_do === "het_thu_dang_ky_lai" ? `Em đã hết thử trước đây${hoi.ma_hs ? ` (${hoi.ma_hs})` : ""} và đăng ký lại.` : "Đơn đã quá 14 ngày học thử."}</p>
              <p className="mt-1 text-text-2">Không tự cấp thử lại. Chủ quyết: cấp thử 14 ngày tính từ hôm nay, hoặc để đơn chờ.</p>
            </div>
          ) : null}
          <dl className="rounded-[14px] border border-border">
            {([
              ["Họ tên", h?.hoTen],
              ["SĐT học sinh", h?.sdtHs ? sdt(h.sdtHs) : null],
              ["Gmail", h?.gmail],
              ["Phụ huynh", [h?.hoTenPh, h?.sdtPh ? sdt(h.sdtPh) : null].filter(Boolean).join(" · ")],
              ["Trường · khối", [h?.truong, h?.khoi].filter(Boolean).join(" · ")],
              ["Mục tiêu", h?.mucTieu],
            ] as const).map(([k, v]) => (
              <div key={k} className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-2 border-b border-border px-3 py-2 text-[14px] last:border-b-0">
                <dt className="text-text-3">{k}</dt>
                <dd className={`min-w-0 [overflow-wrap:anywhere] ${v ? "" : "text-text-3"}`} translate="no">{v || "—"}</dd>
              </div>
            ))}
          </dl>
          <div className="rounded-[14px] bg-raised px-3 py-2 text-[14px]">
            <p><span className="font-semibold">Ghi danh thử:</span> {tenMon(xem.mon) || "—"} · <span className="so">{ddmm(xem.thu_du_kien.tu)} → {ddmm(xem.thu_du_kien.den)}</span></p>
            <p className="text-text-3">Đăng ký {ddmm(xem.ngay_dang_ky)} · 14 ngày tính từ ngày đăng ký.{quaHan ? " Đơn đã quá hạn thử — chủ sẽ được hỏi trước khi cấp." : ""}</p>
            {xem.muon_chinh_thuc ? <p className="mt-1"><Chip mau="ok">Muốn chính thức</Chip> <span className="text-text-2">vẫn học thử trước; chủ bấm “Lên chính thức” ở hồ sơ.</span></p> : null}
          </div>
          {trung.length ? (
            <fieldset className="grid gap-2">
              <legend className={nhan}>Có hồ sơ có thể trùng — chọn một</legend>
              {trung.map((t) => (
                <label key={t.ma_hs} className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-[14px] border px-3 py-2 ${chon === t.ma_hs ? "border-gold bg-nav-active" : "border-border-input"}`}>
                  <input type="radio" name={ten2} className="mt-1 size-5 accent-[var(--gold)]" checked={chon === t.ma_hs} onChange={() => { setChon(t.ma_hs); setLoi(""); }} disabled={t.an} />
                  <span className="min-w-0 text-[14px]">
                    <span className="font-semibold">Gắn vào <span translate="no">{t.ma_hs} · {t.ho_ten}</span></span>
                    <span className="block text-text-3">{t.khop.map((k) => KHOP[k] ?? k).join(", ")}{t.ten_giong ? " · tên giống" : " · tên khác — kiểm tra kỹ"}{t.an ? " · hồ sơ đang ẩn, bỏ ẩn trước" : ""}</span>
                    <Link href={`/quan-ly/hoc-sinh/${t.ma_hs}`} target="_blank" className="inline-flex min-h-11 items-center font-semibold text-gold hover:underline">Xem hồ sơ (thẻ mới)</Link>
                  </span>
                </label>
              ))}
              <label className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-[14px] border px-3 py-2 ${chon === "moi" ? "border-gold bg-nav-active" : "border-border-input"}`}>
                <input type="radio" name={ten2} className="size-5 accent-[var(--gold)]" checked={chon === "moi"} onChange={() => { setChon("moi"); setLoi(""); }} />
                <span className="text-[14px] font-semibold">Tạo hồ sơ mới (người khác)</span>
              </label>
            </fieldset>
          ) : null}
          {loi ? <p role="alert" className="text-danger">{loi}</p> : null}
        </div>
      )}
    </ToTruot>
  );
}

function BoQua({ id, ten, dong }: { id: number; ten: string; dong: () => void }) {
  const [lyDo, setLyDo] = useState("");
  const [loi, setLoi] = useState("");
  const [dang, setDang] = useState(false);
  const xong = useHoanTacDon(id);
  const o = useId();
  async function gui() {
    if (!lyDo.trim()) return setLoi("Cần ghi lý do bỏ qua đơn.");
    setDang(true);
    setLoi("");
    try {
      const kq = await goi(`/api/don/${id}/bo-qua`, { lyDo: lyDo.trim() });
      dong();
      xong(`Đã bỏ qua đơn của ${ten}`, kq.nhatKyId);
    } catch (e) { setLoi((e as Error).message); } finally { setDang(false); }
  }
  return (
    <ToTruot
      mo
      dong={dong}
      tieuDe={<>Bỏ qua đơn · <span translate="no">{ten}</span></>}
      chan={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" data-autofocus className={nutPhu} onClick={dong}>Giữ đơn</button>
          <button type="button" className={nutChinh} onClick={gui} disabled={dang}>{dang ? "Đang bỏ qua…" : "Bỏ qua đơn"}</button>
        </div>
      }
    >
      <p className="text-text-2">Đơn chuyển sang “Bỏ qua”, không tạo hồ sơ, hết khỏi việc ở Hôm nay. Vẫn xem lại được ở “Tất cả”.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {LY_DO_NHANH.map((l) => (
          <button key={l} type="button" aria-pressed={lyDo === l} onClick={() => { setLyDo(l); setLoi(""); }} className={`nhan min-h-11 rounded-[10px] border px-3 text-[14px] font-semibold ${lyDo === l ? "border-gold bg-nav-active text-gold" : "border-border-input text-text-2"}`}>{l}</button>
        ))}
      </div>
      <label htmlFor={o} className={`${nhan} mt-4`}>Lý do (bắt buộc)</label>
      <input id={o} value={lyDo} maxLength={500} onChange={(e) => { setLyDo(e.target.value); setLoi(""); }} placeholder="Ví dụ: Đơn trùng với đơn hôm qua" className={`${oNhap} mt-1`} aria-invalid={!!loi} aria-describedby={loi ? `${o}-loi` : undefined} autoComplete="off" />
      {loi ? <p id={`${o}-loi`} role="alert" className="mt-2 text-danger">{loi}</p> : null}
    </ToTruot>
  );
}
