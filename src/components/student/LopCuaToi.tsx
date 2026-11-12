// Lớp của tôi của học sinh. LOI-03 (11/11/2026, đặc tả docs/kin/phong-ban/dac-ta/LOI-03.md mục 4.1–4.2):
//   - Không ?course= ⇒ THƯ VIỆN LỚP (components/student/ThuVienLop) — LUÔN, kể cả khi chỉ có 1 lớp (Q1: bỏ tự nhảy vào lớp của NC2-041).
//   - ?course=<id> ⇒ TRANG LỚP: "← Lớp của tôi", h1 = tên lớp, dòng phụ "Môn · Gia sư: …"; hai tab Tổng quan · Nội dung (mặc định Nội dung).
//       Nội dung  = "Nội dung lớp: n chương · m bài" + cây CourseOutline (thẻ chương có số "01", dòng phụ bài "1 tài liệu · Có bài tập · Học Hôm nay · 19:30").
//       Tổng quan = Thông tin lớp (gia sư, môn, bài cần làm / chờ chấm, chữ "Phiếu học phí của bạn →" — KHÔNG số tiền), Tài liệu & bản ghi (nguyên tab cũ), Bài tập của lớp.
//     Cột phải: thẻ tiến độ [data-course-hero] (nút "Học tiếp →" theo hocTiep: bài đang xem dở đầu tiên → bài chưa xong đầu tiên → xong hết thì "Xem lại →"),
//     "Buổi học sắp tới", "Các lớp của bạn" (≥ 2 lớp). Điện thoại: thẻ tiến độ lên TRƯỚC dải tab. Không có "Đánh giá", không "lượt xem".
//   x/y, % và "Học tiếp" tính bằng CÙNG hàm thuần với máy chủ (src/lib/studentLop.ts: orderedLessonIds / lopProgress / hocTiep) ⇒ thư viện và trang lớp không lệch nhau.
// Giữ từ trước: NC2-041 (đổi lớp; đếm bài theo ID lớp), NC2-042 (bản ghi theo THÁNG, gập/mở), rà soát 28/10 (Content dựng lại theo ID lớp — phản hồi chậm của lớp trước
// không lọt sang; lỗi tải danh sách lớp là LỖI, không phải "chưa vào lớp"), MD-07/SV-03 (Tài liệu & bản ghi gộp 3 nguồn của chính lớp), lớp đã nghỉ → SuspendedNotice.
// BỎ vì chưa có dữ liệu thật: "Liên hệ cô …", "Hoạt động buổi học", tab "Thông báo", "n học sinh", dung lượng tệp, "Học trực tuyến", "Đánh giá".
"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, Suspense } from "react";
import { useProgress } from "@/hooks/useProgress";
import { groupRecordingsBySession, groupRecordingsByMonth, type RecordingMonthGroup } from "@/lib/classRecordings";
import { planDocumentPreview } from "@/lib/mediaLink";
import { viewerHref } from "@/lib/library";
import { vnDateKeyOf } from "@/lib/classSessions";
import { parseMaterials } from "@/components/media/StudentLessonPanels";
import { useMyClasses } from "@/hooks/useMyClasses";
import { KinFold, KinChevron } from "@/components/kin/Fold";
import { parseLessonType } from "@/lib/types";
import { ErrorStrip } from "@/components/kin/shell/Outlook";
import { kinButtonClass } from "@/components/kin/Button";
import { KinTabs } from "@/components/kin/Tabs";
import { KinSectionHead } from "@/components/kin/SectionHead";
import { KinCallout } from "@/components/kin/Callout";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { KinStatus } from "@/components/kin/Status";
import { dayTitle, useStudentWork, WorkSkeleton } from "@/components/student/shared";
import { placeLabel } from "@/lib/sessionBook";
import { SuspendedNotice } from "@/components/student/SuspendedNotice";
import CourseOutline, { type OutlineSection } from "@/components/student/CourseOutline";
import ThuVienLop from "@/components/student/ThuVienLop";
import { featureOn } from "@/lib/features";
import { contentSummary, giaSuLabel, hocTiep, hocTiepLabel, lessonMetaParts, lopProgress, orderedLessonIds } from "@/lib/studentLop";

interface Lesson {
  id: string; code: string; title: string; type: string; duration?: string | null; isLocked: boolean; isFree: boolean; documents?: string | null;
  status?: string | null; azotaUrl?: string | null; scheduledAt?: string | null; _count?: { assignments?: number }; order?: number;
}
interface Rec { id: string; title: string; url: string; kind: string; sessionId: string | null; createdAt: string }
interface RecData { recordings: Rec[]; sessions: { id: string; dateKey: string }[] }
const REC_KIND: Record<string, string> = { youtube: "YouTube", vimeo: "Vimeo", drive: "Google Drive", zoom_record: "Zoom cloud" };
const dmy = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}/${k.slice(0, 4)}`;
type RecRow = Omit<Rec, "createdAt"> & { createdAt: Date };
const GOC = "text-[length:var(--kin-co-goc)]";

/** NC2-042: bản ghi theo tháng; bấm tiêu đề tháng để thu gọn / mở. Tháng mới nhất mở sẵn, các tháng cũ gập lại. */
function RecordingMonths({ months }: { months: RecordingMonthGroup<RecRow>[] }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
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
                  <li key={r.id} data-recording-row className="flex items-start justify-between gap-3 px-[var(--kin-kc-6)] py-[var(--kin-kc-6)] border-b border-[var(--kin-vien-nhat)] text-[length:var(--kin-co-goc)]">
                    <div className="min-w-0 flex-1">
                      <p className="text-[var(--kin-chu-chinh)] break-words">{r.title}</p>
                      <p className="mt-1 text-[var(--kin-chu-mo)]">{sessionDateKey ? `Buổi ${dmy(sessionDateKey)}` : "Chưa gắn buổi"} · {REC_KIND[r.kind] ?? "Liên kết ngoài"} · có thể cần quyền truy cập</p>
                    </div>
                    <a href={r.url} target="_blank" rel="noopener noreferrer" aria-label={`Mở bản ghi ${r.title}`} className={kinButtonClass("secondary")}>Mở ↗</a>
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
interface Course { id: string; name: string; instructor: string; category: string; hours: number; lessons: number; sections: Section[]; suspended?: { contactHref: string | null } }

type Tab = "tong-quan" | "noi-dung";

/** Sắp theo (order, id) như studentLopServer.ts (orderBy [order, id]): /api/courses/[id] chỉ sắp theo `order`, khi hoà `order` thứ tự có thể khác
 *  ⇒ "Học tiếp" và x/y ở trang lớp lệch thư viện. Trả BẢN SAO, không đổi mảng gốc. */
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
const TYPE_LABEL: Record<string, string> = { record: "Bản ghi", live: "Học trực tiếp", quiz: "Bài tập", document: "Tài liệu" };

function Content({ courseId }: { courseId: string }) {
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  const [tab, setTab] = useState<Tab>("noi-dung");
  const { completedIds, watching, loading: progressLoading } = useProgress();
  const { classes, loading: enrollmentsLoading, error: classesError, reload: reloadClasses } = useMyClasses();
  const enrolledIds = useMemo(() => new Set(classes.map(c => c.id)), [classes]);
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

  // MD-07: bản ghi theo buổi của lớp. Chỉ hỏi khi đã ghi danh (API trả 403 cho người chưa vào lớp, nên không hỏi vô ích).
  const enrolledHere = enrolledIds.has(courseId);
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

  // Cây đã sắp (order, id) — mọi phép tính (orderedLessonIds / lopProgress / hocTiep / tóm tắt) và cây CourseOutline đều dùng bản này.
  const sections = useMemo(() => sortTree(course?.sections ?? []), [course]);
  const allLessons = useMemo(() => sections.flatMap(s => s.chapters.flatMap(c => c.lessons)), [sections]);
  // Cùng hàm với /api/student/lop: chỉ bài Đã đăng theo thứ tự giáo trình; tiến độ chỉ đếm id thuộc lớp này.
  const ids = useMemo(() => orderedLessonIds(sections), [sections]);
  const prog = useMemo(() => lopProgress(ids, completedIds), [ids, completedIds]);
  const watchingSet = useMemo(() => new Set(Object.keys(watching)), [watching]);
  const lockedSet = useMemo(() => new Set(allLessons.filter(l => l.isLocked).map(l => l.id)), [allLessons]);
  const next = useMemo(() => hocTiep(ids, completedIds, watchingSet, lockedSet), [ids, completedIds, watchingSet, lockedSet]);
  const nextLesson = next.lessonId ? allLessons.find(l => l.id === next.lessonId) ?? null : null;
  // Nhãn "Hôm nay / Ngày mai" ở dòng phụ bài: ngày VN theo đồng hồ trình duyệt (chỉ là chữ hiển thị, không quyết quyền).
  const todayKey = useMemo(() => vnDateKeyOf(new Date()), []);
  const outlineSections = useMemo<OutlineSection[]>(() => sections.map(s => ({
    id: s.id, title: s.title,
    chapters: s.chapters.map(c => ({
      id: c.id, title: c.title,
      lessons: c.lessons.map(l => ({
        id: l.id, title: l.title, isLocked: l.isLocked,
        meta: lessonMetaParts({ documents: l.documents, azotaUrl: l.azotaUrl, assignmentCount: l._count?.assignments, scheduledAt: l.scheduledAt }, todayKey).join(" · ") || undefined,
      })),
    })),
  })), [sections, todayKey]);
  const summary = useMemo(() => contentSummary(sections), [sections]);
  // LOI-03 (vòng test 2): lớp có bài Đã đăng hẹn ngày học từ hôm nay (ngày VN) trở đi ⇒ ngày học đã hiện ở từng dòng bài; khi lịch buổi học rỗng thì
  // KHÔNG vẽ khối "Buổi học sắp tới" (tránh hai khối nói ngược nhau: "chưa có buổi học nào" cạnh "Học Hôm nay · 19:30").
  const hasScheduledLesson = useMemo(() => {
    const published = new Set(ids);
    return allLessons.some(l => {
      if (!published.has(l.id) || !l.scheduledAt) return false;
      const at = new Date(l.scheduledAt);
      return Number.isFinite(at.getTime()) && vnDateKeyOf(at) >= todayKey;
    });
  }, [allLessons, ids, todayKey]);

  const back = <Link href="/student/hoc-tap" data-all-classes className={`inline-flex items-center min-h-11 -ml-1 pr-3 ${GOC} text-[var(--kin-nhan-link)] underline`}>← Lớp của tôi</Link>;
  const head = (title: string, sub?: string) => (
    <header className="pb-6">
      {back}
      <h1 className="text-[length:var(--kin-co-h2)] leading-9 font-medium tracking-[-0.01em] text-[var(--kin-chu-chinh)] break-words [overflow-wrap:anywhere]">{title}</h1>
      {sub && <p className={`mt-1 ${GOC} text-[var(--kin-chu-mo)] break-words`}>{sub}</p>}
    </header>
  );
  const wrap = (children: React.ReactNode) => <div className="px-4 md:px-10 pt-6 md:pt-8 pb-10 bg-[var(--kin-nen-trang)]">{children}</div>;

  if (!enrollmentsLoading && classesError) {
    return wrap(<>{head("Lớp của tôi")}<ErrorStrip message="Không tải được danh sách lớp của bạn." onRetry={reloadClasses} /></>);
  }
  if (loading || progressLoading || enrollmentsLoading) return wrap(<>{head("Lớp của tôi")}<WorkSkeleton label="Đang tải Lớp của tôi" /></>);
  if (error || !course) {
    return wrap(<>{head("Lớp của tôi")}
      <ErrorStrip message={error || "Không tìm thấy khóa học — có thể bạn đã rời lớp hoặc lớp đã đóng."} onRetry={() => setTick(t => t + 1)} />
      <div className="pt-4"><Link href="/khoa-hoc" className="inline-flex items-center min-h-11 text-[var(--kin-nhan-link)] underline">Về danh sách khóa học</Link></div></>);
  }

  // Đã nghỉ lớp này (quyết định 06/11/2026): không xem bài / bản ghi nữa; thông báo + nút liên hệ gia sư.
  if (course.suspended) return wrap(<>{head(course.name)}<SuspendedNotice contactHref={course.suspended.contactHref} /></>);

  const isEnrolled = enrolledHere;
  const giaSu = giaSuLabel(course.instructor);
  const sub = [course.category?.trim(), giaSu].filter(Boolean).join(" · ");
  const docs = allLessons.filter(l => { const t = parseLessonType(l.type); return t === "document" || t === "record"; });
  const quizzes = allLessons.filter(l => parseLessonType(l.type) === "quiz");
  const tabs = [
    { key: "tong-quan" as const, label: "Tổng quan" },
    { key: "noi-dung" as const, label: "Nội dung" },
  ];
  // Buổi học sắp tới CỦA LỚP NÀY: cùng nguồn /api/schedule với trang Lịch (khung giờ tuần + buổi dời / huỷ + buổi lẻ / dạy bù), nên hai nơi không thể lệch nhau.
  const nextSessions = (work.events ?? []).filter(e => e.type === "class" && e.courseId === courseId).slice(0, 4);
  // Lịch đã tải xong, không lỗi, không buổi nào, nhưng có bài hẹn ⇒ bỏ cả khối (đang tải / lỗi vẫn vẽ như cũ — không im lặng khi lỗi).
  const hideSessions = work.events !== null && !work.eventsError && nextSessions.length === 0 && hasScheduledLesson;
  const inCourse = (work.items ?? []).filter(i => i.task && i.task.courseId === course.id);
  const needCount = inCourse.filter(i => !i.done).length;
  const waitCount = inCourse.filter(i => i.task?.phase === "cho-cham").length;
  // Bài kế để tô trong cây: chỉ khi thật sự còn bài để học (xong hết thì không tô bài nào là "Học tiếp").
  const outlineNext = isEnrolled && (next.reason === "dang-xem" || next.reason === "chua-hoc") ? next.lessonId : undefined;

  const lessonRow = (l: Lesson) => {
    const isDone = completedIds.has(l.id), isNext = l.id === outlineNext;
    const label = isDone ? <KinStatus tone="xong">Đã học</KinStatus> : l.isLocked ? <KinStatus tone="mo">Đã khoá</KinStatus> : isNext ? <KinStatus tone="cho">Học tiếp</KinStatus> : <KinStatus tone="mo">Chưa học</KinStatus>;
    const meta = `${TYPE_LABEL[parseLessonType(l.type)] ?? "Bài học"}${l.duration ? ` · ${l.duration}` : ""}`;
    const cls = `grid md:grid-cols-[1.6fr_1fr_1fr] gap-x-4 gap-y-1 items-center px-[var(--kin-kc-6)] py-[var(--kin-kc-6)] min-h-[62px] border-b border-[var(--kin-vien-nhat)] ${GOC}`;
    const inner = (<><span className="text-[var(--kin-chu-chinh)] [overflow-wrap:anywhere]">{l.title}</span><span className="text-[var(--kin-chu-mo)]">{meta}</span><span>{label}</span></>);
    return l.isLocked
      ? <li key={l.id} data-lesson-row className={`${cls} opacity-70`}>{inner}</li>
      : <li key={l.id}><Link href={`/student/bai-giang/${l.id}`} data-lesson-row className={`${cls} hover:bg-[var(--kin-nen-re-chuot)] transition-colors`}>{inner}</Link></li>;
  };
  const tableHead = (
    <div aria-hidden className={`hidden md:grid grid-cols-[1.6fr_1fr_1fr] px-[var(--kin-kc-6)] h-11 items-center bg-[var(--kin-nen-bang)] ${GOC} text-[var(--kin-chu-mo)]`}>
      <span>Bài</span><span>Loại · thời lượng</span><span>Trạng thái</span>
    </div>
  );

  const hero = (
    <section aria-label="Tiến độ của bạn trong lớp" data-course-hero className="rounded-[var(--kin-bo-sm)] bg-[var(--kin-nen-nhan)] px-[var(--kin-kc-8)] py-[var(--kin-kc-8)]">
      <p className={`${GOC} font-medium text-[var(--kin-chu-mo-tren-nen-nhan)] break-words [overflow-wrap:anywhere]`}>{course.name}</p>
      {isEnrolled ? (
        <>
          {prog.total > 0 ? (
            <>
              <p className={`mt-2 ${GOC} tabular-nums text-[var(--kin-chu-chinh)]`}>Bạn đã hoàn thành {prog.done}/{prog.total} bài</p>
              <div role="progressbar" aria-label="Tiến độ lớp" aria-valuemin={0} aria-valuemax={100} aria-valuenow={prog.pct} className="mt-3 h-1.5 rounded-full overflow-hidden bg-[var(--kin-vien-thuong)]">
                <div className="h-1.5 rounded-full bg-[var(--kin-nhan-nen)]" style={{ width: `${prog.pct}%` }} />
              </div>
            </>
          ) : <p className={`mt-2 ${GOC} text-[var(--kin-chu-mo-tren-nen-nhan)]`}>Lớp chưa có bài học</p>}
          {next.reason === "on-lai" && <p className="mt-4"><KinStatus tone="xong">Đã hoàn thành khóa học</KinStatus></p>}
          {nextLesson && next.reason !== "trong" && (
            <>
              {next.reason !== "on-lai" && <p className={`mt-4 ${GOC} text-[var(--kin-chu-chinh)] break-words [overflow-wrap:anywhere]`}>{next.reason === "dang-xem" ? "Đang xem dở" : "Tiếp theo"}: {nextLesson.title}</p>}
              <Link href={`/student/bai-giang/${nextLesson.id}`} data-hoc-tiep={nextLesson.id} className={`${kinButtonClass("primary")} mt-4 w-full lg:w-auto`}>{hocTiepLabel(next.reason, prog.done)}</Link>
            </>
          )}
        </>
      ) : (
        <>
          <p className={`mt-4 ${GOC} text-[var(--kin-chu-mo-tren-nen-nhan)]`}>Bạn chưa vào lớp này</p>
          {/* Học viên học miễn phí, không có bước "mua" (quyết định D01): nút đưa tới trang lớp (cách vào lớp: mã mời của gia sư / nhắn tư vấn). */}
          <Link href={`/khoa-hoc/${courseId}`} className={`${kinButtonClass("primary")} mt-4`}>Xem lớp học →</Link>
        </>
      )}
      {giaSu && <p className={`mt-4 ${GOC} text-[var(--kin-chu-chinh)]`}>{giaSu}</p>}
      {isEnrolled && <p className={`mt-2 text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo-tren-nen-nhan)]`}>Tiến độ tính theo số bài bạn đã đánh dấu hoàn thành.</p>}
      {isEnrolled && (
        <Link href={`/thu-vien#c-${courseId}`} data-thu-vien-link className={`mt-2 flex items-center min-h-11 ${GOC} text-[var(--kin-nhan-link)] underline`}>
          Tài liệu &amp; bản ghi của lớp này →
        </Link>
      )}
      {/* LOI-01: lối hỏi gia sư TRONG lớp (/cong-dong?scope=<mã lớp>, chỉ thành viên lớp và gia sư) — lối duy nhất khi bảng tin chung bị ẩn. Bảng tin bật thì hỏi ở Cộng đồng như cũ. */}
      {isEnrolled && !featureOn("CONG_DONG") && (
        <Link href={`/cong-dong?scope=${encodeURIComponent(courseId)}`} data-hoi-trong-lop className={`mt-1 flex items-center min-h-11 ${GOC} text-[var(--kin-nhan-link)] underline`}>
          Hỏi gia sư trong lớp →
        </Link>
      )}
    </section>
  );

  const overview = (
    <div className="space-y-10">
      <section aria-labelledby="lop-info" data-lop-thong-tin>
        <KinSectionHead id="lop-info" title="Thông tin lớp" />
        <div className={`pt-4 ${GOC} leading-6 text-[var(--kin-chu-chinh)]`}>
          {giaSu && <p>{giaSu}</p>}
          {course.category && <p className="text-[var(--kin-chu-mo)]">Môn: {course.category}</p>}
          {isEnrolled && work.items && <p className="mt-3 text-[var(--kin-chu-mo)]">Bài cần làm: {needCount}<br />Bài chờ chấm: {waitCount}</p>}
          {/* CỜ TIỀN = không: chỉ là chữ dẫn sang trang phiếu học phí, không hiện số tiền ở đây. */}
          {isEnrolled && <Link href="/student/hoc-phi" data-lop-hoc-phi className="mt-3 inline-flex items-center min-h-11 text-[var(--kin-nhan-link)] underline">Phiếu học phí của bạn →</Link>}
        </div>
      </section>
      <section aria-label="Tài liệu và bản ghi" data-materials-tab className="space-y-8">
        <div>
          <KinSectionHead title="Bản ghi các buổi học" aside={typeof recs === "object" && recs ? `${recs.recordings.length} bản ghi` : undefined} />
          {!isEnrolled ? (
            <KinEmptyState title="Bản ghi dành cho học sinh của lớp">Vào lớp bằng mã mời của gia sư để xem bản ghi các buổi học.</KinEmptyState>
          ) : recs === null ? (
            <p role="status" className={`py-6 ${GOC} text-[var(--kin-chu-mo)]`}>Đang tải bản ghi…</p>
          ) : recs === "loi" ? (
            <div className="pt-4"><ErrorStrip message="Chưa tải được bản ghi của lớp." onRetry={() => { setRecs(null); setRecTick(t => t + 1); }} /></div>
          ) : recs.recordings.length === 0 ? (
            <KinEmptyState title="Chưa có bản ghi nào">Khi gia sư dán link bản ghi sau buổi học, nó sẽ hiện ở đây.</KinEmptyState>
          ) : (
            <RecordingMonths months={groupRecordingsByMonth(groupRecordingsBySession(recs.recordings.map(r => ({ ...r, createdAt: new Date(r.createdAt) })), recs.sessions))} />
          )}
          <KinCallout title="Mở ở dịch vụ bên ngoài" className="mt-4">KiN chỉ lưu liên kết bản ghi do gia sư chia sẻ. KiN không có dịch vụ phát trực tiếp hay ghi hình tích hợp, và không biết bạn đã mở bản ghi hay chưa.</KinCallout>
        </div>
        {(() => {
          const mats = allLessons.flatMap(l => parseMaterials(l.documents).map(m => ({ lesson: l, m })));
          return mats.length > 0 && (
            <div>
              <KinSectionHead title="Tài liệu đính kèm bài" aside={`${mats.length} tệp`} />
              <ul>
                {mats.map(({ lesson, m }, i) => {
                  const plan = planDocumentPreview(m.url);
                  if (plan.mode === "none") return null;
                  return (
                    <li key={`${lesson.id}-${i}`} data-material-row className={`flex items-start justify-between gap-3 px-[var(--kin-kc-6)] py-[var(--kin-kc-6)] border-b border-[var(--kin-vien-nhat)] ${GOC}`}>
                      <div className="min-w-0 flex-1">
                        <p className="text-[var(--kin-chu-chinh)] break-words">{m.name}</p>
                        <p className="mt-1 text-[var(--kin-chu-mo)] break-words">Bài: {lesson.title}</p>
                      </div>
                      <a href={viewerHref(m.name, m.url)} target="_blank" rel="noopener noreferrer" aria-label={`Mở ${m.name}`} className={kinButtonClass("secondary")}>Mở ↗</a>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })()}
        <div>
          <KinSectionHead title="Bài giảng và bản ghi bài" aside={`${docs.length} bài`} />
          {docs.length === 0 ? (
            <KinEmptyState title="Chưa có bài giảng hay tài liệu bài" action={<button type="button" onClick={() => setTab("noi-dung")} className={kinButtonClass("secondary")}>Xem nội dung lớp</button>}>Khi gia sư đăng, chúng sẽ hiện ở đây.</KinEmptyState>
          ) : <>{tableHead}<ul>{docs.map(lessonRow)}</ul></>}
        </div>
      </section>
      <section aria-labelledby="lop-bai-tap" data-lop-bai-tap>
        <KinSectionHead id="lop-bai-tap" title="Bài tập của lớp" aside={`${quizzes.length} bài`} />
        {quizzes.length === 0 ? (
          <KinEmptyState title="Lớp chưa có bài tập" action={<button type="button" onClick={() => setTab("noi-dung")} className={kinButtonClass("secondary")}>Xem nội dung lớp</button>}>
            Khi gia sư đăng, chúng sẽ hiện ở đây.
          </KinEmptyState>
        ) : <>{tableHead}<ul>{quizzes.map(lessonRow)}</ul></>}
      </section>
    </div>
  );

  const contentTab = sections.length === 0 || ids.length === 0 ? (
    <KinEmptyState title="Lớp chưa có bài học nào">Khi gia sư đăng bài học, danh sách sẽ hiện ở đây.</KinEmptyState>
  ) : (
    <CourseOutline variant="page" idPrefix="lop" sections={outlineSections} completedIds={completedIds} nextId={outlineNext} watching={isEnrolled ? watching : undefined}
      hrefFor={id => `/student/bai-giang/${id}`}
      heading={<p data-noi-dung-tom-tat className={`${GOC} font-medium text-[var(--kin-chu-chinh)]`}>{summary}</p>} />
  );

  return wrap(<>
    {head(course.name, sub || undefined)}
    {/* Máy tính: [tab + nội dung | thẻ tiến độ, rồi lịch + các lớp]. Điện thoại: thẻ tiến độ → tab → nội dung → lịch → các lớp. */}
    <div className="grid lg:grid-cols-[minmax(0,1fr)_354px] gap-x-8 gap-y-8 items-start">
      <div className="min-w-0 lg:col-start-2 lg:row-start-1">{hero}</div>
      <div className="min-w-0 lg:col-start-1 lg:row-start-1 lg:row-span-2">
        <KinTabs tabs={tabs} value={tab} onChange={setTab} label="Trang lớp" tabId={k => `lop-tab-${k}`} panelId={() => "lop-panel"} />
        <div role="tabpanel" id="lop-panel" aria-labelledby={`lop-tab-${tab}`} className="pt-6">
          {tab === "noi-dung" ? contentTab : overview}
        </div>
      </div>
      <aside aria-label="Lịch và các lớp của bạn" className="min-w-0 lg:col-start-2 lg:row-start-2 space-y-8">
        {isEnrolled && !hideSessions && (
          <section aria-labelledby="lop-lich" data-course-sessions>
            <KinSectionHead id="lop-lich" title="Buổi học sắp tới" />
            {work.events === null && !work.eventsError ? (
              <p role="status" className={`pt-4 ${GOC} text-[var(--kin-chu-mo)]`}>Đang tải lịch…</p>
            ) : work.eventsError ? (
              <div className="pt-4"><ErrorStrip message="Không tải được lịch của lớp." onRetry={work.load} /></div>
            ) : nextSessions.length === 0 ? (
              <p className={`pt-4 ${GOC} text-[var(--kin-chu-mo)]`}>Lớp chưa có buổi học nào trong 90 ngày tới. Khi gia sư thêm khung giờ hoặc buổi học, chúng sẽ hiện ở đây.</p>
            ) : (
              <ul>
                {nextSessions.map(e => {
                  const cancelled = e.topic.startsWith("[ĐÃ HUỶ]");
                  const topic = e.topic.replace(/^\[[^\]]+\]\s*/, "");
                  const subT = topic.includes(" — ") ? topic.slice(topic.indexOf(" — ") + 3) : "";
                  const place = placeLabel(e.mode, e.location);
                  return (
                    <li key={e.id} data-course-session className={`py-[var(--kin-kc-6)] border-b border-[var(--kin-vien-nhat)] ${GOC}`}>
                      <p className="text-[var(--kin-chu-chinh)]">{dayTitle(e.isoDate)} · <span className="tabular-nums">{e.endTime ? `${e.time}–${e.endTime}` : e.time}</span></p>
                      <p className="mt-1 text-[var(--kin-chu-mo)]">{[subT, place].filter(Boolean).join(" · ") || "Buổi học theo lịch tuần"}</p>
                      {cancelled && <p className="mt-2"><KinStatus tone="loi">Buổi học đã huỷ</KinStatus></p>}
                      {!cancelled && e.joinUrl && <a href={e.joinUrl} target="_blank" rel="noopener noreferrer" data-course-session-join className={`${kinButtonClass("secondary")} mt-3`}>Mở link học online</a>}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}
        {classes.length >= 2 && (
          <section aria-labelledby="lop-cua-ban" data-my-classes>
            <KinSectionHead id="lop-cua-ban" title="Các lớp của bạn" aside={`${classes.length} lớp`} />
            <ul>
              {classes.map(c => (
                <li key={c.id}>
                  <Link href={`/student/hoc-tap?course=${c.id}`} aria-current={c.id === courseId ? "page" : undefined}
                    className={`flex items-center justify-between gap-3 min-h-11 px-[var(--kin-kc-6)] py-[var(--kin-kc-5)] border-b border-[var(--kin-vien-nhat)] ${GOC} hover:bg-[var(--kin-nen-re-chuot)] transition-colors ${c.id === courseId ? "bg-[var(--kin-nen-nhan)] font-medium text-[var(--kin-chu-chinh)]" : "text-[var(--kin-chu-chinh)]"}`}>
                    <span className="min-w-0 break-words">{c.name}</span>
                    {c.id === courseId && <span className="flex-shrink-0 text-[var(--kin-chu-mo)]">Đang xem</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </aside>
    </div>
  </>);
}

/** Không ?course= ⇒ thư viện lớp. Có ?course= ⇒ trang lớp, dựng lại theo ID lớp: đổi lớp là một "trang" mới, không mang state của lớp trước sang. */
function PerCourse() {
  const searchParams = useSearchParams();
  const course = searchParams.get("course") ?? ""; // giữ đúng chữ này: t-links.ts:102 khoá việc trang đọc ?course=
  if (!course) return <ThuVienLop />;
  return <Content key={course} courseId={course} />;
}

export default function LopCuaToi() {
  return <Suspense><PerCourse /></Suspense>;
}
