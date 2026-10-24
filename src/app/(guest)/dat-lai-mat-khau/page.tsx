// Đặt lại mật khẩu (15/10/2026 làm lại): mở từ link trong thư của /quen-mat-khau. Hỏi máy chủ link còn dùng được không NGAY khi mở (hết hạn / đã dùng thì
// báo luôn, khỏi gõ mật khẩu rồi mới biết) → nhập mật khẩu mới + nhập lại → đổi xong là đăng nhập luôn và vào đúng trang của vai (học viên / gia sư / quản trị).
// Chuyển trang bằng tải cứng (window.location) để AuthContext đọc lại phiên vừa được máy chủ cấp; chuyển mềm sẽ vẫn coi là chưa đăng nhập.
"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AuthFrame, AuthAsideBlock, AUTH_CARD } from "@/components/guest/AuthFrame";
import { KinCallout } from "@/components/kin/Callout";
import { KinSubmitButton } from "@/components/kin/SubmitButton";
import { MAX_PASSWORD_LEN, MIN_PASSWORD_LEN, validateNewPassword } from "@/lib/passwordPolicy";

const field = "w-full h-12 px-[14px] rounded-[var(--kin-bo-sm)] border border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-bang)] text-[length:var(--kin-co-small)] text-[var(--kin-chu-chinh)] placeholder:text-[var(--kin-chu-mo)] outline-none focus:border-[var(--kin-nhan-link)] focus:border-2 focus:px-[13px]";
const primaryBtn = "w-full h-12 px-4 rounded-[var(--kin-bo-sm)] bg-[var(--kin-nhan-nen)] text-[var(--kin-nhan-chu-tren-nen)] text-[length:var(--kin-co-small)] font-semibold transition-colors hover:bg-[var(--kin-nhan-nen-re)] disabled:opacity-60";
const linkBtn = "text-[length:var(--kin-co-small)] font-semibold text-[var(--kin-nhan-link)] hover:underline";

function strengthOf(p: string): { level: number; label: string; color: string } {
  if (!p) return { level: 0, label: "", color: "" };
  if (p.length < 6) return { level: 1, label: "Quá yếu", color: "var(--kin-tt-chu-loi)" };
  if (p.length < MIN_PASSWORD_LEN) return { level: 2, label: "Yếu", color: "var(--kin-tt-chu-cho)" };
  if (/[A-Z]/.test(p) && /[0-9]/.test(p) && /[^A-Za-z0-9]/.test(p)) return { level: 5, label: "Rất mạnh", color: "var(--kin-nhan-diem)" };
  if (/[A-Z]/.test(p) && /[0-9]/.test(p)) return { level: 4, label: "Mạnh", color: "var(--kin-tt-chu-xong)" };
  return { level: 3, label: "Trung bình", color: "var(--kin-tt-chu-cho)" };
}

type Phase = "checking" | "invalid" | "form" | "done";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <AuthFrame title="Đặt lại mật khẩu" sub="Tạo mật khẩu mới cho tài khoản KiN của bạn."
      aside={(
        <>
          <AuthAsideBlock title="Mật khẩu mới">
            Tối thiểu {MIN_PASSWORD_LEN} ký tự. Nên chọn mật khẩu không dùng ở nơi khác.
          </AuthAsideBlock>
          <KinCallout title="Liên kết hết hạn">
            Nếu liên kết đã hết hạn hoặc đã dùng, hãy yêu cầu gửi lại. Đặt xong, bạn được đăng nhập luôn.
          </KinCallout>
        </>
      )}>
      <div className={AUTH_CARD}>{children}</div>
    </AuthFrame>
  );
}

function DatLaiForm() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [phase, setPhase] = useState<Phase>("checking");
  const [reason, setReason] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => { document.title = "Đặt lại mật khẩu — KiN"; }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!token) { setReason("Link không hợp lệ. Hãy mở đúng link trong email, hoặc yêu cầu link mới."); setPhase("invalid"); return; }
      try {
        const res = await fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && data.valid) setPhase("form");
        else { setReason(data.error ?? "Link không hợp lệ hoặc đã hết hạn. Hãy yêu cầu link mới."); setPhase("invalid"); }
      } catch {
        if (!cancelled) { setReason("Không kiểm tra được link (lỗi kết nối). Hãy tải lại trang."); setPhase("invalid"); }
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => { if (phase === "form") firstRef.current?.focus(); }, [phase]);

  const strength = strengthOf(password);
  const mismatch = confirm.length > 0 && password !== confirm;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const bad = validateNewPassword(password);
    if (bad) { setError(bad); return; }
    if (password !== confirm) { setError("Mật khẩu nhập lại chưa khớp"); return; }
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/auth/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.code === "invalid" || data.code === "expired") { setReason(data.error ?? "Link không còn dùng được."); setPhase("invalid"); return; }
        setError(data.error ?? "Không đổi được mật khẩu. Thử lại sau ít phút.");
        return;
      }
      setPhase("done");
      const next = typeof data.next === "string" && data.next.startsWith("/") ? data.next : "/dang-nhap";
      setTimeout(() => window.location.assign(next), 1500);
    } catch {
      setError("Lỗi kết nối, vui lòng thử lại");
    } finally {
      setBusy(false);
    }
  }

  if (phase === "checking") {
    return (
      <Shell>
        <div className="px-5 pt-2 pb-8"><p role="status" className="text-[length:var(--kin-co-small)] text-[var(--kin-chu-phu)]">Đang kiểm tra link…</p></div>
      </Shell>
    );
  }

  if (phase === "invalid") {
    return (
      <Shell>
        <div className="px-5 pt-2 pb-6 flex flex-col gap-4">
          <h2 className="kin-chu-tieu-de font-semibold text-[length:var(--kin-co-h4)] text-[var(--kin-chu-chinh)]">Link không dùng được</h2>
          <div role="alert" className="rounded-[var(--kin-bo-sm)] px-[14px] py-3 border text-[length:var(--kin-co-small)] text-[var(--kin-chu-chinh)]"
            style={{ background: "var(--kin-tt-nen-cho)", borderColor: "var(--kin-tt-vien-cho)" }}>{reason}</div>
          <Link href="/quen-mat-khau" className={`${primaryBtn} inline-flex items-center justify-center`}>Yêu cầu link mới</Link>
          <Link href="/dang-nhap" className={`${linkBtn} self-center min-h-11 inline-flex items-center`}>Về trang đăng nhập</Link>
        </div>
      </Shell>
    );
  }

  if (phase === "done") {
    return (
      <Shell>
        <div className="px-5 pt-2 pb-8 flex flex-col gap-2">
          <h2 className="kin-chu-tieu-de font-semibold text-[length:var(--kin-co-h4)] text-[var(--kin-chu-chinh)]">Đã đổi mật khẩu</h2>
          <p role="status" className="text-[length:var(--kin-co-small)] text-[var(--kin-chu-phu)]">Bạn đã được đăng nhập. Đang chuyển vào KiN…</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <form onSubmit={submit} noValidate className="px-5 pt-2 pb-6 flex flex-col gap-4">
        <div className="flex flex-col gap-[6px]">
          <h2 className="kin-chu-tieu-de font-semibold text-[length:var(--kin-co-h4)] text-[var(--kin-chu-chinh)]">Tạo mật khẩu mới</h2>
          <p className="text-[length:var(--kin-co-small)] text-[var(--kin-chu-phu)]">Đặt xong là bạn đăng nhập luôn.</p>
        </div>

        <div className="flex flex-col gap-[6px]">
          <label htmlFor="dl-mk" className="text-[length:var(--kin-co-small)] font-medium text-[var(--kin-chu-phu)]">Mật khẩu mới</label>
          <div className="relative">
            <input id="dl-mk" ref={firstRef} type={show ? "text" : "password"} autoComplete="new-password" value={password} maxLength={MAX_PASSWORD_LEN}
              onChange={e => { setPassword(e.target.value); if (error) setError(""); }} placeholder={`Tối thiểu ${MIN_PASSWORD_LEN} ký tự`} className={`${field} pr-16`} />
            <button type="button" onClick={() => setShow(s => !s)} aria-pressed={show}
              className="absolute right-0 top-[2px] h-11 min-w-11 px-3 text-[length:var(--kin-co-caption)] font-medium text-[var(--kin-chu-mo)] hover:text-[var(--kin-chu-chinh)]">
              {show ? "Ẩn" : "Hiện"}
            </button>
          </div>
          {strength.level > 0 && (
            <div className="flex items-center gap-2" aria-live="polite">
              <div className="flex gap-1 flex-1" aria-hidden="true">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="h-1 flex-1 rounded-full" style={{ background: i <= strength.level ? strength.color : "var(--kin-vien-thuong)" }} />
                ))}
              </div>
              <span className="text-[length:var(--kin-co-caption)] font-semibold" style={{ color: strength.color }}>{strength.label}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-[6px]">
          <label htmlFor="dl-nl" className="text-[length:var(--kin-co-small)] font-medium text-[var(--kin-chu-phu)]">Nhập lại mật khẩu</label>
          <input id="dl-nl" type={show ? "text" : "password"} autoComplete="new-password" value={confirm} maxLength={MAX_PASSWORD_LEN}
            onChange={e => { setConfirm(e.target.value); if (error) setError(""); }} placeholder="Nhập lại mật khẩu"
            aria-invalid={mismatch || undefined} className={field}
            style={mismatch ? { borderColor: "var(--kin-tt-chu-loi)" } : undefined} />
          {mismatch && <p className="text-[length:var(--kin-co-caption)]" style={{ color: "var(--kin-tt-chu-loi)" }}>Mật khẩu nhập lại chưa khớp</p>}
        </div>

        {error && (
          <div role="alert" className="rounded-[var(--kin-bo-sm)] px-[14px] py-3 border text-[length:var(--kin-co-small)] text-[var(--kin-chu-chinh)]"
            style={{ background: "var(--kin-tt-nen-loi)", borderColor: "var(--kin-tt-vien-loi)" }}>{error}</div>
        )}

        <KinSubmitButton busy={busy} busyLabel="Đang lưu..." className={primaryBtn}>Đặt lại mật khẩu</KinSubmitButton>
      </form>
    </Shell>
  );
}

export default function DatLaiMatKhauPage() {
  return <Suspense><DatLaiForm /></Suspense>;
}
