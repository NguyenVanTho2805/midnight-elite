"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Trophy, Crown } from "griddy-icons";
import { COURSE_CATEGORIES } from "@/lib/courseData";
import { BADGE_RULES, computeRankings, type HonorStudent, type SortKey } from "@/lib/honorData";
import { GpaBar } from "@/components/GpaBar";
import { useAuth } from "@/contexts/AuthContext";

function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const colors = ["#0055D4", "#7C3AED", "#16a34a", "#EF4444", "#FE9900", "#0891B2"];
  const idx = name.charCodeAt(0) % colors.length;
  return (
    <div className="rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0"
      style={{ width: size, height: size, background: `linear-gradient(145deg,${colors[idx]},${colors[(idx+1)%colors.length]})`, fontSize: size * 0.4 }}>
      {name[0]}
    </div>
  );
}

interface LeaderboardEntry {
  userId: string; name: string; school: string | null;
  best: number; avg: number; count: number;
}

function TabThiThu() {
  const { user } = useAuth();
  const [activeFilter, setActiveFilter] = useState("Tất cả");
  const [apiData, setApiData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading]     = useState(true);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setFetchError(false);
    const url = activeFilter === "Tất cả"
      ? "/api/leaderboard"
      : `/api/leaderboard?category=${encodeURIComponent(activeFilter)}`;
    fetch(url)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setApiData)
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false));
  }, [activeFilter]);

  const leaderboard = apiData.map((u, i) => ({
    rank: i + 1, name: u.name, school: u.school ?? "—", score: u.best, maxScore: 150,
  }));
  const top3 = leaderboard.slice(0, 3);

  return (
    <>
      <div className="text-center mb-6">
        <span className="inline-block px-3 py-1 rounded-full text-xs font-medium mb-3"
          style={{ background: "#fef3c7", color: "#b45309", border: "1px solid #fde68a" }}>
          Cập nhật tự động từ kết quả thi thật
        </span>
        <p className="text-sm" style={{ color: "#787671" }}>
          {activeFilter === "Tất cả" ? "Tất cả kỳ thi" : activeFilter}
          {leaderboard.length > 0 && ` · ${leaderboard.length} học viên`}
        </p>
      </div>

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

      {fetchError && (
        <div className="flex items-center justify-between p-4 rounded-xl mb-4"
          style={{ background: "#FEE2E2", border: "1px solid #FECACA" }}>
          <span className="text-sm font-semibold" style={{ color: "#dc2626" }}>Không thể tải bảng xếp hạng</span>
          <button onClick={() => { setFetchError(false); setLoading(true);
            const url = activeFilter === "Tất cả" ? "/api/leaderboard" : `/api/leaderboard?category=${encodeURIComponent(activeFilter)}`;
            fetch(url).then(r => r.ok ? r.json() : Promise.reject()).then(setApiData).catch(() => setFetchError(true)).finally(() => setLoading(false));
          }} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: "#dc2626" }}>
            Thử lại
          </button>
        </div>
      )}

      {!loading && !fetchError && leaderboard.length === 0 && (
        <div className="rounded-xl p-12 mb-8 text-center" style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
          <p className="text-base font-semibold mb-1" style={{ color: "#1a1a1a" }}>Chưa có kết quả cho {activeFilter}</p>
          <button onClick={() => setActiveFilter("Tất cả")} className="mt-3 text-sm font-semibold" style={{ color: "#0068FF" }}>
            Xem tất cả →
          </button>
        </div>
      )}

      {top3.length >= 3 && (
        <div className="grid grid-cols-3 gap-4 mb-10 items-end">
          {/* #2 */}
          <div className="text-center">
            <div className="rounded-xl p-4 mx-auto" style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
              <div className="flex justify-center mb-2"><span className="text-2xl font-bold" style={{ color: "#a4a097" }}>2</span></div>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg mx-auto mb-3"
                style={{ background: "linear-gradient(145deg,#9CA3AF,#6B7280)" }}>{top3[1].name[0]}</div>
              <p className="text-xs font-bold mb-0.5 truncate" style={{ color: "#1a1a1a" }}>{top3[1].name}</p>
              <p className="text-xs mb-2 truncate" style={{ color: "#a4a097" }}>{top3[1].school.split(",")[0]}</p>
              <p className="text-lg font-bold" style={{ color: "#787671" }}>{top3[1].score}</p>
            </div>
            <div className="h-12 flex items-end justify-center"><span className="text-xs font-semibold" style={{ color: "#a4a097" }}>Hạng 2</span></div>
          </div>
          {/* #1 */}
          <div className="text-center -mt-4">
            <div className="rounded-xl p-5 mx-auto relative notion-hero-band">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2" style={{ color: "#FDE047" }}><Crown size={28} /></div>
              <div className="mt-4 flex justify-center mb-2" style={{ color: "#FDE047" }}><Trophy size={36} /></div>
              <div className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-xl mx-auto mb-3"
                style={{ background: "rgba(255,255,255,0.2)" }}>{top3[0].name[0]}</div>
              <p className="text-sm font-bold mb-0.5 text-white truncate">{top3[0].name}</p>
              <p className="text-xs mb-2 truncate" style={{ color: "rgba(255,255,255,0.7)" }}>{top3[0].school.split(",")[0]}</p>
              <p className="text-2xl font-bold text-white">{top3[0].score}</p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>/ 150</p>
            </div>
            <div className="h-12 flex items-end justify-center"><span className="text-xs font-bold" style={{ color: "#b45309" }}>Hạng 1</span></div>
          </div>
          {/* #3 */}
          <div className="text-center">
            <div className="rounded-xl p-4 mx-auto" style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
              <div className="flex justify-center mb-2"><span className="text-2xl font-bold" style={{ color: "#CD7F32" }}>3</span></div>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg mx-auto mb-3"
                style={{ background: "linear-gradient(145deg,#CD7F32,#a0622a)" }}>{top3[2].name[0]}</div>
              <p className="text-xs font-bold mb-0.5 truncate" style={{ color: "#1a1a1a" }}>{top3[2].name}</p>
              <p className="text-xs mb-2 truncate" style={{ color: "#a4a097" }}>{top3[2].school.split(",")[0]}</p>
              <p className="text-lg font-bold" style={{ color: "#CD7F32" }}>{top3[2].score}</p>
            </div>
            <div className="h-12 flex items-end justify-center"><span className="text-xs font-semibold" style={{ color: "#a4a097" }}>Hạng 3</span></div>
          </div>
        </div>
      )}

      {leaderboard.length > 0 && (
        <div className="rounded-xl overflow-hidden mb-8" style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
          <div className="grid grid-cols-12 px-6 py-3 text-xs font-semibold uppercase tracking-wider"
            style={{ color: "#787671", background: "#f6f5f4", borderBottom: "1px solid #e5e3df" }}>
            <div className="col-span-1">#</div>
            <div className="col-span-5">Học sinh</div>
            <div className="col-span-3 hidden sm:block">Trường</div>
            <div className="col-span-3 text-right">Điểm cao nhất</div>
          </div>
          {leaderboard.map((s, idx) => {
            const isMe = !!user && apiData[idx]?.userId === user.id;
            return (
              <div key={`${s.name}-${idx}`} className="grid grid-cols-12 items-center px-6 py-4"
                style={{
                  borderBottom: idx < leaderboard.length - 1 ? "1px solid #e5e3df" : "none",
                  background: isMe ? "#EFF6FF" : idx < 3 ? "#fafafa" : "transparent",
                  borderLeft: isMe ? "3px solid #0068FF" : "3px solid transparent",
                }}>
                <div className="col-span-1 flex items-center">
                  {idx === 0 ? <Trophy size={20} style={{ color: "#b45309" }} /> : (
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
                      style={{ background: "#f6f5f4", border: "1px solid #e5e3df", color: idx < 3 ? "#0068FF" : "#787671" }}>
                      {idx + 1}
                    </span>
                  )}
                </div>
                <div className="col-span-5 flex items-center gap-2">
                  <div className="font-semibold text-sm" style={{ color: isMe ? "#0068FF" : "#1a1a1a" }}>{s.name}</div>
                  {isMe && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ background: "#0068FF" }}>Bạn</span>
                  )}
                </div>
                <div className="col-span-3 hidden sm:block text-xs" style={{ color: "#a4a097" }}>{s.school.split(",")[0]}</div>
                <div className="col-span-3 text-right">
                  <span className="text-base font-bold" style={{ color: "#0068FF" }}>{s.score}</span>
                  <span className="text-xs ml-0.5" style={{ color: "#a4a097" }}>/150</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CTA — only for guests */}
      {!user && (
        <div className="notion-hero-band rounded-xl p-8 text-center">
          <div className="flex justify-center mb-3" style={{ color: "#FDE047" }}><Trophy size={40} /></div>
          <h2 className="text-xl font-bold text-white mb-2">Tên bạn sẽ xuất hiện ở đây!</h2>
          <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.7)" }}>Thi thử để lên bảng xếp hạng toàn server.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/thi-thu" className="px-6 py-2.5 rounded-lg text-sm font-semibold"
              style={{ background: "#ffffff", color: "#0068FF", borderRadius: "8px" }}>
              Thi thử ngay
            </Link>
            <Link href="/dang-ky" className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white"
              style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: "8px" }}>
              Tạo tài khoản miễn phí
            </Link>
          </div>
        </div>
      )}
    </>
  );
}

function TabVinhDanh() {
  const { user } = useAuth();
  const [sortKey, setSortKey]   = useState<SortKey>("gpa");
  const [students, setStudents] = useState<HonorStudent[]>([]);
  const [loading, setLoading]   = useState(true);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    setFetchError(false);
    fetch("/api/honor-leaderboard")
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setStudents)
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false));
  }, []);

  const ranked = useMemo(() => computeRankings(students, sortKey), [students, sortKey]);
  const top3   = ranked.slice(0, 3);
  const badgesWithStudents = useMemo(() =>
    BADGE_RULES.map(rule => ({ ...rule, students: students.filter(rule.check) })),
  [students]);
  const getBadges = (s: HonorStudent) => BADGE_RULES.filter(r => r.check(s));

  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-8">
        <p className="text-sm" style={{ color: "#787671" }}>{students.length} học sinh Midnight Elite</p>
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

      {fetchError && (
        <div className="flex items-center justify-between p-4 rounded-xl mb-4"
          style={{ background: "#FEE2E2", border: "1px solid #FECACA" }}>
          <span className="text-sm font-semibold" style={{ color: "#dc2626" }}>Không thể tải bảng vinh danh</span>
          <button onClick={() => { setFetchError(false);
            fetch("/api/honor-leaderboard").then(r => r.ok ? r.json() : Promise.reject()).then(setStudents).catch(() => setFetchError(true));
          }} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: "#dc2626" }}>
            Thử lại
          </button>
        </div>
      )}

      {!loading && !fetchError && students.length === 0 && (
        <div className="text-center py-12 rounded-xl" style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
          <p className="text-sm" style={{ color: "#a4a097" }}>Chưa có dữ liệu vinh danh.</p>
        </div>
      )}

      {top3.length >= 3 && (
        <div className="grid grid-cols-3 gap-4 mb-10 items-end">
          <div className="text-center">
            <div className="rounded-xl p-5 mx-auto" style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
              <div className="text-2xl font-bold mb-3" style={{ color: "#9CA3AF" }}>2</div>
              <div className="flex justify-center mb-3"><Avatar name={top3[1].name} size={48} /></div>
              <p className="text-xs font-bold mb-0.5 truncate" style={{ color: "#1a1a1a" }}>{top3[1].name}</p>
              <p className="text-xs mb-2 truncate" style={{ color: "#a4a097" }}>{top3[1].school.split(",")[0]}</p>
              <div className="text-xl font-bold" style={{ color: "#787671" }}>
                {sortKey === "gpa" ? top3[1].gpa.toFixed(1) : sortKey === "lastExamScore" ? top3[1].lastExamScore : `${top3[1].completion}%`}
              </div>
            </div>
            <div className="h-8 flex items-end justify-center"><span className="text-xs font-semibold" style={{ color: "#a4a097" }}>Hạng 2</span></div>
          </div>
          <div className="text-center -mt-6">
            <div className="rounded-xl p-6 mx-auto relative" style={{ background: "linear-gradient(145deg,#b45309,#92400e)" }}>
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-white"><Crown size={28} /></div>
              <div className="mt-4 flex justify-center mb-3" style={{ color: "#FDE047" }}><Trophy size={32} /></div>
              <div className="flex justify-center mb-3"><Avatar name={top3[0].name} size={52} /></div>
              <p className="text-sm font-bold mb-0.5 text-white truncate">{top3[0].name}</p>
              <p className="text-xs mb-2 truncate" style={{ color: "rgba(255,255,255,0.8)" }}>{top3[0].school.split(",")[0]}</p>
              <div className="text-2xl font-bold text-white">
                {sortKey === "gpa" ? top3[0].gpa.toFixed(1) : sortKey === "lastExamScore" ? top3[0].lastExamScore : `${top3[0].completion}%`}
              </div>
            </div>
            <div className="h-8 flex items-end justify-center"><span className="text-xs font-bold" style={{ color: "#b45309" }}>Hạng 1</span></div>
          </div>
          <div className="text-center">
            <div className="rounded-xl p-5 mx-auto" style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
              <div className="text-2xl font-bold mb-3" style={{ color: "#CD7F32" }}>3</div>
              <div className="flex justify-center mb-3"><Avatar name={top3[2].name} size={48} /></div>
              <p className="text-xs font-bold mb-0.5 truncate" style={{ color: "#1a1a1a" }}>{top3[2].name}</p>
              <p className="text-xs mb-2 truncate" style={{ color: "#a4a097" }}>{top3[2].school.split(",")[0]}</p>
              <div className="text-xl font-bold" style={{ color: "#CD7F32" }}>
                {sortKey === "gpa" ? top3[2].gpa.toFixed(1) : sortKey === "lastExamScore" ? top3[2].lastExamScore : `${top3[2].completion}%`}
              </div>
            </div>
            <div className="h-8 flex items-end justify-center"><span className="text-xs font-semibold" style={{ color: "#a4a097" }}>Hạng 3</span></div>
          </div>
        </div>
      )}

      {ranked.length > 0 && (
        <div className="rounded-xl overflow-hidden mb-10" style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
          <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid #e5e3df", background: "#f6f5f4" }}>
            <h2 className="font-semibold text-sm" style={{ color: "#1a1a1a" }}>Bảng xếp hạng đầy đủ</h2>
            <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
              style={{ background: "#dcfce7", color: "#166534", border: "1px solid #86efac" }}>{students.length} học sinh</span>
          </div>
          {ranked.map((s, idx) => {
            const badges = getBadges(s);
            const isMe = !!user && s.id === user.id;
            return (
              <div key={s.id} className="flex items-center gap-4 px-6 py-4"
                style={{
                  borderBottom: idx < ranked.length - 1 ? "1px solid #e5e3df" : "none",
                  background: isMe ? "#EFF6FF" : idx < 3 ? "#fafafa" : "transparent",
                  borderLeft: isMe ? "3px solid #0068FF" : "3px solid transparent",
                }}>
                <div className="w-8 flex-shrink-0 text-center">
                  {idx === 0 ? <Trophy size={18} style={{ color: "#b45309" }} /> : (
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold mx-auto"
                      style={{ background: "#f6f5f4", border: "1px solid #e5e3df", color: "#787671" }}>
                      {idx + 1}
                    </span>
                  )}
                </div>
                <Avatar name={s.name} size={36} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-sm" style={{ color: isMe ? "#0068FF" : "#1a1a1a" }}>{s.name}</span>
                    {isMe && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ background: "#0068FF" }}>Bạn</span>
                    )}
                    {badges.map(b => (
                      <span key={b.id} title={b.title} className="px-1.5 py-0.5 text-xs rounded-full font-bold leading-none"
                        style={{ background: b.bg, color: b.color, border: `1px solid ${b.borderColor}` }}>
                        {b.icon}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs mt-0.5 truncate" style={{ color: "#a4a097" }}>{s.school}</p>
                </div>
                <div className="hidden sm:flex items-center gap-5 flex-shrink-0">
                  <div className="w-24"><GpaBar value={s.gpa} /><p className="text-xs text-center mt-0.5" style={{ color: "#a4a097" }}>GPA</p></div>
                  <div className="text-center hidden md:block">
                    <div className="text-sm font-bold" style={{ color: "#0068FF" }}>{s.lastExamScore > 0 ? s.lastExamScore : "—"}</div>
                    <p className="text-xs" style={{ color: "#a4a097" }}>Điểm thi</p>
                  </div>
                  <div className="text-center hidden lg:block">
                    <div className="text-sm font-bold" style={{ color: "#7C3AED" }}>{s.completion}%</div>
                    <p className="text-xs" style={{ color: "#a4a097" }}>Tiến độ</p>
                  </div>
                </div>
              </div>
            );
          })}
          <div className="px-6 py-4 text-center" style={{ borderTop: "1px solid #e5e3df", background: "#f6f5f4" }}>
            <p className="text-xs" style={{ color: "#a4a097" }}>GPA = 40% tiến độ + 60% điểm thi · Cập nhật tự động từ DB</p>
          </div>
        </div>
      )}

      {/* Badges */}
      <div className="mb-10">
        <h2 className="text-xl font-bold mb-6 text-center" style={{ color: "#1a1a1a", letterSpacing: "-0.3px" }}>
          Badge <span style={{ color: "#b45309" }}>tháng này</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {badgesWithStudents.map(b => (
            <div key={b.id} className="rounded-xl p-5" style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ background: b.bg, border: `1px solid ${b.borderColor}` }}>{b.icon}</div>
                <div>
                  <p className="font-bold text-sm" style={{ color: "#1a1a1a" }}>{b.title}</p>
                  <p className="text-xs" style={{ color: "#a4a097" }}>{b.desc}</p>
                  <p className="text-xs font-semibold mt-0.5" style={{ color: b.color }}>{b.reward}</p>
                </div>
              </div>
              {b.students.length === 0 ? (
                <p className="text-xs text-center py-2" style={{ color: "#a4a097" }}>Chưa có học sinh đủ điều kiện</p>
              ) : (
                <div className="space-y-2">
                  {b.students.map((s, i) => (
                    <div key={s.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg"
                      style={{ background: b.bg, border: `1px solid ${b.borderColor}` }}>
                      <span className="text-xs font-bold w-5 flex-shrink-0" style={{ color: b.color }}>#{i + 1}</span>
                      <Avatar name={s.name} size={28} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate" style={{ color: "#1a1a1a" }}>{s.name}</p>
                        <p className="text-xs truncate" style={{ color: "#a4a097" }}>{s.school.split(",")[0]}</p>
                      </div>
                      <span className="text-xs font-bold flex-shrink-0" style={{ color: b.color }}>GPA {s.gpa.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="notion-hero-band rounded-xl p-8 sm:p-10 text-center">
        <div className="flex justify-center mb-3" style={{ color: "#FDE047" }}><Trophy size={40} /></div>
        <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Tên bạn sẽ xuất hiện ở đây!</h2>
        <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.7)" }}>
          Học chăm chỉ, nộp bài đầy đủ và chinh phục bảng vinh danh Midnight Elite.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/khoa-hoc" className="px-6 py-2.5 rounded-lg text-sm font-semibold"
            style={{ background: "#ffffff", color: "#0068FF", borderRadius: "8px" }}>
            Xem khoá học
          </Link>
          <Link href="/dang-ky" className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white"
            style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: "8px" }}>
            Tạo tài khoản miễn phí
          </Link>
        </div>
      </div>
    </>
  );
}

type Tab = "thi-thu" | "vinh-danh";

export default function BangXepHangPage() {
  const [tab, setTab] = useState<Tab>("thi-thu");

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-12 max-w-5xl mx-auto">
      <div className="text-center mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold mb-3" style={{ color: "#1a1a1a", letterSpacing: "-0.5px" }}>
          Bảng xếp hạng <span style={{ color: "#b45309" }}>&amp; Vinh danh</span>
        </h1>
        <p className="text-sm" style={{ color: "#787671" }}>
          Xếp hạng thi thử toàn server và vinh danh học sinh xuất sắc Midnight Elite
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 mb-10 p-1 rounded-lg w-fit mx-auto"
        style={{ background: "#f6f5f4", border: "1px solid #e5e3df" }}>
        <button onClick={() => setTab("thi-thu")}
          className="px-5 py-2 rounded-md text-sm font-medium transition-colors"
          style={tab === "thi-thu"
            ? { background: "#ffffff", color: "#1a1a1a", border: "1px solid #e5e3df" }
            : { color: "#787671" }}>
          Thi thử
        </button>
        <button onClick={() => setTab("vinh-danh")}
          className="px-5 py-2 rounded-md text-sm font-medium transition-colors"
          style={tab === "vinh-danh"
            ? { background: "#ffffff", color: "#1a1a1a", border: "1px solid #e5e3df" }
            : { color: "#787671" }}>
          Vinh danh Midnight Elite
        </button>
      </div>

      {tab === "thi-thu" ? <TabThiThu /> : <TabVinhDanh />}
    </div>
  );
}
