// TK-170 — đăng nhập "một ô, một mã" (Figma 21:9: khung 32:2 nhập email, 32:27 nhập mã 6 số).
// Nhập email → KiN gửi mã 6 số (sống 10 phút, dùng một lần, sai 5 lần khoá 15 phút, gửi lại sau 60 giây) → nhập mã là vào.
// Đăng nhập bằng mật khẩu vẫn còn như LỐI PHỤ (tài khoản cũ đều có mật khẩu; đăng ký hiện vẫn đặt mật khẩu).
"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import { KinLogo } from "@/components/kin/KinLogo";
import { CodeBoxes } from "@/components/kin/CodeBoxes";
import { safeRedirect } from "@/lib/safeRedirect";

type Step = "email" | "code";
type Notice = { kind: "wrong" | "locked" | "expired" | "error"; title: string; body?: string };

const field = "w-full h-12 px-[14px] rounded-[var(--kin-bo-sm)] border border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-bang)] text-[length:var(--kin-co-small)] text-[var(--kin-chu-chinh)] placeholder:text-[var(--kin-chu-mo)] outline-none focus:border-[var(--kin-nhan-link)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--kin-nhan-link)]";
const primaryBtn = "w-full h-12 px-4 rounded-[var(--kin-bo-sm)] bg-[var(--kin-nhan-nen)] text-[var(--kin-chu-tren-nut-chinh)] text-[length:var(--kin-co-small)] font-semibold transition-colors hover:bg-[var(--kin-nhan-nen-re)] disabled:opacity-60 disabled:cursor-not-allowed";
const secondaryBtn = "w-full h-12 px-4 inline-flex items-center justify-center rounded-[var(--kin-bo-sm)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-bang)] text-[length:var(--kin-co-small)] font-semibold text-[var(--kin-chu-chinh)] transition-colors hover:bg-[var(--kin-nen-re-chuot)]";
const linkBtn = "text-[length:var(--kin-co-small)] font-semibold text-[var(--kin-nhan-link)] hover:underline";

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function DangNhapForm() {
  const { login, loginWithCode, user, isLoading } = useAuth();
  const router       = useRouter();
  const searchParams = useSearchParams();
  const redirectTo   = safeRedirect(searchParams.get("redirect"));

  const [step, setStep]             = useState<Step>("email");
  const [usePassword, setUsePassword] = useState(false);
  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [showPass, setShowPass]     = useState(false);
  const [code, setCode]             = useState("");
  const [invalid, setInvalid]       = useState(false);
  const [notice, setNotice]         = useState<Notice | null>(null);
  // Mốc được gửi lại (ms) + đồng hồ cập nhật mỗi 0,5 giây khi đang đếm ngược.
  const [resendAt, setResendAt]     = useState<number | null>(null);
  const [now, setNow]               = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const codeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLoading && user) {
      router.replace(redirectTo ?? (user.role === "admin" ? "/admin" : "/student/hoc-tap"));
    }
  }, [user, isLoading, router, redirectTo]);

  useEffect(() => {
    if (resendAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [resendAt]);
  const cooldown = resendAt === null ? 0 : Math.max(0, Math.ceil((resendAt - now) / 1000));
  const startCooldown = (sec: number) => { const t = Date.now(); setNow(t); setResendAt(t + sec * 1000); };

  // Đưa con trỏ về ô đầu SAU khi giao diện đã vẽ lại: lúc đang gửi, các ô bị khoá (disabled) nên focus sớm hơn sẽ không ăn.
  const [focusTick, setFocusTick] = useState(0);
  useEffect(() => {
    if (focusTick === 0) return;
    codeRef.current?.querySelector<HTMLInputElement>("input")?.focus();
  }, [focusTick]);
  const focusFirstBox = () => setFocusTick(t => t + 1);

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    setNotice(null);
    if (!email.trim()) { setNotice({ kind: "error", title: "Vui lòng nhập email" }); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/code/request", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setStep("code"); setCode(""); setInvalid(false); startCooldown(data.resendAfterSec ?? 60);
        focusFirstBox();
      } else if (res.status === 429 && data.code === "wait") {
        // vừa gửi cách đây chưa tới 60 giây: sang luôn bước nhập mã, chờ hết thời gian mới gửi lại được
        setStep("code"); setCode(""); setInvalid(false); startCooldown(data.retryAfterSec ?? 60);
        focusFirstBox();
      } else if (res.status === 429 && data.code === "locked") {
        setNotice({ kind: "locked", title: data.error, body: "Đây là chặn người đoán mã, không phải phạt bạn." });
      } else {
        setNotice({ kind: "error", title: data.error ?? "Không gửi được mã. Thử lại sau." });
      }
    } catch {
      setNotice({ kind: "error", title: "Không có kết nối. Thử lại sau." });
    }
    setSubmitting(false);
  }

  async function submitCode(value: string = code) {
    if (submitting) return;
    if (value.length !== 6) { setInvalid(true); setNotice({ kind: "error", title: "Mã gồm đúng 6 chữ số" }); return; }
    setNotice(null);
    setSubmitting(true);
    const r = await loginWithCode(email, value);
    if (r.success) return; // AuthContext chuyển trang
    setSubmitting(false);
    if (r.code === "wrong") {
      setInvalid(true); setCode("");
      setNotice({ kind: "wrong", title: `Mã không đúng — còn ${r.attemptsLeft ?? 0} lần thử`, body: "Sai 5 lần thì KiN khoá đăng nhập email này trong 15 phút. Đây là chặn người đoán mã, không phải phạt bạn." });
      focusFirstBox();
    } else if (r.code === "locked") {
      setInvalid(true); setCode("");
      setNotice({ kind: "locked", title: r.message ?? "Đã khoá đăng nhập email này", body: "Đây là chặn người đoán mã, không phải phạt bạn." });
    } else if (r.code === "expired") {
      setInvalid(true); setCode("");
      setNotice({ kind: "expired", title: "Mã đã hết hạn hoặc chưa được gửi", body: "Bấm “Gửi lại mã” để nhận mã mới." });
    } else {
      setNotice({ kind: "error", title: r.message ?? "Đăng nhập thất bại" });
    }
  }

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    if (!email || !password) { setNotice({ kind: "error", title: "Vui lòng nhập đầy đủ thông tin" }); return; }
    setSubmitting(true);
    const result = await login(email, password);
    if (!result.success) {
      setNotice({ kind: "error", title: result.message ?? "Đăng nhập thất bại" });
      setSubmitting(false);
    }
  }

  function backToEmail() {
    setStep("email"); setCode(""); setInvalid(false); setNotice(null);
  }

  if (isLoading) return null;

  const noticeBox = notice && (
    <div
      role="alert"
      className="flex flex-col gap-1 rounded-[var(--kin-bo-sm)] px-[14px] py-3 border"
      style={notice.kind === "expired"
        ? { background: "var(--kin-nen-nhan)", borderColor: "var(--kin-vien-thuong)" }
        : { background: "var(--kin-nhan-nen-nhat)", borderColor: "var(--kin-tt-chu-loi)" }}
    >
      <p className="text-[length:var(--kin-co-small)] font-semibold" style={{ color: notice.kind === "expired" ? "var(--kin-chu-chinh)" : "var(--kin-tt-chu-loi)" }}>{notice.title}</p>
      {notice.body && <p className="text-[length:var(--kin-co-caption)] text-[var(--kin-chu-chinh)]">{notice.body}</p>}
    </div>
  );

  return (
    <div className="kin-chu-than min-h-[calc(100vh-60px)] flex items-start sm:items-center justify-center px-4 py-8 sm:py-12 bg-[var(--kin-nen-bang)]">
      <div className="w-full max-w-[420px] rounded-2xl border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-trang)] overflow-hidden">

        <div className="px-5 pt-7 pb-5 flex flex-col gap-[6px]">
          <Link href="/" aria-label="KiN — trang chủ" className="inline-flex w-fit"><KinLogo size={32} textSize="var(--kin-co-h3, 23px)" /></Link>
          <p className="text-[length:var(--kin-co-small)] text-[var(--kin-chu-phu)]">Lớp học của bạn, gọn trong một chỗ</p>
        </div>

        {step === "email" && !usePassword && (
          <form onSubmit={sendCode} noValidate className="px-5 pt-2 pb-5 flex flex-col gap-4">
            <h1 className="kin-chu-tieu-de font-semibold text-[length:var(--kin-co-h4)] text-[var(--kin-chu-chinh)]">Đăng nhập</h1>
            <div className="flex flex-col gap-[6px]">
              <label htmlFor="dn-email" className="text-[length:var(--kin-co-small)] font-medium text-[var(--kin-chu-phu)]">Email</label>
              <input id="dn-email" type="email" inputMode="email" autoComplete="email" autoFocus value={email}
                onChange={e => setEmail(e.target.value)} placeholder="ten@gmail.com" className={field} />
            </div>
            {noticeBox}
            <button type="submit" disabled={submitting} className={primaryBtn}>{submitting ? "Đang gửi mã..." : "Gửi mã đăng nhập"}</button>
            <p className="text-[length:var(--kin-co-caption)] text-[var(--kin-chu-mo)]">
              Mỗi lần vào, bạn nhận một mã 6 số dùng một lần qua email — không có gì để quên, cũng không có gì để lộ.
            </p>
            <div className="flex items-center gap-[10px] py-1" aria-hidden="true">
              <span className="h-px flex-1 bg-[var(--kin-vien-nhat)]" />
              <span className="text-[length:var(--kin-co-caption)] text-[var(--kin-chu-mo)]">hoặc</span>
              <span className="h-px flex-1 bg-[var(--kin-vien-nhat)]" />
            </div>
            <Link href="/student/nhap-ma-lop" className={secondaryBtn}>Tôi có mã mời vào lớp</Link>
            <button type="button" onClick={() => { setUsePassword(true); setNotice(null); }} className={`${linkBtn} self-center min-h-11`}>Đăng nhập bằng mật khẩu</button>
            <div className="flex flex-col gap-1 rounded-[var(--kin-bo-sm)] px-[14px] py-3 bg-[var(--kin-nen-dang-chon)]">
              <p className="text-[length:var(--kin-co-small)] font-semibold text-[var(--kin-chu-chinh)]">Phụ huynh thì không cần đăng nhập</p>
              <p className="text-[length:var(--kin-co-caption)] text-[var(--kin-chu-mo-tren-nen-nhan)]">
                Gia sư gửi cho anh chị một đường dẫn riêng. Bấm vào là xem được buổi học và học phí của con — không tài khoản, không mật khẩu.{" "}
                <Link href="/phu-huynh" className="font-semibold text-[var(--kin-nhan-link)] underline">Tìm hiểu thêm</Link>
              </p>
            </div>
          </form>
        )}

        {step === "email" && usePassword && (
          <form onSubmit={submitPassword} noValidate className="px-5 pt-2 pb-5 flex flex-col gap-4">
            <h1 className="kin-chu-tieu-de font-semibold text-[length:var(--kin-co-h4)] text-[var(--kin-chu-chinh)]">Đăng nhập bằng mật khẩu</h1>
            <div className="flex flex-col gap-[6px]">
              <label htmlFor="dn-email-pw" className="text-[length:var(--kin-co-small)] font-medium text-[var(--kin-chu-phu)]">Email</label>
              <input id="dn-email-pw" type="email" inputMode="email" autoComplete="email" value={email}
                onChange={e => setEmail(e.target.value)} placeholder="ten@gmail.com" className={field} />
            </div>
            <div className="flex flex-col gap-[6px]">
              <label htmlFor="dn-pass" className="text-[length:var(--kin-co-small)] font-medium text-[var(--kin-chu-phu)]">Mật khẩu</label>
              <div className="relative">
                <input id="dn-pass" type={showPass ? "text" : "password"} autoComplete="current-password" value={password}
                  onChange={e => setPassword(e.target.value)} placeholder="••••••••" className={`${field} pr-16`} />
                <button type="button" onClick={() => setShowPass(!showPass)} aria-pressed={showPass}
                  className="absolute right-1 top-1 h-10 px-3 text-[length:var(--kin-co-caption)] font-medium text-[var(--kin-chu-mo)] hover:text-[var(--kin-chu-chinh)]">
                  {showPass ? "Ẩn" : "Hiện"}
                </button>
              </div>
            </div>
            {noticeBox}
            <button type="submit" disabled={submitting} className={primaryBtn}>{submitting ? "Đang đăng nhập..." : "Đăng nhập"}</button>
            <div className="flex items-center justify-between">
              <Link href="/quen-mat-khau" className={linkBtn}>Quên mật khẩu?</Link>
              <button type="button" onClick={() => { setUsePassword(false); setNotice(null); }} className={`${linkBtn} min-h-11`}>Dùng mã qua email</button>
            </div>
          </form>
        )}

        {step === "code" && (
          <form onSubmit={e => { e.preventDefault(); void submitCode(); }} noValidate className="px-5 pt-2 pb-5 flex flex-col gap-[14px]">
            <div className="flex flex-col gap-[6px]">
              <h1 className="kin-chu-tieu-de font-semibold text-[length:var(--kin-co-h4)] text-[var(--kin-chu-chinh)]">Nhập mã 6 số</h1>
              <p className="text-[length:var(--kin-co-small)] text-[var(--kin-chu-phu)] break-words">
                Mã vừa gửi tới <strong className="font-semibold">{email.trim().toLowerCase()}</strong> · mã sống 10 phút
              </p>
            </div>
            <div ref={codeRef}>
              <CodeBoxes value={code} onChange={v => { setCode(v); if (invalid) setInvalid(false); }} invalid={invalid} disabled={submitting} autoFocus
                onComplete={v => { void submitCode(v); }} />
            </div>
            {noticeBox}
            <button type="submit" disabled={submitting || code.length !== 6} className={primaryBtn}>{submitting ? "Đang xác nhận..." : "Xác nhận"}</button>
            <div className="flex items-center justify-center gap-[6px] text-[length:var(--kin-co-small)] min-h-11">
              <span className="text-[var(--kin-chu-phu)]">Chưa thấy mã?</span>
              {cooldown > 0
                ? <span className="font-semibold text-[var(--kin-chu-mo)]" aria-live="polite">Gửi lại sau {mmss(cooldown)}</span>
                : <button type="button" onClick={() => void sendCode()} disabled={submitting} className={linkBtn}>Gửi lại mã</button>}
            </div>
            <button type="button" onClick={backToEmail} className={`${linkBtn} self-center min-h-11`}>Đổi email</button>
          </form>
        )}

        {step === "email" && (
          <p className="px-5 py-4 text-center text-[length:var(--kin-co-small)] text-[var(--kin-chu-phu)] bg-[var(--kin-nen-re-chuot)]">
            Chưa có tài khoản?{" "}
            <Link href="/dang-ky" className="font-semibold text-[var(--kin-nhan-link)] hover:underline">Đăng ký ngay</Link>
          </p>
        )}
      </div>
    </div>
  );
}

export default function DangNhapPage() {
  // useSearchParams cần Suspense khi dựng sẵn trang
  return <Suspense fallback={null}><DangNhapForm /></Suspense>;
}
