"use client";
// Thao tác GHI của chủ lớp về học sinh / ghi danh (KiN lớp bước 6): gia hạn thử (một em, cả nhóm, nhiều em đã chọn), lên chính thức, cho nghỉ, thêm môn / học lại,
// ẩn / bỏ ẩn hồ sơ, sửa thông tin, ghi chú, thêm học sinh, ẩn việc 3 ngày ở Hôm nay. Luật nằm ở máy chủ (src/lib/lop/server/{ghi-danh,hoc-sinh}.ts);
// ở đây chỉ gọi /api/lop/* rồi tải lại trang. Lỗi máy chủ hiện nguyên câu trong hộp; việc có Hoàn tác thì báo ở thanh dưới màn hình (goi.tsx).
import { useRouter } from "next/navigation";
import { createContext, use, useState, type FormEvent, type ReactNode } from "react";
import { KinDialog, KIN_FIELD, KIN_LABEL, kinButtonClass, useKinConfirm, type KinButtonVariant } from "@/components/kin";
import { ddmm } from "@/lib/lop/ngay";
import { baoLop, goi, Loi, type Kq } from "./goi";

function useGui() {
  const router = useRouter();
  const [dang, setDang] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);
  async function gui(f: () => Promise<Kq>, xong: (k: Kq) => void, goiY = "") {
    setDang(true); setLoi(null);
    const k = await f();
    setDang(false);
    if (!k.ok) return setLoi(`${k.d.error ?? "Không lưu được"}${k.status === 409 ? goiY : ""}`);
    xong(k);
    router.refresh();
  }
  return { router, dang, loi, setLoi, gui };
}
const Chan = ({ dong, dang, nhan, id, kieu = "primary" }: { dong: () => void; dang: boolean; nhan: string; id: string; kieu?: KinButtonVariant }) => (
  <>
    <button type="button" data-kin-nut className={kinButtonClass("secondary")} onClick={dong}>Huỷ</button>
    <button type="submit" form={id} disabled={dang} data-kin-nut className={kinButtonClass(kieu)}>{dang ? "Đang lưu…" : nhan}</button>
  </>
);
const O_TICH = "flex min-h-11 items-center gap-3 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]";
const GOI_Y = "mt-1 block text-[length:var(--kin-co-phu)] text-[var(--kin-chu-mo)]";

export type Em = { ma_hs: string; ho_ten: string };
/** Nút + hộp "Gia hạn thử": một em hoặc cả nhóm (T29). Lý do bắt buộc; xong thì có Hoàn tác 10 giây. */
export function GiaHan({ em, nhan = "Gia hạn thử", kieu = "secondary", moSan = false, sauXong }: { em: Em[]; nhan?: string; kieu?: KinButtonVariant; moSan?: boolean; sauXong?: () => void }) {
  const [mo, setMo] = useState(moSan);
  const g = useGui();
  function nop(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const lyDo = String(f.get("lyDo") ?? "").trim(), soNgay = Number(f.get("soNgay"));
    if (!lyDo) return g.setLoi("Cần ghi lý do gia hạn — ví dụ “Em bận thi giữa kỳ”.");
    if (!Number.isInteger(soNgay) || soNgay < 1 || soNgay > 60) return g.setLoi("Số ngày gia hạn phải là số nguyên từ 1 đến 60.");
    void g.gui(() => goi("POST", "/api/lop/gia-han", { maHs: em.map((x) => x.ma_hs), soNgay, lyDo }), (k) => {
      setMo(false); sauXong?.();
      const kq = (k.d.ketQua as { den_moi: string }[]) ?? [];
      baoLop({
        chu: em.length === 1 ? `Đã gia hạn thử cho ${em[0].ho_ten}${kq[0] ? ` tới ${ddmm(kq[0].den_moi)}` : ""}` : `Đã gia hạn thử cho ${em.length} em`,
        hoanTac: () => goi("POST", "/api/lop/gia-han/hoan-tac", { nhatKyId: k.d.nhatKyId }), sauHoanTac: () => g.router.refresh(),
      });
    }, em.length > 1 ? " Chưa em nào được gia hạn. Bỏ em này khỏi nhóm rồi thử lại." : "");
  }
  return (
    <>
      <button type="button" data-kin-nut className={kinButtonClass(kieu)} onClick={() => { g.setLoi(null); setMo(true); }}>{nhan}</button>
      <KinDialog open={mo} onClose={() => setMo(false)} title={em.length === 1 ? `Gia hạn thử · ${em[0].ho_ten}` : `Gia hạn thử cho ${em.length} em`}
        footer={<Chan dong={() => setMo(false)} dang={g.dang} nhan={em.length === 1 ? "Gia hạn" : `Gia hạn ${em.length} em`} id="lop-gia-han" />}>
        <form id="lop-gia-han" onSubmit={nop} noValidate className="grid gap-4">
          {em.length > 1 ? <p translate="no" className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)] [overflow-wrap:anywhere]">{em.slice(0, 6).map((x) => x.ho_ten).join(", ")}{em.length > 6 ? ` và ${em.length - 6} em nữa` : ""}</p> : null}
          <label className={KIN_LABEL}>Thêm số ngày
            <input name="soNgay" type="number" inputMode="numeric" min={1} max={60} defaultValue={7} className={`${KIN_FIELD} mt-1 w-28`} />
            <span className={GOI_Y}>Em còn hạn: dời ngày hết thử thêm số ngày này. Em đã hết thử: thử lại từ hôm nay, đủ số ngày này.</span></label>
          <label className={KIN_LABEL}>Lý do <span className="text-[var(--kin-chu-mo)]">(bắt buộc)</span>
            <input name="lyDo" maxLength={300} autoComplete="off" placeholder="Ví dụ: Em bận thi giữa kỳ" className={`${KIN_FIELD} mt-1`} /></label>
          <Loi chu={g.loi} />
        </form>
      </KinDialog>
    </>
  );
}

export type MonHs = { ma: string; ten: string; o: "hoc" | "thu" | "nghi" | null; vuaHetThu: boolean; macDinhCT?: string };
type HoSo = { maHs: string; ten: string; an: boolean; mon: MonHs[]; macDinhNghi: string; mo?: string };
const TEN_O = (m: MonHs) => (m.o === "thu" ? "đang thử" : m.o === "hoc" ? "chính thức" : m.vuaHetThu ? "vừa hết thử" : m.o === "nghi" ? "đã nghỉ" : "chưa ghi danh");

/** Hàng nút ở đầu hồ sơ một em. Nổi bật nhất: "Lên chính thức" khi em đang thử / vừa hết thử. `mo` (từ ?mo= của Hôm nay) mở sẵn một hộp. */
export function HoSoThaoTac(p: HoSo) {
  const thu = p.mon.filter((m) => m.o === "thu"), vuaHet = p.mon.filter((m) => m.vuaHetThu);
  const dangMo = p.mon.filter((m) => m.o === "thu" || m.o === "hoc"), chua = p.mon.filter((m) => m.o === null || m.o === "nghi");
  const [mo, setMo] = useState<string | null>(p.mo ?? null);
  const { ask, dialog } = useKinConfirm();
  const g = useGui();
  const dong = () => setMo(null);
  const coThu = thu.length > 0 || vuaHet.length > 0;

  function chinhThuc(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget), mon = f.getAll("mon").map(String);
    if (!mon.length) return g.setLoi("Chọn ít nhất một môn.");
    void g.gui(() => goi("POST", `/api/lop/hoc-sinh/${p.maHs}/chuyen-chinh-thuc`, { mon, tuNgay: f.get("tuNgay") || undefined, nghiMonThuConLai: f.get("nghiConLai") === "1" }), (k) => {
      dong();
      baoLop({
        chu: `Đã chuyển ${p.ten} lên chính thức ${mon.map((x) => p.mon.find((m) => m.ma === x)?.ten).join(", ")}`,
        hoanTac: () => goi("POST", `/api/lop/hoc-sinh/${p.maHs}/chuyen-chinh-thuc/hoan-tac`, { nhatKyId: k.d.nhatKyId }), sauHoanTac: () => g.router.refresh(),
      });
    });
  }
  function nghi(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget), mon = f.getAll("mon").map(String);
    if (!mon.length) return g.setLoi("Chọn ít nhất một môn.");
    void g.gui(() => goi("POST", `/api/lop/hoc-sinh/${p.maHs}/nghi-mon`, { mon, denNgay: f.get("denNgay") || undefined }), (k) => {
      dong();
      const ten = mon.map((x) => p.mon.find((m) => m.ma === x)?.ten).join(", ");
      // Em đã hết thử: máy chủ chỉ ghi "chủ cho nghỉ", ngày học giữ nguyên ⇒ không báo ngày.
      baoLop({ chu: dangMo.length ? `Đã cho ${p.ten} nghỉ ${ten} · học đến hết ${ddmm(String(k.d.denNgay))}` : `Đã ghi nhận ${p.ten} nghỉ ${ten}` });
    });
  }
  function them(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget), mon = String(f.get("mon") ?? "");
    void g.gui(() => goi("POST", `/api/lop/hoc-sinh/${p.maHs}/ghi-danh`, { mon, loai: f.get("loai"), tuNgay: (f.get("loai") === "chinh_thuc" && f.get("tuNgay")) || undefined }), () => {
      dong();
      baoLop({ chu: `Đã ghi danh ${p.ten} môn ${p.mon.find((m) => m.ma === mon)?.ten} (${f.get("loai") === "chinh_thuc" ? "chính thức" : "học thử"})` });
    });
  }
  async function an() {
    if (!(await ask({ title: `Ẩn hồ sơ ${p.ten}?`, message: `Mọi môn em còn học sẽ dừng (học đến hết ${ddmm(p.macDinhNghi)}). Hồ sơ không bị xoá; bỏ ẩn ngay trong hôm nay thì ghi danh trở lại như cũ.`, confirmLabel: "Ẩn hồ sơ" }))) return;
    void g.gui(() => goi("POST", `/api/lop/hoc-sinh/${p.maHs}/an`, {}), () => baoLop({ chu: `Đã ẩn hồ sơ ${p.ten}` }));
  }
  const boAn = () => void g.gui(() => goi("POST", `/api/lop/hoc-sinh/${p.maHs}/bo-an`), (k) => baoLop({ chu: k.d.khoi_phuc_ghi_danh ? `Đã bỏ ẩn ${p.ten} — ghi danh trở lại như trước khi ẩn` : `Đã bỏ ẩn ${p.ten} — ghi danh vẫn dừng, bấm “Thêm môn” nếu em học lại` }));
  const moHop = (k: string) => { g.setLoi(null); setMo(k); };
  const phu = kinButtonClass("secondary");

  if (p.an) return (
    <div>
      <button type="button" disabled={g.dang} data-kin-nut className={kinButtonClass("primary")} onClick={boAn}>Bỏ ẩn hồ sơ</button>
      <Loi chu={g.loi} />
    </div>
  );
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {coThu ? <button type="button" data-kin-nut className={kinButtonClass("primary")} onClick={() => moHop("chinh-thuc")}>Lên chính thức</button> : null}
        {coThu ? <GiaHan em={[{ ma_hs: p.maHs, ho_ten: p.ten }]} moSan={p.mo === "gia-han"} /> : null}
        {chua.length ? <button type="button" data-kin-nut className={phu} onClick={() => moHop("them")}>{dangMo.length || coThu ? "Thêm môn" : "Ghi danh / học lại"}</button> : null}
        {dangMo.length || vuaHet.length ? <button type="button" data-kin-nut className={phu} onClick={() => moHop("nghi")}>Cho nghỉ</button> : null}
        <button type="button" disabled={g.dang} data-kin-nut className={kinButtonClass("ghost")} onClick={() => void an()}>Ẩn hồ sơ</button>
      </div>
      {mo === null ? <Loi chu={g.loi} /> : null}

      <KinDialog open={mo === "chinh-thuc"} onClose={dong} title={`Lên chính thức · ${p.ten}`} footer={<Chan dong={dong} dang={g.dang} nhan="Lên chính thức" id="lop-chinh-thuc" />}>
        <form id="lop-chinh-thuc" onSubmit={chinhThuc} className="grid gap-4">
          <fieldset><legend className={KIN_LABEL}>Môn lên chính thức</legend>
            {p.mon.filter((m) => m.o !== "hoc").map((m) => (
              <label key={m.ma} className={O_TICH}><input type="checkbox" name="mon" value={m.ma} defaultChecked={thu.length ? m.o === "thu" : m.vuaHetThu} className="size-5" />
                <span>{m.ten} <span className="text-[var(--kin-chu-mo)]">· {TEN_O(m)}{m.o === "thu" && m.macDinhCT ? ` · mặc định từ ${ddmm(m.macDinhCT)}` : ""}</span></span></label>
            ))}
          </fieldset>
          <label className={KIN_LABEL}>Chính thức từ ngày <span className="text-[var(--kin-chu-mo)]">(không bắt buộc)</span>
            <input type="date" name="tuNgay" className={`${KIN_FIELD} mt-1`} />
            <span className={GOI_Y}>Để trống: mỗi môn bắt đầu chính thức ngay sau ngày hết thử. Chọn ngày sớm hơn thì phần thử còn lại được cắt bớt.</span></label>
          {thu.length > 1 ? <label className={O_TICH}><input type="checkbox" name="nghiConLai" value="1" className="size-5" /><span>Cho nghỉ các môn đang thử mà không chọn ở trên</span></label> : null}
          <Loi chu={g.loi} />
        </form>
      </KinDialog>

      <KinDialog open={mo === "nghi"} onClose={dong} title={`Cho nghỉ · ${p.ten}`} footer={<Chan dong={dong} dang={g.dang} nhan="Cho nghỉ" id="lop-nghi" kieu="danger-solid" />}>
        <form id="lop-nghi" onSubmit={nghi} className="grid gap-4">
          <fieldset><legend className={KIN_LABEL}>Môn cho nghỉ</legend>
            {p.mon.filter((m) => m.o === "thu" || m.o === "hoc" || m.vuaHetThu).map((m) => (
              <label key={m.ma} className={O_TICH}><input type="checkbox" name="mon" value={m.ma} defaultChecked={!dangMo.length && m.vuaHetThu} className="size-5" /><span>{m.ten} <span className="text-[var(--kin-chu-mo)]">· {TEN_O(m)}</span></span></label>
            ))}
          </fieldset>
          {dangMo.length ? (
            <label className={KIN_LABEL}>Học đến hết ngày <span className="text-[var(--kin-chu-mo)]">(không bắt buộc)</span>
              <input type="date" name="denNgay" className={`${KIN_FIELD} mt-1`} />
              <span className={GOI_Y}>Để trống: học đến hết {ddmm(p.macDinhNghi)} (trước 22:00 tính đến hôm qua, từ 22:00 tính cả hôm nay).</span></label>
          ) : <p className={GOI_Y}>Em đã hết thử: chỉ ghi nhận “chủ cho nghỉ”, ngày học giữ nguyên. Em sẽ hết khỏi việc “Hết thử – hỏi em”.</p>}
          <Loi chu={g.loi} />
        </form>
      </KinDialog>

      <KinDialog open={mo === "them"} onClose={dong} title={`Ghi danh môn · ${p.ten}`} footer={<Chan dong={dong} dang={g.dang} nhan="Ghi danh" id="lop-them" />}>
        <form id="lop-them" onSubmit={them} className="grid gap-4">
          <label className={KIN_LABEL}>Môn<select name="mon" required className={`${KIN_FIELD} mt-1`}>{chua.map((m) => <option key={m.ma} value={m.ma}>{m.ten} ({TEN_O(m)})</option>)}</select></label>
          <fieldset><legend className={KIN_LABEL}>Loại</legend>
            <label className={O_TICH}><input type="radio" name="loai" value="thu" defaultChecked className="size-5" /><span>Học thử <span className="text-[var(--kin-chu-mo)]">· từ hôm nay, hết cùng ngày với các môn đang thử (nếu có)</span></span></label>
            <label className={O_TICH}><input type="radio" name="loai" value="chinh_thuc" className="size-5" /><span>Chính thức</span></label>
          </fieldset>
          <label className={KIN_LABEL}>Chính thức từ ngày <span className="text-[var(--kin-chu-mo)]">(chỉ khi chọn Chính thức; để trống = mặc định)</span><input type="date" name="tuNgay" className={`${KIN_FIELD} mt-1`} /></label>
          <Loi chu={g.loi} />
        </form>
      </KinDialog>
      {dialog}
    </div>
  );
}

const O_HO_SO = [["hoTen", "Họ tên", "ho_ten"], ["sdtHs", "SĐT học sinh", "sdt_hs"], ["gmail", "Gmail", "gmail"], ["hoTenPh", "Phụ huynh", "ho_ten_ph"], ["sdtPh", "SĐT phụ huynh", "sdt_ph"],
  ["truong", "Trường", "truong"], ["khoi", "Khối", "khoi"], ["mucTieu", "Mục tiêu", "muc_tieu"], ["usernameAzota", "Username Azota", "username_azota"]] as const;
const kieuO = (k: string) => (k.startsWith("sdt") ? { type: "tel", inputMode: "tel" as const, autoComplete: "off" } : k === "gmail" ? { type: "email", inputMode: "email" as const, autoComplete: "off", spellCheck: false } : { autoComplete: "off" });

/** Sửa thông tin hồ sơ (chỉ gửi ô đã đổi; ô để trống = xoá, trừ họ tên). */
export function SuaHoSo({ maHs, hs }: { maHs: string; hs: Record<string, unknown> }) {
  const [mo, setMo] = useState(false);
  const g = useGui();
  function nop(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget), hoSo: Record<string, string> = {};
    for (const [k, , cot] of O_HO_SO) if (String(f.get(k) ?? "").trim() !== String(hs[cot] ?? "")) hoSo[k] = String(f.get(k) ?? "");
    if (!Object.keys(hoSo).length) return setMo(false);
    void g.gui(() => goi("PATCH", `/api/lop/hoc-sinh/${maHs}`, { hoSo }), () => { setMo(false); baoLop({ chu: "Đã lưu thông tin hồ sơ" }); });
  }
  return (
    <>
      <button type="button" data-kin-nut className={kinButtonClass("secondary")} onClick={() => { g.setLoi(null); setMo(true); }}>Sửa thông tin</button>
      <KinDialog open={mo} onClose={() => setMo(false)} title="Sửa thông tin hồ sơ" size="lg" footer={<Chan dong={() => setMo(false)} dang={g.dang} nhan="Lưu" id="lop-sua-ho-so" />}>
        <form id="lop-sua-ho-so" onSubmit={nop} className="grid gap-3 sm:grid-cols-2">
          {O_HO_SO.map(([k, nhan, cot]) => <label key={k} className={`${KIN_LABEL} ${k === "hoTen" || k === "mucTieu" ? "sm:col-span-2" : ""}`}>{nhan}<input name={k} defaultValue={String(hs[cot] ?? "")} maxLength={200} required={k === "hoTen"} {...kieuO(k)} className={`${KIN_FIELD} mt-1`} /></label>)}
          <p className={`${GOI_Y} sm:col-span-2`}>Gmail là địa chỉ em dùng để đăng nhập xem lớp — đổi Gmail là đổi người vào được hồ sơ này.</p>
          <div className="sm:col-span-2"><Loi chu={g.loi} /></div>
        </form>
      </KinDialog>
    </>
  );
}

export function SuaGhiChu({ maHs, ghiChu, ghiChuRieng }: { maHs: string; ghiChu: string | null; ghiChuRieng: string | null }) {
  const [mo, setMo] = useState(false);
  const g = useGui();
  function nop(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void g.gui(() => goi("PATCH", `/api/lop/hoc-sinh/${maHs}`, { ghiChu: f.get("ghiChu"), ghiChuRieng: f.get("ghiChuRieng") }), () => { setMo(false); baoLop({ chu: "Đã lưu ghi chú" }); });
  }
  return (
    <>
      <button type="button" data-kin-nut className={kinButtonClass("secondary")} onClick={() => { g.setLoi(null); setMo(true); }}>Sửa ghi chú</button>
      <KinDialog open={mo} onClose={() => setMo(false)} title="Ghi chú hồ sơ" footer={<Chan dong={() => setMo(false)} dang={g.dang} nhan="Lưu" id="lop-ghi-chu" />}>
        <form id="lop-ghi-chu" onSubmit={nop} className="grid gap-4">
          <label className={KIN_LABEL}>Ghi chú chung<textarea name="ghiChu" defaultValue={ghiChu ?? ""} maxLength={2000} rows={3} className={`${KIN_FIELD} mt-1 py-2`} /></label>
          <label className={KIN_LABEL}>Ghi chú riêng của chủ <span className="text-[var(--kin-chu-mo)]">(giáo viên và học sinh không thấy)</span><textarea name="ghiChuRieng" defaultValue={ghiChuRieng ?? ""} maxLength={2000} rows={3} className={`${KIN_FIELD} mt-1 py-2`} /></label>
          <Loi chu={g.loi} />
        </form>
      </KinDialog>
    </>
  );
}

/** Thêm học sinh mới (hồ sơ tay). Ghi danh môn làm ở hồ sơ em sau khi tạo. */
export function ThemHocSinh() {
  const [mo, setMo] = useState(false);
  const g = useGui();
  function nop(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget), b: Record<string, string> = {};
    for (const [k] of O_HO_SO) if (String(f.get(k) ?? "").trim()) b[k] = String(f.get(k));
    void g.gui(() => goi("POST", "/api/lop/hoc-sinh", b), (k) => {
      setMo(false);
      const trung = (k.d.trung_sdt as string[]) ?? [];
      baoLop({ chu: `Đã tạo hồ sơ ${k.d.ma_hs}${k.d.goi_y_gmail ? ` · Gmail có vẻ gõ nhầm, có phải ${k.d.goi_y_gmail}?` : ""}${trung.length ? ` · SĐT trùng ${trung.join(", ")}` : ""}` });
      g.router.push(`/admin/lop-on/hoc-sinh/${k.d.ma_hs}`);
    });
  }
  return (
    <>
      <button type="button" data-kin-nut className={kinButtonClass("secondary")} onClick={() => { g.setLoi(null); setMo(true); }}>Thêm học sinh</button>
      <KinDialog open={mo} onClose={() => setMo(false)} title="Thêm học sinh" size="lg" footer={<Chan dong={() => setMo(false)} dang={g.dang} nhan="Tạo hồ sơ" id="lop-them-hs" />}>
        <form id="lop-them-hs" onSubmit={nop} className="grid gap-3 sm:grid-cols-2">
          {O_HO_SO.map(([k, nhan]) => <label key={k} className={`${KIN_LABEL} ${k === "hoTen" || k === "mucTieu" ? "sm:col-span-2" : ""}`}>{nhan}{k === "hoTen" ? null : <span className="text-[var(--kin-chu-mo)]"> (không bắt buộc)</span>}<input name={k} maxLength={200} required={k === "hoTen"} {...kieuO(k)} className={`${KIN_FIELD} mt-1`} /></label>)}
          <p className={`${GOI_Y} sm:col-span-2`}>Tạo xong sẽ mở hồ sơ của em để ghi danh môn.</p>
          <div className="sm:col-span-2"><Loi chu={g.loi} /></div>
        </form>
      </KinDialog>
    </>
  );
}

/** Hôm nay: đánh dấu một việc học thử là xong ⇒ ẩn 3 ngày (T33). Hoàn tác = bỏ đánh dấu. */
export function AnViec({ loai, khoa, ten }: { loai: string; khoa: string; ten: string }) {
  const g = useGui();
  return (
    <span>
      <button type="button" disabled={g.dang} data-kin-nut className={kinButtonClass("ghost")} onClick={() => void g.gui(() => goi("POST", "/api/lop/hom-nay/xong", { loai, khoa }), () => baoLop({
        chu: `Đã ẩn ${ten} 3 ngày`, hoanTac: () => goi("DELETE", `/api/lop/hom-nay/xong?loai=${loai}&khoa=${encodeURIComponent(khoa)}`), sauHoanTac: () => g.router.refresh(),
      }))}>Ẩn 3 ngày</button>
      <Loi chu={g.loi} />
    </span>
  );
}

// ---- Chọn nhiều em ở danh sách Học sinh (Figma 9:1044): ô chọn từng hàng + thanh "N em đã chọn · Gia hạn thử · Bỏ chọn". ----
const Chon = createContext<{ chon: Set<string>; dat: (ma: string[], bat: boolean) => void } | null>(null);
export function ChonNhieu({ em, children }: { em: Em[]; children: ReactNode }) {
  const [chon, setChon] = useState<Set<string>>(new Set());
  const dat = (ma: string[], bat: boolean) => setChon((s) => { const n = new Set(s); for (const m of ma) if (bat) n.add(m); else n.delete(m); return n; });
  const ds = em.filter((x) => chon.has(x.ma_hs));
  return (
    <Chon value={{ chon, dat }}>
      {ds.length ? (
        <div role="region" aria-label="Các em đã chọn" className="mt-4 flex flex-wrap items-center gap-2 rounded-[var(--kin-bo-lg)] bg-[var(--kin-nhan-nen-nhat)] px-[var(--kin-kc-6)] py-2">
          <p aria-live="polite" className="mr-auto font-medium tabular-nums text-[length:var(--kin-co-goc)] text-[var(--kin-nhan-chu-tren-nhat)]">{ds.length} em đã chọn</p>
          <GiaHan em={ds} kieu="primary" sauXong={() => setChon(new Set())} />
          <button type="button" data-kin-nut className={kinButtonClass("secondary")} onClick={() => setChon(new Set())}>Bỏ chọn</button>
        </div>
      ) : null}
      {children}
    </Chon>
  );
}
const O_CHON = "inline-flex size-11 shrink-0 cursor-pointer items-center justify-center";
export function OChon({ ma, ten }: { ma: string; ten: string }) {
  const c = use(Chon)!;
  return <label className={O_CHON}><input type="checkbox" checked={c.chon.has(ma)} onChange={(e) => c.dat([ma], e.target.checked)} className="size-5" /><span className="sr-only">Chọn {ten}</span></label>;
}
export function OChonTatCa({ ma }: { ma: string[] }) {
  const c = use(Chon)!;
  const het = ma.length > 0 && ma.every((m) => c.chon.has(m));
  return <label className={O_CHON}><input type="checkbox" checked={het} onChange={(e) => c.dat(ma, e.target.checked)} className="size-5" /><span className="sr-only">Chọn tất cả em trên trang này</span></label>;
}
