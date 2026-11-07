// TUT-dong-giang 7.4 — trang chấp nhận lời mời đồng giảng (/lop-cua-toi/dong-giang): danh sách lời mời + hai nút Nhận lời / Từ chối.
// Dữ liệu: GET /api/tutor/dong-giang. Không hiện tên chủ lớp, không tiền (API cũng không trả). Đủ trạng thái tải / lỗi (Thử lại) / rỗng.
"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { KinButton } from "@/components/kin/Button";
import { kinButtonClass } from "@/components/kin/Button";
import { KinCallout } from "@/components/kin/Callout";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { KinPanel } from "@/components/kin/Panel";
import { KinPage, KinPageHeader, KinTableSkeleton } from "@/components/kin/PageLayout";
import { ErrorStrip } from "@/components/kin/shell/Outlook";
import { callApi } from "@/components/tutor/shared";
import { RoleBadge } from "@/components/tutor/GiaoVienLop";
import { ROLE_LABEL, errorText, shortDate, type DongGiangResponse, type Invitation } from "@/components/tutor/dongGiangUi";

export default function LoiMoiDongGiang() {
  const [data, setData] = useState<DongGiangResponse | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ tone: "ok" | "err"; text: string; courseId?: string } | null>(null);

  const load = useCallback(async () => {
    const r = await callApi<DongGiangResponse>("/api/tutor/dong-giang");
    if (!r.ok || !Array.isArray(r.data.invitations)) { setError(true); return; }
    setData({ invitations: r.data.invitations, courses: Array.isArray(r.data.courses) ? r.data.courses : [] }); setError(false);
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  async function answer(inv: Invitation, accept: boolean) {
    if (busy) return;
    setBusy(inv.id); setNote(null);
    const r = await callApi<{ code?: string }>(`/api/tutor/dong-giang/${encodeURIComponent(inv.id)}/${accept ? "chap-nhan" : "tu-choi"}`, { method: "POST" });
    setBusy(null);
    if (!r.ok) {
      setNote({ tone: "err", text: r.status === 409 && r.data.code === "ALREADY_RESPONDED" ? "Lời mời đã được xử lý." : errorText(r.status, r.data.code, r.data.error) });
      await load(); return;
    }
    setNote({ tone: "ok", text: accept ? `Đã nhận lời dạy lớp «${inv.courseName}». Lớp hiện ở nhóm "Lớp tôi đồng giảng".` : "Đã từ chối lời mời." });
    await load();
  }

  return (
    <KinPage>
      <KinPageHeader title="Lời mời đồng giảng" sub="Chủ lớp mời cô cùng dạy. Nhận lời thì lớp hiện ở nhóm Lớp tôi đồng giảng."
        back={{ href: "/lop-cua-toi", label: "← Hộp việc" }} />
      {note && <div role={note.tone === "err" ? "alert" : "status"} data-dg-note={note.tone}><KinCallout title={note.text} className="mb-6" /></div>}
      {error && <ErrorStrip message="Không tải được lời mời." onRetry={() => void load()} />}
      {data === null ? (!error ? <KinTableSkeleton label="Đang tải lời mời" rows={2} /> : null) : data.invitations.length === 0 ? (
        <KinEmptyState title="Bạn chưa có lời mời nào" action={<Link href="/lop-cua-toi/lop" className={kinButtonClass("secondary")}>Về danh sách lớp</Link>}>
          Khi một chủ lớp mời cô cùng dạy, lời mời sẽ hiện ở đây.
        </KinEmptyState>
      ) : (
        <ul aria-label="Lời mời đồng giảng" className="space-y-4 max-w-3xl">
          {data.invitations.map(inv => (
            <li key={inv.id} data-loi-moi={inv.id}>
              <KinPanel className="p-5 space-y-3">
                <h2 className="text-[length:var(--kin-co-tieu-de)] leading-6 font-medium text-[var(--kin-chu-chinh)] break-words">{inv.courseName}</h2>
                <div className="flex items-center gap-3 flex-wrap text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">
                  <RoleBadge role={inv.role} />
                  {inv.subjects.length > 0 && <span className="break-words">Môn: {inv.subjects.join(", ")}</span>}
                  <span className="tabular-nums">Gửi ngày {shortDate(inv.sentOn)}</span>
                </div>
                <div className="text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-chinh)]">
                  <p>Vai {ROLE_LABEL[inv.role]} trong lớp:</p>
                  <ul className="list-disc pl-5 mt-1 space-y-0.5">
                    <li>Được điểm danh, ghi chép buổi cô dạy{inv.role === "co_teacher" ? " và soạn bài trong lớp" : " và soạn nhóm bài được giao"}.</li>
                    <li>Không được xem tiền và liên hệ phụ huynh của lớp.</li>
                    <li>Không được xoá lớp hay mời, gỡ người khác.</li>
                  </ul>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 pt-1">
                  <KinButton block onClick={() => void answer(inv, true)} loading={busy === inv.id} loadingLabel="Đang xử lý…" disabled={busy !== null && busy !== inv.id} className="sm:w-auto">Nhận lời</KinButton>
                  <KinButton block variant="secondary" onClick={() => void answer(inv, false)} disabled={busy !== null} className="sm:w-auto">Từ chối</KinButton>
                </div>
              </KinPanel>
            </li>
          ))}
        </ul>
      )}
    </KinPage>
  );
}
