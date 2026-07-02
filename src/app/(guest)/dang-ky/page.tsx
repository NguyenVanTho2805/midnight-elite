"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Eye, EyeOff, CheckCircle, CloseCircle } from "griddy-icons";

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

interface Step1Fields {
  name: string; phone: string; parentPhone: string; city: string; school: string;
}
interface Step2Fields {
  email: string; password: string; confirmPassword: string;
}
interface Step1Errors {
  name?: string; phone?: string; parentPhone?: string; city?: string; school?: string;
}
interface Step2Errors {
  email?: string; password?: string; confirmPassword?: string;
}

function validatePhone(p: string) { return /^(0[3|5|7|8|9])[0-9]{8}$/.test(p.replace(/\s/g, "")); }
function validateEmail(e: string)  { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim()); }

function validateStep1(f: Step1Fields): Step1Errors {
  const e: Step1Errors = {};
  if (!f.name.trim())        e.name = "Vui lòng nhập họ và tên";
  if (!f.phone.trim())       e.phone = "Vui lòng nhập số điện thoại có Zalo";
  else if (!validatePhone(f.phone)) e.phone = "Số điện thoại không hợp lệ";
  if (f.parentPhone.trim() && !validatePhone(f.parentPhone))
                             e.parentPhone = "Số điện thoại không hợp lệ";
  if (!f.city)               e.city = "Vui lòng chọn tỉnh / thành phố";
  if (!f.school.trim())      e.school = "Vui lòng nhập tên trường";
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
  if (p.length < 6)  return { level: 1, label: "Quá yếu",    color: "#ef4444" };
  if (p.length < 8)  return { level: 2, label: "Yếu",        color: "#f97316" };
  if (p.length < 12 && /[A-Z]/.test(p) && /[0-9]/.test(p))
                     return { level: 4, label: "Mạnh",        color: "#16a34a" };
  if (/[A-Z]/.test(p) && /[0-9]/.test(p) && /[^A-Za-z0-9]/.test(p))
                     return { level: 5, label: "Rất mạnh",    color: "#0068FF" };
  return             { level: 3, label: "Trung bình",         color: "#f97316" };
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p className="text-xs mt-1 flex items-center gap-1" style={{ color: "#dc2626" }}>
      <CloseCircle size={11} /> {msg}
    </p>
  );
}

function FieldIcon({ touched, hasError, hasValue }: { touched: boolean; hasError: boolean; hasValue: boolean }) {
  if (!touched) return null;
  if (hasError)  return <CloseCircle size={14} style={{ color: "#ef4444" }} />;
  if (hasValue)  return <CheckCircle size={14} style={{ color: "#16a34a" }} />;
  return null;
}

export default function DangKyPage() {
  useAuth();

  const [step, setStep]       = useState<1 | 2>(1);
  const [agreed, setAgreed]   = useState(false);
  const [showPass, setShowPass]       = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [submitted, setSubmitted]     = useState(false);
  const [serverError, setServerError] = useState("");
  const [emailSent, setEmailSent]     = useState(true);

  const [s1, setS1] = useState<Step1Fields>({ name: "", phone: "", parentPhone: "", city: "", school: "" });
  const [s2, setS2] = useState<Step2Fields>({ email: "", password: "", confirmPassword: "" });
  const [t1, setT1] = useState<Partial<Record<keyof Step1Fields, boolean>>>({});
  const [t2, setT2] = useState<Partial<Record<keyof Step2Fields, boolean>>>({});

  const e1 = validateStep1(s1);
  const e2 = validateStep2(s2);
  const strength = getPasswordStrength(s2.password);

  function blurAll1() { setT1({ name: true, phone: true, city: true, school: true }); }
  function blurAll2() { setT2({ email: true, password: true, confirmPassword: true }); }

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
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:        s1.name.trim(),
          phone:       s1.phone.replace(/\s/g, ""),
          parentPhone: s1.parentPhone.replace(/\s/g, ""),
          city:        s1.city,
          school:      s1.school.trim(),
          email:       s2.email.trim(),
          password:    s2.password,
        }),
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
      <div className="min-h-screen flex items-center justify-center px-4 py-16" style={{ background: "#f6f5f4" }}>
        <div className="w-full max-w-md text-center">
          <div className="rounded-xl p-10" style={{ background: "#ffffff", border: "1px solid #e5e3df", boxShadow: "rgba(15,15,15,0.08) 0px 4px 12px 0px" }}>
            <div className="w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-5"
              style={{ background: "#dbeafe", border: "1px solid #bfdbfe" }}>
              <svg className="w-8 h-8" fill="none" stroke="#0068FF" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
              </svg>
            </div>
            {emailSent ? (
              <>
                <h2 className="text-xl font-bold mb-2" style={{ color: "#1a1a1a", letterSpacing: "-0.3px" }}>Kiểm tra hộp thư</h2>
                <p className="text-sm mb-1" style={{ color: "#787671" }}>Đã gửi email xác thực đến</p>
                <p className="text-base font-semibold mb-5" style={{ color: "#0068FF" }}>{s2.email}</p>
                <p className="text-xs leading-relaxed mb-6" style={{ color: "#a4a097" }}>
                  Bấm vào link trong email để kích hoạt tài khoản.<br />
                  Link có hiệu lực trong <strong>24 giờ</strong>.
                </p>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold mb-2" style={{ color: "#1a1a1a", letterSpacing: "-0.3px" }}>Tài khoản đã tạo!</h2>
                <div className="rounded-lg px-4 py-3 mb-5 text-left" style={{ background: "#fff7ed", border: "1px solid #fed7aa" }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: "#c2410c" }}>Không gửi được email xác thực</p>
                  <p className="text-xs" style={{ color: "#9a3412" }}>
                    Hệ thống đang trong quá trình cấu hình email. Vui lòng liên hệ admin để kích hoạt tài khoản theo cách thủ công.
                  </p>
                </div>
              </>
            )}
            <div className="rounded-lg p-4 text-left mb-6" style={{ background: "#f6f5f4", border: "1px solid #e5e3df" }}>
              {emailSent ? (
                <>
                  <p className="text-xs font-semibold mb-2" style={{ color: "#37352f" }}>Không thấy email?</p>
                  <ul className="text-xs space-y-1" style={{ color: "#787671" }}>
                    <li>• Kiểm tra thư mục Spam / Junk</li>
                    <li>• Đợi vài phút rồi refresh hộp thư</li>
                    <li>• Kiểm tra lại email đã nhập đúng chưa</li>
                  </ul>
                </>
              ) : (
                <>
                  <p className="text-xs font-semibold mb-2" style={{ color: "#37352f" }}>Tài khoản đã đăng ký với:</p>
                  <p className="text-xs font-mono" style={{ color: "#0068FF" }}>{s2.email}</p>
                </>
              )}
            </div>
            <Link href="/dang-nhap" className="text-sm font-semibold" style={{ color: "#0068FF" }}>
              ← Quay về đăng nhập
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: "#f6f5f4" }}>
      <div className="w-full max-w-lg">

        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex flex-col items-center gap-1">
            <span className="text-2xl font-bold" style={{ color: "#0068FF", letterSpacing: "-0.5px" }}>Midnight Elite</span>
            <span className="text-xs" style={{ color: "#a4a097" }}>Education Platform</span>
          </Link>
          <h1 className="text-xl font-bold mt-6 mb-1" style={{ color: "#1a1a1a", letterSpacing: "-0.3px" }}>Tạo tài khoản miễn phí</h1>
          <p className="text-sm" style={{ color: "#787671" }}>Thi thử ĐGNL ngay sau khi đăng ký</p>
        </div>

        {/* Progress steps */}
        <div className="flex items-center gap-0 mb-6 px-2">
          {([1, 2] as const).map((n, i) => (
            <div key={n} className="flex items-center flex-1">
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                  style={{
                    background: step >= n ? "#0068FF" : "#e5e3df",
                    color: step >= n ? "#ffffff" : "#a4a097",
                  }}>
                  {step > n ? "✓" : n}
                </div>
                <span className="text-xs font-semibold hidden sm:block" style={{ color: step >= n ? "#1a1a1a" : "#a4a097" }}>
                  {n === 1 ? "Thông tin cá nhân" : "Tài khoản"}
                </span>
              </div>
              {i < 1 && (
                <div className="flex-1 h-px mx-3 transition-all" style={{ background: step > 1 ? "#0068FF" : "#e5e3df" }} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="rounded-xl p-8" style={{ background: "#ffffff", border: "1px solid #e5e3df", boxShadow: "rgba(15,15,15,0.08) 0px 4px 12px 0px" }}>

          {/* ── BƯỚC 1 ── */}
          {step === 1 && (
            <form onSubmit={goNext} noValidate className="space-y-4">
              <p className="text-sm font-semibold mb-1" style={{ color: "#37352f" }}>Thông tin học sinh</p>

              {/* Họ và tên */}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "#37352f" }}>Họ và tên *</label>
                <div className="relative">
                  <input type="text" placeholder="Nguyễn Văn A" value={s1.name}
                    onChange={e => setS1(p => ({ ...p, name: e.target.value }))}
                    onBlur={() => setT1(p => ({ ...p, name: true }))}
                    className="notion-input w-full text-sm pr-10" style={{ color: "#1a1a1a",
                      borderColor: t1.name && e1.name ? "#fca5a5" : t1.name && !e1.name ? "#86efac" : undefined }} />
                  <span className="absolute right-3 top-3">
                    <FieldIcon touched={!!t1.name} hasError={!!e1.name} hasValue={!!s1.name.trim()} />
                  </span>
                </div>
                <FieldError msg={t1.name ? e1.name : undefined} />
              </div>

              {/* SĐT học sinh + SĐT phụ huynh */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "#37352f" }}>SĐT học sinh (Zalo) *</label>
                  <div className="relative">
                    <input type="tel" placeholder="0901 234 567" value={s1.phone}
                      onChange={e => setS1(p => ({ ...p, phone: e.target.value }))}
                      onBlur={() => setT1(p => ({ ...p, phone: true }))}
                      className="notion-input w-full text-sm pr-9" style={{ color: "#1a1a1a",
                        borderColor: t1.phone && e1.phone ? "#fca5a5" : t1.phone && !e1.phone ? "#86efac" : undefined }} />
                    <span className="absolute right-3 top-3">
                      <FieldIcon touched={!!t1.phone} hasError={!!e1.phone} hasValue={validatePhone(s1.phone)} />
                    </span>
                  </div>
                  <FieldError msg={t1.phone ? e1.phone : undefined} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "#37352f" }}>
                    SĐT phụ huynh
                    <span className="ml-1 font-normal" style={{ color: "#a4a097" }}>(tuỳ chọn)</span>
                  </label>
                  <div className="relative">
                    <input type="tel" placeholder="0901 234 567" value={s1.parentPhone}
                      onChange={e => setS1(p => ({ ...p, parentPhone: e.target.value }))}
                      onBlur={() => setT1(p => ({ ...p, parentPhone: true }))}
                      className="notion-input w-full text-sm pr-9" style={{ color: "#1a1a1a",
                        borderColor: t1.parentPhone && e1.parentPhone ? "#fca5a5"
                          : t1.parentPhone && s1.parentPhone && !e1.parentPhone ? "#86efac" : undefined }} />
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
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "#37352f" }}>Tỉnh / Thành phố *</label>
                  <select value={s1.city}
                    onChange={e => setS1(p => ({ ...p, city: e.target.value }))}
                    onBlur={() => setT1(p => ({ ...p, city: true }))}
                    className="notion-input w-full text-sm"
                    style={{ color: s1.city ? "#1a1a1a" : "#a4a097",
                      borderColor: t1.city && e1.city ? "#fca5a5" : t1.city && !e1.city ? "#86efac" : undefined }}>
                    <option value="">Chọn tỉnh / thành phố</option>
                    {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <FieldError msg={t1.city ? e1.city : undefined} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "#37352f" }}>Tên trường *</label>
                  <div className="relative">
                    <input type="text" placeholder="THPT Chu Văn An" value={s1.school}
                      onChange={e => setS1(p => ({ ...p, school: e.target.value }))}
                      onBlur={() => setT1(p => ({ ...p, school: true }))}
                      className="notion-input w-full text-sm pr-9" style={{ color: "#1a1a1a",
                        borderColor: t1.school && e1.school ? "#fca5a5" : t1.school && !e1.school ? "#86efac" : undefined }} />
                    <span className="absolute right-3 top-3">
                      <FieldIcon touched={!!t1.school} hasError={!!e1.school} hasValue={!!s1.school.trim()} />
                    </span>
                  </div>
                  <FieldError msg={t1.school ? e1.school : undefined} />
                </div>
              </div>

              <button type="submit"
                className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all mt-2"
                style={{ background: "#0068FF", borderRadius: "8px" }}>
                Tiếp theo →
              </button>
            </form>
          )}

          {/* ── BƯỚC 2 ── */}
          {step === 2 && (
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <p className="text-sm font-semibold mb-1" style={{ color: "#37352f" }}>Thông tin tài khoản</p>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "#37352f" }}>Email *</label>
                <div className="relative">
                  <input type="email" placeholder="ten@gmail.com" value={s2.email}
                    onChange={e => setS2(p => ({ ...p, email: e.target.value }))}
                    onBlur={() => setT2(p => ({ ...p, email: true }))}
                    className="notion-input w-full text-sm pr-10" style={{ color: "#1a1a1a",
                      borderColor: t2.email && e2.email ? "#fca5a5" : t2.email && !e2.email ? "#86efac" : undefined }} />
                  <span className="absolute right-3 top-3">
                    <FieldIcon touched={!!t2.email} hasError={!!e2.email} hasValue={validateEmail(s2.email)} />
                  </span>
                </div>
                <FieldError msg={t2.email ? e2.email : undefined} />
              </div>

              {/* Mật khẩu + Xác nhận */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "#37352f" }}>Mật khẩu *</label>
                  <div className="relative">
                    <input type={showPass ? "text" : "password"} placeholder="Tối thiểu 8 ký tự"
                      value={s2.password}
                      onChange={e => setS2(p => ({ ...p, password: e.target.value }))}
                      onBlur={() => setT2(p => ({ ...p, password: true }))}
                      className="notion-input w-full text-sm pr-9" style={{ color: "#1a1a1a",
                        borderColor: t2.password && e2.password ? "#fca5a5" : undefined }} />
                    <button type="button" className="absolute right-3 top-3" style={{ color: "#a4a097" }}
                      onClick={() => setShowPass(!showPass)}>
                      {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {s2.password.length > 0 && (
                    <div className="mt-1.5">
                      <div className="flex gap-0.5 mb-0.5">
                        {[1,2,3,4,5].map(i => (
                          <div key={i} className="flex-1 h-1 rounded-full transition-all"
                            style={{ background: i <= strength.level ? strength.color : "#e5e3df" }} />
                        ))}
                      </div>
                      {strength.label && <p className="text-xs font-semibold" style={{ color: strength.color }}>{strength.label}</p>}
                    </div>
                  )}
                  <FieldError msg={t2.password ? e2.password : undefined} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "#37352f" }}>Xác nhận mật khẩu *</label>
                  <div className="relative">
                    <input type={showConfirm ? "text" : "password"} placeholder="Nhập lại mật khẩu"
                      value={s2.confirmPassword}
                      onChange={e => setS2(p => ({ ...p, confirmPassword: e.target.value }))}
                      onBlur={() => setT2(p => ({ ...p, confirmPassword: true }))}
                      className="notion-input w-full text-sm pr-9" style={{ color: "#1a1a1a",
                        borderColor: t2.confirmPassword && e2.confirmPassword ? "#fca5a5"
                          : t2.confirmPassword && !e2.confirmPassword ? "#86efac" : undefined }} />
                    <button type="button" className="absolute right-3 top-3" style={{ color: "#a4a097" }}
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
                <p className="text-xs leading-relaxed" style={{ color: "#787671" }}>
                  Tôi đồng ý với{" "}
                  <Link href="/chinh-sach" className="font-semibold" style={{ color: "#0068FF" }}>Điều khoản dịch vụ</Link>
                  {" "}và{" "}
                  <Link href="/chinh-sach" className="font-semibold" style={{ color: "#0068FF" }}>Chính sách bảo mật</Link>
                </p>
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(1)}
                  className="px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex-shrink-0"
                  style={{ background: "#f6f5f4", color: "#787671", border: "1px solid #e5e3df", borderRadius: "8px" }}>
                  ← Quay lại
                </button>
                <button type="submit" disabled={!agreed || submitting}
                  className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white transition-all"
                  style={{
                    background: agreed && !submitting ? "#0068FF" : "#c8c4be",
                    borderRadius: "8px",
                    cursor: agreed && !submitting ? "pointer" : "not-allowed",
                  }}>
                  {submitting ? "Đang tạo tài khoản..." : "Tạo tài khoản miễn phí"}
                </button>
              </div>
            </form>
          )}

          <p className="text-center text-sm mt-6" style={{ color: "#787671" }}>
            Đã có tài khoản?{" "}
            <Link href="/dang-nhap" className="font-semibold" style={{ color: "#0068FF" }}>Đăng nhập</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
