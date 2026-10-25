// HP-18/HP-19 — "Thêm phí khác" ngay trong chi tiết lớp (tài liệu, quỹ lớp, phí thi…): mỗi em một dòng phí, vào phiếu tháng đó
// hoặc gộp vào phiếu nháp ("Gộp khoản rời"). Dùng cho MỌI lớp (kể cả lớp cách cũ): chỉ thêm một dòng cô chủ động nhập, không đổi cách tính nào.
// Số tiền nhân theo số em do MÁY CHỦ tính; ở đây chỉ hiển thị kết quả trả về.
"use client";
import { useCallback, useEffect, useState } from "react";
import { KinButton } from "@/components/kin";
import { KinSectionHead } from "@/components/kin/SectionHead";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { KIN_FIELD, KIN_LABEL } from "@/components/kin/PageLayout";
import { callApi, useNotify } from "@/components/tutor/shared";
import { EXTRA_LABEL_MAX } from "@/lib/tuitionFee";

const vnd = (n: number) => `${n.toLocaleString("vi-VN")}đ`;
const dmy = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}/${k.slice(0, 4)}`;
interface Item { id: string; label: string | null; amount: number; dateKey: string; studentName: string; invoiced: boolean }

export default function LopPhiKhac({ courseId }: { courseId: string }) {
  const notify = useNotify();
  const [items, setItems] = useState<Item[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [dateKey, setDateKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmAdd, setConfirmAdd] = useState(false);

  useEffect(() => {
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFailed(false);
    callApi<{ items: Item[]; today: string }>(`/api/courses/${courseId}/extra-fees`).then(r => {
      if (!alive) return;
      if (!r.ok) setFailed(true); else { setItems(r.data.items); setDateKey(k => k || r.data.today); }
    });
    return () => { alive = false; };
  }, [courseId, tick]);
  const reload = useCallback(() => setTick(t => t + 1), []);

  async function add() {
    setBusy(true); setErr(null);
    const r = await callApi<{ created: number; skippedDuplicate: number; total: number; error?: string }>(`/api/courses/${courseId}/extra-fees`, {
      method: "POST", body: JSON.stringify({ action: "add", label, amount: Number(amount), dateKey }),
    });
    setBusy(false); setConfirmAdd(false);
    if (!r.ok) { setErr(r.data.error ?? "Không thêm được khoản phí"); return; }
    notify.ok(r.data.created > 0 ? `Đã thêm khoản phí cho ${r.data.created} em, tổng ${vnd(r.data.total)}.` : "Khoản phí này đã có cho cả lớp, không thêm lần hai.");
    setLabel(""); setAmount(""); reload();
  }
  async function remove(id: string) {
    const r = await callApi<{ error?: string }>(`/api/courses/${courseId}/extra-fees`, { method: "POST", body: JSON.stringify({ action: "remove", chargeId: id }) });
    if (!r.ok) notify.err(r.data.error ?? "Không gỡ được"); else { notify.ok("Đã gỡ khoản phí."); reload(); }
  }

  return (
    <section aria-labelledby="pk-t" className="max-w-3xl">
      <KinSectionHead id="pk-t" title="Phí khác của lớp" aside="Tài liệu, quỹ lớp, phí thi" />
      <p className="pt-4 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">
        Khoản phí áp cho mọi em đang học lớp này, mỗi em một dòng trong phiếu. Phiếu đã chốt không đổi: khoản thêm sau sẽ chờ ở “Gộp khoản rời” trên phiếu nháp hoặc vào phiếu tháng sau.
      </p>
      <div className="pt-5 grid sm:grid-cols-3 gap-5">
        <label className={KIN_LABEL}>Tên khoản phí
          <input value={label} maxLength={EXTRA_LABEL_MAX} onChange={e => { setLabel(e.target.value); setConfirmAdd(false); }} placeholder="Ví dụ: Tài liệu học kỳ 1" className={`${KIN_FIELD} mt-2`} />
        </label>
        <label className={KIN_LABEL}>Số tiền mỗi em (đ)
          <input inputMode="numeric" value={amount} onChange={e => { setAmount(e.target.value.replace(/[^\d]/g, "")); setConfirmAdd(false); }} className={`${KIN_FIELD} mt-2`} />
        </label>
        <label className={KIN_LABEL}>Ngày phát sinh
          <input type="date" value={dateKey} onChange={e => { setDateKey(e.target.value); setConfirmAdd(false); }} className={`${KIN_FIELD} mt-2`} />
        </label>
      </div>
      {err && <p role="alert" className="pt-3 text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi)]">{err}</p>}
      <div className="pt-4 flex gap-2 flex-wrap items-center">
        {!confirmAdd
          ? <KinButton variant="secondary" disabled={!label.trim() || !amount} onClick={() => setConfirmAdd(true)}>Thêm cho cả lớp…</KinButton>
          : <>
              <span role="status" className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">Thêm “{label.trim()}” {vnd(Number(amount))} cho mỗi em đang học lớp?</span>
              <KinButton variant="ghost" onClick={() => setConfirmAdd(false)}>Giữ nguyên</KinButton>
              <KinButton loading={busy} onClick={() => void add()}>Xác nhận thêm</KinButton>
            </>}
      </div>
      <div className="pt-6">
        {failed ? (
          <div role="alert" className="text-[length:var(--kin-co-goc)]">Không tải được danh sách. <button className="underline font-medium text-[var(--kin-nhan-link)] min-h-11 px-2" onClick={reload}>Thử lại</button></div>
        ) : items === null ? (
          <div aria-busy="true" aria-label="Đang tải phí khác" className="h-16 rounded kin-skel kin-skel--soft" />
        ) : items.length === 0 ? (
          <KinEmptyState title="Chưa có khoản phí khác nào">Khi cô thêm tài liệu, quỹ lớp hoặc phí thi, từng khoản sẽ hiện ở đây.</KinEmptyState>
        ) : (
          <ul className="border-t border-[var(--kin-vien-nhat)]">
            {items.map(i => (
              <li key={i.id} className="py-3 border-b border-[var(--kin-vien-nhat)] flex items-center justify-between gap-3 flex-wrap text-[length:var(--kin-co-goc)]">
                <span className="text-[var(--kin-chu-chinh)]">{i.label} · {i.studentName} · {dmy(i.dateKey)}</span>
                <span className="tabular-nums text-[var(--kin-chu-chinh)]">{vnd(i.amount)}</span>
                <span className="text-[var(--kin-chu-mo)]">{i.invoiced ? "Đã vào phiếu" : "Chưa vào phiếu"}</span>
                {!i.invoiced && <KinButton variant="ghost" onClick={() => void remove(i.id)}>Gỡ khoản này</KinButton>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
