"use client";

import { Fragment, useState, useEffect } from "react";
import Link from "next/link";
import { COURSE_CATEGORIES, CATEGORY_GRADIENT } from "@/lib/courseData";
import { useExams } from "@/hooks/useExams";
import { useAuth } from "@/contexts/AuthContext";
import { useEnrollments } from "@/hooks/useEnrollments";
import { computeExamStatus, type ExamStatus } from "@/lib/examData";
import { groupExamsByMonth } from "@/lib/examList";
import { KinPage, KinPageHeader, KinStatus, KinEmptyState, kinButtonClass, KIN_TABLE_HEAD, KIN_TABLE_ROW, KIN_FIELD, type StatusTone } from "@/components/kin";

interface MyResult {
  examId: string; score: number | null; totalPoints: number; rank: number | null;
}

const STATUS_CFG: Record<ExamStatus, { label: string; color: string; bg: string }> = {
  upcoming:  { label: "Sắp diễn ra", color: "var(--kin-nhan-link)", bg: "var(--kin-nhan-nen-nhat)" },
  available: { label: "Đang mở",     color: "var(--kin-tt-chu-xong)", bg: "var(--kin-chu-tren-nut-chinh)" },
  completed: { label: "Đã kết thúc", color: "var(--kin-chu-mo)", bg: "var(--kin-nen-bang)" },
};

type DoneTab = "tat-ca" | "chua-lam" | "da-lam";

/** Bỏ dấu + hoa thường để ô tìm gõ không dấu vẫn ra đề. */
const fold = (t: string) => t.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/g, "d").trim();

/** Nhãn trạng thái của đề CHƯA làm: đang mở thì là "Chưa làm" (việc em cần làm), còn lại theo thời gian của đề. */
function examState(status: ExamStatus, hasDone: boolean): { label: string; tone: StatusTone } {
  if (hasDone) return { label: "Đã làm", tone: "xong" };
  if (status === "available") return { label: "Chưa làm", tone: "cho" };
  if (status === "upcoming") return { label: "Sắp diễn ra", tone: "mo" };
  return { label: "Đã kết thúc", tone: "mo" };
}

export default function ThiThuPage() {
  const { user } = useAuth();
  const [cat, setCat] = useState("Tất cả");
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<DoneTab>("tat-ca");
  const [myResults, setMyResults] = useState<Record<string, MyResult>>({});
  const { enrolledIds } = useEnrollments();

  const { data: apiExams, loading: examsLoading } = useExams(
    user ? { active: "true" } : { activeGuest: "true" }
  );

  useEffect(() => {
    if (!user) return;
    fetch("/api/exam-results?mine=true")
      .then(r => r.ok ? r.json() : [])
      .then((data: Array<MyResult & { examId: string }>) => {
        const map: Record<string, MyResult> = {};
        data.forEach(r => { map[r.examId] = r; });
        setMyResults(map);
      }).catch(() => {});
  }, [user]);

  // Tính status theo thời gian thực thay vì tin field Exam.status lưu tĩnh
  // trong DB — field đó chỉ được ghi lúc tạo/sửa đề rồi đứng yên, khiến đề đã
  // đến giờ thi vẫn hiện "Sắp diễn ra" và khoá nhầm nút vào thi.
  const exams = apiExams.map(e => ({ ...e, status: computeExamStatus(e.date, e.time, e.active), myResult: myResults[e.id] }));
  const filtered = cat === "Tất cả" ? exams : exams.filter(e => e.category === cat);

  if (examsLoading) {
    return (
      <div className="min-h-screen" style={{ background: "var(--kin-nen-bang)" }}>
        <div className="max-w-4xl mx-auto px-4 py-10 space-y-4 animate-pulse">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 rounded-xl" style={{ background: "var(--kin-vien-thuong)" }} />
          ))}
        </div>
      </div>
    );
  }

  /* ── Logged-in view (Figma "Học sinh · Thi thử" 575:5571: ô tìm + Tất cả / Chưa làm / Đã làm + bảng Đề · Môn · Thời gian · Số câu · Trạng thái) ───────────── */
  if (user) {
    const needle = fold(q);
    const shown = filtered.filter(e => {
      const done = !!e.myResult;
      if (tab === "chua-lam" && done) return false;
      if (tab === "da-lam" && !done) return false;
      return !needle || fold(`${e.title} ${e.code}`).includes(needle);
    });
    const TABS: { key: DoneTab; label: string }[] = [{ key: "tat-ca", label: "Tất cả" }, { key: "chua-lam", label: "Chưa làm" }, { key: "da-lam", label: "Đã làm" }];
    const COLS = "md:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.6fr)_minmax(0,1.5fr)_minmax(0,1.1fr)]";

    return (
      <KinPage>
        <KinPageHeader title="Thi thử" sub="Đề luyện thi từ thư viện và từ lớp của em." />

        <div className="grid gap-4 sm:grid-cols-[minmax(0,440px)_minmax(0,200px)_auto] sm:items-end">
          <label className="block min-w-0">
            <span className="sr-only">Tìm đề thi</span>
            <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm đề thi" className={KIN_FIELD} />
          </label>
          {/* Kỳ thi (nhóm đề: ĐGNL HSA, Tốt nghiệp THPT…) là một ô chọn, không phải hàng nút thứ hai: hàng nút ấy cũng có "Tất cả" nên dễ nhầm với bộ lọc trạng thái bên cạnh. */}
          <label className="block min-w-0">
            <span className="sr-only">Kỳ thi</span>
            <select value={cat} onChange={e => setCat(e.target.value)} className={KIN_FIELD}>
              {COURSE_CATEGORIES.map(c => <option key={c} value={c}>{c === "Tất cả" ? "Tất cả kỳ thi" : c}</option>)}
            </select>
          </label>
          <div role="group" aria-label="Lọc theo trạng thái làm bài" className="flex flex-wrap items-center gap-1">
            {TABS.map(t => (
              <button key={t.key} type="button" aria-pressed={tab === t.key} onClick={() => setTab(t.key)}
                className={`min-h-11 px-4 rounded-[var(--kin-bo-md)] border text-[length:var(--kin-co-goc)] transition-colors ${tab === t.key
                  ? "border-[var(--kin-vien-o-nhap)] text-[var(--kin-chu-chinh)]"
                  : "border-transparent text-[var(--kin-chu-mo)] hover:text-[var(--kin-chu-chinh)]"}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 rounded-[var(--kin-bo-the)] border border-[var(--kin-vien-thuong)] overflow-hidden">
          <div aria-hidden className={`hidden md:grid ${COLS} gap-x-4 ${KIN_TABLE_HEAD}`}>
            <span>Đề</span><span>Kỳ thi</span><span>Thời gian</span><span>Số câu</span><span>Trạng thái</span><span />
          </div>
          {shown.length === 0 ? (
            <div className="p-6">
              <KinEmptyState title={needle || tab !== "tat-ca" || cat !== "Tất cả" ? "Không có đề thi nào khớp" : "Chưa có đề thi nào"}>
                {needle || tab !== "tat-ca" || cat !== "Tất cả" ? "Thử đổi từ khoá, trạng thái hoặc kỳ thi." : "Khi có đề thi mới, đề sẽ hiện ở đây."}
              </KinEmptyState>
            </div>
          ) : (
            // NC2-040: xếp theo ngày thi (mới nhất trước) và gom theo THÁNG, mỗi tháng một tiêu đề luôn mở (góp ý 28/10: trước đây dàn một loạt, không theo thời gian, em không biết bắt đầu từ đâu).
            <div>
              {groupExamsByMonth(shown).map(month => (
              <section key={month.key} data-exam-month={month.key} aria-label={month.label}>
              <h2 className="px-[var(--kin-kc-6)] min-h-11 flex items-center gap-2 bg-[var(--kin-nen-nhan)] border-b border-[var(--kin-vien-nhat)] text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">
                <span className="font-medium">{month.label}</span><span className="text-[var(--kin-chu-mo)]">· {month.items.length} đề</span>
              </h2>
              <ul>
              {month.items.map(exam => {
                const result  = exam.myResult;
                const hasDone = !!result;
                // Đề gắn courseId mà học viên chưa ghi danh — vẫn hiện trong danh sách (không ẩn hẳn) nhưng khoá nút vào thi, ghi rõ lý do
                // thay vì để học viên bấm vào rồi mới biết bị chặn ở bước sau.
                const isLocked = !!exam.courseId && !enrolledIds.has(exam.courseId);
                const state = examState(exam.status, hasDone);
                return (
                  <li key={exam.id} data-exam-row className={`grid ${COLS} gap-x-4 gap-y-1 ${KIN_TABLE_ROW} last:border-b-0`}>
                    <div className="min-w-0">
                      <p className="text-[var(--kin-chu-chinh)]">{exam.title}</p>
                      <p className="text-[var(--kin-chu-mo)]">{exam.date} · {exam.time}{exam.participants > 0 ? ` · ${exam.participants} thí sinh` : ""}</p>
                    </div>
                    <span className="text-[var(--kin-chu-chinh)]"><span className="md:hidden text-[var(--kin-chu-mo)]">Kỳ thi: </span>{exam.category}</span>
                    <span className="text-[var(--kin-chu-chinh)]"><span className="md:hidden text-[var(--kin-chu-mo)]">Thời gian: </span>{exam.duration}</span>
                    <span className="text-[var(--kin-chu-chinh)]"><span className="md:hidden text-[var(--kin-chu-mo)]">Số câu: </span>{exam.questions}</span>
                    <div className="min-w-0">
                      <KinStatus tone={hasDone ? (result.score === null ? "cho" : "xong") : state.tone}>
                        {hasDone ? (result.score === null ? "Chờ gia sư chấm" : `Đã làm · ${result.score}/${result.totalPoints}`) : state.label}
                      </KinStatus>
                      {hasDone && result.rank !== null && result.rank > 0 && <p className="text-[var(--kin-chu-mo)]">Hạng #{result.rank}</p>}
                    </div>
                    <div className="md:text-right">
                      {hasDone ? (
                        <Link href={`/student/thi-thu/${exam.id}`} className="inline-flex items-center min-h-11 px-2 text-[var(--kin-chu-mo)] hover:text-[var(--kin-chu-chinh)] underline">Xem lại</Link>
                      ) : isLocked ? (
                        <span className="text-[var(--kin-chu-mo)]">Thuộc khóa {exam.courseName ?? "khác"} — chưa ghi danh</span>
                      ) : exam.status === "upcoming" ? (
                        <span className="text-[var(--kin-chu-mo)]">Chờ mở</span>
                      ) : exam.status === "available" ? (
                        <Link href={`/student/thi-thu/${exam.id}`} className={kinButtonClass("primary")}>Làm bài</Link>
                      ) : (
                        <span className="text-[var(--kin-chu-mo)]">Đã kết thúc</span>
                      )}
                    </div>
                  </li>
                );
              })}
              </ul>
              </section>
              ))}
            </div>
          )}
        </div>

        <p className="mt-4 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Điểm hiện sau khi gia sư công bố. Bài tự luận chờ gia sư chấm.</p>
        <p className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">
          Kết quả thi thử được ghi nhận và tính vào Bảng xếp hạng vinh danh hàng tháng. Làm bài nghiêm túc để có điểm số chính xác nhất.
        </p>
      </KinPage>
    );
  }

  /* ── Guest view ─────────────────────────────────────────────────────── */
  const guestRows = groupExamsByMonth(filtered).flatMap(m => m.items.map((exam, i) => ({ exam, head: i === 0 ? m : null })));
  const available = exams.filter(e => e.status === "available").length;
  const upcoming  = exams.filter(e => e.status === "upcoming").length;

  return (
    <div className="min-h-screen" style={{ background: "var(--kin-nen-bang)" }}>
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-8">

        <div className="text-center space-y-3">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold"
            style={{ background: "var(--kin-nhan-nen-nhat)", color: "var(--kin-nhan-link)", border: "1px solid var(--kin-nhan-vien)" }}>
            Thi thử KiN
          </span>
          <h1 className="text-3xl font-bold" style={{ color: "var(--kin-chu-chinh)", letterSpacing: "-0.5px" }}>
            Đề thi thử miễn phí
          </h1>
          <p className="text-sm max-w-lg mx-auto" style={{ color: "var(--kin-chu-mo)" }}>
            Luyện tập với đề thi thử sát đề thật, được cập nhật liên tục.
            Đăng ký để lưu kết quả và theo dõi tiến độ.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto">
          {[
            { label: "Đề đang mở",  val: available, color: "var(--kin-tt-chu-xong)", bg: "var(--kin-chu-tren-nut-chinh)", border: "var(--kin-tt-vien-xong)" },
            { label: "Sắp diễn ra", val: upcoming,  color: "var(--kin-nhan-link)", bg: "var(--kin-nhan-nen-nhat)", border: "var(--kin-nhan-vien)" },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-4 text-center"
              style={{ background: s.bg, border: `1px solid ${s.border}` }}>
              <div className="text-2xl font-bold" style={{ color: s.color }}>{s.val}</div>
              <div className="text-xs font-medium mt-0.5" style={{ color: s.color }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div className="notion-hero-band rounded-xl p-5 flex flex-col sm:flex-row items-center gap-4">
          <div className="flex-1 text-center sm:text-left">
            <p className="text-white font-bold text-base">Đăng ký miễn phí để thi và lưu kết quả</p>
            <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.65)" }}>Xem điểm số · Xếp hạng cá nhân · Theo dõi tiến độ · Thi lại không giới hạn</p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Link href="/dang-ky"
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: "8px" }}>
              Đăng ký miễn phí
            </Link>
            <Link href="/dang-nhap"
              className="px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ background: "var(--kin-nen-trang)", color: "var(--kin-nhan-link)", borderRadius: "8px" }}>
              Đăng nhập
            </Link>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {COURSE_CATEGORIES.map(c => (
            <button key={c} onClick={() => setCat(c)}
              className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
              style={cat === c
                ? { background: "var(--kin-nhan-nen)", color: "white", borderRadius: "8px" }
                : { background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)", color: "var(--kin-chu-mo)", borderRadius: "8px" }}>
              {c}
            </button>
          ))}
        </div>

        <div className="rounded-xl overflow-hidden" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}>
          {/* NC2-040: khách cũng thấy đề theo ngày thi, gom theo tháng (cùng luật với bản học sinh). */}
          {guestRows.map(({ exam, head }, idx) => {
            const s = STATUS_CFG[exam.status];
            const grad = CATEGORY_GRADIENT[exam.category] ?? "var(--kin-chu-phu)";
            const isLast = idx === guestRows.length - 1;
            return (
              <Fragment key={exam.id}>
              {head && (
                <h2 data-exam-month={head.key} className="px-5 py-2 text-sm"
                  style={{ background: "var(--kin-nen-nhan)", borderBottom: "1px solid var(--kin-vien-thuong)", color: "var(--kin-chu-chinh)" }}>
                  <span className="font-semibold">{head.label}</span><span style={{ color: "var(--kin-chu-mo)" }}> · {head.items.length} đề</span>
                </h2>
              )}
              <div className="flex items-center gap-4 px-5 py-4"
                style={{ borderBottom: isLast ? "none" : "1px solid var(--kin-vien-thuong)" }}>
                <div className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-bold text-white"
                  style={{ background: grad }}>
                  {exam.code.split(".")[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold leading-snug" style={{ color: "var(--kin-chu-chinh)" }}>{exam.title}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{ background: s.bg, color: s.color }}>{s.label}</span>
                    <span className="text-xs" style={{ color: "var(--kin-chu-mo)" }}>{exam.date} · {exam.time}</span>
                    <span className="text-xs" style={{ color: "var(--kin-chu-mo)" }}>{exam.duration} · {exam.questions} câu</span>
                    {exam.participants > 0 && (
                      <span className="text-xs" style={{ color: "var(--kin-chu-mo)" }}>{exam.participants.toLocaleString("vi-VN")} thí sinh</span>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0">
                  {exam.status === "upcoming" && (
                    <span className="text-xs font-medium px-3 py-1.5 rounded-md"
                      style={{ background: "var(--kin-nhan-nen-nhat)", color: "var(--kin-nhan-link)" }}>Chờ mở</span>
                  )}
                  {exam.status === "completed" && (
                    <span className="text-xs font-medium px-3 py-1.5 rounded-md"
                      style={{ background: "var(--kin-nen-bang)", color: "var(--kin-chu-mo)", border: "1px solid var(--kin-vien-thuong)" }}>Đã kết thúc</span>
                  )}
                  {exam.status === "available" && (
                    <Link href={`/dang-nhap?redirect=${encodeURIComponent(`/student/thi-thu/${exam.id}`)}`}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg text-white"
                      style={{ background: "var(--kin-nhan-nen)" }}>
                      Đăng nhập để thi
                    </Link>
                  )}
                </div>
              </div>
              </Fragment>
            );
          })}
          {filtered.length === 0 && (
            <div className="py-16 text-center text-sm" style={{ color: "var(--kin-chu-mo)" }}>
              Không có đề thi nào trong danh mục này
            </div>
          )}
        </div>

        <div className="rounded-xl overflow-hidden" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}>
          <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--kin-vien-thuong)" }}>
            <p className="text-sm font-semibold" style={{ color: "var(--kin-chu-chinh)" }}>So sánh quyền truy cập</p>
          </div>
          <div>
            {[
              { feature: "Xem danh sách đề thi",    guest: true,  student: true  },
              { feature: "Tham gia thi thử",         guest: false, student: true  },
              { feature: "Xem điểm số & kết quả",   guest: false, student: true  },
              { feature: "Xếp hạng cá nhân",         guest: false, student: true  },
              { feature: "Lịch sử thi thử",          guest: false, student: true  },
              { feature: "Thi lại không giới hạn",   guest: false, student: true  },
              { feature: "Bảng vinh danh",            guest: true,  student: true  },
            ].map((r, i, arr) => (
              <div key={r.feature} className="flex items-center px-5 py-3 gap-4"
                style={{ borderBottom: i < arr.length - 1 ? "1px solid var(--kin-vien-thuong)" : "none" }}>
                <p className="flex-1 text-sm" style={{ color: "var(--kin-chu-phu)" }}>{r.feature}</p>
                <div className="flex gap-8">
                  <span className="text-sm w-16 text-center font-semibold"
                    style={{ color: r.guest ? "var(--kin-tt-chu-xong)" : "var(--kin-vien-o-nhap)" }}>{r.guest ? "✓" : "×"}</span>
                  <span className="text-sm w-16 text-center font-semibold"
                    style={{ color: r.student ? "var(--kin-tt-chu-xong)" : "var(--kin-vien-o-nhap)" }}>{r.student ? "✓" : "×"}</span>
                </div>
              </div>
            ))}
            <div className="flex items-center px-5 py-3 gap-4" style={{ background: "var(--kin-nen-bang)", borderTop: "1px solid var(--kin-vien-thuong)" }}>
              <p className="flex-1 text-xs" />
              <div className="flex gap-8">
                <p className="text-xs font-semibold w-16 text-center" style={{ color: "var(--kin-chu-mo)" }}>Khách</p>
                <p className="text-xs font-semibold w-16 text-center" style={{ color: "var(--kin-nhan-link)" }}>Học viên</p>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center space-y-3 py-4">
          <p className="text-sm" style={{ color: "var(--kin-chu-mo)" }}>
            Tham gia cùng hàng nghìn học viên đang luyện thi tại KiN
          </p>
          <div className="flex gap-3 justify-center">
            <Link href="/dang-ky"
              className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white"
              style={{ background: "var(--kin-nhan-nen)", borderRadius: "8px" }}>
              Đăng ký miễn phí
            </Link>
            <Link href="/khoa-hoc"
              className="px-5 py-2.5 rounded-lg text-sm font-medium"
              style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)", color: "var(--kin-chu-mo)", borderRadius: "8px" }}>
              Xem khóa học
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
