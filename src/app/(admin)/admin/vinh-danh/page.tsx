"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import PermissionGuard from "@/components/PermissionGuard";
import { PERMISSIONS } from "@/contexts/AuthContext";
import { BADGE_RULES, computeRankings, type HonorStudent, type SortKey } from "@/lib/honorData";
import { GpaBar } from "@/components/GpaBar";

// TABS ngoài component — tránh recreate mỗi render
const TABS = [
  { id: "leaderboard" as const, label: "Bảng xếp hạng" },
  { id: "badges"      as const, label: "Trao Badge" },
  { id: "import"      as const, label: "Import điểm thi" },
] as const;

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function RankMedal({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-xl leading-none">🥇</span>;
  if (rank === 2) return <span className="text-xl leading-none">🥈</span>;
  if (rank === 3) return <span className="text-xl leading-none">🥉</span>;
  return <span className="text-sm font-bold text-gray-400 w-6 text-center">#{rank}</span>;
}

function Toast({ msg, type }: { msg: string; type: "success" | "error" | "info" }) {
  const bg = type === "success" ? "#16a34a" : type === "error" ? "#dc2626" : "#0055D4";
  return (
    <div className="fixed top-4 right-4 z-[200] px-4 py-3 rounded-xl text-sm font-semibold text-white shadow-xl flex items-center gap-2"
      style={{ background: bg }}>
      {type === "success" ? "✓" : type === "error" ? "✗" : "ℹ"} {msg}
    </div>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────
export default function VinhDanhPage() {
  const [sortKey, setSortKey]   = useState<SortKey>("gpa");
  const [grantedBadges, setGrantedBadges] = useState<Set<string>>(new Set());
  const [toast, setToast]       = useState<{ msg: string; type: "success" | "error" | "info" } | null>(null);
  const [activeTab, setActiveTab] = useState<"leaderboard" | "badges" | "import">("leaderboard");
  const [importFile, setImportFile] = useState<string | null>(null);
  const [importedExam, setImportedExam] = useState("");
  const [importedDate, setImportedDate] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const [students, setStudents] = useState<HonorStudent[]>([]);
  const [loading, setLoading]   = useState(true);

  const loadStudents = useCallback(async () => {
    setLoading(true);
    const [studentsData, badgesData] = await Promise.all([
      fetch("/api/honor-leaderboard", { credentials: "same-origin" })
        .then(r => r.ok ? r.json() : []).catch(() => []),
      fetch("/api/admin/badges", { credentials: "same-origin" })
        .then(r => r.ok ? r.json() : []).catch(() => []),
    ]);
    setStudents(studentsData);
    // Reconstruct grantedBadges from DB: "userId:badgeId" set
    const granted = new Set<string>(
      (badgesData as { userId: string; badgeId: string }[]).map(b => `${b.userId}:${b.badgeId}`)
    );
    setGrantedBadges(granted);
    setLoading(false);
  }, []);

  useEffect(() => { loadStudents(); }, [loadStudents]);

  function showToast(msg: string, type: "success" | "error" | "info" = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  const ranked = useMemo(() => computeRankings(students, sortKey), [students, sortKey]);

  const badgesWithStudents = useMemo(() =>
    BADGE_RULES.map(rule => ({ ...rule, students: students.filter(rule.check) })),
  [students]);

  async function grantBadge(badgeId: string, badgeTitle: string, studentIds: string[]) {
    await Promise.all(studentIds.map(userId =>
      fetch("/api/admin/badges", {
        method:      "POST",
        credentials: "same-origin",
        headers:     { "Content-Type": "application/json" },
        body:        JSON.stringify({ userId, badgeId }),
      })
    ));
    setGrantedBadges(prev => {
      const next = new Set(prev);
      studentIds.forEach(uid => next.add(`${uid}:${badgeId}`));
      return next;
    });
    showToast(`Đã cấp "${badgeTitle}" cho ${studentIds.length} học sinh`, "success");
  }

  async function grantAllBadges() {
    const eligible = badgesWithStudents.filter(b => b.students.length > 0);
    await Promise.all(
      eligible.flatMap(b => b.students.map(s =>
        fetch("/api/admin/badges", {
          method:      "POST",
          credentials: "same-origin",
          headers:     { "Content-Type": "application/json" },
          body:        JSON.stringify({ userId: s.id, badgeId: b.id }),
        })
      ))
    );
    setGrantedBadges(prev => {
      const next = new Set(prev);
      eligible.forEach(b => b.students.forEach(s => next.add(`${s.id}:${b.id}`)));
      return next;
    });
    const total = eligible.reduce((a, b) => a + b.students.length, 0);
    showToast(`Đã cấp toàn bộ badge, ${total} lượt trao`, "success");
  }

  function handleImport() {
    if (!importedExam) { showToast("Chọn kỳ thi trước khi import", "error"); return; }
    if (!importedDate) { showToast("Chọn ngày thi trước khi import", "error"); return; }
    if (!importFile)   { showToast("Chọn file CSV trước khi import", "error"); return; }
    showToast("Tính năng import CSV đang phát triển. Kết quả sẽ được thêm thủ công qua API.", "info");
  }

  const eligible = useMemo(() =>
    students.filter(s => s.gpa >= 7.0 && s.strikes === 0).length,
  [students]);

  const badgesGranted = useMemo(() =>
    [...grantedBadges].filter(k => k.includes(":")).length,
  [grantedBadges]);

  return (
    <PermissionGuard required={PERMISSIONS.MANAGE_HONOR}>
      <div className="space-y-5 overflow-y-auto" style={{ height: "calc(100vh - 104px)" }}>
        {toast && <Toast msg={toast.msg} type={toast.type} />}

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-extrabold" style={{ color: "#1E2938" }}>Bảng Vinh Danh</h1>
            <p className="text-sm mt-1" style={{ color: "#6B7280" }}>
              Xếp hạng tự động từ DB · Trao badge · Hiển thị tại{" "}
              <a href="/bang-xep-hang" target="_blank" className="font-semibold underline" style={{ color: "#0068FF" }}>/bang-xep-hang</a>
            </p>
          </div>
          <div className="px-3 py-1.5 rounded-full text-xs font-semibold"
            style={{ background: "#DCFCE7", color: "#166534", border: "1px solid #bbf7d0" }}>
            Đang hiển thị trên website
          </div>
        </div>

        {/* Stats compact inline */}
        <div className="flex items-center gap-5 flex-wrap">
          {[
            { label: "Tổng học sinh",      value: students.length,            color: "#0068FF" },
            { label: "Đủ điều kiện",       value: eligible,                   color: "#16a34a" },
            { label: "Vinh danh (Top 3)",  value: Math.min(3, students.length), color: "#FE9900" },
            { label: "Badge đã trao",      value: badgesGranted,              color: "#7C3AED" },
          ].map((s, i) => (
            <div key={s.label} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-gray-300 mr-2">|</span>}
              <span className="text-lg font-extrabold" style={{ color: s.color }}>{s.value}</span>
              <span className="text-xs" style={{ color: "#6B7280" }}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-2xl" style={{ background: "#F0F5FF", boxShadow: "inset 3px 3px 6px #C5D0EA, inset -3px -3px 6px #ffffff" }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 active:scale-[0.97] cursor-pointer"
              style={activeTab === tab.id
                ? { background: "linear-gradient(135deg, #0068FF, #0052DD)", color: "white" }
                : { color: "#6B7280" }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ─── TAB: LEADERBOARD ────────────────────────────────────────────── */}
        {activeTab === "leaderboard" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-xs font-semibold" style={{ color: "#4B5563" }}>Xếp theo:</label>
              <div className="flex gap-1">
                {([
                  { key: "gpa"           as SortKey, label: "GPA" },
                  { key: "completion"    as SortKey, label: "Tiến độ" },
                  { key: "lastExamScore" as SortKey, label: "Điểm thi" },
                ]).map(opt => (
                  <button key={opt.key} onClick={() => setSortKey(opt.key)}
                    className="px-3 py-1.5 text-xs rounded-lg font-semibold transition-all"
                    style={sortKey === opt.key
                      ? { background: "linear-gradient(135deg, #0068FF, #0052DD)", color: "white" }
                      : { background: "#F0F5FF", border: "1px solid rgba(197,208,234,0.8)", color: "#6B7280" }}>
                    {opt.label}
                  </button>
                ))}
              </div>
              <button onClick={loadStudents}
                className="ml-auto px-3 py-1.5 text-xs rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50 transition-colors cursor-pointer">
                ↺ Tải lại
              </button>
            </div>

            {loading && (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="rounded-2xl p-4 animate-pulse" style={{ background: "#F0F5FF", height: 72 }} />
                ))}
              </div>
            )}

            {!loading && ranked.length === 0 && (
              <div className="text-center py-16 rounded-2xl" style={{ background: "#F0F5FF", boxShadow: "6px 6px 12px #C5D0EA,-6px -6px 12px #ffffff" }}>
                <p className="text-sm" style={{ color: "#9CA3AF" }}>Chưa có học sinh nào có hoạt động trong hệ thống.</p>
                <p className="text-xs mt-1" style={{ color: "#C5D0EA" }}>GPA được tính từ tiến độ học + điểm thi thử.</p>
              </div>
            )}

            <div className="space-y-2">
              {ranked.map(s => {
                const badges = badgesWithStudents.filter(b => b.check(s));
                return (
                  <div key={s.id} className="rounded-2xl p-4"
                    style={{ background: "#F0F5FF", boxShadow: "6px 6px 12px #C5D0EA, -6px -6px 12px #ffffff" }}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 flex-shrink-0 flex justify-center">
                        <RankMedal rank={s.rank} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm" style={{ color: "#1E2938" }}>{s.name}</span>
                          {badges.map(b => (
                            <span key={b.id} className="px-1.5 py-0.5 text-xs rounded-full font-bold"
                              style={{ background: b.bg, color: b.color, border: `1px solid ${b.borderColor}` }}>
                              {b.icon}
                            </span>
                          ))}
                        </div>
                        <div className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>
                          {s.school}
                        </div>
                      </div>
                      <div className="hidden sm:flex items-center gap-6 flex-shrink-0">
                        <div className="text-center">
                          <div className="w-20"><GpaBar value={s.gpa} /></div>
                          <div className="text-xs text-gray-400 mt-0.5">GPA</div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm font-bold" style={{ color: "#0068FF" }}>
                            {s.lastExamScore > 0 ? s.lastExamScore : "—"}
                          </div>
                          <div className="text-xs text-gray-400">Điểm thi</div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm font-bold" style={{ color: "#7C3AED" }}>{s.completion}%</div>
                          <div className="text-xs text-gray-400">Tiến độ</div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="text-xs text-center" style={{ color: "#9CA3AF" }}>
              GPA = 40% tiến độ + 60% điểm thi · Tự động cập nhật từ DB
            </p>
          </div>
        )}

        {/* ─── TAB: BADGES ─────────────────────────────────────────────────── */}
        {activeTab === "badges" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm" style={{ color: "#6B7280" }}>
                Hệ thống tự xác định học sinh đủ điều kiện. Badge được ghi nhận trong phiên này.
              </p>
              <button onClick={grantAllBadges}
                className="px-4 py-2 rounded-xl text-sm font-bold text-white cursor-pointer transition-all duration-150 hover:-translate-y-0.5 active:scale-[0.98]"
                style={{ background: "linear-gradient(135deg, #FE9900, #E07800)" }}>
                Cấp tất cả badge
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {badgesWithStudents.map(b => {
                const granted = b.students.length > 0 && b.students.every(s => grantedBadges.has(`${s.id}:${b.id}`));
                return (
                  <div key={b.id} className="rounded-2xl p-5 space-y-4"
                    style={{ background: "#F0F5FF", boxShadow: granted ? "inset 4px 4px 8px #C5D0EA, inset -4px -4px 8px #ffffff" : "8px 8px 16px #C5D0EA, -8px -8px 16px #ffffff", outline: granted ? `2px solid ${b.color}` : "none" }}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-2xl">{b.icon}</span>
                          <span className="font-bold text-sm" style={{ color: "#1E2938" }}>{b.title}</span>
                          {granted && <span className="px-1.5 py-0.5 text-xs rounded-full font-bold" style={{ background: "#dcfce7", color: "#166534" }}>✓ Đã cấp</span>}
                        </div>
                        <p className="text-xs" style={{ color: "#6B7280" }}><strong>Điều kiện:</strong> {b.desc}</p>
                        <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}><strong>Phần thưởng:</strong> {b.reward}</p>
                      </div>
                      <button
                        onClick={() => grantBadge(b.id, b.title, b.students.map(s => s.id))}
                        disabled={b.students.length === 0 || granted}
                        className="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-all disabled:opacity-40 cursor-pointer"
                        style={{ background: granted ? "#9CA3AF" : `linear-gradient(145deg, ${b.color}, ${b.color}cc)` }}>
                        {granted ? "Đã cấp" : `Cấp (${b.students.length})`}
                      </button>
                    </div>
                    <div className="space-y-1.5">
                      {b.students.length === 0 ? (
                        <p className="text-xs text-center py-3" style={{ color: "#9CA3AF" }}>
                          {b.id === "cai-thien"
                            ? "Cần dữ liệu lịch sử theo tháng (tính năng sắp có)"
                            : "Chưa có học sinh đủ điều kiện"}
                        </p>
                      ) : (
                        b.students.map((s, i) => (
                          <div key={s.id} className="flex items-center gap-2.5 px-3 py-2 rounded-xl"
                            style={{ background: b.bg, border: `1px solid ${b.borderColor}` }}>
                            <span className="text-xs font-bold w-4" style={{ color: b.color }}>#{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <span className="text-xs font-semibold" style={{ color: "#1E2938" }}>{s.name}</span>
                            </div>
                            <span className="text-xs font-bold" style={{ color: b.color }}>GPA {s.gpa.toFixed(1)}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── TAB: IMPORT ─────────────────────────────────────────────────── */}
        {activeTab === "import" && (
          <div className="space-y-4">
            <div className="rounded-2xl p-5" style={{ background: "#F0F5FF", boxShadow: "8px 8px 16px #C5D0EA, -8px -8px 16px #ffffff" }}>
              <h3 className="font-bold text-sm mb-1" style={{ color: "#1E2938" }}>Import điểm từ kỳ thi bên ngoài (Azota)</h3>
              <p className="text-xs mb-1" style={{ color: "#6B7280" }}>
                Import kết quả thi từ Azota vào hệ thống. Điểm sẽ cập nhật bảng xếp hạng.
              </p>
              <div className="px-3 py-2 rounded-xl text-xs mb-4" style={{ background: "#FEF3C7", border: "1px solid #FDE68A", color: "#92400E" }}>
                ⚠️ Tính năng import CSV đang phát triển. Hiện tại nhập điểm thủ công qua trang quản lý Thi thử.
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "#4B5563" }}>Kỳ thi</label>
                  <input type="text" value={importedExam} onChange={e => setImportedExam(e.target.value)}
                    placeholder="VD: ĐGNL HSA Mock #5"
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: "#F0F5FF", boxShadow: "inset 3px 3px 6px #C5D0EA, inset -3px -3px 6px #ffffff", border: "none", color: "#1E2938" }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "#4B5563" }}>Ngày thi</label>
                  <input type="date" value={importedDate} onChange={e => setImportedDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: "#F0F5FF", boxShadow: "inset 3px 3px 6px #C5D0EA, inset -3px -3px 6px #ffffff", border: "none", color: "#1E2938" }} />
                </div>
              </div>
              <div
                className="border-2 border-dashed rounded-2xl p-8 text-center mb-4 cursor-pointer transition-all hover:border-blue-400"
                style={{ borderColor: importFile ? "#0068FF" : "#C5D0EA" }}
                onClick={() => fileRef.current?.click()}>
                {importFile ? (
                  <>
                    <div className="text-sm font-semibold mb-1" style={{ color: "#0068FF" }}>{importFile}</div>
                    <p className="text-xs" style={{ color: "#9CA3AF" }}>Click để chọn file khác</p>
                  </>
                ) : (
                  <>
                    <div className="text-3xl mb-2 font-light" style={{ color: "#C5D0EA" }}>↑</div>
                    <p className="text-sm font-semibold mb-1" style={{ color: "#1E2938" }}>Kéo thả file CSV vào đây</p>
                    <p className="text-xs mb-3" style={{ color: "#9CA3AF" }}>hoặc click để chọn từ máy tính</p>
                  </>
                )}
                <input ref={fileRef} type="file" accept=".csv,.xlsx" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) setImportFile(f.name); }} />
              </div>
              <button onClick={handleImport}
                className="w-full py-3 rounded-xl text-sm font-bold text-white cursor-pointer transition-all duration-150 hover:brightness-110 active:scale-[0.98]"
                style={{ background: "linear-gradient(135deg, #0068FF, #0052DD)" }}>
                {importFile ? "Import (Đang phát triển)" : "Chọn file CSV / Excel"}
              </button>
            </div>
          </div>
        )}
      </div>
    </PermissionGuard>
  );
}
