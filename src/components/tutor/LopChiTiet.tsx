// GS-LOP-GON (09/11/2026): trang này KHÔNG còn là nơi của chủ lớp gia sư — chủ lớp được chuyển (307) sang /lop-cua-toi/quan-lop/<id>/… (Giáo trình · Học sinh · Điểm danh · Bài tập ·
// Lịch học · Cài đặt, một dải tab duy nhất). Còn lại dùng đúng bản này: đồng giảng / giáo viên bộ môn (chỉ xem giáo trình + bản ghi) và quản trị xem thử — họ không có dải tab của lớp.
// Chi tiết một lớp của gia sư (Figma "Gia sư · Chi tiết Toán 9" 299:112581): H1 tên lớp + dòng phụ (sĩ số, lịch), nút "Mời học sinh" (chỉ ở màn hẹp, A4c) và "Cài đặt lớp";
// dải tab; tab "Buổi học & điểm danh" = điểm danh (thành phần DiemDanh dùng chung) ở cột trái, cột phải "Học sinh", mã mời, "Lịch sử buổi học".
// Điện thoại: một cột, tab cuộn ngang, nút ≥ 44px. Không có (chưa có tính năng): "Chốt buổi đã dạy", "Xử lý nghỉ muộn" ngay trên trang lớp,
// báo cáo "Chia sẻ" từng học sinh, "Đơn giá hiện tại", tab Bài tập / Tài liệu theo lớp, "x/y buổi" (chưa có tổng số buổi dự kiến). Đã ghi trong báo cáo.
"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { KinTabs, type KinTabItem } from "@/components/kin/Tabs";
import { KinButton, kinButtonClass } from "@/components/kin/Button";
import { KinSectionHead } from "@/components/kin/SectionHead";
import { KinPanel } from "@/components/kin/Panel";
import { KinCallout } from "@/components/kin/Callout";
import { KinStatus } from "@/components/kin/Status";
import { KinCopyButton } from "@/components/kin/CopyButton";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { KinPage, KinPageHeader, KIN_TWO_COL, KIN_TABLE_ROW } from "@/components/kin/PageLayout";
import ClassInvitesPanel, { ClassJoinHowTo } from "@/components/tutor/ClassInvites";
import JoinRequests, { type PendingJoinRequest } from "@/components/tutor/JoinRequests";
import type { JoinPolicy } from "@/lib/joinRequest";
import DiemDanhPanel from "@/components/tutor/DiemDanh";
import LopHocPhi from "@/components/tutor/LopHocPhi";
import LopPhiKhac from "@/components/tutor/LopPhiKhac";
import LopBaoCao from "@/components/tutor/LopBaoCao";
import StudentPicker from "@/components/tutor/StudentPicker";
import { jfetch } from "@/components/tutor/studentUi";
import { ADD_STUDENTS_MAX } from "@/lib/tutorStudentView";
import type { FeeMode } from "@/lib/tuitionFee";
import { contentHref, giaoTrinhHref } from "@/lib/tutorRoutes";
import { classBase } from "@/lib/tutorClassRoutes";
import GiaoVienLop, { RoleBadge } from "@/components/tutor/GiaoVienLop";
import { canManageRole, type ViewRole } from "@/components/tutor/dongGiangUi";
import { duyetMessage } from "@/components/tutor/quan-lop/duyetMessage";
import { featureOn } from "@/lib/features";

export type LopTab = "diem-danh" | "hoc-sinh" | "giao-vien" | "ma-moi" | "hoc-phi" | "cong-dong";
export interface LopChiTietData {
  courseId: string; courseName: string; category: string; viewerName: string | null;
  schedule: string | null;
  students: { id: string; name: string }[];
  /** Sĩ số thật khi `students` bị ẩn tên (rosterHidden). Vắng = students.length. */
  studentCount?: number;
  history: { id: string; dateKey: string; note: string | null; marked: number }[];
  sessionsTaught: number;
  inviteCode: string | null;
  initialTab: LopTab; justCreated: boolean; scheduleFailed: boolean;
  /** Wizard tạo lớp: số em đã thêm cùng lúc ("them=N") hoặc việc thêm em bị lỗi ("them=loi"). */
  addedStudents?: number | null; addFailed?: boolean; codeFailed?: boolean;
  /** HP-15: hình thức học phí của lớp. Lớp cũ = "monthly_sessions". */
  feeMode: FeeMode;
  /** BU-00 (31/10/2026): gia sư thật → lối tắt đi bí danh /lop-cua-toi/quan-lop/…; quản trị xem lớp (roleView "tutor") → /admin/khoa-hoc/… như cũ. Vắng = gia sư. */
  isTeacher?: boolean;
  /** BU-01: cách vào lớp hiệu lực, nhãn "Miễn phí", có cho "Vào ngay" không, hàng chờ duyệt và kết quả vừa duyệt (?duyet=, ?n=). */
  joinPolicy: JoinPolicy; isFree: boolean; canOpen: boolean;
  pending: PendingJoinRequest[]; pendingFailed: boolean;
  duyet: string | null; duyetN: number | null;
  /** TUT-dong-giang: vai của người xem trong lớp. Vắng = chủ lớp / quản trị. Đồng giảng (co_teacher / subject_teacher) KHÔNG thấy: Mã mời, Học phí, nút mời/thêm/sửa/xoá lớp, liên hệ phụ huynh, tên chủ lớp. */
  viewRole?: ViewRole;
  /** Giáo viên bộ môn chưa được giao gì: chỉ thấy số học sinh, không thấy tên (ma trận 4.3 điều kiện a). */
  rosterHidden?: boolean;
}

const dm = (key: string) => `${key.slice(8, 10)}/${key.slice(5, 7)}`;

function OpenPage({ title, href, note, action }: { title: string; href: string; note: string; action: string }) {
  return (
    <section className="max-w-xl">
      <KinSectionHead title={title} />
      <p className="pt-4 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">{note}</p>
      <Link href={href} className={`${kinButtonClass("secondary")} mt-4`}>{action}</Link>
    </section>
  );
}

export default function LopChiTiet({ d }: { d: LopChiTietData }) {
  const router = useRouter();
  const manage = (sub = "") => contentHref(d.isTeacher !== false, `/admin/khoa-hoc/${d.courseId}${sub}`);
  // Trang khung giờ kéo-thả (gia sư). Quản trị xem lớp vẫn dùng tab Lịch học của trang quản khoá.
  const lichHref = d.isTeacher !== false ? `${classBase(d.courseId)}/lich-hoc` : manage("?tab=lich-hoc");
  // DG (14/11/2026): tab Học phí ẩn khi cờ HOC_PHI tắt (mặc định) — mở ?tab=hoc-phi thì về tab đầu.
  const feeOn = featureOn("HOC_PHI");
  // P2-2 (14/11/2026): tab Điểm danh theo cờ DIEM_DANH (mặc định ẨN) — kể cả với đồng giảng. Tab mặc định khi đó là "Học sinh".
  const ddOn = featureOn("DIEM_DANH");
  const firstTab: LopTab = ddOn ? "diem-danh" : "hoc-sinh";
  const [tab, setTab] = useState<LopTab>((d.viewRole && !canManageRole(d.viewRole) && ["ma-moi", "hoc-phi", "cong-dong"].includes(d.initialTab)) || (!feeOn && d.initialTab === "hoc-phi") || (!ddOn && d.initialTab === "diem-danh") ? firstTab : d.initialTab);
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [addBusy, setAddBusy] = useState(false);
  const [addNote, setAddNote] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  function openAdd() { setTab("hoc-sinh"); setAdding(true); setAddNote(null); }
  async function addSelected() {
    if (!picked.length || addBusy) return;
    setAddBusy(true); setAddNote(null);
    const r = await jfetch(`/api/tutor/lop/${d.courseId}/hoc-sinh`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userIds: picked }) });
    setAddBusy(false);
    if (r.ok) { setAddNote({ tone: "ok", text: r.json.added > 0 ? `Đã thêm ${r.json.added} em vào lớp.` : "Các em đã chọn đã ở trong lớp." }); setPicked([]); setAdding(false); router.refresh(); }
    else setAddNote({ tone: "err", text: r.json?.error ?? "Chưa thêm được, thử lại sau." });
  }
  const mgr = canManageRole(d.viewRole);
  const n = d.studentCount ?? d.students.length;
  const tabs: KinTabItem<LopTab>[] = [
    ...(ddOn ? [{ key: "diem-danh", label: mgr ? "Buổi học & điểm danh" : "Buổi tôi dạy" }] as KinTabItem<LopTab>[] : []),
    { key: "hoc-sinh", label: mgr && d.pending.length > 0 ? `Học sinh · ${n} · ${d.pending.length} chờ` : `Học sinh · ${n}` },
    { key: "giao-vien", label: "Giáo viên" },
    ...(mgr ? [{ key: "ma-moi", label: "Mã mời" }, ...(feeOn ? [{ key: "hoc-phi", label: "Học phí" }] : []), { key: "cong-dong", label: "Cộng đồng lớp" }] as KinTabItem<LopTab>[] : []),
  ];
  const toast = duyetMessage(d.duyet, d.duyetN);
  const sub = [`${n} học sinh`, d.schedule ?? "Chưa xếp lịch", d.category].filter(Boolean).join(" · ");

  return (
    <KinPage>
      <KinPageHeader title={d.courseName} titleClassName="break-words" sub={sub} back={{ href: "/lop-cua-toi/lop", label: "← Lớp học" }}
        actions={mgr ? <>
          <button type="button" onClick={openAdd} className={kinButtonClass("secondary")}>Thêm học sinh</button>
          {/* A4c: ở máy rộng đã có tab "Mã mời" ngay dưới → bỏ nút. Ở điện thoại tab "Mã mời" nằm ngoài khung nhìn (đo 320px: x=317..397; 390px: ..397), nên GIỮ nút ở màn hẹp. */}
          <button type="button" onClick={() => setTab("ma-moi")} className={`${kinButtonClass("secondary")} sm:hidden`}>Mời học sinh</button>
          <Link href={lichHref} className={kinButtonClass("secondary")}>Lịch học</Link>
          <Link href={giaoTrinhHref(d.courseId, d.isTeacher !== false)} className={kinButtonClass("secondary")}>Bài học</Link>
          <Link href={`/lop-cua-toi/${d.courseId}/ban-ghi`} className={kinButtonClass("secondary")}>Bản ghi của lớp</Link>
          <Link href={d.isTeacher !== false ? `${classBase(d.courseId)}?tab=cai-dat` : manage()} className={kinButtonClass("ghost")}>Cài đặt lớp</Link>
        </> : <>
          {/* TUT-dong-giang: đồng giảng chỉ xem giáo trình và bản ghi; không thêm/mời học sinh, không sửa lớp. */}
          <Link href={giaoTrinhHref(d.courseId, true)} className={kinButtonClass("secondary")}>Bài học</Link>
          <Link href={`/lop-cua-toi/${d.courseId}/ban-ghi`} className={kinButtonClass("secondary")}>Bản ghi của lớp</Link>
        </>} />

      {!mgr && d.viewRole && (
        <p className="mb-4 flex items-center gap-3 flex-wrap text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]" data-dong-giang-dau>
          <RoleBadge role={d.viewRole} /><span>Lớp bạn đồng giảng</span>
        </p>
      )}

      {mgr && d.isFree && <p className="mb-4"><KinStatus tone="xong">Miễn phí</KinStatus></p>}

      {mgr && d.schedule == null && (
        <div data-no-schedule-callout>
          <KinCallout title="Lớp chưa có lịch học" className="mb-6">
            Học sinh sẽ không thấy buổi nào trong lịch cho tới khi lớp có khung giờ hằng tuần, và KiN không nhắc lịch được.
            <span className="mt-3 block"><Link href={lichHref} className={kinButtonClass("primary")}>Đặt lịch bằng lưới kéo-thả</Link></span>
          </KinCallout>
        </div>
      )}

      {mgr && d.justCreated && (
        <KinCallout title="Đã tạo lớp" className="mb-6">
          {d.joinPolicy === "approve" ? "Học sinh xin vào lớp bằng mã lớp hoặc link trang lớp ở khối Cách học sinh vào lớp; cô duyệt ở tab Học sinh."
            : d.joinPolicy === "open" ? "Lớp miễn phí: học sinh mở link trang lớp ở khối Cách học sinh vào lớp, bấm Vào lớp là vào ngay."
            : "Mã lớp có sẵn ở khối Cách học sinh vào lớp. Cô gửi mã đó để học sinh tự vào lớp."}
        </KinCallout>
      )}
      {mgr && d.addedStudents != null && d.addedStudents > 0 && <KinCallout title={`Đã thêm ${d.addedStudents} học sinh vào lớp`} className="mb-6">Em vào lớp từ danh sách học sinh của cô. Em mới thì gửi mã mời ở tab Mã mời.</KinCallout>}
      {mgr && d.codeFailed && <KinCallout title="Lớp đã tạo, nhưng chưa có mã lớp" className="mb-6">Cô bấm Tạo mã lớp ở khối Cách học sinh vào lớp. Nếu vẫn chưa được, xem gói của cô còn chỗ cho học sinh không.</KinCallout>}
      {mgr && d.addFailed && <KinCallout title="Lớp đã tạo, nhưng chưa thêm được học sinh" className="mb-6">Cô thêm lại ở nút Thêm học sinh phía trên.</KinCallout>}
      {mgr && d.scheduleFailed && (
        <KinCallout title="Lớp đã tạo, nhưng khung giờ chưa lưu" className="mb-6">
          Cô thêm lại khung giờ ở <Link href={manage("?tab=lich-hoc")} className="underline text-[var(--kin-nhan-link)]">trang cài đặt lớp</Link>.
        </KinCallout>
      )}

      {mgr && tab !== "ma-moi" && (d.justCreated || n === 0) && (
        <div className="mb-6"><ClassJoinHowTo courseId={d.courseId} policy={d.joinPolicy} code={d.inviteCode} onChanged={() => router.refresh()} /></div>
      )}

      <KinTabs tabs={tabs} value={tab} onChange={setTab} label="Nội dung của lớp"
        tabId={k => `lop-tab-${k}`} panelId={k => `lop-panel-${k}`} />

      <div role="tabpanel" id={`lop-panel-${tab}`} aria-labelledby={`lop-tab-${tab}`} className="pt-6">
        {ddOn && tab === "diem-danh" && (
          <div className={KIN_TWO_COL}>
            <div className="min-w-0">
              <Suspense fallback={null}><DiemDanhPanel courseId={d.courseId} embedded limited={!mgr} /></Suspense>
            </div>
            <aside className="min-w-0 space-y-[var(--kin-cach-muc)]">
              <section aria-labelledby="lop-hs">
                <KinSectionHead id="lop-hs" title="Học sinh" aside={mgr ? <Link href={manage("/hoc-vien")} className="text-[var(--kin-nhan-link)] hover:underline">Danh bạ lớp →</Link> : undefined} />
                {n === 0 ? (
                  <KinEmptyState title="Lớp chưa có học sinh" action={mgr ? <button type="button" onClick={() => setTab("ma-moi")} className={kinButtonClass("secondary")}>Mời học sinh</button> : undefined}>
                    {mgr ? "Gửi mã mời để học sinh tự vào lớp." : "Chủ lớp sẽ thêm học sinh vào lớp."}
                  </KinEmptyState>
                ) : d.rosterHidden ? (
                  <p className="pt-4 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">Lớp có {n} học sinh. Tên các em hiện khi chủ lớp giao cho cô buổi dạy hoặc nhóm bài.</p>
                ) : (
                  <KinPanel flush className="mt-4">
                  <ul aria-label="Học sinh của lớp">
                    {d.students.map(s => (
                      <li key={s.id} className={`flex ${KIN_TABLE_ROW} text-[var(--kin-chu-chinh)]`}>{s.name}</li>
                    ))}
                  </ul>
                  </KinPanel>
                )}
                {mgr && <p className="mt-4 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)] flex items-center gap-2 flex-wrap">
                  {d.inviteCode ? (<>Mã mời lớp: <b className="font-medium text-[var(--kin-chu-chinh)] tabular-nums">{d.inviteCode}</b>
                    <KinCopyButton text={d.inviteCode} label="Chép mã mời lớp" appearance="icon" size="sm" /></>)
                    : <>Lớp chưa có mã mời còn dùng được. <button type="button" onClick={() => setTab("ma-moi")} className="min-h-11 text-[var(--kin-nhan-link)] underline">Tạo mã mời</button></>}
                </p>}
              </section>

              <section aria-labelledby="lop-ls">
                <KinSectionHead id="lop-ls" title="Lịch sử buổi học" />
                {d.history.length === 0 ? (
                  <p className="pt-4 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">Chưa có buổi nào được điểm danh. Chọn ngày ở cột trái rồi tạo buổi điểm danh đầu tiên.</p>
                ) : (
                  <KinPanel flush className="mt-4">
                  <ul aria-label="Các buổi đã điểm danh gần đây">
                    {d.history.map(h => {
                      const full = n > 0 && h.marked >= n;
                      return (
                        <li key={h.id} className={`flex justify-between gap-3 ${KIN_TABLE_ROW}`}>
                          <span className="min-w-0 break-words text-[var(--kin-chu-chinh)]">{dm(h.dateKey)}{h.note ? ` · ${h.note}` : ""}</span>
                          <KinStatus tone={full ? "xong" : "cho"} className="flex-shrink-0">{full ? "Đã điểm danh đủ" : `Mới ${h.marked}/${n} em`}</KinStatus>
                        </li>
                      );
                    })}
                  </ul>
                  </KinPanel>
                )}
                <p className="mt-4 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">{d.sessionsTaught} buổi đã điểm danh từ đầu đến nay.</p>
              </section>
            </aside>
          </div>
        )}

        {tab === "hoc-sinh" && (
          <section className="max-w-2xl">
            {mgr && toast && <div role={toast.tone === "err" ? "alert" : "status"} data-duyet-toast={d.duyet ?? ""}><KinCallout title={toast.text} className="mb-6" /></div>}
            {mgr && <JoinRequests courseId={d.courseId} items={d.pending} failed={d.pendingFailed} retryHref={`/lop-cua-toi/${d.courseId}?tab=hoc-sinh`}
              show={d.pending.length > 0 || d.pendingFailed || d.joinPolicy === "approve"} />}
            <KinSectionHead title="Học sinh của lớp" aside={mgr ? <button type="button" onClick={() => { setAdding(a => !a); setAddNote(null); }} className="inline-flex items-center min-h-11 text-[var(--kin-nhan-link)] underline">{adding ? "Đóng" : "Thêm học sinh"}</button> : undefined} />
            {mgr && addNote && <p role={addNote.tone === "err" ? "alert" : "status"} className={`pt-3 text-[length:var(--kin-co-goc)] ${addNote.tone === "err" ? "text-[var(--kin-tt-chu-loi)]" : "text-[var(--kin-chu-chinh)]"}`}>{addNote.text}</p>}
            {mgr && adding && (
              <div data-lop-them className="pt-4">
                <p className="pb-3 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">Chọn em đã học lớp khác của cô để thêm vào lớp này. Em mới thì{" "}
                  <button type="button" onClick={() => setTab("ma-moi")} className="min-h-11 text-[var(--kin-nhan-link)] underline">gửi mã mời</button>.</p>
                <StudentPicker excludeCourseId={d.courseId} selected={picked} onChange={setPicked} max={ADD_STUDENTS_MAX} />
                <div className="mt-4"><KinButton loading={addBusy} loadingLabel="Đang thêm…" disabled={picked.length === 0} onClick={() => void addSelected()}>Thêm {picked.length} em vào lớp</KinButton></div>
              </div>
            )}
            {n === 0 ? (
              <KinEmptyState title="Lớp chưa có học sinh" action={mgr ? <button type="button" onClick={() => setTab("ma-moi")} className={kinButtonClass("primary")}>Mời học sinh</button> : undefined}>
                {mgr ? "Gửi mã mời để học sinh tự vào lớp. Học sinh vào xong sẽ hiện ở đây." : "Chủ lớp sẽ thêm học sinh vào lớp. Học sinh vào xong sẽ hiện ở đây."}
              </KinEmptyState>
            ) : d.rosterHidden ? (
              <p className="pt-4 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">Lớp có {n} học sinh. Tên các em hiện khi chủ lớp giao cho cô buổi dạy hoặc nhóm bài.</p>
            ) : (
              <>
                <KinPanel flush className="mt-4">
                <ul aria-label="Học sinh của lớp">
                  {d.students.map(s => (
                    <li key={s.id} className={`flex items-center justify-between gap-3 ${KIN_TABLE_ROW} text-[var(--kin-chu-chinh)]`}>
                      <span className="min-w-0 break-words">{s.name}</span>
                      {mgr && <Link href={`/lop-cua-toi/hoc-sinh/em/${s.id}`} aria-label={`Hồ sơ của ${s.name}`} className="inline-flex items-center min-h-11 flex-shrink-0 text-[var(--kin-nhan-link)] underline">Hồ sơ</Link>}
                    </li>
                  ))}
                </ul>
                </KinPanel>
                {mgr && <p className="mt-4 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">Gọi tên và mở Zalo phụ huynh ở <Link href={manage("/hoc-vien")} className="inline-flex items-center min-h-11 text-[var(--kin-nhan-link)] underline">Danh bạ lớp</Link>.</p>}
              </>
            )}
            {mgr && n > 0 && <LopBaoCao courseId={d.courseId} students={d.students} />}
          </section>
        )}

        {tab === "giao-vien" && <GiaoVienLop courseId={d.courseId} viewRole={d.viewRole ?? "owner"} />}

        {mgr && tab === "ma-moi" && (
          <section className="max-w-3xl">
            <KinSectionHead title="Mã mời vào lớp" />
            <p className="py-4 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">Mã lớp và link ở ngay bên dưới; các em tự vào lớp, không cần cô thêm từng người.</p>
            <ClassInvitesPanel courseId={d.courseId} courseName={d.courseName} tutorName={d.viewerName} classCode={d.inviteCode} onChanged={() => router.refresh()}
              join={{ policy: d.joinPolicy, isFree: d.isFree, canOpen: d.canOpen, pending: d.pending.length }} />
          </section>
        )}

        {mgr && feeOn && tab === "hoc-phi" && (
          <div className="space-y-[var(--kin-cach-muc)]">
            <LopHocPhi courseId={d.courseId} feeMode={d.feeMode} adminView={d.isTeacher === false} />
            <LopPhiKhac courseId={d.courseId} />
            {/* HP-31: "Gói buổi trả trước" đã ẩn theo quyết định của chủ 25/10/2026 (học xong mới thu học phí). Mã (LopGoiBuoi, API /packages) và hai bảng giữ nguyên để có thể bật lại. */}
          </div>
        )}

        {mgr && tab === "cong-dong" && (
          <div className="space-y-[var(--kin-cach-muc)]">
            {/* LOI-01 (rà soát): bảng tin chung ẩn thì hỏi đáp của lớp mở ở /cong-dong?scope=<mã lớp> (chỉ thành viên lớp và gia sư). */}
            {!featureOn("CONG_DONG") && (
              <OpenPage title="Hỏi đáp trong lớp" href={`/cong-dong?scope=${encodeURIComponent(d.courseId)}`} action="Mở hỏi đáp của lớp"
                note="Câu hỏi học sinh của lớp gửi cho cô. Chỉ thành viên lớp và gia sư thấy; câu chưa trả lời cũng hiện ở Hộp việc." />
            )}
            <OpenPage title="Kiểm duyệt cộng đồng lớp" href="/lop-cua-toi/kiem-duyet" action="Mở Kiểm duyệt"
              note="Xem báo cáo bài viết trong các lớp của cô, xoá bài vi phạm hoặc bỏ qua." />
          </div>
        )}
      </div>
    </KinPage>
  );
}
