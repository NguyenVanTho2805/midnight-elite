"use client";

import PhoneLoginCard from "@/components/account/PhoneLoginCard";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import Cropper from "react-easy-crop";
import {
  CheckCircle, CloseCircle, AlertCircle,
  Trophy, Key, Edit, PhotoCamera,
} from "griddy-icons";
import { BADGE_RULES } from "@/lib/honorData";
import { DropZone } from "@/components/DropZone";
import ParentLinkWidget from "@/components/parent/ParentLinkWidget";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExamResultItem {
  id: string; score: number; totalPoints: number; completedAt: string;
  exam: { title: string; code: string };
}

interface EnrolledCourseItem {
  id: string; name: string; category: string; lessons: number;
}

type ToastType = { msg: string; type: "success" | "error" | "info" };

interface Area { x: number; y: number; width: number; height: number; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ToastBar({ toast }: { toast: ToastType }) {
  const bg = toast.type === "success" ? "var(--kin-tt-chu-xong)" : toast.type === "error" ? "var(--kin-tt-chu-loi)" : "var(--kin-nhan-nen)";
  const Icon = toast.type === "success" ? CheckCircle : toast.type === "error" ? CloseCircle : AlertCircle;
  return (
    <div className="fixed top-4 right-4 z-[200] px-4 py-3 rounded-xl text-sm font-semibold text-white shadow-lg flex items-center gap-2"
      style={{ background: bg }}>
      <Icon size={16} /> {toast.msg}
    </div>
  );
}

async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<string> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", reject);
    img.src = imageSrc;
  });
  const canvas = document.createElement("canvas");
  canvas.width = 400;
  canvas.height = 400;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, 400, 400);
  return canvas.toDataURL("image/jpeg", 0.82);
}

function Section({ title, onEdit, children }: { title: string; onEdit?: () => void; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-5" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold" style={{ color: "var(--kin-chu-phu)" }}>{title}</h2>
        {onEdit && (
          <button onClick={onEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)", color: "var(--kin-nhan-link)", borderRadius: "8px" }}>
            <Edit size={13} /> Sửa
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex gap-3">
      <span className="text-xs w-32 flex-shrink-0 pt-0.5" style={{ color: "var(--kin-chu-mo)" }}>{label}</span>
      <span className="text-sm font-medium" style={{ color: value ? "var(--kin-chu-phu)" : "var(--kin-vien-o-nhap)" }}>
        {value || "Chưa cập nhật"}
      </span>
    </div>
  );
}

function InputField({ label, value, onChange, type = "text", placeholder }:
  { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--kin-chu-phu)" }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="notion-input w-full text-sm" style={{ color: "var(--kin-chu-chinh)" }} />
    </div>
  );
}

interface UserStats {
  gpa: number | null;
  streak: number;
  rank: number | null;
  totalStudents: number;
  exp: number;
}

// ─── GPA Sparkline ────────────────────────────────────────────────────────────
function ScoreSparkline({ results }: { results: ExamResultItem[] }) {
  if (results.length < 2) return null;
  const scores = results.map(r => r.score / r.totalPoints * 10);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;
  const W = 200; const H = 48; const PAD = 4;
  const pts = scores.map((s, i) => {
    const x = PAD + (i / (scores.length - 1)) * (W - PAD * 2);
    const y = H - PAD - ((s - min) / range) * (H - PAD * 2);
    return `${x},${y}`;
  });
  const last = pts[pts.length - 1].split(",");
  return (
    <div className="mt-3 rounded-xl p-3" style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)" }}>
      <p className="text-xs font-semibold mb-2" style={{ color: "var(--kin-chu-mo)" }}>Xu hướng điểm số</p>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height: H }}>
        <polyline points={pts.join(" ")} fill="none" stroke="var(--kin-nhan-nen)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={last[0]} cy={last[1]} r="3.5" fill="var(--kin-nhan-nen)" />
      </svg>
      <div className="flex justify-between mt-1">
        <span className="text-[length:var(--kin-co-caption)]" style={{ color: "var(--kin-chu-mo)" }}>{results[0].exam?.title?.slice(0, 18) ?? "Đề 1"}</span>
        <span className="text-[length:var(--kin-co-caption)] font-bold" style={{ color: "var(--kin-nhan-link)" }}>
          Mới nhất: {scores[scores.length - 1].toFixed(1)}
        </span>
      </div>
    </div>
  );
}

// ─── Streak Calendar ─────────────────────────────────────────────────────────
function StreakCalendar({ counts }: { counts: Record<string, number> }) {
  const days = useMemo(() => {
    const arr: { date: string; count: number }[] = [];
    const today = new Date();
    for (let i = 59; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      arr.push({ date: key, count: counts[key] ?? 0 });
    }
    return arr;
  }, [counts]);

  function cellColor(count: number) {
    if (count === 0) return "var(--kin-vien-thuong)";
    if (count === 1) return "var(--kin-nhan-vien)";
    if (count <= 3) return "color-mix(in srgb, var(--kin-nhan-nen) 60%, var(--kin-nen-trang))";
    return "var(--kin-nhan-nen)";
  }

  return (
    <div className="rounded-xl p-4" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}>
      <p className="text-sm font-bold mb-3" style={{ color: "var(--kin-chu-phu)" }}>Lịch học 60 ngày</p>
      <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(12, 1fr)" }}>
        {days.map(d => (
          <div key={d.date} title={`${d.date}: ${d.count} bài`}
            className="aspect-square rounded-sm"
            style={{ background: cellColor(d.count) }} />
        ))}
      </div>
      <div className="flex items-center gap-2 mt-2 justify-end">
        <span className="text-[length:var(--kin-co-caption)]" style={{ color: "var(--kin-chu-mo)" }}>Ít</span>
        {[0, 1, 2, 4].map(n => (
          <div key={n} className="w-3 h-3 rounded-sm" style={{ background: cellColor(n) }} />
        ))}
        <span className="text-[length:var(--kin-co-caption)]" style={{ color: "var(--kin-chu-mo)" }}>Nhiều</span>
      </div>
    </div>
  );
}

interface ProfileData {
  studentId: number | null;
  name: string;
  email: string;
  phone: string | null;
  parentPhone: string | null;
  parentName: string | null;
  highSchool: string | null;
  city: string | null;
  facebookUrl: string | null;
  zaloPhone: string | null;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function HoSoPage() {
  const { user, logout } = useAuth();
  const [profile,           setProfile]           = useState<ProfileData | null>(null);
  const [toast,             setToast]             = useState<ToastType | null>(null);
  const [examResults,       setExamResults]       = useState<ExamResultItem[]>([]);
  const [earnedBadgeIds,    setEarnedBadgeIds]    = useState<Set<string>>(new Set());
  const [userStats,         setUserStats]         = useState<UserStats | null>(null);
  const [activityCounts,    setActivityCounts]    = useState<Record<string, number>>({});
  const [enrolledCourses,   setEnrolledCourses]   = useState<EnrolledCourseItem[]>([]);

  // ── Avatar ──
  const [avatarSrc,    setAvatarSrc]    = useState<string | null>(null);
  const [cropSrc,      setCropSrc]      = useState<string | null>(null);
  const [crop,         setCrop]         = useState({ x: 0, y: 0 });
  const [zoom,         setZoom]         = useState(1);
  const [croppedArea,  setCroppedArea]  = useState<Area | null>(null);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Profile edit ──
  const [editSection, setEditSection] = useState<"info" | "parent" | "social" | null>(null);
  const [form, setForm] = useState({
    name: "", phone: "", highSchool: "", city: "",
    parentName: "", parentPhone: "",
    facebookUrl: "", zaloPhone: "",
  });
  const [saving, setSaving] = useState(false);

  // ── Password modal ──
  const [showPassModal, setShowPassModal] = useState(false);
  const [passForm,      setPassForm]      = useState({ old: "", new: "", confirm: "" });
  const [passError,     setPassError]     = useState("");
  const [passSaving,    setPassSaving]    = useState(false);

  // ── Logout confirm ──
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  function showToast(msg: string, type: ToastType["type"] = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    fetch("/api/users/me")
      .then(r => r.ok ? r.json() : null)
      .then((d: ProfileData | null) => {
        if (!d) return;
        setProfile(d);
        setForm({
          name:        d.name        ?? "",
          phone:       d.phone       ?? "",
          highSchool:  d.highSchool  ?? "",
          city:        d.city        ?? "",
          parentName:  d.parentName  ?? "",
          parentPhone: d.parentPhone ?? "",
          facebookUrl: d.facebookUrl ?? "",
          zaloPhone:   d.zaloPhone   ?? "",
        });
      })
      .catch(() => {});

    fetch("/api/exam-results?mine=true")
      .then(r => r.ok ? r.json() : [])
      .then(setExamResults)
      .catch(() => {});
    fetch("/api/my-badges")
      .then(r => r.ok ? r.json() : [])
      .then((ids: string[]) => setEarnedBadgeIds(new Set(ids)))
      .catch(() => {});
    fetch("/api/users/me/avatar")
      .then(r => r.ok ? r.json() : {})
      .then((d: { avatarBase64?: string | null }) => { if (d.avatarBase64) setAvatarSrc(d.avatarBase64); })
      .catch(() => {});
    fetch("/api/users/me/stats")
      .then(r => r.ok ? r.json() : null)
      .then((d: UserStats | null) => { if (d) setUserStats(d); })
      .catch(() => {});
    fetch("/api/users/me/activity")
      .then(r => r.ok ? r.json() : { counts: {} })
      .then((d: { counts: Record<string, number> }) => setActivityCounts(d.counts))
      .catch(() => {});

    fetch("/api/enrollments")
      .then(r => r.ok ? r.json() : { courseIds: [] })
      .then((d: { courseIds: string[] }) => {
        if (!d.courseIds?.length) return;
        fetch("/api/courses")
          .then(r => r.ok ? r.json() : [])
          .then((courses: EnrolledCourseItem[]) => {
            const ids = new Set(d.courseIds);
            setEnrolledCourses(courses.filter(c => ids.has(c.id)));
          })
          .catch(() => {});
      })
      .catch(() => {});

  }, []);

  // ── Avatar crop ──
  function loadAvatarFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.readAsDataURL(file);
  }
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    loadAvatarFile(file);
  }

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedArea(croppedPixels);
  }, []);

  async function handleSaveAvatar() {
    if (!cropSrc || !croppedArea) return;
    setAvatarSaving(true);
    try {
      const base64 = await getCroppedImg(cropSrc, croppedArea);
      const res = await fetch("/api/users/me/avatar", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarBase64: base64 }),
      });
      if (!res.ok) { showToast("Lỗi lưu ảnh đại diện", "error"); return; }
      setAvatarSrc(base64);
      setCropSrc(null);
      showToast("Đã cập nhật ảnh đại diện", "success");
    } catch {
      showToast("Lỗi xử lý ảnh", "error");
    } finally {
      setAvatarSaving(false);
    }
  }

  // ── Profile save ──
  async function handleSaveProfile() {
    if (!form.name.trim()) { showToast("Tên không được để trống", "error"); return; }
    setSaving(true);
    const res = await fetch("/api/users/me", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) {
      const updated: ProfileData = await res.json();
      setProfile(updated);
      showToast("Đã lưu thay đổi", "success");
      setEditSection(null);
    } else {
      showToast("Lỗi cập nhật", "error");
    }
  }

  // ── Password ──
  async function handleChangePass() {
    setPassError("");
    if (!passForm.old)                     { setPassError("Nhập mật khẩu hiện tại"); return; }
    if (passForm.new.length < 8)           { setPassError("Mật khẩu mới cần ít nhất 8 ký tự"); return; }
    if (passForm.new !== passForm.confirm) { setPassError("Mật khẩu xác nhận không khớp"); return; }
    setPassSaving(true);
    const res  = await fetch("/api/auth/change-password", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oldPassword: passForm.old, newPassword: passForm.new }),
    });
    const data = await res.json();
    setPassSaving(false);
    if (!res.ok) { setPassError(data.error ?? "Đổi mật khẩu thất bại"); return; }
    setShowPassModal(false);
    setPassForm({ old: "", new: "", confirm: "" });
    showToast("Đổi mật khẩu thành công!", "success");
  }

  const displayName  = profile?.name ?? user?.name ?? "Học viên";
  const studentId    = profile?.studentId;
  const studentIdStr = studentId ? `HS-${studentId}` : undefined;
  const avatarLetter = displayName.charAt(0).toUpperCase();

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-4xl">
      {toast && <ToastBar toast={toast} />}

      {/* ── Crop modal ── */}
      {cropSrc && (
        <div className="fixed inset-0 z-[150] flex flex-col items-center justify-center" style={{ background: "rgba(0,0,0,0.85)" }}>
          <div className="relative w-72 h-72 rounded-xl overflow-hidden">
            <Cropper
              image={cropSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>
          <div className="flex items-center gap-3 mt-6">
            <input type="range" min={1} max={3} step={0.01} value={zoom}
              onChange={e => setZoom(Number(e.target.value))} className="w-40 accent-blue-500" />
          </div>
          <div className="flex gap-3 mt-5">
            <button onClick={() => setCropSrc(null)}
              className="px-5 py-2.5 rounded-lg text-sm font-medium"
              style={{ background: "var(--kin-chu-phu)", color: "var(--kin-chu-mo)", borderRadius: "8px" }}>
              Hủy
            </button>
            <button onClick={handleSaveAvatar} disabled={avatarSaving}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: "var(--kin-nhan-nen)", borderRadius: "8px" }}>
              {avatarSaving ? "Đang lưu..." : "Lưu ảnh"}
            </button>
          </div>
        </div>
      )}

      {/* ── Password modal ── */}
      {showPassModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="w-full max-w-sm rounded-xl p-6" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)", boxShadow: "rgba(15,15,15,0.1) 0px 4px 20px 0px" }}>
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: "var(--kin-chu-chinh)" }}>
              <Key size={20} /> Đổi mật khẩu
            </h2>
            <div className="space-y-3">
              {[
                { label: "Mật khẩu hiện tại",    key: "old"     },
                { label: "Mật khẩu mới",          key: "new"     },
                { label: "Xác nhận mật khẩu mới", key: "confirm" },
              ].map(({ label, key }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "var(--kin-chu-phu)" }}>{label}</label>
                  <input type="password"
                    value={passForm[key as keyof typeof passForm]}
                    onChange={e => setPassForm(p => ({ ...p, [key]: e.target.value }))}
                    className="notion-input w-full text-sm" style={{ color: "var(--kin-chu-chinh)" }} />
                </div>
              ))}
              {passError && <p className="text-xs" style={{ color: "var(--kin-tt-chu-loi)" }}>{passError}</p>}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setShowPassModal(false); setPassError(""); }}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium"
                style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)", color: "var(--kin-chu-mo)", borderRadius: "8px" }}>
                Hủy
              </button>
              <button onClick={handleChangePass} disabled={passSaving}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: "var(--kin-nhan-nen)", borderRadius: "8px" }}>
                {passSaving ? "Đang lưu..." : "Xác nhận"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Logout confirm ── */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="w-full max-w-xs rounded-xl p-6" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)", boxShadow: "rgba(15,15,15,0.1) 0px 4px 20px 0px" }}>
            <h2 className="text-base font-bold mb-2" style={{ color: "var(--kin-chu-chinh)" }}>Đăng xuất?</h2>
            <p className="text-sm mb-5" style={{ color: "var(--kin-chu-mo)" }}>Bạn sẽ được đăng xuất khỏi thiết bị này. Thiết bị khác (nếu có) vẫn đăng nhập.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium"
                style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)", color: "var(--kin-chu-mo)", borderRadius: "8px" }}>
                Hủy
              </button>
              <button onClick={() => { setShowLogoutConfirm(false); showToast("Đang đăng xuất...", "info"); setTimeout(() => logout(), 1500); }}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-[var(--kin-chu-tren-nut-chinh)]"
                style={{ background: "var(--kin-tt-chu-loi)", borderRadius: "8px" }}>
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Profile header ── */}
      <div className="rounded-xl p-6" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}>
        <div className="flex items-start gap-5 flex-wrap">
          <DropZone onFiles={files => files[0] && loadAvatarFile(files[0])} className="relative flex-shrink-0 rounded-xl">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
            {avatarSrc ? (
              <img src={avatarSrc} alt="avatar"
                className="w-20 h-20 rounded-xl object-cover"
                style={{ border: "1px solid var(--kin-vien-thuong)" }} />
            ) : (
              <div className="w-20 h-20 rounded-xl flex items-center justify-center text-4xl font-black text-white"
                style={{ background: "var(--kin-nhan-nen)" }}>
                {avatarLetter}
              </div>
            )}
            <button onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "var(--kin-nhan-nen)", border: "2px solid var(--kin-nen-trang)" }}
              title="Đổi ảnh đại diện (hoặc kéo-thả ảnh vào đây)">
              <PhotoCamera size={13} style={{ color: "var(--kin-chu-tren-nut-chinh)" }} />
            </button>
          </DropZone>

          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold" style={{ color: "var(--kin-chu-chinh)", letterSpacing: "-0.3px" }}>{displayName}</h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--kin-chu-mo)" }}>
              {profile?.email ?? user?.email}{profile?.phone ? ` · ${profile.phone}` : ""}
            </p>
            {(profile?.highSchool || profile?.city) && (
              <p className="text-sm mt-0.5" style={{ color: "var(--kin-chu-mo)" }}>
                {[profile.highSchool, profile.city].filter(Boolean).join(" · ")}
              </p>
            )}
            <div className="flex items-center gap-2 mt-3">
              <span className="px-3 py-1 rounded-full text-xs font-semibold text-white" style={{ background: "var(--kin-nhan-nen)" }}>Học viên</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">

          {/* ── Thông tin học sinh ── */}
          <Section title="Thông tin học sinh"
            onEdit={() => setEditSection(editSection === "info" ? null : "info")}>
            {editSection === "info" ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InputField label="Họ và tên *" value={form.name} onChange={v => setForm(p => ({ ...p, name: v }))} placeholder="Nguyễn Văn A" />
                  <InputField label="Số điện thoại" value={form.phone} onChange={v => setForm(p => ({ ...p, phone: v }))} type="tel" placeholder="0901 234 567" />
                  <InputField label="Trường THPT" value={form.highSchool} onChange={v => setForm(p => ({ ...p, highSchool: v }))} placeholder="THPT Chu Văn An" />
                  <InputField label="Tỉnh / Thành phố" value={form.city} onChange={v => setForm(p => ({ ...p, city: v }))} placeholder="Hà Nội" />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setEditSection(null)}
                    className="px-4 py-2 rounded-lg text-sm font-medium"
                    style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)", color: "var(--kin-chu-mo)", borderRadius: "8px" }}>
                    Hủy
                  </button>
                  <button onClick={handleSaveProfile} disabled={saving}
                    className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
                    style={{ background: "var(--kin-nhan-nen)", borderRadius: "8px" }}>
                    {saving ? "Đang lưu..." : "Lưu thay đổi"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                <InfoRow label="Mã học viên"   value={studentIdStr} />
                <InfoRow label="Họ và tên"     value={profile?.name} />
                <InfoRow label="Số điện thoại" value={profile?.phone} />
                <InfoRow label="Trường THPT"   value={profile?.highSchool} />
                <InfoRow label="Tỉnh / TP"     value={profile?.city} />
                <InfoRow label="Email"          value={profile?.email} />
              </div>
            )}
          </Section>

          {/* ── Thông tin phụ huynh ── */}
          <Section title="Thông tin phụ huynh"
            onEdit={() => setEditSection(editSection === "parent" ? null : "parent")}>
            {editSection === "parent" ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InputField label="Họ tên phụ huynh" value={form.parentName} onChange={v => setForm(p => ({ ...p, parentName: v }))} placeholder="Nguyễn Văn B" />
                  <InputField label="Số điện thoại" value={form.parentPhone} onChange={v => setForm(p => ({ ...p, parentPhone: v }))} type="tel" placeholder="0901 234 567" />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setEditSection(null)}
                    className="px-4 py-2 rounded-lg text-sm font-medium"
                    style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)", color: "var(--kin-chu-mo)", borderRadius: "8px" }}>
                    Hủy
                  </button>
                  <button onClick={handleSaveProfile} disabled={saving}
                    className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
                    style={{ background: "var(--kin-nhan-nen)", borderRadius: "8px" }}>
                    {saving ? "Đang lưu..." : "Lưu thay đổi"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                <InfoRow label="Họ tên"        value={profile?.parentName} />
                <InfoRow label="Số điện thoại" value={profile?.parentPhone} />
              </div>
            )}
          </Section>

          {/* ── Liên kết phụ huynh (ParentLink có xác minh) ── */}
          <ParentLinkWidget onNotify={showToast} />

          {/* ── Mạng xã hội ── */}
          <Section title="Mạng xã hội"
            onEdit={() => setEditSection(editSection === "social" ? null : "social")}>
            {editSection === "social" ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InputField label="Facebook" value={form.facebookUrl} onChange={v => setForm(p => ({ ...p, facebookUrl: v }))} placeholder="https://facebook.com/username" />
                  <InputField label="Zalo (số điện thoại)" value={form.zaloPhone} onChange={v => setForm(p => ({ ...p, zaloPhone: v }))} type="tel" placeholder="0901 234 567" />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setEditSection(null)}
                    className="px-4 py-2 rounded-lg text-sm font-medium"
                    style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)", color: "var(--kin-chu-mo)", borderRadius: "8px" }}>
                    Hủy
                  </button>
                  <button onClick={handleSaveProfile} disabled={saving}
                    className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
                    style={{ background: "var(--kin-nhan-nen)", borderRadius: "8px" }}>
                    {saving ? "Đang lưu..." : "Lưu thay đổi"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="flex gap-3 items-center">
                  <span className="text-xs w-32 flex-shrink-0" style={{ color: "var(--kin-chu-mo)" }}>Facebook</span>
                  {profile?.facebookUrl
                    ? <a href={profile.facebookUrl} target="_blank" rel="noopener noreferrer"
                        className="text-sm font-medium truncate max-w-[220px]"
                        style={{ color: "var(--kin-nhan-link)" }}>{profile.facebookUrl}</a>
                    : <span className="text-sm" style={{ color: "var(--kin-vien-o-nhap)" }}>Chưa cập nhật</span>}
                </div>
                <InfoRow label="Zalo" value={profile?.zaloPhone} />
              </div>
            )}
          </Section>

          {/* ── Lịch sử thi ── */}
          <div className="rounded-xl p-5" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}>
            <h2 className="text-sm font-bold mb-4" style={{ color: "var(--kin-chu-phu)" }}>Lịch sử thi &amp; điểm số</h2>
            {examResults.length === 0 ? (
              <p className="text-sm text-center py-6" style={{ color: "var(--kin-chu-mo)" }}>Chưa có kết quả thi nào</p>
            ) : (
              <div className="space-y-2">
                {examResults.map((entry, i) => (
                  <div key={entry.id} className="flex items-center gap-4 p-4 rounded-xl"
                    style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)" }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: i === 0 ? "var(--kin-tt-nen-cho)" : "var(--kin-nen-bang)", border: `1px solid ${i === 0 ? "var(--kin-tt-vien-cho)" : "var(--kin-vien-thuong)"}` }}>
                      {i === 0
                        ? <Trophy size={20} style={{ color: "var(--kin-tt-chu-cho)" }} />
                        : <span className="text-xs font-bold" style={{ color: "var(--kin-chu-mo)" }}>#{i + 1}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold" style={{ color: "var(--kin-chu-phu)" }}>{entry.exam?.title ?? entry.id}</p>
                      <p className="text-xs" style={{ color: "var(--kin-chu-mo)" }}>{new Date(entry.completedAt).toLocaleDateString("vi-VN")}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-xl font-bold" style={{ color: "var(--kin-nhan-link)" }}>{entry.score}</div>
                      <div className="text-xs" style={{ color: "var(--kin-chu-mo)" }}>/ {entry.totalPoints}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <ScoreSparkline results={examResults} />
          </div>

          {/* ── Khóa học ── */}
          <div className="rounded-xl p-5" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}>
            <h2 className="text-sm font-bold mb-4" style={{ color: "var(--kin-chu-phu)" }}>Khóa học đã đăng ký</h2>
            {enrolledCourses.length === 0 ? (
              <p className="text-sm text-center py-4" style={{ color: "var(--kin-chu-mo)" }}>Chưa đăng ký khóa học nào.</p>
            ) : (
              <div className="space-y-2">
                {enrolledCourses.map(c => (
                  <a key={c.id} href={`/student/hoc-tap?course=${c.id}`}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl hover:opacity-80"
                    style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)" }}>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: "var(--kin-chu-phu)" }}>{c.name}</p>
                      <p className="text-xs" style={{ color: "var(--kin-chu-mo)" }}>{c.category} · {c.lessons} bài</p>
                    </div>
                    <span className="text-xs font-semibold flex-shrink-0" style={{ color: "var(--kin-nhan-link)" }}>Vào học →</span>
                  </a>
                ))}
              </div>
            )}
            <p className="text-xs text-center pt-3" style={{ color: "var(--kin-chu-mo)" }}>
              Xem tiến độ chi tiết tại{" "}
              <a href="/student/hoc-tap" className="font-semibold" style={{ color: "var(--kin-nhan-link)" }}>Trang khóa học</a>
            </p>
          </div>
        </div>

        {/* ── Right column ── */}
        <div className="space-y-5">

          {/* ── Stats (real) ── */}
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                label: "GPA trung bình",
                value: userStats?.gpa != null ? userStats.gpa.toFixed(1) : "—",
                color: "var(--kin-tt-chu-cho)", bg: "var(--kin-chu-tren-nut-chinh)", border: "var(--kin-tt-vien-cho)",
                sub: "/ 10 điểm",
              },
              {
                label: "Xếp hạng",
                value: userStats?.rank != null ? `#${userStats.rank}` : "—",
                color: "var(--kin-nhan-link)", bg: "var(--kin-nhan-nen-nhat)", border: "var(--kin-nhan-vien)",
                sub: userStats?.totalStudents ? `/ ${userStats.totalStudents} HV` : "toàn trường",
              },
              {
                label: "Streak",
                value: userStats != null ? `${userStats.streak} ngày` : "—",
                color: "var(--kin-tt-chu-loi)", bg: "var(--kin-chu-tren-nut-chinh)", border: "var(--kin-tt-vien-loi)",
                sub: "liên tiếp",
              },
              {
                label: "EXP tổng",
                value: userStats != null ? userStats.exp.toLocaleString("vi-VN") : "—",
                color: "var(--kin-nhan-link)", bg: "var(--kin-chu-tren-nut-chinh)", border: "var(--kin-nhan-vien)",
                sub: "điểm kinh nghiệm",
              },
            ].map((s) => (
              <div key={s.label} className="rounded-xl p-3" style={{ background: s.bg, border: `1px solid ${s.border}` }}>
                <div className="text-lg font-bold mb-0.5" style={{ color: s.color }}>{s.value}</div>
                <div className="text-xs font-semibold" style={{ color: "var(--kin-chu-phu)" }}>{s.label}</div>
                <div className="text-xs mt-0.5" style={{ color: "var(--kin-chu-mo)" }}>{s.sub}</div>
              </div>
            ))}
          </div>

          {/* ── Huy hiệu (từ DB) ── */}
          <div className="rounded-xl p-5" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}>
            <h2 className="text-sm font-bold mb-4" style={{ color: "var(--kin-chu-phu)" }}>Huy hiệu</h2>
            <div className="grid grid-cols-3 gap-3">
              {BADGE_RULES.map(badge => {
                const earned = earnedBadgeIds.has(badge.id);
                return (
                  <div key={badge.id} className="text-center" style={{ opacity: earned ? 1 : 0.4 }}>
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-1 text-2xl"
                      style={{ background: earned ? badge.bg : "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)" }}>
                      {badge.icon}
                    </div>
                    <p className="text-xs leading-tight" style={{ color: earned ? "var(--kin-chu-phu)" : "var(--kin-chu-mo)" }}>{badge.title}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Streak Calendar ── */}
          <StreakCalendar counts={activityCounts} />

          <PhoneLoginCard compact profilePhone={profile?.phone ?? null} />

          {/* ── Bảo mật ── */}
          <div className="rounded-xl p-5" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}>
            <h2 className="text-sm font-bold mb-3" style={{ color: "var(--kin-chu-phu)" }}>Bảo mật</h2>
            <div className="space-y-2">
              <button onClick={() => setShowPassModal(true)}
                className="w-full py-2.5 rounded-lg text-sm font-medium text-left px-4"
                style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)", color: "var(--kin-chu-phu)", borderRadius: "8px" }}>
                Đổi mật khẩu →
              </button>
              <button onClick={() => setShowLogoutConfirm(true)}
                className="w-full py-2.5 rounded-lg text-sm font-medium text-left px-4"
                style={{ background: "var(--kin-tt-nen-loi)", border: "1px solid var(--kin-tt-vien-loi)", color: "var(--kin-tt-chu-loi)", borderRadius: "8px" }}>
                Đăng xuất
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
