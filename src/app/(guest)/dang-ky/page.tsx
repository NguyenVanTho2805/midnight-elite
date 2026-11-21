"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Eye, EyeOff, CloseCircle } from "griddy-icons";
import { AuthFrame, AuthAsideBlock } from "@/components/guest/AuthFrame";
import { SocialButtons } from "@/components/guest/SocialButtons";
import { KinCallout } from "@/components/kin/Callout";
import { kinButtonClass } from "@/components/kin/Button";
import { KinInput } from "@/components/kin/Input";
import { SignupCodeForm } from "@/components/guest/SignupCodeForm";
import { safeRedirect } from "@/lib/safeRedirect";
import { landingPath } from "@/lib/landing";
import { useFieldValidation } from "@/components/kin/useFieldValidation";
import { email as emailRule, matches, minLength, phoneVn, required, type FieldRule } from "@/lib/fieldRules";

// FE-100 (06/10/2026): thêm chọn vai trò Học viên / Gia sư.
type Role = "student" | "tutor";

// Các môn gia sư có thể chọn khi đăng ký. Giữ danh sách ngắn — khi được
// duyệt, gia sư có thể bổ sung từ /tutor-ho-so (BE-049).
const TUTOR_SUBJECTS = [
  "Toán", "Vật lý", "Hóa học", "Sinh học", "Ngữ văn", "Lịch sử",
  "Địa lý", "Tiếng Anh", "Tin học", "GDCD", "Kỹ năng mềm", "Khác",
];

interface Step1Fields {
  name: string; phone: string;
  // FE-100: field riêng của Gia sư — chỉ validate khi role === "tutor"
  bio: string; subjects: string[];
}
interface Step2Fields {
  email: string; password: string; confirmPassword: string;
}
// HT-02 (24/10/2026): luật kiểm tra tại chỗ dùng chung (src/lib/fieldRules.ts) + KinInput. Câu báo lỗi KHÔNG chứa nội dung đã nhập.
// Gia sư chỉ nhập những gì quản trị cần để duyệt hồ sơ (họ tên, số điện thoại Zalo để liên hệ, giới thiệu, môn dạy) — 15/10/2026 bỏ SĐT phụ huynh,
// trường và tỉnh/thành: máy chủ không lưu hai ô đầu (bị bỏ lặng lẽ), tỉnh/thành không nơi nào dùng. Học viên giữ đủ như cũ.
const PHONE_BAD = "Số điện thoại không hợp lệ";
const COMMON1: Record<string, readonly FieldRule[]> = {
  name: [required("Vui lòng nhập họ và tên")],
  phone: [required("Vui lòng nhập số điện thoại có Zalo"), phoneVn(PHONE_BAD)],
};
const RULES1: Record<string, readonly FieldRule[]> = {
  ...COMMON1,
  bio: [required("Vui lòng viết vài dòng giới thiệu"), minLength(30, "Giới thiệu cần ít nhất 30 ký tự")],
  subjects: [required("Chọn ít nhất 1 môn dạy")], // giá trị = các môn nối bằng dấu phẩy
};
const PASS_MIN: FieldRule = v => (v === "" || v.length >= 8 ? null : "Mật khẩu cần ít nhất 8 ký tự");
// SCL P2-17 / Q6 (21/11/2026): học sinh chỉ còn 3 ô — họ tên, email, mật khẩu — một bước, không màn chặn mã email. Đăng ký xong là đăng nhập luôn và đi tiếp
// (link mời ⇒ ô nhập mã); xác thực email làm sau bằng băng vàng "Email chưa được xác thực". Không thu SĐT, SĐT phụ huynh, trường, tỉnh của học sinh nữa.
const STUDENT_RULES: Record<string, readonly FieldRule[]> = {
  name: [required("Vui lòng nhập họ và tên")],
  email: [required("Vui lòng nhập email"), emailRule("Email không đúng định dạng")],
  password: [required("Vui lòng nhập mật khẩu"), PASS_MIN],
};

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

function FieldError({ msg, id }: { msg?: string; id?: string }) {
  if (!msg) return null;
  return (
    <p id={id} className="text-xs mt-1 flex items-center gap-1" style={{ color: "var(--kin-tt-chu-loi)" }}>
      <CloseCircle size={11} /> {msg}
    </p>
  );
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

  const [s1, setS1] = useState<Step1Fields>({ name: "", phone: "", bio: "", subjects: [] });
  const [s2, setS2] = useState<Step2Fields>({ email: "", password: "", confirmPassword: "" });
  const form1Ref = useRef<HTMLFormElement>(null);
  const form2Ref = useRef<HTMLFormElement>(null);
  const fv1 = useFieldValidation(RULES1);
  const fvS = useFieldValidation(STUDENT_RULES);
  const formSRef = useRef<HTMLFormElement>(null);
  const rules2 = useMemo<Record<string, readonly FieldRule[]>>(() => ({
    email: [required("Vui lòng nhập email"), emailRule("Email không đúng định dạng")],
    password: [required("Vui lòng nhập mật khẩu"), PASS_MIN],
    confirmPassword: [required("Vui lòng xác nhận mật khẩu"), matches(() => s2.password, "Mật khẩu xác nhận không khớp")],
  }), [s2.password]);
  const fv2 = useFieldValidation(rules2);
  const strength = getPasswordStrength(s2.password);
  const sv = s1.subjects.join(",");
  /** aria-invalid + onBlur cho ô không phải KinInput (select, textarea): cùng luật, cùng thời điểm hiện lỗi. */
  const selectBind = (name: string, value: string) => {
    const b = fv1.bind(name, value);
    return { onBlur: b.onBlur, "aria-invalid": b.error ? (true as const) : undefined, "aria-describedby": b.error ? `dk-${name}-err` : undefined };
  };

  function toggleSubject(s: string) {
    setS1(p => ({
      ...p,
      subjects: p.subjects.includes(s) ? p.subjects.filter(x => x !== s) : [...p.subjects, s],
    }));
  }

  function goNext(ev: React.FormEvent) {
    ev.preventDefault();
    const vals: Record<string, string> = { name: s1.name, phone: s1.phone, bio: s1.bio, subjects: sv };
    if (!fv1.validateAll(vals)) { fv1.focusFirst(form1Ref.current); return; }
    setStep(2);
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!fv2.validateAll({ email: s2.email, password: s2.password, confirmPassword: s2.confirmPassword })) { fv2.focusFirst(form2Ref.current); return; }
    if (!agreed) return;
    setSubmitting(true);
    setServerError("");
    try {
      // FE-100: gia sư → /api/auth/register-tutor (BE-050) kèm bio + subjects. Học sinh đi submitStudent (SCL P2-17).
      const body: Record<string, unknown> = {
        name:        s1.name.trim(),
        phone:       s1.phone.replace(/\s/g, ""),
        email:       s2.email.trim(),
        password:    s2.password,
        bio:         s1.bio.trim(),
        subjects:    s1.subjects,
      };
      const res = await fetch("/api/auth/register-tutor", {
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

  async function submitStudent(ev: React.FormEvent) {
    ev.preventDefault();
    if (submitting) return;
    if (!fvS.validateAll({ name: s1.name, email: s2.email, password: s2.password })) { fvS.focusFirst(formSRef.current); return; }
    if (!agreed) { setServerError("Bạn cần đồng ý Điều khoản và Chính sách bảo mật"); return; }
    setSubmitting(true); setServerError("");
    const email = s2.email.trim();
    try {
      const post = (url: string, b: unknown) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
      const res = await post("/api/auth/register", { name: s1.name.trim(), email, password: s2.password });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setServerError(data.error ?? "Đăng ký thất bại"); setSubmitting(false); return; }
      // Q6: không chặn ở màn nhập mã email — đăng nhập luôn. Đăng nhập lỗi (hiếm) thì về màn cũ có ô nhập mã để không bỏ người dùng lơ lửng.
      const lr = await post("/api/auth/login", { identifier: email, password: s2.password });
      const me = await lr.json().catch(() => ({}));
      if (!lr.ok) { setEmailSent(data.emailSent !== false); setSubmitted(true); setSubmitting(false); return; }
      const back = safeRedirect(new URLSearchParams(window.location.search).get("redirect"));
      const landing = landingPath(me.role ?? "student", me.adminRole ?? null, me.tutorPending === true);
      // Tải cứng: AuthProvider chỉ hỏi /api/auth/me lúc mở trang.
      window.location.assign(back && back.startsWith("/student") && landing.startsWith("/student") ? back : landing);
    } catch {
      setServerError("Lỗi kết nối, vui lòng thử lại");
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-16" style={{ background: "var(--kin-nen-bang)" }}>
        <div className="w-full max-w-md text-center">
          <div className="rounded-xl p-5 sm:p-10" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)", boxShadow: "rgba(15,15,15,0.08) 0px 4px 12px 0px" }}>
            <div className="w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-5"
              style={{ background: "var(--kin-nen-nhan)", border: "1px solid var(--kin-nhan-vien)" }}>
              <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
              </svg>
            </div>
            <h2 className="text-xl font-bold mb-2" style={{ color: "var(--kin-chu-chinh)", letterSpacing: "-0.3px" }}>
              {emailSent ? "Kiểm tra hộp thư" : "Tài khoản đã tạo!"}
            </h2>
            <div className="mb-6">
              <SignupCodeForm email={s2.email.trim().toLowerCase()} initialSent={emailSent} onBack={() => setSubmitted(false)} redirectTo={typeof window === "undefined" ? null : safeRedirect(new URLSearchParams(window.location.search).get("redirect"))} />
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
    <AuthFrame title="Tạo tài khoản KiN" sub="Chọn đúng vai trò để bắt đầu. Miễn phí khi ra mắt."
      aside={(
        <>
          <AuthAsideBlock title="Nếu chọn học sinh">
            Chỉ cần họ tên, email và mật khẩu. Tạo xong là nhập mã mời của gia sư để vào lớp.
          </AuthAsideBlock>
          <Link href="/dang-nhap?vai=hoc-sinh&redirect=%2Fstudent%2Fnhap-ma-lop" className={kinButtonClass("secondary")}>Tôi đã có mã mời vào lớp</Link>
          <KinCallout title="Nếu chọn gia sư">
            Hồ sơ gia sư chờ quản trị KiN duyệt trước khi mở lớp. Sau khi vào được, bạn sẽ thấy các bước bắt đầu ở Hộp việc.
          </KinCallout>
          <KinCallout title="Quyền riêng tư của gia đình">
            Phụ huynh không cần đăng ký để xem báo cáo riêng của con. Khách gửi yêu cầu tìm gia sư cũng không cần tài khoản.
          </KinCallout>
        </>
      )}>
      <div className="w-full">

        {/* Progress steps — chỉ gia sư có 2 bước (SCL P2-17) */}
        {role === "tutor" && (
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
        )}

        {/* Card */}
        <div className="rounded-xl p-5 sm:p-8" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)", boxShadow: "rgba(15,15,15,0.08) 0px 4px 12px 0px" }}>

          {/* ── HỌC SINH: một bước, 3 ô (SCL P2-17, Q6) ── */}
          {role === "student" && (
            <div className="space-y-4">
            <SocialButtons consent />
            <form ref={formSRef} onSubmit={submitStudent} noValidate className="space-y-4" data-dang-ky-hoc-sinh>
              {/* FE-100: chọn vai trò — 2 card bấm trước khi nhập thông tin. Mặc định là Học viên vì luồng chính; Gia sư là nhánh phụ (đơn chờ duyệt). */}
              <div>
                <p className="text-sm font-semibold mb-2" style={{ color: "var(--kin-chu-phu)" }}>Bạn đăng ký với vai trò nào? *</p>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { v: "student", label: "Học viên",  desc: "Học thử & tham gia lớp" },
                    { v: "tutor",   label: "Gia sư",    desc: "Mở lớp, dạy & hướng dẫn" },
                  ] as const).map(opt => (
                    <button key={opt.v} type="button" onClick={() => { setRole(opt.v); setServerError(""); }} aria-pressed={role === opt.v}
                      className="rounded-xl p-3 min-h-11 text-left transition-all"
                      style={{
                        background: role === opt.v ? "var(--kin-nen-nhan)" : "var(--kin-nen-trang)",
                        border: `1px solid ${role === opt.v ? "var(--kin-nhan-nen)" : "var(--kin-vien-thuong)"}`,
                      }}>
                      <p className="text-sm font-bold" style={{ color: role === opt.v ? "var(--kin-nhan-nen)" : "var(--kin-chu-chinh)" }}>{opt.label}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--kin-chu-mo)" }}>{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <KinInput type="text" label="Họ và tên *" placeholder="Nguyễn Văn A" autoComplete="name" value={s1.name}
                onChange={e => setS1(p => ({ ...p, name: e.target.value }))} {...fvS.bind("name", s1.name)} />
              <KinInput type="email" inputMode="email" autoComplete="email" label="Email *" placeholder="ten@gmail.com" value={s2.email}
                onChange={e => setS2(p => ({ ...p, email: e.target.value }))} {...fvS.bind("email", s2.email)} />
              <KinInput type={showPass ? "text" : "password"} autoComplete="new-password" label="Mật khẩu *" placeholder="Tối thiểu 8 ký tự" value={s2.password}
                onChange={e => setS2(p => ({ ...p, password: e.target.value }))} {...fvS.bind("password", s2.password)}
                suffix={<button type="button" className="min-w-11 min-h-11 -mx-3 px-3 flex items-center justify-center" style={{ color: "var(--kin-chu-mo)" }}
                  aria-label={showPass ? "Ẩn mật khẩu" : "Hiện mật khẩu"} onClick={() => setShowPass(!showPass)}>
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>} />
              {serverError && (
                <div role="alert" className="px-4 py-3 rounded-lg text-sm font-medium"
                  style={{ background: "var(--kin-tt-nen-loi)", color: "var(--kin-tt-chu-loi)", border: "1px solid var(--kin-tt-vien-loi)" }}>
                  {serverError}
                </div>
              )}
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
              <button type="submit" disabled={!agreed || submitting}
                className="w-full min-h-11 py-2.5 rounded-lg text-sm font-semibold transition-all"
                style={{ background: agreed && !submitting ? "var(--kin-nhan-nen)" : "var(--kin-vien-o-nhap)", color: "var(--kin-chu-tren-nut-chinh)", cursor: agreed && !submitting ? "pointer" : "not-allowed" }}>
                {submitting ? "Đang tạo tài khoản..." : "Tạo tài khoản miễn phí"}
              </button>
              <p className="text-xs" style={{ color: "var(--kin-chu-mo)" }}>Tạo xong là vào ngay. KiN gửi mã xác thực vào email, bạn xác thực sau cũng được.</p>
            </form>
            </div>
          )}

          {/* ── GIA SƯ · BƯỚC 1 ── */}
          {role === "tutor" && step === 1 && (
            <div className="space-y-4">
            <form ref={form1Ref} onSubmit={goNext} noValidate className="space-y-4">
              {/* FE-100: chọn vai trò — 2 card bấm trước khi nhập thông tin. Mặc định là Học viên vì luồng chính; Gia sư là nhánh phụ (đơn chờ duyệt). */}
              <div>
                <p className="text-sm font-semibold mb-2" style={{ color: "var(--kin-chu-phu)" }}>Bạn đăng ký với vai trò nào? *</p>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { v: "student", label: "Học viên",  desc: "Học thử & tham gia lớp" },
                    { v: "tutor",   label: "Gia sư",    desc: "Mở lớp, dạy & hướng dẫn" },
                  ] as const).map(opt => (
                    <button key={opt.v} type="button" onClick={() => { setRole(opt.v); setServerError(""); }} aria-pressed={role === opt.v}
                      className="rounded-xl p-3 min-h-11 text-left transition-all"
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

              <p className="text-sm font-semibold mb-1" style={{ color: "var(--kin-chu-phu)" }}>Thông tin gia sư</p>

              <KinInput type="text" label="Họ và tên *" placeholder="Nguyễn Văn A" autoComplete="name" value={s1.name}
                onChange={e => setS1(p => ({ ...p, name: e.target.value }))} {...fv1.bind("name", s1.name)} />

              <div>
                <KinInput type="tel" inputMode="tel" autoComplete="tel" label="Số điện thoại (Zalo) *" placeholder="0901 234 567" value={s1.phone}
                  onChange={e => setS1(p => ({ ...p, phone: e.target.value }))} {...fv1.bind("phone", s1.phone)} />
                <p className="text-xs mt-1" style={{ color: "var(--kin-chu-mo)" }}>
                  Quản trị KiN dùng số này để liên hệ xác minh hồ sơ. Số không hiện công khai (bạn tự bật nếu muốn hiện Zalo trên hồ sơ).
                </p>
              </div>

              {/* FE-100: Field riêng Gia sư — bio + subjects. Render inline
                  thay vì tạo step riêng để giữ 2-bước gọn và cùng UX. */}
              {role === "tutor" && (
                <>
                  <div>
                    <label htmlFor="dk-bio" className="block text-sm font-medium mb-1.5" style={{ color: "var(--kin-chu-chinh)" }}>
                      Giới thiệu bản thân *
                      <span className="ml-1 font-normal" style={{ color: "var(--kin-chu-mo)" }}>(ít nhất 30 ký tự)</span>
                    </label>
                    <textarea id="dk-bio" rows={3} value={s1.bio}
                      onChange={e => setS1(p => ({ ...p, bio: e.target.value }))}
                      {...selectBind("bio", s1.bio)}
                      placeholder="VD: Mình là sinh viên năm 3 ĐHSP, kinh nghiệm 2 năm dạy Toán 12 ôn ĐGNL..."
                      className="notion-input w-full text-sm" style={{ color: "var(--kin-chu-chinh)" }} />
                    <FieldError id="dk-bio-err" msg={fv1.bind("bio", s1.bio).error} />
                  </div>
                  <div>
                    <p id="dk-subj-label" className="block text-sm font-medium mb-1.5" style={{ color: "var(--kin-chu-chinh)" }}>Môn dạy *</p>
                    <div role="group" aria-labelledby="dk-subj-label">
                    <div tabIndex={-1} className="flex flex-wrap gap-1.5 outline-none"
                      aria-invalid={fv1.bind("subjects", sv).error ? true : undefined} aria-describedby={fv1.bind("subjects", sv).error ? "dk-subj-err" : undefined}>
                      {TUTOR_SUBJECTS.map(s => {
                        const picked = s1.subjects.includes(s);
                        return (
                          <button key={s} type="button" onClick={() => toggleSubject(s)} aria-pressed={picked}
                            className="px-3 py-1.5 min-h-11 rounded-full text-xs font-semibold transition-all"
                            style={picked
                              ? { background: "var(--kin-nhan-nen)", color: "var(--kin-nhan-chu-tren-nen)" }
                              : { background: "var(--kin-nen-trang)", color: "var(--kin-chu-phu)", border: "1px solid var(--kin-vien-thuong)" }}>
                            {s}
                          </button>
                        );
                      })}
                    </div>
                    </div>
                    <FieldError id="dk-subj-err" msg={fv1.bind("subjects", sv).error} />
                  </div>
                </>
              )}

              <button type="submit"
                className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all mt-2"
                style={{ background: "var(--kin-nhan-nen)", borderRadius: "8px" }}>
                Tiếp theo →
              </button>
            </form>
            </div>
          )}

          {/* ── GIA SƯ · BƯỚC 2 ── */}
          {role === "tutor" && step === 2 && (
            <form ref={form2Ref} onSubmit={handleSubmit} noValidate className="space-y-4">
              <p className="text-sm font-semibold mb-1" style={{ color: "var(--kin-chu-phu)" }}>Thông tin tài khoản</p>

              {/* Email */}
              <KinInput type="email" inputMode="email" autoComplete="email" label="Email *" placeholder="ten@gmail.com" value={s2.email}
                onChange={e => setS2(p => ({ ...p, email: e.target.value }))} {...fv2.bind("email", s2.email)} />

              {/* Mật khẩu + Xác nhận */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <KinInput type={showPass ? "text" : "password"} autoComplete="new-password" label="Mật khẩu *" placeholder="Tối thiểu 8 ký tự" value={s2.password}
                    onChange={e => setS2(p => ({ ...p, password: e.target.value }))} {...fv2.bind("password", s2.password)}
                    suffix={<button type="button" className="min-w-11 min-h-11 -mx-3 px-3 flex items-center justify-center" style={{ color: "var(--kin-chu-mo)" }}
                      aria-label={showPass ? "Ẩn mật khẩu" : "Hiện mật khẩu"} onClick={() => setShowPass(!showPass)}>
                      {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>} />
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
                </div>
                <KinInput type={showConfirm ? "text" : "password"} autoComplete="new-password" label="Xác nhận mật khẩu *" placeholder="Nhập lại mật khẩu" value={s2.confirmPassword}
                  onChange={e => setS2(p => ({ ...p, confirmPassword: e.target.value }))} {...fv2.bind("confirmPassword", s2.confirmPassword)}
                  suffix={<button type="button" className="min-w-11 min-h-11 -mx-3 px-3 flex items-center justify-center" style={{ color: "var(--kin-chu-mo)" }}
                    aria-label={showConfirm ? "Ẩn mật khẩu" : "Hiện mật khẩu"} onClick={() => setShowConfirm(!showConfirm)}>
                    {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>} />
              </div>

              {serverError && (
                <div className="px-4 py-3 rounded-lg text-sm font-medium"
                  style={{ background: "var(--kin-tt-nen-loi)", color: "var(--kin-tt-chu-loi)", border: "1px solid var(--kin-tt-vien-loi)" }}>
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
    </AuthFrame>
  );
}
