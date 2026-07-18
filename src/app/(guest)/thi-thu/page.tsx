"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { COURSE_CATEGORIES, CATEGORY_GRADIENT } from "@/lib/courseData";
import { useExams } from "@/hooks/useExams";
import { useAuth } from "@/contexts/AuthContext";
import { computeExamStatus, type ExamStatus } from "@/lib/examData";

interface MyResult {
  examId: string; score: number; totalPoints: number; rank: number;
}

const STATUS_CFG: Record<ExamStatus, { label: string; color: string; bg: string }> = {
  upcoming:  { label: "Sắp diễn ra", color: "#0068FF", bg: "#dbeafe" },
  available: { label: "Đang mở",     color: "#16a34a", bg: "#dcfce7" },
  completed: { label: "Đã kết thúc", color: "#787671", bg: "#f6f5f4" },
};

export default function ThiThuPage() {
  const { user } = useAuth();
  const [cat, setCat] = useState("Tất cả");
  const [myResults, setMyResults] = useState<Record<string, MyResult>>({});

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
      <div className="min-h-screen" style={{ background: "#f6f5f4" }}>
        <div className="max-w-4xl mx-auto px-4 py-10 space-y-4 animate-pulse">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 rounded-xl" style={{ background: "#e5e3df" }} />
          ))}
        </div>
      </div>
    );
  }

  /* ── Logged-in view ─────────────────────────────────────────────────── */
  if (user) {
    const done      = Object.keys(myResults).length;
    const available = exams.filter(e => e.status === "available" && !myResults[e.id]).length;
    const upcoming  = exams.filter(e => e.status === "upcoming").length;

    return (
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#1a1a1a", letterSpacing: "-0.3px" }}>Thi thử</h1>
          <p className="text-sm mt-0.5" style={{ color: "#787671" }}>Luyện tập với đề thi thử được cập nhật liên tục</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Đã làm",      val: done,      color: "#787671", bg: "#f6f5f4", border: "#e5e3df" },
            { label: "Có thể thi",  val: available, color: "#16a34a", bg: "#dcfce7", border: "#86efac" },
            { label: "Sắp diễn ra", val: upcoming,  color: "#0068FF", bg: "#dbeafe", border: "#93c5fd" },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-4 text-center"
              style={{ background: s.bg, border: `1px solid ${s.border}` }}>
              <div className="text-2xl font-bold" style={{ color: s.color }}>{s.val}</div>
              <div className="text-xs font-medium mt-0.5" style={{ color: s.color }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Category filter */}
        <div className="flex gap-2 flex-wrap">
          {COURSE_CATEGORIES.map(c => (
            <button key={c} onClick={() => setCat(c)}
              className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
              style={cat === c
                ? { background: "#0068FF", color: "white", borderRadius: "8px" }
                : { background: "#ffffff", border: "1px solid #e5e3df", color: "#787671", borderRadius: "8px" }}>
              {c}
            </button>
          ))}
        </div>

        {/* Exam list */}
        <div className="rounded-xl overflow-hidden" style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
          {filtered.map((exam, idx) => {
            const result  = exam.myResult;
            const hasDone = !!result;
            const s       = STATUS_CFG[hasDone ? "completed" : exam.status];
            const grad    = CATEGORY_GRADIENT[exam.category] ?? "linear-gradient(135deg,#374151,#1E2938)";
            const isLast  = idx === filtered.length - 1;
            return (
              <div key={exam.id} className="flex items-center gap-4 px-5 py-4"
                style={{ borderBottom: isLast ? "none" : "1px solid #e5e3df" }}>
                <div className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-bold text-white"
                  style={{ background: grad }}>
                  {exam.code.split(".")[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold leading-snug" style={{ color: "#1a1a1a" }}>{exam.title}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{ background: s.bg, color: s.color }}>
                      {hasDone ? "Đã làm" : s.label}
                    </span>
                    <span className="text-xs" style={{ color: "#a4a097" }}>{exam.date} · {exam.time}</span>
                    <span className="text-xs" style={{ color: "#a4a097" }}>{exam.duration} · {exam.questions} câu</span>
                    {exam.participants > 0 && (
                      <span className="text-xs" style={{ color: "#a4a097" }}>{exam.participants} thí sinh</span>
                    )}
                  </div>
                  {hasDone && (
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-sm font-bold" style={{ color: "#0068FF" }}>
                        {result.score}/{result.totalPoints}
                      </span>
                      {result.rank > 0 && (
                        <span className="text-xs" style={{ color: "#a4a097" }}>Hạng #{result.rank}</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex-shrink-0">
                  {hasDone ? (
                    <Link href={`/student/thi-thu/${exam.id}`}
                      className="text-xs font-medium px-3 py-1.5 rounded-md"
                      style={{ background: "#f6f5f4", border: "1px solid #e5e3df", color: "#787671" }}>
                      Xem lại
                    </Link>
                  ) : exam.status === "upcoming" ? (
                    <span className="text-xs font-medium px-3 py-1.5 rounded-md"
                      style={{ background: "#dbeafe", color: "#0068FF" }}>Chờ mở</span>
                  ) : exam.status === "available" ? (
                    <Link href={`/student/thi-thu/${exam.id}`}
                      className="text-xs font-semibold px-4 py-2 rounded-lg text-white"
                      style={{ background: "#0068FF" }}>
                      Vào thi
                    </Link>
                  ) : (
                    <span className="text-xs font-medium px-3 py-1.5 rounded-md"
                      style={{ background: "#f6f5f4", color: "#787671", border: "1px solid #e5e3df" }}>Đã kết thúc</span>
                  )}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="py-16 text-center text-sm" style={{ color: "#a4a097" }}>
              Không có đề thi nào trong danh mục này
            </div>
          )}
        </div>

        <div className="rounded-xl px-5 py-4 flex items-start gap-3"
          style={{ background: "#dbeafe", border: "1px solid #bfdbfe" }}>
          <span className="text-blue-600 text-lg flex-shrink-0">ℹ</span>
          <p className="text-sm" style={{ color: "#1D4ED8" }}>
            Kết quả thi thử được ghi nhận và tính vào <strong>Bảng xếp hạng vinh danh</strong> hàng tháng.
            Làm bài nghiêm túc để có điểm số chính xác nhất.
          </p>
        </div>
      </div>
    );
  }

  /* ── Guest view ─────────────────────────────────────────────────────── */
  const available = exams.filter(e => e.status === "available").length;
  const upcoming  = exams.filter(e => e.status === "upcoming").length;

  return (
    <div className="min-h-screen" style={{ background: "#f6f5f4" }}>
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-8">

        <div className="text-center space-y-3">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold"
            style={{ background: "#dbeafe", color: "#0068FF", border: "1px solid #bfdbfe" }}>
            Thi thử Midnight Elite
          </span>
          <h1 className="text-3xl font-bold" style={{ color: "#1a1a1a", letterSpacing: "-0.5px" }}>
            Đề thi thử miễn phí
          </h1>
          <p className="text-sm max-w-lg mx-auto" style={{ color: "#787671" }}>
            Luyện tập với đề thi thử sát đề thật, được cập nhật liên tục.
            Đăng ký để lưu kết quả và theo dõi tiến độ.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto">
          {[
            { label: "Đề đang mở",  val: available, color: "#16a34a", bg: "#dcfce7", border: "#86efac" },
            { label: "Sắp diễn ra", val: upcoming,  color: "#0068FF", bg: "#dbeafe", border: "#93c5fd" },
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
              style={{ background: "#ffffff", color: "#0068FF", borderRadius: "8px" }}>
              Đăng nhập
            </Link>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {COURSE_CATEGORIES.map(c => (
            <button key={c} onClick={() => setCat(c)}
              className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
              style={cat === c
                ? { background: "#0068FF", color: "white", borderRadius: "8px" }
                : { background: "#ffffff", border: "1px solid #e5e3df", color: "#787671", borderRadius: "8px" }}>
              {c}
            </button>
          ))}
        </div>

        <div className="rounded-xl overflow-hidden" style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
          {filtered.map((exam, idx) => {
            const s = STATUS_CFG[exam.status];
            const grad = CATEGORY_GRADIENT[exam.category] ?? "linear-gradient(135deg,#374151,#1E2938)";
            const isLast = idx === filtered.length - 1;
            return (
              <div key={exam.id} className="flex items-center gap-4 px-5 py-4"
                style={{ borderBottom: isLast ? "none" : "1px solid #e5e3df" }}>
                <div className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-bold text-white"
                  style={{ background: grad }}>
                  {exam.code.split(".")[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold leading-snug" style={{ color: "#1a1a1a" }}>{exam.title}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{ background: s.bg, color: s.color }}>{s.label}</span>
                    <span className="text-xs" style={{ color: "#a4a097" }}>{exam.date} · {exam.time}</span>
                    <span className="text-xs" style={{ color: "#a4a097" }}>{exam.duration} · {exam.questions} câu</span>
                    {exam.participants > 0 && (
                      <span className="text-xs" style={{ color: "#a4a097" }}>{exam.participants.toLocaleString("vi-VN")} thí sinh</span>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0">
                  {exam.status === "upcoming" && (
                    <span className="text-xs font-medium px-3 py-1.5 rounded-md"
                      style={{ background: "#dbeafe", color: "#0068FF" }}>Chờ mở</span>
                  )}
                  {exam.status === "completed" && (
                    <span className="text-xs font-medium px-3 py-1.5 rounded-md"
                      style={{ background: "#f6f5f4", color: "#787671", border: "1px solid #e5e3df" }}>Đã kết thúc</span>
                  )}
                  {exam.status === "available" && (
                    <Link href={`/dang-nhap?redirect=${encodeURIComponent(`/student/thi-thu/${exam.id}`)}`}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg text-white"
                      style={{ background: "#0068FF" }}>
                      Đăng nhập để thi
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="py-16 text-center text-sm" style={{ color: "#a4a097" }}>
              Không có đề thi nào trong danh mục này
            </div>
          )}
        </div>

        <div className="rounded-xl overflow-hidden" style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
          <div className="px-5 py-4" style={{ borderBottom: "1px solid #e5e3df" }}>
            <p className="text-sm font-semibold" style={{ color: "#1a1a1a" }}>So sánh quyền truy cập</p>
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
                style={{ borderBottom: i < arr.length - 1 ? "1px solid #e5e3df" : "none" }}>
                <p className="flex-1 text-sm" style={{ color: "#37352f" }}>{r.feature}</p>
                <div className="flex gap-8">
                  <span className="text-sm w-16 text-center font-semibold"
                    style={{ color: r.guest ? "#16a34a" : "#c8c4be" }}>{r.guest ? "✓" : "×"}</span>
                  <span className="text-sm w-16 text-center font-semibold"
                    style={{ color: r.student ? "#16a34a" : "#c8c4be" }}>{r.student ? "✓" : "×"}</span>
                </div>
              </div>
            ))}
            <div className="flex items-center px-5 py-3 gap-4" style={{ background: "#f6f5f4", borderTop: "1px solid #e5e3df" }}>
              <p className="flex-1 text-xs" />
              <div className="flex gap-8">
                <p className="text-xs font-semibold w-16 text-center" style={{ color: "#a4a097" }}>Khách</p>
                <p className="text-xs font-semibold w-16 text-center" style={{ color: "#0068FF" }}>Học viên</p>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center space-y-3 py-4">
          <p className="text-sm" style={{ color: "#787671" }}>
            Tham gia cùng hàng nghìn học viên đang luyện thi tại Midnight Elite
          </p>
          <div className="flex gap-3 justify-center">
            <Link href="/dang-ky"
              className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white"
              style={{ background: "#0068FF", borderRadius: "8px" }}>
              Đăng ký miễn phí
            </Link>
            <Link href="/khoa-hoc"
              className="px-5 py-2.5 rounded-lg text-sm font-medium"
              style={{ background: "#ffffff", border: "1px solid #e5e3df", color: "#787671", borderRadius: "8px" }}>
              Xem khóa học
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
