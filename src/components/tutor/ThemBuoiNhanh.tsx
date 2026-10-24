// LI-11 / LI-10 / LI-16 / LI-17 — ngăn kéo "Thêm buổi nhanh": buổi lẻ, dạy bù, phát sinh. Buổi hiện trên Lịch ngay sau khi lưu.
// Kiểm xung đột lịch trước khi lưu: có xung đột thì hiện danh sách (chỉ SỐ em chung, không tên em) và cho chọn "Vẫn thêm".
// Không đụng tiền: thêm buổi không tạo học phí; học phí chỉ sinh khi điểm danh, theo cách tính của lớp, như mọi buổi khác.
"use client";
import { useEffect, useRef, useState } from "react";
import { KinButton } from "@/components/kin";
import { KIN_FIELD, KIN_LABEL } from "@/components/kin/PageLayout";
import { callApi } from "@/components/tutor/shared";
import { KIND_LABEL, MODE_LABEL, SESSION_MODES, type SessionKind } from "@/lib/sessionBook";

export interface QuickAddDefaults { courseId?: string; dateKey?: string; startTime?: string; endTime?: string; kind?: Exclude<SessionKind, "regular"> }
export interface QuickAddCourse { id: string; name: string }
interface Conflict { kind: string; text: string }

const KINDS: Exclude<SessionKind, "regular">[] = ["extra", "makeup", "adhoc"];
const KIND_HINT: Record<Exclude<SessionKind, "regular">, string> = {
  extra: "Một buổi riêng lẻ ngoài lịch tuần.",
  makeup: "Dạy bù cho buổi đã nghỉ. Khi điểm danh buổi này, tick “Dùng 1 buổi bù” cho em được bù.",
  adhoc: "Buổi phát sinh đột xuất (ôn thi, giải đáp…).",
};

export default function ThemBuoiNhanh({ courses, defaults, onClose, onCreated }: {
  courses: QuickAddCourse[]; defaults?: QuickAddDefaults; onClose: () => void; onCreated: (info: { courseId: string; dateKey: string }) => void;
}) {
  const [courseId, setCourseId] = useState(defaults?.courseId ?? courses[0]?.id ?? "");
  const [kind, setKind] = useState<Exclude<SessionKind, "regular">>(defaults?.kind ?? "extra");
  const [dateKey, setDateKey] = useState(defaults?.dateKey ?? "");
  const [start, setStart] = useState(defaults?.startTime ?? "19:00");
  const [end, setEnd] = useState(defaults?.endTime ?? "20:30");
  const [mode, setMode] = useState<"" | "online" | "offline">("");
  const [location, setLocation] = useState("");
  const [joinUrl, setJoinUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [conflicts, setConflicts] = useState<Conflict[] | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    boxRef.current?.querySelector<HTMLElement>("select, input, button")?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeRef.current(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, []);

  async function submit(force: boolean) {
    if (busy) return;
    if (!courseId) { setError("Chọn lớp trước."); return; }
    setBusy(true); setError("");
    const r = await callApi<{ id: string; dateKey: string; conflicts?: Conflict[]; needsConfirm?: boolean }>(`/api/courses/${courseId}/sessions`, {
      method: "POST", body: JSON.stringify({ dateKey, startTime: start, endTime: end, kind, mode: mode || null, location: mode === "offline" ? location : null, joinUrl: joinUrl || null, force }),
    });
    setBusy(false);
    if (!r.ok) {
      if (r.status === 409 && r.data.needsConfirm) { setConflicts(r.data.conflicts ?? []); return; }
      setError(r.data.error ?? "Chưa thêm được buổi, thử lại nhé."); return;
    }
    onCreated({ courseId, dateKey });
  }

  return (
    <div className="fixed inset-0 z-[150] flex justify-end" style={{ background: "rgba(15,23,42,0.5)" }} onClick={() => !busy && onClose()} role="dialog" aria-modal="true" aria-labelledby="them-buoi-tt">
      <div ref={boxRef} onClick={e => e.stopPropagation()} className="w-full sm:max-w-md h-full overflow-y-auto p-5 space-y-4" style={{ background: "var(--kin-nen-trang)", borderLeft: "1px solid var(--kin-vien-thuong)" }}>
        <div className="flex items-start justify-between gap-3">
          <h2 id="them-buoi-tt" className="text-base font-bold text-[var(--kin-chu-chinh)]">Thêm buổi nhanh</h2>
          <KinButton variant="ghost" onClick={onClose} aria-label="Đóng ngăn kéo">Đóng</KinButton>
        </div>

        {courses.length === 0 ? <p className="text-[var(--kin-chu-mo)]">Bạn chưa có lớp nào để thêm buổi.</p> : (<>
          <div role="radiogroup" aria-label="Loại buổi" className="grid grid-cols-3 gap-2">
            {KINDS.map(k => (
              <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)}
                className="min-h-11 rounded-[var(--kin-bo-md)] border text-[length:var(--kin-co-goc)] font-medium"
                style={kind === k ? { background: "var(--kin-nhan-nen)", color: "var(--kin-nhan-chu-tren-nen)", borderColor: "transparent" } : { background: "var(--kin-nen-trang)", color: "var(--kin-chu-chinh)", borderColor: "var(--kin-vien-o-nhap)" }}>
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
          <p className="text-[length:var(--kin-co-phu)] text-[var(--kin-chu-mo)]">{KIND_HINT[kind]}</p>

          <div>
            <label htmlFor="tb-lop" className={KIN_LABEL}>Lớp</label>
            <select id="tb-lop" value={courseId} onChange={e => { setCourseId(e.target.value); setConflicts(null); }} className={`${KIN_FIELD} mt-2`}>
              {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1"><label htmlFor="tb-ngay" className={KIN_LABEL}>Ngày</label>
              <input id="tb-ngay" type="date" value={dateKey} onChange={e => { setDateKey(e.target.value); setConflicts(null); }} className={`${KIN_FIELD} mt-2`} /></div>
            <div><label htmlFor="tb-bd" className={KIN_LABEL}>Bắt đầu</label>
              <input id="tb-bd" type="time" value={start} onChange={e => { setStart(e.target.value); setConflicts(null); }} className={`${KIN_FIELD} mt-2`} /></div>
            <div><label htmlFor="tb-kt" className={KIN_LABEL}>Kết thúc</label>
              <input id="tb-kt" type="time" value={end} onChange={e => { setEnd(e.target.value); setConflicts(null); }} className={`${KIN_FIELD} mt-2`} /></div>
          </div>
          <div>
            <label htmlFor="tb-mode" className={KIN_LABEL}>Hình thức (không bắt buộc)</label>
            <select id="tb-mode" value={mode} onChange={e => setMode(e.target.value as typeof mode)} className={`${KIN_FIELD} mt-2`}>
              <option value="">Chưa chọn</option>
              {SESSION_MODES.map(m => <option key={m} value={m}>{MODE_LABEL[m]}</option>)}
            </select>
          </div>
          {mode === "offline" && (
            <div><label htmlFor="tb-loc" className={KIN_LABEL}>Địa chỉ học offline</label>
              <input id="tb-loc" value={location} maxLength={300} onChange={e => setLocation(e.target.value)} className={`${KIN_FIELD} mt-2`} /></div>
          )}
          {mode !== "offline" && (
            <div><label htmlFor="tb-url" className={KIN_LABEL}>Link học online riêng buổi này (không bắt buộc)</label>
              <input id="tb-url" type="url" value={joinUrl} onChange={e => setJoinUrl(e.target.value)} placeholder="https://meet.google.com/…" className={`${KIN_FIELD} mt-2`} />
              <p className="mt-1 text-[length:var(--kin-co-phu)] text-[var(--kin-chu-mo)]">Để trống thì dùng link chung của lớp (nếu có).</p></div>
          )}

          {conflicts && conflicts.length > 0 && (
            <div role="alert" data-conflicts className="border-l-2 border-[var(--kin-tt-chu-loi)] bg-[var(--kin-nen-bang)] px-4 py-3 space-y-1">
              <p className="font-medium text-[var(--kin-tt-chu-loi)]">Buổi này trùng lịch</p>
              <ul className="list-disc pl-5 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">{conflicts.map((c, i) => <li key={i}>{c.text}</li>)}</ul>
              <p className="text-[length:var(--kin-co-phu)] text-[var(--kin-chu-mo)]">Đổi giờ hoặc ngày cho khỏi trùng, hoặc vẫn thêm nếu bạn chắc chắn.</p>
            </div>
          )}
          {error && <p role="alert" className="text-sm font-medium" style={{ color: "var(--kin-tt-chu-loi)" }}>{error}</p>}
          <p className="text-[length:var(--kin-co-phu)] text-[var(--kin-chu-mo)]">Thêm buổi không tạo học phí. Học phí chỉ sinh khi điểm danh, theo cách tính của lớp.</p>
          <div className="flex gap-2 flex-wrap justify-end">
            <KinButton variant="secondary" onClick={onClose} disabled={busy}>Không thêm nữa</KinButton>
            {conflicts && conflicts.length > 0
              ? <KinButton variant="danger" onClick={() => void submit(true)} loading={busy} loadingLabel="Đang lưu...">Vẫn thêm buổi</KinButton>
              : <KinButton onClick={() => void submit(false)} loading={busy} loadingLabel="Đang kiểm tra...">Thêm buổi</KinButton>}
          </div>
        </>)}
      </div>
    </div>
  );
}
