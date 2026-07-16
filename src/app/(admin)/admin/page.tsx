"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  UsersGroup, Wallet, CreditCard, BookOpen, Badge,
  Edit, Upload, NotificationAlert, ChartBar,
} from "griddy-icons";
import { useAuth, hasPermission, PERMISSIONS } from "@/contexts/AuthContext";

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface Analytics {
  totalRevenue:     number;
  totalEnrollments: number;
  totalCourses:     number;
  byCourse:         { name: string; revenue: number; enrollments: number }[];
  allEnrollments:   {
    id: string; userName: string; userPhone: string;
    courseName: string; amount: number; createdAt: string;
  }[];
}

interface ApiStudent {
  id:          string;
  name:        string;
  email:       string;
  phone:       string | null;
  sbd:         string;
  gpa:         number;
  completion:  number;
  enrollments: { courseId: string; courseName: string }[];
}

// ─── CALL MODAL ───────────────────────────────────────────────────────────────
function CallModal({ student, onClose }: { student: ApiStudent; onClose: () => void }) {
  const [copied,      setCopied]      = useState(false);
  const [showRemind,  setShowRemind]  = useState(false);
  const [remindMsg,   setRemindMsg]   = useState("");
  const [reminding,   setReminding]   = useState(false);
  const [remindSent,  setRemindSent]  = useState(false);
  const [remindError, setRemindError] = useState<string | null>(null);

  function copyPhone() {
    if (!student.phone) return;
    navigator.clipboard.writeText(student.phone.replace(/\s/g, "")).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const DEFAULT_MSG = `Xin chào ${student.name}, thầy/cô nhắc bạn nhớ duy trì tiến độ học tập nhé! Hãy vào hệ thống xem video và hoàn thành bài tập đầy đủ.`;

  async function sendRemind() {
    const msg = remindMsg.trim() || DEFAULT_MSG;
    setReminding(true);
    setRemindError(null);
    try {
      const res  = await fetch("/api/admin/remind", {
        method:      "POST",
        credentials: "same-origin",
        headers:     { "Content-Type": "application/json" },
        body:        JSON.stringify({ userId: student.id, message: msg }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setRemindSent(true);
        setShowRemind(false);
        setRemindMsg("");
        setTimeout(() => setRemindSent(false), 3000);
      } else {
        setRemindError(data.error ?? "Gửi thất bại, thử lại sau");
      }
    } catch {
      setRemindError("Lỗi kết nối");
    } finally {
      setReminding(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.45)" }}>
      <div className="rounded-3xl p-6 w-full max-w-sm mx-4"
        style={{ background: "#F0F5FF", boxShadow: "16px 16px 32px #C5D0EA, -16px -16px 32px #ffffff" }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-extrabold text-base" style={{ color: "#1E2938" }}>Liên hệ học sinh</h2>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors text-xl cursor-pointer"
            style={{ background: "#F0F5FF", boxShadow: "3px 3px 6px #C5D0EA, -3px -3px 6px #ffffff" }}>
            ×
          </button>
        </div>

        <div className="rounded-2xl p-4 mb-5"
          style={{ background: "#F0F5FF", boxShadow: "inset 4px 4px 8px #C5D0EA, inset -4px -4px 8px #ffffff" }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-extrabold text-xl flex-shrink-0"
              style={{ background: "linear-gradient(145deg, #FF2157, #cc0040)" }}>
              {student.name[0]}
            </div>
            <div>
              <p className="font-bold text-sm" style={{ color: "#1E2938" }}>{student.name}</p>
              <p className="text-xs font-mono" style={{ color: "#9CA3AF" }}>{student.sbd}</p>
            </div>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span style={{ color: "#6B7280" }}>GPA</span>
              <span className="font-bold" style={{ color: "#FF2157" }}>{student.gpa.toFixed(1)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span style={{ color: "#6B7280" }}>Tiến độ</span>
              <span className="font-bold" style={{ color: "#FE9900" }}>{Math.round(student.completion)}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span style={{ color: "#6B7280" }}>Email</span>
              <span style={{ color: "#0068FF" }}>{student.email}</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl px-4 py-3 mb-4 flex items-center justify-between"
          style={{ background: "#F0F5FF", boxShadow: "inset 3px 3px 6px #C5D0EA, inset -3px -3px 6px #ffffff" }}>
          <div>
            <p className="text-xs font-medium mb-0.5" style={{ color: "#6B7280" }}>Số điện thoại</p>
            <p className="text-lg font-extrabold tracking-wide" style={{ color: "#1E2938" }}>
              {student.phone ?? "Chưa có"}
            </p>
          </div>
          {student.phone && (
            <button onClick={copyPhone}
              className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
              style={copied
                ? { background: "#dcfce7", color: "#166534" }
                : { background: "#F0F5FF", boxShadow: "3px 3px 6px #C5D0EA, -3px -3px 6px #ffffff", color: "#0068FF" }}>
              {copied ? "✓ Đã sao chép" : "Sao chép"}
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => setShowRemind(v => !v)}
            className="flex items-center justify-center py-3 rounded-2xl text-sm font-bold cursor-pointer transition-all duration-150 hover:brightness-110 active:scale-[0.98]"
            style={showRemind
              ? { background: "#FFF7ED", color: "#FE9900", border: "1px solid rgba(254,153,0,0.4)" }
              : { background: "linear-gradient(135deg, #FE9900, #E07800)", color: "white" }}>
            Nhắc nhở
          </button>
          <Link href="/admin/hoc-sinh" onClick={onClose}
            className="flex items-center justify-center py-3 rounded-2xl text-sm font-bold transition-all duration-150 hover:bg-red-50 active:scale-[0.98]"
            style={{ background: "transparent", border: "1.5px solid #FF2157", color: "#FF2157" }}>
            Xem hồ sơ
          </Link>
        </div>

        {remindSent ? (
          <div className="mt-3 py-2.5 rounded-2xl text-xs font-semibold text-center"
            style={{ background: "#d1fae5", color: "#065f46" }}>
            ✓ Đã gửi nhắc nhở qua email
          </div>
        ) : showRemind && (
          <div className="mt-3 space-y-2">
            <textarea rows={3} value={remindMsg} onChange={e => { setRemindMsg(e.target.value); setRemindError(null); }}
              placeholder={DEFAULT_MSG}
              className="w-full px-3 py-2.5 rounded-xl text-xs outline-none resize-none"
              style={{ background: "#F0F5FF", boxShadow: "inset 3px 3px 6px #C5D0EA, inset -3px -3px 6px #ffffff", border: "none", color: "#1E2938" }} />
            {remindError && (
              <p className="text-xs font-semibold text-center" style={{ color: "#dc2626" }}>
                ✗ {remindError}
              </p>
            )}
            <button onClick={sendRemind} disabled={reminding}
              className="w-full py-2.5 rounded-xl text-xs font-bold text-white disabled:opacity-60 cursor-pointer transition-all duration-150 hover:brightness-110 active:scale-[0.98]"
              style={{ background: "linear-gradient(135deg, #FE9900, #E07800)" }}>
              {reminding ? "Đang gửi..." : "Gửi nhắc nhở qua email"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const QUICK_ACTIONS = [
  { label: "Thêm khóa học",  Icon: BookOpen, href: "/admin/khoa-hoc"  },
  { label: "Đăng vinh danh", Icon: Badge,    href: "/admin/vinh-danh" },
  { label: "Hồ sơ học sinh", Icon: Edit,     href: "/admin/hoc-sinh"  },
  { label: "Doanh thu",      Icon: Upload,   href: "/admin/doanh-thu" },
];

const BULK_DEFAULT = "Xin chào các bạn học viên, thầy/cô nhắc nhở các bạn duy trì tiến độ học tập đều đặn nhé! Hãy vào hệ thống xem video bài giảng và hoàn thành bài tập đúng hạn.";

// ─── PAGE ─────────────────────────────────────────────────────────────────────
export default function AdminDashboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const isSuper         = user?.adminRole === "admin_super";
  const isTeacher       = user?.adminRole === "teacher";
  const canViewRevenue  = hasPermission(user, PERMISSIONS.VIEW_REVENUE);
  const canViewStudents = hasPermission(user, PERMISSIONS.VIEW_STUDENTS);

  const [analytics,      setAnalytics]      = useState<Analytics | null>(null);
  const [students,       setStudents]       = useState<ApiStudent[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [callTarget,     setCallTarget]     = useState<ApiStudent | null>(null);
  const [showBulkRemind, setShowBulkRemind] = useState(false);
  const [bulkMsg,        setBulkMsg]        = useState("");
  const [bulkSending,    setBulkSending]    = useState(false);
  const [bulkToast,      setBulkToast]      = useState<string | null>(null);

  useEffect(() => {
    // Chờ auth xong mới fetch — tránh double fetch khi user từ null → có giá trị
    if (authLoading) return;

    async function load() {
      setLoading(true);
      try {
        const calls: Promise<Response>[] = [
          ...(canViewStudents ? [fetch("/api/admin/students", { credentials: "same-origin" })] : []),
          ...(canViewRevenue ? [fetch("/api/admin/analytics", { credentials: "same-origin" })] : []),
        ];
        const results = await Promise.all(calls);
        if (canViewStudents) {
          const studentsData = results[0].ok ? await results[0].json() : [];
          setStudents(Array.isArray(studentsData) ? studentsData : []);
        }
        const analyticsIdx = canViewStudents ? 1 : 0;
        if (canViewRevenue && results[analyticsIdx]?.ok) {
          setAnalytics(await results[analyticsIdx].json());
        }
      } catch {
        // dashboard is best-effort
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [authLoading, canViewRevenue, canViewStudents]);

  // Chỉ hiện học sinh thực sự cần can thiệp (GPA < 7), tối đa 4
  const dangerStudents = useMemo(() =>
    students.filter(s => s.gpa < 7).sort((a, b) => a.gpa - b.gpa).slice(0, 4),
  [students]);

  const chartMax = useMemo(() =>
    Math.max(...(analytics?.byCourse ?? []).map(c => c.enrollments), 1),
  [analytics]);

  const recentEnrollments = useMemo(() =>
    (analytics?.allEnrollments ?? []).slice(0, 4),
  [analytics]);

  const avgGpa = useMemo(() =>
    students.length === 0 ? 0 : students.reduce((s, u) => s + u.gpa, 0) / students.length,
  [students]);

  const activatedCount = useMemo(() => students.filter(s => s.enrollments.length > 0).length, [students]);
  const inactiveCount  = useMemo(() => students.length - activatedCount, [students, activatedCount]);
  const lowGpaCount    = useMemo(() => students.filter(s => s.gpa < 7).length, [students]);

  const studentSub = `${activatedCount} học viên · ${inactiveCount} chưa kích hoạt`;

  const healthCards = useMemo(() => canViewRevenue
    // Super admin: 4 cards
    ? [
        { label: "Tổng học sinh",        value: String(students.length),                                              sub: studentSub,  color: "#0068FF", Icon: UsersGroup      },
        { label: "Lượt kích hoạt khoá",  value: String(analytics?.totalEnrollments ?? "—"),                           sub: undefined,   color: "#0EA5E9", Icon: BookOpen        },
        { label: "Khoá học có học viên", value: String(analytics?.totalCourses ?? "—"),                               sub: undefined,   color: "#00A63D", Icon: Badge           },
        {
          label: "Tổng doanh thu",
          value: analytics ? `${(analytics.totalRevenue / 1_000_000).toFixed(1)}Mđ` : "—",
          sub:   undefined,
          color: "#FE9900",
          Icon:  Wallet,
        },
      ]
    // Content admin: 2 cards từ students
    : [
        { label: "Tổng học sinh",       value: String(students.length),                          sub: studentSub,  color: "#0068FF", Icon: UsersGroup      },
        { label: "Cần chú ý (GPA < 7)", value: String(lowGpaCount),  sub: undefined,   color: "#FF2157", Icon: NotificationAlert },
      ],
  [canViewRevenue, students, analytics, studentSub]);


  async function sendBulkRemind() {
    const msg = bulkMsg.trim() || BULK_DEFAULT;
    setBulkSending(true);
    try {
      const res = await fetch("/api/admin/remind-all", {
        method:      "POST",
        credentials: "same-origin",
        headers:     { "Content-Type": "application/json" },
        body:        JSON.stringify({ message: msg }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setBulkToast(`✓ Đã gửi nhắc nhở tới ${data.sent}/${data.total} học viên`);
        setShowBulkRemind(false);
        setBulkMsg("");
        setTimeout(() => setBulkToast(null), 4000);
      } else {
        setBulkToast(`✗ ${data.error ?? "Lỗi gửi"}`);
        setTimeout(() => setBulkToast(null), 3000);
      }
    } catch {
      setBulkToast("✗ Lỗi kết nối");
      setTimeout(() => setBulkToast(null), 3000);
    } finally {
      setBulkSending(false);
    }
  }

  return (
    <div className="space-y-6 overflow-y-auto" style={{ height: "calc(100vh - 104px)" }}>
      {callTarget && <CallModal student={callTarget} onClose={() => setCallTarget(null)} />}
      {bulkToast && (
        <div className="fixed top-4 right-4 z-[200] px-4 py-3 rounded-xl text-sm font-semibold text-white shadow-xl"
          style={{ background: bulkToast.startsWith("✓") ? "#16a34a" : "#dc2626" }}>
          {bulkToast}
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold" style={{ color: "#1E2938" }}>Tổng quan quản trị</h1>
          <p className="text-sm mt-1" style={{ color: "#6B7280" }}>Tổng quan sức khỏe hệ thống</p>
        </div>
        <div className="px-3 py-1.5 rounded-full text-xs font-bold"
          style={isSuper
            ? { background: "rgba(254,153,0,0.12)", color: "#FE9900", border: "1px solid rgba(254,153,0,0.3)" }
            : isTeacher
            ? { background: "rgba(22,163,74,0.12)", color: "#16a34a", border: "1px solid rgba(22,163,74,0.3)" }
            : { background: "rgba(96,165,250,0.12)", color: "#60A5FA", border: "1px solid rgba(96,165,250,0.3)" }}>
          {isSuper ? "Cấp 1 - Super Admin" : isTeacher ? "Giáo viên" : "Cấp 2 - Content Admin"}
        </div>
      </div>

      {/* ── Health cards ────────────────────────────────────────────────────── */}
      <div className={`grid gap-4 ${canViewRevenue ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-2"}`}>
        {healthCards.map(card => (
          <div key={card.label} className="rounded-2xl p-5"
            style={{ background: "#F0F5FF", boxShadow: "8px 8px 16px #C5D0EA, -8px -8px 16px #ffffff" }}>
            <div className="mb-3">
              <card.Icon size={22} style={{ color: card.color }} />
            </div>
            {loading ? (
              <div className="h-7 w-16 rounded animate-pulse mb-1" style={{ background: "#E2E8F4" }} />
            ) : (
              <div className="text-2xl font-extrabold mb-1" style={{ color: card.color }}>{card.value}</div>
            )}
            <div className="text-xs" style={{ color: "#6B7280" }}>{card.label}</div>
            {!loading && card.sub && (
              <div className="text-xs mt-1.5" style={{ color: "#9CA3AF" }}>{card.sub}</div>
            )}
          </div>
        ))}
      </div>

      {/* ── Charts row ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top khoá học theo enrollment */}
        <div className="rounded-2xl p-6" style={{ background: "#F0F5FF", boxShadow: "8px 8px 16px #C5D0EA, -8px -8px 16px #ffffff" }}>
          <h2 className="text-base font-bold mb-5 flex items-center gap-2" style={{ color: "#1E2938" }}>
            <ChartBar size={18} /> Khoá học phổ biến
          </h2>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-7 rounded-xl animate-pulse" style={{ background: "#E2E8F4" }} />
              ))}
            </div>
          ) : (analytics?.byCourse ?? []).length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: "#9CA3AF" }}>
              {canViewRevenue ? "Chưa có dữ liệu" : "Không có quyền xem"}
            </p>
          ) : (
            <div className="space-y-3">
              {(analytics?.byCourse ?? []).slice(0, 5).map(c => (
                <div key={c.name} className="flex items-center gap-3">
                  <div className="w-32 flex-shrink-0 text-xs truncate" style={{ color: "#1E2938" }}>{c.name}</div>
                  <div className="flex-1 h-2 rounded-full"
                    style={{ background: "#F0F5FF", boxShadow: "inset 2px 2px 4px #C5D0EA,inset -2px -2px 4px #ffffff" }}>
                    <div className="h-2 rounded-full"
                      style={{ width: `${(c.enrollments / chartMax * 100).toFixed(1)}%`, background: "linear-gradient(90deg,#0068FF,#2680FF)" }} />
                  </div>
                  <div className="w-14 text-right flex-shrink-0 text-xs font-bold" style={{ color: "#0068FF" }}>
                    {c.enrollments} HV
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Kích hoạt gần đây (admin cấp 1) hoặc Thống kê học sinh (admin cấp 2) */}
        {canViewRevenue ? (
          <div className="rounded-2xl p-6" style={{ background: "#F0F5FF", boxShadow: "8px 8px 16px #C5D0EA, -8px -8px 16px #ffffff" }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold flex items-center gap-2" style={{ color: "#1E2938" }}>
                <CreditCard size={18} /> Kích hoạt gần đây
              </h2>
              <Link href="/admin/doanh-thu" className="text-xs font-semibold" style={{ color: "#0068FF" }}>
                Xem tất cả →
              </Link>
            </div>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: "#E2E8F4" }} />
                ))}
              </div>
            ) : recentEnrollments.length === 0 ? (
              <p className="text-sm text-center py-6" style={{ color: "#9CA3AF" }}>Chưa có giao dịch</p>
            ) : (
              <div className="space-y-2">
                {recentEnrollments.map(e => (
                  <div key={e.id} className="grid grid-cols-12 items-center px-3 py-2.5 rounded-xl"
                    style={{ background: "#F0F5FF", boxShadow: "inset 2px 2px 4px #C5D0EA, inset -2px -2px 4px #ffffff" }}>
                    <div className="col-span-5">
                      <div className="text-xs font-medium truncate" style={{ color: "#1E2938" }}>{e.userName}</div>
                      <div className="text-xs" style={{ color: "#9CA3AF" }}>{e.createdAt.slice(0, 10)}</div>
                    </div>
                    <div className="col-span-4 text-xs truncate px-1" style={{ color: "#4B5563" }}>{e.courseName}</div>
                    <div className="col-span-3 text-right text-xs font-bold" style={{ color: "#0068FF" }}>
                      {(e.amount / 1_000_000).toFixed(1)}Mđ
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl p-6" style={{ background: "#F0F5FF", boxShadow: "8px 8px 16px #C5D0EA, -8px -8px 16px #ffffff" }}>
            <h2 className="text-base font-bold mb-5" style={{ color: "#1E2938" }}>Thống kê học sinh</h2>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: "#E2E8F4" }} />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {[
                  { label: "Học viên đã kích hoạt",  value: String(activatedCount),                                    color: "#0068FF" },
                  { label: "Chưa kích hoạt khoá",    value: String(inactiveCount),                                     color: "#6B7280" },
                  { label: "GPA trung bình",          value: students.length ? avgGpa.toFixed(1) : "—",                color: "#0EA5E9" },
                  { label: "Cần chú ý (GPA < 7)",    value: String(lowGpaCount),                                       color: "#FF2157" },
                ].map(row => (
                  <div key={row.label} className="flex justify-between items-center py-3 px-4 rounded-xl"
                    style={{ background: "#F0F5FF", boxShadow: "inset 2px 2px 4px #C5D0EA, inset -2px -2px 4px #ffffff" }}>
                    <span className="text-sm" style={{ color: "#4B5563" }}>{row.label}</span>
                    <span className="font-bold text-sm" style={{ color: row.color }}>{row.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Danger Zone ─────────────────────────────────────────────────────── */}
      {canViewStudents && (
      <div className="rounded-2xl p-6" style={{ background: "#F0F5FF", boxShadow: "8px 8px 16px #C5D0EA, -8px -8px 16px #ffffff" }}>
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <h2 className="text-base font-bold flex items-center gap-2" style={{ color: "#1E2938" }}>
            <NotificationAlert size={18} style={{ color: "#FF2157" }} />
            Học sinh cần can thiệp: GPA thấp nhất
          </h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowBulkRemind(v => !v)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all"
              style={showBulkRemind
                ? { background: "#FFF7ED", color: "#FE9900", border: "1px solid rgba(254,153,0,0.4)" }
                : { background: "linear-gradient(135deg,#FE9900,#E07800)", color: "white" }}>
              Nhắc nhở tất cả
            </button>
            <Link href="/admin/hoc-sinh" className="text-xs font-semibold" style={{ color: "#0068FF" }}>
              Xem tất cả →
            </Link>
          </div>
        </div>

        {/* Bulk remind form */}
        {showBulkRemind && (
          <div className="mb-5 p-4 rounded-2xl space-y-2" style={{ background: "#FFF7ED", border: "1px solid rgba(254,153,0,0.2)" }}>
            <p className="text-xs font-semibold" style={{ color: "#92400e" }}>
              Gửi tới <strong>toàn bộ {students.length} học sinh</strong> trong hệ thống (không chỉ nhóm GPA thấp)
            </p>
            <textarea rows={3} value={bulkMsg} onChange={e => setBulkMsg(e.target.value)}
              placeholder={BULK_DEFAULT}
              className="w-full px-3 py-2.5 rounded-xl text-xs outline-none resize-none"
              style={{ background: "#F0F5FF", boxShadow: "inset 3px 3px 6px #C5D0EA,inset -3px -3px 6px #ffffff", border: "none", color: "#1E2938" }} />
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowBulkRemind(false); setBulkMsg(""); }}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold cursor-pointer"
                style={{ background: "#F0F5FF", boxShadow: "3px 3px 6px #C5D0EA,-3px -3px 6px #ffffff", color: "#6B7280" }}>
                Hủy
              </button>
              <button onClick={sendBulkRemind} disabled={bulkSending}
                className="px-4 py-1.5 rounded-xl text-xs font-bold text-white disabled:opacity-60 cursor-pointer transition-all duration-150 hover:brightness-110 active:scale-[0.98]"
                style={{ background: "linear-gradient(135deg,#FE9900,#E07800)" }}>
                {bulkSending ? "Đang gửi..." : `Gửi tới tất cả (${students.length} học sinh)`}
              </button>
            </div>
          </div>
        )}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 rounded-2xl animate-pulse" style={{ background: "#E2E8F4" }} />
            ))}
          </div>
        ) : dangerStudents.length === 0 ? (
          <p className="text-sm text-center py-6" style={{ color: "#9CA3AF" }}>
            Tất cả học sinh đều ổn, không ai có GPA dưới 7
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {dangerStudents.map(s => (
              <div key={s.id} className="flex items-center justify-between p-4 rounded-2xl"
                style={{ background: "#F0F5FF", boxShadow: "inset 3px 3px 6px #C5D0EA, inset -3px -3px 6px #ffffff" }}>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm" style={{ color: "#1E2938" }}>{s.name}</div>
                  <div className="text-xs mt-0.5 flex items-center gap-2" style={{ color: "#9CA3AF" }}>
                    <span className="font-mono">{s.sbd}</span>
                    <span>·</span>
                    <span>GPA: <strong style={{ color: s.gpa < 6 ? "#FF2157" : "#FE9900" }}>{s.gpa.toFixed(1)}</strong></span>
                    <span>·</span>
                    <span>{Math.round(s.completion)}% hoàn thành</span>
                  </div>
                </div>
                <button onClick={() => setCallTarget(s)}
                  className="ml-3 flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-all hover:-translate-y-0.5 cursor-pointer"
                  style={{ background: "linear-gradient(135deg, #FF2157, #CC0033)" }}>
                  Liên hệ
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      {/* ── Quick Actions ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {QUICK_ACTIONS.map(a => (
          <Link key={a.label} href={a.href}
            className="flex flex-col items-center gap-2 p-4 rounded-2xl text-center transition-all hover:-translate-y-0.5 cursor-pointer"
            style={{ background: "#F0F5FF", boxShadow: "6px 6px 12px #C5D0EA, -6px -6px 12px #ffffff", color: "#1E2938" }}>
            <a.Icon size={24} style={{ color: "#0068FF" }} />
            <span className="text-xs font-semibold">{a.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
