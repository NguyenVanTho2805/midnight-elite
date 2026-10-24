"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  UsersGroup, Wallet, CreditCard, BookOpen, Badge,
  Edit, Upload, NotificationAlert, ChartBar,
} from "griddy-icons";
import { useAuth, hasPermission, PERMISSIONS } from "@/contexts/AuthContext";
import HomNay from "@/components/admin/HomNay";

// ─── TYPES ────────────────────────────────────────────────────────────────────
// Dạng rút gọn của GET /api/admin/analytics (BE-074): doanh thu = VIP gia sư.
interface Analytics {
  totals: {
    netVipRevenue: number; activeVipTutors: number; tutorCount: number; classCount: number;
  };
  byPlan:       { planCode: string; name: string }[];
  transactions: { id: string; tutorName: string; planCode: string; amount: number; createdAt: string }[];
  topClasses:   { id: string; name: string; tutorName: string | null; students: number }[];
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
        style={{ background: "var(--kin-nen-bang)", boxShadow: "var(--kin-bong-noi)" }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-extrabold text-base" style={{ color: "var(--kin-chu-chinh)" }}>Liên hệ học sinh</h2>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors text-xl cursor-pointer"
            style={{ background: "var(--kin-nen-bang)", boxShadow: "var(--kin-bong-the)" }}>
            ×
          </button>
        </div>

        <div className="rounded-2xl p-4 mb-5"
          style={{ background: "var(--kin-nen-bang)", boxShadow: "var(--kin-bong-chim)" }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-[var(--kin-chu-tren-nut-chinh)] font-extrabold text-xl flex-shrink-0"
              style={{ background: "var(--kin-tt-chu-loi)" }}>
              {student.name[0]}
            </div>
            <div>
              <p className="font-bold text-sm" style={{ color: "var(--kin-chu-chinh)" }}>{student.name}</p>
              <p className="text-xs font-mono" style={{ color: "var(--kin-chu-mo)" }}>{student.sbd}</p>
            </div>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span style={{ color: "var(--kin-chu-mo)" }}>GPA</span>
              <span className="font-bold" style={{ color: "var(--kin-tt-chu-loi)" }}>{student.gpa.toFixed(1)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span style={{ color: "var(--kin-chu-mo)" }}>Tiến độ</span>
              <span className="font-bold" style={{ color: "var(--kin-tt-chu-cho)" }}>{Math.round(student.completion)}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span style={{ color: "var(--kin-chu-mo)" }}>Email</span>
              <span style={{ color: "var(--kin-nhan-link)" }}>{student.email}</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl px-4 py-3 mb-4 flex items-center justify-between"
          style={{ background: "var(--kin-nen-bang)", boxShadow: "var(--kin-bong-chim)" }}>
          <div>
            <p className="text-xs font-medium mb-0.5" style={{ color: "var(--kin-chu-mo)" }}>Số điện thoại</p>
            <p className="text-lg font-extrabold tracking-wide" style={{ color: "var(--kin-chu-chinh)" }}>
              {student.phone ?? "Chưa có"}
            </p>
          </div>
          {student.phone && (
            <button onClick={copyPhone}
              className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
              style={copied
                ? { background: "var(--kin-tt-nen-xong)", color: "var(--kin-tt-chu-xong)" }
                : { background: "var(--kin-nen-bang)", boxShadow: "var(--kin-bong-the)", color: "var(--kin-nhan-link)" }}>
              {copied ? "✓ Đã sao chép" : "Sao chép"}
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => setShowRemind(v => !v)}
            className="flex items-center justify-center py-3 rounded-2xl text-sm font-bold cursor-pointer transition-all duration-150 hover:brightness-110 active:scale-[0.98]"
            style={showRemind
              ? { background: "var(--kin-tt-nen-cho)", color: "var(--kin-tt-chu-cho)", border: "1px solid color-mix(in srgb, var(--kin-tt-cham-cho) 40%, transparent)" }
              : { background: "var(--kin-tt-cham-cho)", color: "var(--kin-chu-tren-nut-chinh)" }}>
            Nhắc nhở
          </button>
          <Link href="/admin/hoc-sinh" onClick={onClose}
            className="flex items-center justify-center py-3 rounded-2xl text-sm font-bold transition-all duration-150 hover:bg-red-50 active:scale-[0.98]"
            style={{ background: "transparent", border: "1.5px solid var(--kin-tt-chu-loi)", color: "var(--kin-tt-chu-loi)" }}>
            Xem hồ sơ
          </Link>
        </div>

        {remindSent ? (
          <div className="mt-3 py-2.5 rounded-2xl text-xs font-semibold text-center"
            style={{ background: "var(--kin-tt-nen-xong)", color: "var(--kin-tt-chu-xong)" }}>
            ✓ Đã gửi nhắc nhở qua email
          </div>
        ) : showRemind && (
          <div className="mt-3 space-y-2">
            <textarea rows={3} value={remindMsg} onChange={e => { setRemindMsg(e.target.value); setRemindError(null); }}
              placeholder={DEFAULT_MSG}
              className="w-full px-3 py-2.5 rounded-xl text-xs outline-none resize-none"
              style={{ background: "var(--kin-nen-bang)", boxShadow: "var(--kin-bong-chim)", border: "none", color: "var(--kin-chu-chinh)" }} />
            {remindError && (
              <p className="text-xs font-semibold text-center" style={{ color: "var(--kin-tt-chu-loi)" }}>
                ✗ {remindError}
              </p>
            )}
            <button onClick={sendRemind} disabled={reminding}
              className="w-full py-2.5 rounded-xl text-xs font-bold text-[var(--kin-chu-tren-nut-chinh)] disabled:opacity-60 cursor-pointer transition-all duration-150 hover:brightness-110 active:scale-[0.98]"
              style={{ background: "var(--kin-tt-cham-cho)" }}>
              {reminding ? "Đang gửi..." : "Gửi nhắc nhở qua email"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// `permission` khớp đúng quyền mà trang đích đòi (PermissionGuard của từng trang / src/lib/adminNav.ts). Thiếu quyền thì ẩn nút: trước đây quản trị nội dung bấm
// "Hồ sơ học sinh" / "Doanh thu" bị PermissionGuard đẩy ngược về chính dashboard mà không báo gì (15/10/2026).
const QUICK_ACTIONS = [
  { label: "Thêm khóa học",  Icon: BookOpen, href: "/admin/khoa-hoc",  permission: PERMISSIONS.MANAGE_COURSES  },
  { label: "Đăng vinh danh", Icon: Badge,    href: "/admin/vinh-danh", permission: PERMISSIONS.MANAGE_HONOR    },
  { label: "Hồ sơ học sinh", Icon: Edit,     href: "/admin/hoc-sinh",  permission: PERMISSIONS.MANAGE_STUDENTS },
  { label: "Doanh thu",      Icon: Upload,   href: "/admin/doanh-thu", permission: PERMISSIONS.VIEW_REVENUE    },
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
  const [bulkCourse,     setBulkCourse]     = useState(""); // QT-07: nhắc hàng loạt theo MỘT lớp
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
    Math.max(...(analytics?.topClasses ?? []).map(c => c.students), 1),
  [analytics]);

  const recentVip = useMemo(() =>
    (analytics?.transactions ?? []).slice(0, 4).map(t => ({
      ...t, planName: analytics?.byPlan.find(p => p.planCode === t.planCode)?.name ?? t.planCode,
    })),
  [analytics]);

  const avgGpa = useMemo(() =>
    students.length === 0 ? 0 : students.reduce((s, u) => s + u.gpa, 0) / students.length,
  [students]);

  // QT-07: các lớp có học sinh, kèm số học sinh, để chọn lớp trước khi nhắc hàng loạt.
  const classOptions = useMemo(() => {
    const m = new Map<string, { name: string; n: number }>();
    for (const s of students) for (const e of s.enrollments) m.set(e.courseId, { name: e.courseName, n: (m.get(e.courseId)?.n ?? 0) + 1 });
    return [...m.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => a.name.localeCompare(b.name, "vi"));
  }, [students]);
  const bulkTarget = classOptions.find(c => c.id === bulkCourse) ?? null;

  const activatedCount = useMemo(() => students.filter(s => s.enrollments.length > 0).length, [students]);
  const inactiveCount  = useMemo(() => students.length - activatedCount, [students, activatedCount]);
  const lowGpaCount    = useMemo(() => students.filter(s => s.gpa < 7).length, [students]);

  const studentSub = `${activatedCount} học viên · ${inactiveCount} chưa kích hoạt`;

  const healthCards = useMemo(() => canViewRevenue
    // Super admin: 4 cards
    ? [
        { label: "Tổng học sinh",        value: String(students.length),                                              sub: studentSub,  color: "var(--kin-nhan-link)", Icon: UsersGroup      },
        { label: "Gia sư đang VIP",      value: analytics ? `${analytics.totals.activeVipTutors}/${analytics.totals.tutorCount}` : "—", sub: undefined, color: "var(--kin-nhan-link)", Icon: BookOpen },
        { label: "Lớp đang mở",          value: String(analytics?.totals.classCount ?? "—"),                          sub: undefined,   color: "var(--kin-tt-chu-xong)", Icon: Badge           },
        {
          label: "Doanh thu VIP (ròng)",
          value: analytics ? `${(analytics.totals.netVipRevenue / 1_000_000).toFixed(1)}Mđ` : "—",
          sub:   undefined,
          color: "var(--kin-tt-chu-cho)",
          Icon:  Wallet,
        },
      ]
    // Content admin: 2 cards từ students
    : [
        { label: "Tổng học sinh",       value: String(students.length),                          sub: studentSub,  color: "var(--kin-nhan-link)", Icon: UsersGroup      },
        { label: "Cần chú ý (GPA < 7)", value: String(lowGpaCount),  sub: undefined,   color: "var(--kin-tt-chu-loi)", Icon: NotificationAlert },
      ],
  [canViewRevenue, students, analytics, studentSub]);


  async function sendBulkRemind() {
    if (!bulkCourse) { setBulkToast("✗ Chọn một lớp trước khi gửi"); setTimeout(() => setBulkToast(null), 3000); return; }
    const msg = bulkMsg.trim() || BULK_DEFAULT;
    setBulkSending(true);
    try {
      const res = await fetch("/api/admin/remind-all", {
        method:      "POST",
        credentials: "same-origin",
        headers:     { "Content-Type": "application/json" },
        body:        JSON.stringify({ message: msg, courseId: bulkCourse }),
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
        <div className="fixed top-4 right-4 z-[200] px-4 py-3 rounded-xl text-sm font-semibold text-[var(--kin-chu-tren-nut-chinh)] shadow-xl"
          style={{ background: bulkToast.startsWith("✓") ? "var(--kin-tt-chu-xong)" : "var(--kin-tt-chu-loi)" }}>
          {bulkToast}
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold" style={{ color: "var(--kin-chu-chinh)" }}>Tổng quan quản trị</h1>
          <p className="text-sm mt-1" style={{ color: "var(--kin-chu-mo)" }}>Tổng quan sức khỏe hệ thống</p>
        </div>
        <div className="px-3 py-1.5 rounded-full text-xs font-bold"
          style={isSuper
            ? { background: "color-mix(in srgb, var(--kin-tt-cham-cho) 12%, transparent)", color: "var(--kin-tt-chu-cho)", border: "1px solid color-mix(in srgb, var(--kin-tt-cham-cho) 30%, transparent)" }
            : isTeacher
            ? { background: "color-mix(in srgb, var(--kin-tt-chu-xong) 12%, transparent)", color: "var(--kin-tt-chu-xong)", border: "1px solid color-mix(in srgb, var(--kin-tt-chu-xong) 30%, transparent)" }
            : { background: "color-mix(in srgb, var(--kin-nhan-link) 12%, transparent)", color: "var(--kin-nhan-link)", border: "1px solid color-mix(in srgb, var(--kin-nhan-link) 30%, transparent)" }}>
          {isSuper ? "Cấp 1 - Super Admin" : isTeacher ? "Giáo viên" : "Cấp 2 - Content Admin"}
        </div>
      </div>

      {/* ── QT-04: việc cần làm hôm nay (đếm theo quyền) ───────────────────── */}
      <HomNay />

      {/* ── Health cards ────────────────────────────────────────────────────── */}
      <div className={`grid gap-4 ${canViewRevenue ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-2"}`}>
        {healthCards.map(card => (
          <div key={card.label} className="rounded-2xl p-5"
            style={{ background: "var(--kin-nen-bang)", boxShadow: "var(--kin-bong-the)" }}>
            <div className="mb-3">
              <card.Icon size={22} style={{ color: card.color }} />
            </div>
            {loading ? (
              <div className="h-7 w-16 rounded animate-pulse mb-1" style={{ background: "var(--kin-vien-thuong)" }} />
            ) : (
              <div className="text-2xl font-extrabold mb-1" style={{ color: card.color }}>{card.value}</div>
            )}
            <div className="text-xs" style={{ color: "var(--kin-chu-mo)" }}>{card.label}</div>
            {!loading && card.sub && (
              <div className="text-xs mt-1.5" style={{ color: "var(--kin-chu-mo)" }}>{card.sub}</div>
            )}
          </div>
        ))}
      </div>

      {/* ── Charts row ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top khoá học theo enrollment */}
        <div className="rounded-2xl p-6" style={{ background: "var(--kin-nen-bang)", boxShadow: "var(--kin-bong-the)" }}>
          <h2 className="text-base font-bold mb-5 flex items-center gap-2" style={{ color: "var(--kin-chu-chinh)" }}>
            <ChartBar size={18} /> Lớp đông học viên nhất
          </h2>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-7 rounded-xl animate-pulse" style={{ background: "var(--kin-vien-thuong)" }} />
              ))}
            </div>
          ) : (analytics?.topClasses ?? []).length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: "var(--kin-chu-mo)" }}>
              {canViewRevenue ? "Chưa có dữ liệu" : "Không có quyền xem"}
            </p>
          ) : (
            <div className="space-y-3">
              {(analytics?.topClasses ?? []).map(c => (
                <div key={c.id} className="flex items-center gap-3">
                  <div className="w-32 flex-shrink-0 text-xs truncate" style={{ color: "var(--kin-chu-chinh)" }}>{c.name}</div>
                  <div className="flex-1 h-2 rounded-full"
                    style={{ background: "var(--kin-nen-bang)", boxShadow: "var(--kin-bong-chim)" }}>
                    <div className="h-2 rounded-full"
                      style={{ width: `${(c.students / chartMax * 100).toFixed(1)}%`, background: "var(--kin-nhan-nen)" }} />
                  </div>
                  <div className="w-14 text-right flex-shrink-0 text-xs font-bold" style={{ color: "var(--kin-nhan-link)" }}>
                    {c.students} HV
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Kích hoạt gần đây (admin cấp 1) hoặc Thống kê học sinh (admin cấp 2) */}
        {canViewRevenue ? (
          <div className="rounded-2xl p-6" style={{ background: "var(--kin-nen-bang)", boxShadow: "var(--kin-bong-the)" }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold flex items-center gap-2" style={{ color: "var(--kin-chu-chinh)" }}>
                <CreditCard size={18} /> Mua VIP gần đây
              </h2>
              <Link href="/admin/doanh-thu" className="text-xs font-semibold" style={{ color: "var(--kin-nhan-link)" }}>
                Xem tất cả →
              </Link>
            </div>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: "var(--kin-vien-thuong)" }} />
                ))}
              </div>
            ) : recentVip.length === 0 ? (
              <p className="text-sm text-center py-6" style={{ color: "var(--kin-chu-mo)" }}>Chưa có giao dịch</p>
            ) : (
              <div className="space-y-2">
                {recentVip.map(e => (
                  <div key={e.id} className="grid grid-cols-12 items-center px-3 py-2.5 rounded-xl"
                    style={{ background: "var(--kin-nen-bang)", boxShadow: "var(--kin-bong-chim)" }}>
                    <div className="col-span-5">
                      <div className="text-xs font-medium truncate" style={{ color: "var(--kin-chu-chinh)" }}>{e.tutorName}</div>
                      <div className="text-xs" style={{ color: "var(--kin-chu-mo)" }}>{e.createdAt.slice(0, 10)}</div>
                    </div>
                    <div className="col-span-4 text-xs truncate px-1" style={{ color: "var(--kin-chu-phu)" }}>{e.planName}</div>
                    <div className="col-span-3 text-right text-xs font-bold" style={{ color: "var(--kin-nhan-link)" }}>
                      {e.amount.toLocaleString("vi-VN")}đ
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl p-6" style={{ background: "var(--kin-nen-bang)", boxShadow: "var(--kin-bong-the)" }}>
            <h2 className="text-base font-bold mb-5" style={{ color: "var(--kin-chu-chinh)" }}>Thống kê học sinh</h2>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: "var(--kin-vien-thuong)" }} />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {[
                  { label: "Học viên đã kích hoạt",  value: String(activatedCount),                                    color: "var(--kin-nhan-link)" },
                  { label: "Chưa kích hoạt khoá",    value: String(inactiveCount),                                     color: "var(--kin-chu-mo)" },
                  { label: "GPA trung bình",          value: students.length ? avgGpa.toFixed(1) : "—",                color: "var(--kin-nhan-link)" },
                  { label: "Cần chú ý (GPA < 7)",    value: String(lowGpaCount),                                       color: "var(--kin-tt-chu-loi)" },
                ].map(row => (
                  <div key={row.label} className="flex justify-between items-center py-3 px-4 rounded-xl"
                    style={{ background: "var(--kin-nen-bang)", boxShadow: "var(--kin-bong-chim)" }}>
                    <span className="text-sm" style={{ color: "var(--kin-chu-phu)" }}>{row.label}</span>
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
      <div className="rounded-2xl p-6" style={{ background: "var(--kin-nen-bang)", boxShadow: "var(--kin-bong-the)" }}>
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <h2 className="text-base font-bold flex items-center gap-2" style={{ color: "var(--kin-chu-chinh)" }}>
            <NotificationAlert size={18} style={{ color: "var(--kin-tt-chu-loi)" }} />
            Học sinh cần can thiệp: GPA thấp nhất
          </h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowBulkRemind(v => !v)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all"
              style={showBulkRemind
                ? { background: "var(--kin-tt-nen-cho)", color: "var(--kin-tt-chu-cho)", border: "1px solid color-mix(in srgb, var(--kin-tt-cham-cho) 40%, transparent)" }
                : { background: "var(--kin-tt-cham-cho)", color: "var(--kin-chu-tren-nut-chinh)" }}>
              Nhắc nhở theo lớp
            </button>
            <Link href="/admin/hoc-sinh" className="text-xs font-semibold" style={{ color: "var(--kin-nhan-link)" }}>
              Xem tất cả →
            </Link>
          </div>
        </div>

        {/* Bulk remind form */}
        {showBulkRemind && (
          <div className="mb-5 p-4 rounded-2xl space-y-2" style={{ background: "var(--kin-tt-nen-cho)", border: "1px solid color-mix(in srgb, var(--kin-tt-cham-cho) 20%, transparent)" }}>
            <p className="text-xs font-semibold" style={{ color: "var(--kin-tt-chu-cho)" }}>
              Gửi tới <strong>toàn bộ {students.length} học sinh</strong> trong hệ thống (không chỉ nhóm GPA thấp)
            </p>
            <label className="block text-xs font-semibold" style={{ color: "var(--kin-chu-mo)" }}>Lớp nhận nhắc
              <select value={bulkCourse} onChange={e => setBulkCourse(e.target.value)} data-testid="nhac-chon-lop"
                className="block w-full mt-1 px-3 min-h-11 rounded-xl text-sm" style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)", color: "var(--kin-chu-chinh)" }}>
                <option value="">Chọn một lớp…</option>
                {classOptions.map(c => <option key={c.id} value={c.id}>{c.name} · {c.n} học sinh</option>)}
              </select>
            </label>
            <textarea rows={3} value={bulkMsg} onChange={e => setBulkMsg(e.target.value)}
              placeholder={BULK_DEFAULT}
              className="w-full px-3 py-2.5 rounded-xl text-xs outline-none resize-none"
              style={{ background: "var(--kin-nen-bang)", boxShadow: "var(--kin-bong-chim)", border: "none", color: "var(--kin-chu-chinh)" }} />
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowBulkRemind(false); setBulkMsg(""); }}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold cursor-pointer"
                style={{ background: "var(--kin-nen-bang)", boxShadow: "var(--kin-bong-the)", color: "var(--kin-chu-mo)" }}>
                Hủy
              </button>
              <button onClick={sendBulkRemind} disabled={bulkSending || !bulkCourse}
                className="px-4 py-1.5 rounded-xl text-xs font-bold text-[var(--kin-chu-tren-nut-chinh)] disabled:opacity-60 cursor-pointer transition-all duration-150 hover:brightness-110 active:scale-[0.98]"
                style={{ background: "var(--kin-tt-cham-cho)" }}>
                {bulkSending ? "Đang gửi..." : bulkTarget ? `Gửi tới lớp này (${bulkTarget.n} học sinh)` : "Chọn lớp để gửi"}
              </button>
            </div>
          </div>
        )}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 rounded-2xl animate-pulse" style={{ background: "var(--kin-vien-thuong)" }} />
            ))}
          </div>
        ) : dangerStudents.length === 0 ? (
          <p className="text-sm text-center py-6" style={{ color: "var(--kin-chu-mo)" }}>
            Tất cả học sinh đều ổn, không ai có GPA dưới 7
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {dangerStudents.map(s => (
              <div key={s.id} className="flex items-center justify-between p-4 rounded-2xl"
                style={{ background: "var(--kin-nen-bang)", boxShadow: "var(--kin-bong-chim)" }}>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm" style={{ color: "var(--kin-chu-chinh)" }}>{s.name}</div>
                  <div className="text-xs mt-0.5 flex items-center gap-2" style={{ color: "var(--kin-chu-mo)" }}>
                    <span className="font-mono">{s.sbd}</span>
                    <span>·</span>
                    <span>GPA: <strong style={{ color: s.gpa < 6 ? "var(--kin-tt-chu-loi)" : "var(--kin-tt-chu-cho)" }}>{s.gpa.toFixed(1)}</strong></span>
                    <span>·</span>
                    <span>{Math.round(s.completion)}% hoàn thành</span>
                  </div>
                </div>
                <button onClick={() => setCallTarget(s)}
                  className="ml-3 flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold text-[var(--kin-chu-tren-nut-chinh)] transition-all hover:-translate-y-0.5 cursor-pointer"
                  style={{ background: "var(--kin-tt-chu-loi)" }}>
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
        {QUICK_ACTIONS.filter(a => hasPermission(user, a.permission)).map(a => (
          <Link key={a.label} href={a.href}
            className="flex flex-col items-center gap-2 p-4 rounded-2xl text-center transition-all hover:-translate-y-0.5 cursor-pointer"
            style={{ background: "var(--kin-nen-bang)", boxShadow: "var(--kin-bong-the)", color: "var(--kin-chu-chinh)" }}>
            <a.Icon size={24} style={{ color: "var(--kin-nhan-link)" }} />
            <span className="text-xs font-semibold">{a.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
