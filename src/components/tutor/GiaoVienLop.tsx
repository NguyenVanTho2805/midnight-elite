// TUT-dong-giang 7.1/7.2 — tab "Giáo viên" của lớp. Chủ lớp (và quản trị): danh sách + Mời / Đổi vai / Gỡ / Huỷ lời mời.
// Đồng giảng: chỉ đọc (tên, vai, môn) + nút "Rời lớp". 1280: bảng 4 cột; 390: thẻ xếp dọc. Đủ trạng thái tải / lỗi (Thử lại) / rỗng.
// Dữ liệu: GET /api/tutor/lop/[courseId]/giao-vien. Không hiện email với đồng giảng (máy chủ cũng không trả).
"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KinButton, useKinConfirm } from "@/components/kin";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { KinPanel } from "@/components/kin/Panel";
import { KinSectionHead } from "@/components/kin/SectionHead";
import { KinStatus } from "@/components/kin/Status";
import { KinTableSkeleton, KIN_TABLE_HEAD, KIN_TABLE_ROW } from "@/components/kin/PageLayout";
import { ErrorStrip } from "@/components/kin/shell/Outlook";
import { callApi, useNotify } from "@/components/tutor/shared";
import MoiDongGiang from "@/components/tutor/MoiDongGiang";
import {
  CT_STATUS_LABEL, ROLE_LABEL, canManageRole, errorText,
  type CtStatus, type DongGiangResponse, type TeacherRow, type TeachersResponse, type ViewRole,
} from "@/components/tutor/dongGiangUi";

const COLS = "md:grid md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)] md:gap-x-4";
const TONE: Record<CtStatus, "xong" | "cho" | "loi" | "mo"> = { active: "xong", invited: "cho", declined: "mo", removed: "mo" };

/** Huy hiệu vai: luôn có chữ. */
export function RoleBadge({ role }: { role: ViewRole }) {
  return <span data-role-badge={role}><KinStatus tone={role === "owner" || role === "admin" ? "xong" : "mo"}>{ROLE_LABEL[role]}</KinStatus></span>;
}

export default function GiaoVienLop({ courseId, viewRole }: { courseId: string; viewRole: ViewRole }) {
  const router = useRouter();
  const notify = useNotify();
  const { ask, dialog } = useKinConfirm();
  const manage = canManageRole(viewRole);
  const [data, setData] = useState<TeachersResponse | null>(null);
  const [error, setError] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const base = `/api/tutor/lop/${encodeURIComponent(courseId)}/giao-vien`;

  const load = useCallback(async () => {
    const r = await callApi<TeachersResponse>(base);
    if (!r.ok || !Array.isArray(r.data.teachers)) { setError(true); return; }
    setData(r.data); setError(false);
  }, [base]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const rows = data?.teachers ?? [];
  const current = rows.filter(t => t.status === "active" || t.status === "invited");
  const past = rows.filter(t => t.status === "declined" || t.status === "removed");
  const label = (t: TeacherRow) => t.name ?? t.email ?? "Giáo viên (chưa nhận lời)";

  async function changeRole(t: TeacherRow) {
    const to = t.role === "co_teacher" ? "subject_teacher" : "co_teacher";
    const ok = await ask({
      title: `Đổi thành ${ROLE_LABEL[to]}?`, tone: "thuong", confirmLabel: "Đổi vai", cancelLabel: "Giữ nguyên",
      message: to === "subject_teacher" ? "Giáo viên chỉ soạn nhóm bài được giao. Nhóm bài đã giao vẫn giữ nguyên." : "Giáo viên soạn được mọi bài trong lớp và tự thêm khung lịch của mình.",
    });
    if (!ok) return;
    setBusyId(t.id);
    const r = await callApi<{ code?: string }>(`${base}/${encodeURIComponent(t.id)}`, { method: "PATCH", body: JSON.stringify({ role: to }) });
    setBusyId(null);
    if (!r.ok) { notify.err(errorText(r.status, r.data.code, r.data.error)); return; }
    notify.ok("Đã đổi vai."); await load();
  }

  async function remove(t: TeacherRow) {
    const pending = t.status === "invited";
    let extra = "";
    if (!pending) {
      const p = await callApi<{ reassignedSchedules?: number; reassignedChapters?: number }>(`${base}/${encodeURIComponent(t.id)}?preview=1`, { method: "DELETE" });
      if (p.ok && typeof p.data.reassignedSchedules === "number" && typeof p.data.reassignedChapters === "number") {
        extra = ` ${p.data.reassignedSchedules} khung lịch và ${p.data.reassignedChapters} nhóm bài được giao sẽ về cô.`;
      }
    }
    const ok = await ask({
      title: pending ? "Huỷ lời mời này?" : `Gỡ ${label(t)} khỏi lớp?`,
      message: pending ? "Người được mời sẽ không nhận lời được nữa. Cô có thể mời lại sau." : `Buổi và điểm danh đã có được giữ nguyên.${extra}`,
      confirmLabel: pending ? "Huỷ lời mời" : "Gỡ khỏi lớp", cancelLabel: "Giữ lại", tone: "nguy-hiem",
    });
    if (!ok) return;
    setBusyId(t.id);
    const r = await callApi<{ code?: string }>(`${base}/${encodeURIComponent(t.id)}`, { method: "DELETE" });
    setBusyId(null);
    if (!r.ok) { notify.err(errorText(r.status, r.data.code, r.data.error)); return; }
    notify.ok(pending ? "Đã huỷ lời mời." : "Đã gỡ khỏi lớp."); await load();
  }

  async function leave() {
    let ctId = data?.self.ctId ?? null;
    if (!ctId) {
      const mine = await callApi<DongGiangResponse>("/api/tutor/dong-giang");
      const c = mine.ok ? mine.data.courses?.find(x => x.courseId === courseId) : undefined;
      ctId = c?.ctId ?? c?.id ?? null;
    }
    if (!ctId) { notify.err("Chưa rời được lúc này, tải lại trang rồi thử."); return; }
    const ok = await ask({
      title: "Rời lớp này?", message: "Buổi và điểm danh cô đã ghi được giữ nguyên. Muốn quay lại thì cần chủ lớp mời lại.",
      confirmLabel: "Rời lớp", cancelLabel: "Ở lại", tone: "nguy-hiem",
    });
    if (!ok) return;
    setBusyId("self");
    const r = await callApi<{ code?: string }>(`/api/tutor/dong-giang/${encodeURIComponent(ctId)}/roi-lop`, { method: "POST" });
    setBusyId(null);
    if (!r.ok) { notify.err(errorText(r.status, r.data.code, r.data.error)); return; }
    notify.ok("Đã rời lớp."); router.push("/lop-cua-toi/lop");
  }

  const subjects = (t: TeacherRow) => (t.subjects.length ? t.subjects.join(", ") : "—");
  const inviteBtn = <KinButton onClick={() => setInviting(true)}>Mời giáo viên</KinButton>;

  return (
    <section className="max-w-4xl" aria-labelledby="gv-title" data-tab-giao-vien>
      <KinSectionHead id="gv-title" title="Giáo viên của lớp" aside={manage && current.length > 0 ? inviteBtn : undefined} />
      {error && <ErrorStrip message="Không tải được danh sách giáo viên." onRetry={() => void load()} />}
      {data === null ? (!error ? <div className="pt-4"><KinTableSkeleton label="Đang tải giáo viên của lớp" rows={3} /></div> : null) : (
        <>
          {current.length === 0 ? (
            <KinEmptyState title="Lớp này chỉ có cô dạy" action={manage ? inviteBtn : undefined}>
              {manage ? "Mời giáo viên nếu có người cùng dạy." : "Hiện chưa có giáo viên nào khác trong lớp."}
            </KinEmptyState>
          ) : (
            <KinPanel flush className="mt-4">
              <div aria-hidden className={`hidden ${COLS} ${KIN_TABLE_HEAD}`}><span>Tên</span><span>Vai</span><span>Môn</span><span>Trạng thái</span><span>{manage ? "Thao tác" : ""}</span></div>
              <ul aria-label="Giáo viên của lớp">
                {current.map(t => (
                  <li key={t.id} data-gv-row={t.status} className={`${COLS} flex flex-col gap-2 ${KIN_TABLE_ROW} max-md:items-start text-[var(--kin-chu-chinh)]`}>
                    <p className="min-w-0 break-words font-medium">{label(t)}</p>
                    <div><RoleBadge role={t.role} /></div>
                    <p className={t.subjects.length ? "min-w-0 break-words" : "text-[var(--kin-chu-mo)]"}><span className="md:hidden text-[var(--kin-chu-mo)]">Môn: </span>{subjects(t)}</p>
                    <div><KinStatus tone={TONE[t.status]}>{CT_STATUS_LABEL[t.status]}</KinStatus></div>
                    {manage && (
                      <div className="flex flex-wrap gap-2">
                        {t.status === "active" && <KinButton variant="secondary" onClick={() => void changeRole(t)} disabled={busyId === t.id} aria-label={`Đổi vai của ${label(t)}`}>Đổi vai</KinButton>}
                        <KinButton variant="danger" onClick={() => void remove(t)} disabled={busyId === t.id} aria-label={`${t.status === "invited" ? "Huỷ lời mời" : "Gỡ"} ${label(t)}`}>{t.status === "invited" ? "Huỷ lời mời" : "Gỡ"}</KinButton>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </KinPanel>
          )}
          {!manage && (
            <div className="mt-4">
              <p className="text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">Chỉ chủ lớp mời, đổi vai hoặc gỡ giáo viên. Cô có thể tự rời lớp bất cứ lúc nào.</p>
              <KinButton variant="danger" className="mt-3" onClick={() => void leave()} loading={busyId === "self"} loadingLabel="Đang rời lớp…">Rời lớp này</KinButton>
            </div>
          )}
          {manage && past.length > 0 && (
            <div className="mt-6" data-gv-past>
              <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Đã từ chối hoặc đã gỡ</p>
              <ul aria-label="Giáo viên đã từ chối hoặc đã gỡ" className="mt-2">
                {past.map(t => (
                  <li key={t.id} className="flex items-center justify-between gap-3 min-h-11 border-b border-[var(--kin-vien-nhat)] text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">
                    <span className="min-w-0 break-words">{label(t)}</span><KinStatus tone="mo" className="flex-shrink-0">{CT_STATUS_LABEL[t.status]}</KinStatus>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {manage && data.limit > 0 && <p className="mt-4 text-[length:var(--kin-co-phu)] text-[var(--kin-chu-mo)]">Tối đa {data.limit} giáo viên mỗi lớp, tính cả lời mời đang chờ.</p>}
        </>
      )}
      {inviting && <MoiDongGiang courseId={courseId} onClose={() => setInviting(false)} onSent={() => void load()} />}
      {dialog}
    </section>
  );
}
