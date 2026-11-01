// Đăng nhập (Figma "Nền móng" 464:9828; màn nhập mã 6 số cũ: 32:27).
// 25/10/2026 (Thọ chọn "Theo Figma"): màn đầu có hai tab "Gia sư | Học sinh" cùng một biểu mẫu tài khoản + mật khẩu → /api/auth/login. Tab chỉ đổi phần
//   phụ (tab Học sinh có nút "Tôi có mã mời vào lớp") và vai mà link "Tạo tài khoản KiN" mang sang /dang-ky; KHÔNG giới hạn ai đăng nhập ở tab nào.
//   "Quên mật khẩu?" và "Tạo tài khoản KiN" là nút viền như Figma. Chưa làm: nút Google, ô "Ghi nhớ trên thiết bị này" (chờ Thọ quyết).
// Mã một lần (14/10, Thọ) KHÔNG còn là tab: Figma không vẽ. Giữ làm lối phụ, API nguyên vẹn: /dang-nhap?cach=ma mở thẳng, và nút "Đăng nhập bằng mã một lần"
//   trong thông báo bị chặn tạm (sai mật khẩu nhiều lần). Nhập email (hoặc số điện thoại) → KiN gửi mã 6 số (sống 10 phút, dùng một lần, sai 5 lần khoá 15 phút,
//   gửi lại sau 60 giây) → nhập mã là vào.
// Figma 32:14 / 32:25 (bản cũ) viết "KiN không dùng mật khẩu" — chữ đó KHÔNG đưa lên giao diện vì trái với quyết định 14/10 (mật khẩu là đường chính).
// Khi máy chủ đã cấu hình SMS (/api/auth/code/methods) ô nhận cả SỐ ĐIỆN THOẠI (Figma 33:2); số chỉ vào được nếu đã xác minh trong Hồ sơ.
"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthFrame, AuthAsideBlock, AUTH_CARD } from "@/components/guest/AuthFrame";
import { KinCallout } from "@/components/kin/Callout";
import { kinButtonClass } from "@/components/kin/Button";
import { KinInput } from "@/components/kin/Input";
import { useFieldValidation } from "@/components/kin/useFieldValidation";
import { email as emailRule, required } from "@/lib/fieldRules";
import { CodeBoxes } from "@/components/kin/CodeBoxes";
import { KinSubmitButton } from "@/components/kin/SubmitButton";
import { LockCountdown } from "@/components/kin/LockCountdown";
import { replayClass } from "@/lib/replayClass";
import { KinTabs } from "@/components/kin/Tabs";
import { safeRedirect } from "@/lib/safeRedirect";
import { maskPhone, normalizeVnPhone } from "@/lib/phone";
import { landingPath } from "@/lib/landing";
import { isAdminHost, mainLoginUrl } from "@/lib/hostRouting";

type Step = "email" | "code";
type Method = "mat-khau" | "ma";
type Vai = "gia-su" | "hoc-sinh";
const VAI_TABS = [{ key: "gia-su", label: "Gia sư" }, { key: "hoc-sinh", label: "Học sinh" }] as const;
type Notice = { kind: "wrong" | "locked" | "expired" | "error"; title: string; body?: string; offerCode?: boolean; retryAfterSec?: number };

const field = "w-full h-12 px-[14px] rounded-[var(--kin-bo-sm)] border border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-bang)] text-[length:var(--kin-co-small)] text-[var(--kin-chu-chinh)] placeholder:text-[var(--kin-chu-mo)] outline-none focus:border-[var(--kin-nhan-link)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--kin-nhan-link)]";
const primaryBtn = "w-full h-12 px-4 rounded-[var(--kin-bo-sm)] bg-[var(--kin-nhan-nen)] text-[var(--kin-chu-tren-nut-chinh)] text-[length:var(--kin-co-small)] font-semibold transition-colors hover:bg-[var(--kin-nhan-nen-re)] disabled:opacity-60 disabled:cursor-not-allowed";
// Nút viền của Figma 464:9828 = kiểu "Thường" của KiN (nền trắng, viền ô nhập 3:1), rộng hết thẻ và cao 48px như nút "Đăng nhập".
const outlineBtn = `${kinButtonClass("secondary")} w-full h-12`;
const linkBtn = "text-[length:var(--kin-co-small)] font-semibold text-[var(--kin-nhan-link)] hover:underline";

// HT-02: luật kiểm tại chỗ cho tab Mật khẩu (định nghĩa ngoài thành phần để tham chiếu ổn định).
const PW_RULES = { id: [required("Chưa nhập tài khoản"), (v: string) => (v.includes("@") ? emailRule()(v) : null)], pass: [required("Chưa nhập mật khẩu")] };
const MAIN_LOGIN_DEFAULT = "https://midnightelite-edu.com/dang-nhap";
const noopSubscribe = () => () => {};
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function DangNhapForm() {
  const { login, loginWithCode, user, isLoading } = useAuth();
  const router       = useRouter();
  const searchParams = useSearchParams();
  const redirectTo   = safeRedirect(searchParams.get("redirect"));
  // Cửa đăng nhập của tên miền chính — chỉ hiện ở tên miền admin (data-chi-admin). Bản dựng sẵn không biết tên miền nên mặc định là tên miền thật; ở trình duyệt thì suy từ tên miền đang mở
  // (useSyncExternalStore: không setState trong effect, và lúc hydrate vẫn dùng bản của máy chủ nên không lệch).
  // Mang theo ?redirect= (trang người dùng đang định vào, vd /admin/khoa-hoc): gia sư bị đẩy nhầm sang cửa quản trị, sang cửa chính đăng nhập xong thì vào đúng trang đó.
  const mainLogin = useSyncExternalStore(
    noopSubscribe,
    () => (isAdminHost(window.location.host) ? mainLoginUrl(window.location.host, window.location.protocol, redirectTo) : MAIN_LOGIN_DEFAULT),
    () => MAIN_LOGIN_DEFAULT,
  );

  const [phoneOn, setPhoneOn]       = useState(false); // máy chủ đã mở đăng nhập bằng SMS chưa
  const [method, setMethod]         = useState<Method>(searchParams.get("cach") === "ma" ? "ma" : "mat-khau");
  const [vai, setVai]               = useState<Vai>(searchParams.get("vai") === "hoc-sinh" ? "hoc-sinh" : "gia-su");
  const [step, setStep]             = useState<Step>("email");
  const [email, setEmail]           = useState("");   // ô "tài khoản": dùng chung cho cả hai tab
  const [password, setPassword]     = useState("");
  const [showPass, setShowPass]     = useState(false);
  const [code, setCode]             = useState("");
  const [invalid, setInvalid]       = useState(false);
  const [notice, setNotice]         = useState<Notice | null>(null);
  // Mốc được gửi lại (ms) + đồng hồ cập nhật mỗi 0,5 giây khi đang đếm ngược.
  const [resendAt, setResendAt]     = useState<number | null>(null);
  const [now, setNow]               = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [ok, setOk]                 = useState(false); // đăng nhập thành công, đang chờ chuyển trang (nút hiện dấu tích, sáu ô mã đổi màu xong)
  const fv = useFieldValidation(PW_RULES);
  const pwFormRef = useRef<HTMLFormElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);        // thẻ đăng nhập: lắc đầu khi sai mật khẩu
  const codeRef = useRef<HTMLDivElement>(null);
  // Tiêu điểm vào ô tài khoản đúng MỘT lần lúc mở trang. Không dùng autoFocus: mỗi lần đổi tab, vùng nội dung gắn lại và ô mới sẽ giành mất
  // tiêu điểm khỏi dải tab, người dùng bàn phím không bấm mũi tên tiếp được (mẫu tab của WAI-ARIA: tiêu điểm ở lại trên tab).
  const focusedOnce = useRef(false);
  const focusOnce = (el: HTMLInputElement | null) => { if (el && !focusedOnce.current) { focusedOnce.current = true; el.focus(); } };

  useEffect(() => {
    if (!isLoading && user) {
      router.replace(redirectTo ?? landingPath(user.role ?? "student", user.adminRole, user.tutorPending)); // BU-00 bước 5: gia sư chờ duyệt → trang chờ duyệt
    }
  }, [user, isLoading, router, redirectTo]);

  useEffect(() => {
    fetch("/api/auth/code/methods").then(r => r.json()).then(d => setPhoneOn(d?.phone === true)).catch(() => {});
  }, []);

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

  // Ô nhập có '@' → email; không có → số điện thoại (chỉ khi máy chủ đã mở SMS).
  const asPhone = phoneOn && email.trim() !== "" && !email.includes("@");
  const channelWord = asPhone ? "số điện thoại" : "email";
  const shown = asPhone ? (() => { const e = normalizeVnPhone(email); return e ? maskPhone(e) : email.trim(); })() : email.trim().toLowerCase();

  function chooseMethod(m: Method) {
    setMethod(m); setNotice(null); setShowPass(false);
  }

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    setNotice(null);
    if (!email.trim()) { setNotice({ kind: "error", title: phoneOn ? "Vui lòng nhập số điện thoại hoặc email" : "Vui lòng nhập email" }); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/code/request", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(phoneOn ? { identifier: email } : { email }),
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
        setNotice({ kind: "locked", title: data.error, body: "Đây là chặn người đoán mã, không phải phạt bạn.", retryAfterSec: data.retryAfterSec });
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
    let r: Awaited<ReturnType<typeof loginWithCode>>;
    try { r = await loginWithCode(email, value); }
    catch { setSubmitting(false); setNotice({ kind: "error", title: "Không có kết nối. Thử lại sau." }); return; }
    if (r.success) { setOk(true); return; } // AuthContext chuyển trang
    setSubmitting(false);
    if (r.code === "wrong") {
      setInvalid(true); setCode("");
      setNotice({ kind: "wrong", title: `Mã không đúng — còn ${r.attemptsLeft ?? 0} lần thử`, body: `Sai 5 lần thì KiN khoá đăng nhập ${channelWord} này trong 15 phút. Đây là chặn người đoán mã, không phải phạt bạn.` });
      focusFirstBox();
    } else if (r.code === "locked") {
      setInvalid(true); setCode("");
      setNotice({ kind: "locked", title: r.message ?? `Đã khoá đăng nhập ${channelWord} này`, body: "Đây là chặn người đoán mã, không phải phạt bạn.", retryAfterSec: r.retryAfterSec });
    } else if (r.code === "expired") {
      setInvalid(true); setCode("");
      setNotice({ kind: "expired", title: "Mã đã hết hạn hoặc chưa được gửi", body: "Bấm “Gửi lại mã” để nhận mã mới." });
    } else {
      setNotice({ kind: "error", title: r.message ?? "Đăng nhập thất bại" });
    }
  }

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setNotice(null);
    if (!fv.validateAll({ id: email, pass: password })) { fv.focusFirst(pwFormRef.current); return; }
    setSubmitting(true);
    try {
      const result = await login(email, password);
      if (!result.success) {
        // Bị chặn tạm vì sai nhiều lần: mời sang đăng nhập bằng mã, đó là lối thoát ngay lúc này.
        setNotice({ kind: result.code === "wait" ? "locked" : "error", title: result.message ?? "Đăng nhập thất bại", offerCode: result.code === "wait", retryAfterSec: result.code === "wait" ? result.retryAfterSec : undefined });
        setSubmitting(false);
        replayClass(cardRef.current, "kin-shake"); // sai → cả thẻ lắc đầu
      } else {
        setOk(true); // nút hiện dấu tích trong lúc AuthContext chuyển trang (không chờ thêm gì)
      }
    } catch {
      // Mất mạng giữa chừng: không để nút kẹt ở "Đang đăng nhập…".
      setNotice({ kind: "error", title: "Không có kết nối. Thử lại sau." });
      setSubmitting(false);
    }
  }

  function backToEmail() {
    setStep("email"); setCode(""); setInvalid(false); setNotice(null);
  }

  // Không `return null` khi isLoading (15/10/2026): máy chủ vẽ rỗng còn trình duyệt vẽ form nếu /api/auth/me trả về trước khi vùng này kịp hydrate → lỗi
  // "Hydration failed" lúc có lúc không (~một nửa lần tải cứng). Luôn vẽ form: khách thấy ngay, người đã đăng nhập vẫn bị chuyển đi bởi effect phía trên.

  const noticeBox = notice && (
    <div
      role="alert"
      className="kin-notice-in kin-m flex flex-col gap-1 rounded-[var(--kin-bo-sm)] px-[14px] py-3 border"
      style={notice.kind === "expired"
        ? { background: "var(--kin-nen-nhan)", borderColor: "var(--kin-vien-thuong)" }
        : { background: "var(--kin-nhan-nen-nhat)", borderColor: "var(--kin-tt-chu-loi)" }}
    >
      <p className="text-[length:var(--kin-co-small)] font-semibold" style={{ color: notice.kind === "expired" ? "var(--kin-chu-chinh)" : "var(--kin-tt-chu-loi)" }}>{notice.title}</p>
      {notice.body && <p className="text-[length:var(--kin-co-caption)] text-[var(--kin-chu-chinh)]">{notice.body}</p>}
      {notice.kind === "locked" && notice.retryAfterSec && notice.retryAfterSec > 0 && (
        <LockCountdown key={notice.retryAfterSec + notice.title} seconds={notice.retryAfterSec} onRetry={() => setNotice(null)} />
      )}
      {notice.offerCode && (
        <button type="button" onClick={() => chooseMethod("ma")} className={`${linkBtn} self-start min-h-11`}>Đăng nhập bằng mã một lần</button>
      )}
    </div>
  );

  const idLabel = phoneOn ? "Số điện thoại hoặc email" : "Email";
  const idPlaceholder = phoneOn ? "0901 234 567 hoặc ten@gmail.com" : "ten@gmail.com";

  return (
    <AuthFrame
      title={step === "code" ? "Nhập mã đăng nhập" : "Đăng nhập KiN"}
      sub="Dành cho gia sư và học sinh. Phụ huynh không cần tài khoản."
      aside={step === "email" && (
        <>
          <AuthAsideBlock title="Gia sư và học sinh">
            Gia sư vào sổ dạy học của mình. Học sinh dùng tài khoản cá nhân và mã mời để tham gia đúng lớp.
          </AuthAsideBlock>
          <KinCallout title="An toàn tài khoản">
            Không dùng chung mật khẩu. Chỉ nhớ đăng nhập trên thiết bị riêng; đăng xuất sau khi dùng máy công cộng.
          </KinCallout>
          {/* Chỉ dành cho khách / học viên ở tên miền chính — ẩn ở cửa quản trị (data-chi-khach, xem src/lib/hostChrome.ts). */}
          <div data-chi-khach className="space-y-4">
            <AuthAsideBlock title="Không cần đăng nhập">
              Phụ huynh mở báo cáo bằng đường dẫn riêng mà gia sư gửi. Khách tìm gia sư hoặc gửi nhu cầu cũng không cần tài khoản.
            </AuthAsideBlock>
            <div className="flex flex-col gap-1 rounded-[var(--kin-bo-sm)] px-[14px] py-3 bg-[var(--kin-nen-dang-chon)]">
              <h3 className="text-[length:var(--kin-co-small)] font-semibold text-[var(--kin-chu-chinh)]">Phụ huynh thì không cần đăng nhập</h3>
              <p className="text-[length:var(--kin-co-caption)] text-[var(--kin-chu-mo-tren-nen-nhan)]">
                Gia sư gửi cho anh chị một đường dẫn riêng. Bấm vào là xem được buổi học và học phí của con — không tài khoản, không mật khẩu.{" "}
                <Link href="/phu-huynh" className="font-semibold text-[var(--kin-nhan-link)] underline">Tìm hiểu thêm</Link>
              </p>
            </div>
            <Link href="/giang-vien" className={kinButtonClass("secondary")}>Tìm gia sư</Link>
          </div>
        </>
      )}
    >
      <div ref={cardRef} data-auth-card className={AUTH_CARD}>

        {step === "email" && (
          <div className="px-5 pt-2 pb-5 flex flex-col gap-4">
            <h2 className="kin-chu-tieu-de font-semibold text-[length:var(--kin-co-h4)] text-[var(--kin-chu-chinh)]">Đăng nhập</h2>
            {/* Ở cửa quản trị không có "vai" để chọn (data-chi-khach, xem src/lib/hostChrome.ts). onMouseDown: bấm tab bằng chuột không kéo tiêu điểm khỏi ô đang gõ,
                nếu không ô tài khoản (tự lấy tiêu điểm lúc mở trang) bị coi là "đã rời ô" và báo "Chưa nhập tài khoản" ngay khi khách chỉ đổi tab. */}
            <div data-chi-khach className="contents" onMouseDown={e => { if ((e.target as HTMLElement).closest("[role=tab]")) e.preventDefault(); }}>
              <KinTabs
                label="Vai trò"
                tabs={VAI_TABS}
                value={vai}
                onChange={setVai}
                tabId={k => `dn-tab-${k}`}
                panelId={k => `dn-panel-${k}`}
              />
            </div>

            <div role="tabpanel" id={`dn-panel-${vai}`} aria-labelledby={`dn-tab-${vai}`} className="flex flex-col gap-4">
            {method === "mat-khau" && (
              <form ref={pwFormRef} onSubmit={submitPassword} noValidate className="flex flex-col gap-4">
                <KinInput id="dn-id-pw" size="lg" label={idLabel} type={phoneOn ? "text" : "email"} inputMode={phoneOn ? "text" : "email"} autoComplete="username"
                  ref={focusOnce} value={email} onChange={e => setEmail(e.target.value)} placeholder={idPlaceholder} {...fv.bind("id", email)} />
                <KinInput id="dn-pass" size="lg" label="Mật khẩu" type={showPass ? "text" : "password"} autoComplete="current-password"
                  value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" {...fv.bind("pass", password)}
                  suffix={<button type="button" onClick={() => setShowPass(!showPass)} aria-pressed={showPass} className="min-h-11 min-w-8 text-[length:var(--kin-co-caption)] font-medium text-[var(--kin-chu-mo)] hover:text-[var(--kin-chu-chinh)]">{showPass ? "Ẩn" : "Hiện"}</button>} />
                {noticeBox}
                <KinSubmitButton busy={submitting} ok={ok} busyLabel="Đang đăng nhập..." className={primaryBtn}>Đăng nhập</KinSubmitButton>
                <Link href={email.includes("@") ? `/quen-mat-khau?email=${encodeURIComponent(email.trim())}` : "/quen-mat-khau"} className={outlineBtn}>Quên mật khẩu?</Link>
              </form>
            )}

            {method === "ma" && (
              <form onSubmit={sendCode} noValidate className="flex flex-col gap-4">
                <div className="flex flex-col gap-[6px]">
                  <label htmlFor="dn-email" className="text-[length:var(--kin-co-small)] font-medium text-[var(--kin-chu-phu)]">{idLabel}</label>
                  <input id="dn-email" type={phoneOn ? "text" : "email"} inputMode={phoneOn ? "text" : "email"} autoComplete={phoneOn ? "username" : "email"} ref={focusOnce} value={email}
                    onChange={e => setEmail(e.target.value)} placeholder={idPlaceholder} className={field} />
                </div>
                {noticeBox}
                <KinSubmitButton busy={submitting} busyLabel="Đang gửi mã..." className={primaryBtn}>Gửi mã đăng nhập</KinSubmitButton>
                <p className="text-[length:var(--kin-co-caption)] text-[var(--kin-chu-mo)]">
                  Không cần nhớ mật khẩu: bạn nhận một mã 6 số dùng một lần qua {phoneOn ? "SMS hoặc email" : "email"}.
                  {phoneOn && " Số điện thoại chỉ nhận được mã sau khi bạn đã xác minh số trong Hồ sơ; chưa xác minh thì dùng email."}
                </p>
                <button type="button" onClick={() => chooseMethod("mat-khau")} className={`${linkBtn} self-center min-h-11`}>Đăng nhập bằng mật khẩu</button>
              </form>
            )}
            </div>

            {/* Chỉ dành cho khách / học viên ở tên miền chính — ẩn ở cửa quản trị (data-chi-khach, xem src/lib/hostChrome.ts). `contents`: khối bọc không tạo hộp, các phần tử vẫn xếp trong cột. */}
            <div data-chi-khach className="contents">
              {/* Figma 464:9828: mã mời là việc của học sinh, nên nằm ở tab Học sinh. */}
              {vai === "hoc-sinh" && <Link href="/student/nhap-ma-lop" className={outlineBtn}>Tôi có mã mời vào lớp</Link>}
              <div className="flex flex-col gap-3">
                <p className="text-[length:var(--kin-co-caption)] text-[var(--kin-chu-mo)]">Chưa có tài khoản? Đăng ký gia sư hoặc học sinh.</p>
                <Link href={`/dang-ky?vai=${vai}`} className={outlineBtn}>Tạo tài khoản KiN</Link>
              </div>
            </div>
            {/* Ngược lại, chỉ ở cửa quản trị: học viên / gia sư đăng nhập ở tên miền chính (cookie phiên không dùng chung giữa hai tên miền). */}
            <p data-chi-admin className="text-center text-[length:var(--kin-co-caption)] text-[var(--kin-chu-phu)]">
              Đây là cửa đăng nhập dành cho quản trị. Học viên / gia sư đăng nhập tại{" "}
              <a href={mainLogin} className="font-semibold text-[var(--kin-nhan-link)] underline">midnightelite-edu.com</a>.
            </p>
          </div>
        )}

        {step === "code" && (
          <form onSubmit={e => { e.preventDefault(); void submitCode(); }} noValidate className="px-5 pt-2 pb-5 flex flex-col gap-[14px]">
            <div className="flex flex-col gap-[6px]">
              <h2 className="kin-chu-tieu-de font-semibold text-[length:var(--kin-co-h4)] text-[var(--kin-chu-chinh)]">Nhập mã 6 số</h2>
              <p className="text-[length:var(--kin-co-small)] text-[var(--kin-chu-phu)] break-words">
                Mã vừa gửi tới <strong className="font-semibold">{shown}</strong>{asPhone ? " qua SMS" : ""} · mã sống 10 phút
              </p>
            </div>
            <div ref={codeRef}>
              <CodeBoxes value={code} onChange={v => { setCode(v); if (invalid) setInvalid(false); }} invalid={invalid} ok={ok} disabled={submitting} autoFocus
                onComplete={v => { void submitCode(v); }} />
            </div>
            {noticeBox}
            <KinSubmitButton busy={submitting} ok={ok} disabled={code.length !== 6} busyLabel="Đang xác nhận..." className={primaryBtn}>Xác nhận</KinSubmitButton>
            <div className="flex items-center justify-center gap-[6px] text-[length:var(--kin-co-small)] min-h-11">
              <span className="text-[var(--kin-chu-phu)]">Chưa thấy mã?</span>
              {cooldown > 0
                ? <span className="font-semibold text-[var(--kin-chu-mo)]" aria-live="polite">Gửi lại sau {mmss(cooldown)}</span>
                : <button type="button" onClick={() => void sendCode()} disabled={submitting} className={linkBtn}>Gửi lại mã</button>}
            </div>
            {asPhone && (
              <p className="text-[length:var(--kin-co-caption)] text-[var(--kin-chu-mo)] text-center">
                Không nhận được SMS? Có thể số này chưa được xác minh trong Hồ sơ — hãy quay lại và dùng email.
              </p>
            )}
            <button type="button" onClick={backToEmail} className={`${linkBtn} self-center min-h-11`}>{asPhone ? "Đổi số điện thoại" : "Đổi email"}</button>
          </form>
        )}

      </div>
    </AuthFrame>
  );
}

export default function DangNhapPage() {
  // useSearchParams cần Suspense khi dựng sẵn trang
  return <Suspense fallback={null}><DangNhapForm /></Suspense>;
}
