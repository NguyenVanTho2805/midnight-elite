// Quên mật khẩu (15/10/2026 làm lại): nhập email → KiN gửi link đặt lại (sống 30 phút, dùng một lần) → /dat-lai-mat-khau.
// Cùng khung thẻ 420px với /dang-nhap. Phản hồi y hệt dù email có tài khoản hay không (không để lộ ai đã đăng ký); chờ 60 giây giữa hai lần gửi,
// mỗi email tối đa 3 lần trong 30 phút (máy chủ chặn, trang chỉ hiển thị).
// /quen-mat-khau?email=… điền sẵn ô email (trang đăng nhập chuyển email người dùng đã gõ sang đây).
"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { KinLogo } from "@/components/kin/KinLogo";
import { KinSubmitButton } from "@/components/kin/SubmitButton";

const field = "w-full h-12 px-[14px] rounded-[var(--kin-bo-sm)] border border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-bang)] text-[length:var(--kin-co-small)] text-[var(--kin-chu-chinh)] placeholder:text-[var(--kin-chu-mo)] outline-none focus:border-[var(--kin-nhan-link)] focus:border-2 focus:px-[13px]";
const primaryBtn = "w-full h-12 px-4 rounded-[var(--kin-bo-sm)] bg-[var(--kin-nhan-nen)] text-[var(--kin-nhan-chu-tren-nen)] text-[length:var(--kin-co-small)] font-semibold transition-colors hover:bg-[var(--kin-nhan-nen-re)] disabled:opacity-60";
const secondaryBtn = "w-full h-12 px-4 inline-flex items-center justify-center rounded-[var(--kin-bo-sm)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-bang)] text-[length:var(--kin-co-small)] font-semibold text-[var(--kin-chu-chinh)] hover:bg-[var(--kin-nen-re-chuot)] disabled:opacity-60";
const linkBtn = "text-[length:var(--kin-co-small)] font-semibold text-[var(--kin-nhan-link)] hover:underline";
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

type Phase = "form" | "sent";

function QuenMatKhauForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState(() => (params.get("email") ?? "").slice(0, 254));
  const [phase, setPhase] = useState<Phase>("form");
  const [sentTo, setSentTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [waitSec, setWaitSec] = useState(0); // còn bao lâu nữa được gửi lại
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { document.title = "Quên mật khẩu — KiN"; }, []);
  useEffect(() => { if (phase === "form") inputRef.current?.focus(); }, [phase]);
  // Một đồng hồ duy nhất chạy suốt lúc còn phải chờ (không hẹn lại sau mỗi lần vẽ: đỡ trôi giờ và không bị chặn khi tab nền chạy chậm).
  const counting = waitSec > 0;
  useEffect(() => {
    if (!counting) return;
    const id = setInterval(() => setWaitSec(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [counting]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const value = email.trim();
    if (!value) { setError("Vui lòng nhập email"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) { setError("Email chưa đúng dạng (ví dụ ten@gmail.com)"); return; }
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/auth/forgot-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: value }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Không gửi được. Thử lại sau ít phút.");
        if (res.status === 429 && typeof data.retryAfterSec === "number") setWaitSec(Math.min(data.retryAfterSec, 1800));
        return;
      }
      setSentTo(value);
      setWaitSec(typeof data.resendAfterSec === "number" ? data.resendAfterSec : 60);
      setPhase("sent");
    } catch {
      setError("Lỗi kết nối, vui lòng thử lại");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="kin-chu-than min-h-[calc(100vh-60px)] flex items-start sm:items-center justify-center px-4 py-8 sm:py-12 bg-[var(--kin-nen-bang)]">
      <div className="w-full max-w-[420px] rounded-2xl border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-trang)] overflow-hidden">
        <div className="px-5 pt-7 pb-5 flex flex-col gap-[6px]">
          <Link href="/" aria-label="KiN — trang chủ" className="inline-flex w-fit"><KinLogo size={32} textSize="var(--kin-co-h3, 23px)" /></Link>
          <p className="text-[length:var(--kin-co-small)] text-[var(--kin-chu-phu)]">Lớp học của bạn, gọn trong một chỗ</p>
        </div>

        {phase === "form" ? (
          <form onSubmit={send} noValidate className="px-5 pt-2 pb-6 flex flex-col gap-4">
            <div className="flex flex-col gap-[6px]">
              <h1 className="kin-chu-tieu-de font-semibold text-[length:var(--kin-co-h4)] text-[var(--kin-chu-chinh)]">Quên mật khẩu?</h1>
              <p className="text-[length:var(--kin-co-small)] text-[var(--kin-chu-phu)]">Nhập email đăng ký tài khoản. KiN gửi cho bạn một link để tạo mật khẩu mới.</p>
            </div>
            <div className="flex flex-col gap-[6px]">
              <label htmlFor="qmk-email" className="text-[length:var(--kin-co-small)] font-medium text-[var(--kin-chu-phu)]">Email</label>
              <input id="qmk-email" ref={inputRef} type="email" inputMode="email" autoComplete="email" value={email}
                onChange={e => { setEmail(e.target.value); if (error) setError(""); }}
                placeholder="ten@gmail.com" aria-invalid={error ? true : undefined} aria-describedby={error ? "qmk-loi" : undefined} className={field} />
            </div>
            {error && (
              <div id="qmk-loi" role="alert" className="rounded-[var(--kin-bo-sm)] px-[14px] py-3 border text-[length:var(--kin-co-small)] text-[var(--kin-chu-chinh)]"
                style={{ background: "var(--kin-tt-nen-loi)", borderColor: "var(--kin-tt-vien-loi)" }}>
                {error}{waitSec > 0 ? ` (còn ${mmss(waitSec)})` : ""}
              </div>
            )}
            <KinSubmitButton busy={busy} busyLabel="Đang gửi..." disabled={waitSec > 0 && !!error} className={primaryBtn}>Gửi link đặt lại mật khẩu</KinSubmitButton>
            <p className="text-center text-[length:var(--kin-co-small)] text-[var(--kin-chu-phu)]">
              Nhớ mật khẩu rồi? <Link href="/dang-nhap" className={linkBtn}>Đăng nhập</Link>
            </p>
          </form>
        ) : (
          <div className="px-5 pt-2 pb-6 flex flex-col gap-4">
            <div className="flex flex-col gap-[6px]">
              <h1 className="kin-chu-tieu-de font-semibold text-[length:var(--kin-co-h4)] text-[var(--kin-chu-chinh)]">Kiểm tra hộp thư</h1>
              <p role="status" className="text-[length:var(--kin-co-small)] text-[var(--kin-chu-phu)]">
                Nếu <strong className="text-[var(--kin-chu-chinh)] break-all">{sentTo}</strong> đã đăng ký KiN, bạn sẽ nhận được thư có link đặt lại mật khẩu trong ít phút.
              </p>
            </div>
            <ul className="flex flex-col gap-1 text-[length:var(--kin-co-caption)] text-[var(--kin-chu-mo)] list-disc pl-5">
              <li>Link sống <strong>30 phút</strong> và chỉ dùng được một lần.</li>
              <li>Không thấy thư? Xem thư mục Spam / Quảng cáo, hoặc kiểm tra bạn đã gõ đúng email.</li>
            </ul>
            <button type="button" disabled={waitSec > 0 || busy} onClick={() => void send()} className={secondaryBtn}>
              {busy ? "Đang gửi..." : waitSec > 0 ? `Gửi lại sau ${mmss(waitSec)}` : "Gửi lại link"}
            </button>
            {error && (
              <div role="alert" className="rounded-[var(--kin-bo-sm)] px-[14px] py-3 border text-[length:var(--kin-co-small)] text-[var(--kin-chu-chinh)]"
                style={{ background: "var(--kin-tt-nen-loi)", borderColor: "var(--kin-tt-vien-loi)" }}>{error}</div>
            )}
            <button type="button" onClick={() => { setPhase("form"); setError(""); }} className={`${linkBtn} self-center min-h-11`}>Dùng email khác</button>
            <Link href="/dang-nhap" className={`${linkBtn} self-center min-h-11 inline-flex items-center`}>Về trang đăng nhập</Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function QuenMatKhauPage() {
  return <Suspense><QuenMatKhauForm /></Suspense>;
}
