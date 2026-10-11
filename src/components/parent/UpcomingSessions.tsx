// TT-202 — "Sổ của con": buổi học 14 ngày tới + nút Báo nghỉ + số buổi bù đang giữ.
// Phụ huynh không cần tài khoản (link riêng). Báo trước ≥ 2 giờ thì con được giữ buổi bù ngay;
// dưới 2 giờ thì gia sư xem và quyết định. Trạng thái luôn kèm chữ, không chỉ màu.
"use client";
import { useState } from "react";
import { hmOf, vnDateKeyOf, vnMinutesOfDay, dayOfWeekOfKey } from "@/lib/classSessions";
import type { MakeupSummary, UpcomingSession } from "@/lib/absenceServer";

const WEEKDAY = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
const ddmm = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}`;
const vnHm = (iso: string) => hmOf(vnMinutesOfDay(new Date(iso)));
const vnDate = (iso: string) => ddmm(vnDateKeyOf(new Date(iso)));
const card = { background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)" } as const;

const STATUS_TEXT: Record<string, { text: string; tone: string }> = {
  excused_auto: { text: "Đã báo nghỉ — con được giữ 1 buổi bù", tone: "var(--kin-tt-chu-xong)" },
  pending:      { text: "Đã báo nghỉ — chờ gia sư xác nhận", tone: "var(--kin-tt-chu-cho)" },
  excused_free: { text: "Đã báo nghỉ — không tính phí, con được giữ 1 buổi bù", tone: "var(--kin-tt-chu-xong)" },
  charged:      { text: "Đã báo nghỉ — buổi này tính phí theo quy định của gia sư", tone: "var(--kin-chu-phu)" },
};

export default function UpcomingSessions({ token, upcoming, makeup, nowIso }: { token: string; upcoming: UpcomingSession[]; makeup: MakeupSummary; nowIso: string }) {
  const [items, setItems] = useState(upcoming);
  const [mk, setMk] = useState(makeup);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const nowMs = Date.parse(nowIso);

  const keyOf = (s: UpcomingSession) => `${s.scheduleId}:${s.dateKey}`;

  async function submit(s: UpcomingSession) {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch(`/api/parent-portal/${token}/absences`, {
        method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" },
        body: JSON.stringify({ scheduleId: s.scheduleId, dateKey: s.dateKey, reason: reason.trim() || undefined }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg({ text: d.error ?? "Chưa báo được, anh/chị thử lại sau.", ok: false }); return; }
      setItems(list => list.map(x => keyOf(x) === keyOf(s) ? { ...x, absence: { status: d.status, leadMinutes: d.leadMinutes } } : x));
      if (d.makeupGranted) setMk(m => ({ ...m, count: m.count + 1, nextExpiresAt: m.nextExpiresAt ?? new Date(nowMs + 30 * 86400_000).toISOString() }));
      setMsg({
        ok: true,
        text: d.makeupGranted
          ? `Đã ghi nhận con nghỉ buổi ${ddmm(s.dateKey)}. Buổi này không tính phí và con được giữ 1 buổi bù.`
          : "Đã báo cho gia sư. Vì còn dưới 2 giờ nữa là tới buổi học, gia sư sẽ xem và nhắn lại anh/chị.",
      });
      setConfirming(null); setReason("");
    } catch { setMsg({ text: "Lỗi kết nối, anh/chị thử lại sau.", ok: false }); }
    finally { setBusy(false); }
  }

  return (
    <section className="mb-5" aria-labelledby="h-sap-toi">
      <h2 id="h-sap-toi" className="text-sm font-semibold mb-2" style={{ color: "var(--kin-chu-chinh)" }}>Buổi học sắp tới</h2>

      <div className="rounded-xl p-4 mb-3" style={card} aria-label="Buổi bù đang giữ">
        {mk.count > 0 ? (
          <>
            <p className="text-sm" style={{ color: "var(--kin-chu-chinh)" }}>
              Con đang giữ <b>{mk.count} buổi bù</b>
              {mk.nextExpiresAt && <> — buổi gần nhất hết hạn ngày <b>{vnDate(mk.nextExpiresAt)}</b></>}.
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--kin-chu-phu)" }}>Thầy/Cô sẽ hẹn giờ bù với anh/chị. Buổi bù hết hạn sau 30 ngày kể từ ngày được giữ.</p>
          </>
        ) : (
          <p className="text-sm" style={{ color: "var(--kin-chu-phu)" }}>Con chưa có buổi bù nào.</p>
        )}
      </div>

      {msg && <p role="status" className="text-sm mb-3 rounded-lg p-3" style={{ ...card, color: msg.ok ? "var(--kin-tt-chu-xong)" : "var(--kin-tt-chu-loi)" }}>{msg.text}</p>}

      {items.length === 0 ? (
        <p className="text-sm rounded-xl p-4" style={{ ...card, color: "var(--kin-chu-phu)" }}>14 ngày tới con chưa có buổi học nào theo lịch.</p>
      ) : (
        <ul className="space-y-2">
          {items.map(s => {
            const k = keyOf(s);
            const st = s.absence ? STATUS_TEXT[s.absence.status] : null;
            const free = Date.parse(s.deadlineAt) > nowMs;
            return (
              <li key={k} className="rounded-xl p-4" style={card}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate" style={{ color: "var(--kin-chu-chinh)" }}>{s.courseName}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--kin-chu-phu)" }}>
                      {WEEKDAY[dayOfWeekOfKey(s.dateKey)]} {ddmm(s.dateKey)} · {vnHm(s.startAt)}–{vnHm(s.endAt)}
                    </p>
                  </div>
                  {!s.absence && confirming !== k && (
                    <button type="button" onClick={() => { setConfirming(k); setMsg(null); }}
                      className="px-3 py-2 rounded-lg text-sm min-h-[44px] flex-shrink-0"
                      style={{ background: "var(--kin-nen-nhan)", color: "var(--kin-th-navy)", border: "1px solid var(--kin-vien-thuong)" }}>
                      Báo nghỉ
                    </button>
                  )}
                </div>
                {st && <p className="text-xs font-semibold mt-2" style={{ color: st.tone }}>{st.text}</p>}
                {confirming === k && !s.absence && (
                  <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--kin-vien-nhat)" }}>
                    <p className="text-sm" style={{ color: "var(--kin-chu-chinh)" }}>
                      {free
                        ? <>Anh/chị báo nghỉ trước <b>{vnHm(s.deadlineAt)} {vnDate(s.deadlineAt) !== vnDate(s.startAt) ? `ngày ${vnDate(s.deadlineAt)}` : ""}</b> nên con được <b>giữ 1 buổi bù, không tính phí</b>.</>
                        : <>Còn dưới 2 giờ nữa là tới buổi học. Gia sư sẽ xem và quyết định có tính phí hay không; nếu không tính phí con vẫn được giữ 1 buổi bù.</>}
                    </p>
                    <label htmlFor={`ly-do-${k}`} className="block text-xs mt-3" style={{ color: "var(--kin-chu-phu)" }}>Lý do (không bắt buộc)</label>
                    <textarea id={`ly-do-${k}`} rows={2} maxLength={500} value={reason} onChange={e => setReason(e.target.value)}
                      className="w-full mt-1 px-3 py-2 rounded-lg text-sm"
                      style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)", color: "var(--kin-chu-chinh)" }} />
                    <div className="flex gap-2 mt-3">
                      <button type="button" disabled={busy} onClick={() => void submit(s)}
                        className="px-4 py-2 rounded-lg text-sm font-semibold min-h-[44px] disabled:opacity-60"
                        style={{ background: "var(--kin-nhan-nen)", color: "var(--kin-nhan-chu-tren-nen)" }}>
                        {busy ? "Đang gửi…" : "Xác nhận báo nghỉ"}
                      </button>
                      <button type="button" disabled={busy} onClick={() => { setConfirming(null); setReason(""); }}
                        className="px-4 py-2 rounded-lg text-sm min-h-[44px]"
                        style={{ background: "var(--kin-nen-trang)", color: "var(--kin-chu-chinh)", border: "1px solid var(--kin-vien-thuong)" }}>
                        Không nghỉ nữa
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
