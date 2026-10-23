// Thẻ "Đăng nhập bằng số điện thoại" (hồ sơ học sinh, cài đặt gia sư): xác minh số bằng mã SMS để dùng số đó đăng nhập.
// Chỉ HIỆN khi máy chủ đã mở SMS (/api/auth/code/methods) — chưa cấu hình thì thẻ không có mặt, không hứa điều chưa làm được.
//   Chưa xác minh : nhập số → "Gửi mã SMS" → sáu ô mã → "Xác minh". Gửi lại sau 60 giây, sai 5 lần khoá 15 phút (như đăng nhập).
//   Đã xác minh   : "Số 090 ••• 4567 đã xác minh" + "Gỡ số" (hỏi lại bằng hộp xác nhận).
// Đổi ô "Số điện thoại" ở hồ sơ sang số khác thì xác minh tự mất (máy chủ làm); thẻ tải lại khi `profilePhone` đổi.
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { KinButton } from "@/components/kin/Button";
import { KinSectionHead } from "@/components/kin/SectionHead";
import { CodeBoxes } from "@/components/kin/CodeBoxes";
import { useKinConfirm } from "@/components/kin/useConfirm";
import { maskPhone, normalizeVnPhone } from "@/lib/phone";

type View = { verified: boolean; phone: string | null };
type Msg = { kind: "ok" | "error"; text: string };

const FIELD = "w-full h-12 px-[14px] rounded-[var(--kin-bo-sm)] border border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-trang)] text-[length:var(--kin-co-small)] text-[var(--kin-chu-chinh)] outline-none focus:border-[var(--kin-nhan-link)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--kin-nhan-link)]";

export default function PhoneLoginCard({ profilePhone, className = "", compact = false, plain = false }: { profilePhone?: string | null; className?: string; compact?: boolean; /** Không khung: đầu mục theo KinSectionHead (trang Cài đặt gia sư). */ plain?: boolean }) {
  const { ask, dialog } = useKinConfirm();
  const [enabled, setEnabled] = useState(false);
  const [view, setView] = useState<View | null>(null);
  // Người dùng chưa gõ gì thì lấy số trong hồ sơ; gõ rồi thì giữ số đang gõ.
  const [typed, setTyped] = useState<string | null>(null);
  const phone = typed ?? profilePhone ?? "";
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg | null>(null);
  const [resendAt, setResendAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const boxes = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    fetch("/api/users/me").then(r => (r.ok ? r.json() : null)).then(d => {
      if (d) setView({ verified: d.phoneVerified === true, phone: d.phone ?? null });
    }).catch(() => {});
  }, []);
  useEffect(() => { fetch("/api/auth/code/methods").then(r => r.json()).then(d => setEnabled(d?.phone === true)).catch(() => {}); }, []);
  useEffect(() => { load(); }, [load, profilePhone]);
  useEffect(() => {
    if (resendAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [resendAt]);

  if (!enabled || !view) return null;
  const cooldown = resendAt === null ? 0 : Math.max(0, Math.ceil((resendAt - now) / 1000));
  const e164 = normalizeVnPhone(phone);
  const startCooldown = (sec: number) => { const t = Date.now(); setNow(t); setResendAt(t + sec * 1000); };
  const verifiedMask = view.verified && view.phone ? (() => { const n = normalizeVnPhone(view.phone); return n ? maskPhone(n) : view.phone; })() : null;

  async function send() {
    setMsg(null);
    if (!e164) { setMsg({ kind: "error", text: "Nhập số di động Việt Nam (10 số, ví dụ 0901 234 567)." }); return; }
    setBusy(true);
    const res = await fetch("/api/auth/phone/request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone }) }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (res?.ok && data.alreadyVerified) { load(); return; }
    if (res?.ok || (res?.status === 429 && data.code === "wait" && (data.retryAfterSec ?? 999) <= 60)) {
      setSent(true); setCode(""); setInvalid(false); startCooldown(res.ok ? data.resendAfterSec ?? 60 : data.retryAfterSec ?? 60);
      setTimeout(() => boxes.current?.querySelector<HTMLInputElement>("input")?.focus(), 50);
      return;
    }
    setMsg({ kind: "error", text: data.error ?? (res ? "Không gửi được mã. Thử lại sau." : "Không có kết nối. Thử lại sau.") });
  }

  async function submitCode(value: string = code) {
    if (busy) return;
    if (value.length !== 6) { setInvalid(true); setMsg({ kind: "error", text: "Mã gồm đúng 6 chữ số." }); return; }
    setBusy(true); setMsg(null);
    const res = await fetch("/api/auth/phone/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, code: value }) }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (res?.ok) { setSent(false); setCode(""); setMsg({ kind: "ok", text: "Đã xác minh. Từ giờ bạn đăng nhập được bằng số này." }); load(); return; }
    setInvalid(true); setCode("");
    if (data.code === "wrong") setMsg({ kind: "error", text: `Mã không đúng — còn ${data.attemptsLeft ?? 0} lần thử.` });
    else setMsg({ kind: "error", text: data.error ?? "Không xác minh được. Thử lại sau." });
    if (data.code === "taken" || data.code === "expired" || data.code === "locked") setSent(false);
  }

  async function remove() {
    if (!(await ask({ title: "Gỡ số điện thoại đăng nhập?", message: "Số này sẽ không nhận mã đăng nhập nữa. Bạn vẫn đăng nhập được bằng email và có thể xác minh lại bất cứ lúc nào.", confirmLabel: "Gỡ số" }))) return;
    setBusy(true);
    const res = await fetch("/api/auth/phone", { method: "DELETE" }).catch(() => null);
    setBusy(false);
    if (res?.ok) { setMsg({ kind: "ok", text: "Đã gỡ số đăng nhập." }); load(); } else setMsg({ kind: "error", text: "Không gỡ được. Thử lại sau." });
  }

  return (
    <section aria-labelledby="h-dn-sdt" className={plain ? className : `rounded-xl ${compact ? "p-5" : "p-4"} ${className}`} style={plain ? undefined : { background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)" }}>
      {dialog}
      {plain
        ? <KinSectionHead id="h-dn-sdt" title="Đăng nhập bằng số điện thoại" />
        : <h2 id="h-dn-sdt" className={`font-bold ${compact ? "text-sm" : ""}`} style={{ color: compact ? "var(--kin-chu-phu)" : "var(--kin-chu-chinh)" }}>Đăng nhập bằng số điện thoại</h2>}
      {view.verified ? (
        <div className="mt-2 flex flex-col gap-3">
          <p className={compact ? "text-xs" : "text-sm"} style={{ color: "var(--kin-chu-phu)" }}>
            Số <strong className="font-semibold" style={{ color: "var(--kin-chu-chinh)" }}>{verifiedMask}</strong> đã xác minh. Ở màn đăng nhập, nhập số này để nhận mã 6 số qua SMS.
          </p>
          <div><KinButton variant="secondary" onClick={remove} disabled={busy}>Gỡ số</KinButton></div>
        </div>
      ) : (
        <div className="mt-2 flex flex-col gap-3">
          <p className={compact ? "text-xs" : "text-sm"} style={{ color: "var(--kin-chu-phu)" }}>
            Xác minh số di động để đăng nhập bằng mã SMS thay vì email. KiN gửi một mã 6 số tới số này; chỉ số đã xác minh mới nhận được mã đăng nhập.
          </p>
          {!sent ? (
            <>
              <label htmlFor="sdt-xm" className="text-sm font-medium" style={{ color: "var(--kin-chu-phu)" }}>Số điện thoại</label>
              <input id="sdt-xm" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={e => setTyped(e.target.value)} placeholder="0901 234 567" className={FIELD} />
              <div><KinButton onClick={send} loading={busy} loadingLabel="Đang gửi…">Gửi mã SMS</KinButton></div>
            </>
          ) : (
            <>
              <p className="text-sm" style={{ color: "var(--kin-chu-phu)" }}>
                Mã vừa gửi tới <strong className="font-semibold" style={{ color: "var(--kin-chu-chinh)" }}>{e164 ? maskPhone(e164) : phone}</strong> qua SMS · mã sống 10 phút
              </p>
              <div ref={boxes}><CodeBoxes value={code} onChange={v => { setCode(v); if (invalid) setInvalid(false); }} invalid={invalid} disabled={busy} onComplete={v => { void submitCode(v); }} /></div>
              <div className="flex flex-wrap items-center gap-3">
                <KinButton onClick={() => void submitCode()} loading={busy} loadingLabel="Đang xác minh…" disabled={code.length !== 6}>Xác minh</KinButton>
                {cooldown > 0
                  ? <span className="text-sm font-semibold" style={{ color: "var(--kin-chu-mo)" }} aria-live="polite">Gửi lại sau {Math.floor(cooldown / 60)}:{String(cooldown % 60).padStart(2, "0")}</span>
                  : <KinButton variant="ghost" onClick={() => void send()} disabled={busy}>Gửi lại mã</KinButton>}
                <KinButton variant="ghost" onClick={() => { setSent(false); setCode(""); setMsg(null); setTyped(null); }} disabled={busy}>Đổi số</KinButton>
              </div>
            </>
          )}
        </div>
      )}
      {msg && <p role={msg.kind === "error" ? "alert" : "status"} className="mt-3 text-sm font-semibold" style={{ color: msg.kind === "error" ? "var(--kin-tt-chu-loi)" : "var(--kin-tt-chu-xong)" }}>{msg.text}</p>}
    </section>
  );
}
