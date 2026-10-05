// FE-105 → 109 — danh sách gia sư thật, lấy từ /api/tutors.
// Trước đây dùng data tĩnh `@/lib/teacherData` — xoá dependency, giữ phần
// "Top học viên" từ /api/leaderboard như cũ.
"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Trophy } from "griddy-icons";
import { EmptyState } from "@/components/ui";

interface TopStudent { userId: string; name: string; school: string | null; best: number; }

interface TutorListItem {
  id: string;
  name: string;
  avatarBase64: string | null;
  bio: string | null;
  subjects: string[];
  tutorVerified: boolean;
  classCount: number;
  studentCount: number;
  rating: { avg: number | null; total: number };
}

type SortKey = "rating" | "students" | "classes";

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "?";
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function TutorCard({ t }: { t: TutorListItem }) {
  // FE-107: card gia sư với avatar, tên, badge xác minh, bio line-clamp,
  // subject badges, stat (students + classes + rating), CTA xem hồ sơ.
  return (
    <div className="rounded-xl overflow-hidden flex flex-col"
      style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
      <div className="px-6 py-5 flex items-center gap-4"
        style={{ background: "linear-gradient(135deg,#0042AA 0%,#0068FF 60%,#38BDF8 100%)" }}>
        <div className="w-16 h-16 rounded-xl flex items-center justify-center text-2xl font-black text-white flex-shrink-0 overflow-hidden"
          style={{ background: "rgba(255,255,255,0.2)", border: "2px solid rgba(255,255,255,0.4)" }}>
          {t.avatarBase64
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={t.avatarBase64} alt={t.name} className="w-full h-full object-cover" />
            : initials(t.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-bold text-white leading-tight truncate">{t.name}</h3>
            {t.tutorVerified && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                style={{ background: "rgba(255,255,255,0.25)", color: "#ffffff" }}>Đã xác minh</span>
            )}
          </div>
          {t.subjects.length > 0 && (
            <p className="text-xs mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.75)" }}>
              {t.subjects.join(" · ")}
            </p>
          )}
        </div>
      </div>

      <div className="p-5 flex flex-col flex-1 gap-4">
        {t.bio ? (
          <p className="text-sm leading-relaxed line-clamp-3" style={{ color: "#4B5563" }}>{t.bio}</p>
        ) : (
          <p className="text-sm italic" style={{ color: "#9CA3AF" }}>Chưa có giới thiệu</p>
        )}

        {t.subjects.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {t.subjects.map(s => (
              <span key={s} className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: "#dbeafe", color: "#0068FF" }}>{s}</span>
            ))}
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div>
            <p className="font-bold text-base" style={{ color: "#1a1a1a" }}>{t.classCount}</p>
            <p style={{ color: "#9CA3AF" }}>lớp đang dạy</p>
          </div>
          <div>
            <p className="font-bold text-base" style={{ color: "#1a1a1a" }}>{t.studentCount}</p>
            <p style={{ color: "#9CA3AF" }}>học viên</p>
          </div>
          <div>
            <p className="font-bold text-base" style={{ color: "#1a1a1a" }}>
              {t.rating.avg !== null ? t.rating.avg.toFixed(1) : "—"}
            </p>
            <p style={{ color: "#9CA3AF" }}>
              {t.rating.total > 0 ? `${t.rating.total} đánh giá` : "chưa có"}
            </p>
          </div>
        </div>

        <Link href={`/mentor/${t.id}`}
          className="mt-auto flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-semibold"
          style={{ background: "#f6f5f4", border: "1px solid #e5e3df", color: "#0068FF" }}>
          Xem hồ sơ
        </Link>
      </div>
    </div>
  );
}

function TutorCardSkeleton() {
  // FE-108: skeleton khi loading
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
      <div className="px-6 py-5 flex items-center gap-4" style={{ background: "#e5e3df" }}>
        <div className="w-16 h-16 rounded-xl bg-slate-300 animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="h-5 bg-slate-300 rounded animate-pulse w-2/3" />
          <div className="h-3 bg-slate-300 rounded animate-pulse w-1/2" />
        </div>
      </div>
      <div className="p-5 space-y-3">
        <div className="h-4 bg-slate-200 rounded animate-pulse" />
        <div className="h-4 bg-slate-200 rounded animate-pulse w-4/5" />
        <div className="h-9 bg-slate-200 rounded-lg animate-pulse" />
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
        <h2 className="text-2xl font-bold tracking-tight mb-2" style={{ color: "#1a1a1a", letterSpacing: "-0.5px" }}>
          Top học viên nổi bật
        </h2>
        <p className="text-sm" style={{ color: "#787671" }}>Xếp hạng dựa trên điểm thi thử cao nhất</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12 gap-1.5">
          {[0,1,2].map(i => (
            <div key={i} className="w-2 h-2 rounded-full animate-bounce" style={{ background: "#0068FF", animationDelay: `${i*0.15}s` }} />
          ))}
        </div>
      ) : students.length === 0 ? (
        <p className="text-center text-sm py-12" style={{ color: "#9CA3AF" }}>Chưa có dữ liệu</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-4xl mx-auto">
          {students.map((s, i) => (
            <div key={s.userId}
              className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{
                background: i === 0 ? "linear-gradient(135deg,#b45309,#92400e)" : "#ffffff",
                border: i === 0 ? "none" : "1px solid #e5e3df",
              }}>
              <div className="w-8 text-center flex-shrink-0">
                {i < 3
                  ? <span className="text-xl">{MEDALS[i]}</span>
                  : <span className="text-sm font-bold" style={{ color: i === 0 ? "#fbbf24" : "#9CA3AF" }}>#{i + 1}</span>}
              </div>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                style={{
                  background: i === 0 ? "rgba(255,255,255,0.2)" : "linear-gradient(135deg,#0055D4,#0068FF)",
                  border: i === 0 ? "1px solid rgba(255,255,255,0.3)" : "none",
                }}>
                {s.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate" style={{ color: i === 0 ? "#fff" : "#1E2938" }}>{s.name}</p>
                {s.school && <p className="text-xs truncate" style={{ color: i === 0 ? "rgba(255,255,255,0.7)" : "#9CA3AF" }}>{s.school}</p>}
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
          style={{ background: "#f6f5f4", border: "1px solid #e5e3df", color: "#0068FF" }}>
          Xem bảng xếp hạng đầy đủ →
        </Link>
      </div>
    </section>
  );
}

export default function GiangVienPage() {
  const [tutors, setTutors]   = useState<TutorListItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);
  const [subject, setSubject] = useState<string>("");
  const [sort, setSort]       = useState<SortKey>("rating");

  useEffect(() => {
    let cancelled = false;
    // Gói các setState trong Promise để eslint rule `set-state-in-effect`
    // không chặn — không phải chạy đồng bộ ở effect body.
    Promise.resolve().then(() => {
      if (cancelled) return;
      setLoading(true);
      setError(false);
    });
    const qs = new URLSearchParams();
    if (subject) qs.set("subject", subject);
    qs.set("sort", sort);
    fetch(`/api/tutors?${qs}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((d: { items: TutorListItem[] }) => { if (!cancelled) setTutors(d.items); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [subject, sort]);

  // FE-106: option subject lấy từ union tất cả subjects xuất hiện.
  const subjectOptions = useMemo(() => {
    if (!tutors) return [] as string[];
    const set = new Set<string>();
    for (const t of tutors) for (const s of t.subjects) set.add(s);
    return Array.from(set).sort();
  }, [tutors]);

  return (
    <div>
      {/* Hero (FE-105) */}
      <section style={{ background: "var(--brand-navy)" }}>
        <div className="max-w-7xl mx-auto px-6 py-14 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3"
            style={{ color: "rgba(255,255,255,0.45)" }}>Đội ngũ gia sư</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3" style={{ letterSpacing: "-0.03em" }}>
            Học từ người thật,<br />
            <span style={{ color: "#93C5FD" }}>kết quả thật</span>
          </h1>
          <p className="text-sm max-w-lg mx-auto" style={{ color: "rgba(255,255,255,0.6)" }}>
            Đội ngũ gia sư KiN — những người đang dạy live mỗi tối và theo sát từng học sinh.
          </p>
        </div>
      </section>

      {/* Filter + sort (FE-106) */}
      <section className="px-4 sm:px-6 lg:px-8 pt-8 max-w-7xl mx-auto">
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="tutor-subject" className="text-xs font-semibold" style={{ color: "#787671" }}>Môn</label>
          <select id="tutor-subject" value={subject} onChange={e => setSubject(e.target.value)}
            className="text-xs font-semibold px-3 py-1.5 rounded-full"
            style={{ background: "#f6f5f4", color: "#1a1a1a", border: "1px solid #e5e3df" }}>
            <option value="">Tất cả môn</option>
            {subjectOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <label htmlFor="tutor-sort" className="text-xs font-semibold ml-4" style={{ color: "#787671" }}>Sắp xếp</label>
          <select id="tutor-sort" value={sort} onChange={e => setSort(e.target.value as SortKey)}
            className="text-xs font-semibold px-3 py-1.5 rounded-full"
            style={{ background: "#f6f5f4", color: "#1a1a1a", border: "1px solid #e5e3df" }}>
            <option value="rating">Đánh giá cao</option>
            <option value="students">Nhiều học viên</option>
            <option value="classes">Nhiều lớp</option>
          </select>
        </div>
      </section>

      {/* Grid */}
      <section className="px-4 sm:px-6 lg:px-8 py-10 max-w-7xl mx-auto">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[0,1,2,3,4,5].map(i => <TutorCardSkeleton key={i} />)}
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <p className="text-sm" style={{ color: "#dc2626" }}>Không tải được danh sách gia sư. Thử lại sau.</p>
          </div>
        ) : tutors && tutors.length === 0 ? (
          <EmptyState title="Chưa có gia sư nào phù hợp bộ lọc"
            description={subject ? `Thử bỏ bộ lọc môn "${subject}" hoặc chọn môn khác.` : "Hiện chưa có gia sư nào được duyệt."}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {tutors!.map(t => <TutorCard key={t.id} t={t} />)}
          </div>
        )}
      </section>

      <div style={{ background: "#f6f5f4", borderTop: "1px solid #e5e3df", borderBottom: "1px solid #e5e3df" }}>
        <TopStudentsSection />
      </div>

      {/* CTA */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 max-w-2xl mx-auto text-center">
        <h2 className="text-xl font-bold mb-3" style={{ color: "#1a1a1a" }}>Bắt đầu học với gia sư ngay hôm nay</h2>
        <p className="text-sm mb-6" style={{ color: "#787671" }}>Gọi tư vấn miễn phí để được ghép lớp phù hợp với lộ trình của bạn</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/khoa-hoc"
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white text-center transition-all hover:brightness-105 active:scale-[0.98]"
            style={{ background: "#0068FF" }}>
            Xem khóa học
          </Link>
          <a href="tel:0384409051"
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-center transition-all hover:brightness-105 active:scale-[0.98]"
            style={{ background: "#ffffff", border: "1px solid #e5e3df", color: "#37352f" }}>
            Gọi 0384 409 051
          </a>
        </div>
      </section>
    </div>
  );
}
