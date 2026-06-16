"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { COURSE_CATEGORIES, CATEGORY_GRADIENT } from "@/lib/courseData";
import { useExams } from "@/hooks/useExams";
import type { ExamStatus } from "@/lib/examData";

interface MyResult {
  examId: string; score: number; totalPoints: number; rank: number;
}

const CATEGORIES = COURSE_CATEGORIES;

const STATUS_CFG: Record<ExamStatus, { label: string; color: string; bg: string }> = {
  upcoming:  { label: "Sắp diễn ra", color: "#0068FF", bg: "#dbeafe" },
  available: { label: "Có thể thi",  color: "#16a34a", bg: "#dcfce7" },
  completed: { label: "Đã kết thúc", color: "#787671", bg: "#f6f5f4" },
};

const CAT_GRAD = CATEGORY_GRADIENT;

export default function ThiThuPage() {
  const [cat, setCat] = useState("Tất cả");
  const { data: apiExams, loading } = useExams({ active: "true" });
  const [myResults, setMyResults] = useState<Record<string, MyResult>>({});

  useEffect(() => {
    fetch("/api/exam-results?mine=true")
      .then(r => r.ok ? r.json() : [])
      .then((data: Array<MyResult & { examId: string }>) => {
        const map: Record<string, MyResult> = {};
        data.forEach(r => { map[r.examId] = r; });
        setMyResults(map);
      }).catch(() => {});
  }, []);

  const exams = apiExams.map(e => ({ ...e, status: e.status as ExamStatus, myResult: myResults[e.id] }));
  const filtered = cat === "Tất cả" ? exams : exams.filter(e => e.category === cat);
  const done      = Object.keys(myResults).length;
  const available = exams.filter(e => e.status === "available" && !myResults[e.id]).length;
  const upcoming  = exams.filter(e => e.status === "upcoming").length;

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 rounded-xl" style={{ background: "#e5e3df" }} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
        {CATEGORIES.map(c => (
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
          const grad    = CAT_GRAD[exam.category] ?? "linear-gradient(135deg,#374151,#1E2938)";
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
                    style={{ background: "#16a34a", borderRadius: "8px" }}>
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

      {/* Info note */}
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
