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
import type { TrialView } from "@/lib/studentLop";
import { HocThuBang, HocThuKhoa } from "@/components/student/HocThu";
import { KinProgressRing } from "@/components/kin/ProgressRing";
import { KinStatus, KinStatusIcon, STATUS_DOT } from "@/components/kin/Status";
import { useProgress } from "@/hooks/useProgress";
import { useStudentWork, WorkSkeleton } from "@/components/student/shared";
import { SuspendedNotice } from "@/components/student/SuspendedNotice";
import ThuVienLop from "@/components/student/ThuVienLop";
import ThongBaoHocSinh from "@/components/student/ThongBaoHocSinh";
import { DaNopCard, IconTaiLieu, IconVideo, NopDock, TodoCardView } from "@/components/student/CanLam";
import { featureOn, isLinkHidden } from "@/lib/features";
import { classAccentFor } from "@/lib/classColor";
import { nopTepResultMessage } from "@/lib/nopTep";
import { hocTiep, hocTiepLabel, orderedLessonIds } from "@/lib/studentLop";
import { BAI_TRANG_THAI_LABEL, baiTrangThai, buildTodoCards, lessonDate, on10, matchesQuery, newestFirst, nextClass, scheduleLine, vnDayLabel, vnWeekdayDate, joinLabel, opensLine, type BaiTrangThai } from "@/lib/studentClassPage";

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
  /** SCL đợt 5: học thử còn hạn (kèm mốc hết hạn) / chưa bắt đầu (từ /api/courses/[id]); trialExpired ⇒ thẻ khoá (D16). */
  trial?: TrialView; trialExpired?: boolean; trialDays?: number | null;
  /** Link nhóm Zalo của lớp — máy chủ chỉ gửi cho người trong lớp (mediaAccess PRIVATE_COURSE_FIELDS). */
  zaloGroupUrl?: string | null; zaloGroupLink?: string | null;
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

const ST_TONE: Record<BaiTrangThai, "xong" | "cho" | "mo"> = { "da-hoc": "xong", "dang-hoc": "cho", "chua-hoc": "mo" };

/** Hàng một bài (§3.3, KinListRow 56px): tên; dòng phụ "Thứ Ba 17/11 · Video 42 phút · 2 tài liệu · Bài tập". Lề phải (SCL5, A+B): "Đã chấm 8,5/10" và/hoặc
 *  trạng thái của riêng em (Đã học / Đang học / Chưa học — chỉ từ tiến độ thật). Cả hàng là link thật. */
function LessonRow({ l, grade, linked, st, now }: { l: Lesson; grade?: string; linked: boolean; st?: BaiTrangThai; now: Date }) {
  const d = lessonDate(l);
  const mo = opensLine(l.scheduledAt ? new Date(l.scheduledAt) : null, now);
  const video = parseLessonType(l.type) === "record" || firstPlayableVideo(l.videoUrl) !== null;
  const docs = parseMaterials(l.documents).length;
  const hw = (l._count?.assignments ?? 0) > 0 || !!l.azotaUrl;
  const parts = [
    mo ? <span key="d" data-mo-tu className="font-medium text-[var(--kin-chu-chinh)]">{mo}</span> : d && <span key="d">{vnDayLabel(d)}</span>,
    video && <span key="v">{part(<IconVideo />, l.duration ? `Video ${l.duration}` : "Video")}</span>,
    docs > 0 && <span key="t">{part(<IconTaiLieu />, `${docs} tài liệu`)}</span>,
    hw && <span key="b">{part(<IconBaiTapNho />, "Bài tập")}</span>,
  ].filter(Boolean);
  const aside = (grade || st || linked) ? <>
    {grade && <span data-diem-le className="font-semibold text-[var(--kin-tt-chu-xong)]">Đã chấm {grade}</span>}
    {st && !grade && (st === "dang-hoc"
      // Hàng đang học có nền nhạt (current): chữ cam --kin-tt-chu-cho chỉ đạt 4,28:1 trên nền đó ⇒ chữ chính, hình nửa tô giữ nghĩa "đang dở".
      ? <span data-kin-status="cho" className="inline-flex items-center gap-[var(--kin-kc-2)] min-h-5 leading-5 whitespace-nowrap text-[length:var(--kin-co-goc)] font-medium text-[var(--kin-chu-chinh)]"><KinStatusIcon shape="nua" color={STATUS_DOT.cho} />{BAI_TRANG_THAI_LABEL[st]}</span>
      : <KinStatus tone={ST_TONE[st]}>{BAI_TRANG_THAI_LABEL[st]}</KinStatus>)}
    {linked && <Chevron />}
  </> : undefined;
  return (
    <li data-lesson-row={l.id} data-co-video={video ? "1" : undefined} data-trang-thai={st}>
      <KinListRow size="lg" href={linked ? `/student/bai-giang/${l.id}` : undefined} title={l.title} aside={aside}
        current={st === "dang-hoc"} sub={parts.length ? <span className="flex flex-wrap gap-x-3 gap-y-0.5">{parts}</span> : undefined} />
    </li>
  );
}

interface MucChuong { id: string; title: string; lessons: Lesson[]; done: number }

/** Mục lục chương › bài (SCL5, phương án C): mỗi chương một mục gập, đầu mục có vòng x/y bài đã học (tiến độ thật). Chương đang học mở sẵn; chương khác
 *  mở được trong MỘT lần chạm. Trong chương: các bài đã học gom thành "N bài đã học · xem lại" (điểm vẫn hiện ở lề khi mở), rồi các bài còn lại. */
/** `tien` null = tiến độ chưa tải xong / tải lỗi: KHÔNG vẽ vòng, trạng thái từng bài hay nhóm "đã học" (không trình bày 0/N như số thật). */
function MucLuc({ chapters, openId, tien, grades, linked, now }: {
  chapters: MucChuong[]; openId: string | null; tien: { completed: Set<string>; watching: Record<string, number> } | null; grades: Map<string, string>; linked: boolean; now: Date;
}) {
  const completed = tien?.completed ?? new Set<string>();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [xemLai, setXemLai] = useState<Record<string, boolean>>({});
  return (
    <div className="rounded-[var(--kin-bo-the)] border border-[var(--kin-vien-thuong)] overflow-hidden">
      {chapters.map((c, i) => {
        const isOpen = open[c.id] ?? c.id === openId;
        const daHoc = tien ? c.lessons.filter(l => completed.has(l.id)) : [];
        const conLai = c.lessons.filter(l => !daHoc.includes(l));
        const firstAt = c.lessons.map(l => (l.scheduledAt ? new Date(l.scheduledAt) : null)).filter((x): x is Date => !!x).sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
        const mo = c.lessons.every(l => opensLine(l.scheduledAt ? new Date(l.scheduledAt) : null, now)) ? opensLine(firstAt, now) : "";
        const daCham = daHoc.filter(l => grades.has(l.id)).length;
        const showOld = xemLai[c.id] ?? false;
        const row = (l: Lesson) => <LessonRow key={l.id} l={l} grade={grades.get(l.id)} linked={linked && !l.isLocked} st={tien ? baiTrangThai(l.id, tien.completed, tien.watching) : undefined} now={now} />;
        return (
          <section key={c.id} data-chuong-muc={c.id} aria-label={c.title} className={i > 0 ? "border-t border-[var(--kin-vien-thuong)]" : ""}>
            <h3>
              <button type="button" aria-expanded={isOpen} aria-controls={`muc-${c.id}`} onClick={() => setOpen(o => ({ ...o, [c.id]: !isOpen }))}
                className="w-full flex items-center gap-3 min-h-14 px-[var(--kin-kc-6)] py-3 text-left hover:bg-[var(--kin-nen-re-chuot)] transition-colors">
                <span className="min-w-0 flex-1">
                  <span data-chuong-trang-thai className={`block ${GOC} text-[var(--kin-chu-phu)]`}>{mo ? <><span className="font-medium text-[var(--kin-chu-chinh)]">{mo}</span> · {c.lessons.length} bài</> : !tien ? `${c.lessons.length} bài` : c.done >= c.lessons.length ? "Đã học xong" : c.id === openId ? "Đang học" : `${c.lessons.length} bài`}</span>
                  <span className="block text-[length:var(--kin-co-body)] leading-6 font-semibold text-[var(--kin-chu-chinh)] [overflow-wrap:anywhere]">{c.title}</span>
                </span>
                {tien && <KinProgressRing done={c.done} total={c.lessons.length} size={40} label={`Đã học ở ${c.title}`} />}
                <KinChevron open={isOpen} />
              </button>
            </h3>
            <KinFold open={isOpen} id={`muc-${c.id}`}>
              <ul className="border-t border-[var(--kin-vien-nhat)] [&>li:last-child>*]:border-b-0">
                {daHoc.length > 0 && (
                  <li data-xem-lai={c.id}>
                    <button type="button" aria-expanded={showOld} onClick={() => setXemLai(o => ({ ...o, [c.id]: !showOld }))}
                      className={`w-full flex flex-wrap items-center gap-x-3 gap-y-1 min-h-12 px-[var(--kin-kc-6)] py-2 border-b border-[var(--kin-vien-nhat)] text-left ${GOC} font-medium text-[var(--kin-nhan-link)] hover:bg-[var(--kin-nen-re-chuot)]`}>
                      <KinStatus tone="xong">{daHoc.length} bài đã học · {showOld ? "thu gọn" : "xem lại"}</KinStatus>
                      {daCham > 0 && <span className="text-[var(--kin-chu-phu)] font-normal">{daCham} bài đã có điểm</span>}
                    </button>
                    {showOld && <ul>{daHoc.map(row)}</ul>}
                  </li>
                )}
                {conLai.map(row)}
              </ul>
            </KinFold>
          </section>
        );
      })}
    </div>
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
  const progress = useProgress();

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
  // SCL5 (A+B): điểm ở lề phải lấy từ kết quả của em trong lớp (/api/student/ket-qua — mọi bài đã chấm, không chỉ 14 ngày gần đây), thêm bài vừa chấm từ việc của tôi.
  const [kq, setKq] = useState<{ href: string | null; state: string; score: number | null; max: number }[]>([]);
  useEffect(() => {
    if (!enrolledHere) return;
    let live = true;
    fetch(`/api/student/ket-qua?courseId=${encodeURIComponent(courseId)}`, { credentials: "same-origin", cache: "no-store" }).then(r => (r.ok ? r.json() : null))
      .then((d: { classes?: { courseId: string; items: { href: string | null; state: string; score: number | null; max: number }[] }[] } | null) => { if (live) setKq(d?.classes?.find(c => c.courseId === courseId)?.items ?? []); })
      .catch(() => {});
    return () => { live = false; };
  }, [courseId, enrolledHere]);
  const grades = useMemo(() => {
    const m = new Map<string, string>();
    for (const i of kq) if (i.state === "da-cham" && i.score !== null && i.href) m.set(i.href.split("/").pop() ?? "", `${on10(i.score, i.max)}/10`);
    for (const i of work.items ?? []) if (i.task?.phase === "da-cham" && i.task.scoreText) m.set(i.task.href.split("/").pop() ?? "", i.task.scoreText);
    return m;
  }, [work.items, kq]);
  const thongBaoReady = !!course && !loading;
  useEffect(() => {
    if (focusThongBao && thongBaoReady) document.getElementById("lop-thong-bao")?.scrollIntoView({ block: "start" });
  }, [focusThongBao, thongBaoReady]);
  // #ban-ghi (link "bản ghi" của gia sư, hàng bản ghi ở Buổi gần đây): mục chỉ có sau khi tải xong nên trình duyệt không tự cuộn tới được.
  const recsReady = recs !== null;
  useEffect(() => {
    if (view === "bai-hoc" && thongBaoReady && recsReady && window.location.hash === "#ban-ghi") document.getElementById("ban-ghi")?.scrollIntoView({ block: "start" });
  }, [view, thongBaoReady, recsReady]);

  const wrap = (children: ReactNode) => <div className={`px-4 md:px-10 pt-5 md:pt-8 pb-32 ${view === "lop" ? "max-w-[1120px]" : "max-w-[800px]"} bg-[var(--kin-nen-trang)]`}>{children}</div>;
  const title = (t: string) => <h1 className="text-[length:var(--kin-co-h2)] leading-9 font-bold tracking-[-0.01em] text-[var(--kin-chu-chinh)] [overflow-wrap:anywhere]">{t}</h1>;

  if (!enrollmentsLoading && classesError) return wrap(<>{title("Lớp của tôi")}<div className="pt-4"><ErrorStrip message="Không tải được danh sách lớp của bạn." onRetry={reloadClasses} /></div></>);
  if (loading || enrollmentsLoading) return wrap(<>{title("Lớp của tôi")}<WorkSkeleton label="Đang tải trang lớp" /></>);
  if (error || !course) {
    return wrap(<>{title("Lớp của tôi")}
      <div className="pt-4"><ErrorStrip message={error || "Không tìm thấy khóa học — có thể bạn đã rời lớp hoặc lớp đã đóng."} onRetry={() => setTick(t => t + 1)} /></div>
      <div className="pt-4"><Link href="/student/hoc-tap" data-all-classes className="inline-flex items-center min-h-11 text-[var(--kin-nhan-link)] underline">Về Lớp của tôi</Link></div></>);
  }
  if (course.trialExpired) return wrap(<>{title(course.name)}<HocThuKhoa courseId={course.id} courseName={course.name} trialDays={course.trialDays} /></>);
  if (course.suspended) return wrap(<>{title(course.name)}<SuspendedNotice contactHref={course.suspended.contactHref} /></>);

  const color = classAccentFor(course.id, course.calendarColor);
  const lopHref = `/student/hoc-tap?course=${encodeURIComponent(courseId)}`;
  const allHref = `${lopHref}&xem=bai-hoc`;
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
            <ul className="border-t border-[var(--kin-vien-nhat)]">{c.lessons.map(l => <LessonRow key={l.id} l={l} grade={grades.get(l.id)} linked={!l.isLocked} now={new Date()} />)}</ul>
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

  // SCL5: mục lục chương › bài theo thứ tự giáo trình (chỉ bài Đã đăng), trạng thái từng bài từ tiến độ thật của em.
  const muc: MucChuong[] = sections.flatMap(s => s.chapters).map(c => {
    const ls = c.lessons.filter(l => ids.has(l.id));
    return { id: c.id, title: c.isImplicit || !c.title.trim() ? "Bài học" : c.title, lessons: ls, done: ls.filter(l => progress.completedIds.has(l.id)).length };
  }).filter(c => c.lessons.length > 0);
  const order = muc.flatMap(c => c.lessons.map(l => l.id));
  const ht = hocTiep(order, progress.completedIds, new Set(Object.keys(progress.watching)));
  const htLesson = ht.lessonId ? lessons.find(l => l.id === ht.lessonId) ?? null : null;
  const openChuong = ht.lessonId ? muc.find(c => c.lessons.some(l => l.id === ht.lessonId))?.id ?? null : null;
  const doneAll = order.filter(id => progress.completedIds.has(id)).length;
  const nc = nextClass(events, now, courseId);
  const zalo = course.zaloGroupUrl || course.zaloGroupLink || "";
  const hasPrimary = !!cards?.some(c => c.primary);
  const tienOk = !progress.loading && !progress.error;

  return wrap(<>
    <header data-dau-lop>
      <div aria-hidden data-vach-lop className="h-1 w-16 rounded-[var(--kin-bo-tron)] mb-3" style={{ background: color }} />
      {title(course.name)}
      {(teacher || sched) && <p className={`mt-1 ${GOC} text-[var(--kin-chu-phu)] [overflow-wrap:anywhere]`}>{[teacher, sched].filter(Boolean).join(" · ")}</p>}
      {course.trial && <HocThuBang t={course.trial} trongLop chinh={!hasPrimary && !(enrolledHere && htLesson)} className="mt-4" />}
      {/* Lối phụ của lớp gom lên đầu trang (không còn khối link lẻ cuối trang). LOI-01: hỏi gia sư TRONG lớp khi bảng tin chung ẩn; DG: Phiếu học phí theo cờ HOC_PHI (chỉ chữ, KHÔNG số tiền). */}
      {enrolledHere && (!featureOn("CONG_DONG") || !isLinkHidden("/student/hoc-phi")) && (
        <p data-lop-thong-tin className={`flex flex-wrap gap-x-4 ${GOC}`}>
          {!featureOn("CONG_DONG") && <Link href={`/cong-dong?scope=${encodeURIComponent(courseId)}`} data-hoi-trong-lop className="inline-flex items-center min-h-11 text-[var(--kin-nhan-link)] underline">Hỏi gia sư trong lớp</Link>}
          {!isLinkHidden("/student/hoc-phi") && <Link href="/student/hoc-phi" data-lop-hoc-phi className="inline-flex items-center min-h-11 text-[var(--kin-nhan-link)] underline">Phiếu học phí của bạn</Link>}
        </p>
      )}
    </header>

    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-8 lg:items-start">
      <div className="min-w-0">
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

        {enrolledHere && htLesson && tienOk && (
          <KinPanel variant="nhan" data-hoc-tiep-lop={htLesson.id} className="mt-6">
            <p className={`${GOC} text-[var(--kin-chu-phu)]`}>{ht.reason === "on-lai" ? "Bạn đã học hết các bài đã đăng" : "Việc tiếp theo trong lớp"}</p>
            <p className="mt-1 text-[length:var(--kin-co-tieu-de)] leading-6 font-semibold text-[var(--kin-chu-chinh)] [overflow-wrap:anywhere]">{htLesson.title}</p>
            <Link href={`/student/bai-giang/${encodeURIComponent(htLesson.id)}`} className={`${kinButtonClass(hasPrimary ? "secondary" : "primary", "lg")} mt-3 w-full font-semibold`}>
              {hocTiepLabel(ht.reason, doneAll).replace(" →", "")}
            </Link>
          </KinPanel>
        )}

        <section aria-labelledby="lop-chuong" data-lop-chuong className="mt-8">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 pb-2">
            <h2 id="lop-chuong" className={H2}>Các chương</h2>
            {order.length > 0 && tienOk && <span data-da-hoc-tong className={`${GOC} text-[var(--kin-chu-phu)] tabular-nums`}>Đã học {doneAll}/{order.length} bài</span>}
          </div>
          {progress.error && <div className="mb-3" data-tien-do-loi><ErrorStrip message="Chưa tải được tiến độ học của bạn. Danh sách bài vẫn mở được." onRetry={progress.reload} /></div>}
          {muc.length === 0 ? <KinEmptyState title="Lớp chưa có bài học nào">Khi gia sư đăng bài học, danh sách sẽ hiện ở đây.</KinEmptyState>
            : <MucLuc chapters={muc} openId={tienOk ? openChuong : null} tien={tienOk ? { completed: progress.completedIds, watching: progress.watching } : null} grades={grades} linked={enrolledHere} now={now} />}
          {recs === "loi" && <div className="mt-3"><ErrorStrip message="Chưa tải được bản ghi của lớp." onRetry={() => { setRecs(null); setRecTick(t => t + 1); }} /></div>}
          <p className={`mt-2 flex flex-wrap gap-x-5 ${GOC}`}>
            {lessons.length > 0 && <Link href={allHref} data-tat-ca-bai className="inline-flex items-center gap-1 min-h-11 font-medium text-[var(--kin-nhan-link)] underline">Tìm bài · Tất cả bài học ({lessons.length})<Chevron /></Link>}
            {recList.length > 0 && <Link href={`${allHref}#ban-ghi`} data-lop-ban-ghi className="inline-flex items-center gap-1 min-h-11 font-medium text-[var(--kin-nhan-link)] underline">Bản ghi các buổi học ({recList.length})</Link>}
          </p>
        </section>
      </div>

      {enrolledHere && (nc || zalo) && (
        <aside className="mt-8 lg:mt-6 space-y-4" aria-label="Buổi tới và nhóm lớp">
          {nc && (
            <KinPanel data-buoi-toi>
              <h2 className={H2}>Buổi tới</h2>
              <p className="mt-1 text-[length:var(--kin-co-body)] font-medium text-[var(--kin-chu-chinh)] tabular-nums">
                {nc.today ? "Hôm nay" : vnWeekdayDate(nc.start)} · {nc.event.endTime ? `${nc.event.time}–${nc.event.endTime}` : nc.event.time}
              </p>
              {nc.event.mode === "offline" && nc.event.location && <p className={`mt-1 ${GOC} text-[var(--kin-chu-phu)] [overflow-wrap:anywhere]`}>Học tại {nc.event.location}</p>}
              {nc.today && nc.event.joinUrl
                ? <a href={nc.event.joinUrl} target="_blank" rel="noopener noreferrer" data-vao-phong className={`${kinButtonClass(hasPrimary ? "secondary" : "primary", "lg")} mt-3 w-full`}>{joinLabel(nc.event.joinUrl, nc.event.time)}</a>
                : nc.event.joinUrl ? <p className={`mt-1 ${GOC} text-[var(--kin-chu-phu)]`}>Học online. Ngày có buổi, nút {joinLabel(nc.event.joinUrl, nc.event.time).split(" · ")[0]} hiện ở đây.</p> : null}
            </KinPanel>
          )}
          {zalo && (
            <KinPanel data-nhom-zalo>
              <h2 className={H2}>Nhóm lớp</h2>
              <p className={`mt-1 ${GOC} text-[var(--kin-chu-phu)]`}>Hỏi bài với thầy cô và các bạn trong lớp. Hạn nộp, bài và tài liệu đã có ngay trên trang này.</p>
              <a href={zalo} target="_blank" rel="noopener noreferrer" className={`${kinButtonClass("secondary", "lg")} mt-3 w-full`}>Mở nhóm Zalo của lớp</a>
            </KinPanel>
          )}
        </aside>
      )}
    </div>

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
