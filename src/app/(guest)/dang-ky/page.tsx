"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Eye, EyeOff, CloseCircle } from "griddy-icons";
import { AuthFrame, AuthAsideBlock } from "@/components/guest/AuthFrame";
import { KinCallout } from "@/components/kin/Callout";
import { kinButtonClass } from "@/components/kin/Button";
import { KinInput } from "@/components/kin/Input";
import { useFieldValidation } from "@/components/kin/useFieldValidation";
import { email as emailRule, matches, minLength, phoneVn, required, type FieldRule } from "@/lib/fieldRules";

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
// HT-02 (24/10/2026): luật kiểm tra tại chỗ dùng chung (src/lib/fieldRules.ts) + KinInput. Câu báo lỗi KHÔNG chứa nội dung đã nhập.
// Gia sư chỉ nhập những gì quản trị cần để duyệt hồ sơ (họ tên, số điện thoại Zalo để liên hệ, giới thiệu, môn dạy) — 15/10/2026 bỏ SĐT phụ huynh,
// trường và tỉnh/thành: máy chủ không lưu hai ô đầu (bị bỏ lặng lẽ), tỉnh/thành không nơi nào dùng. Học viên giữ đủ như cũ.
const PHONE_BAD = "Số điện thoại không hợp lệ";
const COMMON1: Record<string, readonly FieldRule[]> = {
  name: [required("Vui lòng nhập họ và tên")],
  phone: [required("Vui lòng nhập số điện thoại có Zalo"), phoneVn(PHONE_BAD)],
};
const RULES1: Record<Role, Record<string, readonly FieldRule[]>> = {
  student: {
    ...COMMON1,
    parentPhone: [phoneVn(PHONE_BAD)],
    city: [required("Vui lòng chọn tỉnh / thành phố")],
    school: [required("Vui lòng nhập tên trường")],
  },
  tutor: {
    ...COMMON1,
    bio: [required("Vui lòng viết vài dòng giới thiệu"), minLength(30, "Giới thiệu cần ít nhất 30 ký tự")],
    subjects: [required("Chọn ít nhất 1 môn dạy")], // giá trị = các môn nối bằng dấu phẩy
  },
};
const PASS_MIN: FieldRule = v => (v === "" || v.length >= 8 ? null : "Mật khẩu cần ít nhất 8 ký tự");

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

  const [s1, setS1] = useState<Step1Fields>({ name: "", phone: "", parentPhone: "", city: "", school: "", bio: "", subjects: [] });
  const [s2, setS2] = useState<Step2Fields>({ email: "", password: "", confirmPassword: "" });
  const form1Ref = useRef<HTMLFormElement>(null);
  const form2Ref = useRef<HTMLFormElement>(null);
  const fv1 = useFieldValidation(RULES1[role]);
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
    return { onBlur: b.onBlur, "aria-invalid": b.error ? (true as const) : undefined, "aria-describedby": b.error ? `dk-${name === "city" ? "city" : "bio"}-err` : undefined };
  };

  function toggleSubject(s: string) {
    setS1(p => ({
      ...p,
      subjects: p.subjects.includes(s) ? p.subjects.filter(x => x !== s) : [...p.subjects, s],
    }));
  }

  function goNext(ev: React.FormEvent) {
    ev.preventDefault();
    const vals: Record<string, string> = { name: s1.name, phone: s1.phone, parentPhone: s1.parentPhone, city: s1.city, school: s1.school, bio: s1.bio, subjects: sv };
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
      // FE-100: role tutor → /api/auth/register-tutor (BE-050) kèm bio +
      // subjects; role student → /api/auth/register như cũ.
      const endpoint = role === "tutor" ? "/api/auth/register-tutor" : "/api/auth/register";
      const body: Record<string, unknown> = {
        name:        s1.name.trim(),
        phone:       s1.phone.replace(/\s/g, ""),
        email:       s2.email.trim(),
        password:    s2.password,
      };
      if (role === "tutor") {
        body.bio = s1.bio.trim();
        body.subjects = s1.subjects;
      } else {
        body.parentPhone = s1.parentPhone.replace(/\s/g, "");
        body.city        = s1.city;
        body.school      = s1.school.trim();
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
                <div className="rounded-lg px-4 py-3 mb-5 text-left" style={{ background: "var(--kin-tt-nen-cho)", border: "1px solid var(--kin-tt-vien-cho)" }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: "var(--kin-tt-chu-cho)" }}>Không gửi được email xác thực</p>
                  <p className="text-xs" style={{ color: "var(--kin-tt-chu-cho)" }}>
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
    <AuthFrame title="Tạo tài khoản KiN" sub="Chọn đúng vai trò để bắt đầu. Miễn phí khi ra mắt."
      aside={(
        <>
          <AuthAsideBlock title="Nếu chọn học sinh">
            Dùng họ tên và email cá nhân. Có thể nhập mã mời từ cô hoặc tham gia lớp sau khi tạo tài khoản.
          </AuthAsideBlock>
          <Link href="/student/nhap-ma-lop" className={kinButtonClass("secondary")}>Tôi đã có mã mời vào lớp</Link>
          <KinCallout title="Nếu chọn gia sư">
            Hồ sơ gia sư chờ quản trị KiN duyệt trước khi mở lớp. Sau khi vào được, bạn sẽ thấy các bước bắt đầu ở Hộp việc.
          </KinCallout>
          <KinCallout title="Quyền riêng tư của gia đình">
            Phụ huynh không cần đăng ký để xem báo cáo riêng của con. Khách gửi yêu cầu tìm gia sư cũng không cần tài khoản.
          </KinCallout>
        </>
      )}>
      <div className="w-full">

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
            <form ref={form1Ref} onSubmit={goNext} noValidate className="space-y-4">
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
              <KinInput type="text" label="Họ và tên *" placeholder="Nguyễn Văn A" autoComplete="name" value={s1.name}
                onChange={e => setS1(p => ({ ...p, name: e.target.value }))} {...fv1.bind("name", s1.name)} />

              {/* SĐT học sinh + SĐT phụ huynh */}
              <div className={role === "tutor" ? "grid grid-cols-1 gap-3" : "grid grid-cols-1 sm:grid-cols-2 gap-3"}>
                <div>
                  <KinInput type="tel" inputMode="tel" autoComplete="tel" label={role === "tutor" ? "Số điện thoại (Zalo) *" : "SĐT học sinh (Zalo) *"} placeholder="0901 234 567" value={s1.phone}
                    onChange={e => setS1(p => ({ ...p, phone: e.target.value }))} {...fv1.bind("phone", s1.phone)} />
                  {role === "tutor" && (
                    <p className="text-xs mt-1" style={{ color: "var(--kin-chu-mo)" }}>
                      Quản trị KiN dùng số này để liên hệ xác minh hồ sơ. Số không hiện công khai (bạn tự bật nếu muốn hiện Zalo trên hồ sơ).
                    </p>
                  )}
                </div>
                {role === "student" && (
                  <KinInput type="tel" inputMode="tel" label={<>SĐT phụ huynh<span className="ml-1 font-normal" style={{ color: "var(--kin-chu-mo)" }}>(tuỳ chọn)</span></>}
                    placeholder="0901 234 567" value={s1.parentPhone}
                    onChange={e => setS1(p => ({ ...p, parentPhone: e.target.value }))} {...fv1.bind("parentPhone", s1.parentPhone)} />
                )}
              </div>

              {/* Tỉnh + Trường */}
              {role === "student" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="dk-city" className="block text-sm font-medium mb-1.5" style={{ color: "var(--kin-chu-chinh)" }}>Tỉnh / Thành phố *</label>
                  <select id="dk-city" value={s1.city}
                    onChange={e => setS1(p => ({ ...p, city: e.target.value }))}
                    {...selectBind("city", s1.city)}
                    className="notion-input w-full text-sm min-h-[var(--kin-cham-toi-thieu)]"
                    style={{ color: s1.city ? "var(--kin-chu-chinh)" : "var(--kin-chu-mo)" }}>
                    <option value="">Chọn tỉnh / thành phố</option>
                    {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <FieldError id="dk-city-err" msg={fv1.bind("city", s1.city).error} />
                </div>
                <KinInput type="text" label="Tên trường *" placeholder="THPT Chu Văn An" value={s1.school}
                  onChange={e => setS1(p => ({ ...p, school: e.target.value }))} {...fv1.bind("school", s1.school)} />
              </div>
              )}

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
                    <div role="group" aria-labelledby="dk-subj-label" tabIndex={-1} className="flex flex-wrap gap-1.5 outline-none"
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
          )}

          {/* ── BƯỚC 2 ── */}
          {step === 2 && (
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
