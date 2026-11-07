// TUT-dong-giang — "Giao cho…" ở mỗi nhóm/chương của giáo trình.
// Chủ lớp / quản trị: ô chọn giáo viên bộ môn đang dạy lớp (hoặc "Chủ lớp / không giao"); gọi PATCH .../giao-trinh/chuong/[chapterId] { teacherId }.
// Đồng giảng / bộ môn: chỉ nhãn chỉ-đọc "Giao cho <tên hiển thị>". Bộ môn thấy nhóm của người khác bị khoá bằng chữ rõ ràng (máy chủ vẫn chặn 403 song song).
// Hợp đồng dữ liệu máy chủ mong đợi (thiếu thì UI lùi về an toàn: không hiện ô chọn / khoá nhóm có người được giao):
//   GET giao-vien: self.userId (người xem), teachers[].userId (khoá để giao); GET giao-trinh: groups[].teacherId.
"use client";
import { useCallback, useEffect, useState } from "react";
import { KIN_FIELD, KIN_LABEL } from "@/components/kin/PageLayout";
import { callApi } from "@/components/tutor/shared";
import { canManageRole, type ViewRole } from "@/components/tutor/dongGiangUi";

export interface GiaoVienLopRow { id: string; userId?: string; name?: string; role: string; status: string }
export interface GiaoVienLopInfo {
  phase: "loading" | "ready" | "error";
  role: ViewRole | null; selfUserId: string | null;
  /** Giáo viên bộ môn đang dạy (đối tượng được giao). */
  assignable: GiaoVienLopRow[];
  /** Mọi giáo viên đang dạy: để dựng tên cho nhãn chỉ-đọc. */
  active: GiaoVienLopRow[];
}

export function useGiaoVienLop(courseId: string): GiaoVienLopInfo {
  const [s, setS] = useState<GiaoVienLopInfo>({ phase: "loading", role: null, selfUserId: null, assignable: [], active: [] });
  const load = useCallback(async () => {
    const r = await callApi<{ self?: { role?: ViewRole; userId?: string }; teachers?: GiaoVienLopRow[] }>(`/api/tutor/lop/${encodeURIComponent(courseId)}/giao-vien`);
    if (!r.ok || !Array.isArray(r.data.teachers)) { setS(p => ({ ...p, phase: "error" })); return; }
    const active = r.data.teachers.filter(t => t.status === "active");
    setS({ phase: "ready", role: r.data.self?.role ?? null, selfUserId: r.data.self?.userId ?? null, active, assignable: active.filter(t => t.role === "subject_teacher") });
  }, [courseId]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);
  return s;
}

/** Nhóm có bị khoá với người xem không: chỉ bộ môn, và chỉ khi nhóm đã giao cho người khác mình (thiếu thông tin ⇒ khoá, an toàn). */
export function nhomBiKhoa(info: GiaoVienLopInfo, teacherId: string | null | undefined): boolean {
  if (info.role !== "subject_teacher") return false;
  if (!teacherId) return true; // chưa giao ai = của chủ lớp
  return !info.selfUserId || teacherId !== info.selfUserId;
}

export default function GiaoChoNhom({ courseId, chapterId, teacherId, info, onChanged }: {
  courseId: string; chapterId: string; teacherId: string | null | undefined; info: GiaoVienLopInfo; onChanged: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (info.phase !== "ready") return null;
  const manage = canManageRole(info.role ?? undefined);
  const owner = info.active.find(t => t.userId && t.userId === teacherId);
  const nameOf = owner?.name ?? (teacherId ? "giáo viên bộ môn" : "chủ lớp");

  if (!manage) {
    const khoa = nhomBiKhoa(info, teacherId);
    return (
      <p data-gt-giao-cho={chapterId} data-gt-khoa={khoa ? "1" : undefined} className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">
        {khoa ? <>Nhóm của giáo viên khác. Giao cho {nameOf}; bạn chỉ xem được.</> : <>Giao cho {nameOf}</>}
      </p>
    );
  }
  if (info.assignable.length === 0 && !teacherId) {
    return <p data-gt-giao-cho={chapterId} className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Lớp chưa có giáo viên bộ môn để giao. Mời ở tab Giáo viên.</p>;
  }

  async function change(value: string) {
    setBusy(true); setErr(null);
    const r = await callApi<{ error?: string }>(`/api/tutor/lop/${encodeURIComponent(courseId)}/giao-trinh/chuong/${encodeURIComponent(chapterId)}`, { method: "PATCH", body: JSON.stringify({ teacherId: value || null }) });
    setBusy(false);
    if (!r.ok) { setErr(r.data.error ?? "Chưa giao được, thử lại nhé."); return; }
    await onChanged();
  }
  const id = `gt-giao-${chapterId}`;
  return (
    <div data-gt-giao-cho={chapterId} className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <label htmlFor={id} className={`${KIN_LABEL} shrink-0`}>Giao cho</label>
      <select id={id} aria-label="Giao cho giáo viên" disabled={busy} value={teacherId ?? ""} onChange={e => void change(e.target.value)} className={`${KIN_FIELD} min-h-11 w-auto max-w-full`}>
        <option value="">Chủ lớp / không giao</option>
        {info.assignable.filter(t => t.userId).map(t => <option key={t.id} value={t.userId}>{t.name ?? "Giáo viên bộ môn"}</option>)}
        {teacherId && !info.assignable.some(t => t.userId === teacherId) && <option value={teacherId}>{nameOf}</option>}
      </select>
      {busy && <span className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]" aria-live="polite">Đang lưu…</span>}
      {err && <span role="alert" className="text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi)]">{err}</span>}
    </div>
  );
}
