// GS-LOP-GON (09/11/2026) — tab "Học sinh" của lớp gia sư (/lop-cua-toi/quan-lop/[id]/hoc-vien). Gộp mọi thứ về HỌC SINH của lớp mà trước đây rải ở LopChiTiet thành các MỤC CON
// (?muc=, không thêm tab thứ 7): Danh bạ (mặc định) · Xin vào lớp (n) · Mã mời · Thêm học sinh. Chuyển nguyên các khối đã có — JoinRequests (BU-01), ClassInvitesPanel + ClassJoinHowTo
// (mã lớp), StudentPicker (thêm em đã học lớp khác của cô), LopBaoCao — chỉ đổi chỗ ở, không đổi dữ liệu nào. Tên em chỉ hiện với chủ lớp (trang này chỉ chủ lớp mở được).
// Dữ liệu do trang máy chủ dựng bằng loadStudentsTab (tutorClassPageServer.ts). Ghi dữ liệu: form POST + 303 (duyệt) hoặc API có sẵn (thêm em). Nút ≥ 44px.
"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { KinButton, kinButtonClass } from "@/components/kin/Button";
import { KinCallout } from "@/components/kin/Callout";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { KinSectionHead } from "@/components/kin/SectionHead";
import ClassInvitesPanel, { ClassJoinHowTo } from "@/components/tutor/ClassInvites";
import JoinRequests from "@/components/tutor/JoinRequests";
import LopBaoCao from "@/components/tutor/LopBaoCao";
import StudentPicker from "@/components/tutor/StudentPicker";
import DanhBaLop from "@/components/tutor/DanhBaLop";
import { jfetch } from "@/components/tutor/studentUi";
import MucNav from "@/components/tutor/quan-lop/MucNav";
import { duyetMessage } from "@/components/tutor/quan-lop/duyetMessage";
import { ADD_STUDENTS_MAX } from "@/lib/tutorStudentView";
import { classBase, MUC_HOC_SINH, type MucHocSinh } from "@/lib/tutorClassRoutes";
import type { StudentsTabData } from "@/lib/tutorClassPageServer";

const LABEL: Record<MucHocSinh, string> = { "danh-ba": "Danh bạ", "xin-vao": "Xin vào lớp", "ma-moi": "Mã mời", them: "Thêm học sinh" };

export default function HocSinhTab({ d }: { d: StudentsTabData }) {
  const router = useRouter();
  const base = `${classBase(d.courseId)}/hoc-vien`;
  const mucHref = (m: MucHocSinh) => (m === "danh-ba" ? base : `${base}?muc=${m}`);
  const n = d.studentCount;
  const toast = duyetMessage(d.duyet, d.duyetN);

  const [picked, setPicked] = useState<string[]>([]);
  const [addBusy, setAddBusy] = useState(false);
  const [addNote, setAddNote] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [pickerKey, setPickerKey] = useState(0);
  async function addSelected() {
    if (!picked.length || addBusy) return;
    setAddBusy(true); setAddNote(null);
    const r = await jfetch(`/api/tutor/lop/${d.courseId}/hoc-sinh`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userIds: picked }) });
    setAddBusy(false);
    if (r.ok) {
      setAddNote({ tone: "ok", text: r.json.added > 0 ? `Đã thêm ${r.json.added} em vào lớp.` : "Các em đã chọn đã ở trong lớp." });
      setPicked([]); setPickerKey(k => k + 1); router.refresh();
    } else setAddNote({ tone: "err", text: r.json?.error ?? "Chưa thêm được, thử lại sau." });
  }

  const inviteMuc = (
    <Link href={mucHref("ma-moi")} className={kinButtonClass("primary")}>Mời học sinh</Link>
  );

  return (
    <div data-hoc-sinh-tab className="min-w-0 max-w-5xl">
      {d.justCreated && (
        <KinCallout title="Đã tạo lớp" className="mb-6">
          {d.joinPolicy === "approve" ? "Học sinh xin vào lớp bằng mã lớp hoặc link trang lớp ở khối Cách học sinh vào lớp; cô duyệt ở mục Xin vào lớp."
            : d.joinPolicy === "open" ? "Lớp miễn phí: học sinh mở link trang lớp ở khối Cách học sinh vào lớp, bấm Vào lớp là vào ngay."
            : "Mã lớp có sẵn ở khối Cách học sinh vào lớp. Cô gửi mã đó để học sinh tự vào lớp."}
        </KinCallout>
      )}
      {d.addedStudents != null && d.addedStudents > 0 && <KinCallout title={`Đã thêm ${d.addedStudents} học sinh vào lớp`} className="mb-6">Em vào lớp từ danh sách học sinh của cô. Em mới thì gửi mã mời ở mục Mã mời.</KinCallout>}
      {d.codeFailed && <KinCallout title="Lớp đã tạo, nhưng chưa có mã lớp" className="mb-6">Cô bấm Tạo mã lớp ở khối Cách học sinh vào lớp. Nếu vẫn chưa được, xem gói của cô còn chỗ cho học sinh không.</KinCallout>}
      {d.addFailed && <KinCallout title="Lớp đã tạo, nhưng chưa thêm được học sinh" className="mb-6">Cô thêm lại ở mục Thêm học sinh ngay bên dưới.</KinCallout>}
      {d.scheduleFailed && (
        <KinCallout title="Lớp đã tạo, nhưng khung giờ chưa lưu" className="mb-6">
          Cô thêm lại khung giờ ở tab <Link href={`${classBase(d.courseId)}/lich-hoc`} className="inline-flex items-center min-h-11 underline text-[var(--kin-nhan-link)]">Lịch học</Link>.
        </KinCallout>
      )}

      <MucNav label="Mục của Học sinh" items={MUC_HOC_SINH.map(m => ({
        key: m, href: mucHref(m), active: d.muc === m,
        label: m === "xin-vao" && d.pending.length > 0 ? `${LABEL[m]} (${d.pending.length})` : LABEL[m],
      }))} />

      {d.muc !== "ma-moi" && (d.justCreated || n === 0) && (
        <div className="mb-6"><ClassJoinHowTo courseId={d.courseId} policy={d.joinPolicy} code={d.inviteCode} onChanged={() => router.refresh()} /></div>
      )}

      {d.muc === "danh-ba" && (
        <section aria-label="Danh bạ lớp">
          {n === 0 ? (
            <KinEmptyState title="Lớp chưa có học sinh" action={inviteMuc}>Gửi mã mời để học sinh tự vào lớp. Học sinh vào xong sẽ hiện ở đây.</KinEmptyState>
          ) : (
            <>
              <DanhBaLop courseId={d.courseId} embedded emptyAction={inviteMuc} />
              <div className="mt-8"><LopBaoCao courseId={d.courseId} students={d.students} /></div>
            </>
          )}
        </section>
      )}

      {d.muc === "xin-vao" && (
        <section aria-label="Học sinh xin vào lớp" className="max-w-3xl">
          {toast && <div role={toast.tone === "err" ? "alert" : "status"} data-duyet-toast={d.duyet ?? ""}><KinCallout title={toast.text} className="mb-6" /></div>}
          <JoinRequests courseId={d.courseId} items={d.pending} failed={d.pendingFailed} retryHref={mucHref("xin-vao")} show />
        </section>
      )}

      {d.muc === "ma-moi" && (
        <section aria-label="Mã mời vào lớp" className="max-w-3xl">
          <KinSectionHead title="Mã mời vào lớp" />
          <p className="py-4 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">Mã lớp và link ở ngay bên dưới; các em tự vào lớp, không cần cô thêm từng người.</p>
          <ClassInvitesPanel courseId={d.courseId} courseName={d.courseName} tutorName={d.viewerName} classCode={d.inviteCode} onChanged={() => router.refresh()}
            join={{ policy: d.joinPolicy, isFree: d.isFree, canOpen: d.canOpen, pending: d.pending.length }} />
        </section>
      )}

      {d.muc === "them" && (
        <section aria-label="Thêm học sinh vào lớp" data-lop-them className="max-w-3xl">
          <KinSectionHead title="Thêm học sinh vào lớp" />
          <p className="py-4 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">Chọn em đã học lớp khác của cô để thêm vào lớp này. Em mới thì{" "}
            <Link href={mucHref("ma-moi")} className="inline-flex items-center min-h-11 text-[var(--kin-nhan-link)] underline">gửi mã mời</Link>.</p>
          {addNote && <p role={addNote.tone === "err" ? "alert" : "status"} className={`pb-3 text-[length:var(--kin-co-goc)] ${addNote.tone === "err" ? "text-[var(--kin-tt-chu-loi)]" : "text-[var(--kin-chu-chinh)]"}`}>{addNote.text}</p>}
          <StudentPicker key={pickerKey} excludeCourseId={d.courseId} selected={picked} onChange={setPicked} max={ADD_STUDENTS_MAX} />
          <div className="mt-4 flex flex-wrap gap-3">
            <KinButton loading={addBusy} loadingLabel="Đang thêm…" disabled={picked.length === 0} onClick={() => void addSelected()}>Thêm {picked.length} em vào lớp</KinButton>
            {addNote?.tone === "ok" && <Link href={base} className={kinButtonClass("secondary")}>Xem danh bạ lớp</Link>}
          </div>
        </section>
      )}
    </div>
  );
}
