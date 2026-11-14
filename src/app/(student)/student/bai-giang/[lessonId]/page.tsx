"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useProgress } from "@/hooks/useProgress";
import { parseLessonType } from "@/lib/types";
import { formatStamp } from "@/lib/mediaLink";
import { firstHttpLink } from "@/lib/lessonLinks";
import { api, type AssignmentFull, type AssignmentAnswerData, type AssignmentAnswerView } from "@/lib/api";
import { NopTepBox } from "@/components/student/nop-tep/NopTepBox";
import { nopTepResultMessage } from "@/lib/nopTep";
import { MathText } from "@/components/MathText";
import {
  Flash, Alarm, Edit, ClipboardList, Play,
  FileDownload, Lock, CheckCircle,
  ArrowLeft, ArrowRight,
  StickyNote,
} from "griddy-icons";
import { LessonVideo, type PlayerControl } from "@/components/media/LessonVideo";
import { DocumentRows, AzotaPanel, StampedNotes, parseMaterials } from "@/components/media/StudentLessonPanels";
import { KinLoader } from "@/components/kin/KinLoader";
import { SuspendedNotice } from "@/components/student/SuspendedNotice";
import CourseOutline from "@/components/student/CourseOutline";

// ─── Types ───────────────────────────────────────────────────────────────────
type LessonType = "record" | "live" | "quiz" | "document";

// Học viên bấm vào tài liệu → mở tab xem trước (/xem-tai-lieu) thay vì tải
// thẳng file — trang đó tự xử lý xem trước (PDF/Office) + nút tải riêng giữ
// đúng tên gốc (Cloudinary lưu file với public_id tự sinh, không giữ tên).
function viewerHref(name: string, url: string): string {
  return `/xem-tai-lieu?url=${encodeURIComponent(url)}&name=${encodeURIComponent(name)}`;
}

interface ChapterLesson {
  id: string;
  code: string;
  title: string;
  type: LessonType;
  duration?: string;
  isCompleted: boolean;
  isLocked: boolean;
  isFree: boolean;
  stats: { videos: number; materials: number; views: number };
}

interface Chapter {
  id: string;
  title: string;
  lessons: ChapterLesson[];
}

interface Section {
  id: string;
  title: string;
  chapters: Chapter[];
}

// ─── DB types từ /api/lessons/[id]/context ────────────────────────────────────
interface DBLesson {
  id: string; code: string; title: string; type: string;
  duration?: string | null; videoUrl?: string | null;
  zoomUrl?: string | null; azotaUrl?: string | null; azotaDeadline?: string | null;
  documents?: string | null; adminNote?: string | null;
  isLocked: boolean; isFree: boolean;
  statsVideos: number; statsMaterials: number; statsViews: number;
}
interface DBChapter { id: string; title: string; order: number; lessons: DBLesson[] }
interface DBSection { id: string; title: string; order: number; chapters: DBChapter[] }
interface DBCourse {
  id: string; name: string; instructor: string; price: number; originalPrice?: number | null;
  sections: DBSection[];
}
// enrolled=true: admin hoặc đã mua; false: xem bài free chưa mua
interface LessonContext { lesson: DBLesson; course: DBCourse; enrolled: boolean }

// API đã normalise isLocked: enrolled→false, not-enrolled→!isFree.
// Chỉ cần map 1-1, không tính lại ở frontend.
function dbToLocalSections(dbSections: DBSection[], completedIds: Set<string>): Section[] {
  return dbSections.map(s => ({
    id: s.id,
    title: s.title,
    chapters: s.chapters.map(c => ({
      id: c.id,
      title: c.title,
      lessons: c.lessons.map(l => ({
        id:          l.id,
        code:        l.code,
        title:       l.title,
        type:        parseLessonType(l.type),
        duration:    l.duration ?? undefined,
        isCompleted: completedIds.has(l.id),
        isLocked:    l.isLocked,
        isFree:      l.isFree,
        stats: { videos: l.statsVideos, materials: l.statsMaterials, views: l.statsViews },
      })),
    })),
  }));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const TYPE_CONFIG: Record<LessonType, { label: string; color: string; bg: string; Icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }> }> = {
  record:   { label: "Record",   color: "var(--kin-nhan-link)", bg: "var(--kin-nhan-nen-nhat)", Icon: Play },
  live:     { label: "LIVE",     color: "var(--kin-tt-chu-xong)", bg: "var(--kin-chu-tren-nut-chinh)", Icon: Flash },
  quiz:     { label: "Bài Tập",     color: "var(--kin-tt-chu-cho)", bg: "var(--kin-chu-tren-nut-chinh)", Icon: Edit },
  document: { label: "Tài liệu", color: "var(--kin-chu-mo)", bg: "var(--kin-chu-tren-nut-chinh)", Icon: ClipboardList },
};

function TypeBadge({ type, small }: { type: LessonType; small?: boolean }) {
  const cfg = TYPE_CONFIG[type];
  return (
    <span className={`inline-flex items-center gap-1 font-bold rounded-full ${small ? "text-xs px-2 py-0.5" : "text-xs px-2.5 py-1"}`}
      style={{ background: cfg.bg, color: cfg.color }}>
      <cfg.Icon size={small ? 10 : 12} />
      {cfg.label}
    </span>
  );
}

// ─── Content area by type ─────────────────────────────────────────────────────
function LiveContent({ zoomUrl }: { zoomUrl?: string | null }) {
  return (
    <div className="rounded-xl p-10 text-center"
      style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}>
      <div className="w-20 h-20 rounded-xl flex items-center justify-center mx-auto mb-4"
        style={{ background: "var(--kin-tt-chu-xong)" }}>
        <Flash size={36} style={{ color: "white" }} />
      </div>
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold mb-3"
        style={{ background: "var(--kin-tt-nen-xong)", color: "var(--kin-tt-chu-xong)" }}>
        <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--kin-tt-chu-xong)" }} />
        Buổi học LIVE
      </div>
      <h2 className="text-xl font-extrabold mb-2" style={{ color: "var(--kin-chu-chinh)" }}>
        Buổi học sắp diễn ra
      </h2>
      <p className="text-sm mb-6" style={{ color: "var(--kin-chu-mo)" }}>
        Buổi học sẽ diễn ra trực tiếp qua Zoom. Link phòng sẽ hiển thị 15 phút trước giờ học.
      </p>
      {zoomUrl ? (
        <a href={zoomUrl} target="_blank" rel="noopener noreferrer"
          className="inline-block px-8 py-3 font-bold text-white text-sm"
          style={{ background: "var(--kin-nhan-nen)", borderRadius: "8px" }}>
          Vào phòng Zoom →
        </a>
      ) : (
        <button disabled className="px-8 py-3 rounded-lg font-bold text-sm"
          style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)", color: "var(--kin-chu-mo)" }}>
          Chưa đến giờ học
        </button>
      )}
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
function fmtDue(d: string | null): string {
  if (!d) return "";
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}/${dt.getFullYear()}`;
}

// BU-HS-NOP-TEP: khối nộp bài là <NopTepBox> (kéo-thả Word/PDF, riêng tư, lưu 60 ngày). Thẻ này giữ tiêu đề, hướng dẫn, tệp đề bài, hạn và khối điểm/nhận xét.
// LOI-03 mục 4.3 (chỉ thứ tự): tiêu đề + hạn → (đã chấm: khối điểm/nhận xét) → NopTepBox NGAY DƯỚI → hướng dẫn + tệp đề bài. Thẻ rộng hết khung (390: full-width).
// Nộp bằng link Azota và "Em đã làm xong" vẫn ở <AzotaPanel>, nay đứng SAU các thẻ bài tập (TabBaiTap).
function AssignmentCard({ assignment }: { assignment: AssignmentFull }) {
  const sub = assignment.mySubmission;
  return (
    <div data-bai-tap-the={assignment.id} className="rounded-xl p-4" style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)" }}>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 mb-3">
        <p className="min-w-0 font-semibold text-sm [overflow-wrap:anywhere]" style={{ color: "var(--kin-chu-chinh)" }}>{assignment.title}</p>
        {assignment.dueDate && (
          <p className="text-xs flex items-center gap-1 flex-shrink-0" style={{ color: "var(--kin-tt-chu-loi)" }}>
            <Alarm size={11} /> Hạn {fmtDue(assignment.dueDate)}
          </p>
        )}
      </div>

      {sub?.gradedAt && (
        <div className="p-3 rounded-lg mb-3" style={{ background: "var(--kin-tt-nen-xong)" }}>
          <p className="text-sm font-bold" style={{ color: "var(--kin-tt-chu-xong)" }}>Điểm: {sub.score}/{assignment.maxPoints}</p>
          {sub.comment && <p className="text-xs mt-1" style={{ color: "var(--kin-tt-chu-xong)" }}>Nhận xét: {sub.comment}</p>}
        </div>
      )}

      <NopTepBox mode="student" assignmentId={assignment.id}
        submission={sub ? { submittedAt: sub.submittedAt, fileUrl: sub.fileUrl, fileName: sub.fileName, gradedAt: sub.gradedAt } : null} />

      {(assignment.instructions || assignment.fileUrl) && (
        <div data-bai-tap-huong-dan className="mt-4 pt-3" style={{ borderTop: "1px solid var(--kin-vien-thuong)" }}>
          {assignment.instructions && <p className="text-xs [overflow-wrap:anywhere]" style={{ color: "var(--kin-chu-mo)" }}>{assignment.instructions}</p>}
          {assignment.fileUrl && (
            <a href={viewerHref(assignment.fileName || "de-bai", assignment.fileUrl)} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 min-h-11 text-xs font-semibold" style={{ color: "var(--kin-tt-chu-xong)" }}>
              <FileDownload size={14} /> {assignment.fileName || "Tải đề bài"}
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Bài tập "làm trên web" (mode: interactive) ───────────────────────────────
function QuestionAnswerRow({ q, qi, locked, saving, onSelectOption, onEssayChange, onEssayBlur }: {
  q: AssignmentAnswerView; qi: number; locked: boolean; saving: boolean;
  onSelectOption: (optionId: string) => void;
  onEssayChange: (text: string) => void;
  onEssayBlur: (text: string) => void;
}) {
  const mine = q.myAnswer;

  function optionStyle(o: AssignmentAnswerView["options"][number]) {
    if (!locked) {
      return mine?.optionId === o.id
        ? { borderColor: "var(--kin-nhan-nen)", background: "var(--kin-nhan-nen-nhat)" }
        : { borderColor: "var(--kin-vien-thuong)", background: "var(--kin-nen-trang)" };
    }
    // Đã khoá — tô xanh đáp án đúng, đỏ nếu học viên lỡ chọn sai.
    if (o.isCorrect) return { borderColor: "var(--kin-tt-chu-xong)", background: "var(--kin-tt-nen-xong)" };
    if (mine?.optionId === o.id) return { borderColor: "var(--kin-tt-chu-loi)", background: "var(--kin-tt-nen-loi)" };
    return { borderColor: "var(--kin-vien-thuong)", background: "var(--kin-nen-trang)" };
  }

  return (
    <div className="rounded-lg p-3" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}>
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="text-sm font-medium flex-1" style={{ color: "var(--kin-chu-chinh)" }}>
          <span className="text-xs font-semibold mr-1" style={{ color: "var(--kin-chu-mo)" }}>Câu {qi + 1}.</span>
          <MathText text={q.text} />
        </p>
        <span className="text-xs flex-shrink-0" style={{ color: "var(--kin-chu-mo)" }}>{q.points}đ</span>
      </div>
      {q.imageUrl && <img src={q.imageUrl} alt="" className="max-h-48 rounded-lg border mb-2" style={{ borderColor: "var(--kin-vien-thuong)" }} />}

      {q.type === "MC" ? (
        <div className="space-y-1.5">
          {q.options.map(o => (
            <button key={o.id} type="button" disabled={locked} onClick={() => onSelectOption(o.id)}
              className="w-full text-left px-3 py-2 text-sm rounded-lg border transition-colors disabled:cursor-default"
              style={optionStyle(o)}>
              <MathText text={o.text} />
            </button>
          ))}
        </div>
      ) : (
        <textarea
          className="w-full px-3 py-2 text-sm border rounded-lg outline-none resize-none focus:border-blue-400"
          style={{ borderColor: "var(--kin-vien-thuong)", background: locked ? "var(--kin-nen-bang)" : "var(--kin-nen-trang)" }}
          rows={3} disabled={locked}
          placeholder="Nhập câu trả lời..."
          value={mine?.textAnswer ?? ""}
          onChange={e => onEssayChange(e.target.value)}
          onBlur={e => onEssayBlur(e.target.value)} />
      )}

      {saving && <p className="text-xs mt-1" style={{ color: "var(--kin-chu-mo)" }}>Đang lưu...</p>}

      {locked && q.explanation && (
        <p className="text-xs mt-2 p-2 rounded-lg" style={{ background: "var(--kin-nhan-nen-nhat)", color: "var(--kin-nhan-link)" }}>
          <span className="font-semibold">Giải thích: </span><MathText text={q.explanation} />
        </p>
      )}
      {locked && q.type === "ESSAY" && (
        mine?.pointsAwarded != null ? (
          <p className="text-xs mt-2" style={{ color: "var(--kin-tt-chu-xong)" }}>
            Điểm: {mine.pointsAwarded}/{q.points}{mine.teacherComment && ` — ${mine.teacherComment}`}
          </p>
        ) : (
          <p className="text-xs mt-2" style={{ color: "var(--kin-chu-mo)" }}>Chưa được giáo viên chấm.</p>
        )
      )}
    </div>
  );
}

function InteractiveAssignmentCard({ assignment }: { assignment: AssignmentFull }) {
  const [data, setData]         = useState<AssignmentAnswerData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    api.assignments.getAnswer(assignment.id).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, [assignment.id]);

  async function saveAnswer(questionId: string, patch: { optionId?: string | null; textAnswer?: string | null }) {
    setSavingIds(prev => new Set(prev).add(questionId));
    try {
      await api.assignments.saveAnswer(assignment.id, { questionId, ...patch });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Lưu đáp án thất bại");
      // Đồng bộ lại — có thể vừa hết hạn nộp ngay giữa lúc đang làm bài.
      api.assignments.getAnswer(assignment.id).then(setData).catch(() => {});
    } finally {
      setSavingIds(prev => { const n = new Set(prev); n.delete(questionId); return n; });
    }
  }

  function selectOption(questionId: string, optionId: string) {
    setData(prev => prev && {
      ...prev,
      questions: prev.questions.map(q => q.id === questionId
        ? { ...q, myAnswer: { optionId, textAnswer: null, isCorrect: null, pointsAwarded: q.myAnswer?.pointsAwarded ?? null, teacherComment: q.myAnswer?.teacherComment ?? null } }
        : q),
    });
    saveAnswer(questionId, { optionId });
  }
  function updateEssayLocal(questionId: string, text: string) {
    setData(prev => prev && {
      ...prev,
      questions: prev.questions.map(q => q.id === questionId
        ? { ...q, myAnswer: { optionId: null, textAnswer: text, isCorrect: null, pointsAwarded: q.myAnswer?.pointsAwarded ?? null, teacherComment: q.myAnswer?.teacherComment ?? null } }
        : q),
    });
  }

  if (loading) {
    return (
      <div className="rounded-xl p-4" style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)" }}>
        <p className="text-xs" style={{ color: "var(--kin-chu-mo)" }}>Đang tải...</p>
      </div>
    );
  }
  if (!data) return null;

  const { locked, completion, questions } = data;
  const totalScore = questions.reduce((s, q) => s + (q.type === "ESSAY" ? (q.myAnswer?.pointsAwarded ?? 0) : (q.myAnswer?.isCorrect ? q.points : 0)), 0);
  const maxScore = questions.reduce((s, q) => s + q.points, 0);
  const hasUngradedEssay = locked && questions.some(q => q.type === "ESSAY" && q.myAnswer?.pointsAwarded == null);

  return (
    <div className="rounded-xl p-4" style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)" }}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="font-semibold text-sm flex items-center gap-1.5" style={{ color: "var(--kin-chu-chinh)" }}>
            <span title="Làm trên web">🖥️</span> {assignment.title}
          </p>
          {assignment.instructions && <p className="text-xs mt-1" style={{ color: "var(--kin-chu-mo)" }}>{assignment.instructions}</p>}
        </div>
        {assignment.dueDate && (
          <p className="text-xs flex items-center gap-1 flex-shrink-0" style={{ color: locked ? "var(--kin-chu-mo)" : "var(--kin-tt-chu-loi)" }}>
            <Alarm size={11} /> {locked ? `Đã hết hạn ${fmtDue(assignment.dueDate)}` : `Hạn ${fmtDue(assignment.dueDate)}`}
          </p>
        )}
      </div>

      {locked ? (
        <div className="p-3 rounded-lg mb-3" style={{ background: "var(--kin-tt-nen-xong)" }}>
          <p className="text-sm font-bold" style={{ color: "var(--kin-tt-chu-xong)" }}>Điểm: {totalScore}/{maxScore}</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--kin-tt-chu-xong)" }}>
            Đã hết hạn — xem lại đáp án bên dưới.{hasUngradedEssay && " Một số câu tự luận chưa được chấm, điểm có thể thay đổi."}
          </p>
        </div>
      ) : (
        <p className="text-xs mb-3" style={{ color: "var(--kin-nhan-link)" }}>Đã làm {completion.answered}/{completion.total} câu — tự lưu khi bạn trả lời.</p>
      )}

      {!expanded ? (
        <button onClick={() => setExpanded(true)}
          className="px-4 py-2 text-xs font-bold text-[var(--kin-chu-tren-nut-chinh)] rounded-lg" style={{ background: "var(--kin-tt-cham-cho)" }}>
          {locked ? "Xem lại bài làm" : completion.answered > 0 ? "Tiếp tục làm bài" : "Bắt đầu làm bài"}
        </button>
      ) : (
        <div className="space-y-3">
          {questions.map((q, qi) => (
            <QuestionAnswerRow key={q.id} q={q} qi={qi} locked={locked} saving={savingIds.has(q.id)}
              onSelectOption={optionId => selectOption(q.id, optionId)}
              onEssayChange={text => updateEssayLocal(q.id, text)}
              onEssayBlur={text => saveAnswer(q.id, { textAnswer: text })} />
          ))}
          <button onClick={() => setExpanded(false)} className="text-xs font-semibold" style={{ color: "var(--kin-chu-mo)" }}>Thu gọn</button>
        </div>
      )}
    </div>
  );
}

// LOI-03: thứ tự = [kết quả ?nop] → thẻ nộp tệp → thẻ làm trên web → AzotaPanel. `azotaAbove`: bài loại quiz đã vẽ Azota ở khung chính nên tab này không vẽ lại.
function TabBaiTap({ lessonId, azotaUrl, deadline, nopCode, azotaAbove = false }: { lessonId: string; azotaUrl?: string; deadline?: string; nopCode?: string | null; azotaAbove?: boolean }) {
  const [assignments, setAssignments] = useState<AssignmentFull[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.assignments.listByLesson(lessonId).then(setAssignments).catch(() => setAssignments([])).finally(() => setLoading(false));
  }, [lessonId]);

  const nopText = nopTepResultMessage(nopCode);

  if (!azotaUrl && !loading && assignments.length === 0) {
    return <p className="text-sm text-center py-6" style={{ color: "var(--kin-chu-mo)" }}>{azotaAbove ? "Bài học này không có bài nộp tệp. Bài Azota nằm ở phía trên." : "Bài học này không có bài kiểm tra."}</p>;
  }

  return (
    <div className="space-y-3">
      {nopText && (
        <p role={nopCode === "ok" ? "status" : "alert"} data-nop-tep-ket-qua={nopCode} className="px-4 py-3 rounded-xl text-sm font-medium"
          style={nopCode === "ok"
            ? { background: "var(--kin-tt-nen-xong)", border: "1px solid var(--kin-tt-vien-xong)", color: "var(--kin-tt-chu-xong)" }
            : { background: "var(--kin-tt-nen-loi)", border: "1px solid var(--kin-tt-vien-loi)", color: "var(--kin-tt-chu-loi)" }}>
          {nopText}
        </p>
      )}
      {assignments.filter(a => a.mode !== "interactive").map(a => <AssignmentCard key={a.id} assignment={a} />)}
      {assignments.filter(a => a.mode === "interactive").map(a => <InteractiveAssignmentCard key={a.id} assignment={a} />)}
      {azotaUrl && <AzotaPanel lessonId={lessonId} azotaUrl={azotaUrl} deadline={deadline} canSubmit />}
    </div>
  );
}

type ScheduleItem = { type: LessonType; subject: string; topic: string; time: string; date: string };
function TabLich({ items }: { items: ScheduleItem[] }) {
  if (!items.length) return <p className="text-sm text-center py-6" style={{ color: "var(--kin-chu-mo)" }}>Không có sự kiện liên quan.</p>;
  return (
    <div className="space-y-2">
      {items.map((e: ScheduleItem, i: number) => {
        const cfg = TYPE_CONFIG[e.type];
        return (
          <div key={i} className="flex items-center gap-3 p-3 rounded-xl"
            style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)" }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: cfg.bg }}>
              <cfg.Icon size={17} style={{ color: cfg.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate" style={{ color: "var(--kin-chu-chinh)" }}>{e.topic}</p>
              <p className="text-xs" style={{ color: "var(--kin-chu-mo)" }}>{e.date} · {e.time}</p>
            </div>
            <TypeBadge type={e.type} small />
          </div>
        );
      })}
    </div>
  );
}

// ─── Left Sidebar (HSA-style) ────────────────────────────────────────────────
// BU-HS-TRANG-CHU: phần cây Phần > Chương > Bài là component dùng chung CourseOutline (chương xổ ra/thu vào, tìm bài, Mở hết/Thu hết, đếm theo chương); ở đây chỉ còn
// khung thanh bên (tên lớp + tiến độ + nút thu/mở). Chọn bài vẫn qua `onSelect` (handleSelectLesson). `mobile` = tờ trượt trên điện thoại.
function LeftCourseSidebar({ sections, currentId, onSelect, completedIds, watching, courseId, courseName, isOpen, onToggle, mobile = false }: {
  sections: Section[]; currentId: string;
  watching: Record<string, number>;
  onSelect: (l: ChapterLesson) => void;
  completedIds: Set<string>;
  courseId: string; courseName: string;
  isOpen: boolean; onToggle: () => void;
  mobile?: boolean;
}) {
  const allLessons = useMemo(() => sections.flatMap(s => s.chapters.flatMap(c => c.lessons)), [sections]);
  const completedCount = allLessons.filter(l => completedIds.has(l.id)).length;
  const pct = Math.round(completedCount * 100 / Math.max(allLessons.length, 1));
  const pick = (id: string) => { const l = allLessons.find(x => x.id === id); if (l) onSelect(l); };
  const outlineId = mobile ? "bg-to" : "bg-cot";

  return (
    <div className={mobile ? "flex flex-col w-full" : "hidden xl:flex flex-shrink-0"}>
      {/* Panel */}
      <div
        id={mobile ? undefined : "bai-giang-cot"}
        className="flex flex-col overflow-hidden transition-all duration-250"
        style={mobile ? { width: "100%", background: "var(--kin-nen-trang)" } : {
          width: isOpen ? 268 : 0,
          borderRight: isOpen ? "1px solid var(--kin-vien-thuong)" : "none",
          background: "var(--kin-nen-trang)",
          position: "sticky",
          top: 64,
          height: "calc(100vh - 64px)",
        }}>
        {(isOpen || mobile) && (
          <div className={mobile ? "w-full flex flex-col" : "w-[268px] flex flex-col h-full"}>
            {/* Header */}
            <div className="px-4 pt-2 pb-3 flex-shrink-0" style={{ borderBottom: "1px solid var(--kin-vien-thuong)" }}>
              <Link href={`/student/hoc-tap?course=${courseId}`}
                className="inline-flex items-center gap-1 min-h-11 text-xs font-semibold hover:opacity-70 transition-opacity"
                style={{ color: "var(--kin-chu-mo)" }}>
                ← Khóa học
              </Link>
              <p className="text-sm font-extrabold leading-snug line-clamp-2" style={{ color: "var(--kin-chu-chinh)" }}>{courseName}</p>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--kin-vien-thuong)" }}>
                  <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: "var(--kin-nhan-nen)" }} />
                </div>
                <span className="text-xs font-semibold flex-shrink-0" style={{ color: "var(--kin-chu-mo)" }}>
                  {completedCount}/{allLessons.length}
                </span>
              </div>
            </div>

            {/* Cây nội dung: ô tìm + Mở hết/Thu hết đứng yên dưới tiến độ, cây cuộn riêng (rail) hoặc cuộn cùng tờ (sheet). */}
            <CourseOutline variant={mobile ? "sheet" : "rail"} idPrefix={outlineId} sections={sections} completedIds={completedIds} currentId={currentId} watching={watching}
              onSelect={pick} lessonExtra={l => <TypeBadge type={(l as ChapterLesson).type} small />} className={mobile ? "" : "flex-1"} />
          </div>
        )}
      </div>

      {/* Toggle tab — desktop only */}
      {!mobile && (
        <button onClick={onToggle} aria-label={isOpen ? "Thu gọn danh sách bài học" : "Mở danh sách bài học"} aria-expanded={isOpen} aria-controls="bai-giang-cot"
          className="flex-shrink-0 self-start mt-10 flex items-center justify-center rounded-r-lg text-sm font-bold transition-colors hover:bg-[var(--kin-vien-thuong)]"
          style={{
            width: 16, height: 48,
            background: "var(--kin-nen-bang)",
            border: "1px solid var(--kin-vien-thuong)",
            borderLeft: "none",
            color: "var(--kin-chu-mo)",
            writingMode: "horizontal-tb",
          }}>
          {isOpen ? "‹" : "›"}
        </button>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LessonPage({ params: paramsPromise }: { params: Promise<{ lessonId: string }> }) {
  const params = React.use(paramsPromise);
  const router = useRouter();
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // ?nop=<mã> là đích của 303 sau khi bấm "Nộp bài": mở thẳng tab Bài tập và đọc kết quả (mã, không phải chữ người dùng).
  const [nopCode] = useState<string | null>(() => (typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("nop")));
  // LOI-03: ?tab=bai-tap (liên kết "Làm bài tập" của phiếu "Hôm nay có lớp") cũng mở thẳng tab Bài tập; bài loại quiz mở tab Bài tập mặc định.
  const [tabParam] = useState<string | null>(() => (typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("tab")));
  const [firstLessonId] = useState(params.lessonId);
  const { completedIds, watching, positions, markComplete, unmarkComplete } = useProgress();
  const [player, setPlayer] = useState<PlayerControl | null>(null);
  const [session, setSession] = useState<{ email?: string; role?: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "same-origin" }).then(r => (r.ok ? r.json() : null)).then(d => setSession(d?.user ?? d ?? null)).catch(() => {});
  }, []);

  // DG (14/11/2026): trang xếp MỘT CỘT (video → Tài liệu → Bài tập → Ghi chú), không còn tab. ?nop=<mã> (vừa nộp bài) và ?tab=bai-tap ("Làm bài tập")
  // cuộn tới khối Bài tập khi trang đã vẽ — thay cho việc mở thẳng tab Bài tập trước đây.
  const [wantBaiTap, setWantBaiTap] = useState(() => !!nopCode || tabParam === "bai-tap");
  useEffect(() => { // bỏ ?nop khỏi địa chỉ để tải lại trang không báo lại
    if (!nopCode) return;
    const u = new URL(window.location.href);
    u.searchParams.delete("nop");
    window.history.replaceState(null, "", u.pathname + u.search + u.hash);
  }, [nopCode]);

  useEffect(() => {
    const saved = localStorage.getItem("lessonSidebar");
    if (saved !== null) setSidebarOpen(saved === "1");
  }, []);

  function toggleSidebar() {
    setSidebarOpen(v => {
      localStorage.setItem("lessonSidebar", v ? "0" : "1");
      return !v;
    });
  }

  const [ctx, setCtx]               = useState<LessonContext | null>(null);
  const [ctxStatus, setCtxStatus]   = useState<number | null>(null);
  const [suspended, setSuspended]   = useState<{ contactHref: string | null } | null>(null);
  const [ctxLoading, setCtxLoading] = useState(true);

  useEffect(() => {
    setCtxLoading(true);
    setCtx(null);
    setCtxStatus(null);
    setSuspended(null);
    fetch(`/api/lessons/${params.lessonId}/context`)
      .then(async r => {
        setCtxStatus(r.status);
        if (r.ok) return r.json();
        // Đã nghỉ lớp (quyết định 06/11/2026): 403 kèm code → trang thông báo riêng, không phải "chưa vào lớp".
        const body = r.status === 403 ? await r.json().catch(() => null) as { code?: string; contactHref?: string | null } | null : null;
        if (body?.code === "enrollment_suspended") setSuspended({ contactHref: body.contactHref ?? null });
        return null;
      })
      .then(data => setCtx(data))
      .catch(() => setCtxStatus(500))
      .finally(() => setCtxLoading(false));
  }, [params.lessonId]);

  if (ctxLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <KinLoader size={44} />
      </div>
    );
  }

  if (!ctx && suspended) return <SuspendedNotice contactHref={suspended.contactHref} />;

  if (!ctx) {
    const isForbidden = ctxStatus === 403;
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-5 text-center px-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: isForbidden ? "var(--kin-tt-nen-cho)" : "var(--kin-nen-bang)" }}>
          {isForbidden
            ? <Lock size={28} style={{ color: "var(--kin-tt-chu-cho)" }} />
            : <FileDownload size={28} style={{ color: "var(--kin-chu-mo)" }} />
          }
        </div>
        <div>
          <p className="text-lg font-extrabold mb-1" style={{ color: "var(--kin-chu-chinh)" }}>
            {isForbidden ? "Bài học này dành cho học sinh của lớp" : "Không tìm thấy bài học"}
          </p>
          <p className="text-sm" style={{ color: "var(--kin-chu-mo)" }}>
            {isForbidden
              ? "Bạn chưa vào lớp này. Nhập mã mời của gia sư để vào lớp, hoặc xem các lớp đang mở."   // học sinh học miễn phí (quyết định D01), không có bước "mua"
              : "Bài học không tồn tại hoặc đã bị xóa."}
          </p>
        </div>
        <div className="flex gap-3">
          {isForbidden ? (
            <>
              <Link href="/student/nhap-ma-lop"
                className="px-4 py-2 text-sm font-bold text-white rounded-xl"
                style={{ background: "var(--kin-nhan-nen)" }}>
                Nhập mã mời
              </Link>
              <Link href="/khoa-hoc"
                className="px-4 py-2 text-sm font-semibold rounded-xl"
                style={{ border: "1px solid var(--kin-vien-thuong)", color: "var(--kin-nhan-link)" }}>
                Xem các lớp học
              </Link>
            </>
          ) : (
            <Link href="/student"
              className="px-4 py-2 text-sm font-bold text-white rounded-xl"
              style={{ background: "var(--kin-nhan-nen)" }}>
              ← Về trang học
            </Link>
          )}
          <Link href="/student"
            className="px-4 py-2 text-sm font-semibold rounded-xl"
            style={{ border: "1px solid var(--kin-vien-thuong)", color: "var(--kin-chu-mo)" }}>
            Tổng quan
          </Link>
        </div>
      </div>
    );
  }

  const dbLesson  = ctx.lesson;
  const dbCourse  = ctx.course;
  const enrolled  = ctx.enrolled;

  const sections   = dbToLocalSections(dbCourse.sections, completedIds);
  const allLessons = sections.flatMap(s => s.chapters.flatMap(c => c.lessons));
  const lessonIdx  = allLessons.findIndex(l => l.id === params.lessonId);
  // dbLesson (từ context API, luôn tồn tại) là nguồn dữ liệu chuẩn — chỉ dùng
  // allLessons[lessonIdx] khi tìm thấy, tránh crash khi bài học không nằm
  // trong dbCourse.sections (mismatch cấu trúc khoá học).
  const rawLesson: ChapterLesson = lessonIdx >= 0 ? allLessons[lessonIdx] : {
    id:          dbLesson.id,
    code:        dbLesson.code,
    title:       dbLesson.title,
    type:        parseLessonType(dbLesson.type),
    duration:    dbLesson.duration ?? undefined,
    isCompleted: completedIds.has(dbLesson.id),
    isLocked:    dbLesson.isLocked,
    isFree:      dbLesson.isFree,
    stats: { videos: dbLesson.statsVideos, materials: dbLesson.statsMaterials, views: dbLesson.statsViews },
  };
  const prevLesson = lessonIdx > 0 ? allLessons[lessonIdx - 1] : null;
  const nextLesson = lessonIdx >= 0 && lessonIdx < allLessons.length - 1 ? allLessons[lessonIdx + 1] : null;

  const lesson = {
    ...rawLesson,
    teacherName:     dbCourse.instructor,
    views:           rawLesson.stats.views,
    materials:       parseMaterials(dbLesson.documents),
    azotaUrl:        dbLesson.azotaUrl ?? null,
    azotaDeadline:   dbLesson.azotaDeadline ?? "",
    // Chỉ http/https mới vào href (loại javascript:, data:); cột có thể là chuỗi JSON của mảng.
    zoomUrl:         firstHttpLink(dbLesson.zoomUrl),
    note:            "",
    relatedSchedule: [] as Array<{ type: LessonType; subject: string; topic: string; time: string; date: string }>,
    prevLesson,
    nextLesson,
  };

  const videoUrl = dbLesson.videoUrl ?? null;

  function handleSelectLesson(l: ChapterLesson) {
    if (l.isLocked) return;
    router.push(`/student/bai-giang/${l.id}`);
  }

  const completedCount = allLessons.filter(l => completedIds.has(l.id)).length;
  const isCompleted    = completedIds.has(params.lessonId);
  const watchedHere    = watching[params.lessonId] ?? 0;

  const sectionHead = (id: string, icon: React.ReactNode, label: string) => (
    <h2 id={id} className="flex items-center gap-1.5 text-sm font-bold" style={{ color: "var(--kin-chu-chinh)" }}>{icon}{label}</h2>
  );

  return (
    <div className="-mx-4 md:-mx-8 -my-6">
      {/* Full-width flex layout: sidebar + content */}
      <div className="flex min-h-screen">

        {/* ── LEFT SIDEBAR (desktop only) ── */}
        <LeftCourseSidebar
          sections={sections}
          currentId={lesson.id}
          onSelect={handleSelectLesson}
          completedIds={completedIds}
          watching={watching}
          courseId={dbCourse.id}
          courseName={dbCourse.name}
          isOpen={sidebarOpen}
          onToggle={toggleSidebar}
        />

        {/* ── MAIN CONTENT ── */}
        <div className="flex-1 min-w-0 px-4 md:px-6 py-5 space-y-4">

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs flex-wrap" style={{ color: "var(--kin-chu-mo)" }}>
            <Link href="/student" style={{ color: "var(--kin-nhan-link)" }}>Tổng quan</Link>
            <span>/</span>
            <Link href={`/student/hoc-tap?course=${dbCourse.id}`} style={{ color: "var(--kin-nhan-link)" }}>{dbCourse.name}</Link>
            <span>/</span>
            <span style={{ color: "var(--kin-chu-chinh)" }} className="truncate max-w-[200px]">{lesson.title}</span>
          </div>

          {/* Content by type */}
          {lesson.type === "record" && (
            <LessonVideo
              key={params.lessonId}
              videoUrl={videoUrl}
              lessonId={params.lessonId}
              userEmail={session?.email}
              startAt={positions[params.lessonId] ?? null}
              onControl={setPlayer}
              onAutoComplete={!isCompleted ? () => markComplete(params.lessonId) : undefined}
            />
          )}
          {lesson.type === "live"     && <LiveContent zoomUrl={lesson.zoomUrl ?? undefined} />}
          {lesson.type === "quiz" && (lesson.azotaUrl
            ? <AzotaPanel lessonId={params.lessonId} azotaUrl={lesson.azotaUrl} deadline={lesson.azotaDeadline} canSubmit={enrolled && session?.role !== "admin"} />
            : <p className="text-sm text-center py-8 rounded-xl" role="status" style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)", color: "var(--kin-chu-mo)" }}>Gia sư chưa gắn link bài Azota cho bài này.</p>)}
          {lesson.type === "document" && (
            <p className="text-sm text-center py-8 rounded-xl" role="status" style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)", color: "var(--kin-chu-mo)" }}>Bài này là tài liệu. Xem thử hoặc tải về ở mục Tài liệu bên dưới.</p>
          )}

          {/* Lesson info — không đóng khung, chỉ là phần mở rộng tự nhiên của video */}
          <div className="flex items-start justify-between gap-3 pt-1">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <TypeBadge type={lesson.type} />
                <span className="text-xs font-mono px-2 py-0.5 rounded-lg" style={{ background: "var(--kin-nen-bang)", color: "var(--kin-chu-mo)" }}>
                  {lesson.code}
                </span>
              </div>
              <h1 className="text-xl font-extrabold leading-snug" style={{ color: "var(--kin-chu-chinh)" }}>{lesson.title}</h1>
              <div className="flex flex-wrap items-center gap-4 mt-2 text-xs" style={{ color: "var(--kin-chu-mo)" }}>
                {lesson.teacherName && <span>{lesson.teacherName}</span>}
                {lesson.duration && <span className="flex items-center gap-1"><Play size={11} />{lesson.duration}</span>}
                {lesson.materials.length > 0 && <span className="flex items-center gap-1"><FileDownload size={11} />{lesson.materials.length} tài liệu</span>}
                {!isCompleted && watchedHere > 0 && <span className="font-semibold" style={{ color: "var(--kin-nhan-link)" }}>Đang xem dở · từ {formatStamp(watchedHere)}</span>}
              </div>
            </div>
            <button
              onClick={() => isCompleted ? unmarkComplete(params.lessonId) : markComplete(params.lessonId)}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all"
              style={{
                background: isCompleted ? "var(--kin-tt-nen-xong)" : "var(--kin-nen-bang)",
                border: `1px solid ${isCompleted ? "var(--kin-tt-vien-xong)" : "var(--kin-vien-thuong)"}`,
                color: isCompleted ? "var(--kin-tt-chu-xong)" : "var(--kin-chu-mo)",
              }}>
              <CheckCircle size={14} />
              {isCompleted ? "Đã hoàn thành ✓" : "Đánh dấu xong"}
            </button>
          </div>

          {/* DG (14/11/2026, chủ: "trang bài một cột"): bỏ dải tab Tài liệu · Bài tập · Ghi chú — xếp dọc dưới video theo đúng thứ tự học: xem → đọc tài liệu → làm bài
              → ghi chú. Mỗi khối có tiêu đề chữ; nội dung từng khối giữ nguyên thành phần cũ (DocumentRows, TabBaiTap, StampedNotes). */}
          <section aria-labelledby="bai-tai-lieu" data-lesson-section="tai-lieu" className="rounded-xl p-4 space-y-3" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}>
            {sectionHead("bai-tai-lieu", <FileDownload size={14} />, "Tài liệu")}
            <DocumentRows materials={lesson.materials} />
          </section>
          <section aria-labelledby="bai-bai-tap" id="bai-tap" data-lesson-section="bai-tap" className="rounded-xl p-4 space-y-3 scroll-mt-4" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}
            ref={el => { if (el && wantBaiTap && params.lessonId === firstLessonId) { setWantBaiTap(false); requestAnimationFrame(() => el.scrollIntoView({ block: "start" })); } }}>
            {sectionHead("bai-bai-tap", <Edit size={14} />, "Bài tập")}
            <TabBaiTap lessonId={params.lessonId} azotaUrl={lesson.type === "quiz" ? undefined : lesson.azotaUrl ?? undefined} azotaAbove={lesson.type === "quiz" && !!lesson.azotaUrl} deadline={lesson.azotaDeadline} nopCode={params.lessonId === firstLessonId ? nopCode : null} />
          </section>
          <section aria-labelledby="bai-ghi-chu" data-lesson-section="ghi-chu" className="rounded-xl p-4 space-y-3" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}>
            {sectionHead("bai-ghi-chu", <StickyNote size={14} />, "Ghi chú")}
            <StampedNotes lessonId={params.lessonId} adminNote={dbLesson.adminNote} control={player} />
          </section>

          {/* Prev / Next — chỉ 1 dòng phân cách mảnh, không phải 2 ô riêng */}
          <div className="flex items-stretch gap-4 pt-4 pb-6" style={{ borderTop: "1px solid var(--kin-vien-thuong)" }}>
            {prevLesson ? (
              <Link href={`/student/bai-giang/${prevLesson.id}`} className="flex-1 min-w-0 group">
                <p className="text-xs mb-1 flex items-center gap-1" style={{ color: "var(--kin-chu-mo)" }}>
                  <ArrowLeft size={12} /> Bài trước
                </p>
                <p className="text-sm font-semibold truncate group-hover:underline" style={{ color: "var(--kin-chu-chinh)" }}>{prevLesson.title}</p>
              </Link>
            ) : <div className="flex-1" />}
            <div className="w-px" style={{ background: "var(--kin-vien-thuong)" }} />
            {nextLesson ? (
              <Link href={`/student/bai-giang/${nextLesson.id}`} className="flex-1 min-w-0 text-right group">
                <p className="text-xs mb-1 flex items-center gap-1 justify-end" style={{ color: "var(--kin-chu-mo)" }}>
                  Bài tiếp <ArrowRight size={12} />
                </p>
                <p className="text-sm font-semibold truncate group-hover:underline" style={{ color: "var(--kin-chu-chinh)" }}>{nextLesson.title}</p>
              </Link>
            ) : <div className="flex-1" />}
          </div>
        </div>
      </div>

      {/* Mobile outline toggle */}
      <div className="xl:hidden fixed bottom-20 right-4 z-40">
        <button onClick={() => setOutlineOpen(v => !v)} aria-label="Danh sách bài học" aria-expanded={outlineOpen}
          className="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg"
          style={{ background: "var(--kin-nhan-nen)" }}>
          <StickyNote size={22} />
        </button>
      </div>

      {outlineOpen && (
        <div className="xl:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOutlineOpen(false)} />
          <div className="relative rounded-t-3xl p-4 max-h-[75vh] flex flex-col"
            style={{ background: "var(--kin-nen-trang)", borderTop: "1px solid var(--kin-vien-thuong)" }}>
            <div className="flex items-center justify-between mb-1">
              <p className="font-extrabold" style={{ color: "var(--kin-chu-chinh)" }}>Nội dung khóa học</p>
              <button onClick={() => setOutlineOpen(false)} className="min-h-11 min-w-11 px-2 text-sm font-semibold" style={{ color: "var(--kin-chu-mo)" }}>✕ Đóng</button>
            </div>
            <div className="overflow-y-auto flex-1">
              <LeftCourseSidebar
                sections={sections} currentId={lesson.id}
                onSelect={(l) => { handleSelectLesson(l); setOutlineOpen(false); }}
                completedIds={completedIds}
                watching={watching}
                courseId={dbCourse.id} courseName={dbCourse.name}
                isOpen={true} onToggle={() => setOutlineOpen(false)}
                mobile
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
