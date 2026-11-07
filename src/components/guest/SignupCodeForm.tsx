// Ô nhập mã 6 số xác thực email: dùng ở màn "Kiểm tra hộp thư" sau đăng ký (học sinh và gia sư) và ở băng vàng "Email chưa được xác thực".
// Máy chủ quyết định mọi giới hạn (10 phút, 5 lần sai, 60 giây gửi lại); ở đây chỉ hiển thị. Thông báo không chứa tên / số tiền.
"use client";
import { useEffect, useState } from "react";
import { CodeBoxes } from "@/components/kin/CodeBoxes";
import { KinSubmitButton } from "@/components/kin/SubmitButton";
import { LockCountdown } from "@/components/kin/LockCountdown";
import { SPAM_HINT } from "@/lib/verifyCodeCopy";

const primaryBtn = "w-full h-12 px-4 rounded-[var(--kin-bo-sm)] bg-[var(--kin-nhan-nen)] text-[var(--kin-chu-tren-nut-chinh)] text-[length:var(--kin-co-small)] font-semibold transition-colors hover:bg-[var(--kin-nhan-nen-re)] disabled:opacity-60 disabled:cursor-not-allowed";
const linkBtn = "min-h-11 px-2 text-[length:var(--kin-co-small)] font-semibold text-[var(--kin-nhan-link)] hover:underline disabled:opacity-60";
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

type Msg = { tone: "loi" | "cho" | "xong"; text: string } | null;

export function SignupCodeForm({ email, initialSent = true, initialCooldown = 60, onBack }: {
  email: string;
  /** false = lần gửi đầu thất bại: chưa có mã nào, hiện nút "Gửi mã". */
  initialSent?: boolean;
  initialCooldown?: number;
  /** Có thì hiện nút "Dùng email khác". */
  onBack?: () => void;
}) {
  const [sent, setSent] = useState(initialSent);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [ok, setOk] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [lock, setLock] = useState<number | null>(null);
  const [resendAt, setResendAt] = useState<number | null>(() => (initialSent ? Date.now() + initialCooldown * 1000 : null));
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (resendAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [resendAt]);
  const cooldown = resendAt === null ? 0 : Math.max(0, Math.ceil((resendAt - now) / 1000));
  const startCooldown = (sec: number) => { const t = Date.now(); setNow(t); setResendAt(t + sec * 1000); };

  async function post(path: string, body: unknown) {
    const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    return { res, data: data ?? {} };
  }

  async function send() {
    setBusy(true); setMsg(null);
    try {
      const { res, data } = await post("/api/auth/email-verify/request", { email });
      if (res.ok) { setSent(true); setCode(""); setInvalid(false); setLock(null); startCooldown(Number(data.resendAfterSec) || 60); setMsg({ tone: "xong", text: "Đã gửi mã mới. Mã cũ không còn dùng được." }); }
      else if (res.status === 429 && data.code === "wait") { startCooldown(Number(data.retryAfterSec) || 60); setMsg({ tone: "cho", text: String(data.error ?? "Chờ một chút rồi gửi lại.") }); }
      else if (res.status === 429 && data.code === "locked") { setLock(Number(data.retryAfterSec) || 900); }
      else setMsg({ tone: "loi", text: String(data.error ?? "Chưa gửi được email. Thử lại sau ít phút.") });
    } catch {
      setMsg({ tone: "loi", text: "Mất kết nối, chưa gửi được email." });
    } finally { setBusy(false); }
  }

  async function confirm(value = code) {
    if (value.length !== 6 || busy) return;
    setBusy(true); setMsg(null);
    try {
      const { res, data } = await post("/api/auth/email-verify/confirm", { email, code: value });
      if (res.ok && data.success) {
        setOk(true);
        // Tải cứng: AuthProvider chỉ hỏi /api/auth/me một lần lúc mở trang, chưa có phiên lúc đó (xem /xac-thuc-email).
        const landing = typeof data.landing === "string" && data.landing.startsWith("/") ? data.landing : "/student/hoc-tap";
        setTimeout(() => window.location.assign(landing), 900);
        return;
      }
      setCode(""); setInvalid(true);
      if (res.status === 401 && data.code === "wrong") {
        const left = Number(data.attemptsLeft);
        setMsg({ tone: "loi", text: `Mã chưa đúng.${left > 0 ? ` Còn ${left} lần thử.` : ""}` });
      } else if (res.status === 429 && data.code === "locked") { setLock(Number(data.retryAfterSec) || 900); setInvalid(false); }
      else if (data.code === "expired") setMsg({ tone: "cho", text: "Mã đã hết hạn hoặc chưa được gửi. Bấm \"Gửi lại mã\" để nhận mã mới." });
      else setMsg({ tone: "loi", text: String(data.error ?? "Chưa xác thực được. Thử lại.") });
    } catch {
      setMsg({ tone: "loi", text: "Mất kết nối, chưa xác thực được." });
    } finally { setBusy(false); }
  }

  const toneVar = (t: "loi" | "cho" | "xong") => ({ background: `var(--kin-tt-nen-${t})`, color: `var(--kin-tt-chu-${t})`, border: `1px solid var(--kin-tt-vien-${t})` });

  return (
    <form onSubmit={e => { e.preventDefault(); void confirm(); }} noValidate className="flex flex-col gap-[14px] text-left" data-testid="signup-code-form">
      {sent ? (
        <>
          <div className="flex flex-col gap-[6px] text-center">
            <h2 className="text-[length:var(--kin-co-h4)] font-semibold text-[var(--kin-chu-chinh)]">Nhập mã 6 số</h2>
            <p className="text-[length:var(--kin-co-small)] text-[var(--kin-chu-phu)] break-words">
              Mã vừa gửi tới <strong className="font-semibold text-[var(--kin-nhan-link)]">{email}</strong> · mã sống 10 phút
            </p>
          </div>
          {lock !== null ? (
            <LockCountdown key={lock} seconds={lock} onRetry={() => setLock(null)} lockedTitle="Tạm khoá xác thực email" retryLabel="Thử lại" />
          ) : (
            <>
              <CodeBoxes value={code} onChange={v => { setCode(v); if (invalid) setInvalid(false); }} invalid={invalid} ok={ok} disabled={busy || ok} autoFocus onComplete={v => { void confirm(v); }} />
              <KinSubmitButton busy={busy} ok={ok} disabled={code.length !== 6} busyLabel="Đang xác nhận..." className={primaryBtn}>Xác nhận</KinSubmitButton>
            </>
          )}
        </>
      ) : (
        <div className="rounded-lg px-4 py-3" role="alert" style={toneVar("cho")}>
          <p className="text-xs font-semibold mb-1">Chưa gửi được email xác thực</p>
          <p className="text-xs">Tài khoản đã tạo nhưng thư chưa đi. Bấm &quot;Gửi mã&quot; để thử lại; nếu vẫn không được, liên hệ hỗ trợ KiN.</p>
        </div>
      )}

      {msg && <p role="alert" aria-live="polite" className="text-xs rounded-lg px-3 py-2" style={toneVar(msg.tone)}>{msg.text}</p>}

      <div className="rounded-lg p-3 text-xs" style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)", color: "var(--kin-chu-phu)" }}>
        <p className="font-semibold" data-testid="spam-hint">{SPAM_HINT}</p>
        <p className="mt-1">Có thể bấm link dự phòng trong thư thay vì nhập mã.</p>
      </div>

      <div className="flex items-center justify-center gap-[6px] text-[length:var(--kin-co-small)] min-h-11 flex-wrap">
        {sent && <span className="text-[var(--kin-chu-phu)]">Chưa thấy mã?</span>}
        {cooldown > 0
          ? <span className="font-semibold text-[var(--kin-chu-mo)]" aria-live="polite">Gửi lại sau {mmss(cooldown)}</span>
          : <button type="button" onClick={() => void send()} disabled={busy || ok} className={linkBtn}>{sent ? "Gửi lại mã" : "Gửi mã"}</button>}
      </div>
      {onBack && <button type="button" onClick={onBack} className={`${linkBtn} self-center`}>Dùng email khác</button>}
    </form>
  );
}
