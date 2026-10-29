// Lịch RIÊNG của học sinh (NC2-043): hook tải việc riêng của một khoảng ngày + form thêm / sửa. Dùng ở trang Lịch học (components/student/LichHoc).
// Việc riêng là thứ CHÍNH học sinh gõ cho mình; chỉ mình em thấy (API lọc theo phiên), không gửi cho gia sư / phụ huynh / AI, không đổi lịch lớp.
// Kiểm dữ liệu ở trình duyệt dùng ĐÚNG hàm của máy chủ (src/lib/personalEvents.ts) nên hai bên báo cùng một lỗi.
"use client";
import { useCallback, useEffect, useState } from "react";
import { cleanPersonalEvent, PERSONAL_NOTE_MAX, PERSONAL_TITLE_MAX, type PersonalEventDTO } from "@/lib/personalEvents";
import { kinButtonClass } from "@/components/kin/Button";
import { KIN_FIELD, KIN_LABEL } from "@/components/kin/PageLayout";

/** Việc riêng trong [from, to] (YYYY-MM-DD, tối đa 62 ngày). `list` là null cho tới khi tải xong khoảng HIỆN TẠI (không dùng nhầm kết quả của tuần trước). */
export function usePersonalEvents(from: string, to: string) {
  const [state, setState] = useState<{ key: string; list: PersonalEventDTO[] } | null>(null);
  const [failedKey, setFailedKey] = useState("");
  const [tick, setTick] = useState(0);
  const key = from && to ? `${from}|${to}` : "";
  useEffect(() => {
    if (!key) return;
    let live = true;
    fetch(`/api/student/lich-rieng?from=${from}&to=${to}`, { credentials: "same-origin", cache: "no-store" })
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: { events?: PersonalEventDTO[] }) => { if (live) setState({ key, list: Array.isArray(d.events) ? d.events : [] }); })
      .catch(() => { if (live) setFailedKey(key); });
    return () => { live = false; };
  }, [key, from, to, tick]);
  const list = state && state.key === key ? state.list : null;
  const reload = useCallback(() => { setFailedKey(""); setTick(t => t + 1); }, []);
  return { list, error: !!key && failedKey === key && list === null, reload };
}

export interface PersonalFormInitial { id?: string; title: string; dateKey: string; startTime: string; endTime: string; note: string }

/** Form thêm (không có `initial.id`) hoặc sửa (có id) một việc riêng. `onSaved` nhận việc đã lưu để trang nhảy tới đúng tuần. */
export function PersonalForm({ initial, todayKey, onSaved, onCancel }: {
  initial: PersonalFormInitial;
  todayKey: string;
  onSaved: (e: PersonalEventDTO) => void;
  onCancel: () => void;
}) {
  const [v, setV] = useState(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const editing = !!initial.id;
  const set = (k: keyof PersonalFormInitial) => (e: { target: { value: string } }) => setV(p => ({ ...p, [k]: e.target.value }));

  async function submit(e: { preventDefault: () => void }) {
    e.preventDefault();
    if (busy) return;
    const body = { title: v.title, dateKey: v.dateKey, startTime: v.startTime, endTime: v.endTime || null, note: v.note || null };
    const c = cleanPersonalEvent(body, todayKey);
    if (!c.ok) { setError(c.error); return; }
    setBusy(true); setError("");
    try {
      const res = await fetch(editing ? `/api/student/lich-rieng/${initial.id}` : "/api/student/lich-rieng", {
        method: editing ? "PATCH" : "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(c.value),
      });
      const d = await res.json().catch(() => ({}));
      // 4xx = máy chủ giải thích dữ liệu sai (hiện nguyên văn); 5xx / không có thân hợp lệ = lỗi của KiN, hiện câu chung và GIỮ nguyên những gì em đang gõ.
      if (!res.ok || !d.event) { setError(res.status >= 400 && res.status < 500 && typeof d.error === "string" ? d.error : "Chưa lưu được, thử lại nhé."); return; }
      onSaved(d.event as PersonalEventDTO);
    } catch {
      setError("Chưa lưu được, kiểm tra mạng rồi thử lại nhé.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} data-personal-form noValidate aria-label={editing ? "Sửa việc riêng" : "Thêm việc riêng"}
      className="mt-2 mb-6 rounded-[var(--kin-bo-the)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-trang)] p-[var(--kin-kc-8)]">
      <h2 className="text-[length:var(--kin-co-tieu-de)] leading-6 font-medium text-[var(--kin-chu-chinh)]">{editing ? "Sửa việc riêng" : "Thêm việc riêng"}</h2>
      <p className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Chỉ mình bạn thấy việc này. Gia sư và phụ huynh không thấy, lịch của lớp không đổi.</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="block md:col-span-2">
          <span className={KIN_LABEL}>Tên việc</span>
          <input id="pe-title" name="title" value={v.title} onChange={set("title")} maxLength={PERSONAL_TITLE_MAX} placeholder="Ví dụ: Học thêm Toán ở trung tâm" className={`${KIN_FIELD} mt-1`} />
        </label>
        <label className="block">
          <span className={KIN_LABEL}>Ngày</span>
          <input id="pe-date" name="dateKey" type="date" value={v.dateKey} onChange={set("dateKey")} className={`${KIN_FIELD} mt-1`} />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className={KIN_LABEL}>Giờ bắt đầu</span>
            <input id="pe-start" name="startTime" type="time" value={v.startTime} onChange={set("startTime")} className={`${KIN_FIELD} mt-1`} />
          </label>
          <label className="block">
            <span className={KIN_LABEL}>Giờ kết thúc (không bắt buộc)</span>
            <input id="pe-end" name="endTime" type="time" value={v.endTime} onChange={set("endTime")} className={`${KIN_FIELD} mt-1`} />
          </label>
        </div>
        <label className="block md:col-span-2">
          <span className={KIN_LABEL}>Ghi chú (không bắt buộc)</span>
          <textarea id="pe-note" name="note" value={v.note} onChange={set("note")} maxLength={PERSONAL_NOTE_MAX} rows={3} className={`${KIN_FIELD} mt-1 py-2`} />
        </label>
      </div>
      {error && <p role="alert" data-personal-error className="mt-3 text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi)]">{error}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy} className={kinButtonClass("primary")}>{busy ? "Đang lưu…" : "Lưu"}</button>
        <button type="button" onClick={onCancel} className={kinButtonClass("secondary")}>Huỷ</button>
      </div>
    </form>
  );
}
