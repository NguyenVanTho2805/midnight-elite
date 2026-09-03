"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { TEACHERS } from "@/lib/teacherData";
import { COURSES } from "@/lib/courseData";
import { Trophy } from "@phosphor-icons/react";

interface TopStudent {
  userId: string; name: string; school: string | null; best: number;
}

function TeacherCard({ teacher }: { teacher: typeof TEACHERS[0] }) {
  const courses = teacher.courses.map(id => COURSES.find(c => c.id === id)).filter(Boolean);

  return (
    <div className="rounded-xl overflow-hidden flex flex-col" style={{ background: "var(--canvas)", border: "1px solid var(--hairline)" }}>
      {/* Header band */}
      <div className="px-6 py-5 flex items-center gap-4"
        style={{ background: "linear-gradient(135deg,#3a2a99 0%,#5645d4 60%,#38BDF8 100%)" }}>
        <div className="w-16 h-16 rounded-xl flex items-center justify-center text-2xl font-black text-white flex-shrink-0"
          style={{ background: "rgba(255,255,255,0.2)", border: "2px solid rgba(255,255,255,0.4)" }}>
          {teacher.avatar}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-white leading-tight">{teacher.name}</h3>
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.75)" }}>{teacher.title}</p>
        </div>
      </div>

      <div className="p-5 flex flex-col flex-1 gap-4">
        {/* Bio */}
        <p className="text-sm leading-relaxed" style={{ color: "var(--slate)" }}>{teacher.bio}</p>

        {/* Specialties */}
        <div className="flex flex-wrap gap-1.5">
          {teacher.specialties.map(s => (
            <span key={s} className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: "var(--tint-lavender)", color: "#5645d4" }}>
              {s}
            </span>
          ))}
        </div>

        {/* Courses */}
        {courses.length > 0 && (
          <div>
            <p className="text-xs font-semibold mb-2" style={{ color: "var(--stone)" }}>KHÓA HỌC PHỤ TRÁCH</p>
            <div className="space-y-1.5">
              {courses.map(c => c && (
                <Link key={c.id} href={`/khoa-hoc/${c.id}`}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors hover:bg-[var(--surface)]"
                  style={{ border: "1px solid var(--hairline)", color: "#5645d4" }}>
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#5645d4" }} />
                  {c.name}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Contact */}
        {teacher.socials?.zalo && (
          <a href={`https://zalo.me/${teacher.socials.zalo}`} target="_blank" rel="noopener noreferrer"
            className="mt-auto flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-semibold"
            style={{ background: "var(--surface)", border: "1px solid var(--hairline)", color: "#5645d4" }}>
            Nhắn Zalo để hỏi bài
          </a>
        )}
      </div>
    </div>
  );
}

function TopStudentsSection() {
  const [students, setStudents] = useState<TopStudent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/leaderboard")
      .then(r => r.ok ? r.json() : [])
      .then((data: TopStudent[]) => setStudents(data.slice(0, 10)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const MEDALS = ["🥇", "🥈", "🥉"];

  return (
    <section className="px-4 sm:px-6 lg:px-8 py-16 max-w-7xl mx-auto">
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-bold tracking-tight mb-2" style={{ color: "var(--ink)", letterSpacing: "-0.5px" }}>
          Top học viên nổi bật
        </h2>
        <p className="text-sm" style={{ color: "var(--steel)" }}>Xếp hạng dựa trên điểm thi thử cao nhất</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12 gap-1.5">
          {[0,1,2].map(i => (
            <div key={i} className="w-2 h-2 rounded-full animate-bounce" style={{ background: "#5645d4", animationDelay: `${i*0.15}s` }} />
          ))}
        </div>
      ) : students.length === 0 ? (
        <p className="text-center text-sm py-12" style={{ color: "var(--stone)" }}>Chưa có dữ liệu</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-4xl mx-auto">
          {students.map((s, i) => (
            <div key={s.userId}
              className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{
                background: i === 0 ? "linear-gradient(135deg,#b45309,#92400e)" : "var(--canvas)",
                border: i === 0 ? "none" : "1px solid var(--hairline)",
              }}>
              <div className="w-8 text-center flex-shrink-0">
                {i < 3
                  ? <span className="text-xl">{MEDALS[i]}</span>
                  : <span className="text-sm font-bold" style={{ color: i === 0 ? "#fbbf24" : "var(--stone)" }}>#{i + 1}</span>}
              </div>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                style={{
                  background: i === 0 ? "rgba(255,255,255,0.2)" : "linear-gradient(135deg,#4534b3,#5645d4)",
                  border: i === 0 ? "1px solid rgba(255,255,255,0.3)" : "none",
                }}>
                {s.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate" style={{ color: i === 0 ? "#fff" : "var(--ink)" }}>{s.name}</p>
                {s.school && <p className="text-xs truncate" style={{ color: i === 0 ? "rgba(255,255,255,0.7)" : "var(--stone)" }}>{s.school}</p>}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Trophy size={14} style={{ color: i === 0 ? "#fbbf24" : "#FE9900" }} />
                <span className="text-sm font-extrabold" style={{ color: i === 0 ? "#fbbf24" : "#FE9900" }}>{s.best}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="text-center mt-8">
        <Link href="/bang-xep-hang"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold"
          style={{ background: "var(--surface)", border: "1px solid var(--hairline)", color: "#5645d4" }}>
          Xem bảng xếp hạng đầy đủ →
        </Link>
      </div>
    </section>
  );
}

export default function GiangVienPage() {
  return (
    <div>
      {/* Hero */}
        <section style={{ background: "var(--brand-navy)" }}>
          <div className="max-w-7xl mx-auto px-6 py-14 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest mb-3"
              style={{ color: "rgba(255,255,255,0.45)" }}>Đội ngũ gia sư</p>
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3" style={{ letterSpacing: "-0.03em" }}>
              Học từ người thật,<br />
              <span style={{ color: "#93C5FD" }}>kết quả thật</span>
            </h1>
            <p className="text-sm max-w-lg mx-auto" style={{ color: "rgba(255,255,255,0.6)" }}>
              Đội ngũ gia sư Midnight Elite — những người đang dạy live mỗi tối và theo sát từng học sinh.
            </p>
          </div>
        </section>

        {/* Teacher cards */}
        <section className="px-4 sm:px-6 lg:px-8 py-16 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {TEACHERS.map(t => <TeacherCard key={t.slug} teacher={t} />)}
          </div>
        </section>

        <div style={{ background: "var(--surface)", borderTop: "1px solid var(--hairline)", borderBottom: "1px solid var(--hairline)" }}>
          <TopStudentsSection />
        </div>

        {/* CTA */}
        <section className="px-4 sm:px-6 lg:px-8 py-16 max-w-2xl mx-auto text-center">
          <h2 className="text-xl font-bold mb-3" style={{ color: "var(--ink)" }}>Bắt đầu học với gia sư ngay hôm nay</h2>
          <p className="text-sm mb-6" style={{ color: "var(--steel)" }}>Gọi tư vấn miễn phí để được ghép lớp phù hợp với lộ trình của bạn</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/khoa-hoc"
              className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white text-center transition-all hover:brightness-105 active:scale-[0.98]"
              style={{ background: "#5645d4" }}>
              Xem khóa học
            </Link>
            <a href="tel:0384409051"
              className="px-6 py-2.5 rounded-xl text-sm font-semibold text-center transition-all hover:brightness-105 active:scale-[0.98]"
              style={{ background: "var(--canvas)", border: "1px solid var(--hairline)", color: "var(--charcoal)" }}>
              Gọi 0384 409 051
            </a>
          </div>
        </section>
    </div>
  );
}
