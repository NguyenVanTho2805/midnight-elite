"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import PermissionGuard from "@/components/PermissionGuard";
import { PERMISSIONS } from "@/contexts/AuthContext";
import { Search } from "griddy-icons";
import type { CourseFull } from "@/lib/api";

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface Student {
  id: string; userId: string;
  sbd: string;
  name: string; phone: string; email: string;
  school: string; course: string;
  enrolledCourseIds: string[];
  gpa: number; completion: number;
  role: "hoc-vien" | "chua-kich-hoat";
  status: "safe" | "warn" | "danger"; lastSeen: string;
  banned: boolean;
}

const ROLE_CONFIG = {
  "hoc-vien":       { label: "Học viên", labelFull: "Học viên",       bg: "#DBEAFE", color: "#1D4ED8" },
  "chua-kich-hoat": { label: "Chưa KH",  labelFull: "Chưa kích hoạt", bg: "#F3F4F6", color: "#6B7280" },
};

interface ApiStudent {
  id: string; name: string; email: string; phone: string | null;
  school: string | null; createdAt: string; banned: boolean;
  enrollments: { courseId: string; courseName: string }[];
  gpa: number; completion: number;
  sbd: string;
}

function toStudent(u: ApiStudent): Student {
  const courseNames       = u.enrollments.map(e => e.courseName).join(", ") || "—";
  const enrolledCourseIds = u.enrollments.map(e => e.courseId);
  const status: Student["status"] =
    u.gpa === 0  ? "warn"   :
    u.gpa >= 7.0 ? "safe"   :
    u.gpa >= 5.0 ? "warn"   : "danger";
  return {
    id:              u.id.slice(-6).toUpperCase(),
    userId:          u.id,
    sbd:             u.sbd,
    name:            u.name,
    phone:           u.phone ?? "—",
    email:           u.email,
    school:          u.school ?? "—",
    course:          courseNames,
    enrolledCourseIds,
    gpa:             u.gpa,
    completion:      u.completion,
    role:            enrolledCourseIds.length > 0 ? "hoc-vien" : "chua-kich-hoat",
    status,
    lastSeen:        new Date(u.createdAt).toLocaleDateString("vi-VN"),
    banned:          u.banned,
  };
}

const STATUS_CONFIG = {
  safe:   { label: "An toàn",  bg: "#d1fae5", color: "#065f46" },
  warn:   { label: "Cảnh báo", bg: "#fef3c7", color: "#92400e" },
  danger: { label: "Báo động", bg: "#fee2e2", color: "#991b1b" },
};

// ─── TOAST ────────────────────────────────────────────────────────────────────
function Toast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <div className="fixed top-4 right-4 z-[200] px-4 py-3 rounded-xl text-sm font-semibold text-white shadow-xl"
      style={{ background: ok ? "#16a34a" : "#dc2626" }}>
      {ok ? "✓" : "✗"} {msg}
    </div>
  );
}

// ─── STUDENT DETAIL MODAL ─────────────────────────────────────────────────────
function DetailModal({ student, dbCourses, onClose, onRefresh, onDelete }: {
  student: Student;
  dbCourses: CourseFull[];
  onClose: () => void;
  onRefresh: () => void;
  onDelete: () => void;
}) {
  const cfg = STATUS_CONFIG[student.status];
  const [copied,      setCopied]      = useState(false);
  const [enrolledIds, setEnrolledIds] = useState<string[]>(student.enrolledCourseIds);
  const [activating,  setActivating]  = useState<string | null>(null);
  const [toast,       setToast]       = useState<{ msg: string; ok: boolean } | null>(null);
  const [showRemind,  setShowRemind]  = useState(false);
  const [remindMsg,   setRemindMsg]   = useState("");
  const [reminding,   setReminding]   = useState(false);
  const [banned,      setBanned]      = useState(student.banned);
  const [banning,     setBanning]     = useState(false);
  const [confirmDel,  setConfirmDel]  = useState(false);
  const [deleting,    setDeleting]    = useState(false);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  async function toggleCourse(courseId: string) {
    const isEnrolled = enrolledIds.includes(courseId);
    setActivating(courseId);
    const res = await fetch("/api/admin/enrollments", {
      method:  isEnrolled ? "DELETE" : "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ userId: student.userId, courseId }),
    });
    if (res.ok) {
      setEnrolledIds(prev =>
        isEnrolled ? prev.filter(id => id !== courseId) : [...prev, courseId]
      );
      showToast(isEnrolled ? "Đã thu hồi khoá học" : "Đã kích hoạt khoá học!");
      onRefresh();
    } else {
      const d = await res.json().catch(() => ({}));
      showToast(d.error ?? "Lỗi", false);
    }
    setActivating(null);
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const DEFAULT_REMIND = `Xin chào ${student.name}, thầy/cô nhắc bạn nhớ duy trì tiến độ học tập nhé! Hãy vào hệ thống xem video và hoàn thành bài tập đầy đủ.`;

  async function sendRemind() {
    const msg = remindMsg.trim() || DEFAULT_REMIND;
    setReminding(true);
    try {
      const res = await fetch("/api/admin/remind", {
        method:      "POST",
        credentials: "same-origin",
        headers:     { "Content-Type": "application/json" },
        body:        JSON.stringify({ userId: student.userId, message: msg }),
      });
      if (res.ok) {
        showToast("Đã gửi nhắc nhở qua email");
        setShowRemind(false);
        setRemindMsg("");
      } else {
        const d = await res.json().catch(() => ({}));
        showToast(d.error ?? "Lỗi gửi email", false);
      }
    } catch {
      showToast("Lỗi kết nối", false);
    } finally {
      setReminding(false);
    }
  }

  async function toggleBan() {
    setBanning(true);
    try {
      const res = await fetch(`/api/admin/students/${student.userId}`, { method: "PATCH", credentials: "same-origin" });
      if (res.ok) {
        const d = await res.json();
        setBanned(d.banned);
        showToast(d.banned ? "Đã ban học sinh" : "Đã gỡ ban học sinh");
        onRefresh();
      } else {
        showToast("Lỗi cập nhật", false);
      }
    } catch {
      showToast("Lỗi kết nối", false);
    } finally {
      setBanning(false);
    }
  }

  async function deleteStudent() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/students/${student.userId}`, { method: "DELETE", credentials: "same-origin" });
      if (res.ok) {
        onRefresh();
        onDelete();
        onClose();
      } else {
        showToast("Lỗi xóa học sinh", false);
        setDeleting(false);
        setConfirmDel(false);
      }
    } catch {
      showToast("Lỗi kết nối", false);
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="rounded-2xl w-full max-w-md mx-4 overflow-y-auto max-h-[90vh] bg-white"
        style={{ border: "1px solid #e5e3df", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid #e5e3df" }}>
          <h2 className="font-bold text-base" style={{ color: "#1E2938" }}>Hồ sơ học sinh</h2>
          <button onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors text-lg">
            ×
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Avatar + name */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0"
              style={{ background: "#0068FF" }}>
              {student.name[0]}
            </div>
            <div>
              <p className="font-bold text-base" style={{ color: "#1E2938" }}>{student.name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-semibold" style={{ color: "#0068FF" }}>{student.sbd}</span>
                <span className="text-xs" style={{ color: "#9CA3AF" }}>· {student.lastSeen}</span>
              </div>
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                  style={{ background: cfg.bg, color: cfg.color }}>
                  {cfg.label}
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                  style={{ background: ROLE_CONFIG[student.role].bg, color: ROLE_CONFIG[student.role].color }}>
                  {ROLE_CONFIG[student.role].labelFull}
                </span>
              </div>
            </div>
          </div>

          {/* Info grid */}
          <div className="rounded-xl p-3.5 space-y-2.5" style={{ background: "#f6f5f4", border: "1px solid #e5e3df" }}>
            {[
              { label: "Trường",   value: student.school },
              { label: "Khoá học", value: student.course },
              { label: "Email",    value: student.email  },
            ].map(r => (
              <div key={r.label} className="flex justify-between items-center text-xs">
                <span style={{ color: "#6B7280" }}>{r.label}</span>
                <span className="font-semibold text-right ml-2 truncate max-w-[180px]" style={{ color: "#1E2938" }}>{r.value}</span>
              </div>
            ))}
            <div className="flex justify-between items-center text-xs">
              <span style={{ color: "#6B7280" }}>SĐT</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold" style={{ color: "#1E2938" }}>{student.phone}</span>
                {student.phone !== "—" && (
                  <button onClick={() => copy(student.phone.replace(/\s/g, ""))}
                    className="px-2 py-0.5 rounded text-xs font-semibold border transition-colors"
                    style={{ borderColor: "#e5e3df", background: copied ? "#d1fae5" : "#fff", color: copied ? "#166534" : "#0068FF" }}>
                    {copied ? "✓" : "Sao chép"}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "GPA",     value: student.gpa > 0 ? student.gpa.toFixed(1) : "—", color: student.gpa === 0 ? "#9CA3AF" : student.gpa < 5 ? "#FF2157" : student.gpa < 7 ? "#FE9900" : "#0068FF" },
              { label: "Tiến độ", value: `${student.completion}%`, color: "#8B5CF6" },
            ].map(s => (
              <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: "#f6f5f4", border: "1px solid #e5e3df" }}>
                <div className="text-xl font-bold" style={{ color: s.color }}>{s.value}</div>
                <div className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span style={{ color: "#6B7280" }}>Tiến độ khóa học</span>
              <span className="font-bold" style={{ color: "#8B5CF6" }}>{student.completion}%</span>
            </div>
            <div className="h-2 rounded-full" style={{ background: "#e5e3df" }}>
              <div className="h-2 rounded-full transition-all"
                style={{ width: `${student.completion}%`, background: "#8B5CF6" }} />
            </div>
          </div>

          {/* Ban + Xóa học sinh */}
          <div className="flex gap-2">
            <button
              onClick={toggleBan}
              disabled={banning}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold border transition-colors disabled:opacity-50"
              style={banned
                ? { borderColor: "#d1fae5", background: "#f0fdf4", color: "#16a34a" }
                : { borderColor: "#fed7aa", background: "#fff7ed", color: "#c2410c" }}>
              {banning ? "Đang xử lý…" : banned ? "✓ Gỡ ban" : "Ban học sinh"}
            </button>
            {!confirmDel ? (
              <button
                onClick={() => setConfirmDel(true)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold border transition-colors"
                style={{ borderColor: "#fecaca", background: "#fff5f5", color: "#dc2626" }}>
                Xóa học sinh
              </button>
            ) : (
              <div className="flex-1 rounded-xl border p-2.5 space-y-1.5" style={{ borderColor: "#fecaca", background: "#fff5f5" }}>
                <p className="text-xs font-bold text-center" style={{ color: "#dc2626" }}>Xác nhận xóa?</p>
                <div className="flex gap-1.5">
                  <button onClick={() => setConfirmDel(false)}
                    className="flex-1 py-1 rounded-lg text-xs border" style={{ borderColor: "#e5e3df", color: "#6B7280" }}>Huỷ</button>
                  <button onClick={deleteStudent} disabled={deleting}
                    className="flex-1 py-1 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                    style={{ background: "#dc2626" }}>{deleting ? "…" : "Xóa"}</button>
                </div>
              </div>
            )}
          </div>

          {toast && (
            <div className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white text-center"
              style={{ background: toast.ok ? "#16a34a" : "#dc2626" }}>
              {toast.ok ? "✓" : "✗"} {toast.msg}
            </div>
          )}

          {/* Kích hoạt khoá học */}
          <div>
            <p className="text-xs font-bold mb-2.5" style={{ color: "#1E2938" }}>Kích hoạt / Thu hồi khoá học</p>
            {dbCourses.length === 0 ? (
              <p className="text-xs text-center py-3" style={{ color: "#9CA3AF" }}>Chưa có khoá học nào trong hệ thống</p>
            ) : (
              <div className="space-y-2">
                {dbCourses.map(course => {
                  const enrolled = enrolledIds.includes(course.id);
                  const busy     = activating === course.id;
                  return (
                    <div key={course.id}
                      className="flex items-center justify-between px-3 py-2.5 rounded-lg"
                      style={{ background: enrolled ? "#f0fdf4" : "#f6f5f4", border: `1px solid ${enrolled ? "#bbf7d0" : "#e5e3df"}` }}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="flex-shrink-0 text-sm font-bold" style={{ color: enrolled ? "#16a34a" : "#d1d5db" }}>
                          {enrolled ? "✓" : "○"}
                        </span>
                        <span className="text-xs font-semibold truncate"
                          style={{ color: enrolled ? "#065F46" : "#1E2938" }}>
                          {course.name}
                        </span>
                      </div>
                      <button
                        onClick={() => toggleCourse(course.id)}
                        disabled={busy}
                        className="flex-shrink-0 ml-2 px-3 py-1 rounded-lg text-xs font-bold transition-all duration-150 disabled:opacity-50 cursor-pointer"
                        style={enrolled
                          ? { background: "#fee2e2", color: "#DC2626" }
                          : { background: "#0068FF", color: "white" }}>
                        {busy ? "..." : enrolled ? "Thu hồi" : "Kích hoạt"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Nhắc nhở */}
          <button onClick={() => setShowRemind(v => !v)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-colors border"
            style={showRemind
              ? { background: "#fff7ed", color: "#FE9900", borderColor: "#fed7aa" }
              : { background: "#FE9900", color: "white", borderColor: "transparent" }}>
            Nhắc nhở học tập
          </button>

          {showRemind && (
            <div className="space-y-2">
              <textarea rows={3} value={remindMsg} onChange={e => setRemindMsg(e.target.value)}
                placeholder={DEFAULT_REMIND}
                className="w-full px-3 py-2.5 rounded-xl text-xs outline-none resize-none"
                style={{ background: "#f6f5f4", border: "1px solid #e5e3df", color: "#1E2938" }} />
              <button onClick={sendRemind} disabled={reminding}
                className="w-full py-2.5 rounded-xl text-xs font-bold text-white disabled:opacity-60 cursor-pointer"
                style={{ background: "#FE9900" }}>
                {reminding ? "Đang gửi..." : "Gửi nhắc nhở qua email"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ADD STUDENT DRAWER ───────────────────────────────────────────────────────
interface AddForm {
  name: string; phone: string; email: string; school: string; courseId: string;
}

function AddDrawer({ open, dbCourses, onClose, onSave }: {
  open: boolean;
  dbCourses: CourseFull[];
  onClose: () => void;
  onSave: (data: AddForm) => Promise<void>;
}) {
  const defaultCourseId = dbCourses[0]?.id ?? "";
  const [form, setForm] = useState<AddForm>({ name: "", phone: "", email: "", school: "", courseId: defaultCourseId });
  const [saving, setSaving] = useState(false);

  const inp = "w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200";

  useEffect(() => {
    if (!open) { setForm({ name: "", phone: "", email: "", school: "", courseId: defaultCourseId }); setSaving(false); }
  }, [open, defaultCourseId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSave() {
    if (!form.name.trim() || !form.email.trim()) return;
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  }

  return (
    <>
      {open && <div className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.3)" }} onClick={onClose} />}
      <div className="fixed top-0 right-0 bottom-0 z-50 bg-white overflow-y-auto"
        style={{
          width: "min(440px, 100vw)",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.28s cubic-bezier(.4,0,.2,1)",
          pointerEvents: open ? "auto" : "none",
          visibility: open ? "visible" : "hidden",
          borderLeft: "1px solid #e5e3df",
          boxShadow: "-8px 0 32px rgba(0,0,0,0.08)",
        }}>

        <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid #e5e3df" }}>
          <div className="flex items-center gap-3">
            <button onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors text-xl font-light">
              ×
            </button>
            <h2 className="text-base font-bold text-gray-800">Thêm học sinh mới</h2>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-sm border text-gray-600 hover:bg-gray-50 transition-colors"
              style={{ borderColor: "#e5e3df" }}>
              Huỷ
            </button>
            <button onClick={handleSave}
              disabled={!form.name.trim() || !form.email.trim() || saving}
              className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white disabled:opacity-40 cursor-pointer"
              style={{ background: "#16a34a" }}>
              {saving ? "Đang lưu..." : "Lưu"}
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Họ và tên <span className="text-red-500">*</span></label>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="VD: Nguyễn Văn A" className={inp} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Số điện thoại</label>
            <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="VD: 0901234567" className={inp} />
            <p className="text-xs text-gray-400 mt-1">Dùng làm mật khẩu mặc định khi đăng nhập lần đầu</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Email <span className="text-red-500">*</span></label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="VD: example@gmail.com" className={inp} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Trường THPT</label>
            <input type="text" value={form.school} onChange={e => setForm(f => ({ ...f, school: e.target.value }))}
              placeholder="VD: THPT Chu Văn An, Hà Nội" className={inp} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Kích hoạt khoá học ngay</label>
            <select value={form.courseId} onChange={e => setForm(f => ({ ...f, courseId: e.target.value }))}
              className={inp + " bg-white"}>
              <option value="">— Không kích hoạt —</option>
              {dbCourses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="rounded-lg p-3 bg-blue-50 border border-blue-100">
            <p className="text-xs text-blue-700">
              Hệ thống sẽ gửi <strong>email đặt mật khẩu</strong> tới học sinh sau khi tạo tài khoản.
              Học sinh tự đặt mật khẩu theo link trong email (có hiệu lực 24 giờ).
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────
export default function HocSinhPage() {
  const [students, setStudents]         = useState<Student[]>([]);
  const [dbCourses, setDbCourses]       = useState<CourseFull[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "safe" | "warn" | "danger">("all");
  const [roleFilter,   setRoleFilter]   = useState<"all" | "hoc-vien" | "chua-kich-hoat">("all");
  const [detailTarget, setDetailTarget] = useState<Student | null>(null);
  const [showAdd, setShowAdd]           = useState(false);
  const [toast, setToast]               = useState<{ msg: string; ok: boolean } | null>(null);

  const loadStudents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetch("/api/admin/students", { credentials: "same-origin" })
        .then(r => r.ok ? r.json() : []) as ApiStudent[];
      const updated = data.map(toStudent);
      setStudents(updated);
      setDetailTarget(prev =>
        prev ? (updated.find(s => s.userId === prev.userId) ?? prev) : null
      );
    } catch {
      showToast("Lỗi tải danh sách học sinh", false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStudents();
    fetch("/api/courses?all=1", { credentials: "same-origin" })
      .then(r => r.ok ? r.json() : [])
      .then(setDbCourses)
      .catch(() => {});
  }, [loadStudents]);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  const filtered = useMemo(() => {
    return students.filter(s => {
      const matchStatus = statusFilter === "all" || s.status === statusFilter;
      const matchRole   = roleFilter   === "all" || s.role   === roleFilter;
      const q = search.toLowerCase();
      const matchSearch = q === "" || s.name.toLowerCase().includes(q) || s.phone.includes(q)
        || s.email.toLowerCase().includes(q) || s.id.toLowerCase().includes(q)
        || s.sbd.toLowerCase().includes(q)
        || s.course.toLowerCase().includes(q)
        || ROLE_CONFIG[s.role].labelFull.toLowerCase().includes(q);
      return matchStatus && matchRole && matchSearch;
    });
  }, [search, statusFilter, roleFilter, students]);

  const counts = useMemo(() => ({
    safe:    students.filter(s => s.status === "safe").length,
    warn:    students.filter(s => s.status === "warn").length,
    danger:  students.filter(s => s.status === "danger").length,
    hocVien: students.filter(s => s.role   === "hoc-vien").length,
    chuaKH:  students.filter(s => s.role   === "chua-kich-hoat").length,
  }), [students]);

  async function handleAddStudent(data: { name: string; phone: string; email: string; school: string; courseId: string }) {
    const res = await fetch("/api/admin/students", {
      method:  "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) { showToast(result.error ?? "Lỗi thêm học sinh", false); return; }
    setShowAdd(false);
    showToast(`Đã thêm học sinh ${data.name}`);
    loadStudents();
  }

  return (
    <PermissionGuard required={PERMISSIONS.MANAGE_STUDENTS}>
      {toast && <Toast msg={toast.msg} ok={toast.ok} />}
      {detailTarget && (
        <DetailModal
          student={detailTarget}
          dbCourses={dbCourses}
          onClose={() => setDetailTarget(null)}
          onRefresh={loadStudents}
          onDelete={() => setDetailTarget(null)}
        />
      )}
      <AddDrawer
        open={showAdd}
        dbCourses={dbCourses}
        onClose={() => setShowAdd(false)}
        onSave={handleAddStudent}
      />

      <div className="space-y-5 flex flex-col" style={{ height: "calc(100vh - 104px)" }}>

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "#1E2938" }}>Hồ sơ học sinh</h1>
            <p className="text-sm mt-0.5" style={{ color: "#9CA3AF" }}>
              {students.length} học sinh · {counts.hocVien} có khóa học · {counts.chuaKH} chưa kích hoạt
            </p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98] cursor-pointer"
            style={{ background: "#0068FF" }}>
            + Thêm học sinh
          </button>
        </div>

        {/* Stat cards — bấm để lọc theo trạng thái */}
        <div className="grid grid-cols-3 gap-3">
          {(["safe", "warn", "danger"] as const).map(s => {
            const cfg = STATUS_CONFIG[s];
            const active = statusFilter === s;
            return (
              <button key={s}
                onClick={() => setStatusFilter(active ? "all" : s)}
                className="rounded-xl p-4 text-center transition-all cursor-pointer"
                style={{
                  background: active ? cfg.bg : "#ffffff",
                  border: `1px solid ${active ? cfg.color : "#e5e3df"}`,
                }}>
                <div className="text-2xl font-bold" style={{ color: cfg.color }}>{counts[s]}</div>
                <div className="text-xs mt-0.5" style={{ color: "#6B7280" }}>{cfg.label}</div>
              </button>
            );
          })}
        </div>

        {/* Filter row: role tabs trái + search phải */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: "#f6f5f4", border: "1px solid #e5e3df" }}>
            {([
              { key: "all"            as const, label: "Tất cả"                       },
              { key: "hoc-vien"       as const, label: `Học viên · ${counts.hocVien}` },
              { key: "chua-kich-hoat" as const, label: `Chưa KH · ${counts.chuaKH}`  },
            ]).map(f => (
              <button key={f.key} onClick={() => setRoleFilter(f.key)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap"
                style={roleFilter === f.key
                  ? { background: "#ffffff", color: "#1E2938", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", border: "1px solid #e5e3df" }
                  : { background: "transparent", color: "#6B7280", border: "1px solid transparent" }}>
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex-1 relative min-w-[200px]">
            <input type="text" placeholder="Tìm theo tên, SĐT, email, SBD..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full px-4 py-2.5 pl-9 rounded-xl text-sm outline-none"
              style={{ background: "#ffffff", border: "1px solid #e5e3df", color: "#1E2938" }} />
            <div className="absolute left-3 top-3" style={{ color: "#9CA3AF" }}>
              <Search size={15} />
            </div>
          </div>

          {statusFilter !== "all" && (
            <button onClick={() => setStatusFilter("all")}
              className="px-3 py-2.5 rounded-xl text-xs font-semibold border transition-colors"
              style={{ background: STATUS_CONFIG[statusFilter].bg, color: STATUS_CONFIG[statusFilter].color, borderColor: STATUS_CONFIG[statusFilter].color }}>
              {STATUS_CONFIG[statusFilter].label} ×
            </button>
          )}
        </div>

        {/* Table */}
        <div className="rounded-xl overflow-hidden flex flex-col flex-1 bg-white"
          style={{ border: "1px solid #e5e3df" }}>
          <div className="grid grid-cols-12 px-5 py-3 text-xs font-semibold uppercase tracking-wider"
            style={{ color: "#9CA3AF", background: "#f6f5f4", borderBottom: "1px solid #e5e3df" }}>
            <div className="col-span-1 hidden sm:block">SBD</div>
            <div className="col-span-4 sm:col-span-3">Học sinh</div>
            <div className="col-span-2 hidden sm:block">Liên hệ</div>
            <div className="col-span-2">Khóa học</div>
            <div className="col-span-1 text-center">GPA</div>
            <div className="col-span-2 text-center">Trạng thái</div>
            <div className="col-span-1 text-right"></div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="px-5 py-8 space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-11 rounded-lg animate-pulse" style={{ background: "#f6f5f4" }} />
                ))}
              </div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="px-5 py-12 text-center">
                <p className="font-semibold text-sm" style={{ color: "#6B7280" }}>Không tìm thấy học sinh</p>
                <button onClick={() => { setSearch(""); setStatusFilter("all"); setRoleFilter("all"); }}
                  className="text-xs mt-2 cursor-pointer" style={{ color: "#0068FF" }}>
                  Xóa bộ lọc
                </button>
              </div>
            )}
            {!loading && filtered.map((s, i) => {
              const cfg    = STATUS_CONFIG[s.status];
              const isHV   = s.role === "hoc-vien";
              return (
                <div key={s.userId} className="grid grid-cols-12 items-center px-5 py-3.5 hover:bg-gray-50 transition-colors"
                  style={{ borderTop: i > 0 ? "1px solid #f0eeeb" : "none" }}>
                  <div className="col-span-1 hidden sm:block">
                    <span className="text-xs font-mono" style={{ color: "#0068FF" }}>{s.sbd}</span>
                  </div>
                  <div className="col-span-4 sm:col-span-3">
                    <div className="font-semibold text-sm" style={{ color: "#1E2938" }}>{s.name}</div>
                    <div className="text-xs" style={{ color: "#9CA3AF" }}>{s.lastSeen}</div>
                  </div>
                  <div className="col-span-2 hidden sm:block">
                    <div className="text-xs" style={{ color: "#4B5563" }}>{s.phone}</div>
                    <div className="text-xs truncate" style={{ color: "#9CA3AF" }}>{s.email}</div>
                  </div>
                  <div className="col-span-2">
                    {isHV ? (
                      <span className="text-xs truncate block" style={{ color: "#1E2938" }}>{s.course}</span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-xs font-medium"
                        style={{ background: "#F3F4F6", color: "#6B7280" }}>Chưa KH</span>
                    )}
                  </div>
                  <div className="col-span-1 text-center">
                    <span className="text-sm font-bold"
                      style={{ color: s.gpa === 0 ? "#d1d5db" : s.gpa < 5 ? "#FF2157" : s.gpa < 7 ? "#FE9900" : "#0068FF" }}>
                      {s.gpa > 0 ? s.gpa.toFixed(1) : "—"}
                    </span>
                  </div>
                  <div className="col-span-2 text-center">
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={{ background: cfg.bg, color: cfg.color }}>
                      {cfg.label}
                    </span>
                  </div>
                  <div className="col-span-1 text-right">
                    <button
                      onClick={() => setDetailTarget(s)}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors hover:bg-blue-50 cursor-pointer"
                      style={{ color: "#0068FF", border: "1px solid #e5e3df" }}>
                      Chi tiết
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="px-5 py-3 text-xs text-right flex-shrink-0"
            style={{ borderTop: "1px solid #e5e3df", color: "#9CA3AF" }}>
            {filtered.length}/{students.length} học sinh · GPA = 40% tiến độ + 60% điểm thi
          </div>
        </div>
      </div>
    </PermissionGuard>
  );
}
