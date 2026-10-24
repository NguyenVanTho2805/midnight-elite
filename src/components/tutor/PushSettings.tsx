// ĐX-02 — Cài đặt → "Thông báo đẩy" (gia sư). Figma G1 / G1b / G2 (trang "Nâng cấp lần 1").
// Bật / tắt trên MÁY NÀY, công tắc từng loại tin, danh sách thiết bị, nút gửi thử, hướng dẫn iPhone.
// Chữ trên màn hình khoá do máy chủ dựng từ loại tin (không tên em, không số tiền); trang này chỉ quản lý đăng ký và công tắc.
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { KinButton } from "@/components/kin";
import { KinSectionHead } from "@/components/kin/SectionHead";
import { Badge, callApi, useNotify } from "@/components/tutor/shared";
import { PUSH_DEFS, PUSH_TYPES, endpointFingerprint, type PushType, type PushTypes } from "@/lib/pushRules";
import { isIosDevice, pushUiState, serverOffText, urlBase64ToUint8Array, type PushUiState } from "@/lib/pushClient";

interface Device { id: string; label: string; createdAt: string; lastSeenAt: string; mine: boolean }
interface Settings { enabled: boolean; reason: string | null; publicKey: string | null; types: PushTypes; devices: Device[]; maxDevices: number }
interface Env { supported: boolean; ios: boolean; standalone: boolean; permission: "default" | "granted" | "denied"; localSub: boolean; fp: string | null }

const MUTED = { color: "var(--kin-chu-phu)" } as const;
/** "22/10 06:03" (giờ của trình duyệt). toLocaleString("vi-VN") với các tuỳ chọn này ra "06:03 22-10": ngày đứng sau giờ và dùng gạch ngang, khó đọc. */
const when = (iso: string) => {
  const d = new Date(iso), p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** Đọc những gì chỉ trình duyệt biết: có hỗ trợ không, quyền, đã cài vào Màn hình chính chưa, đăng ký đẩy hiện có. */
async function readEnv(): Promise<Env> {
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const ios = isIosDevice(navigator.userAgent, navigator.maxTouchPoints ?? 0);
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  let localSub = false, fp: string | null = null;
  if (supported) {
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) { localSub = true; fp = await endpointFingerprint(sub.endpoint); }
    } catch { /* coi như chưa đăng ký */ }
  }
  return { supported, ios, standalone, permission: supported ? Notification.permission : "default", localSub, fp };
}

export default function PushSettings() {
  const notify = useNotify();
  const [env, setEnv] = useState<Env | null>(null);
  const [cfg, setCfg] = useState<Settings | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const seq = useRef(0);

  const refresh = useCallback(async () => {
    await Promise.resolve();
    const my = ++seq.current;
    const e = await readEnv();
    const r = await callApi<Settings>(`/api/push/settings${e.fp ? `?e=${e.fp}` : ""}`);
    if (my !== seq.current) return;
    setEnv(e);
    if (r.ok) { setCfg(r.data); setFailed(false); } else setFailed(true);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const state: PushUiState | null = env && cfg
    ? pushUiState({ supported: env.supported, ios: env.ios, standalone: env.standalone, serverEnabled: cfg.enabled, permission: env.permission, localSub: env.localSub, mineOnServer: cfg.devices.some(d => d.mine) })
    : null;

  async function enable() {
    if (!cfg?.publicKey) return;
    setBusy("enable");
    let createdHere = false;
    let sub: PushSubscription | null = null;
    try {
      // Phải xin quyền NGAY trong lúc xử lý cú bấm (trình duyệt từ chối xin quyền nếu không có thao tác của người dùng).
      const perm = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
      if (perm !== "granted") { notify.info(perm === "denied" ? "Trình duyệt đang chặn thông báo của KiN." : "Bạn chưa cho phép thông báo."); return; }
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
      await navigator.serviceWorker.ready;
      const key = urlBase64ToUint8Array(cfg.publicKey);
      sub = await reg.pushManager.getSubscription();
      if (!sub) { sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }); createdHere = true; }
      const r = await callApi<{ error?: string }>("/api/push/subscribe", { method: "POST", body: JSON.stringify({ subscription: sub.toJSON(), userAgent: navigator.userAgent }) });
      if (!r.ok) {
        if (createdHere) await sub.unsubscribe().catch(() => {}); // đừng để lại đăng ký mà máy chủ không nhớ
        notify.err(r.data.error ?? "Không bật được thông báo đẩy");
        return;
      }
      notify.ok("Đã bật thông báo đẩy trên máy này.");
    } catch (e) {
      if (createdHere && sub) await sub.unsubscribe().catch(() => {});
      notify.err(e instanceof Error && e.name === "InvalidStateError"
        ? "Máy này đang giữ một đăng ký cũ. Hãy bấm “Tắt máy này” (nếu có) rồi thử lại."
        : "Không bật được thông báo đẩy. Hãy thử lại sau.");
    } finally {
      setBusy(null);
      await refresh();
    }
  }

  async function disableHere() {
    setBusy("disable");
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        const r = await callApi<{ error?: string }>("/api/push/subscribe", { method: "DELETE", body: JSON.stringify({ endpoint: sub.endpoint }) });
        if (!r.ok) { notify.err(r.data.error ?? "Không tắt được"); return; }
        await sub.unsubscribe().catch(() => {});
      }
      notify.ok("Đã tắt thông báo đẩy trên máy này. KiN vẫn báo trong ứng dụng.");
    } finally {
      setBusy(null);
      await refresh();
    }
  }

  async function removeDevice(d: Device) {
    setBusy(`rm:${d.id}`);
    const r = await callApi<{ error?: string }>("/api/push/subscribe", { method: "DELETE", body: JSON.stringify({ id: d.id }) });
    setBusy(null);
    if (!r.ok) { notify.err(r.data.error ?? "Không gỡ được"); return; }
    notify.ok(`Đã gỡ ${d.label}.`);
    await refresh();
  }

  async function toggle(type: PushType, v: boolean) {
    setBusy(`t:${type}`);
    const r = await callApi<{ types: PushTypes }>("/api/push/settings", { method: "PUT", body: JSON.stringify({ [type]: v }) });
    setBusy(null);
    if (!r.ok) { notify.err(r.data.error ?? "Không lưu được"); return; }
    setCfg(c => (c ? { ...c, types: r.data.types } : c));
  }

  async function sendTest() {
    setBusy("test");
    const r = await callApi<{ sent?: number; failed?: number; revoked?: number }>("/api/push/test", { method: "POST" });
    setBusy(null);
    if (!r.ok) { notify.err(r.data.error ?? "Không gửi thử được"); return; }
    if ((r.data.sent ?? 0) > 0) notify.ok("Đã gửi thử. Vài giây nữa bạn sẽ thấy thông báo trên máy.");
    else notify.err("Không gửi được tới thiết bị nào. Thử bật lại thông báo trên máy này.");
    await refresh();
  }

  return (
    <section id="thong-bao-day" aria-labelledby="h-push">
      <KinSectionHead id="h-push" title="Thông báo đẩy" />
      <p className="text-[length:var(--kin-co-goc)] mt-4 mb-4" style={MUTED}>Nhận báo ngay trên điện thoại khi có việc cần xử lý, kể cả khi KiN đang đóng.</p>

      {failed && !cfg ? (
        <div role="alert" className="text-sm">Không tải được cài đặt thông báo đẩy. <button className="underline font-medium" onClick={() => void refresh()}>Thử lại</button></div>
      ) : !state || !cfg || !env ? (
        <div className="h-[140px] rounded kin-skel kin-skel--soft" aria-busy="true" />
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg p-3" style={{ border: "1px solid var(--kin-vien-thuong)" }} data-testid="push-here" data-state={state}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm font-medium" style={{ color: "var(--kin-chu-chinh)" }}>Thông báo đẩy trên máy này</p>
              {state === "on" && <Badge tone="ok">Đã bật</Badge>}
              {state === "off" && <Badge tone="neutral">Chưa bật</Badge>}
              {state === "blocked" && <Badge tone="bad">Bị trình duyệt chặn</Badge>}
            </div>
            {state === "on" && <p className="text-[length:var(--kin-co-goc)] mt-1" style={MUTED}>Tắt thì KiN vẫn báo trong ứng dụng, chỉ không đẩy ra ngoài.</p>}
            {state === "off" && <p className="text-[length:var(--kin-co-goc)] mt-1" style={MUTED}>Bật để nhận báo nghỉ sát giờ và khoản tiền cần đối soát ngay trên máy này.</p>}
            {state === "blocked" && (
              <p className="text-[length:var(--kin-co-goc)] mt-1" style={MUTED}>
                Trình duyệt đang chặn thông báo của KiN. Bấm biểu tượng ổ khoá cạnh địa chỉ trang → Thông báo → Cho phép, rồi quay lại đây bấm Thử lại. KiN không thể tự bật lại quyền này.
                Trong lúc chờ, mọi việc vẫn hiện trong Hộp việc và thanh số đỏ như bình thường.
              </p>
            )}
            {state === "server-off" && <p className="text-[length:var(--kin-co-goc)] mt-1" style={MUTED}>{serverOffText(cfg.reason)}</p>}
            {state === "unsupported" && <p className="text-[length:var(--kin-co-goc)] mt-1" style={MUTED}>Trình duyệt này không hỗ trợ thông báo đẩy. Hãy dùng Chrome, Edge, Firefox hoặc Safari bản mới.</p>}
            {state === "ios-install" && <p className="text-[length:var(--kin-co-goc)] mt-1" style={MUTED}>iPhone chỉ nhận thông báo đẩy khi KiN đã được thêm vào Màn hình chính. Làm theo mục “Cài KiN lên Màn hình chính” bên dưới rồi mở KiN từ biểu tượng mới.</p>}
            <div className="mt-3 flex gap-2 flex-wrap">
              {state === "off" && <KinButton onClick={() => void enable()} loading={busy === "enable"}>Bật trên máy này</KinButton>}
              {state === "on" && <KinButton variant="secondary" onClick={() => void disableHere()} loading={busy === "disable"}>Tắt máy này</KinButton>}
              {state === "on" && <KinButton variant="ghost" onClick={() => void sendTest()} loading={busy === "test"}>Gửi thử</KinButton>}
              {state === "blocked" && <KinButton variant="secondary" onClick={() => void refresh()}>Thử lại</KinButton>}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium" style={{ color: "var(--kin-chu-chinh)" }}>Việc được báo</h3>
            <div className="divide-y" style={{ borderColor: "var(--kin-vien-thuong)" }}>
              {PUSH_TYPES.map(t => (
                <label key={t} htmlFor={`push-${t}`} className="flex items-start gap-3 py-3 min-h-[44px] cursor-pointer">
                  <input id={`push-${t}`} type="checkbox" role="switch" checked={cfg.types[t]} disabled={busy === `t:${t}`} onChange={e => void toggle(t, e.target.checked)}
                    className="mt-1 w-5 h-5 flex-shrink-0" style={{ accentColor: "var(--kin-nhan-nen)" }} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium" style={{ color: "var(--kin-chu-chinh)" }}>{PUSH_DEFS[t].label}</span>
                    <span className="block text-[length:var(--kin-co-goc)] mt-0.5" style={MUTED}>{PUSH_DEFS[t].hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-lg px-3 py-2 text-[length:var(--kin-co-goc)]" style={{ ...MUTED, background: "var(--kin-nen-trang)" }}>
            <p className="font-medium" style={{ color: "var(--kin-chu-chinh)" }}>Giờ yên lặng 22:00–07:00</p>
            <p className="mt-0.5">Trong giờ này KiN chỉ tạo thông báo trong ứng dụng, không đẩy. Ngoại lệ: báo nghỉ còn dưới 2 giờ là đến giờ học.</p>
            <p className="mt-1">Chữ trên màn hình khoá không có tên học sinh hay số tiền.</p>
          </div>

          {cfg.devices.length > 0 && (
            <div>
              <h3 className="text-sm font-medium" style={{ color: "var(--kin-chu-chinh)" }}>Thiết bị đã bật ({cfg.devices.length}/{cfg.maxDevices})</h3>
              <ul className="mt-2 space-y-2">
                {cfg.devices.map(d => (
                  <li key={d.id} className="rounded-lg p-3 flex items-center justify-between gap-3 flex-wrap" style={{ border: "1px solid var(--kin-vien-thuong)" }}>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--kin-chu-chinh)" }}>{d.label}{d.mine ? " · máy này" : ""}</p>
                      <p className="text-xs" style={MUTED}>Bật {when(d.createdAt)} · nhận được gần nhất {when(d.lastSeenAt)}</p>
                    </div>
                    {!d.mine && <KinButton variant="ghost" aria-label={`Gỡ ${d.label} bật ${when(d.createdAt)}`} loading={busy === `rm:${d.id}`} onClick={() => void removeDevice(d)}>Gỡ</KinButton>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-[length:var(--kin-co-goc)]" style={MUTED}>Dùng iPhone? Cần iOS 16.4 trở lên và phải cài KiN lên Màn hình chính trước. <a href="#cai-pwa" className="underline text-[var(--kin-nhan-link)]">Xem hướng dẫn từng bước</a>.</p>
        </div>
      )}
    </section>
  );
}
