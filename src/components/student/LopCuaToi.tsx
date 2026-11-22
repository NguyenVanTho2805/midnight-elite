// Lớp của tôi của học sinh.
//   - Không ?course= ⇒ THƯ VIỆN LỚP (components/student/ThuVienLop) — LUÔN, kể cả khi chỉ có 1 lớp (LOI-03 Q1).
//   - ?course=<id> ⇒ TRANG LỚP theo bản chốt SCL-G (QUYET-DINH-GIAO-DIEN §2.1, §3.3, §3.9; khung 1 "Học sinh · Trang lớp"):
//       đầu trang MỘT dòng (vạch màu lớp 4px, tên lớp, "Cô … · lịch học") → "Cần làm N" (thẻ của mọi việc sắp hạn của lớp: bài tập + kiểm tra,
//       chỉ thẻ hạn gần nhất mang nút chính) → "Buổi gần đây" (hàng mảnh 56px, bài mới nhất trước, kèm bản ghi buổi học) → "Tất cả bài học (N)".
//       Học sinh KHÔNG thấy Phần/Chương ở đây; dữ liệu Phần › Chương › Bài không đổi. Dock nộp bài ghim đáy khi thẻ Cần làm đã cuộn khỏi màn.
//       Sau khi nộp (POST + 303 về đây với ?nop=ok&bt=<mã bài>): thông báo role=status, thẻ đổi thành "Đã nộp lúc …" + Chờ chấm.
//   - ?course=<id>&xem=bai-hoc ⇒ "TẤT CẢ BÀI HỌC" (khung 4): nhóm theo chương (chương mới nhất trên), ô tìm theo tên (gõ không dấu vẫn khớp), cuối là bản ghi các buổi.
//   Bỏ 3 viên tab cũ (Nội dung / Video / Kết quả) vì trùng thanh dưới: video bài + bản ghi nằm trong hàng bài và màn Tất cả bài học; kết quả ở mục Điểm.
//   Thông báo của lớp (TB-LOP) ở cuối trang lớp (chưa có tin ⇒ một dòng chữ mờ); ?tab=thong-bao (link từ chuông) cuộn thẳng tới đó. Lối phụ (hỏi gia sư, phiếu học phí
//   theo cờ) nằm ở đầu trang; điểm của lớp ở mục Điểm trên thanh dưới.
// Giữ từ trước: rà soát 28/10 (Content dựng lại theo ID lớp; lỗi tải danh sách lớp là LỖI, không phải "chưa vào lớp"), MD-07/NC2-042 (bản ghi theo tháng),
// Q4 (YouTube xem tại chỗ qua youtube-nocookie), lớp đã nghỉ → SuspendedNotice.
"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, Suspense, type ReactNode } from "react";
import { groupRecordingsBySession, groupRecordingsByMonth, type RecordingMonthGroup } from "@/lib/classRecordings";
import { classifyMediaLink, firstPlayableVideo } from "@/lib/mediaLink";
import { parseMaterials } from "@/components/media/StudentLessonPanels";
import { useMyClasses } from "@/hooks/useMyClasses";
import { KinFold, KinChevron } from "@/components/kin/Fold";
import { parseLessonType } from "@/lib/types";
import { ErrorStrip } from "@/components/kin/shell/Outlook";
import { kinButtonClass } from "@/components/kin/Button";
import { KinListRow } from "@/components/kin/ListRow";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { KinCallout } from "@/components/kin/Callout";
import { KinPanel } from "@/components/kin/Panel";
import { TRIAL_DAYS, TRIAL_WARN_DAYS } from "@/lib/trial";
import { useStudentWork, WorkSkeleton } from "@/components/student/shared";
import { SuspendedNotice } from "@/components/student/SuspendedNotice";
import ThuVienLop from "@/components/student/ThuVienLop";
import ThongBaoHocSinh from "@/components/student/ThongBaoHocSinh";
import { DaNopCard, IconTaiLieu, IconVideo, NopDock, TodoCardView } from "@/components/student/CanLam";
import { featureOn, isLinkHidden } from "@/lib/features";
import { classAccentFor } from "@/lib/classColor";
import { nopTepResultMessage } from "@/lib/nopTep";
import { orderedLessonIds } from "@/lib/studentLop";
import { buildTodoCards, lessonDate, matchesQuery, newestFirst, scheduleLine, vnDayLabel } from "@/lib/studentClassPage";

interface Lesson {
  id: string; code: string; title: string; type: string; duration?: string | null; isLocked: boolean; isFree: boolean; documents?: string | null;
  status?: string | null; azotaUrl?: string | null; scheduledAt?: string | null; createdAt?: string | null; _count?: { assignments?: number }; order?: number; videoUrl?: string | null;
}
interface Rec { id: string; title: string; url: string; kind: string; sessionId: string | null; createdAt: string }
interface RecData { recordings: Rec[]; sessions: { id: string; dateKey: string }[] }
const REC_KIND: Record<string, string> = { youtube: "YouTube", vimeo: "Vimeo", drive: "Google Drive", zoom_record: "Zoom cloud" };
const dmy = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}/${k.slice(0, 4)}`;
type RecRow = Omit<Rec, "createdAt"> & { createdAt: Date };
const GOC = "text-[length:var(--kin-co-goc)]";
const RECENT = 5; // "Buổi gần đây": 5 hàng mới nhất, còn lại ở Tất cả bài học

/** NC2-042: bản ghi theo tháng; bấm tiêu đề tháng để thu gọn / mở. Tháng mới nhất mở sẵn, các tháng cũ gập lại. */
function RecordingMonths({ months }: { months: RecordingMonthGroup<RecRow>[] }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [playing, setPlaying] = useState<string | null>(null);
  return (
    <div data-recording-months>
      {months.map((m, idx) => {
        const isOpen = open[m.key] ?? idx === 0;
        const panelId = `rec-thang-${m.key}`;
        return (
          <section key={m.key} data-recording-month={m.key} aria-label={m.label}>
            <h3>
              <button type="button" aria-expanded={isOpen} aria-controls={panelId} onClick={() => setOpen(o => ({ ...o, [m.key]: !isOpen }))}
                className="w-full flex items-center justify-between gap-3 min-h-11 px-[var(--kin-kc-6)] border-b border-[var(--kin-vien-nhat)] text-left text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)] hover:bg-[var(--kin-nen-re-chuot)] transition-colors">
                <span><span className="font-medium">{m.label}</span><span className="text-[var(--kin-chu-mo)]"> · {m.items.length} bản ghi</span></span>
                <KinChevron open={isOpen} />
              </button>
            </h3>
            <KinFold open={isOpen} id={panelId}>
              <ul>
                {m.items.map(({ rec: r, sessionDateKey }) => (
                  <li key={r.id} data-recording-row className="flex flex-wrap items-start justify-between gap-3 px-[var(--kin-kc-6)] py-[var(--kin-kc-6)] border-b border-[var(--kin-vien-nhat)] text-[length:var(--kin-co-goc)]">
                    <div className="min-w-0 flex-1">
                      <p className="text-[var(--kin-chu-chinh)] break-words">{r.title}</p>
                      <p className="mt-1 text-[var(--kin-chu-mo)]">{sessionDateKey ? `Buổi ${dmy(sessionDateKey)}` : "Chưa gắn buổi"} · {REC_KIND[r.kind] ?? "Liên kết ngoài"} · có thể cần quyền truy cập</p>
                    </div>
                    {(() => {
                      // Q4: YouTube xem NGAY tại đây qua youtube-nocookie (địa chỉ nhúng do KiN dựng lại từ mã video, không dùng nguyên link). Nguồn khác mở tab mới.
                      const info = r.kind === "youtube" ? classifyMediaLink(r.url) : null;
                      if (!info?.ok || info.kind !== "youtube" || !info.embedUrl) return <a href={r.url} target="_blank" rel="noopener noreferrer" aria-label={`Mở bản ghi ${r.title}`} className={kinButtonClass("secondary")}>Mở ↗</a>;
                      return <button type="button" aria-expanded={playing === r.id} aria-label={`${playing === r.id ? "Ẩn" : "Xem"} bản ghi ${r.title}`} onClick={() => setPlaying(p => (p === r.id ? null : r.id))} className={kinButtonClass("secondary")}>{playing === r.id ? "Ẩn" : "Xem"}</button>;
                    })()}
                    {playing === r.id && (() => {
                      const info = classifyMediaLink(r.url);
                      return info.ok && info.embedUrl ? (
                        <div className="basis-full relative w-full" style={{ paddingBottom: "56.25%" }}>
                          <iframe title={`Bản ghi ${r.title}`} data-ban-ghi-video src={info.embedUrl} className="absolute inset-0 w-full h-full border-0 rounded-[var(--kin-bo-md)]" loading="lazy" referrerPolicy="strict-origin-when-cross-origin"
                            sandbox="allow-scripts allow-same-origin allow-presentation" allow="fullscreen; picture-in-picture" allowFullScreen />
                        </div>
                      ) : null;
                    })()}
                  </li>
                ))}
              </ul>
            </KinFold>
          </section>
        );
      })}
    </div>
  );
}
interface Chapter { id: string; title: string; order: number; isImplicit?: boolean; lessons: Lesson[] }
interface Section { id: string; title: string; order: number; chapters: Chapter[] }
interface Course {
  id: string; name: string; instructor: string; category: string; calendarColor?: string | null; sections: Section[]; suspended?: { contactHref: string | null };
  /** SCL đợt 5: học thử còn hạn / chưa bắt đầu (từ /api/courses/[id]); trialExpired ⇒ thẻ khoá. */
  trial?: { kind: "dang_thu"; daysLeft: number } | { kind: "chua_bat_dau" }; trialExpired?: boolean;
}

/** SCL đợt 5 (D7): hết hạn học thử — lớp khoá hẳn, chỉ còn đường đăng ký chính thức và Zalo anh Thanh. Không tên, không tiền. */
function TrialLocked() {
  return (
    <div data-trial-khoa className="pt-6">
      <KinEmptyState title="Hết thời gian học thử" action={
        <div className="flex flex-wrap justify-center gap-3">
          <a href="https://aodtsix-cmd.github.io/bca-midnight-class/" target="_blank" rel="noopener noreferrer" data-dang-ky-chinh-thuc className={kinButtonClass("primary")}>Đăng ký chính thức</a>
          <a href="https://zalo.me/0384409051" target="_blank" rel="noopener noreferrer" className={kinButtonClass("secondary")}>Nhắn Zalo anh Thanh</a>
        </div>
      }>
        14 ngày học thử của lớp này đã hết. Tài liệu và bài tập đang khoá. Đăng ký chính thức để học tiếp, bài đã nộp và điểm vẫn được giữ.
      </KinEmptyState>
    </div>
  );
}

/** Băng học thử (tình huống 9, 10): chưa bắt đầu / vừa bắt đầu hôm nay (trang máy chủ đã mở đồng hồ trước khi tải lớp) ⇒ "Bắt đầu tính 14 ngày từ hôm nay"; còn ≤ 3 ngày ⇒ tone cảnh báo. */
function TrialBand({ t }: { t: NonNullable<Course["trial"]> }) {
  const warn = t.kind === "dang_thu" && t.daysLeft <= TRIAL_WARN_DAYS;
  return (
    <KinPanel variant={warn ? "canh-bao" : "nhan"} data-trial-bang={warn ? "canh-bao" : "nhan"} className="mt-4">
      <p className={`${GOC} font-medium text-[var(--kin-chu-chinh)]`}>{t.kind === "dang_thu" && t.daysLeft < TRIAL_DAYS ? `Học thử · còn ${t.daysLeft} ngày` : `Bắt đầu tính ${TRIAL_DAYS} ngày học thử từ hôm nay`}</p>
      {warn && <p className={`mt-1 ${GOC} text-[var(--kin-chu-phu)]`}>Sắp hết hạn học thử. <a href="https://aodtsix-cmd.github.io/bca-midnight-class/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center min-h-11 text-[var(--kin-nhan-link)] underline">Đăng ký chính thức</a> để học tiếp.</p>}
    </KinPanel>
  );
}

/** Sắp theo (order, id) như studentLopServer.ts (orderBy [order, id]). Trả BẢN SAO, không đổi mảng gốc. */
function byOrderId<T extends { id: string; order?: number }>(a: T, b: T): number {
  const d = (a.order ?? 0) - (b.order ?? 0);
  return d !== 0 ? d : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
function sortTree(sections: Section[]): Section[] {
  return [...sections].sort(byOrderId).map(s => ({
    ...s,
    chapters: [...(s.chapters ?? [])].sort(byOrderId).map(c => ({ ...c, lessons: [...(c.lessons ?? [])].sort(byOrderId) })),
  }));
}

const Chevron = () => <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>;
const IconBaiTapNho = () => <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 12l2 2 4-4" /></svg>;
const part = (icon: ReactNode, text: string) => <span className="inline-flex items-center gap-1">{icon}{text}</span>;

/** Hàng một bài (§3.3, KinListRow 56px): tên; dòng phụ "Thứ Ba 17/11 · Video 42 phút · 2 tài liệu · Bài tập | Đã chấm 8,5/10". Cả hàng là link thật. */
function LessonRow({ l, grade, linked }: { l: Lesson; grade?: string; linked: boolean }) {
  const d = lessonDate(l);
  const video = parseLessonType(l.type) === "record" || firstPlayableVideo(l.videoUrl) !== null;
  const docs = parseMaterials(l.documents).length;
  const hw = (l._count?.assignments ?? 0) > 0 || !!l.azotaUrl;
  const parts = [
    d && <span key="d">{vnDayLabel(d)}</span>,
    video && <span key="v">{part(<IconVideo />, l.duration ? `Video ${l.duration}` : "Video")}</span>,
    docs > 0 && <span key="t">{part(<IconTaiLieu />, `${docs} tài liệu`)}</span>,
    grade ? <span key="g" className="font-medium text-[var(--kin-tt-chu-xong)]">{part(<IconBaiTapNho />, `Đã chấm ${grade}`)}</span> : hw && <span key="b">{part(<IconBaiTapNho />, "Bài tập")}</span>,
  ].filter(Boolean);
  return (
    <li data-lesson-row={l.id} data-co-video={video ? "1" : undefined}>
      <KinListRow size="lg" href={linked ? `/student/bai-giang/${l.id}` : undefined} title={l.title} aside={linked ? <Chevron /> : undefined}
        sub={parts.length ? <span className="flex flex-wrap gap-x-3 gap-y-0.5">{parts}</span> : undefined} />
    </li>
  );
}

/** Bản ghi một buổi học (không phải bài): mở ở màn Tất cả bài học, nơi YouTube xem ngay tại chỗ. */
function RecordingRow({ r, dateKey, href }: { r: Rec; dateKey: string | null; href: string }) {
  const day = dateKey ? vnDayLabel(new Date(`${dateKey}T12:00:00+07:00`)) : vnDayLabel(new Date(r.createdAt));
  return (
    <li data-recording-row-ngan={r.id} data-co-video="1">
      <KinListRow size="lg" href={href} title={r.title} aside={<Chevron />}
        sub={<span className="flex flex-wrap gap-x-3 gap-y-0.5"><span>{day}</span><span>{part(<IconVideo />, "Bản ghi buổi học")}</span></span>} />
    </li>
  );
}

const H2 = "text-[length:var(--kin-co-tieu-de)] leading-6 font-semibold text-[var(--kin-chu-chinh)]";

function Content({ courseId, view, focusThongBao, nop, bt }: { courseId: string; view: "lop" | "bai-hoc"; focusThongBao: boolean; nop: string | null; bt: string | null }) {
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  const [q, setQ] = useState("");
  const { classes, loading: enrollmentsLoading, error: classesError, reload: reloadClasses } = useMyClasses();
  const work = useStudentWork();

  useEffect(() => {
    let live = true;
    void Promise.resolve().then(() => { if (live) { setLoading(true); setError(""); } });
    fetch(`/api/courses/${encodeURIComponent(courseId)}`, { credentials: "same-origin" })
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data: Course) => { if (live && data.id === courseId) setCourse(data); else if (live) setError("Không tìm thấy khóa học"); })
      .catch(() => { if (live) setError("Không tìm thấy khóa học"); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [courseId, tick]);

  // MD-07: bản ghi theo buổi của lớp. Chỉ hỏi khi đã ghi danh (API trả 403 cho người chưa vào lớp).
  const enrolledHere = classes.some(c => c.id === courseId);
  const [recs, setRecs] = useState<RecData | "loi" | null>(null);
  const [recTick, setRecTick] = useState(0);
  useEffect(() => {
    if (!enrolledHere) return;
    let live = true;
    fetch(`/api/courses/${encodeURIComponent(courseId)}/recordings`, { credentials: "same-origin" })
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: RecData) => { if (live) setRecs({ recordings: d.recordings, sessions: d.sessions }); })
      .catch(() => { if (live) setRecs("loi"); });
    return () => { live = false; };
  }, [courseId, enrolledHere, recTick]);

  const sections = useMemo(() => sortTree(course?.sections ?? []), [course]);
  const ids = useMemo(() => new Set(orderedLessonIds(sections)), [sections]); // chỉ bài Đã đăng
  const lessons = useMemo(() => sections.flatMap(s => s.chapters.flatMap(c => c.lessons)).filter(l => ids.has(l.id)), [sections, ids]);
  // Điểm đã chấm của từng bài (việc của tôi giữ bài đã chấm 14 ngày): "8,5/10" theo mã bài trong đường dẫn bài.
  const grades = useMemo(() => {
    const m = new Map<string, string>();
    for (const i of work.items ?? []) if (i.task?.phase === "da-cham" && i.task.scoreText) m.set(i.task.href.split("/").pop() ?? "", i.task.scoreText);
    return m;
  }, [work.items]);
  const thongBaoReady = !!course && !loading;
  useEffect(() => {
    if (focusThongBao && thongBaoReady) document.getElementById("lop-thong-bao")?.scrollIntoView({ block: "start" });
  }, [focusThongBao, thongBaoReady]);
  // #ban-ghi (link "bản ghi" của gia sư, hàng bản ghi ở Buổi gần đây): mục chỉ có sau khi tải xong nên trình duyệt không tự cuộn tới được.
  const recsReady = recs !== null;
  useEffect(() => {
    if (view === "bai-hoc" && thongBaoReady && recsReady && window.location.hash === "#ban-ghi") document.getElementById("ban-ghi")?.scrollIntoView({ block: "start" });
  }, [view, thongBaoReady, recsReady]);

  const wrap = (children: ReactNode) => <div className="px-4 md:px-10 pt-5 md:pt-8 pb-32 max-w-[800px] bg-[var(--kin-nen-trang)]">{children}</div>;
  const title = (t: string) => <h1 className="text-[length:var(--kin-co-h2)] leading-9 font-bold tracking-[-0.01em] text-[var(--kin-chu-chinh)] [overflow-wrap:anywhere]">{t}</h1>;

  if (!enrollmentsLoading && classesError) return wrap(<>{title("Lớp của tôi")}<div className="pt-4"><ErrorStrip message="Không tải được danh sách lớp của bạn." onRetry={reloadClasses} /></div></>);
  if (loading || enrollmentsLoading) return wrap(<>{title("Lớp của tôi")}<WorkSkeleton label="Đang tải trang lớp" /></>);
  if (error || !course) {
    return wrap(<>{title("Lớp của tôi")}
      <div className="pt-4"><ErrorStrip message={error || "Không tìm thấy khóa học — có thể bạn đã rời lớp hoặc lớp đã đóng."} onRetry={() => setTick(t => t + 1)} /></div>
      <div className="pt-4"><Link href="/student/hoc-tap" data-all-classes className="inline-flex items-center min-h-11 text-[var(--kin-nhan-link)] underline">Về Lớp của tôi</Link></div></>);
  }
  if (course.trialExpired) return wrap(<>{title(course.name)}<TrialLocked /></>);
  if (course.suspended) return wrap(<>{title(course.name)}<SuspendedNotice contactHref={course.suspended.contactHref} /></>);

  const color = classAccentFor(course.id, course.calendarColor);
  const lopHref = `/student/hoc-tap?course=${encodeURIComponent(courseId)}`;
  const allHref = `${lopHref}&xem=bai-hoc`;
  const sessionOf = new Map((typeof recs === "object" && recs ? recs.sessions : []).map(s => [s.id, s.dateKey]));
  const recList = typeof recs === "object" && recs ? recs.recordings : [];

  // ── Màn "Tất cả bài học" ──
  if (view === "bai-hoc") {
    const chapters = sections.flatMap(s => s.chapters)
      .map(c => ({ ...c, lessons: newestFirst(c.lessons.filter(l => ids.has(l.id) && matchesQuery(l.title, q))) }))
      .filter(c => c.lessons.length > 0).reverse(); // chương mới nhất (cuối giáo trình) lên đầu
    const shown = chapters.reduce((n, c) => n + c.lessons.length, 0);
    return wrap(<>
      <Link href={lopHref} data-ve-lop className={`inline-flex items-center gap-1 min-h-11 -ml-1 pr-3 ${GOC} text-[var(--kin-nhan-link)] underline [overflow-wrap:anywhere]`}>← {course.name}</Link>
      {title("Tất cả bài học")}
      <p className={`mt-1 ${GOC} text-[var(--kin-chu-phu)]`}>{lessons.length} bài, mới nhất ở trên</p>
      <label className="block mt-4">
        <span className={`block ${GOC} font-medium text-[var(--kin-chu-chinh)]`}>Tìm bài học theo tên</span>
        <input type="search" value={q} onChange={e => setQ(e.target.value)} data-tim-bai autoComplete="off"
          className="mt-1.5 w-full min-h-12 px-3 rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-trang)] text-[length:var(--kin-co-body)] text-[var(--kin-chu-chinh)]" />
      </label>
      {lessons.length === 0 ? <div className="pt-6"><KinEmptyState title="Lớp chưa có bài học nào">Khi gia sư đăng bài học, danh sách sẽ hiện ở đây.</KinEmptyState></div>
        : shown === 0 ? <p role="status" className={`pt-6 ${GOC} text-[var(--kin-chu-phu)]`}>Không có bài nào có tên khớp “{q.trim()}”.</p>
        : chapters.map(c => (
          <section key={c.id} aria-labelledby={`chuong-${c.id}`} data-chuong={c.id} className="mt-6">
            <div className="flex items-baseline justify-between gap-3 pb-2">
              <h2 id={`chuong-${c.id}`} className={`${H2} [overflow-wrap:anywhere]`}>{c.isImplicit || !c.title.trim() ? "Bài học" : c.title}</h2>
              <span className={`${GOC} text-[var(--kin-chu-phu)] flex-shrink-0`}>{c.lessons.length} bài</span>
            </div>
            <ul className="border-t border-[var(--kin-vien-nhat)]">{c.lessons.map(l => <LessonRow key={l.id} l={l} grade={grades.get(l.id)} linked={!l.isLocked} />)}</ul>
          </section>
        ))}
      {enrolledHere && (
        <section id="ban-ghi" aria-labelledby="ban-ghi-h" data-ban-ghi className="mt-10 scroll-mt-4">
          <h2 id="ban-ghi-h" className={`${H2} pb-2`}>Bản ghi các buổi học</h2>
          {recs === null ? <p role="status" className={`py-4 ${GOC} text-[var(--kin-chu-phu)]`}>Đang tải bản ghi…</p>
            : recs === "loi" ? <ErrorStrip message="Chưa tải được bản ghi của lớp." onRetry={() => { setRecs(null); setRecTick(t => t + 1); }} />
            : recs.recordings.length === 0 ? <KinEmptyState title="Chưa có bản ghi nào">Khi gia sư dán link bản ghi sau buổi học, nó sẽ hiện ở đây.</KinEmptyState>
            : <RecordingMonths months={groupRecordingsByMonth(groupRecordingsBySession(recs.recordings.map(r => ({ ...r, createdAt: new Date(r.createdAt) })), recs.sessions))} />}
          <KinCallout title="Bản ghi là link gia sư chia sẻ" className="mt-4">Bản ghi YouTube xem được ngay ở đây; nguồn khác mở ở tab mới. KiN không biết bạn đã xem hay chưa.</KinCallout>
        </section>
      )}
    </>);
  }

  // ── Trang lớp ──
  const teacher = course.instructor?.trim() && course.instructor.trim().toLowerCase() !== "kin" ? course.instructor.trim() : "";
  const events = work.events ?? [];
  // Lịch học ở đầu trang = lịch TUẦN của lớp (buổi dạy bù / buổi lẻ không đổi "Tối thứ Ba, thứ Năm").
  const sched = scheduleLine(events.filter(e => e.type === "class" && e.courseId === courseId && (e.sessionKind ?? "regular") === "regular" && !e.topic.startsWith("[ĐÃ HUỶ]")));
  const now = new Date();
  const cards = work.items ? buildTodoCards(work.items, events, now, id => classes.find(c => c.id === id)?.name ?? "", { id: courseId, name: course.name }) : null;
  const primary = cards?.find(c => c.primary && c.action.type !== "thi") ?? null;
  const sent = nop === "ok" && bt ? (work.items ?? []).find(i => i.id === `bai-tap:${bt}` && i.task && i.task.phase !== "chua-nop") ?? null : null;
  const nopErr = nop && nop !== "ok" ? nopTepResultMessage(nop) : null;

  type Recent = { t: number; node: ReactNode };
  const recent: Recent[] = [
    ...lessons.map(l => ({ t: lessonDate(l)?.getTime() ?? -Infinity, node: <LessonRow key={l.id} l={l} grade={grades.get(l.id)} linked={enrolledHere && !l.isLocked} /> })),
    ...recList.map(r => {
      const k = r.sessionId ? sessionOf.get(r.sessionId) ?? null : null;
      return { t: k ? Date.parse(`${k}T12:00:00+07:00`) : Date.parse(r.createdAt), node: <RecordingRow key={`r-${r.id}`} r={r} dateKey={k} href={`${allHref}#ban-ghi`} /> };
    }),
  ].sort((a, b) => b.t - a.t);

  return wrap(<>
    <header data-dau-lop>
      <div aria-hidden data-vach-lop className="h-1 w-16 rounded-[var(--kin-bo-tron)] mb-3" style={{ background: color }} />
      {title(course.name)}
      {(teacher || sched) && <p className={`mt-1 ${GOC} text-[var(--kin-chu-phu)] [overflow-wrap:anywhere]`}>{[teacher, sched].filter(Boolean).join(" · ")}</p>}
      {course.trial && <TrialBand t={course.trial} />}
      {/* Lối phụ của lớp gom lên đầu trang (không còn khối link lẻ cuối trang). LOI-01: hỏi gia sư TRONG lớp khi bảng tin chung ẩn; DG: Phiếu học phí theo cờ HOC_PHI (chỉ chữ, KHÔNG số tiền). */}
      {enrolledHere && (!featureOn("CONG_DONG") || !isLinkHidden("/student/hoc-phi")) && (
        <p data-lop-thong-tin className={`flex flex-wrap gap-x-4 ${GOC}`}>
          {!featureOn("CONG_DONG") && <Link href={`/cong-dong?scope=${encodeURIComponent(courseId)}`} data-hoi-trong-lop className="inline-flex items-center min-h-11 text-[var(--kin-nhan-link)] underline">Hỏi gia sư trong lớp</Link>}
          {!isLinkHidden("/student/hoc-phi") && <Link href="/student/hoc-phi" data-lop-hoc-phi className="inline-flex items-center min-h-11 text-[var(--kin-nhan-link)] underline">Phiếu học phí của bạn</Link>}
        </p>
      )}
    </header>

    {!enrolledHere ? (
      <div className="pt-6">
        <KinEmptyState title="Bạn chưa vào lớp này" action={<Link href={`/khoa-hoc/${courseId}`} className={kinButtonClass("primary")}>Xem lớp học</Link>}>
          Vào lớp bằng mã mời của gia sư để nộp bài, xem video và bản ghi.
        </KinEmptyState>
      </div>
    ) : (
      <section aria-labelledby="lop-can-lam" data-lop-can-lam className="mt-6">
        <h2 id="lop-can-lam" className={`${H2} flex items-center gap-2`}>
          Cần làm{cards && cards.length > 0 && <span data-dem-can-lam className="inline-grid place-items-center min-w-6 h-6 px-1.5 rounded-[var(--kin-bo-tron)] bg-[var(--kin-nhan-nen)] text-[var(--kin-nhan-chu-tren-nen)] text-[length:var(--kin-co-goc)] tabular-nums">{cards.length}</span>}
        </h2>
        {nop === "ok" && <p role="status" data-nop-xong className={`mt-3 ${GOC} font-medium text-[var(--kin-tt-chu-xong)]`}>Đã nộp {sent?.task?.name ?? "bài"}. Gia sư sẽ chấm và báo điểm cho bạn.</p>}
        {nopErr && <p role="alert" className={`mt-3 ${GOC} font-medium text-[var(--kin-tt-chu-loi-dam)]`}>{nopErr}</p>}
        <div className="mt-3 space-y-3">
          {sent?.task && <DaNopCard title={sent.task.name} line={(sent.task.sentText ?? "Đã nộp").replace(/^Nộp /, "Đã nộp ")} href={sent.task.href} />}
          {work.error && !work.items ? <ErrorStrip message="Không tải được việc cần làm." onRetry={work.load} />
            : cards === null ? <div aria-busy="true" aria-label="Đang tải việc cần làm" className="h-[140px] rounded kin-skel kin-skel--soft" />
            : cards.length === 0 ? <p className={`${GOC} text-[var(--kin-chu-phu)]`}>Lớp này chưa có việc nào cần làm. Bài gia sư giao sẽ hiện ở đây.</p>
            : cards.map(c => <TodoCardView key={c.key} card={c} now={now} ve="lop" />)}
        </div>
      </section>
    )}

    <section aria-labelledby="lop-gan-day" data-lop-gan-day className="mt-8">
      <h2 id="lop-gan-day" className={`${H2} pb-2`}>Buổi gần đây</h2>
      {recent.length === 0 ? <KinEmptyState title="Lớp chưa có bài học nào">Khi gia sư đăng bài học, danh sách sẽ hiện ở đây.</KinEmptyState>
        : <ul className="border-t border-[var(--kin-vien-nhat)]">{recent.slice(0, RECENT).map(r => r.node)}</ul>}
      {recs === "loi" && <div className="mt-3"><ErrorStrip message="Chưa tải được bản ghi của lớp." onRetry={() => { setRecs(null); setRecTick(t => t + 1); }} /></div>}
      {lessons.length > 0 && (
        <Link href={allHref} data-tat-ca-bai className={`mt-2 inline-flex items-center gap-1 min-h-11 ${GOC} font-medium text-[var(--kin-nhan-link)] underline`}>Tất cả bài học ({lessons.length})<Chevron /></Link>
      )}
    </section>

    {enrolledHere && (
      <section id="lop-thong-bao" className="mt-10 scroll-mt-4">
        <ThongBaoHocSinh courseId={courseId} enrolled heading={<h2 id="lop-thong-bao-h" className={`${H2} pb-2`}>Thông báo của lớp</h2>} />
      </section>
    )}
    {primary && !sent && <NopDock card={primary} now={now} />}
  </>);
}

/** Không ?course= ⇒ thư viện lớp. Có ?course= ⇒ trang lớp (hoặc ?xem=bai-hoc ⇒ Tất cả bài học), dựng lại theo ID lớp: đổi lớp không mang state lớp trước sang. */
function PerCourse() {
  const searchParams = useSearchParams();
  const course = searchParams.get("course") ?? ""; // giữ đúng chữ này: t-links.ts:102 khoá việc trang đọc ?course=
  if (!course) return <ThuVienLop />;
  return <Content key={course} courseId={course} view={searchParams.get("xem") === "bai-hoc" ? "bai-hoc" : "lop"} focusThongBao={searchParams.get("tab") === "thong-bao"}
    nop={searchParams.get("nop")} bt={searchParams.get("bt")} />;
}

export default function LopCuaToi() {
  return <Suspense><PerCourse /></Suspense>;
}
