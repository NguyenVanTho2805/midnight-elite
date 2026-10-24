// Lớp của tôi (Figma "Học sinh · Lớp của tôi" 299:114766): tiêu đề + dòng phụ; khung nền nhạt (tên lớp, x/y bài đã học, thanh tiến độ, "Tiếp theo", "Tiếp tục học");
// tab Tổng quan / Tài liệu / Bài tập; bảng nội dung lớp; cột phải "Tham gia lớp khác" + "Thông tin lớp".
// BỎ vì chưa có dữ liệu thật: nút "Liên hệ cô …" (chưa có kênh nhắn), "Hoạt động buổi học" (không có bản ghi từng buổi theo lớp), tab "Thông báo",
// "n học sinh" (không hiện dữ liệu bạn học), dung lượng tệp, "Học trực tuyến". Giữ: mọi liên kết cũ (Tiếp tục học, Xem lớp học, Tài liệu & bản ghi của lớp này).
// MD-07/SV-03: tab "Tài liệu & bản ghi" gộp 3 nguồn của CHÍNH lớp này: bản ghi gia sư dán theo buổi (/api/courses/[id]/recordings, chỉ học sinh đã ghi danh),
// tài liệu đính kèm bài (Lesson.documents) và các bài giảng/bản ghi bài. Không có dung lượng tệp, không "n lượt xem" (KiN không đo).
"use client";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, Suspense } from "react";
import { useProgress } from "@/hooks/useProgress";
import { groupRecordingsBySession } from "@/lib/classRecordings";
import { planDocumentPreview } from "@/lib/mediaLink";
import { viewerHref } from "@/lib/library";
import { parseMaterials } from "@/components/media/StudentLessonPanels";
import { useEnrollments } from "@/hooks/useEnrollments";
import { parseLessonType } from "@/lib/types";
import { ErrorStrip } from "@/components/kin/shell/Outlook";
import { kinButtonClass } from "@/components/kin/Button";
import { KinTabs } from "@/components/kin/Tabs";
import { KinSectionHead } from "@/components/kin/SectionHead";
import { KinCallout } from "@/components/kin/Callout";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { KinStatus } from "@/components/kin/Status";
import { useStudentWork, WorkSkeleton } from "@/components/student/shared";

interface Lesson { id: string; code: string; title: string; type: string; duration?: string | null; isLocked: boolean; isFree: boolean; documents?: string | null }
interface Rec { id: string; title: string; url: string; kind: string; sessionId: string | null; createdAt: string }
interface RecData { recordings: Rec[]; sessions: { id: string; dateKey: string }[] }
const REC_KIND: Record<string, string> = { youtube: "YouTube", vimeo: "Vimeo", drive: "Google Drive", zoom_record: "Zoom cloud" };
const dmy = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}/${k.slice(0, 4)}`;
interface Chapter { id: string; title: string; order: number; lessons: Lesson[] }
interface Section { id: string; title: string; order: number; chapters: Chapter[] }
interface Course { id: string; name: string; instructor: string; category: string; hours: number; lessons: number; sections: Section[] }

type Tab = "tong-quan" | "tai-lieu" | "bai-tap";
const TYPE_LABEL: Record<string, string> = { record: "Bản ghi", live: "Học trực tiếp", quiz: "Bài tập", document: "Tài liệu" };

function Content() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const courseId = searchParams.get("course");
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  const [tab, setTab] = useState<Tab>("tong-quan");
  const { completedIds, loading: progressLoading } = useProgress();
  const { enrolledIds, loading: enrollmentsLoading } = useEnrollments();
  const work = useStudentWork();

  useEffect(() => {
    if (!courseId) { void Promise.resolve().then(() => setLoading(false)); return; }
    void Promise.resolve().then(() => { setLoading(true); setError(""); });
    fetch(`/api/courses/${courseId}`, { credentials: "same-origin" })
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data: Course) => setCourse(data))
      .catch(() => setError("Không tìm thấy khóa học"))
      .finally(() => setLoading(false));
  }, [courseId, tick]);

  // Thiếu ?course= nhưng đã có lớp → tự chọn lớp đầu tiên thay vì ngõ cụt.
  useEffect(() => {
    if (courseId || enrollmentsLoading) return;
    const first = enrolledIds.values().next().value;
    if (first) router.replace(`/student/hoc-tap?course=${first}`);
  }, [courseId, enrollmentsLoading, enrolledIds, router]);

  // MD-07: bản ghi theo buổi của lớp. Chỉ hỏi khi đã ghi danh (API trả 403 cho người chưa vào lớp, nên không hỏi vô ích).
  const enrolledHere = !!courseId && enrolledIds.has(courseId);
  const [recs, setRecs] = useState<RecData | "loi" | null>(null);
  const [recTick, setRecTick] = useState(0);
  useEffect(() => {
    if (!courseId || !enrolledHere) return;
    let live = true;
    fetch(`/api/courses/${courseId}/recordings`, { credentials: "same-origin" })
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: RecData) => { if (live) setRecs({ recordings: d.recordings, sessions: d.sessions }); })
      .catch(() => { if (live) setRecs("loi"); });
    return () => { live = false; };
  }, [courseId, enrolledHere, recTick]);

  const allLessons = useMemo(() => course?.sections.flatMap(s => s.chapters.flatMap(c => c.lessons)) ?? [], [course]);
  const done = allLessons.filter(l => completedIds.has(l.id)).length;
  const pct = Math.round((done * 100) / Math.max(allLessons.length, 1));
  const nextLesson = useMemo(() => allLessons.find(l => !completedIds.has(l.id) && !l.isLocked), [allLessons, completedIds]);

  const head = (sub?: string) => (
    <header className="pb-6">
      <h1 className="text-[length:var(--kin-co-h2)] leading-9 font-medium tracking-[-0.01em] text-[var(--kin-chu-chinh)]">Lớp của tôi</h1>
      {sub && <p className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">{sub}</p>}
    </header>
  );
  const wrap = (children: React.ReactNode) => <div className="px-4 md:px-10 pt-6 md:pt-8 pb-10 bg-[var(--kin-nen-trang)]">{children}</div>;

  if (!courseId) {
    if (enrollmentsLoading || enrolledIds.size > 0) return wrap(<>{head()}<WorkSkeleton label="Đang tải Lớp của tôi" /></>);
    return wrap(<>{head()}
      <KinEmptyState title="Bạn chưa vào lớp nào" action={<Link href="/student/nhap-ma-lop" className={kinButtonClass("primary")}>Nhập mã lớp</Link>}>
        Gia sư sẽ gửi cho bạn mã mời của lớp. Nhập mã đó để vào lớp, bài tập và buổi học sẽ hiện ở đây.
      </KinEmptyState></>);
  }
  if (loading || progressLoading || enrollmentsLoading) return wrap(<>{head()}<WorkSkeleton label="Đang tải Lớp của tôi" /></>);
  if (error || !course) {
    return wrap(<>{head()}
      <ErrorStrip message={error || "Không tìm thấy khóa học — có thể bạn đã rời lớp hoặc lớp đã đóng."} onRetry={() => setTick(t => t + 1)} />
      <div className="pt-4"><Link href="/khoa-hoc" className="inline-flex items-center min-h-11 text-[var(--kin-nhan-link)] underline">Về danh sách khóa học</Link></div></>);
  }

  const isEnrolled = enrolledIds.has(courseId);
  const docs = allLessons.filter(l => { const t = parseLessonType(l.type); return t === "document" || t === "record"; });
  const quizzes = allLessons.filter(l => parseLessonType(l.type) === "quiz");
  const tabs = [
    { key: "tong-quan" as const, label: "Tổng quan" },
    { key: "tai-lieu" as const, label: `Tài liệu & bản ghi · ${docs.length + (typeof recs === "object" && recs ? recs.recordings.length : 0)}` },
    { key: "bai-tap" as const, label: `Bài tập · ${quizzes.length}` },
  ];
  const inCourse = (work.items ?? []).filter(i => i.task && i.task.courseLine.startsWith(course.name));
  const needCount = inCourse.filter(i => !i.done).length;
  const waitCount = inCourse.filter(i => i.task?.phase === "cho-cham").length;

  const lessonRow = (l: Lesson) => {
    const isDone = completedIds.has(l.id), isNext = l.id === nextLesson?.id;
    const label = isDone ? <KinStatus tone="xong">Đã học</KinStatus> : l.isLocked ? <KinStatus tone="mo">Đã khoá</KinStatus> : isNext ? <KinStatus tone="cho">Học tiếp</KinStatus> : <KinStatus tone="mo">Chưa học</KinStatus>;
    const meta = `${TYPE_LABEL[parseLessonType(l.type)] ?? "Bài học"}${l.duration ? ` · ${l.duration}` : ""}`;
    const cls = "grid md:grid-cols-[1.6fr_1fr_1fr] gap-x-4 gap-y-1 items-center px-[var(--kin-kc-6)] py-[var(--kin-kc-6)] min-h-[62px] border-b border-[var(--kin-vien-nhat)] text-[length:var(--kin-co-goc)]";
    const inner = (<><span className="text-[var(--kin-chu-chinh)]">{l.title}</span><span className="text-[var(--kin-chu-mo)]">{meta}</span><span>{label}</span></>);
    return l.isLocked
      ? <li key={l.id} data-lesson-row className={`${cls} opacity-70`}>{inner}</li>
      : <li key={l.id}><Link href={`/student/bai-giang/${l.id}`} data-lesson-row className={`${cls} hover:bg-[var(--kin-nen-re-chuot)] transition-colors`}>{inner}</Link></li>;
  };
  const tableHead = (
    <div aria-hidden className="hidden md:grid grid-cols-[1.6fr_1fr_1fr] px-[var(--kin-kc-6)] h-11 items-center bg-[var(--kin-nen-bang)] text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">
      <span>Bài</span><span>Loại · thời lượng</span><span>Trạng thái</span>
    </div>
  );

  return wrap(<>
    {head(`${course.name} · ${course.instructor}`)}
    <div className="grid lg:grid-cols-[minmax(0,1fr)_354px] gap-x-8 gap-y-8 items-start">
      <div className="min-w-0">
        <div data-course-hero className="rounded-[var(--kin-bo-sm)] bg-[var(--kin-nen-nhan)] px-[var(--kin-kc-8)] py-[var(--kin-kc-8)]">
          <p className="text-[length:var(--kin-co-tieu-de)] leading-6 font-medium text-[var(--kin-chu-chinh)]">{course.name}</p>
          <p className="mt-2 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">{done}/{allLessons.length} bài đã hoàn thành</p>
          <div role="progressbar" aria-label="Tiến độ lớp" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="mt-3 h-1.5 rounded-full overflow-hidden bg-[var(--kin-vien-thuong)]">
            <div className="h-1.5 rounded-full bg-[var(--kin-nhan-nen)]" style={{ width: `${pct}%` }} />
          </div>
          {isEnrolled ? (nextLesson ? (
            <>
              <p className="mt-4 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">Tiếp theo: {nextLesson.title}</p>
              <Link href={`/student/bai-giang/${nextLesson.id}`} className={`${kinButtonClass("primary")} mt-4`}>{done === 0 ? "Bắt đầu học" : "Tiếp tục học"}</Link>
            </>
          ) : <p className="mt-4"><KinStatus tone="xong">Đã hoàn thành khóa học</KinStatus></p>) : (
            <>
              <p className="mt-4 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Bạn chưa vào lớp này</p>
              {/* Học viên học miễn phí, không có bước "mua" (quyết định D01): nút đưa tới trang lớp (cách vào lớp: mã mời của gia sư / nhắn tư vấn). */}
              <Link href={`/khoa-hoc/${courseId}`} className={`${kinButtonClass("primary")} mt-4`}>Xem lớp học →</Link>
            </>
          )}
          {isEnrolled && (
            <Link href={`/thu-vien#c-${courseId}`} data-thu-vien-link className="mt-2 flex items-center min-h-11 text-[length:var(--kin-co-goc)] text-[var(--kin-nhan-link)] underline">
              Tài liệu &amp; bản ghi của lớp này →
            </Link>
          )}
        </div>

        <KinTabs tabs={tabs} value={tab} onChange={setTab} label="Nội dung lớp" tabId={k => `lop-tab-${k}`} panelId={() => "lop-panel"} className="mt-8" />
        <div role="tabpanel" id="lop-panel" aria-labelledby={`lop-tab-${tab}`} className="pt-6">
          {tab === "tong-quan" ? (
            course.sections.length === 0 ? (
              <KinEmptyState title="Lớp chưa có bài học nào">Khi gia sư đăng bài học, danh sách sẽ hiện ở đây.</KinEmptyState>
            ) : course.sections.map(s => (
              <section key={s.id} aria-label={s.title} className="mb-8">
                <KinSectionHead title={s.title} aside={`${s.chapters.flatMap(c => c.lessons).filter(l => completedIds.has(l.id)).length}/${s.chapters.flatMap(c => c.lessons).length} bài`} />
                {tableHead}
                <ul>{s.chapters.flatMap(c => c.lessons).map(lessonRow)}</ul>
              </section>
            ))
          ) : tab === "tai-lieu" ? (
            <section aria-label="Tài liệu và bản ghi" data-materials-tab className="space-y-8">
              <div>
                <KinSectionHead title="Bản ghi các buổi học" aside={typeof recs === "object" && recs ? `${recs.recordings.length} bản ghi` : undefined} />
                {!isEnrolled ? (
                  <KinEmptyState title="Bản ghi dành cho học sinh của lớp">Vào lớp bằng mã mời của gia sư để xem bản ghi các buổi học.</KinEmptyState>
                ) : recs === null ? (
                  <p role="status" className="py-6 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Đang tải bản ghi…</p>
                ) : recs === "loi" ? (
                  <div className="pt-4"><ErrorStrip message="Chưa tải được bản ghi của lớp." onRetry={() => { setRecs(null); setRecTick(t => t + 1); }} /></div>
                ) : recs.recordings.length === 0 ? (
                  <KinEmptyState title="Chưa có bản ghi nào">Khi gia sư dán link bản ghi sau buổi học, nó sẽ hiện ở đây.</KinEmptyState>
                ) : (() => {
                  const g = groupRecordingsBySession(recs.recordings.map(r => ({ ...r, createdAt: new Date(r.createdAt) })), recs.sessions);
                  const rows = (list: typeof g.unattached, label: string) => list.map(r => (
                    <li key={r.id} data-recording-row className="flex items-start justify-between gap-3 px-[var(--kin-kc-6)] py-[var(--kin-kc-6)] border-b border-[var(--kin-vien-nhat)] text-[length:var(--kin-co-goc)]">
                      <div className="min-w-0 flex-1">
                        <p className="text-[var(--kin-chu-chinh)] break-words">{r.title}</p>
                        <p className="mt-1 text-[var(--kin-chu-mo)]">{label} · {REC_KIND[r.kind] ?? "Liên kết ngoài"} · có thể cần quyền truy cập</p>
                      </div>
                      <a href={r.url} target="_blank" rel="noopener noreferrer" aria-label={`Mở bản ghi ${r.title}`} className={kinButtonClass("secondary")}>Mở ↗</a>
                    </li>
                  ));
                  return <ul>{g.bySession.flatMap(x => rows(x.recordings, `Buổi ${dmy(x.session.dateKey)}`))}{rows(g.unattached, "Chưa gắn buổi")}</ul>;
                })()}
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
                          <li key={`${lesson.id}-${i}`} data-material-row className="flex items-start justify-between gap-3 px-[var(--kin-kc-6)] py-[var(--kin-kc-6)] border-b border-[var(--kin-vien-nhat)] text-[length:var(--kin-co-goc)]">
                            <div className="min-w-0 flex-1">
                              <p className="text-[var(--kin-chu-chinh)] break-words">{m.name}</p>
                              <p className="mt-1 text-[var(--kin-chu-mo)]">Bài: {lesson.title}</p>
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
                  <KinEmptyState title="Chưa có bài giảng hay tài liệu bài" action={<button type="button" onClick={() => setTab("tong-quan")} className={kinButtonClass("secondary")}>Xem tổng quan</button>}>Khi gia sư đăng, chúng sẽ hiện ở đây.</KinEmptyState>
                ) : <>{tableHead}<ul>{docs.map(lessonRow)}</ul></>}
              </div>
            </section>
          ) : (
            <section aria-label="Bài tập của lớp">
              <KinSectionHead title="Bài tập" />
              {quizzes.length === 0 ? (
                <KinEmptyState title="Lớp chưa có bài tập" action={<button type="button" onClick={() => setTab("tong-quan")} className={kinButtonClass("secondary")}>Xem tổng quan</button>}>
                  Khi gia sư đăng, chúng sẽ hiện ở đây.
                </KinEmptyState>
              ) : <>{tableHead}<ul>{quizzes.map(lessonRow)}</ul></>}
            </section>
          )}
        </div>
      </div>

      <aside aria-label="Thông tin lớp" className="min-w-0">
        <section aria-labelledby="lop-join">
          <KinSectionHead id="lop-join" title="Tham gia lớp khác" />
          <p className="pt-4 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Nhập mã mời do gia sư cung cấp.</p>
          <Link href="/student/nhap-ma-lop" className={`${kinButtonClass("secondary")} mt-4`}>Nhập mã lớp</Link>
        </section>
        <section aria-labelledby="lop-info" className="mt-8">
          <KinSectionHead id="lop-info" title="Thông tin lớp" />
          <div className="pt-4 text-[length:var(--kin-co-goc)] leading-6 text-[var(--kin-chu-chinh)]">
            <p>Gia sư: {course.instructor}</p>
            {course.category && <p className="text-[var(--kin-chu-mo)]">Môn: {course.category}</p>}
            {isEnrolled && work.items && <p className="mt-3 text-[var(--kin-chu-mo)]">Bài cần làm: {needCount}<br />Bài chờ chấm: {waitCount}</p>}
          </div>
          {isEnrolled && <Link href="/student/bai-tap" className={`${kinButtonClass("secondary")} mt-4`}>Xem bài tập</Link>}
        </section>
        <KinCallout className="mt-8">Tiến độ tính theo số bài bạn đã đánh dấu hoàn thành trong lớp.</KinCallout>
      </aside>
    </div>
  </>);
}

export default function LopCuaToi() {
  return <Suspense><Content /></Suspense>;
}
