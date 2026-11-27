"use client";
// Thao tác GHI trên buổi học của chủ lớp (KiN lớp bước 5): sửa nội dung / record, huỷ / bỏ huỷ, xoá buổi tương lai + Hoàn tác 10 giây, thêm học bù, sinh buổi còn thiếu.
// Luật nằm ở máy chủ (src/lib/lop/server/buoi-hoc.ts); ở đây chỉ gọi /api/lop/buoi-hoc/* rồi tải lại trang. Lỗi máy chủ hiện nguyên câu ngay cạnh nút.
import { KinSelect } from "@/components/kin/KinSelect";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { KIN_FIELD, KIN_LABEL, kinButtonClass, useKinConfirm } from "@/components/kin";
import { goi, Loi, TOM, type Kq } from "./goi";


export type BuoiSua = { id: number; ten: string; huy: boolean; tuong_lai: boolean; noi_dung: string | null; link_record: string | null; ghi_chu: string | null };

/** Một hàng buổi: "Sửa" mở ngăn nội dung / record / ghi chú + huỷ hoặc bỏ huỷ + xoá (chỉ buổi chưa bắt đầu). */
export function BuoiThaoTac({ b }: { b: BuoiSua }) {
  const router = useRouter();
  const { ask, dialog } = useKinConfirm();
  const [dang, setDang] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);
  const [daXoa, setDaXoa] = useState<number | null>(null); // nhatKyId để hoàn tác

  // Sau khi xoá: giữ hàng 10 giây cho Hoàn tác rồi mới tải lại danh sách.
  useEffect(() => { if (daXoa === null) return; const t = setTimeout(() => router.refresh(), 10_000); return () => clearTimeout(t); }, [daXoa, router]);

  async function chay(f: () => Promise<Kq>, xong?: (k: Kq) => void) {
    setDang(true); setLoi(null);
    const k = await f();
    setDang(false);
    if (!k.ok) return setLoi(k.d.error ?? "Không lưu được");
    if (xong) xong(k); else router.refresh();
  }
  function luu(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void chay(() => goi("PATCH", `/api/lop/buoi-hoc/${b.id}`, { noiDung: f.get("noiDung"), linkRecord: f.get("linkRecord"), ghiChu: f.get("ghiChu") }));
  }
  async function huy(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const lyDo = String(new FormData(e.currentTarget).get("lyDo") ?? "");
    setDang(true); setLoi(null);
    let k = await goi("POST", `/api/lop/buoi-hoc/${b.id}/huy`, { lyDo });
    // Buổi đã có điểm danh: máy chủ đòi xác nhận lần nữa (điểm danh vẫn giữ).
    if (k.status === 409 && k.d.ma === "can_xac_nhan" && (await ask({ title: "Huỷ buổi đã có điểm danh?", message: k.d.error, confirmLabel: "Vẫn huỷ buổi", cancelLabel: "Để nguyên" }))) k = await goi("POST", `/api/lop/buoi-hoc/${b.id}/huy`, { lyDo, xacNhan: true });
    setDang(false);
    if (!k.ok) return setLoi(k.d.ma === "can_xac_nhan" ? null : k.d.error ?? "Không lưu được");
    router.refresh();
  }
  async function xoa() {
    if (!(await ask({ title: `Xoá buổi ${b.ten}?`, message: "Chỉ xoá được buổi chưa bắt đầu và chưa có dữ liệu. Có 10 giây để hoàn tác.", confirmLabel: "Xoá buổi" }))) return;
    void chay(() => goi("DELETE", `/api/lop/buoi-hoc/${b.id}`), (k) => setDaXoa(Number(k.d.nhatKyId)));
  }

  if (daXoa !== null) return (
    <p role="status" className="flex flex-wrap items-center gap-2 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]">Đã xoá buổi này.
      <button type="button" disabled={dang} data-kin-nut className={kinButtonClass("secondary")} onClick={() => void chay(() => goi("POST", `/api/lop/buoi-hoc/${b.id}/hoan-tac-xoa`, { nhatKyId: daXoa }), () => { setDaXoa(null); router.refresh(); })}>Hoàn tác</button>
      <Loi chu={loi} />
    </p>
  );
  return (
    <details className="w-full">
      <summary className={TOM}>Sửa buổi</summary>
      <div className="mt-2 grid gap-4 rounded-[var(--kin-bo-lg)] bg-[var(--kin-nen-bang)] p-4">
        <form onSubmit={luu} className="grid gap-3">
          <label className={KIN_LABEL}>Nội dung buổi học<textarea name="noiDung" defaultValue={b.noi_dung ?? ""} maxLength={2000} rows={2} className={`${KIN_FIELD} mt-1 py-2`} /></label>
          <label className={KIN_LABEL}>Link record<input name="linkRecord" defaultValue={b.link_record ?? ""} inputMode="url" autoComplete="off" spellCheck={false} placeholder="https://…" className={`${KIN_FIELD} mt-1`} /></label>
          <label className={KIN_LABEL}>Ghi chú nội bộ <span className="text-[var(--kin-chu-mo)]">(học sinh không thấy)</span><input name="ghiChu" defaultValue={b.ghi_chu ?? ""} maxLength={500} className={`${KIN_FIELD} mt-1`} /></label>
          <div><button type="submit" disabled={dang} data-kin-nut className={kinButtonClass("primary")}>Lưu</button></div>
        </form>
        {b.huy ? (
          <div><button type="button" disabled={dang} data-kin-nut className={kinButtonClass("secondary")} onClick={() => void chay(() => goi("POST", `/api/lop/buoi-hoc/${b.id}/bo-huy`))}>Bỏ huỷ buổi</button></div>
        ) : (
          <form onSubmit={(e) => void huy(e)} className="flex flex-wrap items-end gap-2 border-t border-[var(--kin-vien-thuong)] pt-4">
            <label className={`${KIN_LABEL} min-w-0 flex-1 basis-56`}>Lý do huỷ buổi<input name="lyDo" required maxLength={300} className={`${KIN_FIELD} mt-1`} /></label>
            <button type="submit" disabled={dang} data-kin-nut className={kinButtonClass("danger")}>Huỷ buổi</button>
            {b.tuong_lai ? <button type="button" disabled={dang} data-kin-nut className={kinButtonClass("danger")} onClick={() => void xoa()}>Xoá buổi</button> : null}
          </form>
        )}
        <Loi chu={loi} />
      </div>
      {dialog}
    </details>
  );
}

/** Đầu trang Buổi học: thêm học bù + sinh buổi theo lịch còn thiếu của tháng đang xem (xem trước rồi mới ghi). */
export function BuoiCongCu({ thang, mon }: { thang: string; mon: { ma: string; ten: string }[] }) {
  const router = useRouter();
  const { ask, dialog } = useKinConfirm();
  const [dang, setDang] = useState(false);
  const [bao, setBao] = useState<{ loi: boolean; chu: string } | null>(null);

  async function conThieu() {
    setDang(true); setBao(null);
    const xem = await goi("GET", `/api/lop/buoi-hoc/con-thieu?thang=${thang}`);
    if (!xem.ok) { setDang(false); return setBao({ loi: true, chu: xem.d.error ?? "Không xem trước được" }); }
    const buoi = (xem.d.buoi as { mon: string; ngay: string; gio: string }[]) ?? [];
    const qua = Number(xem.d.bo_qua_da_qua ?? 0);
    if (!buoi.length) { setDang(false); return setBao({ loi: false, chu: `Tháng ${thang.slice(5)}/${thang.slice(0, 4)} không thiếu buổi theo lịch nào${qua ? ` (bỏ qua ${qua} ngày đã qua)` : ""}.` }); }
    const ok = await ask({ title: `Sinh ${buoi.length} buổi còn thiếu?`, tone: "thuong", confirmLabel: "Sinh buổi", message: buoi.map((x) => `${mon.find((m) => m.ma === x.mon)?.ten ?? x.mon} ${x.ngay.slice(8)}/${x.ngay.slice(5, 7)} ${x.gio}`).join(" · ") });
    if (!ok) return setDang(false);
    const k = await goi("POST", "/api/lop/buoi-hoc/con-thieu", { thang });
    setDang(false);
    setBao(k.ok ? { loi: false, chu: `Đã sinh ${k.d.tao_moi} buổi.` } : { loi: true, chu: k.d.error ?? "Không sinh được" });
    if (k.ok) router.refresh();
  }
  async function hocBu(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setDang(true); setBao(null);
    const k = await goi("POST", "/api/lop/buoi-hoc/hoc-bu", { mon: f.get("mon"), ngay: f.get("ngay"), gio: f.get("gio") || undefined, soPhut: f.get("soPhut") ? Number(f.get("soPhut")) : undefined });
    setDang(false);
    if (!k.ok) return setBao({ loi: true, chu: k.d.error ?? "Không thêm được" });
    const cb = (k.d.canh_bao as string[]) ?? [];
    setBao({ loi: false, chu: `Đã thêm buổi học bù.${cb.length ? ` Lưu ý: ${cb.join("; ")}.` : ""}` });
    router.refresh();
  }
  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-start gap-2">
        <details className="min-w-0 flex-1 basis-72">
          <summary className={TOM}>Thêm học bù</summary>
          <form onSubmit={(e) => void hocBu(e)} className="mt-2 flex flex-wrap items-end gap-3 rounded-[var(--kin-bo-lg)] bg-[var(--kin-nen-bang)] p-4">
            <label className={KIN_LABEL}>Môn<KinSelect name="mon" required className={`${KIN_FIELD} mt-1`}>{mon.map((m) => <option key={m.ma} value={m.ma}>{m.ten}</option>)}</KinSelect></label>
            <label className={KIN_LABEL}>Ngày<input type="date" name="ngay" required className={`${KIN_FIELD} mt-1`} /></label>
            <label className={KIN_LABEL}>Giờ bắt đầu<input type="time" name="gio" defaultValue="22:15" className={`${KIN_FIELD} mt-1`} /></label>
            <label className={KIN_LABEL}>Số phút<input type="number" name="soPhut" defaultValue={90} min={15} max={300} className={`${KIN_FIELD} mt-1 w-24`} /></label>
            <button type="submit" disabled={dang} data-kin-nut className={kinButtonClass("primary")}>Thêm buổi</button>
          </form>
        </details>
        <button type="button" disabled={dang} data-kin-nut className={kinButtonClass("secondary")} onClick={() => void conThieu()}>Sinh buổi còn thiếu tháng {thang.slice(5)}</button>
      </div>
      {bao ? <p role={bao.loi ? "alert" : "status"} className={`mt-2 text-[length:var(--kin-co-goc)] ${bao.loi ? "text-[var(--kin-tt-chu-loi-dam)]" : "text-[var(--kin-chu-phu)]"}`}>{bao.chu}</p> : null}
      {dialog}
    </div>
  );
}
