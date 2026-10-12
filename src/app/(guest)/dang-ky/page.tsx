"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Eye, EyeOff, CheckCircle, CloseCircle } from "griddy-icons";
import { KinLogo } from "@/components/kin/KinLogo";

// Danh sách 34 tỉnh/thành sau sáp nhập (2025)
const PROVINCES = [
  "Tỉnh An Giang","Tỉnh Bắc Ninh","Tỉnh Cà Mau","Tỉnh Cao Bằng",
  "Thành phố Cần Thơ","Thành phố Đà Nẵng","Tỉnh Đắk Lắk","Tỉnh Điện Biên",
  "Tỉnh Đồng Nai","Tỉnh Đồng Tháp","Tỉnh Gia Lai","Thành phố Hà Nội",
  "Tỉnh Hà Tĩnh","Thành phố Hải Phòng","Thành phố Hồ Chí Minh","Thành phố Huế",
  "Tỉnh Hưng Yên","Tỉnh Khánh Hòa","Tỉnh Lai Châu","Tỉnh Lâm Đồng",
  "Tỉnh Lạng Sơn","Tỉnh Lào Cai","Tỉnh Nghệ An","Tỉnh Ninh Bình",
  "Tỉnh Phú Thọ","Tỉnh Quảng Ngãi","Tỉnh Quảng Ninh","Tỉnh Quảng Trị",
  "Tỉnh Sơn La","Tỉnh Tây Ninh","Tỉnh Thái Nguyên","Tỉnh Thanh Hóa",
  "Tỉnh Tuyên Quang","Tỉnh Vĩnh Long",
];

// FE-100 (06/10/2026): thêm chọn vai trò Học viên / Gia sư.
type Role = "student" | "tutor";

// Các môn gia sư có thể chọn khi đăng ký. Giữ danh sách ngắn — khi được
// duyệt, gia sư có thể bổ sung từ /tutor-ho-so (BE-049).
const TUTOR_SUBJECTS = [
  "Toán", "Vật lý", "Hóa học", "Sinh học", "Ngữ văn", "Lịch sử",
  "Địa lý", "Tiếng Anh", "Tin học", "GDCD", "Kỹ năng mềm", "Khác",
];

interface Step1Fields {
  name: string; phone: string; parentPhone: string; city: string; school: string;
  // FE-100: field riêng của Gia sư — chỉ validate khi role === "tutor"
  bio: string; subjects: string[];
}
interface Step2Fields {
  email: string; password: string; confirmPassword: string;
}
interface Step1Errors {
  name?: string; phone?: string; parentPhone?: string; city?: string; school?: string;
  bio?: string; subjects?: string;
}
interface Step2Errors {
  email?: string; password?: string; confirmPassword?: string;
}

function validatePhone(p: string) { return /^(0[3|5|7|8|9])[0-9]{8}$/.test(p.replace(/\s/g, "")); }
function validateEmail(e: string)  { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim()); }

function validateStep1(f: Step1Fields, role: Role): Step1Errors {
  const e: Step1Errors = {};
  if (!f.name.trim())        e.name = "Vui lòng nhập họ và tên";
  if (!f.phone.trim())       e.phone = "Vui lòng nhập số điện thoại có Zalo";
  else if (!validatePhone(f.phone)) e.phone = "Số điện thoại không hợp lệ";
  if (f.parentPhone.trim() && !validatePhone(f.parentPhone))
                             e.parentPhone = "Số điện thoại không hợp lệ";
  if (!f.city)               e.city = "Vui lòng chọn tỉnh / thành phố";
  // Trường chỉ bắt buộc với học viên — gia sư không nhất thiết đang đi học.
  if (role === "student" && !f.school.trim()) e.school = "Vui lòng nhập tên trường";
  // Field riêng gia sư
  if (role === "tutor") {
    if (!f.bio.trim())                e.bio = "Vui lòng viết vài dòng giới thiệu";
    else if (f.bio.trim().length < 30) e.bio = "Giới thiệu cần ít nhất 30 ký tự";
    if (!f.subjects.length)           e.subjects = "Chọn ít nhất 1 môn dạy";
  }
  return e;
}

function validateStep2(f: Step2Fields): Step2Errors {
  const e: Step2Errors = {};
  if (!f.email.trim())          e.email = "Vui lòng nhập email";
  else if (!validateEmail(f.email)) e.email = "Email không đúng định dạng";
  if (!f.password)              e.password = "Vui lòng nhập mật khẩu";
  else if (f.password.length < 8) e.password = "Mật khẩu cần ít nhất 8 ký tự";
  if (!f.confirmPassword)       e.confirmPassword = "Vui lòng xác nhận mật khẩu";
  else if (f.confirmPassword !== f.password) e.confirmPassword = "Mật khẩu xác nhận không khớp";
  return e;
}

function getPasswordStrength(p: string) {
  if (!p) return { level: 0, label: "", color: "" };
  if (p.length < 6)  return { level: 1, label: "Quá yếu",    color: "var(--kin-tt-chu-loi)" };
  if (p.length < 8)  return { level: 2, label: "Yếu",        color: "var(--kin-tt-chu-cho)" };
  if (p.length < 12 && /[A-Z]/.test(p) && /[0-9]/.test(p))
                     return { level: 4, label: "Mạnh",        color: "var(--kin-tt-chu-xong)" };
  if (/[A-Z]/.test(p) && /[0-9]/.test(p) && /[^A-Za-z0-9]/.test(p))
                     return { level: 5, label: "Rất mạnh",    color: "var(--kin-nhan-link)" };
  return             { level: 3, label: "Trung bình",         color: "var(--kin-tt-chu-cho)" };
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p className="text-xs mt-1 flex items-center gap-1" style={{ color: "var(--kin-tt-chu-loi)" }}>
      <CloseCircle size={11} /> {msg}
    </p>
  );
}

function FieldIcon({ touched, hasError, hasValue }: { touched: boolean; hasError: boolean; hasValue: boolean }) {
  if (!touched) return null;
  if (hasError)  return <CloseCircle size={14} style={{ color: "var(--kin-tt-chu-loi)" }} />;
  if (hasValue)  return <CheckCircle size={14} style={{ color: "var(--kin-tt-chu-xong)" }} />;
  return null;
}

export default function DangKyPage() {
  useAuth();

  const [step, setStep]       = useState<1 | 2>(1);
  const [role, setRole]       = useState<Role>("student"); // FE-100
  // PH-207: link "Tạo hồ sơ của bạn" ở hồ sơ công khai mở thẳng vai Gia sư (?vai=gia-su). Đọc sau khi gắn kết để không lệch với bản dựng ở máy chủ.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("vai") === "gia-su") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRole("tutor");
    }
  }, []);
  const [agreed, setAgreed]   = useState(false);
  const [showPass, setShowPass]       = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [submitted, setSubmitted]     = useState(false);
  const [serverError, setServerError] = useState("");
  const [emailSent, setEmailSent]     = useState(true);

  const [s1, setS1] = useState<Step1Fields>({ name: "", phone: "", parentPhone: "", city: "", school: "", bio: "", subjects: [] });
  const [s2, setS2] = useState<Step2Fields>({ email: "", password: "", confirmPassword: "" });
  const [t1, setT1] = useState<Partial<Record<keyof Step1Fields, boolean>>>({});
  const [t2, setT2] = useState<Partial<Record<keyof Step2Fields, boolean>>>({});

  const e1 = validateStep1(s1, role);
  const e2 = validateStep2(s2);
  const strength = getPasswordStrength(s2.password);

  function blurAll1() {
    setT1({ name: true, phone: true, city: true, school: true, bio: true, subjects: true });
  }
  function blurAll2() { setT2({ email: true, password: true, confirmPassword: true }); }

  function toggleSubject(s: string) {
    setS1(p => ({
      ...p,
      subjects: p.subjects.includes(s) ? p.subjects.filter(x => x !== s) : [...p.subjects, s],
    }));
  }

  function goNext(ev: React.FormEvent) {
    ev.preventDefault();
    blurAll1();
    if (Object.keys(e1).length === 0) setStep(2);
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    blurAll2();
    if (Object.keys(e2).length > 0 || !agreed) return;
    setSubmitting(true);
    setServerError("");
    try {
      // FE-100: role tutor → /api/auth/register-tutor (BE-050) kèm bio +
      // subjects; role student → /api/auth/register như cũ.
      const endpoint = role === "tutor" ? "/api/auth/register-tutor" : "/api/auth/register";
      const body: Record<string, unknown> = {
        name:        s1.name.trim(),
        phone:       s1.phone.replace(/\s/g, ""),
        parentPhone: s1.parentPhone.replace(/\s/g, ""),
        city:        s1.city,
        school:      s1.school.trim(),
        email:       s2.email.trim(),
        password:    s2.password,
      };
      if (role === "tutor") {
        body.bio = s1.bio.trim();
        body.subjects = s1.subjects;
      }
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setServerError(data.error ?? "Đăng ký thất bại"); return; }
      setEmailSent(data.emailSent !== false);
      setSubmitted(true);
    } catch {
      setServerError("Lỗi kết nối, vui lòng thử lại");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-16" style={{ background: "var(--kin-nen-bang)" }}>
        <div className="w-full max-w-md text-center">
          <div className="rounded-xl p-10" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)", boxShadow: "rgba(15,15,15,0.08) 0px 4px 12px 0px" }}>
            <div className="w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-5"
              style={{ background: "var(--kin-nen-nhan)", border: "1px solid var(--kin-nhan-vien)" }}>
              <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
              </svg>
            </div>
            {emailSent ? (
              <>
                <h2 className="text-xl font-bold mb-2" style={{ color: "var(--kin-chu-chinh)", letterSpacing: "-0.3px" }}>Kiểm tra hộp thư</h2>
                <p className="text-sm mb-1" style={{ color: "var(--kin-chu-mo)" }}>Đã gửi email xác thực đến</p>
                <p className="text-base font-semibold mb-5" style={{ color: "var(--kin-nhan-link)" }}>{s2.email}</p>
                <p className="text-xs leading-relaxed mb-6" style={{ color: "var(--kin-chu-mo)" }}>
                  Bấm vào link trong email để kích hoạt tài khoản.<br />
                  Link có hiệu lực trong <strong>24 giờ</strong>.
                </p>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold mb-2" style={{ color: "var(--kin-chu-chinh)", letterSpacing: "-0.3px" }}>Tài khoản đã tạo!</h2>
                <div className="rounded-lg px-4 py-3 mb-5 text-left" style={{ background: "#fff7ed", border: "1px solid #fed7aa" }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: "#c2410c" }}>Không gửi được email xác thực</p>
                  <p className="text-xs" style={{ color: "#9a3412" }}>
                    Hệ thống đang trong quá trình cấu hình email. Vui lòng liên hệ admin để kích hoạt tài khoản theo cách thủ công.
                  </p>
                </div>
              </>
            )}
            <div className="rounded-lg p-4 text-left mb-6" style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)" }}>
              {emailSent ? (
                <>
                  <p className="text-xs font-semibold mb-2" style={{ color: "var(--kin-chu-phu)" }}>Không thấy email?</p>
                  <ul className="text-xs space-y-1" style={{ color: "var(--kin-chu-mo)" }}>
                    <li>• Kiểm tra thư mục Spam / Junk</li>
                    <li>• Đợi vài phút rồi refresh hộp thư</li>
                    <li>• Kiểm tra lại email đã nhập đúng chưa</li>
                  </ul>
                </>
              ) : (
                <>
                  <p className="text-xs font-semibold mb-2" style={{ color: "var(--kin-chu-phu)" }}>Tài khoản đã đăng ký với:</p>
                  <p className="text-xs font-mono" style={{ color: "var(--kin-nhan-link)" }}>{s2.email}</p>
                </>
              )}
            </div>
            <Link href="/dang-nhap" className="text-sm font-semibold" style={{ color: "var(--kin-nhan-link)" }}>
              ← Quay về đăng nhập
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: "var(--kin-nen-bang)" }}>
      <div className="w-full max-w-lg">

        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" aria-label="KiN — trang chủ" className="inline-flex flex-col items-center gap-2">
            <KinLogo size={36} textSize="var(--kin-co-h2)" />
            <span className="text-xs" style={{ color: "var(--kin-chu-mo)" }}>Lớp học của bạn, gọn trong một chỗ</span>
          </Link>
          <h1 className="text-xl font-bold mt-6 mb-1" style={{ color: "var(--kin-chu-chinh)", letterSpacing: "-0.3px" }}>Tạo tài khoản miễn phí</h1>
          <p className="text-sm" style={{ color: "var(--kin-chu-mo)" }}>Thi thử ĐGNL ngay sau khi đăng ký</p>
        </div>

        {/* Progress steps */}
        <div className="flex items-center gap-0 mb-6 px-2">
          {([1, 2] as const).map((n, i) => (
            <div key={n} className="flex items-center flex-1">
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                  style={{
                    background: step >= n ? "var(--kin-nhan-nen)" : "var(--kin-vien-thuong)",
                    color: step >= n ? "var(--kin-nen-trang)" : "var(--kin-chu-mo)",
                  }}>
                  {step > n ? "✓" : n}
                </div>
                <span className="text-xs font-semibold hidden sm:block" style={{ color: step >= n ? "var(--kin-chu-chinh)" : "var(--kin-chu-mo)" }}>
                  {n === 1 ? "Thông tin cá nhân" : "Tài khoản"}
                </span>
              </div>
              {i < 1 && (
                <div className="flex-1 h-px mx-3 transition-all" style={{ background: step > 1 ? "var(--kin-nhan-nen)" : "var(--kin-vien-thuong)" }} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="rounded-xl p-8" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)", boxShadow: "rgba(15,15,15,0.08) 0px 4px 12px 0px" }}>

          {/* ── BƯỚC 1 ── */}
          {step === 1 && (
            <form onSubmit={goNext} noValidate className="space-y-4">
              {/* FE-100: chọn vai trò — 2 card bấm trước khi nhập thông tin.
                  Mặc định là Học viên vì luồng chính; Gia sư là nhánh phụ dẫn
                  sang /api/auth/register-tutor để tạo đơn pending. */}
              <div>
                <p className="text-sm font-semibold mb-2" style={{ color: "var(--kin-chu-phu)" }}>Bạn đăng ký với vai trò nào? *</p>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { v: "student", label: "Học viên",  desc: "Học thử & tham gia lớp" },
                    { v: "tutor",   label: "Gia sư",    desc: "Mở lớp, dạy & hướng dẫn" },
                  ] as const).map(opt => (
                    <button key={opt.v} type="button" onClick={() => setRole(opt.v)}
                      className="rounded-xl p-3 text-left transition-all"
                      style={{
                        background: role === opt.v ? "var(--kin-nen-nhan)" : "var(--kin-nen-trang)",
                        border: `1px solid ${role === opt.v ? "var(--kin-nhan-nen)" : "var(--kin-vien-thuong)"}`,
                      }}>
                      <p className="text-sm font-bold" style={{ color: role === opt.v ? "var(--kin-nhan-nen)" : "var(--kin-chu-chinh)" }}>{opt.label}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--kin-chu-mo)" }}>{opt.desc}</p>
                    </button>
                  ))}
                </div>
                {role === "tutor" && (
                  <p className="text-xs mt-2" style={{ color: "var(--kin-tt-chu-cho)" }}>
                    Hồ sơ gia sư sẽ chờ admin duyệt (xác minh thông tin) trước khi mở lớp được.
                  </p>
                )}
              </div>

              <p className="text-sm font-semibold mb-1" style={{ color: "var(--kin-chu-phu)" }}>
                {role === "tutor" ? "Thông tin gia sư" : "Thông tin học sinh"}
              </p>

              {/* Họ và tên */}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--kin-chu-phu)" }}>Họ và tên *</label>
                <div className="relative">
                  <input type="text" placeholder="Nguyễn Văn A" value={s1.name}
                    onChange={e => setS1(p => ({ ...p, name: e.target.value }))}
                    onBlur={() => setT1(p => ({ ...p, name: true }))}
                    className="notion-input w-full text-sm pr-10" style={{ color: "var(--kin-chu-chinh)",
                      borderColor: t1.name && e1.name ? "var(--kin-tt-chu-loi)" : t1.name && !e1.name ? "var(--kin-tt-cham-xong)" : undefined }} />
                  <span className="absolute right-3 top-3">
                    <FieldIcon touched={!!t1.name} hasError={!!e1.name} hasValue={!!s1.name.trim()} />
                  </span>
                </div>
                <FieldError msg={t1.name ? e1.name : undefined} />
              </div>

              {/* SĐT học sinh + SĐT phụ huynh */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--kin-chu-phu)" }}>SĐT học sinh (Zalo) *</label>
                  <div className="relative">
                    <input type="tel" placeholder="0901 234 567" value={s1.phone}
                      onChange={e => setS1(p => ({ ...p, phone: e.target.value }))}
                      onBlur={() => setT1(p => ({ ...p, phone: true }))}
                      className="notion-input w-full text-sm pr-9" style={{ color: "var(--kin-chu-chinh)",
                        borderColor: t1.phone && e1.phone ? "var(--kin-tt-chu-loi)" : t1.phone && !e1.phone ? "var(--kin-tt-cham-xong)" : undefined }} />
                    <span className="absolute right-3 top-3">
                      <FieldIcon touched={!!t1.phone} hasError={!!e1.phone} hasValue={validatePhone(s1.phone)} />
                    </span>
                  </div>
                  <FieldError msg={t1.phone ? e1.phone : undefined} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--kin-chu-phu)" }}>
                    SĐT phụ huynh
                    <span className="ml-1 font-normal" style={{ color: "var(--kin-chu-mo)" }}>(tuỳ chọn)</span>
                  </label>
                  <div className="relative">
                    <input type="tel" placeholder="0901 234 567" value={s1.parentPhone}
                      onChange={e => setS1(p => ({ ...p, parentPhone: e.target.value }))}
                      onBlur={() => setT1(p => ({ ...p, parentPhone: true }))}
                      className="notion-input w-full text-sm pr-9" style={{ color: "var(--kin-chu-chinh)",
                        borderColor: t1.parentPhone && e1.parentPhone ? "var(--kin-tt-chu-loi)"
                          : t1.parentPhone && s1.parentPhone && !e1.parentPhone ? "var(--kin-tt-cham-xong)" : undefined }} />
                    <span className="absolute right-3 top-3">
                      <FieldIcon touched={!!t1.parentPhone && !!s1.parentPhone} hasError={!!e1.parentPhone} hasValue={validatePhone(s1.parentPhone)} />
                    </span>
                  </div>
                  <FieldError msg={t1.parentPhone ? e1.parentPhone : undefined} />
                </div>
              </div>

              {/* Tỉnh + Trường */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--kin-chu-phu)" }}>Tỉnh / Thành phố *</label>
                  <select value={s1.city}
                    onChange={e => setS1(p => ({ ...p, city: e.target.value }))}
                    onBlur={() => setT1(p => ({ ...p, city: true }))}
                    className="notion-input w-full text-sm"
                    style={{ color: s1.city ? "var(--kin-chu-chinh)" : "var(--kin-chu-mo)",
                      borderColor: t1.city && e1.city ? "var(--kin-tt-chu-loi)" : t1.city && !e1.city ? "var(--kin-tt-cham-xong)" : undefined }}>
                    <option value="">Chọn tỉnh / thành phố</option>
                    {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <FieldError msg={t1.city ? e1.city : undefined} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--kin-chu-phu)" }}>
                    {role === "tutor" ? "Trường / nơi học/làm" : "Tên trường *"}
                    {role === "tutor" && <span className="ml-1 font-normal" style={{ color: "var(--kin-chu-mo)" }}>(tuỳ chọn)</span>}
                  </label>
                  <div className="relative">
                    <input type="text" placeholder="THPT Chu Văn An" value={s1.school}
                      onChange={e => setS1(p => ({ ...p, school: e.target.value }))}
                      onBlur={() => setT1(p => ({ ...p, school: true }))}
                      className="notion-input w-full text-sm pr-9" style={{ color: "var(--kin-chu-chinh)",
                        borderColor: t1.school && e1.school ? "var(--kin-tt-chu-loi)" : t1.school && !e1.school ? "var(--kin-tt-cham-xong)" : undefined }} />
                    <span className="absolute right-3 top-3">
                      <FieldIcon touched={!!t1.school} hasError={!!e1.school} hasValue={!!s1.school.trim()} />
                    </span>
                  </div>
                  <FieldError msg={t1.school ? e1.school : undefined} />
                </div>
              </div>

              {/* FE-100: Field riêng Gia sư — bio + subjects. Render inline
                  thay vì tạo step riêng để giữ 2-bước gọn và cùng UX. */}
              {role === "tutor" && (
                <>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--kin-chu-phu)" }}>
                      Giới thiệu bản thân *
                      <span className="ml-1 font-normal" style={{ color: "var(--kin-chu-mo)" }}>(ít nhất 30 ký tự)</span>
                    </label>
                    <textarea rows={3} value={s1.bio}
                      onChange={e => setS1(p => ({ ...p, bio: e.target.value }))}
                      onBlur={() => setT1(p => ({ ...p, bio: true }))}
                      placeholder="VD: Mình là sinh viên năm 3 ĐHSP, kinh nghiệm 2 năm dạy Toán 12 ôn ĐGNL..."
                      className="notion-input w-full text-sm" style={{ color: "var(--kin-chu-chinh)",
                        borderColor: t1.bio && e1.bio ? "var(--kin-tt-chu-loi)" : t1.bio && !e1.bio ? "var(--kin-tt-cham-xong)" : undefined }} />
                    <FieldError msg={t1.bio ? e1.bio : undefined} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--kin-chu-phu)" }}>Môn dạy *</label>
                    <div className="flex flex-wrap gap-1.5">
                      {TUTOR_SUBJECTS.map(s => {
                        const picked = s1.subjects.includes(s);
                        return (
                          <button key={s} type="button" onClick={() => toggleSubject(s)}
                            className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                            style={picked
                              ? { background: "var(--kin-nhan-nen)", color: "var(--kin-nhan-chu-tren-nen)" }
                              : { background: "var(--kin-nen-trang)", color: "var(--kin-chu-phu)", border: "1px solid var(--kin-vien-thuong)" }}>
                            {s}
                          </button>
                        );
                      })}
                    </div>
                    <FieldError msg={t1.subjects ? e1.subjects : undefined} />
                  </div>
                </>
              )}

              <button type="submit"
                className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all mt-2"
                style={{ background: "var(--kin-nhan-nen)", borderRadius: "8px" }}>
                Tiếp theo →
              </button>
            </form>
          )}

          {/* ── BƯỚC 2 ── */}
          {step === 2 && (
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <p className="text-sm font-semibold mb-1" style={{ color: "var(--kin-chu-phu)" }}>Thông tin tài khoản</p>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--kin-chu-phu)" }}>Email *</label>
                <div className="relative">
                  <input type="email" placeholder="ten@gmail.com" value={s2.email}
                    onChange={e => setS2(p => ({ ...p, email: e.target.value }))}
                    onBlur={() => setT2(p => ({ ...p, email: true }))}
                    className="notion-input w-full text-sm pr-10" style={{ color: "var(--kin-chu-chinh)",
                      borderColor: t2.email && e2.email ? "var(--kin-tt-chu-loi)" : t2.email && !e2.email ? "var(--kin-tt-cham-xong)" : undefined }} />
                  <span className="absolute right-3 top-3">
                    <FieldIcon touched={!!t2.email} hasError={!!e2.email} hasValue={validateEmail(s2.email)} />
                  </span>
                </div>
                <FieldError msg={t2.email ? e2.email : undefined} />
              </div>

              {/* Mật khẩu + Xác nhận */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--kin-chu-phu)" }}>Mật khẩu *</label>
                  <div className="relative">
                    <input type={showPass ? "text" : "password"} placeholder="Tối thiểu 8 ký tự"
                      value={s2.password}
                      onChange={e => setS2(p => ({ ...p, password: e.target.value }))}
                      onBlur={() => setT2(p => ({ ...p, password: true }))}
                      className="notion-input w-full text-sm pr-9" style={{ color: "var(--kin-chu-chinh)",
                        borderColor: t2.password && e2.password ? "var(--kin-tt-chu-loi)" : undefined }} />
                    <button type="button" className="absolute right-3 top-3" style={{ color: "var(--kin-chu-mo)" }}
                      onClick={() => setShowPass(!showPass)}>
                      {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {s2.password.length > 0 && (
                    <div className="mt-1.5">
                      <div className="flex gap-0.5 mb-0.5">
                        {[1,2,3,4,5].map(i => (
                          <div key={i} className="flex-1 h-1 rounded-full transition-all"
                            style={{ background: i <= strength.level ? strength.color : "var(--kin-vien-thuong)" }} />
                        ))}
                      </div>
                      {strength.label && <p className="text-xs font-semibold" style={{ color: strength.color }}>{strength.label}</p>}
                    </div>
                  )}
                  <FieldError msg={t2.password ? e2.password : undefined} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--kin-chu-phu)" }}>Xác nhận mật khẩu *</label>
                  <div className="relative">
                    <input type={showConfirm ? "text" : "password"} placeholder="Nhập lại mật khẩu"
                      value={s2.confirmPassword}
                      onChange={e => setS2(p => ({ ...p, confirmPassword: e.target.value }))}
                      onBlur={() => setT2(p => ({ ...p, confirmPassword: true }))}
                      className="notion-input w-full text-sm pr-9" style={{ color: "var(--kin-chu-chinh)",
                        borderColor: t2.confirmPassword && e2.confirmPassword ? "var(--kin-tt-chu-loi)"
                          : t2.confirmPassword && !e2.confirmPassword ? "var(--kin-tt-cham-xong)" : undefined }} />
                    <button type="button" className="absolute right-3 top-3" style={{ color: "var(--kin-chu-mo)" }}
                      onClick={() => setShowConfirm(!showConfirm)}>
                      {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  <FieldError msg={t2.confirmPassword ? e2.confirmPassword : undefined} />
                </div>
              </div>

              {serverError && (
                <div className="px-4 py-3 rounded-lg text-sm font-medium"
                  style={{ background: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca" }}>
                  {serverError}
                </div>
              )}

              {/* Terms */}
              <div className="flex items-start gap-3 pt-1">
                <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}
                  className="w-4 h-4 rounded flex-shrink-0 mt-0.5 cursor-pointer accent-blue-600" />
                <p className="text-xs leading-relaxed" style={{ color: "var(--kin-chu-mo)" }}>
                  Tôi đồng ý với{" "}
                  <Link href="/chinh-sach" className="font-semibold" style={{ color: "var(--kin-nhan-link)" }}>Điều khoản dịch vụ</Link>
                  {" "}và{" "}
                  <Link href="/chinh-sach" className="font-semibold" style={{ color: "var(--kin-nhan-link)" }}>Chính sách bảo mật</Link>
                </p>
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(1)}
                  className="px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex-shrink-0"
                  style={{ background: "var(--kin-nen-bang)", color: "var(--kin-chu-mo)", border: "1px solid var(--kin-vien-thuong)", borderRadius: "8px" }}>
                  ← Quay lại
                </button>
                <button type="submit" disabled={!agreed || submitting}
                  className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white transition-all"
                  style={{
                    background: agreed && !submitting ? "var(--kin-nhan-nen)" : "var(--kin-vien-o-nhap)",
                    borderRadius: "8px",
                    cursor: agreed && !submitting ? "pointer" : "not-allowed",
                  }}>
                  {submitting ? "Đang tạo tài khoản..." : "Tạo tài khoản miễn phí"}
                </button>
              </div>
            </form>
          )}

          <p className="text-center text-sm mt-6" style={{ color: "var(--kin-chu-mo)" }}>
            Đã có tài khoản?{" "}
            <Link href="/dang-nhap" className="font-semibold" style={{ color: "var(--kin-nhan-link)" }}>Đăng nhập</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
