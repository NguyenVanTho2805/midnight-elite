"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Trophy, Crown, Inbox } from "griddy-icons";
import { useAuth } from "@/contexts/AuthContext";
import { COURSE_CATEGORIES } from "@/lib/courseData";
import { BADGE_RULES, PERIOD_LABELS, computeRankings, type HonorStudent, type SortKey, type Period } from "@/lib/honorData";
import { GpaBar } from "@/components/GpaBar";

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const colors = ["#0055D4", "#7C3AED", "#16a34a", "#EF4444", "#FE9900", "#0891B2"];
  const idx = name.charCodeAt(0) % colors.length;
  return (
    <div className="rounded-xl flex items-center justify-center text-white font-extrabold flex-shrink-0"
      style={{ width: size, height: size, background: `linear-gradient(135deg,${colors[idx]},${colors[(idx+1)%colors.length]})`, fontSize: size*0.4 }}>
      {name[0]}
    </div>
  );
}

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface LeaderboardEntry {
  userId: string; name: string; school: string | null;
  best: number; avg: number; count: number;
}

// ─── TAB THI THỬ ──────────────────────────────────────────────────────────────
function TabThiThu({ myName, myId }: { myName: string; myId: string }) {
  const [activeFilter, setActiveFilter] = useState("Tất cả");
  const [apiData, setApiData]   = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading]   = useState(true);
  const [total, setTotal]       = useState(0);

  // Re-fetch khi filter thay đổi
  useEffect(() => {
    setLoading(true);
    const url = activeFilter === "Tất cả"
      ? "/api/leaderboard"
      : `/api/leaderboard?category=${encodeURIComponent(activeFilter)}`;
    fetch(url)
      .then(r => r.ok ? r.json() : [])
      .then((data: LeaderboardEntry[]) => {
        setApiData(data);
        setTotal(data.length);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [activeFilter]);

  const leaderboard = apiData.map((u, i) => ({
    rank: i + 1, name: u.name, school: u.school ?? "—",
    score: u.best, maxScore: 150, userId: u.userId,
  }));

  const myEntry = leaderboard.find(e => e.userId === myId);
  const top3    = leaderboard.slice(0, 3);

  return (
    <>
      {/* Vị trí của bạn */}
      {myEntry && (
        <div className="notion-hero-band rounded-xl px-5 py-4 mb-8 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0"
            style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)" }}>
            {myName[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm truncate">{myName}</p>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.7)" }}>Điểm cao nhất — {myEntry.score}/{myEntry.maxScore}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-white font-bold text-2xl leading-none">#{myEntry.rank}</div>
            <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.7)" }}>/{leaderboard.length} học viên</div>
          </div>
        </div>
      )}

      <div className="text-center mb-6">
        <p className="text-sm" style={{ color: "#6B7280" }}>
          {activeFilter === "Tất cả" ? "Tất cả kỳ thi" : activeFilter}
          {total > 0 && ` · ${total} học viên`}
        </p>
      </div>

      {/* Filter — dùng COURSE_CATEGORIES thay vì hardcode */}
      <div className="flex flex-wrap gap-2 mb-8">
        {COURSE_CATEGORIES.map(t => (
          <button key={t} onClick={() => setActiveFilter(t)}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
            style={activeFilter === t
              ? { background: "#0068FF", color: "white", borderRadius: "8px" }
              : { background: "#ffffff", border: "1px solid #e5e3df", color: "#787671", borderRadius: "8px" }}>
            {t}
          </button>
        ))}
      </div>

      {loading && <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background:"#f6f5f4" }} />)}</div>}

      {!loading && leaderboard.length === 0 && (
        <div className="rounded-xl p-12 mb-8 text-center" style={{ background: "#f6f5f4", border: "1px solid #e5e3df" }}>
          <div className="flex justify-center mb-3" style={{ color: "#a4a097" }}><Inbox size={48} /></div>
          <p className="text-base font-bold mb-1" style={{ color: "#37352f" }}>Chưa có dữ liệu cho {activeFilter}</p>
          <button onClick={() => setActiveFilter("Tất cả")} className="mt-4 text-sm font-semibold" style={{ color: "#0068FF" }}>
            Xem bảng tất cả →
          </button>
        </div>
      )}

      {top3.length >= 3 && (
        <div className="grid grid-cols-3 gap-4 mb-10 items-end">
          {/* Hạng 2 */}
          <div className="text-center">
            <div className="rounded-xl p-4 mx-auto" style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
              <div className="flex justify-center mb-2" style={{ color: "#a4a097" }}><span className="text-2xl font-bold">2</span></div>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg mx-auto mb-3"
                style={{ background: "linear-gradient(135deg,#64748b,#475569)" }}>{top3[1].name[0]}</div>
              <p className="text-xs font-bold mb-0.5 truncate" style={{ color: "#37352f" }}>{top3[1].name}</p>
              <p className="text-xs mb-2 truncate" style={{ color: "#a4a097" }}>{top3[1].school.split(",")[0]}</p>
              <p className="text-lg font-bold" style={{ color: "#787671" }}>{top3[1].score}</p>
            </div>
            <div className="h-12 flex items-end justify-center"><span className="text-xs font-bold" style={{ color: "#a4a097" }}>Hạng 2</span></div>
          </div>
          {/* Hạng 1 */}
          <div className="text-center -mt-4">
            <div className="notion-hero-band rounded-xl p-5 mx-auto relative">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2" style={{ color: "#fbbf24" }}><Crown size={28} /></div>
              <div className="mt-4 flex justify-center mb-2" style={{ color: "#fbbf24" }}><Trophy size={36} /></div>
              <div className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-xl mx-auto mb-3"
                style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)" }}>{top3[0].name[0]}</div>
              <p className="text-sm font-bold mb-0.5 text-white truncate">{top3[0].name}</p>
              <p className="text-xs mb-2 truncate" style={{ color: "rgba(255,255,255,0.7)" }}>{top3[0].school.split(",")[0]}</p>
              <p className="text-2xl font-bold text-white">{top3[0].score}</p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>/ 150</p>
            </div>
            <div className="h-12 flex items-end justify-center"><span className="text-xs font-bold" style={{ color: "#b45309" }}>Hạng 1 🏆</span></div>
          </div>
          {/* Hạng 3 */}
          <div className="text-center">
            <div className="rounded-xl p-4 mx-auto" style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
              <div className="flex justify-center mb-2" style={{ color: "#b45309" }}><span className="text-2xl font-bold">3</span></div>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg mx-auto mb-3"
                style={{ background: "linear-gradient(135deg,#b45309,#92400e)" }}>{top3[2].name[0]}</div>
              <p className="text-xs font-bold mb-0.5 truncate" style={{ color: "#37352f" }}>{top3[2].name}</p>
              <p className="text-xs mb-2 truncate" style={{ color: "#a4a097" }}>{top3[2].school.split(",")[0]}</p>
              <p className="text-lg font-bold" style={{ color: "#b45309" }}>{top3[2].score}</p>
            </div>
            <div className="h-12 flex items-end justify-center"><span className="text-xs font-bold" style={{ color: "#a4a097" }}>Hạng 3</span></div>
          </div>
        </div>
      )}

      {leaderboard.length > 0 && (
        <div className="rounded-xl overflow-hidden mb-8" style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
          <div className="grid grid-cols-12 px-6 py-4 text-xs font-bold uppercase tracking-wider" style={{ color: "#787671", background: "#f6f5f4", borderBottom: "1px solid #e5e3df" }}>
            <div className="col-span-1">#</div>
            <div className="col-span-5">Học sinh</div>
            <div className="col-span-3 hidden sm:block">Trường</div>
            <div className="col-span-3 text-right">Điểm cao nhất</div>
          </div>
          {leaderboard.map((s, idx) => {
            const isMe = s.userId === myId;
            return (
              <div key={s.userId} className="grid grid-cols-12 items-center px-6 py-4"
                style={{ borderTop: idx > 0 ? "1px solid #e5e3df" : "none", background: isMe ? "rgba(0,104,255,0.04)" : "transparent" }}>
                <div className="col-span-1 flex items-center">
                  {idx === 0 ? <Trophy size={20} style={{ color: "#b45309" }} /> : (
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
                      style={{ background: isMe ? "#0068FF" : "#f6f5f4", border: "1px solid #e5e3df", color: isMe ? "white" : idx < 3 ? "#0068FF" : "#787671" }}>
                      {idx + 1}
                    </span>
                  )}
                </div>
                <div className="col-span-5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-sm" style={{ color: isMe ? "#0068FF" : "#1E2938" }}>{s.name}</span>
                    {isMe && <span className="text-xs px-1.5 py-0.5 rounded-full font-bold" style={{ background: "#DBEAFE", color: "#0055D4" }}>Bạn</span>}
                  </div>
                </div>
                <div className="col-span-3 hidden sm:block text-xs" style={{ color: "#9CA3AF" }}>{s.school.split(",")[0]}</div>
                <div className="col-span-3 text-right">
                  <span className="text-base font-extrabold" style={{ color: "#0068FF" }}>{s.score}</span>
                  <span className="text-xs ml-0.5" style={{ color: "#9CA3AF" }}>/150</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="notion-hero-band rounded-xl p-8 text-center">
        <div className="flex justify-center mb-3" style={{ color: "#fbbf24" }}><Trophy size={48} /></div>
        <h2 className="text-xl font-bold text-white mb-2">Leo lên top 10 ngay hôm nay!</h2>
        <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.75)" }}>
          {myEntry ? `Bạn đang ở hạng #${myEntry.rank}. Ôn luyện thêm để vươn lên!` : "Tham gia thi thử để lên bảng xếp hạng!"}
        </p>
        <Link href="/student/hoc-tap"
          className="inline-block px-8 py-3 rounded-lg text-sm font-bold text-white"
          style={{ background: "#0068FF", borderRadius: "8px" }}>
          Ôn luyện ngay →
        </Link>
      </div>
    </>
  );
}

// ─── TAB VINH DANH ────────────────────────────────────────────────────────────
function TabVinhDanh({ myName, myId }: { myName: string; myId: string }) {
  const [sortKey, setSortKey] = useState<SortKey>("gpa");
  const [students, setStudents] = useState<HonorStudent[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    fetch("/api/honor-leaderboard")
      .then(r => r.ok ? r.json() : [])
      .then(setStudents)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const ranked = useMemo(() => computeRankings(students, sortKey), [students, sortKey]);
  const top3   = ranked.slice(0, 3);

  const badgesWithStudents = useMemo(() =>
    BADGE_RULES.map(rule => ({ ...rule, students: students.filter(rule.check) })),
  [students]);

  const getBadges = (s: HonorStudent) => BADGE_RULES.filter(r => r.check(s));

  // Tìm vị trí thật của học viên
  const myEntry = ranked.find(s => s.id === myId);

  return (
    <>
      {/* Vị trí của bạn */}
      <div className="rounded-xl px-5 py-4 mb-8 flex items-center gap-4"
        style={{ background: "linear-gradient(135deg,#b45309,#92400e)" }}>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0"
          style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)" }}>
          {myName[0]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-extrabold text-sm truncate">{myName}</p>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.8)" }}>
            Bảng vinh danh Midnight Elite
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          {myEntry ? (
            <>
              <div className="text-white font-black text-2xl leading-none">#{myEntry.rank}</div>
              <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.8)" }}>GPA {myEntry.gpa.toFixed(1)}</div>
            </>
          ) : (
            <div className="text-xs" style={{ color: "rgba(255,255,255,0.8)" }}>
              {loading ? "Đang tải..." : "Chưa có dữ liệu"}
            </div>
          )}
        </div>
      </div>

      <div className="text-center mb-6">
        <p className="text-sm" style={{ color: "#6B7280" }}>{students.length} học sinh trong bảng</p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-end gap-3 mb-8">
        <div className="flex gap-1.5">
          {([
            { key: "gpa" as SortKey, label: "GPA" },
            { key: "lastExamScore" as SortKey, label: "Điểm thi" },
            { key: "completion" as SortKey, label: "Tiến độ" },
          ]).map(opt => (
            <button key={opt.key} onClick={() => setSortKey(opt.key)}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
              style={sortKey === opt.key
                ? { background: "#b45309", color: "white", borderRadius: "8px" }
                : { background: "#ffffff", border: "1px solid #e5e3df", color: "#787671", borderRadius: "8px" }}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background:"#f6f5f4" }} />)}</div>}

      {!loading && students.length === 0 && (
        <div className="text-center py-12 rounded-xl" style={{ background: "#f6f5f4", border: "1px solid #e5e3df" }}>
          <p className="text-sm" style={{ color: "#9CA3AF" }}>Chưa có dữ liệu vinh danh. Hãy tham gia học và thi thử!</p>
        </div>
      )}

      {top3.length >= 3 && (
        <div className="grid grid-cols-3 gap-4 mb-10 items-end">
          <div className="text-center">
            <div className="rounded-xl p-5 mx-auto" style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
              <div className="text-3xl mb-3">🥈</div>
              <div className="flex justify-center mb-3"><Avatar name={top3[1].name} size={48} /></div>
              <p className="text-xs font-bold mb-0.5 truncate" style={{ color: "#37352f" }}>{top3[1].name}</p>
              <p className="text-xs mb-2 truncate" style={{ color: "#a4a097" }}>{top3[1].school.split(",")[0]}</p>
              <div className="text-xl font-bold" style={{ color: "#787671" }}>
                {sortKey === "gpa" ? top3[1].gpa.toFixed(1) : sortKey === "lastExamScore" ? top3[1].lastExamScore : `${top3[1].completion}%`}
              </div>
            </div>
            <div className="h-8 flex items-end justify-center"><span className="text-xs font-bold" style={{ color: "#a4a097" }}>Hạng 2</span></div>
          </div>
          <div className="text-center -mt-6">
            <div className="rounded-xl p-6 mx-auto relative"
              style={{ background: "linear-gradient(135deg,#b45309,#92400e)" }}>
              <div className="absolute -top-4 left-1/2 -translate-x-1/2" style={{ color: "#fbbf24" }}><Crown size={28} /></div>
              <div className="mt-4 text-3xl mb-3">🏆</div>
              <div className="flex justify-center mb-3"><Avatar name={top3[0].name} size={52} /></div>
              <p className="text-sm font-bold mb-0.5 text-white truncate">{top3[0].name}</p>
              <p className="text-xs mb-2 truncate" style={{ color: "rgba(255,255,255,0.8)" }}>{top3[0].school.split(",")[0]}</p>
              <div className="text-2xl font-bold text-white">
                {sortKey === "gpa" ? top3[0].gpa.toFixed(1) : sortKey === "lastExamScore" ? top3[0].lastExamScore : `${top3[0].completion}%`}
              </div>
            </div>
            <div className="h-8 flex items-end justify-center"><span className="text-xs font-bold" style={{ color: "#b45309" }}>Hạng 1 🏆</span></div>
          </div>
          <div className="text-center">
            <div className="rounded-xl p-5 mx-auto" style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
              <div className="text-3xl mb-3">🥉</div>
              <div className="flex justify-center mb-3"><Avatar name={top3[2].name} size={48} /></div>
              <p className="text-xs font-bold mb-0.5 truncate" style={{ color: "#37352f" }}>{top3[2].name}</p>
              <p className="text-xs mb-2 truncate" style={{ color: "#a4a097" }}>{top3[2].school.split(",")[0]}</p>
              <div className="text-xl font-bold" style={{ color: "#b45309" }}>
                {sortKey === "gpa" ? top3[2].gpa.toFixed(1) : sortKey === "lastExamScore" ? top3[2].lastExamScore : `${top3[2].completion}%`}
              </div>
            </div>
            <div className="h-8 flex items-end justify-center"><span className="text-xs font-bold" style={{ color: "#a4a097" }}>Hạng 3</span></div>
          </div>
        </div>
      )}

      {/* Full table */}
      {ranked.length > 0 && (
        <div className="rounded-xl overflow-hidden mb-10" style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
          <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid #e5e3df", background: "#f6f5f4" }}>
            <h2 className="font-bold text-sm" style={{ color: "#1E2938" }}>Bảng xếp hạng đầy đủ</h2>
            <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: "#DCFCE7", color: "#166534" }}>{students.length} học sinh</span>
          </div>
          {ranked.map((s, idx) => {
            const badges = getBadges(s);
            const isMe   = s.id === myId;
            return (
              <div key={s.id} className="flex items-center gap-4 px-6 py-4"
                style={{ borderTop: idx > 0 ? "1px solid #e5e3df" : "none", background: isMe ? "rgba(0,104,255,0.04)" : "transparent" }}>
                <div className="w-8 flex-shrink-0 text-center">
                  {idx === 0 ? <span className="text-xl">🥇</span> : idx === 1 ? <span className="text-xl">🥈</span> : idx === 2 ? <span className="text-xl">🥉</span> : (
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold mx-auto"
                      style={{ background: isMe ? "#0068FF" : "#f6f5f4", border: "1px solid #e5e3df", color: isMe ? "white" : "#787671" }}>
                      {idx + 1}
                    </span>
                  )}
                </div>
                <Avatar name={s.name} size={36} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-sm" style={{ color: isMe ? "#0068FF" : "#1E2938" }}>{s.name}</span>
                    {isMe && <span className="text-xs px-1.5 py-0.5 rounded-full font-bold" style={{ background: "#DBEAFE", color: "#0055D4" }}>Bạn</span>}
                    {badges.map(b => (
                      <span key={b.id} title={b.title} className="px-1.5 py-0.5 text-xs rounded-full font-bold leading-none"
                        style={{ background: b.bg, color: b.color, border: `1px solid ${b.borderColor}` }}>
                        {b.icon}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs mt-0.5 truncate" style={{ color: "#9CA3AF" }}>{s.school}</p>
                </div>
                <div className="hidden sm:flex items-center gap-5 flex-shrink-0">
                  <div className="w-24"><GpaBar value={s.gpa} /><p className="text-xs text-center mt-0.5" style={{ color: "#9CA3AF" }}>GPA</p></div>
                  <div className="text-center hidden md:block">
                    <div className="text-sm font-extrabold" style={{ color: "#0068FF" }}>{s.lastExamScore > 0 ? s.lastExamScore : "—"}</div>
                    <p className="text-xs" style={{ color: "#9CA3AF" }}>Điểm thi</p>
                  </div>
                  <div className="text-center hidden lg:block">
                    <div className="text-sm font-extrabold" style={{ color: "#7C3AED" }}>{s.completion}%</div>
                    <p className="text-xs" style={{ color: "#9CA3AF" }}>Tiến độ</p>
                  </div>
                </div>
              </div>
            );
          })}
          <div className="px-6 py-4 text-center" style={{ borderTop: "1px solid #e5e3df" }}>
            <p className="text-xs" style={{ color: "#9CA3AF" }}>GPA = 40% tiến độ + 60% điểm thi · Cập nhật tự động từ DB</p>
          </div>
        </div>
      )}

      {/* Badges */}
      <div className="mb-10">
        <h2 className="text-xl font-extrabold mb-6 text-center" style={{ color: "#1E2938" }}>🏅 Badge <span style={{ color: "#FE9900" }}>tháng này</span></h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {badgesWithStudents.map(b => (
            <div key={b.id} className="rounded-xl p-5" style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ background: b.bg, border: `2px solid ${b.borderColor}` }}>{b.icon}</div>
                <div>
                  <p className="font-extrabold text-sm" style={{ color: "#1E2938" }}>{b.title}</p>
                  <p className="text-xs" style={{ color: "#9CA3AF" }}>{b.desc}</p>
                  <p className="text-xs font-semibold mt-0.5" style={{ color: b.color }}>{b.reward}</p>
                </div>
              </div>
              {b.students.length === 0 ? (
                <p className="text-xs text-center py-2" style={{ color: "#9CA3AF" }}>Chưa có học sinh đủ điều kiện</p>
              ) : (
                <div className="space-y-2">
                  {b.students.map((s, i) => (
                    <div key={s.id} className="flex items-center gap-2.5 px-3 py-2 rounded-2xl"
                      style={{ background: b.bg, border: `1px solid ${b.borderColor}` }}>
                      <span className="text-xs font-extrabold w-5 flex-shrink-0" style={{ color: b.color }}>#{i + 1}</span>
                      <Avatar name={s.name} size={28} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate" style={{ color: "#1E2938" }}>{s.name}</p>
                        <p className="text-xs truncate" style={{ color: "#9CA3AF" }}>{s.school.split(",")[0]}</p>
                      </div>
                      <span className="text-xs font-extrabold flex-shrink-0" style={{ color: b.color }}>GPA {s.gpa.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────
type Tab = "thi-thu" | "vinh-danh";

export default function StudentBangXepHangPage() {
  const [tab, setTab] = useState<Tab>("thi-thu");
  const { user } = useAuth();
  const myName = user?.name ?? "Học viên";
  const myId   = user?.id   ?? "";

  return (
    <div className="max-w-4xl mx-auto space-y-0">
      <div className="text-center mb-10">
        <h1 className="text-2xl sm:text-3xl font-extrabold mb-2" style={{ color: "#1E2938" }}>
          Bảng xếp hạng <span style={{ color: "#FE9900" }}>&amp; Vinh danh</span>
        </h1>
        <p className="text-sm" style={{ color: "#6B7280" }}>Xếp hạng thi thử toàn server và vinh danh học sinh xuất sắc Midnight Elite</p>
      </div>

      <div className="flex gap-1 mb-10 p-1 rounded-lg w-fit mx-auto"
        style={{ background: "#f6f5f4", border: "1px solid #e5e3df" }}>
        <button onClick={() => setTab("thi-thu")}
          className="px-6 py-2.5 rounded-md text-sm font-medium transition-all"
          style={tab === "thi-thu"
            ? { background: "#ffffff", color: "#37352f", border: "1px solid #e5e3df" }
            : { color: "#787671" }}>
          🏆 Thi thử
        </button>
        <button onClick={() => setTab("vinh-danh")}
          className="px-6 py-2.5 rounded-md text-sm font-medium transition-all"
          style={tab === "vinh-danh"
            ? { background: "#ffffff", color: "#37352f", border: "1px solid #e5e3df" }
            : { color: "#787671" }}>
          ⭐ Vinh danh
        </button>
      </div>

      {tab === "thi-thu"
        ? <TabThiThu myName={myName} myId={myId} />
        : <TabVinhDanh myName={myName} myId={myId} />
      }
    </div>
  );
}
