"use client";
// Phân công giáo viên của Lớp ôn (KiN lớp bước 6, chỉ chủ lớp): chọn môn cho một giáo viên KiN, khoá / mở khoá dòng lớp.
// KHÔNG tạo người dùng KiN, không đổi mật khẩu. Luật ở src/lib/lop/server/giao-vien.ts.
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { KinDialog, kinButtonClass, useKinConfirm } from "@/components/kin";
import { baoLop, goi, Loi } from "./goi";

export type Gv = { userId: string | null; ten: string; email: string; lop: { id: string; khoa: boolean; mon: string[] } | null };

export function GiaoVienThaoTac({ gv, mon }: { gv: Gv; mon: { ma: string; ten_ngan: string }[] }) {
  const router = useRouter();
  const { ask, dialog } = useKinConfirm();
  const [mo, setMo] = useState(false);
  const [dang, setDang] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);
  const id = `lop-phan-cong-${gv.lop?.id ?? gv.userId}`;

  async function luu(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const chon = new FormData(e.currentTarget).getAll("mon").map(String);
    setDang(true); setLoi(null);
    const k = gv.lop ? await goi("PATCH", `/api/lop/giao-vien/${gv.lop.id}`, { mon: chon }) : await goi("POST", "/api/lop/giao-vien", { userId: gv.userId, mon: chon });
    setDang(false);
    if (!k.ok) return setLoi(k.d.error ?? "Không lưu được");
    setMo(false);
    const hs = (k.d.trung_ho_so_hs as string[] | undefined) ?? [];
    baoLop({ chu: `${gv.ten}: ${chon.length ? `dạy ${chon.map((m) => mon.find((x) => x.ma === m)?.ten_ngan).join(", ")}` : "không còn môn nào"}${hs.length ? ` · Gmail này cũng ghi trên hồ sơ ${hs.join(", ")}` : ""}` });
    router.refresh();
  }
  async function khoa(bat: boolean) {
    if (bat && !(await ask({ title: `Khoá ${gv.ten} khỏi Lớp ôn?`, message: "Giáo viên này sẽ không xem, không điểm danh được ở Lớp ôn cho tới khi mở khoá. Tài khoản KiN của họ không bị đụng tới.", confirmLabel: "Khoá" }))) return;
    setDang(true); setLoi(null);
    const k = await goi("POST", `/api/lop/giao-vien/${gv.lop!.id}/khoa`, { khoa: bat });
    setDang(false);
    if (!k.ok) return setLoi(k.d.error ?? "Không lưu được");
    baoLop({ chu: bat ? `Đã khoá ${gv.ten} khỏi Lớp ôn` : `Đã mở khoá ${gv.ten}` });
    router.refresh();
  }
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button type="button" data-kin-nut className={kinButtonClass("secondary")} onClick={() => { setLoi(null); setMo(true); }}>{gv.lop ? "Sửa môn" : "Đưa vào lớp"}</button>
        {gv.lop ? <button type="button" disabled={dang} data-kin-nut className={kinButtonClass(gv.lop.khoa ? "secondary" : "ghost")} onClick={() => void khoa(!gv.lop!.khoa)}>{gv.lop.khoa ? "Mở khoá" : "Khoá"}</button> : null}
      </div>
      {mo ? null : <Loi chu={loi} />}
      <KinDialog open={mo} onClose={() => setMo(false)} title={`Môn phụ trách · ${gv.ten}`}
        footer={<><button type="button" data-kin-nut className={kinButtonClass("secondary")} onClick={() => setMo(false)}>Huỷ</button><button type="submit" form={id} disabled={dang} data-kin-nut className={kinButtonClass("primary")}>{dang ? "Đang lưu…" : "Lưu"}</button></>}>
        <form id={id} onSubmit={(e) => void luu(e)} className="grid gap-3">
          <fieldset><legend className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]">Giáo viên chỉ thấy và điểm danh được các môn được tích.</legend>
            {mon.map((m) => <label key={m.ma} className="flex min-h-11 items-center gap-3 text-[length:var(--kin-co-goc)]"><input type="checkbox" name="mon" value={m.ma} defaultChecked={gv.lop?.mon.includes(m.ma)} className="size-5" />{m.ten_ngan}</label>)}
          </fieldset>
          <p translate="no" className="text-[length:var(--kin-co-phu)] text-[var(--kin-chu-mo)] [overflow-wrap:anywhere]">Đăng nhập KiN bằng {gv.email}</p>
          <Loi chu={loi} />
        </form>
      </KinDialog>
      {dialog}
    </div>
  );
}
